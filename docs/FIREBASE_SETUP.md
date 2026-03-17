# 🔥 CONFIGURACIÓN DE FIREBASE - NYC DESIGNS

## Guía Completa para Configurar Firebase (Google Firestore + Storage)

Esta guía te ayudará a configurar Firebase para que la tienda NYC Designs funcione sin dependencias de Google Sheets.

---

## PASO 1: Crear un Proyecto en Firebase

1. Abre [console.firebase.google.com](https://console.firebase.google.com)
2. Inicia sesión con **newyorkcitydesings4@gmail.com**
3. Haz clic en **"Agregar proyecto"**
4. Nombre del proyecto: **`nyc-designs-tienda`**
5. Desactiva "Google Analytics" (opcional) y haz clic en **"Crear proyecto"**
6. Espera a que se cree (tarda ~1 minuto)

**Pantalla esperada:** Dashboard de Firebase con tu proyecto recién creado

---

## PASO 2: Habilitar Autenticación con Google

1. En el menú izquierdo, ve a **"Crear" → "Autenticación"**
2. Haz clic en **"Atentication"**
3. En la pestaña **"Proveedores de autenticación"**, busca **"Google"**
4. Haz clic en el ícono de Google para expandir
5. Haz clic en **"Activar"** (el toggle debe estar en azul)
6. En **"Correo de soporte del proyecto"**, asegúrate de que dice **newyorkcitydesings4@gmail.com**
7. En **"Nombre que se muestra en el proyecto"**, escribe: **`NYC Designs`**
8. Haz clic en **"Guardar"**

**Resultado:** Google Authentication está habilitado

---

## PASO 3: Crear Base de Datos Firestore

1. En el menú izquierdo, ve a **"Crear" → "Firestore Database"**
2. Haz clic en **"Crear base de datos"**
3. Zona de seguridad: Selecciona **"Comenzar en modo de prueba"** (por ahora)
4. Ubicación de la base de datos: Selecciona **"us-central1 (Básico)"** (o más cercano a tu zona)
5. Haz clic en **"Crear"**

**Resultado:** Firestore está listo para recibir datos

---

## PASO 4: Habilitar Firebase Storage

1. En el menú izquierdo, ve a **"Crear" → "Storage"**
2. Haz clic en **"Iniciar"**
3. Modo de seguridad: Selecciona **"Comenzar en modo de prueba"**
4. Ubicación: **"us-central1"** (o la zona que elegiste para Firestore)
5. Haz clic en **"Crear"**

**Resultado:** Storage está listo para guardar imágenes

---

## PASO 5: Obtener la Configuración de Firebase

1. Ve a **"Configuración del proyecto"** (ícono de engranaje en la esquina superior derecha)
2. Selecciona la pestaña **"Configuración general"**
3. Desplázate hacia abajo hasta encontrar **"Mis aplicaciones"**
4. Si no hay una app registrada, haz clic en **"Agregar aplicación"**
5. Selecciona el ícono **`</>`** (Aplicación web)
6. Nombre de la aplicación: **`nyc-designs-web`**
7. Marca la opción **"También onfigura Google Analytics para esta aplicación"** (opcional)
8. Haz clic en **"Registrar aplicación"**
9. Copia toda el código de configuración que aparece bajo **"firebaseConfig"**

```javascript
const firebaseConfig = {
  apiKey: "AIZA...XXXXXXXXX",
  authDomain: "nyc-designs-tienda.firebaseapp.com",
  projectId: "nyc-designs-tienda",
  storageBucket: "nyc-designs-tienda.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

**✅ GUARDA ESTE CÓDIGO - LO NECESITARÁS EN LOS ARCHIVOS**

---

## PASO 6: Configurar Reglas de Seguridad - Firestore

1. En el menú izquierdo, ve a **"Firestore" → "Normas"**
2. Borra el código existente y reemplaza con esto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Colección: productos
    // Todos pueden LEER, solo admin puede ESCRIBIR
    match /productos/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                      request.auth.token.email == "newyorkcitydesings4@gmail.com";
    }
    
    // Colección: configuracion
    // Todos pueden LEER, solo admin puede ESCRIBIR
    match /configuracion/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                      request.auth.token.email == "newyorkcitydesings4@gmail.com";
    }
  }
}
```

3. Haz clic en **"Publicar"**

---

## PASO 7: Configurar Reglas de Seguridad - Storage

1. En el menú izquierdo, ve a **"Storage" → "Normas"**
2. Borra el código existente y reemplaza con esto:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Almacenamiento de productos
    // Todos pueden LEER (descargar imágenes)
    // Solo admin puede ESCRIBIR (subir imágenes)
    match /productos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                       request.auth.token.email == "newyorkcitydesings4@gmail.com";
    }
  }
}
```

3. Haz clic en **"Publicar"**

---

## PASO 8: Crear la Colección de Productos en Firestore

1. Ve a **"Firestore → "(tabDatos)**
2. Haz clic en **"Crear colección "+(Más)**
3. Nombre de la colección: **`productos`**
4. Haz clic en **"Siguiente"**
5. Haz clic en **"Agregar documento"** para crear el primer producto

**Estructura del documento:**

```json
{
  "nombre": "Taza NYC Stories",
  "precio": 4500,
  "precio_anterior": 5000,
  "categoria": "tazas",
  "descripcion": "Taza de cerámica sublimada con diseño NYC",
  "imagen": "https://..../imagen.jpg",
  "stock": "20",
  "destacado": true,
  "badges": ["Nuevo", "Popular"],
  "visible": true,
  "orden": 1,
  "createdAt": "2026-03-16T00:00:00.000Z",
  "updatedAt": "2026-03-16T00:00:00.000Z"
}
```

**Nota:** Es más fácil agregar productos desde el panel de administrador. Este es opcional.

---

## PASO 9: Crear la Colección de Configuración (Opcional)

1. Crea otra colección llamada **`configuracion`**
2. Crea un documento con ID: **`general`**

```json
{
  "productos_por_pagina": 12,
  "moneda": "$",
  "mostrar_agotados": true,
  "categorias": ["tazas", "regalos", "calendarios", "personalizados", "dia-de-la-madre", "navidad", "empresas"]
}
```

---

## PASO 10: Pegar la Configuración en los Archivos

### En `admin/admin.js`:

Busca la sección **`// PASTE YOUR CONFIG HERE`** (línea ~10) y reemplaza:

```javascript
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};
```

Con tu configuración real del Paso 14.

### En `js/main.js`:

Busca la sección **`// FIREBASE CONFIG`** (línea ~20) y pega la misma configuración.

---

## ¿CÓMO USAR EL PANEL DE ADMINISTRACIÓN?

1. **Accede al panel:** Abre `http://tu-dominio.com/admin/` en el navegador
2. **Inicia sesión:** Haz clic en **"Iniciar sesión con Google"**
3. Usa el correo: **newyorkcitydesings4@gmail.com**
4. **Panel activo:** Ya podrás gestionar productos

📖 **Ver:** [docs/MANUAL_ADMIN.md](./MANUAL_ADMIN.md) para instrucciones detalladas

---

## PRUEBAS Y TROUBLESHOOTING

### ✅ Verificar que todo está funcionando:

1. **¿Puedo ver los productos en la tienda?**
   - Abre `index.html` en el navegador
   - Si ves productos, Firebase está conectado

2. **¿Puedo acceder al panel admin?**
   - Abre `admin/index.html` en el navegador
   - Si ves el botón de Google Sign-In, Firebase está correctamente configurado

3. **¿Las imágenes se cargan desde Storage?**
   - Mira la consola del navegador (F12 → Console)
   - No deberían haber errores 403 o CORS

### ❌ Errores comunes:

**Error: "403 - Acceso denegado"**
- Verifica que las reglas de Firestore y Storage están publicadas (Paso 6 y 7)
- Asegúrate de que el correo está correctamente escrito

**Error: "La base de datos está vacía"**
- Crea al menos un producto en Firestore o desde el panel
- Verifica que `visible: true` en los documentos

**Error: CORS en imágenes**
- Las imágenes de Storage pueden necesitar un bucket público
- Ve a Storage → Configuración y revisa los permisos

**Error: "No estoy autorizado"**
- Verifica que iniciaste sesión con **newyorkcitydesings4@gmail.com**
- Ese es el único correo autorizado para administrar

---

## 🔐 CAMBIAR A MODO DE PRODUCCIÓN

Cuando estés listo para producción (dejar de usar "Modo de Prueba"):

### Firestore:
1. Ve a **Firestore → Normas**
2. Reemplaza `allow read: if true;` con:
   ```
   allow read: if request.auth != null;
   ```

### Storage:
1. Ve a **Storage → Normas**
2. Reemplaza `allow read: if true;` con:
   ```
   allow read: if request.auth != null;
   ```

---

## 📞 CONTACTO Y SOPORTE

Si tienes problemas:
1. Revisa la consola del navegador (F12)
2. Verifica que copiastes correctamente la configuración
3. Asegúrate de que las reglas están publicadas
4. Contacta a [newyorkcitydesings4@gmail.com](mailto:newyorkcitydesings4@gmail.com)

---

**Última actualización:** Marzo 2026  
**Estado:** ✅ Proyecto activo
