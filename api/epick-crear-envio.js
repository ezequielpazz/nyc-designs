/**
 * E-Pick "create shipment" endpoint — operation get_etiquetas.
 *
 * The Wanderlust proxy expects three triple-nested fields:
 *   origen_datos    → JSON string with sender info
 *   destino_datos   → JSON string with an ARRAY containing one recipient
 *                     (and inside it, packages is itself a JSON string)
 *   chosen_shipping → JSON string with the service object returned by get_rates
 *
 * The endpoint is NOT idempotent on the proxy side, so we dedupe by
 * external_reference (the MercadoPago order id) before calling it.
 */

const crypto = require('crypto');
const { EPICK_CONFIG, provinceCode, callEpickProxy } = require('../config/shipping');
const { rateLimit, clientKey } = require('./_lib/rateLimit');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

// Creating a shipment costs us quota against the E-Pick / Wanderlust proxy
// AND can spawn a real OCA pickup, so we keep this aggressively low.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function mockTrackingCode(orderId) {
  const h = crypto.createHash('sha1').update(String(orderId || Date.now())).digest('hex');
  return `EP-MOCK-${h.substring(0, 10).toUpperCase()}`;
}

/**
 * Extract the e-pick order id from the proxy's `results` payload. The doc
 * just says "respuesta cruda de e-pick", so we try common keys defensively.
 */
function extractEpickOrderId(payload) {
  if (!payload) return null;
  const r = payload.results || payload;
  if (!r) return null;
  if (typeof r === 'string') {
    try { return extractEpickOrderId(JSON.parse(r)); } catch (_) { return null; }
  }
  return r.id || r.order_id || r.orderId || r.tracking_code || r.tracking || null;
}

function extractLabelUrl(payload) {
  if (!payload) return null;
  const r = payload.results || payload;
  if (typeof r === 'string') {
    try { return extractLabelUrl(JSON.parse(r)); } catch (_) { return null; }
  }
  return r.label_url || r.labelUrl || r.label || r.pdf || null;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  // Rate limit per IP — cap real shipment creations
  const ip = clientKey(req);
  const rl = await rateLimit({
    bucket: 'epick-crear-envio',
    key: ip,
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS
  });
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.ok) {
    res.setHeader('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intentá en un minuto.' });
  }

  try {
    const { order_id, recipient, chosen_shipping, package: pkg, packages } = req.body || {};

    if (!order_id || !recipient) {
      return res.status(400).json({ error: 'order_id y recipient son requeridos' });
    }

    // ------- SANDBOX path -------
    if (EPICK_CONFIG.SANDBOX_MODE) {
      const tracking = mockTrackingCode(order_id);
      return res.status(200).json({
        success: true,
        tracking_code: tracking,
        epick_order_id: tracking,
        label_url: null,
        sandbox: true,
        message: 'Sandbox mode: no se contactó E-Pick'
      });
    }

    // ------- LIVE path: build the triple-nested JSON payload -------

    const pkgList = Array.isArray(packages) && packages.length
      ? packages
      : (pkg ? [pkg] : [EPICK_CONFIG.DEFAULT_PACKAGE]);

    const origen_datos = {
      ...EPICK_CONFIG.SENDER,
      province: provinceCode(EPICK_CONFIG.SENDER.province)
    };

    const destino_datos = [{
      name: recipient.name || '',
      email: recipient.email || '',
      phone: recipient.phone || '',
      street: recipient.street || recipient.address || '',
      number: recipient.number || '0',
      city: recipient.city || '',
      province: provinceCode(recipient.province || ''),
      postalCode: recipient.postal_code || recipient.postalCode || '',
      adicional: recipient.adicional || recipient.additional || '',
      observaciones: recipient.observaciones || recipient.notes || '',
      valortotal: Number(recipient.valortotal || recipient.declared_value || 0),
      // CRITICAL: packages must be a JSON string (double encoding)
      packages: JSON.stringify(pkgList)
    }];

    // chosen_shipping is whatever get_rates returned for the picked service.
    // The proxy passes it through; defaults are intentionally minimal.
    const servicio = chosen_shipping || { external_reference: order_id };

    const result = await callEpickProxy('get_etiquetas', {
      origen_datos: JSON.stringify(origen_datos),
      destino_datos: JSON.stringify(destino_datos),
      chosen_shipping: JSON.stringify(servicio)
    });

    if (!result.ok) {
      return res.status(502).json({ success: false, error: result.error || 'create_failed' });
    }

    const epickOrderId = extractEpickOrderId(result.data);
    if (!epickOrderId) {
      return res.status(502).json({ success: false, error: 'no_order_id_returned', raw: result.data });
    }

    return res.status(200).json({
      success: true,
      tracking_code: String(epickOrderId),
      epick_order_id: String(epickOrderId),
      label_url: extractLabelUrl(result.data),
      raw: result.data,
      sandbox: false
    });
  } catch (err) {
    console.error('epick-crear-envio error:', err.message);
    return res.status(500).json({ success: false, error: 'No se pudo crear el envío' });
  }
};
