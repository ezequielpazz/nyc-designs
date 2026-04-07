const crypto = require('crypto');
const mercadopago = require('mercadopago');

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new mercadopago.Payment(client);

// Firestore REST API helper
const FIREBASE_PROJECT = 'nyc-designs';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

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

  const firestoreDoc = {
    fields: {
      id: { stringValue: orderData.id },
      payment_id: { stringValue: String(orderData.payment_id) },
      status: { stringValue: orderData.status },
      total: { doubleValue: orderData.total },
      customer: { mapValue: { fields: {
        email: { stringValue: orderData.payer.email || '' },
        name: { stringValue: orderData.payer.name || '' }
      }}},
      items: { arrayValue: { values: orderData.items.map(item => ({
        mapValue: { fields: {
          title: { stringValue: item.title || '' },
          quantity: { integerValue: String(item.quantity || 1) },
          unit_price: { doubleValue: item.unit_price || 0 },
          product_id: { stringValue: item.id || '' }
        }}
      })) }},
      shipping_type: { stringValue: orderData.shipping_type || 'pending' },
      external_reference: { stringValue: orderData.external_reference || '' },
      created_at: { timestampValue: new Date().toISOString() }
    }
  };

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

// Validate MercadoPago webhook signature
function validateSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // Skip if not configured

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

  const dataId = req.query?.['data.id'] || req.body?.data?.id || '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  return hmac === v1;
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
        const orderData = {
          id: paymentData.external_reference || `order_${data.id}`,
          payment_id: data.id,
          status: 'approved',
          total: paymentData.transaction_amount,
          payer: {
            email: paymentData.payer?.email || '',
            name: `${paymentData.payer?.first_name || ''} ${paymentData.payer?.last_name || ''}`.trim()
          },
          items: (paymentData.additional_info?.items || []).map(item => ({
            title: item.title,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            product_id: item.id || ''
          })),
          shipping_type: 'pending',
          external_reference: paymentData.external_reference || ''
        };

        await saveOrderToFirestore(orderData);

        // Decrement stock for purchased items
        for (const item of orderData.items) {
          if (item.product_id) {
            await decrementStock(item.product_id, item.quantity);
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
