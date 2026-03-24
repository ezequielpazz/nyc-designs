# NYC Designs - Proyecto E-commerce
## 📍 URLs
- **Tienda:** https://nyc-designs.vercel.app
- **Admin:** https://nyc-designs.vercel.app/admin/
- **GitHub:** https://github.com/ezequielpazz/nyc-designs
- **Dominio pendiente:** nycdesigns.com.ar
## 👥 Roles
- **Cliente:** Sol (no técnica) - newyorkcitydesigns4@gmail.com
- **Desarrollador:** Ezequiel Paz - javierituarte20@gmail.com (NO mostrar en público)
- **WhatsApp público:** 5491123199122
- **Instagram:** @newyorkcitydesigns
## 🎨 Paleta de colores
- --blush: #F6D6D8 (fondo rosado)
- --offwhite: #FAF7F5 (fondo principal)
- --taupe: #8A6F6A (texto secundario)
- --charcoal: #2B2B2B (texto principal)
- --dusty: #D9A1A7 (acentos)
- --rose: #B8777F (botones/CTA)
## 🛒 Categorías de productos
1. Fotos & Recuerdos (fotos-recuerdos)
2. Decoración (decoracion)
3. Tazas & Vasos (tazas-vasos)
4. Accesorios (accesorios)
5. Stickers (stickers)
6. Imprimibles & Plantillas (imprimibles-plantillas)
7. Fiestas & Eventos (fiestas-eventos)
## 💳 Pagos
- **MercadoPago** - PRODUCCIÓN activa
- Token en Vercel: MP_ACCESS_TOKEN
- API: /api/create-preference.js y /api/webhook.js
## 📦 Envíos
- **Retiro en punto:** Gratis
- **E-Pick a domicilio:** Calculadora por código postal
- Zonas: CABA $2500, GBA $3000-3200, Interior $4000-5500
## 🔥 Firebase
- Proyecto: nyc-designs
- Colecciones: productos, testimonios, cupones, mensajes, configuracion, pedidos
- Auth: Google (admin)
## 📁 Estructura clave
- index.html → Tienda principal
- js/main.js → Lógica tienda + carrito (localStorage: 'nycCart')
- css/styles.css → Estilos + responsive
- admin/ → Panel administración
- api/ → Serverless MercadoPago
## ✅ Funcionando
- Tienda completa con productos de Firebase
- Carrito con cupones
- MercadoPago checkout
- Panel admin 7 secciones
- Contadores animados
- Chatbot
- SEO (robots.txt, sitemap.xml)
- Calculadora de envíos
## ⚠️ Pendientes
- Fotos reales de productos (cliente)
- Videos TikTok (ocultos hasta tener contenido)
- Google Analytics ID real
- Reglas de seguridad Firestore
- Cupón BIENVENIDO10 (crear en admin)
## 🚫 Reglas importantes
- Email javierituarte20@gmail.com es SOLO admin, nunca mostrar como contacto público
- WhatsApp es post-pago (para personalización)
- No usar Firebase Storage (usar Cloudinary)
- Sección personalización oculta hasta pago exitoso
