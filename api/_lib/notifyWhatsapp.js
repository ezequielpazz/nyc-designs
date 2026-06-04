/**
 * WhatsApp Cloud API client — sends the confirmation message to the buyer
 * right after a paid order is processed.
 *
 * No-op until both env vars are configured, so the rest of the flow keeps
 * working unchanged:
 *   - WHATSAPP_ACCESS_TOKEN     — permanent token (Meta Business → Apps)
 *   - WHATSAPP_PHONE_NUMBER_ID  — the Meta phone-number ID (NOT the actual
 *                                  E164 phone — it's the numeric id Meta
 *                                  shows above the "From" dropdown)
 *   - WHATSAPP_GRAPH_VERSION    — optional, defaults to v21.0
 *
 * Fire-and-forget. A failed send never breaks the order or the email flow.
 */

const GRAPH_DEFAULT_VERSION = 'v21.0';

/**
 * Normalize an Argentine phone to E164 without the leading '+'. Meta accepts
 * the digits-only form. Handles common local formats:
 *   "11 2319 9122"      → "5491123199122"
 *   "1123199122"        → "5491123199122"
 *   "+54 9 11 2319 9122"→ "5491123199122"
 */
function normalizePhone(raw, defaultCountry = '54') {
  let s = String(raw || '').replace(/[^\d]/g, '');
  if (!s) return '';
  if (s.startsWith('00')) s = s.slice(2);
  if (s.startsWith(defaultCountry)) {
    return s;
  }
  // 10-digit AR numbers without country code → prepend "549"
  if (s.length === 10) return defaultCountry + '9' + s;
  // 11-digit with leading 0 → drop it
  if (s.length === 11 && s.startsWith('0')) return defaultCountry + '9' + s.slice(1);
  return s;
}

function escapeWaText(s) {
  // WhatsApp's text body just needs to not exceed 4096 chars
  return String(s ?? '').substring(0, 3900);
}

/**
 * Build the message body the buyer receives. Contains the download links,
 * order id and an invitation to reply if they need help.
 */
function buildCustomerMessage(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const virtualItems = items.filter(i => i.kind === 'virtual' && i.download_url);
  if (virtualItems.length === 0) return null;

  const orderShort = (order.id || '').split('_').pop()?.substring(0, 10).toUpperCase() || '';
  const firstName = (order.payer?.name || '').split(' ')[0] || '';

  const lines = [];
  lines.push(`Hola${firstName ? ' ' + firstName : ''}!`);
  lines.push(`Gracias por tu compra en NYC Designs 💗`);
  if (orderShort) lines.push(`Pedido: ${orderShort}`);
  lines.push('');
  lines.push('Estos son tus links de descarga:');
  lines.push('');
  for (const item of virtualItems) {
    lines.push(`*${item.title}*`);
    lines.push(item.download_url);
    lines.push('');
  }
  lines.push('Cualquier duda o consulta, escribinos por acá 💗');
  return escapeWaText(lines.join('\n'));
}

async function callCloudAPI(toPhone, body) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_VERSION || GRAPH_DEFAULT_VERSION;

  if (!token || !phoneNumberId) {
    return { sent: false, reason: 'no_credentials' };
  }
  if (!toPhone) return { sent: false, reason: 'no_phone' };
  if (!body) return { sent: false, reason: 'no_body' };

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body, preview_url: true }
      })
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('WhatsApp send failed:', resp.status, errBody);
      return { sent: false, reason: `http_${resp.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('WhatsApp send exception:', err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Public entry-point. Sends the WhatsApp confirmation to the buyer if:
 *   - WhatsApp credentials are set in env
 *   - order.payer.phone exists
 *   - the order has at least one virtual item with a download_url
 *
 * Returns { sent, reason } so the caller can log it without throwing.
 */
async function notifyCustomerWhatsApp(order) {
  const toPhone = normalizePhone(order?.payer?.phone || '');
  const body = buildCustomerMessage(order);
  return callCloudAPI(toPhone, body);
}

/**
 * Heads-up to Sol when an order ships out. Useful if she wants the same
 * notification on WhatsApp instead of just email. Same gated behavior.
 */
async function notifyShopWhatsApp(order) {
  const shopPhone = process.env.WHATSAPP_SHOP_NOTIFY_PHONE;
  if (!shopPhone) return { sent: false, reason: 'no_shop_phone' };

  const items = Array.isArray(order.items) ? order.items : [];
  const orderShort = (order.id || '').split('_').pop()?.substring(0, 10).toUpperCase() || '';
  const total = Number(order.total || 0).toLocaleString('es-AR');

  const lines = [
    `🛍️ Nuevo pedido NYC Designs`,
    orderShort ? `#${orderShort}` : null,
    `Total: $${total}`,
    `Cliente: ${order?.payer?.name || ''}`.trim(),
    order?.payer?.phone ? `Tel: ${order.payer.phone}` : null,
    '',
    'Items:',
    ...items.map(i => `  • ${i.title} x${i.quantity || 1}`)
  ].filter(Boolean);

  return callCloudAPI(normalizePhone(shopPhone), escapeWaText(lines.join('\n')));
}

module.exports = {
  notifyCustomerWhatsApp,
  notifyShopWhatsApp,
  normalizePhone
};
