/**
 * E-Pick shipping integration config (NYC Designs).
 *
 * Backed by the Wanderlust Codes proxy that wraps the real e-pick.com.ar API.
 * Docs: api-epick-endpoints_2.pdf (Wanderlust Codes).
 *
 * Single endpoint, dispatched by method[OPERATION][...] form-encoded fields.
 * HTTP status is always 200 — success/error must be inferred from the body.
 *
 * Until Sol provides the EPICK_API_KEY we run in SANDBOX_MODE and the
 * serverless endpoints under api/epick-*.js fall back to a local price table
 * and mock tracking codes.
 */

const EPICK_CONFIG = {
  // ----- ENDPOINT (Wanderlust Codes proxy) -----
  BASE_URL: process.env.EPICK_BASE_URL || 'https://wanderlust.codes/epick/api.php',

  // ----- CREDENTIALS -----
  // api_key identifies us against the Wanderlust proxy. Provided by them.
  API_KEY: process.env.EPICK_API_KEY || '',

  // ----- SENDER (NYC Designs pickup point) -----
  // These fields map 1:1 to origen_datos in the get_etiquetas operation.
  SENDER: {
    name: process.env.EPICK_SENDER_NAME || 'NYC Designs',
    email: process.env.EPICK_SENDER_EMAIL || 'newyorkcitydesigns4@gmail.com',
    phone: process.env.EPICK_SENDER_PHONE || '5491123199122',
    street: process.env.EPICK_SENDER_STREET || 'Acassuso',
    number: process.env.EPICK_SENDER_NUMBER || '5268',
    city: process.env.EPICK_SENDER_CITY || 'CABA',
    province: process.env.EPICK_SENDER_PROVINCE || 'CABA', // or single-letter code 'C'
    postalCode: process.env.EPICK_SENDER_CP || process.env.EPICK_ORIGIN_ZIP || '',
    infoadicional: process.env.EPICK_SENDER_EXTRA || '',
    // url_key is where E-Pick will POST status updates for shipments we create.
    // Must point to our /api/epick-webhook endpoint on production.
    url_key: process.env.EPICK_WEBHOOK_URL || 'https://nycdesigns.com.ar/api/epick-webhook'
  },

  // ----- MODE -----
  // Sandbox stays ON unless explicitly disabled AND an API key is present.
  // This way previewing the live URL in Vercel with no key never hits a real
  // shipment.
  SANDBOX_MODE: !(process.env.EPICK_LIVE === '1' && (process.env.EPICK_API_KEY || '').length > 0),

  // ----- DEFAULT PACKAGE -----
  // Most NYC Designs orders are small: mug + sticker pack + bag.
  DEFAULT_PACKAGE: {
    sizeWidth: 20,
    sizeHeight: 15,
    sizeDepth: 10,
    weight: 0.5
  },

  // ----- FALLBACK PRICES (used by sandbox + when API is unavailable) -----
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
  DEFAULT_ESTIMATED_DAYS: { min: 3, max: 7 },

  // Network timeout to use when calling the Wanderlust proxy (the proxy itself
  // does not enforce a timeout against e-pick, so we cap on our side).
  TIMEOUT_MS: 30_000
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

/**
 * Province name → 1-letter code map (per Wanderlust Codes doc section 3).
 * The API accepts either, but normalizing keeps requests small.
 */
const PROVINCE_CODES = {
  'CABA': 'C',
  'CIUDAD AUTONOMA DE BUENOS AIRES': 'C',
  'BUENOS AIRES': 'B',
  'CATAMARCA': 'K',
  'CHACO': 'H',
  'CHUBUT': 'U',
  'CORDOBA': 'X',
  'CORRIENTES': 'W',
  'ENTRE RIOS': 'E',
  'FORMOSA': 'P',
  'JUJUY': 'Y',
  'LA PAMPA': 'L',
  'LA RIOJA': 'F',
  'MENDOZA': 'M',
  'MISIONES': 'N',
  'NEUQUEN': 'Q',
  'RIO NEGRO': 'R',
  'SALTA': 'A',
  'SAN JUAN': 'J',
  'SAN LUIS': 'D',
  'SANTA CRUZ': 'Z',
  'SANTA FE': 'S',
  'SANTIAGO DEL ESTERO': 'G',
  'TIERRA DEL FUEGO': 'V',
  'TUCUMAN': 'T'
};

function provinceCode(input) {
  if (!input) return '';
  const s = String(input).trim();
  if (s.length === 1) return s.toUpperCase();
  const k = s.toUpperCase().replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
  return PROVINCE_CODES[k] || s; // fall back to whatever was passed in
}

/**
 * Low-level call to the Wanderlust proxy. Builds the URLSearchParams body,
 * applies our timeout and normalizes the response into { ok, data, error }.
 *
 * Param shape: { [operation]: { field1: ..., field2: ... } }
 * Packages arrays are expanded into Packages[i][key]=value automatically.
 */
async function callEpickProxy(operation, params) {
  if (EPICK_CONFIG.SANDBOX_MODE) {
    return { ok: false, error: 'sandbox_mode', data: null };
  }

  const body = new URLSearchParams();
  for (const [field, value] of Object.entries(params || {})) {
    if (field === 'Packages' && Array.isArray(value)) {
      value.forEach((pkg, i) => {
        for (const [k, v] of Object.entries(pkg)) {
          body.append(`method[${operation}][Packages][${i}][${k}]`, String(v));
        }
      });
    } else {
      body.append(`method[${operation}][${field}]`, String(value));
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EPICK_CONFIG.TIMEOUT_MS);
  try {
    const resp = await fetch(EPICK_CONFIG.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: ctrl.signal
    });
    const text = await resp.text();

    // The proxy always returns 200. "Invalid Data." is plain text; everything
    // else should be JSON. An empty body means a required field was missing.
    if (!text) return { ok: false, error: 'empty_body', data: null };
    if (text.trim() === 'Invalid Data.') return { ok: false, error: 'invalid_data', data: null };

    let json;
    try { json = JSON.parse(text); }
    catch (_) { return { ok: false, error: 'invalid_json', data: text }; }

    if (json && typeof json === 'object' && json.error) {
      return { ok: false, error: json.error, data: json };
    }
    return { ok: true, error: null, data: json };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message, data: null };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  EPICK_CONFIG,
  priceForPostalCode,
  provinceCode,
  callEpickProxy
};
