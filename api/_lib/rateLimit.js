/**
 * Distributed rate limiter for Vercel serverless functions.
 *
 * Picks the strongest backend available at runtime:
 *
 *   1) **Upstash Redis** (env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *      Real cross-instance counter using INCR + EXPIRE. Free tier handles
 *      10k commands/day which is plenty for a small store.
 *
 *   2) **In-memory fallback** — same Map-per-instance approach we had before.
 *      Hot containers share the counter; cold starts reset it. Best-effort.
 *
 * Both modes return `{ ok: boolean, remaining: number, resetAt: ms }`.
 */

const memBuckets = new Map();

function memLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = memBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  memBuckets.set(key, entry);
  if (memBuckets.size > 1000) {
    for (const [k, v] of memBuckets) if (now > v.resetAt) memBuckets.delete(k);
  }
  return {
    ok: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt
  };
}

async function upstashLimit(key, max, windowSec) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // Use a pipelined INCR + EXPIRE so the TTL is set once when the key is born.
  // Upstash REST: POST /pipeline with an array of command arrays.
  try {
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
        ['TTL', key]
      ])
    });
    if (!resp.ok) return null;
    const out = await resp.json();
    const count = Number(out?.[0]?.result ?? 0);
    const ttl = Number(out?.[2]?.result ?? windowSec);
    return {
      ok: count <= max,
      remaining: Math.max(0, max - count),
      resetAt: Date.now() + Math.max(0, ttl) * 1000
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.bucket - logical name, e.g. "create-preference"
 * @param {string} opts.key    - identity, e.g. ip or hash
 * @param {number} opts.max    - allowed hits per window
 * @param {number} opts.windowMs - window length in ms
 */
async function rateLimit({ bucket, key, max, windowMs }) {
  const fullKey = `rl:${bucket}:${key}`;
  // Try Upstash first; fall back to memory if it isn't configured / errors out
  const upstash = await upstashLimit(fullKey, max, Math.ceil(windowMs / 1000));
  if (upstash) return upstash;
  return memLimit(fullKey, max, windowMs);
}

/**
 * Extract the best-available client identifier from a Vercel request.
 * x-forwarded-for can be spoofed but Vercel rewrites it at the edge so the
 * leftmost entry is the real client IP.
 */
function clientKey(req) {
  const xff = (req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}

module.exports = { rateLimit, clientKey };
