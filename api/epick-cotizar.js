/**
 * E-Pick shipping quote endpoint — operation get_rates.
 *
 * Sandbox / no api_key path: resolves the price from the local zone table so
 * the storefront UX never degrades while we wait for credentials.
 * Live path: form-encoded POST to the Wanderlust Codes proxy.
 */

const { EPICK_CONFIG, priceForPostalCode, callEpickProxy } = require('../config/shipping');
const { rateLimit, clientKey } = require('./_lib/rateLimit');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30; // quoting is read-only, allow more

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
 * Pick the cheapest service from the e-pick rates response. The actual shape
 * observed from the Wanderlust proxy is a single object:
 *   { isValid: true, price: 9477, equivalence: 1, eta: [1, 2] }
 * but we also accept arrays / nested shapes defensively in case it changes.
 */
function pickCheapest(rates) {
  if (!rates) return null;

  // Single-object shape (observed in production)
  if (rates.isValid !== undefined || (rates.price !== undefined && !Array.isArray(rates))) {
    if (rates.isValid === false) return null;
    const price = Number(rates.price ?? rates.cost ?? 0);
    if (!price) return null;
    const etaArr = Array.isArray(rates.eta) ? rates.eta : null;
    const days = etaArr ? Number(etaArr[etaArr.length - 1]) : Number(rates.estimated_days || rates.days || 0);
    return { ...rates, _price: price, _days: days };
  }

  // Array / list-style fallback (kept for future schema changes)
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
      _days: Number(r.estimated_days ?? r.days ?? (Array.isArray(r.eta) ? r.eta[r.eta.length - 1] : r.eta) ?? 0)
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

  const ip = clientKey(req);
  const rl = await rateLimit({
    bucket: 'epick-cotizar',
    key: ip,
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS
  });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intentá en un minuto.' });
  }

  try {
    // Accept both naming conventions: destination (current
    // storefront) and destZip (matches the spec / e-pick doc verbatim).
    // Accept both naming conventions: postal_code_destination (current
    // storefront) and destZip (matches the spec / e-pick doc verbatim).
    const body = req.body || {};
    const destination = body.destination || body.postal_code_destination || body.destZip;
    const origin_cp = body.origin_cp || body.postal_code_origin || body.origZip;
    const packages = body.packages;

    if (!destination) {
      return res.status(400).json({ error: 'destZip / postal_code_destination requerido' });
    }

    // ------- SANDBOX path -------
    if (EPICK_CONFIG.SANDBOX_MODE) {
      const q = fallbackQuote(destination);
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
      origZip: origin_cp || EPICK_CONFIG.SENDER.postalCode,
      destZip: destination,
      api_key: EPICK_CONFIG.API_KEY,
      Packages: pkgs
    });

    if (!result.ok) {
      // Fall back to local table so the cart never gets stuck.
      const q = fallbackQuote(destination);
      if (q) return res.status(200).json({ ...q, fallback_reason: result.error });
      return res.status(502).json({ success: false, error: 'No se pudo cotizar', detail: result.error });
    }

    const cheapest = pickCheapest(result.data);
    if (!cheapest) {
      const q = fallbackQuote(destination);
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
    const q = fallbackQuote(req.body?.destination);
    if (q) return res.status(200).json({ ...q, fallback_reason: 'exception' });
    return res.status(500).json({ success: false, error: 'No se pudo cotizar' });
  }
};
