/**
 * E-Pick tracking endpoint.
 *
 * Returns the current status + history for a tracking code. In SANDBOX_MODE we
 * synthesize a fake history so admin UI / customer notifications can be built
 * before the real integration is live.
 */

const { EPICK_CONFIG } = require('../config/shipping');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

function mockHistory(trackingCode) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  return [
    { status: 'created',     date: new Date(now - 6 * hour).toISOString(), description: 'Envío creado' },
    { status: 'picked_up',   date: new Date(now - 3 * hour).toISOString(), description: 'Retirado del remitente' },
    { status: 'in_transit',  date: new Date(now - 1 * hour).toISOString(), description: 'En camino al destino' }
  ];
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

    // ------- LIVE E-Pick call (uncomment when credentials are ready) -------
    /*
    const resp = await fetch(`${EPICK_CONFIG.BASE_URL}/shipments/${encodeURIComponent(tracking_code)}`, {
      headers: {
        Authorization: `Bearer ${EPICK_CONFIG.API_SECRET}`,
        'X-Api-Key': EPICK_CONFIG.API_KEY
      }
    });
    if (!resp.ok) throw new Error(`E-Pick tracking failed: ${resp.status}`);
    const data = await resp.json();
    return res.status(200).json({
      success: true,
      tracking_code,
      status: data.status,
      history: data.history || [],
      sandbox: false
    });
    */

    return res.status(501).json({
      success: false,
      error: 'E-Pick live mode aún no implementado'
    });
  } catch (err) {
    console.error('epick-tracking error:', err.message);
    return res.status(500).json({ success: false, error: 'No se pudo consultar el envío' });
  }
};
