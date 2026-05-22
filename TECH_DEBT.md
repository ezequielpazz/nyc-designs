# Tech Debt — Plan de Fase 2

> **Snapshot:** May 2026 — pre-lanzamiento
> **Score externo (peer review independiente):** 8.5/10
> **Decisión:** Publicar primero, refactorizar después.

## ¿Por qué documentamos esto en vez de arreglarlo ya?

NYC Designs es una tienda de un emprendedor. Antes de invertir horas en
refactorizar arquitectura, hay que validar **demanda real**. Si la tienda no
factura, el código bonito no aporta. Si despega → entonces sí vale invertir.

Trigger sugerido para empezar Fase 2: **>100 pedidos/mes** o **bug recurrente
producto de la deuda actual**.

---

## 🔴 Deuda alta (atacar primero si crece el tráfico)

### 1. `js/main.js` monolítico (2.413 líneas)

Toda la lógica de la tienda vive en un solo archivo: carrito, Firebase,
filtros, paginación, chatbot, modal de producto, MercadoPago, calculadora de
envío. Un error de sintaxis en una sección rompe todo el archivo.

**Mitigación actual:**
- Secciones separadas con comentarios `// ========== SECCIÓN ==========`
- `node --check` antes de cada commit
- Estado del carrito centralizado en variable global `cart` + `localStorage`
  espejo; toda mutación pasa por `updateCartUI()` → render imperativo
  centralizado (un flujo unidireccional rudimentario)

**Fase 2 — Refactor sin bundler (3-5 hs):**
- Cambiar `<script src="js/main.js">` por `<script type="module" src="js/main.js">`
- Romper en módulos nativos ES sin tocar el deploy de Vercel:
  - `js/cart.js` — addToCart/removeFromCart/updateCartUI/calculateCartTotal
  - `js/products.js` — renderProductsPage/openProductModal/filtros
  - `js/firebase.js` — initializeFirebase/loadProductsFromFirebase/configRef
  - `js/checkout.js` — processPayment/buildCartPackages/validateForm
  - `js/shipping.js` — calculateShippingCost/checkEpickCoverage/SHIPPING_ZONES
  - `js/chatbot.js` — chatbot logic + botKnowledge
  - `js/ui.js` — showToast/escapeHtml/sanitizeHTML/openLightbox
- Cada módulo `export`a sus funciones públicas. `main.js` queda como entry
  point que importa y wirea eventos.

**No requiere bundler** porque navegadores modernos (>2022) soportan
`import`/`export` nativos.

### 2. `admin/admin.js` monolítico (2.304 líneas)

Mismo problema. CRUD productos + pedidos + testimonios + cupones + mensajes
+ configuración + uploads de Cloudinary + lógica del wizard.

**Fase 2 — Misma estrategia (3-4 hs):**
- `admin/products.js` — wizard + grid + edit/delete
- `admin/orders.js` — render, status updates, E-Pick shipment creation
- `admin/testimonios.js` / `cupones.js` / `mensajes.js`
- `admin/settings.js` — banner / horario / installments / migration helper
- `admin/auth.js` — Google login + authorized emails

---

## 🟡 Deuda media (cuando haya >10 ventas/día sostenidas)

### 3. Mezcla lógica de dominio + presentación

`main.js` mezcla cálculo de totales con renderizado HTML directo
(`innerHTML = ...`). No hay separación clara entre "model" y "view".

**Opciones:**
- **A) Alpine.js** (15 KB, sin build): agrega reactividad mínima. Cambios al
  estado disparan re-renders automáticos. No requiere reescribir mucho,
  solo agregar `x-data`, `x-show`, `x-text` al HTML existente. Una tarde.
- **B) Preact + Signals** (8 KB, sin build con esm.sh): si querés un modelo
  React-like sin todo el peso de React. Reescritura más grande.
- **C) Quedarse vanilla** y solo separar funciones puras en `cart.js`,
  `products.js`, etc. (lo del punto 1).

**Recomendación:** opción C primero. Si después de eso siguen apareciendo
bugs de "UI desincronizada", saltar a A.

### 4. Sin sistema de testing automatizado

Cero tests unitarios o de integración.

**Cobertura crítica recomendada (cuando exista capacidad):**
- Vitest para funciones puras (`calculateCartTotal`, `extractVariantFromName`,
  `priceForPostalCode`, `provinceCode`).
- Supertest para los endpoints serverless (`/api/create-preference`,
  `/api/webhook` con firma simulada, `/api/epick-cotizar` con mocks).
- Playwright E2E para el flujo de compra completo (ya está en mis rules).

**Estimación:** ~10-15 horas para una cobertura inicial razonable (70%+).

### 5. Cache busting manual con query param

Hoy uso `?v=20260521-2` y lo bumpeo a mano cuando hay cambios. Es propenso a
olvidos: si no lo subo, el navegador del cliente sirve JS viejo.

**Fase 2 — opciones:**
- **A)** Hook en `git commit` que actualice automáticamente el `?v=` con el
  hash corto del commit.
- **B)** Build script mínimo (10 líneas de Node) que reemplace el `?v=` con
  un timestamp antes de cada deploy.
- **C)** Vercel build command que haga el reemplazo.

---

## 🟢 Deuda baja (nice to have)

### 6. Más URLs en sitemap

Hoy el sitemap tiene 6 URLs (apex + 5 anchors). Para SEO real, agregar
una URL por producto.

**Implementación:**
- Endpoint serverless `/api/sitemap.xml` que lee productos de Firestore y
  genera el XML dinámicamente.
- Cada producto necesita URL amigable: `/producto/sticker-pocket-home-{id}`.
- Routing en el front: capturar la URL y abrir el modal del producto correspondiente.

### 7. Rate limit serverless mejor

El rate limit actual usa `Map` in-memory por instancia. Vercel puede
rutear requests a instancias distintas → un atacante con suficiente paciencia
puede saturar varias.

**Fase 2:** Upstash Redis (free tier 10k req/día) o Vercel KV.

### 8. Reviews / testimonios con fotos de clientes

Hoy testimonios son texto + nombre + ubicación. Para prueba social moderna,
permitir subir foto del producto recibido.

### 9. Migración de fotos viejas (cuenta Cloudinary dev → Sol)

29 productos tienen URLs en la cuenta dev original. Funcionan, pero no están
en la cuenta de Sol. Tarea de un fin de semana: descargar + re-subir + update
Firestore.

### 10. Bot del chatbot desactualizado

`botKnowledge` en `main.js` menciona categorías que ya no existen ("Tazas &
Vasos" como categoría, "Decoración", "Accesorios"), precios genéricos, y no
sabe responder sobre la dirección real (Acassuso 5268), tarifas E-Pick reales
($9.477 CABA), DNI requerido, etc.

**Tarea simple cuando Sol responda el cuestionario de info de negocio.**

---

## ✅ Lo que NO es deuda (peer review confundió esto)

### Firebase apiKey "hardcoded"

`apiKey: "AIzaSyDTZdpmpGLxOQVVw0Q3k4g2yKzZZ8K8XIw"` aparece en `main.js` y
`admin.js`. Esto **NO es un secret**.

Per [Google docs](https://firebase.google.com/docs/projects/api-keys):
> *"Firebase API keys are different from typical API keys... they do not need
> to be hidden... they are only used to identify your Firebase project to
> Google services."*

La seguridad real está en:
- **Firestore Rules** (`firestore.rules`)
- **Authorized Domains** en Firebase Auth (solo nycdesigns.com.ar)

### Cloudinary `cloudName`

`dgbdzcgkg` aparece en `admin.js`. **No es un secret** — aparece en la URL de
cada imagen del CDN (`res.cloudinary.com/dgbdzcgkg/...`). Es equivalente a un
username público.

### "Vulnerabilidad de $1 en checkout"

Mitigada desde el día 1. `api/create-preference.js:130-148` ignora el
`unit_price` del cliente y consulta Firestore como source of truth.
Verificado en vivo: cliente manda `unit_price: 1` para producto que cuesta
$6.000 → MP recibe `$6.000`.

Excepción: item `id: "shipping"` sí toma el precio del cliente, pero con tope
hardcoded de $50.000 y validación `>0`. Pragmatic porque el envío es dinámico.

---

## Roadmap sugerido

| Fase | Trigger | Items | Esfuerzo |
|---|---|---|---|
| **0 — Lanzamiento** | Ahora | Compra de prueba real + corregir 3 textos del admin + rotar 2 secrets expuestos en chat | 30 min |
| **1 — Polish** | Primeras 10 ventas | Bot actualizado, dimensiones de productos, mensaje a Wanderlust, GA4 real | 4 hs |
| **2 — Mantenibilidad** | >100 pedidos/mes | Refactor a ES modules (puntos 1+2), tests unitarios básicos, sitemap por producto | 15-20 hs |
| **3 — Escala** | >500 pedidos/mes | Migración a Alpine.js/Preact, Upstash rate limit, monitoring (Sentry), CI/CD con tests obligatorios | 40-50 hs |

---

## Créditos

- **Peer review independiente:** ezequielpazz @ peer-review (score 8.5/10)
- **Documentado por:** Claude (Anthropic) — May 2026
