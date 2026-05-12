# Environment Variables — NYC Designs

Configure these in **Vercel → Project → Settings → Environment Variables**.
Never commit real values to the repo.

## Production (required)

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `MP_ACCESS_TOKEN` | MercadoPago → Tu app → Credenciales de producción → Access Token | Backend signs preference + reads payment data |
| `MP_WEBHOOK_SECRET` | MercadoPago → Tu app → Webhooks → Firma secreta | **Required in prod**: `api/webhook.js` rejects unsigned calls |
| `FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app → apiKey | Used by serverless functions for the Firestore REST API |

## E-Pick integration (via Wanderlust Codes proxy)

The integration uses the proxy at `wanderlust.codes/epick/api.php`. Endpoints
ship in **sandbox mode** by default — they return mock tracking codes and use
the local price table so the store works before the credentials arrive.

```
EPICK_API_KEY=                 # provided by Wanderlust Codes (proxy api_key)
EPICK_LIVE=                    # set to "1" to switch out of sandbox mode
EPICK_BASE_URL=                # optional, defaults to https://wanderlust.codes/epick/api.php

# Sender (used as origen_datos in get_etiquetas)
EPICK_SENDER_NAME=             # defaults to "NYC Designs"
EPICK_SENDER_EMAIL=            # defaults to newyorkcitydesigns4@gmail.com
EPICK_SENDER_PHONE=            # defaults to 5491123199122
EPICK_SENDER_STREET=           # defaults to "Acassuso"
EPICK_SENDER_NUMBER=           # defaults to "5268"
EPICK_SENDER_CITY=             # defaults to "CABA"
EPICK_SENDER_PROVINCE=         # "CABA" or single-letter "C"
EPICK_SENDER_CP=               # Sol's pickup postal code (required for live)
EPICK_SENDER_EXTRA=            # piso / dpto, optional

# E-Pick → us webhook (url_key)
EPICK_WEBHOOK_URL=             # defaults to https://nycdesigns.com.ar/api/epick-webhook
EPICK_WEBHOOK_TOKEN=           # required in prod, shared with Wanderlust Codes
```

### Steps to go live

1. Ask Wanderlust Codes for: the production endpoint URL (if different from
   `wanderlust.codes/epick/api.php`), the `api_key`, and the auth mechanism
   they prefer (header/token/IP whitelist).
2. Set `EPICK_API_KEY` + `EPICK_SENDER_CP` + `EPICK_WEBHOOK_TOKEN` in Vercel
   with **Production** scope.
3. Set `EPICK_LIVE=1` so `config/shipping.js` flips `SANDBOX_MODE` off.
4. Hand them the webhook URL (`https://nycdesigns.com.ar/api/epick-webhook`)
   together with the shared `EPICK_WEBHOOK_TOKEN` value so E-Pick can call us
   on status changes.
5. Redeploy. No code change needed — the storefront and admin already point at
   `/api/epick-*`.

### What each endpoint does

| Endpoint | Op proxy | Used by |
| --- | --- | --- |
| `POST /api/epick-cotizar` | `get_rates` | Storefront shipping calculator |
| `POST /api/epick-cobertura` | `get_direccion` | Pre-checkout coverage validation |
| `POST /api/epick-crear-envio` | `get_etiquetas` | Auto from MP webhook + manual button in admin |
| `POST /api/epick-tracking` | `get_status` | Admin "Ver seguimiento" |
| `POST /api/epick-webhook` | n/a | Receives push notifications from E-Pick |

## Rate limiting (Upstash, optional)

The serverless rate limiter falls back to in-memory if these are not set, but
that doesn't share state across Vercel function instances. Adding Upstash
makes the limit actually enforce across cold starts.

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Free tier: 10k commands/day. Steps:

1. Sign up at https://upstash.com with the project's Google account.
2. **Create database** → name "nyc-designs-rl", region `us-east-1` (closest to
   Vercel functions). Choose "Regional" + "TLS enabled".
3. After creation, scroll to **REST API** → copy `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
4. Add both to Vercel → Settings → Environment Variables (Production scope).
5. Redeploy.

No code change needed — `api/_lib/rateLimit.js` auto-detects them.

## Email notifications (Resend)

When a payment is approved the webhook sends a "new order" email to Sol. The
notification uses [Resend](https://resend.com) — free tier: 100 emails/day.

```
RESEND_API_KEY=        # required, from resend.com → API Keys
ORDER_NOTIFY_TO=       # default: newyorkcitydesigns4@gmail.com
ORDER_NOTIFY_FROM=     # default: NYC Designs <onboarding@resend.dev>
```

Steps:

1. Sign up at https://resend.com with the same Gmail Sol uses.
2. Create an API key (scope: Sending access).
3. Add `RESEND_API_KEY` to Vercel.
4. While the domain is not verified, leave `ORDER_NOTIFY_FROM` unset (defaults
   to `onboarding@resend.dev` which works for any account).
5. When ready for branded sender (e.g. `pedidos@nycdesigns.com.ar`), follow
   Resend's domain verification (it adds 3 DNS records). Then set
   `ORDER_NOTIFY_FROM=NYC Designs <pedidos@nycdesigns.com.ar>`.

Notes:
- The email is fire-and-forget. If Resend rejects, the webhook still saves
  the order and creates the E-Pick shipment — only the email is missed.
- Set `ORDER_NOTIFY_TO` to a comma-separated list if you ever need to copy
  more people.

## Shipment status polling (cron job)

The endpoint `/api/cron/refresh-shipments` checks E-Pick for status changes on
every active shipment and emails the customer when something changes
("Tu pedido está en camino", "Tu pedido fue entregado", etc).

```
CRON_SECRET=          # required, long random string (generate with openssl rand -hex 32)
```

The endpoint accepts auth two ways so you can use both Vercel cron and an
external pinger like cron-job.org:

- Header: `Authorization: Bearer <CRON_SECRET>` (Vercel cron sends this)
- Query:  `?token=<CRON_SECRET>` (easier from cron-job.org / GitHub Actions)

### Vercel cron schedule

Configured in `vercel.json` (1x per day at 13:00 UTC — Hobby plan limit).

```json
"crons": [
  { "path": "/api/cron/refresh-shipments", "schedule": "0 13 * * *" }
]
```

### Faster updates with an external pinger (optional)

If once a day is too slow, use a free external cron service to ping the
endpoint hourly:

1. https://cron-job.org → Sign up
2. Create job → URL:
   `https://nycdesigns.com.ar/api/cron/refresh-shipments?token=<CRON_SECRET>`
3. Schedule: every hour
4. Save

Both crons can run together — the endpoint is idempotent (won't email twice
for the same status).

## Local development

For `vercel dev`, create `.env.local` (gitignored) with the same keys you'd
set in Vercel. Without `EPICK_LIVE=1` the integration stays in sandbox.

## Security notes

- Never paste tokens in pull requests, issues, or chat. If one leaks, rotate
  it immediately in the provider's panel.
- `MP_WEBHOOK_SECRET` is mandatory in production. The webhook rejects every
  request if it's missing.
- `EPICK_WEBHOOK_TOKEN` is mandatory in production. `api/epick-webhook.js`
  returns 401 if it's missing or mismatched.
- Firestore writes still require the rules defined in `firestore.rules` —
  make sure they are **published** in Firebase Console.
- `get_etiquetas` is **not idempotent** on the proxy side. `api/webhook.js`
  deduplicates by MercadoPago payment_id before calling it.
