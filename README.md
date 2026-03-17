# 🗽 NYC Designs - Tienda Online

Tienda online para venta de tazas sublimadas, regalos personalizados y calendarios con estética NYC.

---

## 📁 ESTRUCTURA DEL PROYECTO

```
nyc_designs_proyecto/
│
├── index.html              ← Página principal (ABRIR ESTE)
│
├── assets/
│   ├── img/
│   │   ├── logo.jpg        ← Logo de la marca ✅
│   │   ├── hero.jpg        ← Imagen principal (AGREGAR)
│   │   ├── producto-1.jpg  ← Fotos de productos (AGREGAR)
│   │   ├── producto-2.jpg
│   │   └── ...
│   │
│   └── icons/
│       └── favicon.png     ← Icono de pestaña (opcional)
│
├── css/
│   └── styles.css          ← Todos los estilos ✅
│
├── js/
│   └── main.js             ← Toda la funcionalidad ✅
│
└── docs/
    └── README.md           ← Este archivo
```

---

## 🛠️ TECNOLOGÍAS UTILIZADAS

| Tecnología | Uso |
|------------|-----|
| **HTML5** | Estructura semántica de la página |
| **CSS3** | Estilos, animaciones, responsive design |
| **JavaScript ES6+** | Interactividad, carrito, chatbot |
| **LocalStorage** | Persistencia del carrito de compras |

### Características CSS:
- Variables CSS (custom properties)
- CSS Grid y Flexbox
- Animaciones y transiciones
- Media queries (responsive)
- Backdrop filter (efecto blur)

### Características JavaScript:
- Carrito de compras con persistencia
- Chatbot con respuestas automáticas
- Filtros y buscador en tiempo real
- Galería con lightbox
- FAQ tipo acordeón
- Animaciones de scroll (Intersection Observer)

---

## ⚙️ CONFIGURACIÓN RÁPIDA
**Backend de MercadoPago**
Se creó una carpeta `server/` con un micro‑servicio en Node.js que genera
preferencias de pago. Consulta `server/README.md` para la instalación y
uso. Asegurate de ejecutar `npm install` y `npm start` dentro de `server` si
utilizás MercadoPago.

### ⚙️ CONFIGURACIÓN RÁPIDA
### 1. Editar datos de contacto

Abrir `js/main.js` y cambiar las líneas 8-11:

```javascript
const CONFIG = {
  WHATSAPP_NUMBER: '5491112345678',     // ← TU NÚMERO
  INSTAGRAM_USER: 'newyorkcitydesingns', // ← TU USUARIO
  STORE_NAME: 'NYC Designs'
};
```

### 2. Agregar imágenes

Colocar las imágenes en `assets/img/`:

| Archivo | Tamaño recomendado | Uso |
|---------|-------------------|-----|
| `logo.jpg` | 200x200 px | Logo en header ✅ Ya está |
| `hero.jpg` | 800x600 px | Imagen principal hero |
| `producto-1.jpg` | 600x400 px | Foto de producto |
| `producto-2.jpg` | 600x400 px | Foto de producto |
| etc. | | |

### 3. Editar productos

En `index.html`, buscar la sección de productos y editar:

```html
<article class="product" 
         data-id="1" 
         data-name="Nombre del Producto" 
         data-price="4500" 
         data-category="tazas">
```
### 5. Categorías dinámicas

Las categorías (y los botones de filtro) se generan automáticamente desde un array en `js/main.js`.
Para agregar una nueva categoría basta con añadir un objeto al array `CATEGORIES` (mira los ejemplos ya incluidos como "Día de la Madre", "Navidad" y "Empresas"). Cada objeto necesita `id`, `label`, `emoji` y `description`.

### 6. Integración MercadoPago

Se incluyó un ejemplo de cómo sumar MercadoPago en el checkout.

1. Sacá las credenciales en el panel de desarrolladores de MercadoPago (públicas y token de acceso).
2. En `index.html` el `<script src="https://sdk.mercadopago.com/js/v2"></script>` usa tu `PUBLIC_KEY` (reemplazar en el comentario). **No pongas el access token en el frontend.**
3. Implementa en tu servidor un endpoint que cree una "preferencia" o un link de pago usando el access token y devuelva la URL.
4. En `js/main.js` la función que atiende el botón `#mpPayBtn` muestra un ejemplo comentado; Cámbialo para llamar a tu endpoint.
5. Si no tenés backend, el botón por ahora abre WhatsApp como fallback.

Recuerda configurar correctamente las rutas y probar en modo desarrollador de MercadoPago.

### 4. Editar precios del chatbot

En `js/main.js`, buscar `botKnowledge` y actualizar los precios en las respuestas.

---

## 🚀 CÓMO USAR

### Opción A: Abrir local
1. Descomprimir el ZIP
2. Abrir `index.html` en el navegador

### Opción B: Subir a hosting
1. Subir toda la carpeta a tu hosting (Netlify, Vercel, GitHub Pages, etc.)
2. El archivo `index.html` es el punto de entrada

### Opción C: Integrar con Tiendanube
Para usar como template de Tiendanube, se necesita convertir a su sistema de templates Liquid. Contactar a un desarrollador.

---

## 📱 FUNCIONALIDADES

### ✅ Implementadas
- [x] Pantalla de carga (loader) con el logo
- [x] Carrito de compras con localStorage
- [x] Checkout por WhatsApp
- [x] Integración parcial MercadoPago (botón y modal)
- [x] Sección de videos TikTok/Reels
- [x] Calculadora de precio interactiva
- [x] Categorías dinámicas desde JS
- [x] Chatbot con respuestas automáticas
- [x] Buscador de productos
- [x] Filtros por categoría
- [x] Galería con lightbox
- [x] FAQ acordeón
- [x] Menú hamburguesa móvil
- [x] Animaciones de scroll
- [x] Botón volver arriba
- [x] Toast de notificaciones
- [x] Diseño 100% responsive
- [x] SEO básico (meta tags)

### ❌ Pendientes (necesitan datos)
- [ ] Imágenes reales de productos
- [ ] Precios actualizados
- [ ] WhatsApp real configurado
- [ ] Instagram real configurado
- [ ] Google Analytics (opcional)
- [ ] Pixel de Meta (opcional)

---

## 🎨 PALETA DE COLORES

| Variable | Color | Uso |
|----------|-------|-----|
| `--blush` | #F6D6D8 | Fondo rosado claro |
| `--offwhite` | #FAF7F5 | Fondo principal |
| `--taupe` | #8A6F6A | Texto secundario |
| `--charcoal` | #2B2B2B | Texto principal |
| `--dusty` | #D9A1A7 | Acentos |
| `--rose` | #B8777F | Color principal/botones |

---

## 📞 SOPORTE

¿Necesitás ayuda con la configuración?
- WhatsApp: [Agregar número]
- Instagram: @newyorkcitydesingns

---

## 📄 LICENCIA

© 2025 New York City Designs. Todos los derechos reservados.
