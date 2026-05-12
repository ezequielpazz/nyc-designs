# Environment Variables — NYC Designs

Configure these in **Vercel → Project → Settings → Environment Variables**.
Never commit real values to the repo.

## Production (required)

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `MP_ACCESS_TOKEN` | MercadoPago → Tu app → Credenciales de producción → Access Token | Backend signs preference + reads payment data |
| `MP_WEBHOOK_SECRET` | MercadoPago → Tu app → Webhooks → Firma secreta | **Required in prod**: `api/webhook.js` rejects unsigned calls |
| `FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app → apiKey | Used by serverless functions for the Firestore REST API |

## E-Pick integration (pending credentials from Sol)

```
EPICK_API_KEY=
EPICK_API_SECRET=
EPICK_BASE_URL=        # optional, defaults to https://api.e-pick.com.ar
EPICK_SANDBOX_URL=     # optional
EPICK_SENDER_ADDRESS=  # defaults to "Acassuso 5268"
EPICK_SENDER_CP=       # Sol's pickup postal code
EPICK_LIVE=            # set to "1" to flip out of sandbox mode
```

### When Sol provides the credentials

1. Add `EPICK_API_KEY` and `EPICK_API_SECRET` (Production scope) in Vercel.
2. Add `EPICK_SENDER_CP` with the real pickup postal code.
3. Set `EPICK_LIVE=1` so `config/shipping.js` toggles `SANDBOX_MODE` off.
4. Uncomment the `fetch()` blocks inside:
   - `api/epick-cotizar.js`
   - `api/epick-crear-envio.js`
   - `api/epick-tracking.js`
   - `api/webhook.js` (inside `createEpickShipment`)
5. Redeploy.

The storefront and the admin already point at `/api/epick-*` — no UI changes
needed.

## Local development

For `vercel dev`, create `.env.local` (gitignored) with the same keys you'd set
in Vercel. Without `EPICK_LIVE=1` the integration stays in sandbox.

## Security notes

- Never paste tokens in pull requests, issues, or chat. If one leaks, rotate it
  immediately in the provider's panel (MP → Generar nuevamente).
- `MP_WEBHOOK_SECRET` is mandatory in production. The webhook rejects every
  request if it's missing.
- Firestore writes still require the Firestore rules defined in
  `firestore.rules` — make sure they are **published** in Firebase Console.
