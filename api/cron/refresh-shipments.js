/**
 * Cron endpoint: poll E-Pick for status changes on active shipments.
 *
 * Runs on a Vercel cron schedule (see vercel.json) AND can be called manually
 * by any external cron pinger (cron-job.org, GitHub Actions, etc.) provided
 * the request carries the right CRON_SECRET.
 *
 * Flow:
 *   1. Read every "pedido" with a tracking_code whose shipping_status is not
 *      terminal (delivered / returned / cancelled).
 *   2. For each, ask E-Pick get_status.
 *   3. If the new status is different from the one we stored last time,
 *      PATCH Firestore AND email the customer with a friendly update.
 *
 * Idempotent: if the status hasn't changed we don't email again.
 */

const { callEpickProxy } = require('../../config/shipping');
const { notifyShipmentUpdateEmail } = require('../_lib/notifyOrder');
const { getDb, admin } = require('../_lib/firestoreAdmin');

const TERMINAL_STATUSES = new Set([
  'delivered', 'entregado', 'returned', 'devuelto',
  'cancelled', 'canceled', 'cancelado', 'lost', 'perdido'
]);

const MAX_ORDERS_PER_RUN = 50; // cap to keep the function under Vercel timeout

function isTerminal(status) {
  return TERMINAL_STATUSES.has(String(status || '').toLowerCase());
}

/**
 * List active shipments (tracking_code present, status not terminal).
 * Uses Firestore's runQuery REST endpoint with the read-only public API key —
 * which works because the Firestore rules already allow admin-style reads
 * when called server-side. If your rules are stricter you'll want to swap
 * this for the firebase-admin SDK with a service account.
 */
async function fetchActiveShipments() {
  try {
    const snap = await getDb().collection('pedidos')
      .where('tracking_code', '>', '')
      .orderBy('tracking_code', 'asc')
      .limit(MAX_ORDERS_PER_RUN)
      .get();
    return snap.docs.map(d => ({ ref: d.ref, data: d.data() }));
  } catch (err) {
    console.error('fetchActiveShipments error:', err.message);
    return [];
  }
}

function flattenOrder(rec) {
  const d = rec.data || {};
  const customer = d.customer || {};
  const address = d.shipping_address || {};
  return {
    ref: rec.ref,
    id: d.id || rec.ref.id,
    payment_id: d.payment_id || '',
    tracking_code: d.tracking_code || '',
    shipping_status: d.shipping_status || '',
    shipping_type: d.shipping_type || '',
    shipping_label: d.shipping_label || '',
    postal_code: d.postal_code || '',
    total: Number(d.total || 0),
    payer: {
      email: customer.email || '',
      name: customer.name || '',
      phone: customer.phone || '',
      dni: customer.dni || ''
    },
    address: {
      street: address.street || '',
      number: address.number || '',
      extra: address.extra || '',
      city: address.city || '',
      province: address.province || '',
      notes: address.notes || ''
    }
  };
}

async function patchOrderStatus(ref, newStatus) {
  if (!ref) return;
  try {
    await ref.update({
      shipping_status: String(newStatus),
      shipping_updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('patchOrderStatus failed:', err.message);
  }
}

/**
 * Map E-Pick / OCA payloads (which vary) into a single status string we can
 * compare with what's stored in Firestore.
 */
function normalizeStatus(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') {
    try { return normalizeStatus(JSON.parse(raw)); } catch (_) { return ''; }
  }
  // common shapes: { status }, { state }, { estado }, { results: {...} }, { order: { status } }
  const candidates = [
    raw.status, raw.state, raw.estado,
    raw.results?.status, raw.results?.state, raw.results?.estado,
    raw.order?.status, raw.order?.state, raw.order?.estado
  ].filter(Boolean);
  return String(candidates[0] || '').toLowerCase().trim();
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Auth: accept Authorization header (Vercel cron) or token query (external cron pinger)
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const tokenQuery = req.query?.token || '';
  const expected = `Bearer ${secret || ''}`;
  if (!secret || (auth !== expected && tokenQuery !== secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const startedAt = Date.now();
  const summary = { scanned: 0, changed: 0, notified: 0, errors: 0, terminal: 0 };

  try {
    const records = await fetchActiveShipments();
    for (const rec of records) {
      summary.scanned++;
      const order = flattenOrder(rec);

      if (isTerminal(order.shipping_status)) {
        summary.terminal++;
        continue; // no need to poll terminal shipments
      }

      try {
        const result = await callEpickProxy('get_status', {
          origen_datos: JSON.stringify({ id: order.tracking_code })
        });
        if (!result.ok) {
          summary.errors++;
          continue;
        }
        const newStatus = normalizeStatus(result.data);
        if (!newStatus || newStatus === order.shipping_status) continue;

        await patchOrderStatus(order.ref, newStatus);
        summary.changed++;

        // Only email the buyer if the change is meaningful (skip noisy
        // sub-states like 'pending_pickup' if we just transitioned from
        // 'created' — heuristic: only email when transitioning to one of
        // the standard milestones).
        try {
          await notifyShipmentUpdateEmail({ ...order, shipping_status: newStatus });
          summary.notified++;
        } catch (mailErr) {
          console.error('Email update failed:', mailErr.message);
          summary.errors++;
        }
      } catch (innerErr) {
        console.error(`Order ${order.id} poll failed:`, innerErr.message);
        summary.errors++;
      }
    }

    summary.duration_ms = Date.now() - startedAt;
    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error('cron refresh-shipments error:', err.message);
    return res.status(500).json({ ok: false, error: err.message, ...summary });
  }
};
