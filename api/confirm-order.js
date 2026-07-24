/**
 * Resilient order confirmation, called by the storefront success page when
 * the buyer returns from MercadoPago (back_url carries external_reference +
 * payment_id + status).
 *
 * Why this exists: the webhook needs payment.get to read the payment details,
 * and MercadoPago sometimes blocks that read for not-yet-verified accounts
 * ("Unauthorized use of live credentials"). We already stored the
 * server-validated checkout at create-preference time, so here we can build
 * the order and send the receipts WITHOUT reading the payment — using the
 * payment.get result only as an opportunistic double-check when it works.
 *
 * Idempotent: if the webhook already created the order (or a previous call
 * did), we skip. Prices come from the stored checkout (validated against
 * Firestore), so they can't be tampered with from the client.
 */

const mercadopago = require('mercadopago');
const { getDb } = require('./_lib/firestoreAdmin');
const { processCheckoutOrder, orderExistsForPayment } = require('./webhook');

const client = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new mercadopago.Payment(client);

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const externalRef = String(body.external_reference || '').trim();
    const paymentId = String(body.payment_id || body.collection_id || '').trim();
    const status = String(body.status || body.collection_status || '').trim();

    // Only act on approved payments that carry both keys.
    if (!externalRef || !paymentId) {
      return res.status(400).json({ error: 'external_reference y payment_id requeridos' });
    }
    if (status && status !== 'approved') {
      return res.status(200).json({ ok: true, ignored: true, reason: `status_${status}` });
    }

    // Already processed by the webhook or a prior call?
    if (await orderExistsForPayment(paymentId)) {
      return res.status(200).json({ ok: true, already: true });
    }

    // Load the checkout we stored before the payment.
    const snap = await getDb().collection('checkouts_pendientes').doc(externalRef).get();
    if (!snap.exists) {
      // Nothing stored — let the webhook / reconciliation handle it.
      return res.status(200).json({ ok: true, pending: true, reason: 'no_checkout' });
    }
    const checkout = snap.data();

    // Opportunistic verification: if MP lets us read the payment, use it for
    // the exact amount + status + fee. If it's blocked, proceed with stored data.
    let paymentData = null;
    try {
      const pd = await payment.get({ id: paymentId });
      if (pd && (pd.status === 'approved' || pd.status_detail === 'accredited')) {
        paymentData = pd;
      } else if (pd && pd.status && pd.status !== 'approved') {
        // MP says NOT approved — trust MP over the redirect, do not create.
        return res.status(200).json({ ok: true, ignored: true, reason: `mp_${pd.status}` });
      }
    } catch (readErr) {
      console.error('confirm-order: payment.get blocked, using stored checkout:', readErr.message);
    }

    const result = await processCheckoutOrder({ paymentId, checkout, paymentData });
    return res.status(200).json({ ok: true, ...result });

  } catch (err) {
    console.error('confirm-order error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
