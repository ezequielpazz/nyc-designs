/**
 * E-Pick coverage check — operation get_direccion.
 *
 * Should be called before confirming the address at checkout. In sandbox mode
 * we always return `covered: true` for valid 4-digit postal codes so the
 * storefront keeps working.
 */

const { EPICK_CONFIG, priceForPostalCode, provinceCode, callEpickProxy } = require('../config/shipping');

const ALLOWED_ORIGINS = [
  'https://nycdesigns.com.ar',
  'https://www.nycdesigns.com.ar',
  'https://nyc-designs.vercel.app'
];

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
    const { postal_code, street, number, city, province } = req.body || {};
    if (!postal_code) {
      return res.status(400).json({ error: 'postal_code requerido' });
    }

    if (EPICK_CONFIG.SANDBOX_MODE) {
      const match = priceForPostalCode(postal_code);
      return res.status(200).json({
        success: true,
        covered: !!match,
        tier: match?.tier || null,
        sandbox: true
      });
    }

    const result = await callEpickProxy('get_direccion', {
      postcode: String(postal_code),
      address_1: String(street || ''),
      address_2: String(number || ''),
      city: String(city || ''),
      state: provinceCode(province || '')
    });

    if (!result.ok) {
      return res.status(502).json({ success: false, error: result.error || 'coverage_failed' });
    }

    // e-pick's verify-coverage payload — pass through plus a flat "covered" hint.
    const covered = result.data?.covered === true
      || result.data?.coverage === true
      || result.data?.status === 'ok'
      || result.data?.results?.covered === true;

    return res.status(200).json({
      success: true,
      covered: !!covered,
      raw: result.data,
      sandbox: false
    });
  } catch (err) {
    console.error('epick-cobertura error:', err.message);
    return res.status(500).json({ success: false, error: 'No se pudo verificar cobertura' });
  }
};
