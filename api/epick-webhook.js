/**
 * E-Pick webhook receiver.
 *
 * This is the URL we declare as `url_key` inside origen_datos when calling
 * get_etiquetas. E-Pick (via the Wanderlust proxy / wcNotificationUrl) POSTs
 * here every time an order changes state, and we patch the matching order in
 * Firestore so the admin sees the latest status.
 *
 * Security note: the proxy doc does not describe a signature scheme. To keep
 * the endpoint from being abused we require a shared token (`EPICK_WEBHOOK_TOKEN`)
 * either as a query parameter or as an X-Epick-Token header. Configure the
 * same token when handing the url_key to E-Pick.
 */

const FIREBASE_PROJECT = 'nyc-designs';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

async function findOrderByTracking(trackingCode) {
  if (!FIREBASE_API_KEY || !trackingCode) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'pedidos' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'tracking_code' },
          op: 'EQUAL',
          value: { stringValue: String(trackingCode) }
        }
      },
      limit: 1
    }
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const hit = Array.isArray(data) ? data.find(r => r.document) : null;
  return hit?.document?.name || null;
}

async function patchOrderStatus(docName, status, raw) {
  const mask = ['shipping_status', 'shipping_updated_at']
    .map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `https://firestore.googleapis.com/v1/${docName}?${mask}&key=${FIREBASE_API_KEY}`;
  const body = {
    fields: {
      shipping_status: { stringValue: String(status || 'updated') },
      shipping_updated_at: { timestampValue: new Date().toISOString() }
    }
  };
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  // GET → harmless ping (useful when registering the URL)
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, endpoint: 'epick-webhook' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Shared-token check (defense in depth — defaults to allow in dev only).
  const token = process.env.EPICK_WEBHOOK_TOKEN || '';
  if (token) {
    const given = req.headers['x-epick-token'] || req.query?.token || '';
    if (String(given) !== token) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  } else if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'EPICK_WEBHOOK_TOKEN not configured' });
  }

  // Reject huge payloads.
  const bodyStr = JSON.stringify(req.body || {});
  if (bodyStr.length > 50_000) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  try {
    const body = req.body || {};
    // The doc doesn't pin a field shape; we read a few likely keys.
    const trackingCode = body.id || body.order_id || body.tracking_code || body.tracking || body.data?.id;
    const status = body.status || body.state || body.estado || body.data?.status || 'updated';

    if (!trackingCode) {
      console.warn('epick-webhook: no tracking code in payload');
      return res.status(200).json({ received: true, ignored: true });
    }

    const docName = await findOrderByTracking(trackingCode);
    if (docName) {
      await patchOrderStatus(docName, status, body);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('epick-webhook error:', err.message);
    // Always 200 so the proxy doesn't retry forever.
    return res.status(200).json({ received: true });
  }
};
