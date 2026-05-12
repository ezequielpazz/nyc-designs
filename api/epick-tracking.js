/**
 * E-Pick tracking endpoint — operation get_status.
 *
 * Wanderlust proxy expects:
 *   method[get_status][origen_datos] = JSON.stringify({ id: "ORDER_ID" })
 *
 * The raw response from e-pick is forwarded as-is. We normalize the basic
 * status + history fields so the admin can render without reshaping each call.
 */

const { EPICK_CONFIG, callEpickProxy } = require('../config/shipping');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

function mockHistory(trackingCode) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  return [
    { status: 'created',    date: new Date(now - 6 * hour).toISOString(), description: 'Envío creado' },
    { status: 'picked_up',  date: new Date(now - 3 * hour).toISOString(), description: 'Retirado del remitente' },
    { status: 'in_transit', date: new Date(now - 1 * hour).toISOString(), description: 'En camino al destino' }
  ];
}

/**
 * Normalize the e-pick payload into { status, history }. The raw shape is
 * carried through in `raw` for the admin to inspect if needed.
 */
function normalize(raw) {
  if (!raw) return { status: 'unknown', history: [] };
  if (typeof raw === 'string') {
    try { return normalize(JSON.parse(raw)); } catch (_) { return { status: 'unknown', history: [] }; }
  }
  const status = raw.status || raw.state || raw.estado || (raw.order && raw.order.status) || 'unknown';
  const history = Array.isArray(raw.history) ? raw.history
                : Array.isArray(raw.events) ? raw.events
                : Array.isArray(raw.tracking) ? raw.tracking
                : Array.isArray(raw.movements) ? raw.movements
                : [];
  return { status: String(status), history };
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  try {
    const tracking_code = req.method === 'GET'
      ? req.query?.tracking_code
      : req.body?.tracking_code;

    if (!tracking_code) {
      return res.status(400).json({ error: 'tracking_code requerido' });
    }

    // ------- SANDBOX path -------
    if (EPICK_CONFIG.SANDBOX_MODE) {
      return res.status(200).json({
        success: true,
        tracking_code,
        status: 'in_transit',
        history: mockHistory(tracking_code),
        sandbox: true
      });
    }

    // ------- LIVE path -------
    const result = await callEpickProxy('get_status', {
      origen_datos: JSON.stringify({ id: String(tracking_code) })
    });

    if (!result.ok) {
      return res.status(502).json({ success: false, error: result.error || 'status_failed' });
    }

    const { status, history } = normalize(result.data);
    return res.status(200).json({
      success: true,
      tracking_code,
      status,
      history,
      raw: result.data,
      sandbox: false
    });
  } catch (err) {
    console.error('epick-tracking error:', err.message);
    return res.status(500).json({ success: false, error: 'No se pudo consultar el envío' });
  }
};
