/**
 * E-Pick shipping quote endpoint — operation get_rates.
 *
 * Sandbox / no api_key path: resolves the price from the local zone table so
 * the storefront UX never degrades while we wait for credentials.
 * Live path: form-encoded POST to the Wanderlust Codes proxy.
 */

const { EPICK_CONFIG, priceForPostalCode, callEpickProxy } = require('../config/shipping');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateBucket = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const entry = rateBucket.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + RATE_LIMIT_WINDOW_MS; }
  entry.count++;
  rateBucket.set(ip, entry);
  if (rateBucket.size > 1000) {
    for (const [k, v] of rateBucket) if (now > v.reset) rateBucket.delete(k);
  }
  return entry.count <= RATE_LIMIT_MAX;
}

function fallbackQuote(postalCode) {
  const match = priceForPostalCode(postalCode);
  if (!match) return null;
  const { min, max } = EPICK_CONFIG.DEFAULT_ESTIMATED_DAYS;
  return {
    success: true,
    price: match.price,
    tier: match.tier,
    estimated_days: max,
    estimated_window: `${min}-${max} días hábiles`,
    sandbox: true
  };
}

/**
 * Pick the cheapest service from the e-pick rates response. The exact shape
 * depends on e-pick's payload (the doc calls it "JSON con el listado de
 * servicios disponibles") so we accept a few common shapes defensively.
 */
function pickCheapest(rates) {
  if (!rates) return null;
  const list = Array.isArray(rates) ? rates
             : Array.isArray(rates.rates) ? rates.rates
             : Array.isArray(rates.services) ? rates.services
             : Array.isArray(rates.data) ? rates.data
             : null;
  if (!list || !list.length) return null;
  return list
    .map(r => ({
      ...r,
      _price: Number(r.price ?? r.cost ?? r.total ?? r.amount ?? r.precio ?? 0),
      _days: Number(r.estimated_days ?? r.days ?? r.eta ?? 0)
    }))
    .filter(r => r._price > 0)
    .sort((a, b) => a._price - b._price)[0] || null;
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
      packages
    } = req.body || {};

    if (!postal_code_destination) {
      return res.status(400).json({ error: 'postal_code_destination requerido' });
    }

    // ------- SANDBOX path -------
    if (EPICK_CONFIG.SANDBOX_MODE) {
      const q = fallbackQuote(postal_code_destination);
      if (!q) return res.status(400).json({ error: 'Código postal inválido' });
      return res.status(200).json(q);
    }

    // ------- LIVE path: Wanderlust proxy -------
    const pkgs = Array.isArray(packages) && packages.length
      ? packages.map(p => ({
          sizeWidth: Number(p.sizeWidth ?? p.width ?? EPICK_CONFIG.DEFAULT_PACKAGE.sizeWidth),
          sizeHeight: Number(p.sizeHeight ?? p.height ?? EPICK_CONFIG.DEFAULT_PACKAGE.sizeHeight),
          sizeDepth: Number(p.sizeDepth ?? p.depth ?? EPICK_CONFIG.DEFAULT_PACKAGE.sizeDepth),
          weight: Number(p.weight ?? EPICK_CONFIG.DEFAULT_PACKAGE.weight)
        }))
      : [EPICK_CONFIG.DEFAULT_PACKAGE];

    const result = await callEpickProxy('get_rates', {
      origZip: postal_code_origin || EPICK_CONFIG.SENDER.postalCode,
      destZip: postal_code_destination,
      api_key: EPICK_CONFIG.API_KEY,
      Packages: pkgs
    });

    if (!result.ok) {
      // Fall back to local table so the cart never gets stuck.
      const q = fallbackQuote(postal_code_destination);
      if (q) return res.status(200).json({ ...q, fallback_reason: result.error });
      return res.status(502).json({ success: false, error: 'No se pudo cotizar', detail: result.error });
    }

    const cheapest = pickCheapest(result.data);
    if (!cheapest) {
      const q = fallbackQuote(postal_code_destination);
      if (q) return res.status(200).json({ ...q, fallback_reason: 'no_services' });
      return res.status(502).json({ success: false, error: 'Sin servicios disponibles' });
    }

    return res.status(200).json({
      success: true,
      price: cheapest._price,
      estimated_days: cheapest._days || EPICK_CONFIG.DEFAULT_ESTIMATED_DAYS.max,
      service: cheapest, // raw service object — store it so get_etiquetas can reuse it
      sandbox: false
    });
  } catch (err) {
    console.error('epick-cotizar error:', err.message);
    const q = fallbackQuote(req.body?.postal_code_destination);
    if (q) return res.status(200).json({ ...q, fallback_reason: 'exception' });
    return res.status(500).json({ success: false, error: 'No se pudo cotizar' });
  }
};
