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

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
    imagenes: [null, null, null, null, null],
    material: '',
    medidas: '',
    cuidados: ''
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
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = show ? 'flex' : 'none';
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
        
        if (product.stock === 0 || product.stock === '0') {
            stockStatus = 'stock-out';
            stockText = 'Sin stock';
        } else if (product.stock !== 'ilimitado' && product.stock <= 5) {
            stockStatus = 'stock-low';
            stockText = `${product.stock} restantes`;
        }
        
        // Descuento
        const hasDiscount = product.precio_anterior && product.precio_anterior > product.precio;
        
        // Badges
        const badgesHTML = (product.badges || []).map(badge => `
            <span class="product-badge badge-${escapeHtml(badge.toLowerCase())}">${escapeHtml(badge)}</span>
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
                <h3 class="product-name">${escapeHtml(product.nombre)}</h3>
                ${product.descripcion ? `<p class="product-description">${escapeHtml(product.descripcion)}</p>` : ''}
                <div class="product-meta">
                    <div class="product-price">
                        <span class="price-current">$${product.precio.toLocaleString('es-AR')}</span>
                        ${hasDiscount ? `<span class="price-old">$${product.precio_anterior.toLocaleString('es-AR')}</span>` : ''}
                    </div>
                    <span class="product-category">${escapeHtml(product.categoria)}</span>
                </div>
                <span class="product-stock ${stockStatus}">${escapeHtml(stockText)}</span>
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

    // Low stock alerts (stock <= 5 and not unlimited)
    const lowStock = allProducts.filter(p => {
        const s = parseInt(p.stock, 10);
        return !isNaN(s) && s > 0 && s <= 5;
    });
    const lowStockSection = document.getElementById('lowStockSection');
    const lowStockList = document.getElementById('lowStockList');
    if (lowStockSection && lowStockList) {
        if (lowStock.length > 0) {
            lowStockSection.style.display = 'block';
            lowStockList.innerHTML = lowStock.map(p => `
                <div class="low-stock-item">
                    <span class="low-stock-name">${escapeHtml(p.nombre)}</span>
                    <span class="low-stock-count">${p.stock} restantes</span>
                </div>
            `).join('');
        } else {
            lowStockSection.style.display = 'none';
        }
    }

    // Load recent orders for dashboard
    loadRecentOrders();
}

async function loadRecentOrders() {
    try {
        const snapshot = await db.collection('pedidos')
            .orderBy('created_at', 'desc')
            .limit(5)
            .get();

        const section = document.getElementById('recentOrdersSection');
        const list = document.getElementById('recentOrdersList');
        if (!section || !list) return;

        if (snapshot.empty) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        const orders = [];
        snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

        list.innerHTML = orders.map(order => {
            const date = order.created_at?.toDate ? order.created_at.toDate().toLocaleDateString('es-AR') : '';
            const name = order.customer?.name || order.payer?.name || 'Sin nombre';
            return `
                <div class="recent-order-item">
                    <div class="recent-order-info">
                        <span class="recent-order-id">#${order.id.slice(0, 8).toUpperCase()}</span>
                        <span class="recent-order-name">${escapeHtml(name)}</span>
                    </div>
                    <div class="recent-order-meta">
                        <span class="order-status status-${order.status || 'pendiente'}">${order.status || 'pendiente'}</span>
                        <span class="recent-order-total">$${(order.total || 0).toLocaleString('es-AR')}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Update pending orders count on stat card
        const pendingCount = orders.filter(o => o.status === 'pendiente' || o.status === 'approved').length;
        const badge = document.getElementById('navOrdersBadge');
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error loading recent orders:', error);
    }
}

function updateFilterTabs() {
    const categories = ['fotos-recuerdos', 'decoracion', 'tazas-vasos', 'accesorios', 'stickers', 'imprimibles-plantillas', 'fiestas-eventos'];

    document.getElementById('tabTodos').textContent = allProducts.length;

    categories.forEach(cat => {
        const count = allProducts.filter(p => p.categoria === cat).length;
        const element = document.getElementById(`tab${cat.charAt(0).toUpperCase()}${cat.slice(1)}`);
        if (element) element.textContent = count;
    });
}

function navigateTo(section) {
    const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (navItem) navItem.click();
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
        
        // Filter out nulls but keep order
        const cleanImages = (productFormData.imagenes || []).filter(img => img != null);

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
            imagen: cleanImages[0] || null,
            imagenes: cleanImages,
            material: productFormData.material || '',
            medidas: productFormData.medidas || '',
            cuidados: productFormData.cuidados || '',
            updatedAt: new Date()
        };

        if (currentEditingProductId) {
            // Actualizar
            const product = allProducts.find(p => p.id === currentEditingProductId);
            if (product?.imagen && cleanImages.length === 0) {
                data.imagen = product.imagen;
                data.imagenes = product.imagenes || [product.imagen];
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
        
        // Comprimir si es necesario
        const MAX_SIZE = 2 * 1024 * 1024;
        let fileToUpload = file;
        
        if (file.size > MAX_SIZE) {
            fileToUpload = await compressImage(file);
        }
        
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
        imagenes: [null, null, null, null, null]
    };
    
    resetWizardForm();
    showWizardStep(1);
    const modal = document.getElementById('productModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function openEditModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.warn('⚠️ Product not found:', productId);
        return;
    }
    
    
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
        imagenes: product.imagenes || [product.imagen || null, null, null, null, null]
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
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
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
    // Reset all image slots
    document.querySelectorAll('.image-slot-input').forEach(input => input.value = '');
    document.querySelectorAll('.image-slot-preview').forEach(preview => preview.style.display = 'none');
    document.querySelectorAll('.image-slot-dropzone').forEach(dz => dz.style.display = 'flex');

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
    document.getElementById('productMaterial').value = productFormData.material || '';
    document.getElementById('productMedidas').value = productFormData.medidas || '';
    document.getElementById('productCuidados').value = productFormData.cuidados || '';
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
    
    // Populate image slots
    (productFormData.imagenes || []).forEach((imgUrl, index) => {
        if (imgUrl) {
            const slot = document.querySelector(`.image-slot[data-index="${index}"]`);
            if (slot) {
                const preview = slot.querySelector('.image-slot-preview');
                const dropzone = slot.querySelector('.image-slot-dropzone');
                preview.querySelector('img').src = imgUrl;
                preview.style.display = 'block';
                dropzone.style.display = 'none';
            }
        }
    });

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
            const precio = parseFloat(document.getElementById('productPrecio').value);
            if (isNaN(precio) || precio <= 0) {
                showToast('Por favor ingresa un precio válido (número mayor a 0)', 'error');
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
            productFormData.material = document.getElementById('productMaterial')?.value || '';
            productFormData.medidas = document.getElementById('productMedidas')?.value || '';
            productFormData.cuidados = document.getElementById('productCuidados')?.value || '';
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
    saveWizardStepData(currentWizardStep);
    
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
    
    const firstImage = (productFormData.imagenes || []).find(img => img != null);
    if (firstImage && typeof firstImage === 'string') {
        const preview = document.getElementById('previewProductImage');
        preview.innerHTML = `<img src="${firstImage}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }
}

function updateCharCount() {
    const count = document.getElementById('productDescripcion').value.length;
    document.getElementById('charCount').textContent = count;
}

function handleSlotImageSelect(index, file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const slot = document.querySelector(`.image-slot[data-index="${index}"]`);
        if (!slot) return;
        const preview = slot.querySelector('.image-slot-preview');
        const dropzone = slot.querySelector('.image-slot-dropzone');
        preview.querySelector('img').src = e.target.result;
        preview.style.display = 'block';
        dropzone.style.display = 'none';
        productFormData.imagenes[index] = e.target.result;
        updatePreview();
    };
    reader.readAsDataURL(file);
}

function removeSlotImage(index) {
    const slot = document.querySelector(`.image-slot[data-index="${index}"]`);
    if (!slot) return;
    const preview = slot.querySelector('.image-slot-preview');
    const dropzone = slot.querySelector('.image-slot-dropzone');
    const input = slot.querySelector('.image-slot-input');
    preview.style.display = 'none';
    dropzone.style.display = 'flex';
    if (input) input.value = '';
    productFormData.imagenes[index] = null;
    updatePreview();
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
        'orders': 'Pedidos',
        'testimonials': 'Testimonios',
        'coupons': 'Cupones',
        'messages': 'Mensajes',
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
        case 'orders': {
            const ordersSection = document.getElementById('ordersSection');
            if (ordersSection) ordersSection.classList.add('active');
            loadOrders('todos');
            break;
        }
        case 'testimonials': {
            const testimonialsSection = document.getElementById('testimonialsSection');
            if (testimonialsSection) testimonialsSection.classList.add('active');
            loadTestimonials();
            break;
        }
        case 'coupons': {
            const couponsSection = document.getElementById('couponsSection');
            if (couponsSection) couponsSection.classList.add('active');
            loadCoupons();
            break;
        }
        case 'messages': {
            const messagesSection = document.getElementById('messagesSection');
            if (messagesSection) messagesSection.classList.add('active');
            loadMessages();
            break;
        }
        case 'settings': {
            const settingsSection = document.getElementById('settingsSection');
            if (settingsSection) settingsSection.classList.add('active');
            loadSettings();
            break;
        }
    }
}

/* ============================================
   ÓRDENES / PEDIDOS
   ============================================ */

async function loadOrders(filter = 'todos') {
    try {
        const ordersRef = db.collection('pedidos');
        let query = ordersRef;
        
        if (filter !== 'todos') {
            query = ordersRef.where('status', '==', filter);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        const ordersGrid = document.getElementById('ordersGrid');
        const ordersEmpty = document.getElementById('ordersEmpty');
        
        if (snapshot.empty) {
            if (ordersGrid) ordersGrid.innerHTML = '';
            if (ordersEmpty) ordersEmpty.style.display = 'flex';
            return;
        }
        
        if (ordersEmpty) ordersEmpty.style.display = 'none';
        
        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        
        if (ordersGrid) {
            ordersGrid.innerHTML = orders.map(order => {
                const customer = order.customer || order.payer || {};
                const customerName = escapeHtml(customer.name || 'Sin nombre');
                const customerEmail = escapeHtml(customer.email || '');
                const date = order.created_at?.toDate
                    ? order.created_at.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '';
                const items = order.items || [];
                const itemsHtml = items.map(item =>
                    `<div class="order-item-line">${escapeHtml(item.title || 'Producto')} x${item.quantity || 1} — $${(item.unit_price || 0).toLocaleString('es-AR')}</div>`
                ).join('');
                const whatsappMsg = encodeURIComponent(`Hola ${customer.name || ''}, tu pedido #${order.id.slice(0, 8).toUpperCase()} de NYC Designs está siendo procesado. ¿Tenés alguna consulta?`);
                const trackingCode = order.tracking_code || '';

                return `
                <div class="order-card order-card-expanded">
                    <div class="order-header">
                        <div class="order-id">#${order.id.slice(0, 8).toUpperCase()}</div>
                        <span class="order-date">${date}</span>
                        <span class="order-status status-${order.status || 'pendiente'}">${order.status || 'pendiente'}</span>
                    </div>
                    <div class="order-body">
                        <div class="order-customer">
                            <div class="order-customer-name">${customerName}</div>
                            <div class="order-customer-email">${customerEmail}</div>
                        </div>
                        <div class="order-items">${itemsHtml || '<div class="order-item-line">Sin detalle de items</div>'}</div>
                        <div class="order-total-row">
                            <span>Total:</span>
                            <strong>$${(order.total || 0).toLocaleString('es-AR')}</strong>
                        </div>
                        <div class="order-shipping">Envío: ${escapeHtml(order.shipping_type || 'Pendiente')}</div>
                        ${trackingCode ? `<div class="order-tracking">Seguimiento: <strong>${escapeHtml(trackingCode)}</strong></div>` : ''}
                    </div>
                    <div class="order-footer">
                        <select onchange="updateOrderStatus('${order.id}', this.value)" class="order-status-select">
                            <option value="pendiente" ${order.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="approved" ${order.status === 'approved' ? 'selected' : ''}>Aprobado</option>
                            <option value="pagado" ${order.status === 'pagado' ? 'selected' : ''}>Pagado</option>
                            <option value="enviado" ${order.status === 'enviado' ? 'selected' : ''}>Enviado</option>
                            <option value="entregado" ${order.status === 'entregado' ? 'selected' : ''}>Entregado</option>
                        </select>
                        <input type="text" placeholder="Código de seguimiento" value="${escapeHtml(trackingCode)}"
                            onchange="updateOrderTracking('${order.id}', this.value)" class="tracking-input">
                        ${customerEmail ? `<a href="https://wa.me/?text=${whatsappMsg}" target="_blank" class="btn btn-whatsapp" title="Contactar por WhatsApp">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.702-1.232A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.239 0-4.308-.724-5.993-1.953l-.42-.312-2.791.732.744-2.72-.343-.544A9.936 9.936 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                            WhatsApp
                        </a>` : ''}
                    </div>
                </div>
                `;
            }).join('');
        }
        
        // Update orders badge
        const pendingOrders = orders.filter(o => o.status === 'pendiente').length;
        const badge = document.getElementById('navOrdersBadge');
        if (badge) {
            badge.textContent = pendingOrders;
            badge.style.display = pendingOrders > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('❌ Error loading orders:', error);
        alert('Error al cargar pedidos: ' + error.message);
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        await db.collection('pedidos').doc(orderId).update({
            status: status,
            updatedAt: new Date()
        });
        showToast('Estado del pedido actualizado', 'success');
        loadOrders(document.querySelector('.filter-tab.active')?.dataset.filter || 'todos');
    } catch (error) {
        console.error('❌ Error updating order:', error);
        showToast('Error al actualizar pedido', 'error');
    }
}

async function updateOrderTracking(orderId, trackingCode) {
    try {
        await db.collection('pedidos').doc(orderId).update({
            tracking_code: trackingCode,
            updatedAt: new Date()
        });
        showToast('Código de seguimiento guardado', 'success');
    } catch (error) {
        console.error('❌ Error updating tracking:', error);
        showToast('Error al guardar seguimiento', 'error');
    }
}

/* ============================================
   TESTIMONIOS
   ============================================ */

async function loadTestimonials() {
    try {
        const snapshot = await db.collection('testimonios').orderBy('createdAt', 'desc').get();
        const testimonialsGrid = document.getElementById('testimonialsGrid');
        
        if (snapshot.empty) {
            if (testimonialsGrid) {
                testimonialsGrid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <h2>No hay testimonios</h2>
                        <p>Agrega tu primer testimonio de cliente</p>
                    </div>
                `;
            }
            return;
        }
        
        const testimonials = [];
        snapshot.forEach(doc => {
            testimonials.push({ id: doc.id, ...doc.data() });
        });
        
        if (testimonialsGrid) {
            testimonialsGrid.innerHTML = testimonials.map(t => `
                <div class="testimonial-admin-card">
                    <div class="testimonial-header">
                        <div class="testimonial-info">
                            <div class="testimonial-author">${t.name || 'Anónimo'}</div>
                            <div class="testimonial-location">${t.location || 'Ubicación no especificada'}</div>
                            <div class="testimonial-rating">${'⭐'.repeat(t.rating || 5)}</div>
                        </div>
                        ${t.visible ? '<span class="testimonial-visible-badge">Visible</span>' : ''}
                    </div>
                    <div class="testimonial-text">"${t.text || ''}"</div>
                    <div class="testimonial-actions">
                        <button class="btn btn-secondary" onclick="deleteTestimonial('${t.id}')">Eliminar</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('❌ Error loading testimonials:', error);
    }
}

function openTestimonialModal() {
    const modal = document.getElementById('testimonialModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('testimonialForm').reset();
    }
}

function closeTestimonialModal() {
    const modal = document.getElementById('testimonialModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveTestimonial(e) {
    e.preventDefault();
    try {
        const name = document.getElementById('testimonialName').value;
        const location = document.getElementById('testimonialLocation').value;
        const rating = parseInt(document.getElementById('testimonialRating').value);
        const text = document.getElementById('testimonialText').value;
        const visible = document.getElementById('testimonialVisible').checked;
        
        await db.collection('testimonios').add({
            name,
            location,
            rating,
            text,
            visible,
            createdAt: new Date()
        });
        
        closeTestimonialModal();
        loadTestimonials();
    } catch (error) {
        console.error('❌ Error saving testimonial:', error);
        alert('Error al guardar testimonio');
    }
}

async function deleteTestimonial(id) {
    if (!confirm('¿Eliminar este testimonio?')) return;
    
    try {
        await db.collection('testimonios').doc(id).delete();
        loadTestimonials();
    } catch (error) {
        console.error('❌ Error deleting testimonial:', error);
        alert('Error al eliminar testimonio');
    }
}

/* ============================================
   CUPONES
   ============================================ */

async function loadCoupons() {
    try {
        const snapshot = await db.collection('cupones').orderBy('createdAt', 'desc').get();
        const couponsGrid = document.getElementById('couponsGrid');
        const couponsEmpty = document.getElementById('couponsEmpty');
        
        if (snapshot.empty) {
            if (couponsGrid) couponsGrid.innerHTML = '';
            if (couponsEmpty) couponsEmpty.style.display = 'flex';
            return;
        }
        
        if (couponsEmpty) couponsEmpty.style.display = 'none';
        
        const coupons = [];
        snapshot.forEach(doc => {
            coupons.push({ id: doc.id, ...doc.data() });
        });
        
        if (couponsGrid) {
            couponsGrid.innerHTML = coupons.map(coupon => `
                <div class="coupon-card">
                    <div class="coupon-code">${coupon.code}</div>
                    <div class="coupon-discount-badge">
                        ${coupon.type === 'percentage' ? coupon.value + '%' : '$' + coupon.value}
                    </div>
                    <div class="coupon-details">
                        <div class="coupon-detail-item">
                            <div class="coupon-detail-label">Tipo</div>
                            <div class="coupon-detail-value">${coupon.type === 'percentage' ? 'Porcentaje' : 'Monto fijo'}</div>
                        </div>
                        <div class="coupon-detail-item">
                            <div class="coupon-detail-label">Usado</div>
                            <div class="coupon-detail-value">${coupon.uses || 0}${coupon.maxUses ? '/' + coupon.maxUses : ''}</div>
                        </div>
                    </div>
                    <div class="coupon-status">
                        <div class="coupon-status-indicator ${coupon.active ? 'active' : 'inactive'}"></div>
                        <span class="coupon-status-text">${coupon.active ? 'Activo' : 'Inactivo'}</span>
                    </div>
                    <div class="coupon-actions">
                        <button class="btn btn-secondary" onclick="toggleCoupon('${coupon.id}', ${!coupon.active})" style="flex: 1;">
                            ${coupon.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button class="btn btn-secondary" onclick="deleteCoupon('${coupon.id}')" style="flex: 1;">Eliminar</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('❌ Error loading coupons:', error);
    }
}

function openCouponModal() {
    const modal = document.getElementById('couponModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('couponForm').reset();
    }
}

function closeCouponModal() {
    const modal = document.getElementById('couponModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateCouponPreview() {
    const type = document.getElementById('couponType').value;
    const value = document.getElementById('couponValue').value;
    const preview = document.getElementById('couponPreview');
    
    if (type && value) {
        const text = type === 'percentage' ? value + '% descuento' : '$' + value + ' descuento';
        document.getElementById('couponPreviewText').textContent = text;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

async function saveCoupon(e) {
    e.preventDefault();
    try {
        const code = document.getElementById('couponCode').value.toUpperCase();
        const type = document.getElementById('couponType').value;
        const value = parseFloat(document.getElementById('couponValue').value);
        const maxUses = document.getElementById('couponMaxUses').value ? parseInt(document.getElementById('couponMaxUses').value) : null;
        const expiry = document.getElementById('couponExpiry').value;
        const active = document.getElementById('couponActive').checked;
        
        // Check if code already exists
        const existing = await db.collection('cupones').where('code', '==', code).get();
        if (!existing.empty) {
            alert('Este código de cupón ya existe');
            return;
        }
        
        await db.collection('cupones').add({
            code,
            type,
            value,
            maxUses: maxUses || null,
            uses: 0,
            expiry: expiry ? new Date(expiry) : null,
            active,
            createdAt: new Date()
        });
        
        closeCouponModal();
        loadCoupons();
    } catch (error) {
        console.error('❌ Error saving coupon:', error);
        alert('Error al guardar cupón');
    }
}

async function toggleCoupon(id, active) {
    try {
        await db.collection('cupones').doc(id).update({
            active: active,
            updatedAt: new Date()
        });
        loadCoupons();
    } catch (error) {
        console.error('❌ Error toggling coupon:', error);
        alert('Error al actualizar cupón');
    }
}

async function deleteCoupon(id) {
    if (!confirm('¿Eliminar este cupón?')) return;
    
    try {
        await db.collection('cupones').doc(id).delete();
        loadCoupons();
    } catch (error) {
        console.error('❌ Error deleting coupon:', error);
        alert('Error al eliminar cupón');
    }
}

/* ============================================
   MENSAJES
   ============================================ */

async function loadMessages() {
    try {
        const snapshot = await db.collection('mensajes').orderBy('createdAt', 'desc').get();
        const messagesGrid = document.getElementById('messagesGrid');
        const messagesEmpty = document.getElementById('messagesEmpty');
        
        if (snapshot.empty) {
            if (messagesGrid) messagesGrid.innerHTML = '';
            if (messagesEmpty) messagesEmpty.style.display = 'flex';
            return;
        }
        
        if (messagesEmpty) messagesEmpty.style.display = 'none';
        
        const messages = [];
        let unreadCount = 0;
        snapshot.forEach(doc => {
            const msg = { id: doc.id, ...doc.data() };
            messages.push(msg);
            if (!msg.read) unreadCount++;
        });
        
        if (messagesGrid) {
            messagesGrid.innerHTML = messages.map(msg => `
                <div class="message-card ${!msg.read ? 'unread' : ''}">
                    <div class="message-header">
                        <div class="message-sender">
                            <div class="message-from">${msg.name || 'Anónimo'}</div>
                            <div class="message-email">${msg.email || ''}</div>
                        </div>
                        <div class="message-date">${new Date(msg.createdAt?.toDate()).toLocaleDateString('es-AR')}</div>
                    </div>
                    <div class="message-subject">${msg.subject || 'Sin asunto'}</div>
                    <div class="message-text">${msg.message || ''}</div>
                    <div class="message-actions">
                        ${!msg.read ? `<button onclick="markAsRead('${msg.id}')">Marcar como leído</button>` : ''}
                        <button onclick="deleteMessage('${msg.id}')">Eliminar</button>
                    </div>
                </div>
            `).join('');
        }
        
        // Update messages badge
        const badge = document.getElementById('navMessagesBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('❌ Error loading messages:', error);
    }
}

async function markAsRead(id) {
    try {
        await db.collection('mensajes').doc(id).update({
            read: true
        });
        loadMessages();
    } catch (error) {
        console.error('❌ Error marking message as read:', error);
    }
}

async function deleteMessage(id) {
    try {
        await db.collection('mensajes').doc(id).delete();
        loadMessages();
    } catch (error) {
        console.error('❌ Error deleting message:', error);
        alert('Error al eliminar mensaje');
    }
}

/* ============================================
   CONFIGURACIÓN
   ============================================ */

async function loadSettings() {
    try {
        const settingsDoc = await db.collection('configuracion').doc('general').get();
        
        if (!settingsDoc.exists) {
            return;
        }
        
        const settings = settingsDoc.data();
        
        // Load banner text
        if (settings.bannerText) {
            const bannerInput = document.getElementById('bannerText');
            if (bannerInput) bannerInput.value = settings.bannerText;
        }
        
        // Load hours
        if (settings.hours) {
            if (settings.hours.weekday) {
                const weekdayInput = document.getElementById('hoursWeekday');
                if (weekdayInput) weekdayInput.value = settings.hours.weekday;
            }
            if (settings.hours.saturday) {
                const saturdayInput = document.getElementById('hoursSaturday');
                if (saturdayInput) saturdayInput.value = settings.hours.saturday;
            }
            if (settings.hours.sunday) {
                const sundayInput = document.getElementById('hoursSunday');
                if (sundayInput) sundayInput.value = settings.hours.sunday;
            }
        }
        
        // Load shipping info
        if (settings.shipping) {
            if (settings.shipping.productionTime) {
                const timeInput = document.getElementById('productionTime');
                if (timeInput) timeInput.value = settings.shipping.productionTime;
            }
            if (settings.shipping.methods) {
                const methodsInput = document.getElementById('shippingMethods');
                if (methodsInput) methodsInput.value = settings.shipping.methods;
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading settings:', error);
    }
}

async function saveSettings(type) {
    try {
        const settingsRef = db.collection('configuracion').doc('general');
        
        if (type === 'banner') {
            const bannerText = document.getElementById('bannerText')?.value;
            if (!bannerText) {
                showToast('Ingresá el texto del banner');
                return;
            }
            await settingsRef.set({
                bannerText: bannerText,
                updatedAt: new Date()
            }, { merge: true });
            showToast('✅ Banner guardado');
        } else if (type === 'hours') {
            const weekday = document.getElementById('hoursWeekday')?.value;
            const saturday = document.getElementById('hoursSaturday')?.value;
            const sunday = document.getElementById('hoursSunday')?.value;
            
            await settingsRef.set({
                hours: {
                    weekday,
                    saturday,
                    sunday
                },
                updatedAt: new Date()
            }, { merge: true });
            showToast('✅ Horarios guardados');
        } else if (type === 'shipping') {
            const productionTime = document.getElementById('productionTime')?.value;
            const shippingMethods = document.getElementById('shippingMethods')?.value;
            
            await settingsRef.set({
                shipping: {
                    productionTime,
                    methods: shippingMethods
                },
                updatedAt: new Date()
            }, { merge: true });
            showToast('✅ Información de envíos guardada');
        }
        
    } catch (error) {
        console.error('❌ Error saving settings:', error);
        showToast('Error al guardar configuración');
    }
}



document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    setupEventListeners();
});

function setupEventListeners() {
    
    // ========== LOGIN ==========
    document.getElementById('googleLoginBtn')?.addEventListener('click', signInWithGoogle);
    
    // ========== NAVIGATION ==========
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(item.dataset.section);
            
            // Close mobile menu when nav item is clicked
            const sidebar = document.querySelector('.admin-sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (window.innerWidth <= 768) {
                if (sidebar) sidebar.classList.remove('mobile-open');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
    
    // ========== LOGOUT ==========
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });
    
    // ========== MOBILE MENU ==========
    // Hamburger menu button
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            const sidebar = document.querySelector('.admin-sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.toggle('mobile-open');
            if (overlay) overlay.classList.toggle('active');
        });
    }
    
    // Sidebar overlay - close menu when clicked
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            const sidebar = document.querySelector('.admin-sidebar');
            if (sidebar) sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }
    
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
    
    // ========== WIZARD - IMAGE SLOTS (5 images) ==========
    document.querySelectorAll('.image-slot-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = parseInt(e.target.dataset.index);
            const file = e.target.files[0];
            if (!file) return;
            handleSlotImageSelect(idx, file);
            const url = await uploadImage(file);
            if (url) {
                productFormData.imagenes[idx] = url;
                updatePreview();
                showToast('Imagen subida', 'success');
            }
        });
    });

    // Dropzone click and drag for each slot
    document.querySelectorAll('.image-slot-dropzone').forEach(dz => {
        dz.addEventListener('click', () => {
            const idx = dz.dataset.index;
            document.querySelector(`.image-slot-input[data-index="${idx}"]`)?.click();
        });
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', async (e) => {
            e.preventDefault();
            dz.classList.remove('drag-over');
            const idx = parseInt(dz.dataset.index);
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleSlotImageSelect(idx, file);
                const url = await uploadImage(file);
                if (url) {
                    productFormData.imagenes[idx] = url;
                    updatePreview();
                    showToast('Imagen subida', 'success');
                }
            }
        });
    });

    // Remove image from slot
    document.addEventListener('click', (e) => {
        if (e.target?.classList?.contains('btn-remove-slot-image')) {
            removeSlotImage(parseInt(e.target.dataset.index));
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
    
    document.getElementById('saveBannerBtn')?.addEventListener('click', () => {
        saveSettings('banner');
    });
    
    document.getElementById('saveHoursBtn')?.addEventListener('click', () => {
        saveSettings('hours');
    });
    
    document.getElementById('saveShippingBtn')?.addEventListener('click', () => {
        saveSettings('shipping');
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
    
    // ========== FILTER TABS - ORDERS ==========
    document.querySelectorAll('[data-filter]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('[data-filter].active').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.dataset.filter;
            if (filter) {
                loadOrders(filter);
            }
        });
    });
    
    // ========== TESTIMONIALS ==========
    document.getElementById('addTestimonialBtn')?.addEventListener('click', openTestimonialModal);
    document.getElementById('testimonialForm')?.addEventListener('submit', saveTestimonial);
    document.getElementById('testimonialModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget || e.target.classList.contains('wizard-overlay')) {
            closeTestimonialModal();
        }
    });
    
    // ========== COUPONS ==========
    document.getElementById('addCouponBtn')?.addEventListener('click', openCouponModal);
    document.getElementById('couponForm')?.addEventListener('submit', saveCoupon);
    document.getElementById('couponType')?.addEventListener('change', updateCouponPreview);
    document.getElementById('couponValue')?.addEventListener('input', updateCouponPreview);
    document.getElementById('couponModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget || e.target.classList.contains('wizard-overlay')) {
            closeCouponModal();
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
        
        if (product.stock === 0 || product.stock === '0') {
            stockStatus = 'stock-out';
            stockText = 'Sin stock';
        } else if (product.stock !== 'ilimitado' && product.stock <= 5) {
            stockStatus = 'stock-low';
            stockText = `${product.stock} restantes`;
        }
        
        const hasDiscount = product.precio_anterior && product.precio_anterior > product.precio;
        const badgesHTML = (product.badges || []).map(badge => `
            <span class="product-badge badge-${escapeHtml(badge.toLowerCase())}">${escapeHtml(badge)}</span>
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
                <h3 class="product-name">${escapeHtml(product.nombre)}</h3>
                ${product.descripcion ? `<p class="product-description">${escapeHtml(product.descripcion)}</p>` : ''}
                <div class="product-meta">
                    <div class="product-price">
                        <span class="price-current">$${product.precio.toLocaleString('es-AR')}</span>
                        ${hasDiscount ? `<span class="price-old">$${product.precio_anterior.toLocaleString('es-AR')}</span>` : ''}
                    </div>
                    <span class="product-category">${escapeHtml(product.categoria)}</span>
                </div>
                <span class="product-stock ${stockStatus}">${escapeHtml(stockText)}</span>
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

