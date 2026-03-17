# 📘 MANUAL DEL PANEL DE ADMINISTRACIÓN - NYC DESIGNS

## Bienvenida

¡Hola! Este es el panel de administración de tu tienda NYC Designs. Desde aquí podrás gestionar todos tus productos, subir imágenes y controlar qué ven tus clientes.

**URL del panel:** `tudominio.com/admin/`  
**Email autorizado:** newyorkcitydesings4@gmail.com

---

## 1️⃣ CÓMO ACCEDER AL PANEL

### Pasos:

1. Abre tu navegador (Chrome, Firefox, Safari, Edge)
2. Ve a: **`tudominio.com/admin/`**
3. Haz clic en **"Iniciar sesión con Google"**
4. Selecciona **newyorkcitydesings4@gmail.com**
5. ¡Listo! Estás dentro

### ¿Problemas al iniciar sesión?

- ✅ Asegúrate de usar **newyorkcitydesings4@gmail.com** (ese es el único correo autorizado)
- ✅ Si usas otro correo, verás un error de acceso (esto es por seguridad)
- ✅ Si el botón no funciona, actualiza la página (Ctrl+F5 o Cmd+Shift+R)

---

## 2️⃣ PANTALLA PRINCIPAL (DASHBOARD)

Cuando inicies sesión, verás el dashboard con:

- **📦 Total de Productos:** Cuántos productos tienes en la tienda
- **✨ Productos Destacados:** Cuántos están marcados como especiales
- **👁️ Productos Visibles:** Cuántos ven actualmente los clientes
- **🔄 Última Actualización:** Cuándo fue la última vez que cambiaste algo

**Botones disponibles:**
- **➕ Agregar Producto:** Para crear un nuevo producto
- **🔄 Sincronizar:** Para recargar todo desde la base de datos

---

## 3️⃣ CÓMO AGREGAR UN PRODUCTO

### Paso 1: Ir a la sección de Productos

1. En el menú izquierdo, haz clic en **"📦 Productos"**
2. Verás una lista de todos tus productos actuales
3. Haz clic en **"➕ Agregar Producto"** (arriba a la derecha)

### Paso 2: Completar el Formulario

Se abrirá un formulario con 2 secciones:

#### **INFORMACIÓN BÁSICA:**

| Campo | Qué va aquí | Ejemplo |
|-------|-------------|---------|
| **Nombre*** | Nombre del producto | "Taza NYC Stories" |
| **Categoría*** | Tipo de producto | Tazas, Regalos, Calendarios, etc. |
| **Precio (ARS)*** | Precio en pesos | 4500 |
| **Precio Anterior** | Precio sin descuento (opcional) | 5500 |
| **Descripción** | Detalles del producto | "Taza de cerámica sublimada..." |
| **Stock** | Cantidad disponible | "20", "ilimitado" o "agotado" |
| **Orden** | Posición en la tienda | 1, 2, 3, etc. |

**Campos obligatorios (*):** Si no los llevas, no podrás guardar el producto.

#### **IMAGEN DEL PRODUCTO:**

1. Haz clic en el área de **"📷 Sin imagen"**
2. Selecciona una foto de tu producto
3. **Límite de tamaño:** 2MB (si es más grande, se comprimirá automáticamente)
4. Verás una vista previa de la imagen

**Consejos para buenas fotos:**
- Fondo blanco o neutro
- Foto clara, sin sombras
- Mínimo 800x800 píxeles
- Formato: JPG o PNG

#### **BADGES (ETIQUETAS):**

Marca los que apliquen:
- **🆕 Nuevo** - Producto recién ingresado
- **⭐ Popular** - Más vendido
- **🏷️ Oferta** - Tiene descuento
- **✨ Personalizable** - Se puede personalizar

#### **OPCIONES ESPECIALES:**

- **✨ Marcar como Destacado** - Aparecerá destacado en la tienda
- **👁️ Visible en la tienda** - Si desactivas esto, el producto no se ve (pero no se elimina)

### Paso 3: Guardar

Haz clic en **"💾 Guardar Producto"**

✅ Verás un mensaje de éxito  
✅ El producto aparecerá en la lista  
✅ Inmediatamente estará visible en tu tienda web

---

## 4️⃣ CÓMO EDITAR UN PRODUCTO

### Proceso rápido:

1. Abre **"📦 Productos"** (menú izquierdo)
2. Busca el producto en la tabla
3. Haz clic en el botón **"✏️ Editar"**
4. Cambia lo que necesites
5. Haz clic en **"💾 Guardar Producto"**

**Cambios comunes:**
- Actualizar precio
- Cambiar descripción
- Marcar/desmarcar como destacado
- Cambiar stock
- Cambiar orden de visualización

---

## 5️⃣ CÓMO ELIMINAR UN PRODUCTO

### Advertencia ⚠️

Cuando eliminas un producto:
- Se borra completamente de la base de datos
- **No se puede recuperar**
- La imagen también se elimina

### Pasos:

1. En la tabla de **"📦 Productos"**
2. Encuentra el producto que quieres eliminar
3. Haz clic en **"🗑️ Eliminar"**
4. Verás un mensaje de confirmación
5. Haz clic en **"🗑️ Eliminar Producto"** (en rojo)
6. ✅ El producto desaparece

**Alternativa:** Si no quieres borrarlo, solo **desactiva la visibilidad**:
- Edita el producto
- Desactiva **"👁️ Visible en la tienda"**
- Guarda
- ✅ El producto se oculta pero no se borra

---

## 6️⃣ SUBIR IMÁGENES

### Cómo funcionan las imágenes:

**Cuando agregas/editas un producto:**
1. Haz clic en el área de imagen
2. Selecciona tu archivo
3. Se carga automáticamente a Firebase Storage
4. Se genera un enlace que se guarda en el producto
5. ✅ Aparece en tu tienda y en el admin

### Límites:

- **Tamaño máximo:** 2 MB
- **Formatos permitidos:** JPG, PNG, WebP
- **Si es muy grande:** Se comprime automáticamente (calidad 70%)

### Ejemplo de tamaños ideales:

- 800x800 píxeles → ~150 KB
- 1200x1200 píxeles → ~250 KB
- 1500x1500 píxeles → ~350 KB (máx recomendado)

---

## 7️⃣ BUSCAR Y FILTRAR PRODUCTOS

En la sección **"📦 Productos"**, tienes dos herramientas:

### 🔍 Buscador

- Escribe parte del nombre del producto
- Se filtra automáticamente
- Ejemplo: Escribe "taza" y solo ves tazas

### 📂 Filtro por Categoría

- Selecciona una categoría del dropdown
- Verás solo productos de esa categoría
- "Todas las categorías" muestra todo

### Combinada:

Puedes usar ambas a la vez. Por ejemplo:
- Categoría: "Regalos"
- Búsqueda: "navidad"
- Resultado: Solo regalos navideños

---

## 8️⃣ OCULTAR UN PRODUCTO (SIN BORRARLO)

### Situación:

Quiero que el producto no se vea en la tienda, pero no quiero eliminarlo.

### Solución:

1. **Edita el producto**
2. En la sección de opciones, **desactiva** ✅ **"👁️ Visible en la tienda"**
3. Haz clic en **"💾 Guardar Producto"**
4. ✅ El producto desaparece de la tienda (pero sigue en tu admin)
5. Puedes volver a activarlo cuando quieras

---

## 9️⃣ MARCAR PRODUCTOS DESTACADOS

### Para qué sirve:

Los productos destacados aparecen resaltados en tu tienda y reciben más atención.

### Cómo hacerlo:

1. **Edita el producto**
2. En las opciones especiales, marca **✅ "✨ Marcar como Destacado"**
3. Guarda
4. ✅ El producto aparecerá destacado en la tienda

**Cuántos destacar:** Se recomienda 3-5 productos especiales para que realmente destaquen.

---

## 🔟 OFRECER DESCUENTOS

### Cómo poner en oferta:

1. **Edita el producto**
2. Llena los dos campos de precio:
   - **Precio (ARS):** El precio actual/rebajado (ej: 3500)
   - **Precio Anterior:** El precio sin descuento (ej: 5500)
3. Marca el badge **🏷️ "Oferta"** (opcional pero recomendado)
4. Guarda
5. ✅ En la tienda se verá:
   - Precio tachado: ~~$5500~~ 
   - Precio nuevo: **$3500**

---

## 1️⃣1️⃣ ORDENAR PRODUCTOS EN LA TIENDA

### El campo "Orden":

Controla la posición que ocupa cada producto en la tienda.

### Números recomendados:

- **1, 2, 3...** = Productos populares (arriba)
- **100, 200...** = Productos normales (abajo)
- Si dos productos tienen el mismo número, se ordenan alfabéticamente

### Ejemplo:

```
Orden 1 → Taza NYC (primeira posición)
Orden 2 → Pack Regalo (segunda)
Orden 100 → Calendario (última)
```

### Para reordenar:

1. Edita cada producto
2. Cambia el valor de **"Orden"**
3. Guarda
4. ¡Automáticamente se reordenan en la tienda!

---

## 1️⃣2️⃣ CATEGORÍAS DISPONIBLES

Cuando agregas un producto, debes elegir una categoría:

| Categoría | Emoji | Cuándo usarla |
|-----------|-------|---------------|
| **Tazas** | ☕ | Cualquier taza |
| **Regalos** | 🎁 | Packs, kits regalo |
| **Calendarios** | 📅 | Calendarios de pared/escritorio |
| **Personalizados** | ✨ | Productos que se personalizan |
| **Día de la Madre** | 🌷 | Regalos para mamá |
| **Navidad** | 🎄 | Productos navideños |
| **Empresas** | 🏢 | Regalos corporativos |

---

## 1️⃣3️⃣ CONFIGURACIÓN (OPCIONAL)

En el menú izquierdo, puedes ir a **"⚙️ Configuración"** para ajustar:

- **Productos por página:** Cuántos productos se muestran por página en la tienda (12 por defecto)
- **Moneda:** Símbolo de moneda ($, €, etc.)
- **Mostrar productos agotados:** Si mostrar o no productos con stock = 0

Estos cambios se aplican a toda la tienda.

---

## 1️⃣4️⃣ NOTIFICACIONES Y MENSAJES

### Notificaciones verdes (éxito):

✅ "Producto agregado correctamente"  
✅ "Producto actualizado correctamente"  
✅ "Producto eliminado correctamente"

### Notificaciones rojas (error):

❌ "Por favor completa los campos requeridos"  
❌ "Error guardando producto"

### Mensajes informativos:

ℹ️ "Sincronizando..."  
ℹ️ "Cargando..."

---

## 1️⃣5️⃣ SINCRONIZAR LA TIENDA

Si notas que los productos en la tienda no se actualizan:

1. Ve al **Dashboard** (primera pestaña)
2. Haz clic en **"🔄 Sincronizar"**
3. Espera unos segundos
4. Los productos se recargarán en la tienda

---

## 1️⃣6️⃣ CERRAR SESIÓN

### Para salir del panel:

1. Arriba a la derecha, verás tu email y nombre
2. Haz clic en **"Cerrar Sesión"** (botón rojo)
3. ✅ Se cerrará tu sesión
4. Volverás a la pantalla de inicio

---

## 1️⃣7️⃣ PREGUNTAS FRECUENTES

### P: ¿Puedo acceder desde mi teléfono?

**R:** Sí, el panel es responsive y funciona perfectamente en mobile.

### P: ¿Cuántas imágenes puedo subir por producto?

**R:** Por ahora una imagen principal. Firebase Storage tiene espacio ilimitado.

### P: ¿Qué pasa si cierro el navegador mientras guardo un producto?

**R:** Firebase lo guarda de todos modos (no hay problema).

### P: ¿Puedo tener más administradores?

**R:** No por ahora. Por seguridad, solo newyorkcitydesings4@gmail.com puede administrar. Si necesitás cambiar esto, avísanos.

### P: ¿Se ve todo automáticamente en la tienda?

**R:** Sí. Cuando cambias y guardas, aparece inmediatamente (salvo cachés de navegador).

### P: ¿Cuántos productos puedo tener?

**R:** No hay límite. Firebase puede guardar miles.

### P: ¿Las imágenes se comprimen?

**R:** Sí, si son mayores a 2MB, se reducen automáticamente a 70% de calidad.

### P: ¿Puedo exportar los datos?

**R:** Por ahora no, pero puedes hacer capturas de pantalla de la tabla de productos.

---

## 1️⃣8️⃣ CONTACTO Y SOPORTE

Si tienes problemas o preguntas:

- **Email:** newyorkcitydesings4@gmail.com
- **WhatsApp:** +54 9 11 1234-5678
- **Instagram:** @newyorkcitydesingns

---

## 📋 CHECKLIST RÁPIDO

Antes de poner tu tienda en vivo:

- [ ] Completé la configuración de Firebase
- [ ] Pegué la configuración en admin/admin.js y js/main.js
- [ ] Agregué al menos 3 productos de prueba
- [ ] Probé a editar y eliminar un producto
- [ ] Probé a subir una imagen
- [ ] Visité la tienda principal y vi los productos
- [ ] Probé los filtros y búsqueda
- [ ] Probé a agregar algo al carrito
- [ ] Probé el flujo de checkout

---

## 🚀 SIGUIENTES PASOS

Cuando todo funcione:

1. Agrega todos tus productos reales
2. Configura las categorías que usas
3. Marca los destacados
4. Prueba desde un teléfono
5. ¡Celebra! 🎉

---

**Última actualización:** Marzo 2026  
**Versión del Manual:** 1.0  
**Estado:** ✅ Listo para usar
