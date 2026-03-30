# NYC Designs - E-commerce

Tienda online de productos personalizados con estilo NYC. Proyecto full-stack con panel de administración, pagos integrados y gestión de pedidos.

**Live:** [nyc-designs.vercel.app](https://nyc-designs.vercel.app)

---

## Stack Tecnologico

| Tecnologia | Uso |
|------------|-----|
| **HTML5 / CSS3** | Maquetado semantico, responsive, animaciones |
| **JavaScript ES6+** | Logica de tienda, carrito, chatbot |
| **Firebase Firestore** | Base de datos de productos, pedidos, cupones |
| **Firebase Auth** | Autenticacion admin via Google |
| **MercadoPago API** | Checkout de pagos (preferencias + webhooks) |
| **Cloudinary** | Hosting de imagenes de productos |
| **Vercel** | Deploy + serverless functions |

---

## Funcionalidades

### Tienda
- Catalogo dinamico desde Firebase con busqueda y filtros por categoria
- Carrito persistente (localStorage) con cupones de descuento
- Checkout con MercadoPago (tarjeta, debito, transferencia)
- Calculadora de envios por codigo postal (zonas CABA, GBA, Interior)
- Galeria de producto con multiples imagenes y lightbox
- Chatbot con respuestas automaticas
- Seccion de shorts/videos de productos
- FAQ acordeon, animaciones de scroll, notificaciones toast
- PWA ready (manifest.json)
- SEO optimizado (meta tags, Open Graph, sitemap, robots.txt)
- 100% responsive (mobile-first)

### Panel Admin (/admin)
- Dashboard con metricas y alertas
- CRUD completo de productos (wizard multi-paso, hasta 5 imagenes)
- Gestion de pedidos con estados y tracking
- Sistema de stock automatico
- Cupones de descuento
- Testimonios y mensajes de contacto
- Autenticacion Google con roles

### Seguridad
- Validacion de precios server-side (Firebase vs frontend)
- Proteccion XSS en renderizado de productos
- Sanitizacion de inputs con escapeHtml()
- Validacion de URLs de pago (dominio MercadoPago)
- Headers de seguridad (Referrer-Policy, Permissions-Policy)
- Firestore rules con roles de admin

### API (Serverless)
- `POST /api/create-preference` - Crea preferencia de pago MercadoPago con validacion de precios contra Firebase
- `POST /api/webhook` - Recibe notificaciones de pago y registra pedidos en Firestore

---

## Estructura

```
├── index.html            # Tienda principal
├── css/styles.css        # Estilos + responsive
├── js/main.js            # Logica tienda + carrito
├── admin/
│   ├── index.html        # Panel admin
│   ├── admin.js          # Logica admin (7 secciones)
│   └── admin.css         # Estilos admin
├── api/
│   ├── create-preference.js  # Serverless MercadoPago
│   └── webhook.js            # Webhook de pagos
├── videos/               # Shorts de productos
├── firestore.rules       # Reglas de seguridad Firestore
├── manifest.json         # PWA manifest
├── vercel.json           # Config deploy + headers
├── robots.txt            # SEO
└── sitemap.xml           # SEO
```

---

## Variables de Entorno (Vercel)

```
MP_ACCESS_TOKEN=        # MercadoPago Access Token (produccion)
FIREBASE_API_KEY=       # Firebase API Key (validacion server-side)
MP_WEBHOOK_SECRET=      # Secret para validar webhooks (opcional)
```

---

## Deploy

El proyecto se deploya automaticamente en Vercel al pushear a `main`.

```bash
# Desarrollo local
npx serve -l 5000

# O con Vercel CLI (para probar serverless functions)
npx vercel dev --listen 3000
```

---

## Autor

Desarrollado por **Ezequiel Paz**
