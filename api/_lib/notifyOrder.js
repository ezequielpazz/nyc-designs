/**
 * Send the "new order" email notification to Sol.
 *
 * Uses Resend (https://resend.com) — pick it because it has a free tier of
 * 100 emails/day, a simple HTTP API and no SMTP / app-password dance.
 *
 * Required env vars:
 *   RESEND_API_KEY   — from resend.com → API Keys → Create
 *   ORDER_NOTIFY_TO  — default 'newyorkcitydesigns4@gmail.com'
 *   ORDER_NOTIFY_FROM — default 'NYC Designs <pedidos@nycdesigns.com.ar>'
 *                       (the from domain must be verified in Resend, otherwise
 *                        Resend rejects with 422. While not verified, use the
 *                        provided onboarding@resend.dev sender.)
 *
 * Fire-and-forget: errors are logged but never thrown, so a failing email
 * never breaks the webhook -> Firestore flow.
 */

const NOTIFY_TO_DEFAULT = 'newyorkcitydesigns4@gmail.com';
const NOTIFY_FROM_DEFAULT = 'NYC Designs <onboarding@resend.dev>';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtAr(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-AR');
}

function buildHtml(order) {
  const customer = order.payer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.address || {};
  const shippingLabel = order.shipping_label
    || (order.shipping_type === 'delivery' ? 'Envío a domicilio (E-Pick)' : 'Retiro en Acassuso 5268, CABA');

  const itemsRows = items.map(i => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.title || 'Producto')}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;">${i.quantity || 1}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">$${fmtAr(i.unit_price)}</td>
    </tr>`).join('');

  const fullStreet = [addr.street, addr.number].filter(Boolean).join(' ');
  const addrBlock = order.shipping_type === 'delivery'
    ? `<p style="margin:6px 0;"><strong>Dirección:</strong> ${escapeHtml(fullStreet)}${addr.extra ? ` (${escapeHtml(addr.extra)})` : ''}, ${escapeHtml(addr.city || '')}, ${escapeHtml(addr.province || '')}${order.postal_code ? ` — CP ${escapeHtml(order.postal_code)}` : ''}</p>
       ${addr.notes ? `<p style="margin:6px 0;color:#666;"><em>📝 ${escapeHtml(addr.notes)}</em></p>` : ''}`
    : '';

  return `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#2B2B2B;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#B8777F;margin:0 0 8px;">¡Nuevo pedido!</h2>
  <p style="margin:0 0 16px;color:#666;">Pedido <strong>${escapeHtml(order.id || '')}</strong> · ${new Date().toLocaleString('es-AR')}</p>

  <div style="background:#FAF7F5;padding:16px;border-radius:8px;margin-bottom:16px;">
    <h3 style="margin:0 0 8px;font-size:16px;">Cliente</h3>
    <p style="margin:4px 0;"><strong>${escapeHtml(customer.name || 'Sin nombre')}</strong></p>
    ${customer.dni ? `<p style="margin:4px 0;">DNI: ${escapeHtml(customer.dni)}</p>` : ''}
    <p style="margin:4px 0;">${escapeHtml(customer.email || '')}</p>
    ${customer.phone ? `<p style="margin:4px 0;">Tel: <a href="https://wa.me/${String(customer.phone).replace(/\D/g,'')}">${escapeHtml(customer.phone)}</a></p>` : ''}
  </div>

  <h3 style="margin:0 0 8px;font-size:16px;">Productos</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:#F6D6D8;">
        <th style="padding:8px 12px;text-align:left;font-size:13px;">Producto</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Cantidad</th>
        <th style="padding:8px 12px;text-align:right;font-size:13px;">Precio unitario</th>
      </tr>
    </thead>
    <tbody>${itemsRows || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;">Sin detalle de items</td></tr>`}</tbody>
  </table>

  <p style="margin:8px 0;font-size:18px;"><strong>Total: $${fmtAr(order.total)}</strong></p>

  <div style="background:#FAF7F5;padding:16px;border-radius:8px;margin-top:16px;">
    <h3 style="margin:0 0 8px;font-size:16px;">Entrega</h3>
    <p style="margin:6px 0;"><strong>Modalidad:</strong> ${escapeHtml(shippingLabel)}</p>
    ${addrBlock}
    ${order.tracking_code ? `<p style="margin:6px 0;"><strong>Seguimiento E-Pick:</strong> ${escapeHtml(order.tracking_code)}</p>` : ''}
  </div>

  <p style="margin-top:24px;font-size:12px;color:#999;">
    Mirá el pedido completo en
    <a href="https://nycdesigns.com.ar/admin/" style="color:#B8777F;">el panel admin</a>.
  </p>
</body></html>`;
}

function buildText(order) {
  const customer = order.payer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.address || {};
  const lines = [];
  lines.push(`Nuevo pedido ${order.id || ''}`);
  lines.push(`Fecha: ${new Date().toLocaleString('es-AR')}`);
  lines.push('');
  lines.push('CLIENTE');
  lines.push(`  ${customer.name || 'Sin nombre'}`);
  if (customer.dni) lines.push(`  DNI: ${customer.dni}`);
  if (customer.email) lines.push(`  ${customer.email}`);
  if (customer.phone) lines.push(`  Tel: ${customer.phone}`);
  lines.push('');
  lines.push('PRODUCTOS');
  items.forEach(i => lines.push(`  - ${i.title} x${i.quantity || 1} · $${fmtAr(i.unit_price)}`));
  lines.push('');
  lines.push(`TOTAL: $${fmtAr(order.total)}`);
  lines.push('');
  lines.push('ENTREGA');
  lines.push(`  ${order.shipping_label || order.shipping_type || ''}`);
  if (order.shipping_type === 'delivery') {
    const full = [addr.street, addr.number].filter(Boolean).join(' ');
    lines.push(`  ${full}${addr.extra ? ` (${addr.extra})` : ''}, ${addr.city || ''}, ${addr.province || ''}`);
    if (order.postal_code) lines.push(`  CP ${order.postal_code}`);
    if (addr.notes) lines.push(`  Ref: ${addr.notes}`);
  }
  if (order.tracking_code) lines.push(`  Seguimiento: ${order.tracking_code}`);
  return lines.join('\n');
}

async function sendResendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('Resend email skipped — RESEND_API_KEY not configured');
    return { sent: false, reason: 'no_api_key' };
  }
  const from = process.env.ORDER_NOTIFY_FROM || NOTIFY_FROM_DEFAULT;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, text })
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error('Resend email failed:', resp.status, body);
      return { sent: false, reason: `http_${resp.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('Resend email exception:', err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Email to the SHOP OWNER (Sol) — full operational summary.
 */
async function notifyOrderEmail(order) {
  const to = process.env.ORDER_NOTIFY_TO || NOTIFY_TO_DEFAULT;
  const subject = `Nuevo pedido en NYC Designs — $${fmtAr(order.total)}`;
  return sendResendEmail({
    to,
    subject,
    html: buildHtml(order),
    text: buildText(order)
  });
}

/**
 * Build a customer-facing confirmation email. Same data as the admin one but
 * written from the brand's voice (Sol's perspective) and without the "admin
 * panel" link.
 */
function buildCustomerHtml(order) {
  const customer = order.payer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.address || {};
  const isDigital = order.shipping_type === 'digital'
    || (items.length > 0 && items.every(i => i.kind === 'virtual'));
  const shippingLabel = order.shipping_label
    || (isDigital ? 'Producto digital'
        : order.shipping_type === 'delivery' ? 'Envío a domicilio (E-Pick)'
        : 'Retiro en Acassuso 5268, CABA');

  const itemsRows = items.map(i => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.title || 'Producto')}${i.kind === 'virtual' ? ' <em style="color:#B8777F;font-size:11px;">(digital)</em>' : ''}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;">${i.quantity || 1}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">$${fmtAr(i.unit_price)}</td>
    </tr>`).join('');

  // Build "Tu descarga" section if any virtual items exist with a download URL
  const virtualItems = items.filter(i => i.kind === 'virtual' && i.download_url);
  const digitalBlock = virtualItems.length > 0
    ? `<div style="background:#fff3f4;border:2px solid #B8777F;border-radius:12px;padding:20px;margin:16px 0;">
        <h3 style="margin:0 0 12px;color:#B8777F;font-size:18px;">🪄 Tu descarga</h3>
        ${virtualItems.map(i => `
          <p style="margin:8px 0;">
            <strong>${escapeHtml(i.title)}</strong><br>
            <a href="${escapeHtml(i.download_url)}" style="display:inline-block;background:#B8777F;color:white;text-decoration:none;padding:10px 20px;border-radius:999px;margin-top:6px;font-weight:600;">⬇ Descargar / Abrir</a>
          </p>`).join('')}
        <p style="margin:12px 0 0;font-size:13px;color:#666;">Si el link no abre, copiá y pegá la URL en tu navegador.</p>
      </div>`
    : '';

  // WhatsApp deep-link with prefilled message — works on any device
  const orderShort = (order.id || '').split('_').pop()?.substring(0, 10).toUpperCase();
  const waText = encodeURIComponent(`Hola! Acabo de comprar el pedido ${orderShort} y quería confirmar la recepción.${virtualItems.length ? ' (Producto digital)' : ''}`);
  const waBlock = `<p style="margin:16px 0;text-align:center;">
    <a href="https://wa.me/5491123199122?text=${waText}" style="display:inline-block;background:#25D366;color:white;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;">💬 Escribir por WhatsApp</a>
  </p>`;

  const fullStreet = [addr.street, addr.number].filter(Boolean).join(' ');
  let addrBlock;
  if (isDigital) {
    addrBlock = `<p style="margin:6px 0;">Producto digital — todo lo importante está arriba 👆 o consultanos por WhatsApp.</p>`;
  } else if (order.shipping_type === 'delivery') {
    addrBlock = `<p style="margin:6px 0;"><strong>Dirección de envío:</strong> ${escapeHtml(fullStreet)}${addr.extra ? ` (${escapeHtml(addr.extra)})` : ''}, ${escapeHtml(addr.city || '')}, ${escapeHtml(addr.province || '')}${order.postal_code ? ` — CP ${escapeHtml(order.postal_code)}` : ''}</p>`;
  } else {
    addrBlock = `<p style="margin:6px 0;">Coordinamos retiro por WhatsApp en Acassuso 5268, CABA.</p>`;
  }

  const trackingBlock = !isDigital && order.tracking_code
    ? `<p style="margin:6px 0;"><strong>Código de seguimiento:</strong> ${escapeHtml(order.tracking_code)}<br>
       <a href="https://www.e-pick.com.ar/tracking?code=${encodeURIComponent(order.tracking_code)}" style="color:#B8777F;">Ver estado del envío →</a></p>`
    : (!isDigital && order.shipping_type === 'delivery'
        ? `<p style="margin:6px 0;color:#666;">Te vamos a mandar el código de seguimiento por email cuando se despache.</p>`
        : '');

  return `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#2B2B2B;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#B8777F;margin:0 0 8px;">¡Gracias por tu compra, ${escapeHtml(customer.name?.split(' ')[0] || '')}!</h2>
  <p style="margin:0 0 16px;color:#666;">Confirmamos tu pedido <strong>${escapeHtml(order.id || '')}</strong>.</p>

  ${digitalBlock}

  <h3 style="margin:16px 0 8px;font-size:16px;">Tu pedido</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:#F6D6D8;">
        <th style="padding:8px 12px;text-align:left;font-size:13px;">Producto</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;">Cant.</th>
        <th style="padding:8px 12px;text-align:right;font-size:13px;">Precio</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <p style="margin:8px 0;font-size:18px;"><strong>Total: $${fmtAr(order.total)}</strong></p>

  <div style="background:#FAF7F5;padding:16px;border-radius:8px;margin-top:16px;">
    <h3 style="margin:0 0 8px;font-size:16px;">Entrega</h3>
    <p style="margin:6px 0;"><strong>Modalidad:</strong> ${escapeHtml(shippingLabel)}</p>
    ${addrBlock}
    ${trackingBlock}
    ${isDigital ? '' : '<p style="margin:6px 0;color:#666;font-size:13px;">Producción estimada según el producto.</p>'}
  </div>

  ${waBlock}

  <p style="margin-top:8px;font-size:13px;color:#666;text-align:center;">
    O respondé este mail si preferís.
  </p>
  <p style="margin-top:24px;font-size:11px;color:#999;">— NYC Designs · Acassuso 5268, CABA · <a href="https://nycdesigns.com.ar" style="color:#999;">nycdesigns.com.ar</a></p>
</body></html>`;
}

function buildCustomerText(order) {
  const customer = order.payer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.address || {};
  const lines = [];
  lines.push(`¡Gracias por tu compra${customer.name ? ', ' + customer.name.split(' ')[0] : ''}!`);
  lines.push(`Pedido: ${order.id || ''}`);
  lines.push('');
  items.forEach(i => lines.push(`  - ${i.title} x${i.quantity || 1} · $${fmtAr(i.unit_price)}`));
  lines.push('');
  lines.push(`TOTAL: $${fmtAr(order.total)}`);
  lines.push('');
  if (order.shipping_type === 'delivery') {
    const full = [addr.street, addr.number].filter(Boolean).join(' ');
    lines.push(`Envío a: ${full}${addr.extra ? ` (${addr.extra})` : ''}, ${addr.city || ''}, ${addr.province || ''}`);
    if (order.tracking_code) lines.push(`Seguimiento: ${order.tracking_code}`);
  } else {
    lines.push('Retiro en Acassuso 5268, CABA — coordinamos por WhatsApp.');
  }
  lines.push('');
  lines.push('WhatsApp: +54 9 11 2319-9122');
  lines.push('Web: https://nycdesigns.com.ar');
  return lines.join('\n');
}

/**
 * Email to the CUSTOMER who just paid. Fire-and-forget; if there's no
 * customer email or Resend is not configured the call is a no-op.
 */
async function notifyCustomerEmail(order) {
  const customerEmail = order?.payer?.email;
  if (!customerEmail) return { sent: false, reason: 'no_customer_email' };
  const subject = `Pedido confirmado en NYC Designs — ${order.id || ''}`;
  return sendResendEmail({
    to: customerEmail,
    subject,
    html: buildCustomerHtml(order),
    text: buildCustomerText(order)
  });
}

// ============================================================
// Shipment-status update email (used by the polling cron)
// ============================================================

/**
 * Friendly Spanish summary of an E-Pick / OCA raw status.
 * Returns { title, subject, body, emoji } so we can render different templates
 * per milestone. Returns null for statuses we don't want to notify about.
 */
function statusCopy(rawStatus, order) {
  const s = String(rawStatus || '').toLowerCase().trim();
  const orderShort = (order?.id || '').split('_').pop()?.substring(0, 8).toUpperCase();
  const customerFirst = (order?.payer?.name || '').split(' ')[0] || '';
  const trackUrl = order?.tracking_code
    ? `https://www.e-pick.com.ar/tracking?code=${encodeURIComponent(order.tracking_code)}`
    : null;

  if (['created', 'pending', 'pending_pickup', 'creado'].includes(s)) {
    return {
      emoji: '📦',
      subject: `Tu pedido #${orderShort} se está preparando`,
      title: 'Tu pedido se está preparando',
      body: 'Recibimos tu pedido y lo estamos preparando para el envío. Te avisamos cuando salga.'
    };
  }
  if (['picked_up', 'in_warehouse', 'retirado', 'recibido', 'en_deposito'].includes(s)) {
    return {
      emoji: '🚚',
      subject: `Tu pedido #${orderShort} ya está en camino`,
      title: '¡Tu pedido salió!',
      body: 'El paquete fue retirado por el courier y está en tránsito.'
    };
  }
  if (['in_transit', 'on_route', 'en_camino', 'en_transito', 'en_distribucion'].includes(s)) {
    return {
      emoji: '🛣️',
      subject: `Tu pedido #${orderShort} está en camino`,
      title: 'En camino a tu domicilio',
      body: 'Tu paquete está siendo distribuido. Llega en las próximas horas / días según tu zona.'
    };
  }
  if (['out_for_delivery', 'en_reparto', 'salio_a_reparto'].includes(s)) {
    return {
      emoji: '🛵',
      subject: `Tu pedido #${orderShort} sale a reparto hoy`,
      title: '¡Sale a reparto hoy!',
      body: 'El paquete está en el vehículo del repartidor. Asegurate de que haya alguien para recibirlo.'
    };
  }
  if (['delivered', 'entregado'].includes(s)) {
    return {
      emoji: '✅',
      subject: `Tu pedido #${orderShort} fue entregado`,
      title: '¡Tu pedido llegó!',
      body: 'El paquete fue entregado en tu domicilio. ¡Gracias por elegirnos! Si pudiste, contanos tu experiencia respondiendo este mail.'
    };
  }
  if (['returned', 'devuelto', 'rechazado', 'no_entregado'].includes(s)) {
    return {
      emoji: '↩️',
      subject: `Hubo un problema con tu pedido #${orderShort}`,
      title: 'El paquete volvió a nuestro depósito',
      body: 'No se pudo entregar el paquete. Escribinos por WhatsApp para coordinar una nueva entrega.'
    };
  }
  if (['cancelled', 'canceled', 'cancelado'].includes(s)) {
    return {
      emoji: '❌',
      subject: `Tu envío del pedido #${orderShort} fue cancelado`,
      title: 'Envío cancelado',
      body: 'El envío fue cancelado en el sistema del courier. Si esto es un error, escribinos por WhatsApp.'
    };
  }
  return null; // unknown / noisy state — don't email
}

function buildShipmentUpdateHtml(order, status) {
  const copy = statusCopy(status, order);
  if (!copy) return null;
  const trackUrl = order.tracking_code
    ? `https://www.e-pick.com.ar/tracking?code=${encodeURIComponent(order.tracking_code)}`
    : null;
  const customerFirst = (order.payer?.name || '').split(' ')[0] || '';
  return `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#2B2B2B;max-width:600px;margin:0 auto;padding:20px;">
  <div style="font-size:48px;line-height:1;margin-bottom:8px;">${copy.emoji}</div>
  <h2 style="color:#B8777F;margin:0 0 8px;">${escapeHtml(copy.title)}</h2>
  ${customerFirst ? `<p style="margin:0 0 8px;">Hola ${escapeHtml(customerFirst)},</p>` : ''}
  <p style="margin:0 0 16px;color:#444;line-height:1.5;">${escapeHtml(copy.body)}</p>

  <div style="background:#FAF7F5;padding:16px;border-radius:8px;margin:16px 0;">
    <p style="margin:4px 0;font-size:13px;color:#666;">Pedido</p>
    <p style="margin:4px 0;"><strong>${escapeHtml(order.id || '')}</strong></p>
    ${order.tracking_code ? `<p style="margin:12px 0 4px;font-size:13px;color:#666;">Código de seguimiento</p>
      <p style="margin:4px 0;font-family:monospace;font-size:14px;"><strong>${escapeHtml(order.tracking_code)}</strong></p>` : ''}
  </div>

  ${trackUrl ? `<p style="margin:24px 0;text-align:center;">
    <a href="${escapeHtml(trackUrl)}" style="background:#B8777F;color:white;text-decoration:none;padding:12px 24px;border-radius:999px;display:inline-block;font-weight:600;">Ver estado del envío</a>
  </p>` : ''}

  <p style="margin-top:24px;font-size:13px;color:#666;">
    ¿Necesitás ayuda? Escribinos por
    <a href="https://wa.me/5491123199122" style="color:#B8777F;">WhatsApp</a>.
  </p>
  <p style="margin-top:24px;font-size:11px;color:#999;">— NYC Designs · Acassuso 5268, CABA · <a href="https://nycdesigns.com.ar" style="color:#999;">nycdesigns.com.ar</a></p>
</body></html>`;
}

function buildShipmentUpdateText(order, status) {
  const copy = statusCopy(status, order);
  if (!copy) return null;
  const trackUrl = order.tracking_code
    ? `https://www.e-pick.com.ar/tracking?code=${encodeURIComponent(order.tracking_code)}`
    : null;
  const lines = [
    `${copy.emoji} ${copy.title}`,
    '',
    copy.body,
    '',
    `Pedido: ${order.id || ''}`,
    order.tracking_code ? `Tracking: ${order.tracking_code}` : null,
    trackUrl ? `Ver estado: ${trackUrl}` : null,
    '',
    'NYC Designs · https://nycdesigns.com.ar · WhatsApp +54 9 11 2319-9122'
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Notify the customer of a shipping-status change. Returns
 *   { sent: false, reason: 'no_copy' }  when the new status isn't worth notifying.
 * Skips silently when there's no customer email.
 */
async function notifyShipmentUpdateEmail(order) {
  const customerEmail = order?.payer?.email;
  if (!customerEmail) return { sent: false, reason: 'no_customer_email' };
  const status = order.shipping_status;
  const copy = statusCopy(status, order);
  if (!copy) return { sent: false, reason: 'no_copy' };
  return sendResendEmail({
    to: customerEmail,
    subject: copy.subject,
    html: buildShipmentUpdateHtml(order, status),
    text: buildShipmentUpdateText(order, status)
  });
}

module.exports = {
  notifyOrderEmail,
  notifyCustomerEmail,
  notifyShipmentUpdateEmail
};
