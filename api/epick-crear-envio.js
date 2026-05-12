/**
 * E-Pick "create shipment" endpoint.
 *
 * Triggered by the webhook (or manually from the admin) after a payment is
 * approved and shipping_type === 'delivery'. While SANDBOX_MODE is on we just
 * return a deterministic fake tracking code so the rest of the pipeline (admin
 * UI, Firestore writes) can be developed and tested end-to-end.
 *
 * TODO: uncomment the real fetch() block once Sol provides EPICK_API_KEY /
 *       EPICK_API_SECRET and the production sender postal code.
 */

const crypto = require('crypto');
const { EPICK_CONFIG } = require('../config/shipping');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

function mockTrackingCode(orderId) {
  // Stable per order so retries don't produce a new code
  const h = crypto.createHash('sha1').update(String(orderId || Date.now())).digest('hex');
  return `EP-MOCK-${h.substring(0, 10).toUpperCase()}`;
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

  try {
    const { order_id, sender, recipient, package: pkg } = req.body || {};

    if (!order_id || !recipient) {
      return res.status(400).json({ error: 'order_id y recipient son requeridos' });
    }

    // ------- SANDBOX path -------
    if (EPICK_CONFIG.SANDBOX_MODE) {
      const tracking = mockTrackingCode(order_id);
      return res.status(200).json({
        success: true,
        tracking_code: tracking,
        label_url: `https://example.com/labels/${tracking}.pdf`,
        sandbox: true,
        message: 'Sandbox mode: no se contactó E-Pick'
      });
    }

    // ------- LIVE E-Pick call (uncomment when credentials are ready) -------
    /*
    const body = {
      apiKey: EPICK_CONFIG.API_KEY,
      external_reference: order_id,
      sender: sender || EPICK_CONFIG.SENDER,
      recipient: {
        name: recipient.name,
        address: recipient.address,
        city: recipient.city,
        postal_code: recipient.postal_code,
        phone: recipient.phone
      },
      package: pkg || { weight_kg: 0.5, length: 20, width: 15, height: 5 }
    };
    const resp = await fetch(`${EPICK_CONFIG.BASE_URL}/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EPICK_CONFIG.API_SECRET}`
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`E-Pick create shipment failed: ${resp.status}`);
    const data = await resp.json();
    return res.status(200).json({
      success: true,
      tracking_code: data.tracking_code,
      label_url: data.label_url,
      sandbox: false
    });
    */

    return res.status(501).json({
      success: false,
      error: 'E-Pick live mode aún no implementado'
    });
  } catch (err) {
    console.error('epick-crear-envio error:', err.message);
    return res.status(500).json({ success: false, error: 'No se pudo crear el envío' });
  }
};
