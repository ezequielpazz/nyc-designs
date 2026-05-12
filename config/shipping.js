/**
 * E-Pick shipping integration config (NYC Designs).
 *
 * Until Sol provides the real API credentials we run in SANDBOX_MODE and the
 * serverless endpoints under api/epick-*.js fall back to a local price table
 * and mock tracking codes. The shape of this object is intentionally stable so
 * we only need to flip env vars and `SANDBOX_MODE` to go live.
 *
 * Switch to live mode:
 *   1) Set EPICK_API_KEY and EPICK_API_SECRET in Vercel
 *   2) Set SANDBOX_MODE to false (or set EPICK_LIVE=1 in env)
 *   3) Uncomment the real fetch() blocks marked with TODO inside api/epick-*.js
 */

const EPICK_CONFIG = {
  // ----- CREDENTIALS -----
  API_KEY: process.env.EPICK_API_KEY || 'PENDING',
  API_SECRET: process.env.EPICK_API_SECRET || 'PENDING',

  // ----- ENDPOINTS (replace with real ones once Sol confirms) -----
  BASE_URL: process.env.EPICK_BASE_URL || 'https://api.e-pick.com.ar',
  SANDBOX_URL: process.env.EPICK_SANDBOX_URL || 'https://sandbox.e-pick.com.ar',

  // ----- SENDER (NYC Designs pickup point) -----
  SENDER: {
    name: 'NYC Designs',
    address: process.env.EPICK_SENDER_ADDRESS || 'Acassuso 5268',
    city: 'CABA',
    postal_code: process.env.EPICK_SENDER_CP || 'PENDING',
    phone: '5491123199122'
  },

  // ----- MODE -----
  // While SANDBOX_MODE is true the API stubs return deterministic mock data and
  // never hit the real E-Pick endpoints.
  SANDBOX_MODE: process.env.EPICK_LIVE === '1' ? false : true,

  // ----- FALLBACK PRICES (used by sandbox + when API is unavailable) -----
  // These mirror what js/main.js already calculates so the customer sees the
  // same price on the front and on the backend.
  FALLBACK_PRICES: {
    CABA: 2500,
    GBA_NORTE: 3000,
    GBA_OESTE: 3200,
    GBA_SUR: 3200,
    LA_PLATA: 3500,
    RESTO_BA: 4000,
    INTERIOR: 5500
  },

  // Average production + handover window communicated to the customer.
  DEFAULT_ESTIMATED_DAYS: { min: 3, max: 7 }
};

/**
 * Resolve a price tier from an Argentine 4-digit postal code.
 * Kept here so api/* and the front share the same source of truth.
 */
function priceForPostalCode(postalCode) {
  const cp = String(postalCode || '').trim();
  if (!/^\d{4}$/.test(cp)) return null;

  const n = parseInt(cp, 10);
  if (n >= 1000 && n <= 1499) return { tier: 'CABA', price: EPICK_CONFIG.FALLBACK_PRICES.CABA };
  if (n >= 1600 && n <= 1699) return { tier: 'GBA_NORTE', price: EPICK_CONFIG.FALLBACK_PRICES.GBA_NORTE };
  if (n >= 1700 && n <= 1799) return { tier: 'GBA_OESTE', price: EPICK_CONFIG.FALLBACK_PRICES.GBA_OESTE };
  if (n >= 1800 && n <= 1899) return { tier: 'GBA_SUR', price: EPICK_CONFIG.FALLBACK_PRICES.GBA_SUR };
  if (n >= 1900 && n <= 1999) return { tier: 'LA_PLATA', price: EPICK_CONFIG.FALLBACK_PRICES.LA_PLATA };

  const prefix = cp.substring(0, 2);
  const baPrefixes = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
  if (baPrefixes.includes(prefix)) {
    return { tier: 'RESTO_BA', price: EPICK_CONFIG.FALLBACK_PRICES.RESTO_BA };
  }
  return { tier: 'INTERIOR', price: EPICK_CONFIG.FALLBACK_PRICES.INTERIOR };
}

module.exports = { EPICK_CONFIG, priceForPostalCode };
