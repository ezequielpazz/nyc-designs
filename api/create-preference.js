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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://nyc-designs.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
        success: 'https://nyc-designs.vercel.app/?status=approved',
        failure: 'https://nyc-designs.vercel.app/?status=failure',
        pending: 'https://nyc-designs.vercel.app/?status=pending'
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
