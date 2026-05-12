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

async function notifyOrderEmail(order) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('notifyOrderEmail: RESEND_API_KEY not set, skipping');
    return { sent: false, reason: 'no_api_key' };
  }
  const to = process.env.ORDER_NOTIFY_TO || NOTIFY_TO_DEFAULT;
  const from = process.env.ORDER_NOTIFY_FROM || NOTIFY_FROM_DEFAULT;
  const subject = `Nuevo pedido en NYC Designs — $${fmtAr(order.total)}`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: buildHtml(order),
        text: buildText(order)
      })
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error('notifyOrderEmail failed:', resp.status, body);
      return { sent: false, reason: `http_${resp.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('notifyOrderEmail exception:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { notifyOrderEmail };
