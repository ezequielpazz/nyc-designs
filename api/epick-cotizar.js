/**
 * E-Pick shipping quote endpoint.
 *
 * Receives a destination postal code (and optional weight/dimensions) and
 * returns the price + estimated delivery window. While EPICK_CONFIG.SANDBOX_MODE
 * is true (no credentials yet) we resolve everything from the local fallback
 * table so the storefront keeps working.
 *
 * TODO: when Sol provides EPICK_API_KEY/EPICK_API_SECRET, set EPICK_LIVE=1 in
 *       Vercel and uncomment the real fetch() block below.
 */

const { EPICK_CONFIG, priceForPostalCode } = require('../config/shipping');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

// Same in-memory rate limiter shape as create-preference (per function instance)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30; // quotes are cheap, allow a bit more
const rateBucket = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const entry = rateBucket.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count++;
  rateBucket.set(ip, entry);
  if (rateBucket.size > 1000) {
    for (const [k, v] of rateBucket) if (now > v.reset) rateBucket.delete(k);
  }
  return entry.count <= RATE_LIMIT_MAX;
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

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intentá en un minuto.' });
  }

  try {
    const {
      postal_code_destination,
      postal_code_origin,
      weight_kg,
      dimensions
    } = req.body || {};

    if (!postal_code_destination) {
      return res.status(400).json({ error: 'postal_code_destination requerido' });
    }

    // ------- SANDBOX / fallback path -------
    if (EPICK_CONFIG.SANDBOX_MODE) {
      const match = priceForPostalCode(postal_code_destination);
      if (!match) {
        return res.status(400).json({ error: 'Código postal inválido' });
      }
      const { min, max } = EPICK_CONFIG.DEFAULT_ESTIMATED_DAYS;
      return res.status(200).json({
        success: true,
        price: match.price,
        tier: match.tier,
        estimated_days: max,
        estimated_window: `${min}-${max} días hábiles`,
        sandbox: true
      });
    }

    // ------- LIVE E-Pick call (uncomment when credentials are ready) -------
    /*
    const body = {
      apiKey: EPICK_CONFIG.API_KEY,
      origin: postal_code_origin || EPICK_CONFIG.SENDER.postal_code,
      destination: postal_code_destination,
      weight: Number(weight_kg) || 0.5,
      dimensions: dimensions || { length: 20, width: 15, height: 5 }
    };
    const resp = await fetch(`${EPICK_CONFIG.BASE_URL}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EPICK_CONFIG.API_SECRET}`
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`E-Pick quote failed: ${resp.status}`);
    const data = await resp.json();
    return res.status(200).json({
      success: true,
      price: data.price,
      estimated_days: data.estimated_days,
      sandbox: false
    });
    */

    // Safety: until uncommented, treat live mode as not implemented
    return res.status(501).json({
      success: false,
      error: 'E-Pick live mode aún no implementado'
    });
  } catch (err) {
    console.error('epick-cotizar error:', err.message);
    // Best-effort fallback so the storefront never breaks the checkout
    const match = priceForPostalCode(req.body?.postal_code_destination);
    if (match) {
      return res.status(200).json({
        success: true,
        price: match.price,
        tier: match.tier,
        estimated_days: EPICK_CONFIG.DEFAULT_ESTIMATED_DAYS.max,
        sandbox: true,
        fallback_reason: 'api_unavailable'
      });
    }
    return res.status(500).json({ success: false, error: 'No se pudo cotizar' });
  }
};
