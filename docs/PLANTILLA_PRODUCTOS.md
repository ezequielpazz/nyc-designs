# 📊 Plantilla de Google Sheets - Products NYC Designs

## Estructura de la Hoja de Cálculo

Tu Google Sheet debe tener EXACTAMENTE estas columnas (en este orden):

| id | nombre | precio | precio_anterior | categoria | descripcion | imagen_1 | imagen_2 | imagen_3 | stock | destacado | badges | visible | orden |

---

## 🔍 Definición de Columnas

### `id` (Número único)
- Número sin repetir que identifica cada producto
- Ejemplo: `1`, `2`, `3`, etc.
- **Requerido**: Sí

### `nombre` (Texto)
- Nombre del producto
- Ejemplo: `Taza NYC Classic`, `Pack Regalo Especial`
- **Requerido**: Sí

### `precio` (Número)
- Precio actual SIN símbolo de moneda
- Solo números, sin comas ni puntos para miles
- Ejemplo: `4500`, `8900`, `12500`
- **Requerido**: Sí

### `precio_anterior` (Número)
- Precio anterior para mostrar descuento (tachado)
- Dejar en blanco si no hay descuento
- Ejemplo: `5500` (para producto a $4500, muestra -$1000 de descuento)
- **Requerido**: No (dejar vacío)

### `categoria` (Texto)
- Categoría del producto (debe coincidir exactamente)
- Valores válidos: `tazas`, `regalos`, `calendarios`, `personalizados`, `dia-de-la-madre`, `navidad`, `empresas`
- Puedes agregar nuevas categorías editando js/main.js
- Ejemplo: `tazas`
- **Requerido**: Sí

### `descripcion` (Texto)
- Descripción corta del producto
- Máximo 150 caracteres recomendado
- Ejemplo: `Taza de cerámica blanca, 11oz, apta para microondas`
- **Requerido**: No

### `imagen_1`, `imagen_2`, `imagen_3` (URLs)
- URLs de imágenes desde Google Drive o Imgur
- Mínimo una imagen requerida (imagen_1)
- Ver sección "Cómo obtener URLs de Google Drive" más abajo
- Ejemplo: `https://drive.google.com/uc?id=1Abc...&export=download`
- **Requerido**: Sí (imagen_1), No (imagen_2, imagen_3)

### `stock` (Texto)
- Estado del stock del producto
- Valores válidos: 
  - Número: `5`, `10`, `100` (cantidad disponible)
  - `ilimitado` (stock sin límite)
  - `agotado` (no disponible)
- Ejemplo: `15` o `ilimitado`
- **Requerido**: Sí

### `destacado` (Texto)
- ¿Mostrar en la portada?
- Valores: `si` o `no`
- Ejemplo: `si`
- **Requerido**: Sí

### `badges` (Texto)
- Etiquetas/badges separadas por coma
- Valores sugeridos: `Nuevo`, `Popular`, `Oferta`, `Personalizable`, `Envío gratis`
- Máximo 3 badges por producto
- Ejemplo: `Nuevo,Personalizable`
- **Requerido**: No (dejar vacío)

### `visible` (Texto)
- ¿Mostrar el producto en la tienda?
- Valores: `si` o `no`
- Usa `no` para ocultar sin eliminar
- Ejemplo: `si`
- **Requerido**: Sí

### `orden` (Número)
- Número para ordenar productos (menor = primero)
- Ejemplo: `1`, `2`, `3`, etc.
- Si muchos tienen el mismo orden, se mostrarán en orden de creación
- **Requerido**: Sí

---

## ✅ Ejemplo de una fila completa

```
1 | Taza NYC Classic | 4500 | 5500 | tazas | Taza de cerámica blanca, 11oz | https://... | https://... | | 15 | si | Nuevo,Sublimada | si | 1
```

---

## 📋 Configuración en pestaña "CONFIGURAÇÃO"

Crea una SEGUNDA pestaña llamada exactamente `CONFIGURACION` con esta estructura:

| configuracion | valor |
|---------------|-------|
| productos_por_pagina | 12 |
| mostrar_agotados | si |
| moneda | $ |
| texto_agotado | Sin stock |
| texto_cargar_mas | Cargar más productos |
| categorias | tazas,regalos,calendarios,personalizados,dia-de-la-madre,navidad,empresas |

### Parámetros configurables:

- **productos_por_pagina**: Número de productos por página (6, 12, 24, etc)
- **mostrar_agotados**: `si` o `no` para mostrar productos agotados
- **moneda**: Símbolo monetario ($, €, etc)
- **texto_agotado**: Texto personalizado para productos sin stock
- **texto_cargar_mas**: Texto del botón "Cargar más"
- **categorias**: Lista de categorías disponibles (separadas por coma)

---

## 🖼️ Cómo obtener URLs de Google Drive

### 1. Sube la imagen a Google Drive
- Clic en "Nuevo" → "Subir archivos"
- Selecciona tu imagen

### 2. Haz clic derecho → "Obtener enlace"

### 3. Cambia permisos a "Cualquiera con el enlace"

### 4. Copia el ID de la carpeta del enlace
El enlace se parece a:
```
https://drive.google.com/file/d/1ABc2XyZaBcD3EfGhIjKlMnOpQrStUvWxYz/view?usp=sharing
```

El **ID** es: `1ABc2XyZaBcD3EfGhIjKlMnOpQrStUvWxYz`

### 5. Crea la URL directa para Google Sheets
Reemplaza `ID_DEL_ARCHIVO` en esta URL:
```
https://drive.google.com/uc?id=ID_DEL_ARCHIVO&export=download
```

**Ejemplo completo:**
```
https://drive.google.com/uc?id=1ABc2XyZaBcD3EfGhIjKlMnOpQrStUvWxYz&export=download
```

---

## 🔗 Alternativa: Usar Imgur (más fácil)

1. Ve a https://imgur.com
2. Haz clic en "New post"
3. Sube tu imagen
4. Haz clic derecho en la imagen → "Copiar dirección de imagen"
5. Pega la URL directamente en Google Sheets

Ejemplo:
```
https://i.imgur.com/aBcDeFg.jpg
```

---

## 📤 Publicar la hoja como CSV

Sigue estos pasos para publicar tu Google Sheet como CSV:

### 1. Abre tu Google Sheet
- Ve a [sheets.google.com](https://sheets.google.com)

### 2. Haz clic en "Archivo" → "Compartir" → "Publicar en la web"

### 3. En el menú:
- **Pestaña**: Selecciona la pestaña que deseas (ej: "Productos")
- **Formato**: Cambia a **CSV** (si no está disponible, usa TSV)
- **Opciones**: Selecciona "Incluir autoindex de fila"

### 4. Copia la URL publicada
Copiarás algo como:
```
https://docs.google.com/spreadsheets/d/1ABc2XyZaBcD3EfGhIjKlMnOpQrStUvWxYz/export?format=csv&gid=0
```

### 5. Pega la URL en js/main.js
Busca la sección `SHEETS_CONFIG` y pega:
```javascript
const SHEETS_CONFIG = {
  PRODUCTS_URL: 'https://docs.google.com/spreadsheets/d/tuID/export?format=csv&gid=0'
};
```

---

## ⚠️ Errores comunes

| Error | Solución |
|-------|----------|
| "No se pudo cargar la hoja" | Verifica que la URL sea pública (File >> Share >> Publish to web) |
| "Categoría no encontrada" | Asegúrate de escribir exactamente: `tazas`, `regalos`, `calendarios`, etc. |
| "Imagen no carga" | Verifica que el enlace tenga permiso público de acceso |
| "Productos duplicados" | Revisa que no haya filas duplicadas; elimina filas vacías |
| "Orden incorrecto" | El orden dinámico está basado en la columna `orden`; cámbiala si es necesario |

---

## 🎯 Tips

✅ **Categorías nuevas**: Puedes agregar nuevas categorías editando el array `CATEGORIES` en `js/main.js`

✅ **Caché**: Los productos se cargan en cada acceso; no hay caché

❌ **Espacios en blanco**: Evita espacios al inicio o final de valores de texto

❌ **Celdas vacías**: Si necesitas un campo opcional, déjalo completamente vacío (sin espacios)

✅ **Actualizar productos**: Edita la hoja, guarda, y la web se actualizará automáticamente

---

## 📞 Soporte

Si tienes problemas:
1. Verifica que tus columnas sean exactamente como se especifican arriba
2. Comprueba que la URL sea pública
3. Abre la consola de desarrollador (F12) para ver mensajes de error
