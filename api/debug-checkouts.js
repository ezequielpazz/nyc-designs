/**
 * TEMPORARY recovery helper: list recent pending checkouts so we can recover
 * an order that never got created (webhook blocked by MP + buyer didn't return
 * to the success page). Auth via CRON_SECRET. Delete after use.
 *
 *   GET /api/debug-checkouts?token=<CRON_SECRET>&email=<optional>&limit=30
 */

const { getDb } = require('./_lib/firestoreAdmin');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const expected = process.env.CRON_SECRET;
  const given = req.query?.token || '';
  if (!expected || given !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const emailFilter = (req.query?.email || '').toLowerCase().trim();
  const limit = Math.min(Number(req.query?.limit) || 30, 100);

  try {
    const snap = await getDb().collection('checkouts_pendientes')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      const cust = d.customer || {};
      const created = d.created_at?.toDate ? d.created_at.toDate().toISOString() : null;
      if (emailFilter && String(cust.email || '').toLowerCase() !== emailFilter) return;
      rows.push({
        external_reference: doc.id,
        created_at: created,
        customer_email: cust.email || '',
        customer_name: cust.name || '',
        total: d.total,
        items: (d.items || []).map(i => ({ id: i.id, title: i.title, qty: i.quantity, price: i.unit_price }))
      });
    });

    return res.status(200).json({ count: rows.length, rows });
  } catch (err) {
    console.error('debug-checkouts error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
