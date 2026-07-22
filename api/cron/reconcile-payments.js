/**
 * Cron endpoint: daily reconciliation between MercadoPago and Firestore.
 *
 * THE safety net against lost sales. Every day it:
 *   1. Pulls the APPROVED payments of the last 48 h from MP's API.
 *   2. Keeps only web-store checkouts (payments that carry cart items —
 *      transfers, QR/Point sales and other money-in movements are ignored).
 *   3. For each one, checks if the order exists in Firestore.
 *   4. If it's MISSING (webhook never arrived / failed), it re-runs the
 *      exact same pipeline the webhook uses: save order, decrement stock,
 *      create E-Pick shipment, email Sol + customer.
 *
 * Combined with MP's own webhook retries and the per-preference
 * notification_url this makes losing a sale practically impossible.
 *
 * Auth: same contract as refresh-shipments — Vercel cron Authorization
 * header or ?token=CRON_SECRET for external pingers.
 */

const mercadopago = require('mercadopago');
const { processApprovedPayment } = require('../webhook');

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});
const payment = new mercadopago.Payment(client);

const LOOKBACK_HOURS = 48;
const MAX_PAYMENTS_PER_RUN = 50;

async function searchRecentApprovedPayments() {
  const end = new Date();
  const begin = new Date(end.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    range: 'date_created',
    begin_date: begin.toISOString(),
    end_date: end.toISOString(),
    limit: String(MAX_PAYMENTS_PER_RUN)
  });
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/search?${qs}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
  });
  if (!resp.ok) {
    throw new Error(`MP payments/search failed: ${resp.status}`);
  }
  const data = await resp.json();
  return Array.isArray(data.results) ? data.results : [];
}

/** Web-store checkouts always carry the cart items; transfers/QR don't. */
function isStoreCheckout(p) {
  return p.status === 'approved'
    && Array.isArray(p.additional_info?.items)
    && p.additional_info.items.length > 0;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const tokenQuery = req.query?.token || '';
  const expected = `Bearer ${secret || ''}`;
  if (!secret || (auth !== expected && tokenQuery !== secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const summary = { scanned: 0, store_checkouts: 0, already_saved: 0, recovered: 0, errors: 0, recovered_ids: [] };

  try {
    const payments = await searchRecentApprovedPayments();
    summary.scanned = payments.length;

    for (const p of payments) {
      if (!isStoreCheckout(p)) continue;
      summary.store_checkouts++;

      try {
        // Re-fetch the full payment object — search results can be partial.
        const full = await payment.get({ id: p.id });
        const result = await processApprovedPayment(full);
        if (result.skipped) {
          summary.already_saved++;
        } else {
          summary.recovered++;
          summary.recovered_ids.push(String(p.id));
          console.error(`RECONCILE: recovered lost sale payment_id=${p.id} → ${result.order_id}`);
        }
      } catch (err) {
        summary.errors++;
        console.error(`RECONCILE: failed for payment ${p.id}:`, err.message);
      }
    }

    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error('cron reconcile-payments error:', err.message);
    return res.status(500).json({ ok: false, error: err.message, ...summary });
  }
};
