// servidor Express para crear preferencias de MercadoPago
// usa async/await y variables de entorno

const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// configuramos el access token de MercadoPago (nunca en el frontend)
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN || ''
});

// habilitar CORS únicamente para el frontend especificado
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));
app.use(express.json()); // para parsear JSON en el body

// ruta de prueba para verificar que el servidor está levantado
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando' });
});

// endpoint para crear una preferencia de pago
app.post('/crear-preferencia', async (req, res) => {
  try {
    const { items, payer } = req.body;

    // validación básica
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items inválidos' });
    }

    // armado de la preferencia
    const preference = {
      items,
      payer,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/?status=success`,
        failure: `${process.env.FRONTEND_URL}/?status=failure`,
        pending: `${process.env.FRONTEND_URL}/?status=pending`,
      },
      auto_return: 'approved'
    };

    const response = await mercadopago.preferences.create(preference);

    // devolvemos datos útiles al frontend
    return res.json({
      id: response.body.id,
      init_point: response.body.init_point,
    });
  } catch (err) {
    console.error('Error creando preferencia MP:', err);
    return res.status(500).json({ error: 'No se pudo crear la preferencia' });
  }
});

// iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});