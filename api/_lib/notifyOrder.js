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

// ---------- Comprobante (receipt) shared pieces ----------

const LOGO_URL = 'https://nycdesigns.com.ar/assets/img/logo.jpg';

// Email HTML rules used below (Gmail/Outlook safe):
//  - layout with <table> + width/cellpadding attributes, never flexbox
//  - modest paddings (16px) so nothing overflows a 320px phone
//  - the items grid is 2 columns only; qty and unit price ride inside the
//    product cell. Four columns was what made the receipt look "desfasada"
//    on mobile.

/** Branded header band: logo + store name + document label. */
function receiptHeader(label) {
  return `
  <tr><td align="center" bgcolor="#F6D6D8" style="padding:24px 16px 18px;">
    <img src="${LOGO_URL}" alt="NYC Designs" width="60" height="60" style="display:block;margin:0 auto 10px;border-radius:30px;border:3px solid #ffffff;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#2B2B2B;line-height:1.2;">New York City Designs</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;color:#B8777F;font-weight:bold;padding-top:5px;">${label}</div>
  </td></tr>`;
}

/** Meta strip: order number + date, two columns (safe on mobile). */
function receiptMeta(order) {
  const nro = String(order.payment_id || (order.id || '').split('_').pop() || '');
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const cell = 'font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;color:#8A6F6A;padding:0 0 3px;';
  const val = 'font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2B2B2B;font-weight:bold;';
  return `
  <tr><td style="padding:14px 16px;border-bottom:2px solid #F6D6D8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" width="55%" style="${cell}">PEDIDO</td>
        <td align="right" width="45%" style="${cell}">FECHA</td>
      </tr>
      <tr>
        <td align="left" style="${val}">#${escapeHtml(nro)}</td>
        <td align="right" style="${val}">${fecha} · ${hora}</td>
      </tr>
    </table>
  </td></tr>`;
}

/** Items list: 2 columns (producto+cantidad | importe) + total. */
function receiptItems(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map(i => {
    const qty = Number(i.quantity || 1);
    const unit = Number(i.unit_price || 0);
    return `
      <tr>
        <td align="left" style="padding:9px 0;border-bottom:1px solid #F6D6D8;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2B2B2B;line-height:1.35;">
          ${escapeHtml(i.title || 'Producto')}${i.kind === 'virtual' ? ' <span style="color:#B8777F;font-size:11px;">(digital)</span>' : ''}
          <div style="font-size:11px;color:#8A6F6A;padding-top:2px;">${qty} x $${fmtAr(unit)}</div>
        </td>
        <td align="right" valign="top" style="padding:9px 0 9px 10px;border-bottom:1px solid #F6D6D8;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2B2B2B;font-weight:bold;white-space:nowrap;">
          $${fmtAr(unit * qty)}
        </td>
      </tr>`;
  }).join('');

  return `
  <tr><td style="padding:4px 16px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" style="padding:0 0 6px;border-bottom:2px solid #F6D6D8;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;color:#B8777F;font-weight:bold;">PRODUCTO</td>
        <td align="right" style="padding:0 0 6px;border-bottom:2px solid #F6D6D8;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;color:#B8777F;font-weight:bold;">IMPORTE</td>
      </tr>
      ${rows || `<tr><td colspan="2" style="padding:12px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#999;font-size:13px;">Sin detalle de items</td></tr>`}
      <tr>
        <td align="left" style="padding:13px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8A6F6A;letter-spacing:1px;">TOTAL</td>
        <td align="right" style="padding:13px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:19px;color:#B8777F;font-weight:bold;white-space:nowrap;">$${fmtAr(order.total)}</td>
      </tr>
    </table>
  </td></tr>`;
}

/** Footer with brand + contact. */
function receiptFooter() {
  return `
  <tr><td align="center" bgcolor="#F6D6D8" style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8A6F6A;line-height:1.6;">
    NYC Designs · Acassuso 5268, CABA<br>
    <a href="https://nycdesigns.com.ar" style="color:#B8777F;text-decoration:none;">nycdesigns.com.ar</a> ·
    <a href="https://www.instagram.com/newyorkcitydesigns" style="color:#B8777F;text-decoration:none;">@newyorkcitydesigns</a>
  </td></tr>`;
}

/** Generic full-width row for free-form blocks inside the receipt card. */
function receiptRow(inner, padding = '16px') {
  return `<tr><td style="padding:${padding};font-family:Arial,Helvetica,sans-serif;color:#2B2B2B;">${inner}</td></tr>`;
}

function receiptWrap(inner) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F5;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF7F5">
    <tr><td align="center" style="padding:20px 10px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #F6D6D8;border-radius:14px;overflow:hidden;">
        ${inner}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Email to SOL — branded sale receipt with full operational detail. */
function buildHtml(order) {
  const customer = order.payer || {};
  const addr = order.address || {};
  const shippingLabel = order.shipping_label
    || (order.shipping_type === 'delivery' ? 'Envío a domicilio (E-Pick)' : 'Retiro en Acassuso 5268, CABA');

  const fullStreet = [addr.street, addr.number].filter(Boolean).join(' ');
  const addrBlock = order.shipping_type === 'delivery'
    ? `<p style="margin:6px 0;font-size:13px;"><strong>Dirección:</strong> ${escapeHtml(fullStreet)}${addr.extra ? ` (${escapeHtml(addr.extra)})` : ''}, ${escapeHtml(addr.city || '')}, ${escapeHtml(addr.province || '')}${order.postal_code ? ` — CP ${escapeHtml(order.postal_code)}` : ''}</p>
       ${addr.notes ? `<p style="margin:6px 0;color:#8A6F6A;font-size:13px;"><em>📝 ${escapeHtml(addr.notes)}</em></p>` : ''}`
    : '';

  const waPhone = String(customer.phone || '').replace(/\D/g, '');

  const label = 'font-size:10px;letter-spacing:2px;color:#B8777F;font-weight:bold;padding-bottom:7px;';

  return receiptWrap(`
    ${receiptHeader('COMPROBANTE DE VENTA')}
    ${receiptMeta(order)}

    ${receiptRow(`
      <div style="${label}">CLIENTE</div>
      <div style="font-size:14px;font-weight:bold;line-height:1.5;">${escapeHtml(customer.name || 'Sin nombre')}</div>
      ${customer.dni ? `<div style="font-size:13px;color:#555;line-height:1.5;">DNI: ${escapeHtml(customer.dni)}</div>` : ''}
      ${customer.email ? `<div style="font-size:13px;color:#555;line-height:1.5;word-break:break-all;">${escapeHtml(customer.email)}</div>` : ''}
      ${customer.phone ? `<div style="font-size:13px;line-height:1.5;padding-top:2px;">📱 <a href="https://wa.me/${waPhone}" style="color:#B8777F;text-decoration:none;">${escapeHtml(customer.phone)}</a></div>` : ''}
    `, '16px 16px 6px')}

    ${receiptRow(`<div style="${label}">DETALLE</div>`, '10px 16px 0')}
    ${receiptItems(order)}

    ${receiptRow(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF7F5" style="border-radius:8px;">
        <tr><td style="padding:13px 14px;font-family:Arial,Helvetica,sans-serif;">
          <div style="${label}">ENTREGA</div>
          <div style="font-size:13px;font-weight:bold;line-height:1.5;">${escapeHtml(shippingLabel)}</div>
          ${addrBlock}
          ${order.tracking_code ? `<div style="font-size:13px;line-height:1.6;padding-top:4px;">Seguimiento E-Pick: <strong>${escapeHtml(order.tracking_code)}</strong></div>` : ''}
        </td></tr>
      </table>
    `, '16px')}

    ${receiptRow(`
      <div style="text-align:center;">
        <a href="https://nycdesigns.com.ar/admin/" style="display:inline-block;background:#B8777F;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:bold;font-size:14px;">Ver en el panel admin</a>
      </div>
    `, '0 16px 20px')}

    ${receiptFooter()}
  `);
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
  // pedidos@nycdesigns.com.ar is a send-only identity (no inbox). Replies
  // must land somewhere real — Sol's Gmail — or customers hitting "Reply"
  // would bounce.
  const replyTo = process.env.ORDER_REPLY_TO || NOTIFY_TO_DEFAULT;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], reply_to: replyTo, subject, html, text })
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

  // Build "Tu descarga" section if any virtual items exist with a download URL
  const virtualItems = items.filter(i => i.kind === 'virtual' && i.download_url);
  const label = 'font-size:10px;letter-spacing:2px;color:#B8777F;font-weight:bold;padding-bottom:7px;';

  const digitalBlock = virtualItems.length > 0
    ? receiptRow(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF3F4" style="border:2px solid #B8777F;border-radius:10px;">
          <tr><td style="padding:16px 14px;font-family:Arial,Helvetica,sans-serif;">
            <div style="${label}">🪄 TU DESCARGA</div>
            ${virtualItems.map(i => `
              <div style="padding:4px 0 10px;">
                <div style="font-size:14px;font-weight:bold;line-height:1.4;padding-bottom:8px;">${escapeHtml(i.title)}</div>
                <a href="${escapeHtml(i.download_url)}" style="display:inline-block;background:#B8777F;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:bold;font-size:13px;">⬇ Descargar / Abrir</a>
              </div>`).join('')}
            <div style="font-size:12px;color:#8A6F6A;line-height:1.5;padding-top:4px;">Si el botón no abre, copiá y pegá el link en tu navegador. Guardá este mail: tu descarga queda siempre acá.</div>
          </td></tr>
        </table>
      `, '14px 16px 0')
    : '';

  // WhatsApp deep-link with prefilled message — works on any device
  const orderShort = (order.id || '').split('_').pop()?.substring(0, 10).toUpperCase();
  const waText = encodeURIComponent(`Hola! Acabo de comprar el pedido ${orderShort} y quería confirmar la recepción.${virtualItems.length ? ' (Producto digital)' : ''}`);
  const waBlock = receiptRow(`
    <div style="text-align:center;">
      <a href="https://wa.me/5491160490630?text=${waText}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:bold;font-size:14px;">💬 Escribir por WhatsApp</a>
      <div style="font-size:12px;color:#8A6F6A;padding-top:8px;">o respondé este mail y te contestamos</div>
    </div>
  `, '4px 16px 20px');

  const fullStreet = [addr.street, addr.number].filter(Boolean).join(' ');
  let addrBlock;
  if (isDigital) {
    addrBlock = `<div style="font-size:13px;line-height:1.5;">Producto digital — tu link de descarga está arriba 👆</div>`;
  } else if (order.shipping_type === 'delivery') {
    addrBlock = `<div style="font-size:13px;line-height:1.5;padding-top:3px;">Dirección: ${escapeHtml(fullStreet)}${addr.extra ? ` (${escapeHtml(addr.extra)})` : ''}, ${escapeHtml(addr.city || '')}, ${escapeHtml(addr.province || '')}${order.postal_code ? ` — CP ${escapeHtml(order.postal_code)}` : ''}</div>`;
  } else {
    addrBlock = `<div style="font-size:13px;line-height:1.5;padding-top:3px;">Coordinamos el retiro por WhatsApp — Acassuso 5268, CABA.</div>`;
  }

  const trackingBlock = !isDigital && order.tracking_code
    ? `<div style="font-size:13px;line-height:1.6;padding-top:4px;">Seguimiento: <strong>${escapeHtml(order.tracking_code)}</strong><br>
       <a href="https://www.e-pick.com.ar/tracking?code=${encodeURIComponent(order.tracking_code)}" style="color:#B8777F;">Ver estado del envío →</a></div>`
    : (!isDigital && order.shipping_type === 'delivery'
        ? `<div style="color:#8A6F6A;font-size:12px;line-height:1.5;padding-top:4px;">Te mandamos el código de seguimiento por email cuando se despache.</div>`
        : '');

  return receiptWrap(`
    ${receiptHeader('COMPROBANTE DE COMPRA')}
    ${receiptMeta(order)}

    ${receiptRow(`
      <div style="text-align:center;">
        <div style="color:#B8777F;font-size:19px;font-weight:bold;line-height:1.3;">¡Gracias por tu compra${customer.name ? ', ' + escapeHtml(customer.name.split(' ')[0]) : ''}! 💗</div>
        <div style="color:#8A6F6A;font-size:13px;line-height:1.5;padding-top:6px;">Tu pago fue aprobado y tu pedido quedó confirmado.</div>
      </div>
    `, '18px 16px 2px')}

    ${digitalBlock}

    ${receiptRow(`<div style="${label}">TU PEDIDO</div>`, '14px 16px 0')}
    ${receiptItems(order)}

    ${receiptRow(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF7F5" style="border-radius:8px;">
        <tr><td style="padding:13px 14px;font-family:Arial,Helvetica,sans-serif;">
          <div style="${label}">ENTREGA</div>
          <div style="font-size:13px;font-weight:bold;line-height:1.5;">${escapeHtml(shippingLabel)}</div>
          ${addrBlock}
          ${trackingBlock}
          ${isDigital ? '' : '<div style="color:#8A6F6A;font-size:12px;line-height:1.5;padding-top:4px;">Producción estimada: 3-7 días hábiles según el producto.</div>'}
        </td></tr>
      </table>
    `, '16px')}

    ${waBlock}

    ${receiptFooter()}
  `);
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
    <a href="https://wa.me/5491160490630" style="color:#B8777F;">WhatsApp</a>.
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
