const crypto = require('crypto');
const mercadopago = require('mercadopago');
const { EPICK_CONFIG, provinceCode, callEpickProxy } = require('../config/shipping');
const { notifyOrderEmail, notifyCustomerEmail } = require('./_lib/notifyOrder');
const { getDb, admin } = require('./_lib/firestoreAdmin');

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new mercadopago.Payment(client);

// FIREBASE_PROJECT only used for the path prefix returned to callers that
// previously matched against the REST API document name. The Admin SDK ignores
// FIREBASE_API_KEY entirely — it authenticates with the service account.
const FIREBASE_PROJECT = 'nyc-designs';

/**
 * Idempotency guard: returns the existing tracking info if we already created
 * an E-Pick shipment for this MercadoPago payment_id.
 */
async function existingShipmentForPayment(paymentId) {
  if (!paymentId) return null;
  try {
    const snap = await getDb().collection('pedidos')
      .where('payment_id', '==', String(paymentId))
      .where('tracking_code', '>', '')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      tracking_code: data.tracking_code || '',
      label_url: data.label_url || null
    };
  } catch (err) {
    console.error('existingShipmentForPayment failed:', err.message);
    return null;
  }
}

/**
 * E-Pick shipment creation via Wanderlust Codes proxy (operation get_etiquetas).
 *
 * - In SANDBOX_MODE (no api_key) we return a deterministic mock tracking code
 *   so the rest of the pipeline keeps working end-to-end.
 * - In LIVE mode (EPICK_LIVE=1 + EPICK_API_KEY) we POST the form-encoded
 *   triple-nested JSON payload to the proxy and extract the order id / label.
 *
 * The endpoint is not idempotent on the proxy side — the caller must dedupe
 * by payment_id before invoking this (see existingShipmentForPayment).
 */
async function createEpickShipment(order) {
  // Sandbox: stable mock per order
  if (EPICK_CONFIG.SANDBOX_MODE) {
    const h = crypto.createHash('sha1').update(String(order.id || Date.now())).digest('hex');
    return {
      tracking_code: `EP-MOCK-${h.substring(0, 10).toUpperCase()}`,
      label_url: null,
      sandbox: true
    };
  }

  // Live path — triple-nested JSON, see api/epick-crear-envio.js for the shape
  const origen_datos = {
    ...EPICK_CONFIG.SENDER,
    province: provinceCode(EPICK_CONFIG.SENDER.province)
  };

  // Use the packages array the front-end already built (one per cart item
  // with real product dimensions). Falls back to a single default package
  // when the customer pre-dates this feature.
  const packagesForEpick = Array.isArray(order.packages) && order.packages.length
    ? order.packages
    : [EPICK_CONFIG.DEFAULT_PACKAGE];

  const destino_datos = [{
    name: order.payer?.name || '',
    dni: order.payer?.dni || '',
    email: order.payer?.email || '',
    phone: order.payer?.phone || '',
    street: order.address?.street || '',
    number: order.address?.number || '0',
    city: order.address?.city || '',
    province: provinceCode(order.address?.province || ''),
    postalCode: order.postal_code || '',
    adicional: order.address?.extra || order.address?.adicional || '',
    observaciones: order.address?.notes || order.address?.observaciones || '',
    valortotal: Number(order.total || 0),
    packages: JSON.stringify(packagesForEpick)
  }];

  const chosen_shipping = order.chosen_shipping || { external_reference: String(order.id) };

  const result = await callEpickProxy('get_etiquetas', {
    origen_datos: JSON.stringify(origen_datos),
    destino_datos: JSON.stringify(destino_datos),
    chosen_shipping: JSON.stringify(chosen_shipping)
  });

  if (!result.ok) {
    throw new Error(`E-Pick get_etiquetas failed: ${result.error}`);
  }

  // Extract id from the proxy's `results` field. The doc says it's the raw
  // e-pick payload so we look for the common keys.
  const raw = result.data?.results || result.data;
  const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch (_) { return null; } })() : raw;
  const trackingCode = parsed?.id || parsed?.order_id || parsed?.orderId || parsed?.tracking_code || null;
  const labelUrl = parsed?.label_url || parsed?.labelUrl || parsed?.label || parsed?.pdf || null;

  if (!trackingCode) {
    throw new Error('E-Pick response missing order id');
  }

  return {
    tracking_code: String(trackingCode),
    label_url: labelUrl ? String(labelUrl) : null,
    sandbox: false
  };
}

async function updateOrderTracking(docName, trackingCode, labelUrl) {
  if (!docName) return;
  // docName is the absolute Firestore path returned by saveOrderToFirestore.
  // The Admin SDK uses doc(string) with a relative path; strip the project prefix.
  const relativePath = docName.replace(/^projects\/[^/]+\/databases\/\(default\)\/documents\//, '');
  try {
    const update = {
      tracking_code: String(trackingCode),
      tracking_updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    if (labelUrl) update.label_url = String(labelUrl);
    await getDb().doc(relativePath).update(update);
  } catch (err) {
    console.error('updateOrderTracking failed:', err.message);
  }
}

/**
 * Read a product's delivery metadata from Firestore so the webhook can decide
 * whether to ship it physically or just email a download link.
 */
async function getProductMeta(productId) {
  if (!productId) return { kind: 'fisico', downloadUrl: '' };
  try {
    const snap = await getDb().collection('productos').doc(productId).get();
    if (!snap.exists) return { kind: 'fisico', downloadUrl: '' };
    const data = snap.data();
    const tipo = data.tipo === 'virtual' ? 'virtual' : 'fisico';
    return { kind: tipo, downloadUrl: data.archivoUrl || '' };
  } catch (err) {
    console.error(`getProductMeta(${productId}) failed:`, err.message);
    return { kind: 'fisico', downloadUrl: '' };
  }
}

async function decrementStock(productId, quantity) {
  if (!productId) return;
  try {
    const ref = getDb().collection('productos').doc(productId);
    await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() || {};
      const stock = data.stock;
      if (!stock || stock === 'ilimitado') return;
      const stockVal = parseInt(stock, 10);
      if (Number.isNaN(stockVal)) return;
      const newStock = Math.max(0, stockVal - quantity);
      tx.update(ref, { stock: newStock });
    });
  } catch (err) {
    console.error(`decrementStock(${productId}) failed:`, err.message);
  }
}

async function saveOrderToFirestore(orderData) {
  const now = new Date();
  const customer = {
    email: orderData.payer?.email || '',
    name: orderData.payer?.name || ''
  };
  if (orderData.payer?.phone) customer.phone = String(orderData.payer.phone);
  if (orderData.payer?.dni)   customer.dni = String(orderData.payer.dni);

  const doc = {
    id: orderData.id,
    payment_id: String(orderData.payment_id),
    status: orderData.status,
    total: Number(orderData.total) || 0,
    customer,
    items: (orderData.items || []).map(item => ({
      title: item.title || '',
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      product_id: item.product_id || '',
      kind: item.kind || 'fisico',
      download_url: item.download_url || ''
    })),
    shipping_type: orderData.shipping_type || 'pickup',
    shipping_label: orderData.shipping_label || '',
    external_reference: orderData.external_reference || '',
    created_at: now,
    createdAt: now
  };

  if (orderData.postal_code) doc.postal_code = String(orderData.postal_code);

  if (orderData.address) {
    doc.shipping_address = {
      street:   orderData.address.street   || '',
      number:   String(orderData.address.number || ''),
      extra:    orderData.address.extra    || '',
      city:     orderData.address.city     || '',
      province: orderData.address.province || '',
      notes:    orderData.address.notes    || ''
    };
  }

  const ref = await getDb().collection('pedidos').add(doc);
  // Return the legacy REST `name` shape so existing callers
  // (updateOrderTracking) keep working unchanged.
  return { name: `projects/${FIREBASE_PROJECT}/databases/(default)/documents/${ref.path}` };
}

/**
 * Idempotency: has this payment already produced an order?
 * Used by both the webhook (MP retries deliveries) and the daily
 * reconciliation cron (so it never double-processes).
 */
async function orderExistsForPayment(paymentId) {
  if (!paymentId) return false;
  try {
    const snap = await getDb().collection('pedidos')
      .where('payment_id', '==', String(paymentId))
      .limit(1)
      .get();
    return !snap.empty;
  } catch (err) {
    console.error('orderExistsForPayment failed:', err.message);
    return false; // prefer a rare duplicate over silently dropping a sale
  }
}

/**
 * Full post-payment pipeline for an APPROVED MercadoPago payment:
 * enrich items → save order → decrement stock → E-Pick shipment → emails.
 *
 * Shared by the webhook handler and /api/cron/reconcile-payments so a sale
 * can never be lost: if the webhook missed it, the cron recovers it with
 * exactly the same logic.
 *
 * Returns { skipped } when an order already exists for this payment.
 */
async function processApprovedPayment(paymentData) {
  const paymentId = paymentData.id;

  if (await orderExistsForPayment(paymentId)) {
    return { skipped: true, reason: 'order_exists', payment_id: paymentId };
  }

  // Checkout data (cliente, dirección, paquetes) viaja en `metadata`.
  // Fallback a external_reference para los pagos viejos, cuando el front
  // todavía embebía el JSON ahí (antes del fix del límite de 256 chars).
  let extra = {};
  if (paymentData.metadata && typeof paymentData.metadata === 'object'
      && Object.keys(paymentData.metadata).length > 0) {
    extra = paymentData.metadata;
  } else if (paymentData.external_reference) {
    try { extra = JSON.parse(paymentData.external_reference); } catch (_) { extra = {}; }
  }

  // Enrich each item with its delivery kind (virtual/fisico) + download URL
  // by reading Firestore. If the cart is 100% virtual we mark the order
  // as 'digital' and skip E-Pick entirely.
  const rawItems = paymentData.additional_info?.items || [];
  const enrichedItems = await Promise.all(rawItems.map(async (item) => {
    const meta = await getProductMeta(item.id || '');
    return {
      title: item.title,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      product_id: item.id || '',
      kind: meta.kind,
      download_url: meta.downloadUrl
    };
  }));

  const allVirtual = enrichedItems.length > 0
    && enrichedItems.every(i => i.kind === 'virtual');

  let shippingType = extra.shipping_type === 'delivery' ? 'delivery' : 'pickup';
  let shippingLabel;
  if (allVirtual) {
    shippingType = 'digital';
    shippingLabel = 'Producto digital — entrega por link / WhatsApp';
  } else {
    shippingLabel = shippingType === 'delivery'
      ? 'Envío a domicilio (E-Pick)'
      : 'Retiro en Acassuso 5268, CABA';
  }

  // Prefer the data the customer typed in the checkout form (carried in
  // extra.customer) over what MercadoPago auto-fills, because MP may
  // strip names / sanitize phones.
  const frontCustomer = extra.customer || {};

  const orderData = {
    id: `order_${paymentId}`,
    payment_id: paymentId,
    status: 'approved',
    total: paymentData.transaction_amount,
    payer: {
      email: frontCustomer.email || paymentData.payer?.email || '',
      name: frontCustomer.name
        || `${paymentData.payer?.first_name || ''} ${paymentData.payer?.last_name || ''}`.trim(),
      phone: frontCustomer.phone || paymentData.payer?.phone?.number || '',
      dni: frontCustomer.dni || paymentData.payer?.identification?.number || ''
    },
    items: enrichedItems,
    shipping_type: shippingType,
    shipping_label: shippingLabel,
    postal_code: extra.postal_code || '',
    address: extra.address || null,
    packages: Array.isArray(extra.packages) ? extra.packages : null,
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
  // already sees a tracking code. Idempotent: if a previous webhook
  // delivery already created the shipment for this payment_id we just
  // reuse the existing tracking code. Skip entirely for digital orders.
  let trackingCode = null;
  if (shippingType === 'delivery' && !allVirtual) {
    try {
      const existing = await existingShipmentForPayment(orderData.payment_id);
      const ship = existing && existing.tracking_code
        ? existing
        : await createEpickShipment(orderData);
      if (ship?.tracking_code && saved?.name) {
        await updateOrderTracking(saved.name, ship.tracking_code, ship.label_url);
        trackingCode = ship.tracking_code;
      }
    } catch (shipErr) {
      console.error('E-Pick shipment skipped:', shipErr.message);
    }
  }

  // Fire-and-forget emails:
  //   - Sol (shop owner) gets the operational summary
  //   - Customer gets a friendly confirmation + tracking link
  // Both share the same Resend key (env: RESEND_API_KEY). Failures are
  // logged but never block the caller.
  const orderForEmail = { ...orderData, tracking_code: trackingCode };
  try {
    await notifyOrderEmail(orderForEmail);
  } catch (mailErr) {
    console.error('shop notification email failed:', mailErr.message);
  }
  try {
    await notifyCustomerEmail(orderForEmail);
  } catch (mailErr) {
    console.error('customer confirmation email failed:', mailErr.message);
  }

  return { skipped: false, order_id: orderData.id, payment_id: paymentId, tracking_code: trackingCode };
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
        await processApprovedPayment(paymentData);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    // Always return 200 to MP so it doesn't retry endlessly
    return res.status(200).json({ received: true });
  }
};

// Shared with /api/cron/reconcile-payments (daily safety net against lost sales).
module.exports.processApprovedPayment = processApprovedPayment;
module.exports.orderExistsForPayment = orderExistsForPayment;
