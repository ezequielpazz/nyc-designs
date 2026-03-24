const mercadopago = require('mercadopago');

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const preference = new mercadopago.Preference(client);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://nyc-designs.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, payer, external_reference } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items inválidos' });
    }

    for (const item of items) {
      const price = Number(item.unit_price);
      const qty = Number(item.quantity);
      if (!price || price <= 0 || price > 1000000) {
        return res.status(400).json({ error: `Precio inválido para: ${item.title}` });
      }
      if (!qty || qty <= 0 || !Number.isInteger(qty)) {
        return res.status(400).json({ error: `Cantidad inválida para: ${item.title}` });
      }
    }

    const preferenceData = {
      items: items.map(item => ({
        id: item.id,
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        currency_id: 'ARS'
      })),
      payer: payer ? {
        name: payer.name,
        email: payer.email,
        phone: payer.phone ? { number: payer.phone } : undefined
      } : undefined,
      back_urls: {
        success: 'https://nyc-designs.vercel.app/?status=approved',
        failure: 'https://nyc-designs.vercel.app/?status=failure',
        pending: 'https://nyc-designs.vercel.app/?status=pending'
      },
      auto_return: 'approved',
      external_reference: external_reference || `order_${Date.now()}`,
      statement_descriptor: 'NYC DESIGNS'
    };

    const response = await preference.create({ body: preferenceData });

    return res.status(200).json({
      id: response.id,
      init_point: response.init_point
    });

  } catch (error) {
    console.error('Error creating preference:', error);
    return res.status(500).json({
      error: 'Error al crear preferencia de pago',
      details: error.message
    });
  }
};
