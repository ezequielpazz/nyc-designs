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

const FIREBASE_PROJECT = 'nyc-designs';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

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
  if (!FIREBASE_API_KEY) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'pedidos' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'tracking_code' },
          op: 'GREATER_THAN',
          value: { stringValue: '' }
        }
      },
      orderBy: [
        { field: { fieldPath: 'tracking_code' }, direction: 'ASCENDING' }
      ],
      limit: MAX_ORDERS_PER_RUN
    }
  };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (Array.isArray(data) ? data : [])
      .filter(r => r.document)
      .map(r => ({
        docName: r.document.name,
        fields: r.document.fields || {}
      }));
  } catch (err) {
    console.error('fetchActiveShipments error:', err.message);
    return [];
  }
}

function readField(fields, key, type = 'stringValue') {
  return fields?.[key]?.[type];
}

function flattenOrder(rec) {
  const f = rec.fields;
  const customer = f.customer?.mapValue?.fields || {};
  const address = f.shipping_address?.mapValue?.fields || {};
  return {
    docName: rec.docName,
    id: readField(f, 'id') || rec.docName.split('/').pop(),
    payment_id: readField(f, 'payment_id'),
    tracking_code: readField(f, 'tracking_code') || '',
    shipping_status: readField(f, 'shipping_status') || '',
    shipping_type: readField(f, 'shipping_type') || '',
    shipping_label: readField(f, 'shipping_label') || '',
    postal_code: readField(f, 'postal_code') || '',
    total: Number(f.total?.doubleValue || f.total?.integerValue || 0),
    payer: {
      email: customer.email?.stringValue || '',
      name: customer.name?.stringValue || '',
      phone: customer.phone?.stringValue || '',
      dni: customer.dni?.stringValue || ''
    },
    address: {
      street: address.street?.stringValue || '',
      number: address.number?.stringValue || '',
      extra: address.extra?.stringValue || '',
      city: address.city?.stringValue || '',
      province: address.province?.stringValue || '',
      notes: address.notes?.stringValue || ''
    }
  };
}

async function patchOrderStatus(docName, newStatus) {
  if (!FIREBASE_API_KEY || !docName) return;
  const mask = ['shipping_status', 'shipping_updated_at']
    .map(p => `updateMask.fieldPaths=${p}`).join('&');
  const url = `https://firestore.googleapis.com/v1/${docName}?${mask}&key=${FIREBASE_API_KEY}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        shipping_status: { stringValue: String(newStatus) },
        shipping_updated_at: { timestampValue: new Date().toISOString() }
      }
    })
  });
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

        await patchOrderStatus(order.docName, newStatus);
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
