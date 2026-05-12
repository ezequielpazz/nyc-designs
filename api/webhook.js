const crypto = require('crypto');
const mercadopago = require('mercadopago');
const { EPICK_CONFIG } = require('../config/shipping');

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new mercadopago.Payment(client);

// Firestore REST API helper
const FIREBASE_PROJECT = 'nyc-designs';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

/**
 * E-Pick shipment creation (placeholder).
 *
 * While EPICK_CONFIG.SANDBOX_MODE is true we generate a deterministic mock
 * tracking code so the admin UI / customer can already see "envío creado"
 * end-to-end. When Sol provides credentials, set EPICK_LIVE=1 + EPICK_API_KEY
 * in Vercel and uncomment the fetch() block below.
 */
async function createEpickShipment(order) {
  // TODO: Uncomment when E-Pick credentials are ready
  /*
  if (!EPICK_CONFIG.SANDBOX_MODE) {
    const resp = await fetch(`${EPICK_CONFIG.BASE_URL}/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EPICK_CONFIG.API_SECRET}`
      },
      body: JSON.stringify({
        apiKey: EPICK_CONFIG.API_KEY,
        external_reference: order.id,
        sender: EPICK_CONFIG.SENDER,
        recipient: {
          name: order.payer?.name || '',
          address: order.address?.street || '',
          city: order.address?.city || '',
          postal_code: order.postal_code || '',
          phone: order.payer?.phone || ''
        },
        package: { weight_kg: 0.5, length: 20, width: 15, height: 5 }
      })
    });
    if (!resp.ok) throw new Error(`E-Pick create shipment failed: ${resp.status}`);
    const data = await resp.json();
    return { tracking_code: data.tracking_code, label_url: data.label_url };
  }
  */

  // Sandbox: stable mock per order
  const h = crypto.createHash('sha1').update(String(order.id || Date.now())).digest('hex');
  return {
    tracking_code: `EP-MOCK-${h.substring(0, 10).toUpperCase()}`,
    label_url: null,
    sandbox: true
  };
}

async function updateOrderTracking(docName, trackingCode, labelUrl) {
  if (!FIREBASE_API_KEY || !docName) return;
  const fields = ['tracking_code', 'tracking_updated_at'];
  if (labelUrl) fields.push('label_url');
  const mask = fields.map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `https://firestore.googleapis.com/v1/${docName}?${mask}&key=${FIREBASE_API_KEY}`;

  const body = {
    fields: {
      tracking_code: { stringValue: String(trackingCode) },
      tracking_updated_at: { timestampValue: new Date().toISOString() }
    }
  };
  if (labelUrl) body.fields.label_url = { stringValue: String(labelUrl) };

  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function decrementStock(productId, quantity) {
  if (!FIREBASE_API_KEY) return;
  const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/productos/${productId}?key=${FIREBASE_API_KEY}`;

  try {
    const getResp = await fetch(docUrl);
    if (!getResp.ok) return;
    const doc = await getResp.json();
    const currentStock = doc.fields?.stock;

    // Skip if stock is 'ilimitado' or not a number
    if (!currentStock || currentStock.stringValue === 'ilimitado') return;

    const stockVal = parseInt(currentStock.integerValue || currentStock.stringValue, 10);
    if (isNaN(stockVal)) return;

    const newStock = Math.max(0, stockVal - quantity);
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/productos/${productId}?updateMask.fieldPaths=stock&key=${FIREBASE_API_KEY}`;

    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { stock: { integerValue: String(newStock) } } })
    });
  } catch (err) {
    console.error(`Stock decrement failed for ${productId}:`, err.message);
  }
}

async function saveOrderToFirestore(orderData) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/pedidos?key=${FIREBASE_API_KEY}`;

  const nowIso = new Date().toISOString();

  const customerFields = {
    email: { stringValue: orderData.payer.email || '' },
    name: { stringValue: orderData.payer.name || '' }
  };
  if (orderData.payer.phone) customerFields.phone = { stringValue: String(orderData.payer.phone) };

  const fields = {
    id: { stringValue: orderData.id },
    payment_id: { stringValue: String(orderData.payment_id) },
    status: { stringValue: orderData.status },
    total: { doubleValue: orderData.total },
    customer: { mapValue: { fields: customerFields }},
    items: { arrayValue: { values: orderData.items.map(item => ({
      mapValue: { fields: {
        title: { stringValue: item.title || '' },
        quantity: { integerValue: String(item.quantity || 1) },
        unit_price: { doubleValue: item.unit_price || 0 },
        product_id: { stringValue: item.product_id || '' }
      }}
    })) }},
    shipping_type: { stringValue: orderData.shipping_type || 'pickup' },
    shipping_label: { stringValue: orderData.shipping_label || '' },
    external_reference: { stringValue: orderData.external_reference || '' },
    created_at: { timestampValue: nowIso },
    createdAt: { timestampValue: nowIso }
  };

  if (orderData.postal_code) {
    fields.postal_code = { stringValue: String(orderData.postal_code) };
  }

  if (orderData.address) {
    fields.shipping_address = { mapValue: { fields: {
      street: { stringValue: orderData.address.street || '' },
      city: { stringValue: orderData.address.city || '' },
      province: { stringValue: orderData.address.province || '' }
    }}};
  }

  const firestoreDoc = { fields };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(firestoreDoc)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore write failed: ${error}`);
  }

  return await response.json();
}

// Validate MercadoPago webhook signature.
// In production the secret MUST be configured — otherwise every webhook is
// rejected so nobody can forge approved orders and drain stock.
function validateSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
      return false;
    }
    return true; // allow only in dev/preview without secret
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];
  if (!xSignature || !xRequestId) return false;

  const parts = {};
  xSignature.split(',').forEach(part => {
    const [key, value] = part.trim().split('=');
    parts[key] = value;
  });

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  // Replay protection: reject if timestamp older than 5 minutes
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const skewMs = Math.abs(Date.now() - tsNum);
  if (skewMs > 5 * 60 * 1000) return false;

  const dataId = req.query?.['data.id'] || req.body?.data?.id || '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Constant-time comparison to avoid timing attacks
  const a = Buffer.from(hmac, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'Webhook endpoint ready' });
  }

  // Reject oversized payloads
  const bodyStr = JSON.stringify(req.body || {});
  if (bodyStr.length > 50_000) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  try {
    // Validate signature
    if (!validateSignature(req)) {
      console.error('Webhook: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, data } = req.body;

    // Only process payment notifications
    if (type === 'payment' && data?.id) {
      const paymentData = await payment.get({ id: data.id });

      if (paymentData.status === 'approved') {
        // external_reference is JSON-encoded from front: { timestamp, shipping_type, postal_code, address }
        let extra = {};
        try {
          if (paymentData.external_reference) {
            extra = JSON.parse(paymentData.external_reference);
          }
        } catch (_) {
          extra = {};
        }

        const shippingType = extra.shipping_type === 'delivery' ? 'delivery' : 'pickup';
        const shippingLabel = shippingType === 'delivery'
          ? 'Envío a domicilio (E-Pick)'
          : 'Retiro en Acassuso 5268, CABA';

        const orderData = {
          id: `order_${data.id}`,
          payment_id: data.id,
          status: 'approved',
          total: paymentData.transaction_amount,
          payer: {
            email: paymentData.payer?.email || '',
            name: `${paymentData.payer?.first_name || ''} ${paymentData.payer?.last_name || ''}`.trim(),
            phone: paymentData.payer?.phone?.number || ''
          },
          items: (paymentData.additional_info?.items || []).map(item => ({
            title: item.title,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            product_id: item.id || ''
          })),
          shipping_type: shippingType,
          shipping_label: shippingLabel,
          postal_code: extra.postal_code || '',
          address: extra.address || null,
          external_reference: paymentData.external_reference || ''
        };

        const saved = await saveOrderToFirestore(orderData);

        // Decrement stock for purchased items
        for (const item of orderData.items) {
          if (item.product_id) {
            await decrementStock(item.product_id, item.quantity);
          }
        }

        // Auto-create the E-Pick shipment for delivery orders so the admin
        // already sees a tracking code. In sandbox mode this is a mock; the
        // real API call lives inside createEpickShipment().
        if (shippingType === 'delivery') {
          try {
            const ship = await createEpickShipment(orderData);
            if (ship?.tracking_code && saved?.name) {
              await updateOrderTracking(saved.name, ship.tracking_code, ship.label_url);
            }
          } catch (shipErr) {
            console.error('E-Pick shipment skipped:', shipErr.message);
          }
        }
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    // Always return 200 to MP so it doesn't retry endlessly
    return res.status(200).json({ received: true });
  }
};
