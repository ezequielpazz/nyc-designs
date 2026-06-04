/**
 * Firebase Admin SDK initialization.
 *
 * Until Sol loaded a service-account JSON the webhook was hitting Firestore
 * via the public REST API + the public web API key, which fails 403 against
 * the strict rules in firestore.rules (`allow write: if isAdmin()`). The
 * Admin SDK below uses a service account so server-side writes bypass the
 * rules safely — exactly what they were designed for.
 *
 * Service-account credentials are loaded once and reused across invocations
 * (Vercel reuses warm function instances).
 *
 * Required env var (Production scope):
 *   FIREBASE_SERVICE_ACCOUNT  — the full JSON of the service-account key,
 *                                pasted as-is. The first time it's loaded,
 *                                we parse it and feed it to `cert()`.
 */

const admin = require('firebase-admin');

let _app = null;
let _db = null;

function getApp() {
  if (_app) return _app;
  if (admin.apps.length > 0) {
    _app = admin.apps[0];
    return _app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not configured');
  }

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON: ' + err.message);
  }

  // Vercel sometimes escapes the \n inside private_key. Normalise.
  if (credentials.private_key && credentials.private_key.indexOf('\\n') !== -1) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  _app = admin.initializeApp({
    credential: admin.credential.cert(credentials),
    projectId: credentials.project_id
  });
  return _app;
}

function getDb() {
  if (_db) return _db;
  _db = getApp().firestore();
  return _db;
}

/**
 * Returns true when the Admin SDK is fully usable (env var present + valid).
 * Used by callers to gracefully fall back to the REST API path while we're
 * mid-migration.
 */
function isAdminReady() {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

module.exports = { getApp, getDb, isAdminReady, admin };
