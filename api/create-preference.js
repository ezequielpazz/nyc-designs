const mercadopago = require('mercadopago');

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const preference = new mercadopago.Preference(client);

const FIREBASE_PROJECT = 'nyc-designs';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// Fetch real product price from Firestore
async function getProductPrice(productId) {
  if (!FIREBASE_API_KEY || !productId || productId === 'shipping') return null;

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/productos/${productId}?key=${FIREBASE_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;

  const doc = await resp.json();
  const price = doc.fields?.precio;
  if (!price) return null;

  return parseFloat(price.doubleValue ?? price.integerValue ?? price.stringValue);
}

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

// Simple in-memory rate limiter (per Vercel function instance)
// 10 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateBucket = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const entry = rateBucket.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count++;
  rateBucket.set(ip, entry);
  // Cleanup occasionally
  if (rateBucket.size > 1000) {
    for (const [k, v] of rateBucket) if (now > v.reset) rateBucket.delete(k);
  }
  return entry.count <= RATE_LIMIT_MAX;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject requests from unknown origins (defense in depth, beyond CORS)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  // Rate limit per IP
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intentá en un minuto.' });
  }

  // Limit body size implicitly: reject obviously malicious payloads
  const bodyStr = JSON.stringify(req.body || {});
  if (bodyStr.length > 50_000) {
    return res.status(413).json({ error: 'Payload demasiado grande' });
  }

  try {
    const { items, payer, external_reference } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items inválidos' });
    }

    // Validate and build items with server-side price verification
    const validatedItems = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!qty || qty <= 0 || !Number.isInteger(qty)) {
        return res.status(400).json({ error: `Cantidad inválida para: ${item.title}` });
      }

      // Shipping is a special item - validate but don't look up in Firebase
      if (item.id === 'shipping') {
        const shippingPrice = Number(item.unit_price);
        if (!shippingPrice || shippingPrice <= 0 || shippingPrice > 50000) {
          return res.status(400).json({ error: 'Costo de envío inválido' });
        }
        validatedItems.push({
          id: 'shipping',
          title: 'Envío a domicilio',
          quantity: 1,
          unit_price: shippingPrice,
          currency_id: 'ARS'
        });
        continue;
      }

      // For real products: get price from Firebase (source of truth)
      const realPrice = await getProductPrice(item.id);

      if (realPrice === null) {
        // Fallback: if can't verify (no API key, product not found), use client price with validation
        const clientPrice = Number(item.unit_price);
        if (!clientPrice || clientPrice <= 0 || clientPrice > 1000000) {
          return res.status(400).json({ error: `Precio inválido para: ${item.title}` });
        }
        validatedItems.push({
          id: String(item.id),
          title: String(item.title || 'Producto').substring(0, 256),
          quantity: qty,
          unit_price: clientPrice,
          currency_id: 'ARS'
        });
      } else {
        // Use the real price from Firebase, ignore client price
        if (realPrice <= 0 || realPrice > 1000000) {
          return res.status(400).json({ error: `Precio inválido en base de datos para: ${item.title}` });
        }
        validatedItems.push({
          id: String(item.id),
          title: String(item.title || 'Producto').substring(0, 256),
          quantity: qty,
          unit_price: realPrice,
          currency_id: 'ARS'
        });
      }
    }

    const preferenceData = {
      items: validatedItems,
      payer: payer ? {
        name: payer.name,
        email: payer.email,
        phone: payer.phone ? { number: payer.phone } : undefined
      } : undefined,
      back_urls: {
        success: 'https://nycdesigns.com.ar/?status=approved',
        failure: 'https://nycdesigns.com.ar/?status=failure',
        pending: 'https://nycdesigns.com.ar/?status=pending'
      },
      auto_return: 'approved',
      external_reference: external_reference || `order_${Date.now()}`,
      statement_descriptor: 'NYC DESIGNS'
    };

    const response = await preference.create({ body: preferenceData });

    return res.status(200).json({
      id: response.id,
      init_point: response.init_point
    });

  } catch (error) {
    console.error('Error creating preference:', error);
    return res.status(500).json({
      error: 'Error al crear preferencia de pago',
      details: error.message
    });
  }
};
