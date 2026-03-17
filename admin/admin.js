/* ============================================
   FIREBASE CONFIGURATION
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyDTZdpmpGLxOQVVw0Q3k4g2yKzZZ8K8XIw",
    authDomain: "nyc-designs.firebaseapp.com",
    projectId: "nyc-designs",
    storageBucket: "nyc-designs.appspot.com",
    messagingSenderId: "661146487634",
    appId: "1:661146487634:web:a4b3c5d6e7f8g9h0i1"
};

const CLOUDINARY_CONFIG = {
    cloudName: 'dqalfvnal',
    uploadPreset: 'nyc_designs'
};

// Authorized admin emails
const AUTHORIZED_EMAILS = [
    "newyorkcitydesigns4@gmail.com",
    "javierituarte20@gmail.com"
];

function checkAuthorization(email) {
    return AUTHORIZED_EMAILS.includes(email.toLowerCase());
}

// Inicializar Firebase COMPAT
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Google provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

/* ============================================
   VARIABLES GLOBALES Y ESTADO
   ============================================ */

let currentUser = null;
let allProducts = [];
let currentEditingProductId = null;
let currentWizardStep = 1;
let productFormData = {
    nombre: '',
    descripcion: '',
    precio: 0,
    precio_anterior: null,
    categoria: '',
    stock: 'ilimitado',
    orden: 0,
    visible: true,
    destacado: false,
    badges: [],
    imagen: null
};

/* ============================================
   FUNCIONES CORE - FIREBASE
   ============================================ */

async function initFirebase() {
    try {
        // Verificar si el usuario ya está autenticado
        auth.onAuthStateChanged(async (user) => {
            if (user && checkAuthorization(user.email)) {
                currentUser = user;
                showAdminPanel();
                await loadProducts();
            } else {
                if (user) {
                    // User is logged in but not authorized
                    await auth.signOut();
                }
                showLoginScreen();
            }
        });
    } catch (error) {
        console.error('Error inicializando Firebase:', error);
    }
}

async function signInWithGoogle() {
    try {
        showLoading(true);
        const result = await auth.signInWithPopup(googleProvider);
        const userEmail = result.user.email;
        
        // Check authorization
        if (!checkAuthorization(userEmail)) {
            await auth.signOut();
            showToast('❌ No autorizado. Solo admins pueden acceder.', 'error');
            showLoginScreen();
            return;
        }
        
        currentUser = result.user;
        console.log('✅ Usuario autenticado:', currentUser.email);
        showAdminPanel();
        updateUserInfo();
        await loadProducts();
    } catch (error) {
        console.error('❌ Error en login:', error);
        showToast('Error en autenticación: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        currentUser = null;
        currentEditingProductId = null;
        allProducts = [];
        showLoginScreen();
        showToast('✅ Sesión cerrada', 'success');
    } catch (error) {
        console.error('Error en logout:', error);
        showToast('Error al cerrar sesión', 'error');
    }
}

/* ============================================
   UI - MOSTRAR/OCULTAR ELEMENTOS
   ============================================ */

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    updateUserInfo();
}

function updateUserInfo() {
    if (currentUser) {
        const matches = currentUser.email.match(/^(.)/);
        const initial = matches ? matches[1].toUpperCase() : 'A';
        
        const userAvatars = document.querySelectorAll('.user-avatar');
        userAvatars.forEach(avatar => {
            avatar.textContent = initial;
        });
        
        const userEmails = document.querySelectorAll('.user-email');
        userEmails.forEach(email => {
            email.textContent = currentUser.email;
        });
    }
}

function showLoading(show) {
    // El loading se puede implementar con spinners si es necesario
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
        icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
        icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">${message}</div>
        <button class="toast-close">×</button>
    `;
    
    container.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    // Auto-dismiss después de 3 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

/* ============================================
   PRODUCTOS - CARGAR Y RENDERIZAR
   ============================================ */

async function loadProducts() {
    try {
        showLoading(true);
        document.getElementById('productsLoading').style.display = 'grid';
        document.getElementById('productsGrid').innerHTML = '';
        
        const snapshot = await db.collection('productos').orderBy('orden', 'asc').get();
        allProducts = [];
        
        snapshot.forEach(doc => {
            allProducts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateDashboard();
        renderProductsGrid();
        updateFilterTabs();
        
    } catch (error) {
        console.error('❌ Error cargando productos:', error);
        showToast('Error al cargar productos', 'error');
    } finally {
        showLoading(false);
        document.getElementById('productsLoading').style.display = 'none';
    }
}

function renderProductsGrid() {
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (allProducts.length === 0) {
        emptyState.style.display = 'flex';
        grid.innerHTML = '';
        return;
    }
    
    emptyState.style.display = 'none';
    grid.innerHTML = '';
    
    allProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Stock status
        let stockStatus = 'stock-in';
        let stockText = product.stock === 'ilimitado' ? 'Ilimitado' : product.stock;
        
        if (product.stock === 'ilimitado' || product.stock === 0 || product.stock === '0') {
            stockStatus = 'stock-out';
            stockText = 'Sin stock';
        } else if (product.stock <= 5) {
            stockStatus = 'stock-low';
            stockText = `${product.stock} left`;
        }
        
        // Descuento
        const hasDiscount = product.precio_anterior && product.precio_anterior > product.precio;
        
        // Badges
        const badgesHTML = (product.badges || []).map(badge => `
            <span class="product-badge badge-${badge.toLowerCase()}">${badge}</span>
        `).join('');
        
        card.innerHTML = `
            <div class="product-image">
                ${product.imagen ? `<img src="${product.imagen}" alt="${product.nombre}">` : '<div style="color: #ccc; font-size: 14px;">Sin imagen</div>'}
                <div class="product-badges">
                    ${product.destacado ? '<span class="product-badge" style="background: #9b59b6; color: white;">★ Destacado</span>' : ''}
                    ${badgesHTML}
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.nombre}</h3>
                ${product.descripcion ? `<p class="product-description">${product.descripcion}</p>` : ''}
                <div class="product-meta">
                    <div class="product-price">
                        <span class="price-current">$${product.precio.toLocaleString('es-AR')}</span>
                        ${hasDiscount ? `<span class="price-old">$${product.precio_anterior.toLocaleString('es-AR')}</span>` : ''}
                    </div>
                    <span class="product-category">${product.categoria}</span>
                </div>
                <span class="product-stock ${stockStatus}">${stockText}</span>
                <div class="product-actions">
                    <button class="action-btn" onclick="openEditModal('${product.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="action-btn" onclick="openDeleteModal('${product.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function updateDashboard() {
    // Total
    const total = allProducts.length;
    document.getElementById('statTotal').textContent = total;
    
    // Visible
    const visible = allProducts.filter(p => p.visible !== false).length;
    document.getElementById('statVisible').textContent = visible;
    
    // Sin stock
    const outOfStock = allProducts.filter(p => 
        p.stock === 0 || p.stock === '0' || (typeof p.stock === 'string' && p.stock.toLowerCase() === 'agotado')
    ).length;
    document.getElementById('statOutOfStock').textContent = outOfStock;
    
    // Destacados
    const featured = allProducts.filter(p => p.destacado).length;
    document.getElementById('statFeatured').textContent = featured;
    
    // Actualizar nav badge
    document.getElementById('navProductBadge').textContent = total;
}

function updateFilterTabs() {
    const categories = ['tazas', 'regalos', 'calendarios', 'personalizados', 'dias-de-la-madre'];
    
    document.getElementById('tabTodos').textContent = allProducts.length;
    
    categories.forEach(cat => {
        const count = allProducts.filter(p => p.categoria === cat).length;
        const element = document.getElementById(`tab${cat.charAt(0).toUpperCase()}${cat.slice(1)}`);
        if (element) element.textContent = count;
    });
}

/* ============================================
   CRUD PRODUCTS
   ============================================ */

async function saveProduct() {
    try {
        if (!productFormData.nombre || !productFormData.descripcion || !productFormData.precio || !productFormData.categoria) {
            showToast('Por favor completa todos los campos requeridos', 'error');
            return false;
        }
        
        showLoading(true);
        
        const data = {
            nombre: productFormData.nombre,
            descripcion: productFormData.descripcion,
            precio: parseInt(productFormData.precio),
            precio_anterior: productFormData.precio_anterior ? parseInt(productFormData.precio_anterior) : null,
            categoria: productFormData.categoria,
            stock: productFormData.stock,
            orden: parseInt(document.getElementById('productOrden')?.value || 0) || 0,
            visible: productFormData.visible,
            destacado: productFormData.destacado,
            badges: productFormData.badges,
            imagen: productFormData.imagen,
            updatedAt: new Date()
        };
        
        if (currentEditingProductId) {
            // Actualizar
            const product = allProducts.find(p => p.id === currentEditingProductId);
            if (product?.imagen && !productFormData.imagen) {
                data.imagen = product.imagen;
            }
            
            await db.collection('productos').doc(currentEditingProductId).update(data);
            showToast('✅ Producto actualizado', 'success');
        } else {
            // Crear nuevo
            data.createdAt = new Date();
            await db.collection('productos').add(data);
            showToast('✅ Producto creado', 'success');
        }
        
        closeWizardModal();
        await loadProducts();
        return true;
        
    } catch (error) {
        console.error('❌ Error guardando producto:', error);
        showToast('Error guardando producto: ' + error.message, 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

async function deleteProduct(productId) {
    try {
        showLoading(true);
        await db.collection('productos').doc(productId).delete();
        showToast('✅ Producto eliminado', 'success');
        closeDeleteModal();
        await loadProducts();
    } catch (error) {
        console.error('❌ Error eliminando:', error);
        showToast('Error eliminando producto', 'error');
    } finally {
        showLoading(false);
    }
}

async function uploadImage(file) {
    if (!file) {
        console.warn('⚠️ No file provided for upload');
        return null;
    }
    
    try {
        console.log('📷 Starting image upload...', file.name);
        
        // Comprimir si es necesario
        const MAX_SIZE = 2 * 1024 * 1024;
        let fileToUpload = file;
        
        if (file.size > MAX_SIZE) {
            console.log('🔄 File size exceeds limit, compressing...');
            fileToUpload = await compressImage(file);
        }
        
        console.log('📤 Uploading to Cloudinary...');
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Cloudinary error: ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        console.log('✅ Image uploaded successfully:', data.secure_url);
        return data.secure_url;
        
    } catch (error) {
        console.error('❌ Error subiendo imagen:', error);
        showToast('Error al subir imagen: ' + error.message, 'error');
        return null;
    }
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > 1200) {
                    height = Math.round((height * 1200) / width);
                    width = 1200;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(
                    (blob) => {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: new Date().getTime()
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    0.85
                );
            };
        };
    });
}

/* ============================================
   WIZARD MODAL FUNCTIONS
   ============================================ */

function openWizardModal() {
    console.log('🚀 openWizardModal called');
    currentEditingProductId = null;
    currentWizardStep = 1;
    productFormData = {
        nombre: '',
        descripcion: '',
        precio: 0,
        precio_anterior: null,
        categoria: '',
        stock: 'ilimitado',
        orden: 0,
        visible: true,
        destacado: false,
        badges: [],
        imagen: null
    };
    
    resetWizardForm();
    showWizardStep(1);
    const modal = document.getElementById('productModal');
    console.log('📦 Modal element:', modal);
    modal.classList.add('active');
    console.log('✅ Modal classList after add:', modal.classList);
    document.body.style.overflow = 'hidden';
}

function openEditModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.warn('⚠️ Product not found:', productId);
        return;
    }
    
    console.log('✏️ Opening edit modal for product:', product.nombre);
    
    currentEditingProductId = productId;
    currentWizardStep = 1;
    
    productFormData = {
        nombre: product.nombre,
        descripcion: product.descripcion,
        precio: product.precio,
        precio_anterior: product.precio_anterior,
        categoria: product.categoria,
        stock: product.stock,
        orden: product.orden || 0,
        visible: product.visible !== false,
        destacado: product.destacado || false,
        badges: product.badges || [],
        imagen: product.imagen
    };
    
    populateWizardForm();
    showWizardStep(1);
    
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        console.error('❌ Product modal not found');
    }
}

function closeWizardModal() {
    console.log('❌ closeWizardModal called');
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    console.log('✅ Modal classList after remove:', modal.classList);
    document.body.style.overflow = 'auto';
    currentEditingProductId = null;
    currentWizardStep = 1;
}

function resetWizardForm() {
    document.getElementById('productNombre').value = '';
    document.getElementById('productDescripcion').value = '';
    document.getElementById('productPrecio').value = '';
    document.getElementById('productPrecioAnterior').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productImagen').value = '';
    
    document.querySelectorAll('input[name="categoria"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="stockType"]').forEach(r => r.checked = (r.value === 'ilimitado'));
    document.querySelectorAll('.badge-checkbox').forEach(cb => cb.checked = false);
    
    document.getElementById('productVisible').checked = true;
    document.getElementById('productDestacado').checked = false;
    
    updateCharCount();
    updateImagePreview();
    updatePreview();
}

function populateWizardForm() {
    document.getElementById('productNombre').value = productFormData.nombre;
    document.getElementById('productDescripcion').value = productFormData.descripcion;
    document.getElementById('productPrecio').value = productFormData.precio;
    document.getElementById('productPrecioAnterior').value = productFormData.precio_anterior || '';
    document.getElementById('productStock').value = productFormData.stock === 'ilimitado' ? '' : productFormData.stock;
    
    // Categoría
    const categoryRadio = document.querySelector(`input[name="categoria"][value="${productFormData.categoria}"]`);
    if (categoryRadio) categoryRadio.checked = true;
    
    // Stock type
    const stockType = productFormData.stock === 'ilimitado' ? 'ilimitado' : 'limitado';
    document.querySelector(`input[name="stockType"][value="${stockType}"]`).checked = true;
    toggleStockInput();
    
    // Badges
    productFormData.badges.forEach(badge => {
        const checkbox = document.querySelector(`.badge-checkbox[value="${badge}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    document.getElementById('productVisible').checked = productFormData.visible;
    document.getElementById('productDestacado').checked = productFormData.destacado;
    
    if (productFormData.imagen) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img id="previewImg" src="${productFormData.imagen}" alt="Preview"><button type="button" class="btn-remove-image">✕</button>`;
        preview.style.display = 'block';
    }
    
    updateCharCount();
    updatePreview();
}

function showWizardStep(stepNumber) {
    currentWizardStep = stepNumber;
    
    // Ocultar todos los steps
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Mostrar el actual
    const activeStep = document.querySelector(`.wizard-step[data-step="${stepNumber}"]`);
    if (activeStep) {
        activeStep.classList.add('active');
    } else {
        console.warn(`⚠️ Wizard step not found for step ${stepNumber}`);
    }
    
    // Actualizar progress
    const percentage = (stepNumber / 6) * 100;
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    
    // Actualizar progress steps
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        if (index + 1 <= stepNumber) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    // Actualizar botones
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (stepNumber === 1) {
        prevBtn.style.display = 'none';
        nextBtn.textContent = 'Siguiente';
    } else if (stepNumber === 6) {
        prevBtn.style.display = 'flex';
        nextBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Publicar
        `;
    } else {
        prevBtn.style.display = 'flex';
        nextBtn.innerHTML = `
            Siguiente
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
        `;
    }
    
    document.getElementById('stepIndicator').textContent = `${stepNumber} de 6`;
    
    // Actualizar preview
    updatePreview();
}

async function nextWizardStep() {
    // Validar paso actual
    if (!validateWizardStep(currentWizardStep)) {
        return;
    }
    
    // Guardar datos del paso actual
    saveWizardStepData(currentWizardStep);
    
    if (currentWizardStep < 6) {
        showWizardStep(currentWizardStep + 1);
    } else {
        // Último paso - guardar producto
        await saveProduct();
    }
}

function prevWizardStep() {
    if (currentWizardStep > 1) {
        saveWizardStepData(currentWizardStep);
        showWizardStep(currentWizardStep - 1);
    }
}

function validateWizardStep(step) {
    switch(step) {
        case 1:
            const nombre = document.getElementById('productNombre').value.trim();
            const desc = document.getElementById('productDescripcion').value.trim();
            if (!nombre || !desc) {
                showToast('Por favor completa nombre y descripción', 'error');
                return false;
            }
            return true;
        case 2:
            const precio = document.getElementById('productPrecio').value;
            if (!precio) {
                showToast('Por favor ingresa un precio', 'error');
                return false;
            }
            return true;
        case 3:
            const categoria = document.querySelector('input[name="categoria"]:checked');
            if (!categoria) {
                showToast('Por favor selecciona una categoría', 'error');
                return false;
            }
            return true;
        default:
            return true;
    }
}

function saveWizardStepData(step) {
    switch(step) {
        case 1:
            productFormData.nombre = document.getElementById('productNombre').value.trim();
            productFormData.descripcion = document.getElementById('productDescripcion').value.trim();
            break;
        case 2:
            productFormData.precio = document.getElementById('productPrecio').value;
            productFormData.precio_anterior = document.getElementById('productPrecioAnterior').value || null;
            break;
        case 3:
            const stockType = document.querySelector('input[name="stockType"]:checked').value;
            productFormData.stock = stockType === 'ilimitado' ? 'ilimitado' : document.getElementById('productStock').value;
            const categoria = document.querySelector('input[name="categoria"]:checked');
            if (categoria) productFormData.categoria = categoria.value;
            break;
        case 5:
            productFormData.visible = document.getElementById('productVisible').checked;
            productFormData.destacado = document.getElementById('productDestacado').checked;
            productFormData.badges = Array.from(document.querySelectorAll('.badge-checkbox:checked')).map(cb => cb.value);
            break;
    }
}

function updatePreview() {
    // Actualizar preview según el paso actual
    saveFewizardStepData(currentWizardStep);
    
    document.getElementById('previewProductName').textContent = productFormData.nombre || 'Nombre del producto';
    document.getElementById('previewProductDesc').textContent = productFormData.descripcion || 'Descripción del producto';
    document.getElementById('previewPrice').textContent = productFormData.precio || '0';
    
    if (productFormData.precio_anterior && productFormData.precio_anterior > productFormData.precio) {
        const oldPrice = document.getElementById('previewOldPrice');
        oldPrice.textContent = `$${productFormData.precio_anterior}`;
        oldPrice.style.display = 'inline';
    } else {
        document.getElementById('previewOldPrice').style.display = 'none';
    }
    
    document.getElementById('previewCategory').textContent = productFormData.categoria || 'Categoría';
    document.getElementById('previewStock').textContent = productFormData.stock === 'ilimitado' ? 'Ilimitado' : productFormData.stock;
    
    if (productFormData.imagen) {
        if (typeof productFormData.imagen === 'string') {
            const preview = document.getElementById('previewProductImage');
            preview.innerHTML = `<img src="${productFormData.imagen}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }
    }
}

function updateCharCount() {
    const count = document.getElementById('productDescripcion').value.length;
    document.getElementById('charCount').textContent = count;
}

function updateImagePreview() {
    const imageInput = document.getElementById('productImagen');
    if (!imageInput) {
        console.warn('⚠️ Image input element not found');
        return;
    }
    
    const file = imageInput.files[0];
    if (!file) {
        console.log('ℹ️ No file selected');
        return;
    }
    
    console.log('🖼️ Creating preview for:', file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('imagePreview');
        if (!preview) {
            console.warn('⚠️ Preview element not found (id="imagePreview")');
            return;
        }
        preview.innerHTML = `<img id="previewImg" src="${e.target.result}" alt="Preview"><button type="button" class="btn-remove-image">✕</button>`;
        preview.style.display = 'block';
        productFormData.imagen = e.target.result;
        console.log('✅ Preview created');
    };
    reader.onerror = () => {
        console.error('❌ Error reading file');
    };
    reader.readAsDataURL(file);
}

function toggleStockInput() {
    const stockTypeRadio = document.querySelector('input[name="stockType"]:checked');
    if (!stockTypeRadio) {
        console.warn('⚠️ Stock type radio not found');
        return;
    }
    
    const stockType = stockTypeRadio.value;
    const productStock = document.getElementById('productStock');
    if (productStock) {
        productStock.style.display = stockType === 'limitado' ? 'block' : 'none';
    } else {
        console.warn('⚠️ productStock element not found');
    }
}

/* ============================================
   DELETE MODAL
   ============================================ */

let deleteProductId = null;

function openDeleteModal(productId) {
    deleteProductId = productId;
    document.getElementById('confirmDeleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('confirmDeleteModal').classList.remove('active');
    deleteProductId = null;
}

function confirmDelete() {
    if (deleteProductId) {
        deleteProduct(deleteProductId);
    }
}

/* ============================================
   SECTION NAVIGATION
   ============================================ */

function switchSection(section) {
    console.log('🔄 Switching to section:', section);
    
    // Actualizar navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`[data-section="${section}"]`);
    if (navItem) {
        navItem.classList.add('active');
    } else {
        console.warn(`⚠️ Navigation item not found for section: ${section}`);
    }
    
    // Actualizar página title
    const titles = {
        'dashboard': 'Inicio',
        'products': 'Productos',
        'settings': 'Configuración'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = titles[section] || section;
    } else {
        console.warn('⚠️ Page title element not found');
    }
    
    // Mostrar/ocultar secciones
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    switch(section) {
        case 'dashboard': {
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection) dashboardSection.classList.add('active');
            break;
        }
        case 'products': {
            const productsSection = document.getElementById('productsSection');
            if (productsSection) productsSection.classList.add('active');
            break;
        }
        case 'settings': {
            const settingsSection = document.getElementById('settingsSection');
            if (settingsSection) settingsSection.classList.add('active');
            break;
        }
    }
}

/* ============================================
   EVENT LISTENERS AND INITIALIZATION
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando admin panel...');
    initFirebase();
    setupEventListeners();
});

function setupEventListeners() {
    console.log('🔗 Setting up event listeners...');
    
    // ========== LOGIN ==========
    document.getElementById('googleLoginBtn')?.addEventListener('click', signInWithGoogle);
    
    // ========== NAVIGATION ==========
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            switchSection(item.dataset.section);
        });
    });
    
    // ========== LOGOUT ==========
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });
    
    // ========== PRODUCTS - MAIN BUTTON ==========
    document.getElementById('newProductBtn')?.addEventListener('click', openWizardModal);
    document.getElementById('dashboardAddBtn')?.addEventListener('click', openWizardModal);
    document.getElementById('emptyStateAddBtn')?.addEventListener('click', openWizardModal);
    
    // ========== FILTER TABS ==========
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Aquí iría lógica de filtrado si es necesario
        });
    });
    
    // ========== WIZARD - BASIC INFO STEP ==========
    document.getElementById('productNombre')?.addEventListener('input', (e) => {
        productFormData.nombre = e.target.value.trim();
        updatePreview();
    });
    
    document.getElementById('productDescripcion')?.addEventListener('input', (e) => {
        productFormData.descripcion = e.target.value.trim();
        updateCharCount();
        updatePreview();
    });
    
    // ========== WIZARD - PRICE STEP ==========
    document.getElementById('productPrecio')?.addEventListener('input', (e) => {
        productFormData.precio = e.target.value;
        updatePreview();
    });
    
    document.getElementById('productPrecioAnterior')?.addEventListener('input', (e) => {
        productFormData.precio_anterior = e.target.value ? parseInt(e.target.value) : null;
        updatePreview();
    });
    
    // ========== WIZARD - CATEGORY SELECTION ==========
    document.querySelectorAll('input[name="categoria"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            productFormData.categoria = e.target.value;
            // Visual feedback
            document.querySelectorAll('.category-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            const categoryOption = e.target.closest('.category-option');
            if (categoryOption) {
                categoryOption.classList.add('selected');
            }
            updatePreview();
        });
    });
    
    // ========== WIZARD - STOCK SELECTION ==========
    document.querySelectorAll('input[name="stockType"]').forEach(radio => {
        radio.addEventListener('change', toggleStockInput);
    });
    
    document.getElementById('productStock')?.addEventListener('input', (e) => {
        productFormData.stock = e.target.value;
        updatePreview();
    });
    
    // ========== WIZARD - IMAGE UPLOAD ==========
    const imageInput = document.getElementById('productImagen');
    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('📷 File selected:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);
                updateImagePreview();
                // Subir a Cloudinary
                const url = await uploadImage(file);
                if (url) {
                    productFormData.imagen = url;
                    updatePreview();
                    showToast('✅ Imagen subida', 'success');
                } else {
                    console.warn('⚠️ Image upload returned null URL');
                }
            }
        });
    } else {
        console.warn('⚠️ Image input element not found (id="productImagen")');
    }
    
    // ========== WIZARD - DROPZONE ==========
    const dropzone = document.getElementById('imageDropzone');
    if (dropzone) {
        console.log('✅ Dropzone found, setting up listeners');
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragging');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragging');
        });
        
        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragging');
            
            const files = e.dataTransfer.files;
            console.log('📦 File dropped, count:', files.length);
            if (files.length > 0) {
                const file = files[0];
                console.log('📷 Processing file:', file.name, file.type);
                if (file.type.startsWith('image/')) {
                    const url = await uploadImage(file);
                    if (url) {
                        productFormData.imagen = url;
                        const preview = document.getElementById('imagePreview');
                        if (preview) {
                            preview.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 200px;"><button type="button" class="btn-remove-image">✕</button>`;
                            preview.style.display = 'block';
                        }
                        updatePreview();
                        showToast('✅ Imagen subida', 'success');
                    }
                } else {
                    showToast('Por favor sube una imagen válida', 'error');
                }
            }
        });
        
        // Click to upload
        dropzone.addEventListener('click', (e) => {
            console.log('🖱️ Dropzone clicked, opening file picker');
            const imageInput = document.getElementById('productImagen');
            if (imageInput) {
                imageInput.click();
            } else {
                console.error('❌ File input element not found');
            }
        });
    }
    
    // Remove image button
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('btn-remove-image')) {
            const preview = document.getElementById('imagePreview');
            const imageInput = document.getElementById('productImagen');
            if (preview) {
                preview.innerHTML = '';
                preview.style.display = 'none';
            }
            if (imageInput) {
                imageInput.value = '';
            }
            productFormData.imagen = null;
        }
    });
    
    // ========== WIZARD - TOGGLES (Visible, Destacado) ==========
    document.getElementById('productVisible')?.addEventListener('change', (e) => {
        productFormData.visible = e.target.checked;
    });
    
    document.getElementById('productDestacado')?.addEventListener('change', (e) => {
        productFormData.destacado = e.target.checked;
    });
    
    // ========== WIZARD - BADGE SELECTION ==========
    document.querySelectorAll('.badge-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            productFormData.badges = Array.from(document.querySelectorAll('.badge-checkbox:checked')).map(cb => cb.value);
            updatePreview();
        });
    });
    
    // ========== WIZARD - BUTTONS ==========
    document.getElementById('nextBtn')?.addEventListener('click', nextWizardStep);
    document.getElementById('prevBtn')?.addEventListener('click', prevWizardStep);
    
    // ========== WIZARD - CLOSE MODAL ==========
    document.getElementById('closeWizardBtn')?.addEventListener('click', closeWizardModal);
    document.getElementById('modalClose')?.addEventListener('click', closeWizardModal);
    
    // Cerrar modal con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('productModal');
            if (modal?.classList.contains('active')) {
                closeWizardModal();
            }
            const deleteModal = document.getElementById('confirmDeleteModal');
            if (deleteModal?.classList.contains('active')) {
                closeDeleteModal();
            }
        }
    });
    
    // ========== DELETE MODAL ==========
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('closeDeleteModalBtn')?.addEventListener('click', closeDeleteModal);
    
    // ========== SETTINGS ==========
    document.getElementById('syncBtn')?.addEventListener('click', async () => {
        showToast('Sincronizando con Firebase...', 'info');
        await loadProducts();
        showToast('✅ Sincronización completada', 'success');
    });
    
    // ========== SEARCH ==========
    document.getElementById('searchProducts')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length === 0) {
            renderProductsGrid();
        } else {
            const filtered = allProducts.filter(p => 
                p.nombre.toLowerCase().includes(query) ||
                p.descripcion.toLowerCase().includes(query) ||
                p.categoria.toLowerCase().includes(query)
            );
            renderFilteredProducts(filtered);
        }
    });
}

function renderFilteredProducts(products) {
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (products.length === 0) {
        emptyState.style.display = 'flex';
        grid.innerHTML = '';
        return;
    }
    
    emptyState.style.display = 'none';
    grid.innerHTML = '';
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        let stockStatus = 'stock-in';
        let stockText = product.stock === 'ilimitado' ? 'Ilimitado' : product.stock;
        
        if (product.stock === 'ilimitado' || product.stock === 0 || product.stock === '0') {
            stockStatus = 'stock-out';
            stockText = 'Sin stock';
        } else if (product.stock <= 5) {
            stockStatus = 'stock-low';
            stockText = `${product.stock} left`;
        }
        
        const hasDiscount = product.precio_anterior && product.precio_anterior > product.precio;
        const badgesHTML = (product.badges || []).map(badge => `
            <span class="product-badge badge-${badge.toLowerCase()}">${badge}</span>
        `).join('');
        
        card.innerHTML = `
            <div class="product-image">
                ${product.imagen ? `<img src="${product.imagen}" alt="${product.nombre}">` : '<div style="color: #ccc; font-size: 14px;">Sin imagen</div>'}
                <div class="product-badges">
                    ${product.destacado ? '<span class="product-badge" style="background: #9b59b6; color: white;">★ Destacado</span>' : ''}
                    ${badgesHTML}
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.nombre}</h3>
                ${product.descripcion ? `<p class="product-description">${product.descripcion}</p>` : ''}
                <div class="product-meta">
                    <div class="product-price">
                        <span class="price-current">$${product.precio.toLocaleString('es-AR')}</span>
                        ${hasDiscount ? `<span class="price-old">$${product.precio_anterior.toLocaleString('es-AR')}</span>` : ''}
                    </div>
                    <span class="product-category">${product.categoria}</span>
                </div>
                <span class="product-stock ${stockStatus}">${stockText}</span>
                <div class="product-actions">
                    <button class="action-btn" onclick="openEditModal('${product.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="action-btn" onclick="openDeleteModal('${product.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

// Alias function for typo fix
function saveFewizardStepData(step) {
    // This is a fix for the typo in updatePreview()
    saveWizardStepData(step);
}

/* ============================================
   MODAL OVERLAY CLOSE
   ============================================ */

document.addEventListener('click', (e) => {
    // Close wizard modal on overlay click
    if (e.target.id === 'productModal') {
        const modal = document.getElementById('productModal');
        if (modal?.classList.contains('active')) {
            closeWizardModal();
        }
    }
    
    // Close delete modal on overlay click
    if (e.target.id === 'confirmDeleteModal') {
        const modal = document.getElementById('confirmDeleteModal');
        if (modal?.classList.contains('active')) {
            closeDeleteModal();
        }
    }
});

console.log('✅ Event listeners configurados correctamente');
