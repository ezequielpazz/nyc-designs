# 📘 Manual completo: Google Sheets + NYC Designs

Guía paso a paso para vincular tu Google Sheet con la tienda NYC Designs.

---

## 🚀 Paso 1: Crear tu Google Sheet

### 1.1 Abre Google Sheets
- Ve a [sheets.google.com](https://sheets.google.com)
- Haz clic en "Crear" o "+" (nuevo documento)

### 1.2 Dale un nombre
- Nombre sugerido: "NYC Designs - Productos"

### 1.3 Crea las columnas
Copia exactamente ESTAS columnas en la fila 1:

```
id | nombre | precio | precio_anterior | categoria | descripcion | imagen_1 | imagen_2 | imagen_3 | stock | destacado | badges | visible | orden
```

**Cómo hacerlo:**
1. Celda A1: `id`
2. Celda B1: `nombre`
3. Celda C1: `precio`
4. ... (continúa así para todas)

---

## 📦 Paso 2: Agregar tus primeros productos

### 2.1 Completa una fila de ejemplo

**Fila 2 (Producto 1):**

| A | B | C | D | E | F | G | H | I | J | K | L | M | N |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Taza NYC Classic | 4500 | 5500 | tazas | Cerámica 11oz | https://... | | | 15 | si | Nuevo | si | 1 |

**Traducción:**
- ID: 1
- Nombre: Taza NYC Classic
- Precio actual: $4500
- Precio anterior: $5500 (muestra descuento)
- Categoría: tazas
- Descripción: Cerámica 11oz
- Imagen 1: [URL de imagen]
- Imagen 2: [vacío - opcional]
- Imagen 3: [vacío - opcional]
- Stock: 15 unidades
- Destacado: sí (muestra en portada)
- Badges: Nuevo
- Visible: sí (mostrar en tienda)
- Orden: 1 (primero)

### 2.2 Agrega más productos
Repite el proceso para más filas. Ejemplo con 3 productos:

```
| fila | id | nombre | precio | categoria | ... |
|------|----|---------|---------|-----------|----|
| 2 | 1 | Taza NYC Classic | 4500 | tazas | ... |
| 3 | 2 | Pack Regalo | 8900 | regalos | ... |
| 4 | 3 | Calendario 2026 | 6200 | calendarios | ... |
```

---

## 🖼️ Paso 3: Obtener URLs de imágenes

### 3.1 Subir información a Google Drive (Recomendado)

**Opción A: Usar Google Drive**

1. Abre [Google Drive](https://drive.google.com)
2. Haz clic en "Nuevo" → "Subir archivos"
3. Selecciona tu imagen
4. Espera a que se suba
5. Haz clic derecho en el archivo → "Obtener enlace"

6. Cambia el permiso a "Cualquier persona con el enlace puede ver"

7. Copia el ID del enlace. Busca en la URL:
```
https://drive.google.com/file/d/[ESTE_ES_EL_ID]/view?usp=sharing
```

8. Crea la URL de imagen directa:
```
https://drive.google.com/uc?id=[PEGA_EL_ID_AQUI]&export=download
```

**Ejemplo:**
- Enlace compartido: `https://drive.google.com/file/d/abc123XYZ/view?usp=sharing`
- ID: `abc123XYZ`
- URL para Sheets: `https://drive.google.com/uc?id=abc123XYZ&export=download`

**Opción B: Usar Imgur (Más simple)**

1. Ve a [imgur.com](https://imgur.com)
2. Haz clic en "New post" o arrastra tu imagen
3. Sube la imagen
4. Haz clic derecho en la imagen → "Copiar dirección de imagen"
5. Pega directamente en Google Sheets

Ejemplo:
```
https://i.imgur.com/abc123de.jpg
```

---

## ⚙️ Paso 4: Crear la pestaña CONFIGURACION

### 4.1 Agrega una nueva pestaña

1. En la esquina inferior derecha, haz clic en "+" (símbolo más)
2. Llámala exactamente: **CONFIGURACION** (sin tildes)

### 4.2 Agrega las configuraciones

**Fila 1 (encabezados):**
- A1: `configuracion`
- B1: `valor`

**Fila 2 en adelante:**

```
| A | B |
|---|---|
| configuracion | valor |
| productos_por_pagina | 12 |
| mostrar_agotados | si |
| moneda | $ |
| texto_agotado | Sin stock |
| texto_cargar_mas | Cargar más productos |
| categorias | tazas,regalos,calendarios,personalizados |
```

**Aquí puedes personalizar:**
- `productos_por_pagina`: 6, 12, 24, etc (número de items por página)
- `mostrar_agotados`: `si` o `no`
- `moneda`: `$`, `€`, `ARS`, etc
- `texto_agotado`: Lo que dice cuando no hay stock
- `texto_cargar_mas`: Texto del botón
- `categorias`: Todas tus categorías (separadas por coma)

---

## 📤 Paso 5: Publicar como CSV

### 5.1 Abre tu Google Sheet

Ve a [sheets.google.com](https://sheets.google.com) y abre tu hoja

### 5.2 Comparte la hoja

1. Haz clic en "Compartir" (arriba a la derecha)
2. Cambia a "Cualquiera que tenga el enlace"
3. Copia el enlace (lo usaremos después)

### 5.3 Publica como CSV

1. Haz clic en "Archivo"
2. Selecciona "Compartir" → "Publicar en la web"

3. En el cuadro que aparece:
   - **Documento**: Selecciona tu documento
   - **Pestaña**: Selecciona "Productos" (la primera pestaña)
   - **Formato**: Cambia a **CSV** (este es importante)

4. Haz clic en "Publicar"

5. **IMPORTANTE**: Copia la URL que te genera. Se parece a:
```
https://docs.google.com/spreadsheets/d/1ABc2XyZaBcD3EfGhIjKlMnOpQrStUvWxYz/export?format=csv&gid=0
```

### 5.4 Guarda tu URL
Guarda este URL TÚ LO NECESITARÁS EN EL SIGUIENTE PASO

---

## 🔧 Paso 6: Configurar la URL en js/main.js

### 6.1 Abre el archivo js/main.js

En tu editor (VS Code, etc):
1. Navega a la carpeta `js/`
2. Abre `main.js`

### 6.2 Busca la sección SHEETS_CONFIG

Presiona Ctrl+F y busca: `SHEETS_CONFIG`

Encontrarás algo como:
```javascript
// ========== GOOGLE SHEETS CONFIG ==========
const SHEETS_CONFIG = {
  PRODUCTS_URL: '', // ← Pega tu URL aquí
  CONFIG_URL: '',   // Config sheet (opcional)
  FALLBACK_TO_STATIC: true
};
```

### 6.3 Pega tu URL

Entre las comillas de `PRODUCTS_URL`, pega la URL de tu CSV publicado:

```javascript
const SHEETS_CONFIG = {
  PRODUCTS_URL: 'https://docs.google.com/spreadsheets/d/1ABc2XyZaBcD3EfGhIjKlMnOpQrStUvWxYz/export?format=csv&gid=0',
  CONFIG_URL: '',
  FALLBACK_TO_STATIC: true
};
```

### 6.4 Guarda el archivo

Presiona Ctrl+S para guardar

---

## ✅ Paso 7: Verifica que funcione

### 7.1 Abre la web en el navegador

- Si usas Live Server: Haz clic derecho en `index.html` → "Open with Live Server"
- Si no, abre `index.html` directamente

### 7.2 Comprueba los productos

- Deberían aparecer tus productos de Google Sheets
- Si NO aparecen, abre la consola (F12) y busca errores

### 7.3 Prueba las funciones

- Busca un producto
- Filtra por categoría
- Prueba "Cargar más productos"
- Cambia cantidad de productos por página

---

## 🔄 Actualizar productos

**Lo mejor de Google Sheets:**
1. Edita tu Google Sheet (agrega, elimina, o modifica productos)
2. Guarda
3. Actualiza la web en el navegador (F5)
4. ¡Los nuevos productos aparecen mágicamente! ✨

---

## ⚠️ Problemas comunes

### "Los productos no carga"

**Solución:**
1. Verifica que la URL sea pública (Archivo → Compartir → Publicar en la web)
2. Abre la consola (F12) y busca errores rojo
3. Verifica que todas las columnas tengan los nombres exactos

### "Las imágenes no cargan"

**Solución:**
1. Verifica que el enlace de Google Drive sea público
2. Prueba con una imagen de Imgur en su lugar
3. Abre tu navegador en modo incógnito (a veces es caché)

### "Los badges o descripción no aparecen"

**Solución:**
1. Verifica que hayas completado esas columnas en Google Sheets
2. No dejes espacios en blanco al inicio (ej: ` Nuevo` en lugar de `Nuevo`)

### "La categoría no funciona"

**Solución:**
1. Exactitud: Escribe `tazas` (no `Tazas`, no `TAZAS`)
2. Si es una categoría nueva, agrégala en js/main.js
3. Luego actualiza la columna `categorias` en la pestaña CONFIGURACION

### "Cargar más no funciona"

**Solución:**
1. Asegúrate de que `productos_por_pagina` esté configurado en la pestaña CONFIGURACION
2. Verifica que haya más productos de los que se muestran por página

---

## 📞 Soporte rápido

| Problema | Primero intenta |
|----------|-----------------|
| Nada funciona | Abre F12 → Consola y desplázate. Busca mensajes rojos |
| Una imagen no carga | Abre ese URL en una pestaña nueva; verifica que cargue |
| Categorías no aparecen | Déjalas exactamente: `tazas`, `regalos`, `calendarios` |
| Productos duplicados | Busca filas vacías en Google Sheets y elimínalas |

---

## 🎉 ¡Ya está!

Ya tienes tu tienda conectada a Google Sheets.

**Próximos pasos (opcional):**
- Agrega muchos más productos
- Personaliza las categorías
- Sube fotos profesionales
- Configura MercadoPago para pagos online

¡Buena suerte! 🚀
