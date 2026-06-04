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

const { getDb } = require('./_lib/firestoreAdmin');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

async function findOrderByPaymentId(paymentId) {
  if (!paymentId) return null;
  try {
    const snap = await getDb().collection('pedidos')
      .where('payment_id', '==', String(paymentId))
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data();
  } catch (err) {
    console.error('order-lookup fetch failed:', err.message);
    return null;
  }
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

  const order = await findOrderByPaymentId(paymentId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = (order.items || []).map(item => ({
    title: item.title || '',
    quantity: Number(item.quantity || 1),
    kind: item.kind === 'virtual' ? 'virtual' : 'fisico',
    // download_url is only included when the item is virtual
    download_url: item.kind === 'virtual' ? (item.download_url || '') : ''
  }));

  const shippingType = order.shipping_type || 'pickup';

  return res.status(200).json({
    success: true,
    shipping_type: shippingType,
    is_digital: shippingType === 'digital' || (items.length > 0 && items.every(i => i.kind === 'virtual')),
    items,
    tracking_code: order.tracking_code || ''
  });
};
