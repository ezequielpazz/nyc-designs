# Backend MercadoPago - NYC Designs

Este servidor Node.js/Express sirve para generar preferencias de pago de MercadoPago
sin exponer el `access_token` en el frontend.

## Pasos de configuración

1. **Crear cuenta en MercadoPago Developers**
   - Ingresar a https://www.mercadopago.com.ar/developers
   - Registrar tu aplicación o usar credenciales de prueba (sandbox).

2. **Obtener credenciales**
   - En el panel de desarrolladores, copia el `ACCESS_TOKEN` y la `PUBLIC_KEY`.
   - Guarda el `ACCESS_TOKEN` en el archivo `.env` (no subir a Git).
   - La `PUBLIC_KEY` puede usarse en el frontend.

3. **Instalar dependencias**
   ```bash
   cd server
   npm install
   ```

4. **Configurar el archivo .env**
   - Crea un archivo `.env` basado en `.env.example`.
   - Rellena las variables:
     ```
     MP_ACCESS_TOKEN=TU_ACCESS_TOKEN
     MP_PUBLIC_KEY=TU_PUBLIC_KEY
     PORT=3000
     FRONTEND_URL=http://localhost:5500
     ```

5. **Ejecutar el servidor**
   ```bash
   npm start
   ```
   quedará escuchando en http://localhost:3000 (o el puerto indicado).

6. **Probar el endpoint**
   - Con Postman o curl:
     ```bash
     curl http://localhost:3000/health
     ```
     debe responder `{ "status": "ok" }`.

   - Para crear una preferencia:
     ```bash
     curl -X POST http://localhost:3000/crear-preferencia \
       -H "Content-Type: application/json" \
       -d '{"items":[{"title":"Taza","unit_price":4500,"quantity":1}],"payer":{"name":"Juan","email":"juan@ejemplo.com"}}'
     ```

7. **Sandbox vs producción**
   - En modo sandbox las transacciones son de prueba; usa las credenciales de prueba.
   - Cambia a las credenciales reales cuando estés listo para producción.
   - Asegúrate de usar HTTPS en producción y restringir CORS.

> El `ACCESS_TOKEN` nunca debe viajar al cliente. El frontend solo usa la `PUBLIC_KEY` y
> llama a este backend para obtener `init_point`.
