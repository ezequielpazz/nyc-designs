/* ============================================
   NYC DESIGNS - ADMIN PANEL JAVASCRIPT
   ============================================
   Funcionalidades:
   - Autenticación con Google
   - CRUD de productos
   - Subida de imágenes
   - Compresión de imágenes
   - Gestión de Firestore
   
   📦 DEPLOYMENT NOTE:
   Este código se ejecuta en el navegador del administrador.
   Las URLs y configuración funcionan automáticamente en Vercel.
   Firebase y Cloudinary manejan las requests en segundo plano.
   ============================================ */

// ========== FIREBASE CONFIG ==========
// Configuración de Firebase para Firestore y Autenticación
const firebaseConfig = {
  apiKey: "AIzaSyDTZdpmpGLxOQVVw0Q3k4g2yKzZZ8K8XIw",
  authDomain: "nyc-designs.firebaseapp.com",
  projectId: "nyc-designs",
  storageBucket: "nyc-designs.firebasestorage.app",
  messagingSenderId: "377493242036",
  appId: "1:377493242036:web:c1ded401db8fbdc08017e1",
  measurementId: "G-6NZTMSC6XR"
};

// ========== CLOUDINARY CONFIG ==========
// Configuración para subida de imágenes (sin Firebase Storage)
// Para obtener tus credenciales de Cloudinary:
// 1. Regístrate en https://cloudinary.com/
// 2. Ve a tu Dashboard > Settings
// 3. Copia tu Cloud Name
// 4. Crea un Upload Preset sin firmar (unsigned) en Settings > Upload
const CLOUDINARY_CONFIG = {
  cloudName: 'dqalfvnal',
  uploadPreset: 'nyc_designs'
};

// Email autorizado para administrar
const AUTHORIZED_EMAIL = "newyorkcitydesings4@gmail.com";

// ========== ESTADO GLOBAL ==========
let currentUser = null;
let allProducts = [];
let currentEditingProductId = null;

// Importar Firebase
const { 
  initializeApp 
} = window.firebase.app;

const {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} = window.firebase.auth;

const {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc
} = window.firebase.firestore;

// Firebase Storage ya no se utiliza (migramos a Cloudinary)

// ========== INICIALIZACIÓN DE FIREBASE ==========
let app, auth, db;

function initFirebase() {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    console.log('✅ Firebase inicializado correctamente');
    
    // Escuchar cambios de autenticación
    onAuthStateChanged(auth, (user) => {
      if (user) {
        handleUserSignedIn(user);
      } else {
        handleUserSignedOut();
      }
    });
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
    showToast('Error inicializando Firebase. Verifica tu configuración.', 'error');
  }
}

// ========== AUTENTICACIÓN ==========

function handleUserSignedIn(user) {
  // Verificar si el email está autorizado
  if (user.email !== AUTHORIZED_EMAIL) {
    showToast(`❌ No estás autorizado. Email: ${user.email}`, 'error');
    signOut(auth);
    return;
  }

  currentUser = user;
  
  // Actualizar UI
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userName').textContent = user.displayName || 'Administrador';
  
  // Cargar datos
  loadProducts();
  updateDashboard();
  
  showToast(`✅ ¡Bienvenido, ${user.displayName || 'Admin'}!`, 'success');
}

function handleUserSignedOut() {
  currentUser = null;
  
  // Actualizar UI
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  
  showToast('Sesión cerrada', 'info');
}

async function signInWithGoogle() {
  try {
    showLoading(true);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error en Google Sign-In:', error);
    if (error.code !== 'auth/popup-closed-by-user') {
      showToast('Error al iniciar sesión con Google', 'error');
    }
  } finally {
    showLoading(false);
  }
}

async function handleLogout() {
  try {
    showLoading(true);
    await signOut(auth);
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    showToast('Error al cerrar sesión', 'error');
  } finally {
    showLoading(false);
  }
}

// ========== CARGAR PRODUCTOS ==========

async function loadProducts() {
  try {
    showLoading(true);
    
    const q = query(collection(db, 'productos'), orderBy('orden', 'asc'));
    const snapshot = await getDocs(q);
    
    allProducts = [];
    snapshot.forEach(doc => {
      allProducts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ ${allProducts.length} productos cargados`);
    renderProductsTable();
    updateDashboard();
  } catch (error) {
    console.error('❌ Error cargando productos:', error);
    showToast('Error cargando productos', 'error');
  } finally {
    showLoading(false);
  }
}

// ========== RENDERIZAR TABLA DE PRODUCTOS ==========

function renderProductsTable() {
  const tbody = document.getElementById('productosTableBody');
  const noMessage = document.getElementById('noProductsMessage');
  
  // Aplicar filtros
  const searchTerm = document.getElementById('searchProducts')?.value.toLowerCase() || '';
  const categoryFilter = document.getElementById('filterCategory')?.value || '';
  
  let filtered = allProducts.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(searchTerm);
    const matchCategory = !categoryFilter || p.categoria === categoryFilter;
    return matchSearch && matchCategory;
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    noMessage.style.display = 'block';
    return;
  }
  
  noMessage.style.display = 'none';
  
  tbody.innerHTML = filtered.map(product => `
    <tr>
      <td>
        ${product.imagen ? `<img src="${product.imagen}" alt="${product.nombre}" class="product-img" onerror="this.src='data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect%20fill=%22%23DDD%22%20width=%22100%25%22%20height=%22100%25%22/%3E%3C/svg%3E">` : '<span style="color:#999">Sin imagen</span>'}
      </td>
      <td><strong>${product.nombre}</strong></td>
      <td><span class="badge-text">${product.categoria}</span></td>
      <td>$${product.precio.toLocaleString('es-AR')}</td>
      <td>${product.stock}</td>
      <td>${product.destacado ? '✨ Sí' : 'No'}</td>
      <td>${product.visible ? '✅ Sí' : '❌ No'}</td>
      <td class="table-actions">
        <button onclick="openEditModal('${product.id}')" class="btn btn-secondary">
          ✏️ Editar
        </button>
        <button onclick="openDeleteModal('${product.id}')" class="btn btn-danger">
          🗑️ Eliminar
        </button>
      </td>
    </tr>
  `).join('');
}

// ========== GUARDAR PRODUCTO ==========

async function saveProduct(productData) {
  try {
    showLoading(true);
    
    // Validar datos requeridos
    if (!productData.nombre || !productData.precio || !productData.categoria) {
      showToast('Por favor completa los campos requeridos', 'warning');
      return false;
    }
    
    // Asegurar que los campos sean del tipo correcto
    productData.precio = parseInt(productData.precio) || 0;
    productData.precio_anterior = parseInt(productData.precio_anterior) || null;
    productData.orden = parseInt(productData.orden) || 999;
    productData.visible = productData.visible !== false;
    productData.destacado = productData.destacado === true;
    productData.badges = productData.badges || [];
    productData.updatedAt = Timestamp.now();
    
    if (currentEditingProductId) {
      // Actualizar producto existente
      const docRef = doc(db, 'productos', currentEditingProductId);
      await updateDoc(docRef, productData);
      showToast('✅ Producto actualizado correctamente', 'success');
    } else {
      // Crear nuevo producto
      productData.createdAt = Timestamp.now();
      await addDoc(collection(db, 'productos'), productData);
      showToast('✅ Producto agregado correctamente', 'success');
    }
    
    // Recargar productos
    await loadProducts();
    closeProductModal();
    
    return true;
  } catch (error) {
    console.error('❌ Error guardando producto:', error);
    showToast('Error guardando producto: ' + error.message, 'error');
    return false;
  } finally {
    showLoading(false);
  }
}

// ========== ELIMINAR PRODUCTO ==========

async function deleteProduct() {
  if (!currentEditingProductId) return;
  
  try {
    showLoading(true);
    
    const product = allProducts.find(p => p.id === currentEditingProductId);
    
    // Las imágenes en Cloudinary se eliminan automáticamente si se desasocian
    // Eliminar documento
    await deleteDoc(doc(db, 'productos', currentEditingProductId));
    
    showToast('✅ Producto eliminado correctamente', 'success');
    await loadProducts();
    closeDeleteModal();
    
  } catch (error) {
    console.error('❌ Error eliminando producto:', error);
    showToast('Error eliminando producto', 'error');
  } finally {
    showLoading(false);
  }
}

// ========== SUBIDA DE IMÁGENES A CLOUDINARY ==========

async function uploadImage(file) {
  if (!file) return null;
  
  // Validar tamaño
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE) {
    // Comprimir
    try {
      const compressedFile = await compressImage(file);
      file = compressedFile;
    } catch (error) {
      showToast('Error comprimiendo imagen', 'error');
      return null;
    }
  }
  
  try {
    showLoading(true);
    
    // Crear FormData para Cloudinary unsigned upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    
    // Subir a Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );
    
    if (!response.ok) {
      throw new Error('Error en respuesta de Cloudinary');
    }
    
    const data = await response.json();
    
    if (!data.secure_url) {
      throw new Error('No se recibió URL de imagen');
    }
    
    showToast('✅ Imagen subida correctamente', 'success');
    return data.secure_url;
    
  } catch (error) {
    console.error('❌ Error subiendo imagen a Cloudinary:', error);
    showToast('Error subiendo imagen: ' + error.message, 'error');
    return null;
  } finally {
    showLoading(false);
  }
}

// ========== COMPRIMIR IMAGEN ==========

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        
        // Calcular nuevas dimensiones (máx 1200px)
        const maxDim = 1200;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        
        canvas.width = w;
        canvas.height = h;
        
        // Dibujar y comprimir
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        
        canvas.toBlob(
          (blob) => {
            const newFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(newFile);
          },
          'image/jpeg',
          0.7 // Calidad 70%
        );
      };
      
      img.onerror = () => reject('Error cargando imagen');
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject('Error leyendo archivo');
    reader.readAsDataURL(file);
  });
}

// ========== MODALES ==========

function openProductModal() {
  currentEditingProductId = null;
  document.getElementById('modalTitle').textContent = 'Agregar Producto';
  document.getElementById('productForm').reset();
  document.getElementById('imagePreview').innerHTML = '📷 Sin imagen';
  document.getElementById('productVisible').checked = true;
  document.getElementById('productModal').classList.add('active');
}

function openEditModal(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  
  currentEditingProductId = productId;
  document.getElementById('modalTitle').textContent = 'Editar Producto';
  
  // Llenar formulario
  document.getElementById('productNombre').value = product.nombre;
  document.getElementById('productCategoria').value = product.categoria;
  document.getElementById('productPrecio').value = product.precio;
  document.getElementById('productPrecioAnterior').value = product.precio_anterior || '';
  document.getElementById('productDescripcion').value = product.descripcion || '';
  document.getElementById('productStock').value = product.stock || '';
  document.getElementById('productOrden').value = product.orden || 0;
  document.getElementById('productDestacado').checked = product.destacado || false;
  document.getElementById('productVisible').checked = product.visible !== false;
  
  // Mostrar imagen
  if (product.imagen) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `<img src="${product.imagen}" alt="${product.nombre}">`;
  }
  
  // Marcar badges
  document.querySelectorAll('.badge-checkbox').forEach(cb => {
    cb.checked = (product.badges || []).includes(cb.value);
  });
  
  document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
  currentEditingProductId = null;
}

function openDeleteModal(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  
  currentEditingProductId = productId;
  document.getElementById('deleteConfirmText').textContent = 
    `¿Estás seguro de que quieres eliminar el producto "${product.nombre}"? Esta acción no se puede deshacer.`;
  document.getElementById('confirmDeleteModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('confirmDeleteModal').classList.remove('active');
  currentEditingProductId = null;
}

// ========== DASHBOARD ==========

function updateDashboard() {
  const total = allProducts.length;
  const featured = allProducts.filter(p => p.destacado).length;
  const visible = allProducts.filter(p => p.visible !== false).length;
  const lastUpdate = new Date().toLocaleTimeString('es-AR');
  
  document.getElementById('totalProducts').textContent = total;
  document.getElementById('featuredProducts').textContent = featured;
  document.getElementById('visibleProducts').textContent = visible;
  document.getElementById('lastUpdate').textContent = lastUpdate;
}

// ========== NAVEGACIÓN DE SECCIONES ==========

function switchSection(sectionName) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // Mostrar sección seleccionada
  const section = document.getElementById(sectionName);
  if (section) {
    section.classList.add('active');
  }
  
  // Marcar nav-item como activo
  document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');
}

// ========== NOTIFICACIONES ==========

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  // Mostrar
  toast.style.bottom = '24px';
  toast.style.opacity = '1';
  
  // Ocultar después de 3 segundos
  setTimeout(() => {
    toast.style.bottom = '-100px';
    toast.style.opacity = '0';
  }, 3000);
}

// ========== LOADING ==========

function showLoading(show = true) {
  const spinner = document.getElementById('loadingSpinner');
  if (show) {
    spinner.classList.remove('hidden');
  } else {
    spinner.classList.add('hidden');
  }
}

// ========== EVENT LISTENERS ==========

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Firebase
  initFirebase();
  
  // Google Login
  document.getElementById('googleLoginBtn')?.addEventListener('click', signInWithGoogle);
  
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  // Navegación de secciones
  document.querySelectorAll('[data-section]').forEach(navItem => {
    navItem.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(navItem.dataset.section);
    });
  });
  
  // Modales
  document.getElementById('addProductBtn')?.addEventListener('click', openProductModal);
  document.getElementById('dashboardAddBtn')?.addEventListener('click', openProductModal);
  document.getElementById('modalClose')?.addEventListener('click', closeProductModal);
  document.getElementById('modalCancelBtn')?.addEventListener('click', closeProductModal);
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteProduct);
  document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
  
  // Cerrar modal al hacer clic en el overlay
  document.getElementById('productModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'productModal') closeProductModal();
  });
  
  document.getElementById('confirmDeleteModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirmDeleteModal') closeDeleteModal();
  });
  
  // Formulario de producto
  document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Recolectar datos del formulario
    const productData = {
      nombre: document.getElementById('productNombre').value.trim(),
      categoria: document.getElementById('productCategoria').value,
      precio: parseInt(document.getElementById('productPrecio').value),
      precio_anterior: document.getElementById('productPrecioAnterior').value ? parseInt(document.getElementById('productPrecioAnterior').value) : null,
      descripcion: document.getElementById('productDescripcion').value.trim(),
      stock: document.getElementById('productStock').value.trim() || 'ilimitado',
      orden: parseInt(document.getElementById('productOrden').value) || 999,
      destacado: document.getElementById('productDestacado').checked,
      visible: document.getElementById('productVisible').checked,
      badges: Array.from(document.querySelectorAll('.badge-checkbox:checked')).map(cb => cb.value)
    };
    
    // Subir imagen si hay
    const fileInput = document.getElementById('productImagen');
    if (fileInput.files.length > 0) {
      const imageUrl = await uploadImage(fileInput.files[0]);
      if (imageUrl) {
        productData.imagen = imageUrl;
      }
    } else if (currentEditingProductId) {
      // Mantener imagen existente si estamos editando
      const product = allProducts.find(p => p.id === currentEditingProductId);
      if (product?.imagen) {
        productData.imagen = product.imagen;
      }
    }
    
    // Guardar
    await saveProduct(productData);
  });
  
  // Vista previa de imagen
  document.getElementById('productImagen')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById('imagePreview').innerHTML = 
          `<img src="${event.target.result}" alt="Preview">`;
      };
      reader.readAsDataURL(file);
    }
  });
  
  // Búsqueda y filtros
  document.getElementById('searchProducts')?.addEventListener('input', renderProductsTable);
  document.getElementById('filterCategory')?.addEventListener('change', renderProductsTable);
  
  // Botón sincronizar
  document.getElementById('syncBtn')?.addEventListener('click', () => {
    loadProducts();
    showToast('🔄 Sincronizando...', 'info');
  });
  
  // Recargar pagina
  document.getElementById('mpOpenBtn')?.addEventListener('click', loadProducts);
  
  console.log('✅ Admin Panel cargado correctamente');
});

// Detectar cuando el usuario cierra la ventana y hace logout
window.addEventListener('beforeunload', () => {
  // Opcional: hacer logout al cerrar
  // signOut(auth);
});
