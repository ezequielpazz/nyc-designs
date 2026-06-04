/**
 * Public lookup of an order by MercadoPago payment_id.
 *
 * Used by the storefront success page after MP redirects the buyer back to
 * /?status=approved&payment_id=...&external_reference=...
 *
 * To avoid leaking arbitrary orders to whoever knows a payment_id, the
 * response is intentionally limited to the data the buyer themselves needs
 * for that moment:
 *   - item titles + quantities
 *   - download URLs for VIRTUAL items only
 *   - shipping_type (so the UI knows if it was a digital order)
 *   - tracking_code if present
 * No customer PII (DNI, address, phone, email) is returned.
 */

const FIREBASE_PROJECT = 'nyc-designs';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

async function findOrderByPaymentId(paymentId) {
  if (!FIREBASE_API_KEY || !paymentId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'pedidos' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'payment_id' },
          op: 'EQUAL',
          value: { stringValue: String(paymentId) }
        }
      },
      limit: 1
    }
  };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const hit = Array.isArray(data) ? data.find(r => r.document) : null;
    return hit?.document || null;
  } catch (err) {
    console.error('order-lookup fetch failed:', err.message);
    return null;
  }
}

function readField(fields, key) {
  return fields?.[key];
}

function fieldString(f) {
  return f?.stringValue || '';
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const paymentId = req.query?.payment_id;
  if (!paymentId) return res.status(400).json({ error: 'payment_id required' });

  const doc = await findOrderByPaymentId(paymentId);
  if (!doc) return res.status(404).json({ error: 'Order not found' });

  const fields = doc.fields || {};
  const itemsRaw = fields.items?.arrayValue?.values || [];
  const items = itemsRaw.map(v => {
    const f = v.mapValue?.fields || {};
    return {
      title: fieldString(f.title),
      quantity: Number(f.quantity?.integerValue || 1),
      kind: fieldString(f.kind) || 'fisico',
      // download_url is only included when the item is virtual
      download_url: fieldString(f.kind) === 'virtual' ? fieldString(f.download_url) : ''
    };
  });

  const shippingType = fieldString(fields.shipping_type) || 'pickup';
  const trackingCode = fieldString(fields.tracking_code) || '';

  return res.status(200).json({
    success: true,
    shipping_type: shippingType,
    is_digital: shippingType === 'digital' || items.every(i => i.kind === 'virtual'),
    items,
    tracking_code: trackingCode
  });
};
