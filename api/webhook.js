module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'Webhook endpoint ready' });
  }

  try {
    const { type, data } = req.body;
    console.log('Webhook received:', { type, data });

    // Log payment notifications
    if (type === 'payment') {
      console.log('Payment notification:', data.id);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ error: error.message });
  }
};
