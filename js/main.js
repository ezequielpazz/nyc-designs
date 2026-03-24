/* ============================================
   NYC DESIGNS - JAVASCRIPT PRINCIPAL
   ============================================
   Tecnologías: JavaScript ES6+, LocalStorage
   Autor: NYC Designs
   Versión: 2.0
   
   📦 DEPLOYMENT NOTE:
   Este código se ejecuta en el navegador del cliente.
   Las URLs y configuración funcionan automáticamente en Vercel.
   Firebase carga productos desde Firestore de cualquier origen.
   ============================================ */

// ========== CONFIGURACIÓN ==========
// ⚠️ CAMBIAR ESTOS VALORES POR LOS REALES
const CONFIG = {
  WHATSAPP_NUMBER: '5491123199122',  // ← Tu número de WhatsApp
  INSTAGRAM_USER: 'newyorkcitydesigns',  // ← Tu usuario de Instagram
  EMAIL: 'newyorkcitydesigns4@gmail.com',  // ← Tu email
  STORE_NAME: 'NYC Designs'
};

// URL de la API de backend (cambiar en producción si usa otro host)
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : '/api';

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

const USE_FIREBASE = true; // Cambiar a false para usar productos estáticos


// ========== CATEGORÍAS DINÁMICAS ==========
// Categorías reales del negocio NYC Designs
const CATEGORIES = [
  { id: 'fotos-recuerdos', label: 'Fotos & Recuerdos', emoji: '📸', description: 'Polaroids, álbumes y recuerdos personalizados' },
  { id: 'decoracion', label: 'Decoración', emoji: '🖼️', description: 'Cuadros, carteles y decoración para tu hogar' },
  { id: 'tazas-vasos', label: 'Tazas & Vasos', emoji: '☕', description: 'Tazas sublimadas y vasos personalizados' },
  { id: 'accesorios', label: 'Accesorios', emoji: '👜', description: 'Totebags, llaveros y más' },
  { id: 'stickers', label: 'Stickers', emoji: '✨', description: 'Stickers para celular, notebook y más' },
  { id: 'imprimibles-plantillas', label: 'Imprimibles & Plantillas', emoji: '📄', description: 'Plantillas digitales para imprimir' },
  { id: 'fiestas-eventos', label: 'Fiestas & Eventos', emoji: '🎉', description: 'Kits de cumpleaños, decoración para fiestas' }
];

// ========== PRECIOS PARA CALCULADORA ==========
const PRICES = {
  taza: 4500,
  pack: 8900,
  calendario: 6200,
  personalizacion: 1500,
  cajaRegalo: 800,
  envio: 1800
};


// ========== GOOGLE SHEETS REMOVIDO ==========
// ✅ Ahora usamos Firebase Firestore en su lugar
// Los productos se cargan automáticamente desde la colección 'productos' en Firebase

// Estado global para paginación
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
let productsPerPage = 12;
let sheetConfig = {
  mostrar_agotados: true,
  moneda: '$',
  texto_agotado: 'Sin stock',
  texto_cargar_mas: 'Cargar más productos',
  categorias: 'tazas,regalos,calendarios,personalizados'
};

// ========== FIREBASE INITIALIZATION ==========

let firebaseDb;
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  try {
    // Firebase COMPAT API (global firebase object)
    firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.firestore();
    firebaseInitialized = true;
    
    console.log('✅ Firebase inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
    return false;
  }
}

// ========== FIREBASE COLLECTIONS FOR PUBLIC STORE ==========
let testimonialsRef = null;
let configRef = null;
let couponsRef = null;

function getFirebaseCollections() {
  if (firebaseDb && !testimonialsRef) {
    testimonialsRef = firebaseDb.collection('testimonios');
    configRef = firebaseDb.collection('configuracion');
    couponsRef = firebaseDb.collection('cupones');
  }
  return { testimonialsRef, configRef, couponsRef };
}

// ========== CARGAR PRODUCTOS DESDE FIREBASE ==========

async function loadProductsFromFirebase() {
  try {
    // Inicializar Firebase si no está listo
    if (!firebaseInitialized) {
      initializeFirebase();
    }
    
    if (!firebaseDb) {
      console.warn('⚠️ Firebase no está disponible. Usando productos estáticos.');
      return false;
    }
    
    // Obtener productos visibles ordenados por 'orden' (COMPAT API)
    const snapshot = await firebaseDb.collection('productos')
      .where('visible', '==', true)
      .orderBy('orden', 'asc')
      .get();
    
    const products = [];
    
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Transformar datos de Firebase al formato esperado
      products.push({
        id: doc.id,
        name: data.nombre,
        price: data.precio,
        old_price: data.precio_anterior || 0,
        category: data.categoria,
        description: data.descripcion,
        image1: data.imagen,
        image2: '',
        image3: '',
        stock: data.stock,
        featured: data.destacado,
        badges: data.badges || [],
        order: data.orden || 999,
        visible: data.visible,
        material: data.material || '',
        medidas: data.medidas || '',
        cuidados: data.cuidados || ''
      });
    });
    
    console.log(`✅ ${products.length} productos cargados desde Firebase`);
    return products;
    
  } catch (error) {
    console.error('❌ Error cargando productos desde Firebase:', error);
    return false;
  }
}

// ========== CARGAR CONFIGURACIÓN ==========
// Cargar configuración desde Firestore (en lugar de Google Sheets)
async function loadConfig() {
  // La configuración ahora se gestiona desde el panel de admin
  console.log('ℹ️ Configuración cargada desde valores por defecto');
  return true;
}

// ========== CARGAR TODOS LOS PRODUCTOS ==========

async function loadProducts() {
  // Intentar cargar desde Firebase si está habilitado
  if (USE_FIREBASE) {
    const products = await loadProductsFromFirebase();
    
    if (products === false) {
      if (USE_FIREBASE) {
        console.log('📦 Firebase no disponible. Usando productos estáticos...');
      }
      return false; // Usar productos estáticos del HTML
    }
    
    // Procesar y filtrar productos
    allProducts = products
      .filter(p => sheetConfig.mostrar_agotados === 'si' || (p.stock && p.stock.toLowerCase() !== 'agotado'))
      .sort((a, b) => (a.order || 999) - (b.order || 999));

    console.log(`✅ ${allProducts.length} productos cargados y filtrados`);
    return true;
  }
  
  return false; // Usar productos estáticos del HTML si Firebase no está habilitado
}

// Renderizar página de productos
function renderProductsPage(page = 1, category = 'todos', searchTerm = '') {
  const searchLower = searchTerm.toLowerCase();
  
  // Filtrar por categoría
  let filtered = category === 'todos' 
    ? allProducts 
    : allProducts.filter(p => p.category === category);

  // Filtrar por búsqueda
  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      (p.description && p.description.toLowerCase().includes(searchLower))
    );
  }

  filteredProducts = filtered;
  currentPage = Math.max(1, page);

  // Calcular paginación
  const start = (currentPage - 1) * productsPerPage;
  const end = start + productsPerPage;
  const pageProducts = filteredProducts.slice(start, end);
  const hasMore = end < filteredProducts.length;

  // Renderizar HTML
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.innerHTML = pageProducts.map(p => `
    <article class="product" data-id="${p.id}" data-name="${String(p.name).replace(/"/g, '&quot;')}" data-price="${p.price}" data-category="${p.category}">
      <div class="pimg" onclick="openProductModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        ${p.old_price && p.old_price > p.price ? `<span class="discount-badge">-${Math.round((1 - p.price/p.old_price) * 100)}%</span>` : ''}
        <img src="${p.image1}" alt="${p.name}" onerror="this.src='assets/img/logo.jpg'">
        <div class="pimg-overlay">
          <span>Ver detalles</span>
        </div>
      </div>
      <div class="pbody">
        <div class="badges">
          ${p.badges.map(b => `<span class="badge${b === 'Popular' || b === 'Nuevo' ? ' strong' : ''}">${b}</span>`).join('')}
        </div>
        <strong onclick="openProductModal(${JSON.stringify(p).replace(/"/g, '&quot;')})" style="cursor:pointer;">${p.name}</strong>
        <div class="price">
          <div>
            <strong>$${p.price.toLocaleString('es-AR')}</strong>
            ${p.old_price ? `<span style="text-decoration: line-through; font-size: 12px; color: #999;">$${p.old_price.toLocaleString('es-AR')}</span>` : ''}
          </div>
          <span>${p.stock === 'agotado' ? sheetConfig.texto_agotado : p.stock}</span>
        </div>
        <button class="btn primary add-to-cart" type="button" ${p.stock === 'agotado' ? 'disabled' : ''}>
          ${p.stock === 'agotado' ? 'Sin stock' : 'Agregar al carrito'}
        </button>
      </div>
    </article>
  `).join('');

  // Actualizar contador
  const countEl = document.getElementById('productCount');
  if (countEl) {
    const total = filteredProducts.length;
    const showing = Math.min(end, total);
    countEl.textContent = `Mostrando ${showing} de ${total} productos`;
  }

  // Mostrar/ocultar botón de cargar más
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = hasMore ? 'block' : 'none';
    loadMoreBtn.textContent = sheetConfig.texto_cargar_mas || 'Cargar más productos';
  }

  // Re-agregar event listeners a los botones
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', function() {
      const product = this.closest('.product');
      const id = product?.dataset?.id;
      const name = product?.dataset?.name;
      const price = Number(product?.dataset?.price);
      if (id && name && price) {
        addToCart(id, name, price);
      }
    });
  });
}

// Cargar más productos
function loadMoreProducts() {
  const activeFilter = document.querySelector('.filter-btn.active');
  const category = activeFilter?.dataset?.filter || 'todos';
  const searchTerm = document.getElementById('searchInput')?.value || '';
  renderProductsPage(currentPage + 1, category, searchTerm);
}


// ========== CARRITO ==========
let cart = JSON.parse(localStorage.getItem('nycCart')) || [];

function updateCartUI() {
  const cartItems = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');

  cartCount.textContent = cart.length || '';

  if (cart.length === 0) {
    cartItems.innerHTML = `<div class="cart-empty"><p>Tu carrito está vacío</p></div>`;
    cartTotal.textContent = '$0';
    return;
  }

  cartItems.innerHTML = cart.map((item, index) => {
    return `
      <div class="cart-item">
        <img src="assets/img/logo.jpg" alt="${item.name}">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <span>$${item.price.toLocaleString('es-AR')}</span>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart(${index})">×</button>
      </div>
    `;
  }).join('');

  // Calculate total with coupon discount and shipping
  const { subtotal, discount, total } = calculateCartTotal();

  // Update total display
  if (discount > 0 || shippingCost > 0) {
    let html = '';
    if (discount > 0) {
      html += `<span class="original-price">$${subtotal.toLocaleString('es-AR')}</span> `;
    }
    html += `<span class="discounted-price">$${total.toLocaleString('es-AR')}</span>`;
    if (shippingCost > 0) {
      html += `<br><small style="font-weight:400;font-size:12px;color:var(--taupe)">Envío: $${shippingCost.toLocaleString('es-AR')}</small>`;
    }
    cartTotal.innerHTML = html;
  } else {
    cartTotal.textContent = '$' + total.toLocaleString('es-AR');
  }
}

function addToCart(id, name, price) {
  cart.push({ id, name, price });
  localStorage.setItem('nycCart', JSON.stringify(cart));
  updateCartUI();
  showToast(`¡${name} agregado!`);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem('nycCart', JSON.stringify(cart));
  updateCartUI();
}

function clearCart() {
  cart = [];
  localStorage.setItem('nycCart', JSON.stringify(cart));
  updateCartUI();
}

// ========== PRODUCT MODAL ==========
let currentModalProduct = null;

function openProductModal(productData) {
  currentModalProduct = productData;
  const modal = document.getElementById('productModal');
  
  // Populate modal with product data
  document.getElementById('modalProductImage').src = productData.image1 || 'assets/img/logo.jpg';
  document.getElementById('modalProductName').textContent = productData.name;
  document.getElementById('modalProductPrice').textContent = '$' + productData.price.toLocaleString('es-AR');
  
  // Old price
  const oldPriceEl = document.getElementById('modalProductOldPrice');
  if (productData.old_price && productData.old_price > 0) {
    oldPriceEl.textContent = '$' + productData.old_price.toLocaleString('es-AR');
    oldPriceEl.style.display = 'inline';
  } else {
    oldPriceEl.style.display = 'none';
  }
  
  // Description
  document.getElementById('modalProductDescription').textContent = productData.description || 'Producto de calidad NYC Designs.';
  
  // Badges
  const badgesContainer = document.getElementById('modalProductBadges');
  if (productData.badges && productData.badges.length > 0) {
    badgesContainer.innerHTML = productData.badges.map(b => 
      `<span class="badge${b === 'Popular' || b === 'Nuevo' ? ' strong' : ''}">${b}</span>`
    ).join('');
  } else {
    badgesContainer.innerHTML = '';
  }
  
  // Material
  const materialEl = document.getElementById('detailMaterial');
  const materialValue = document.getElementById('modalProductMaterial');
  if (productData.material) {
    materialValue.textContent = productData.material;
    materialEl.style.display = 'flex';
  } else {
    materialEl.style.display = 'none';
  }
  
  // Medidas
  const medidasEl = document.getElementById('detailMedidas');
  const medidasValue = document.getElementById('modalProductMedidas');
  if (productData.medidas) {
    medidasValue.textContent = productData.medidas;
    medidasEl.style.display = 'flex';
  } else {
    medidasEl.style.display = 'none';
  }
  
  // Cuidados
  const cuidadosEl = document.getElementById('detailCuidados');
  const cuidadosValue = document.getElementById('modalProductCuidados');
  if (productData.cuidados) {
    cuidadosValue.textContent = productData.cuidados;
    cuidadosEl.style.display = 'flex';
  } else {
    cuidadosEl.style.display = 'none';
  }
  
  // Stock
  document.getElementById('modalProductStock').textContent = productData.stock || 'Disponible';
  
  // Update WhatsApp link with product name
  const whatsappBtn = document.querySelector('.product-modal-whatsapp');
  if (whatsappBtn) {
    const msg = `Hola! Quiero consultar sobre: ${productData.name}`;
    whatsappBtn.href = `https://wa.me/5491123199122?text=${encodeURIComponent(msg)}`;
  }
  
  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.classList.remove('active');
  }
  document.body.style.overflow = '';
  currentModalProduct = null;
}

// ========== LOAD TESTIMONIALS FROM FIREBASE ==========
async function loadTestimonials() {
  const container = document.querySelector('.testimonials-grid');
  if (!container) return;
  
  try {
    if (!firebaseDb) {
      initializeFirebase();
    }
    
    const { testimonialsRef: ref } = getFirebaseCollections();
    if (!ref) return;
    
    const snapshot = await ref
      .where('visible', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();
    
    if (snapshot.empty) {
      // Keep default testimonials if none in Firebase
      console.log('📝 Using default testimonials');
      return;
    }
    
    const testimonials = [];
    snapshot.forEach(doc => {
      testimonials.push(doc.data());
    });
    
    container.innerHTML = testimonials.map(t => {
      const stars = '★'.repeat(t.rating || 5);
      return `
        <div class="testimonial-card">
          <div class="testimonial-stars">${stars}</div>
          <p class="testimonial-text">"${t.text}"</p>
          <div class="testimonial-author">
            <span class="author-name">${t.name}</span>
            <span class="author-location">${t.location}</span>
          </div>
        </div>
      `;
    }).join('');
    
    console.log('✅ Testimonials loaded from Firebase');
  } catch (error) {
    console.log('⚠️ Using default testimonials:', error.message);
  }
}

// ========== LOAD ALL CONFIG FROM FIREBASE ==========
async function loadBannerConfig() {
  try {
    if (!firebaseDb) {
      initializeFirebase();
    }
    
    const { configRef: ref } = getFirebaseCollections();
    if (!ref) return;
    
    const doc = await ref.doc('general').get();
    if (!doc.exists) {
      console.log('⚠️ No config found in Firebase, using defaults');
      return;
    }
    
    const data = doc.data();
    console.log('📋 Config loaded from Firebase:', data);
    
    // ===== UPDATE BANNER TEXT =====
    if (data.bannerText) {
      const bannerSpan = document.querySelector('.announce .inner > span:not(.pill)');
      if (bannerSpan) {
        bannerSpan.textContent = data.bannerText;
      }
    }
    
    // ===== UPDATE PRODUCTION TIME EVERYWHERE =====
    if (data.shipping?.productionTime) {
      const productionTime = data.shipping.productionTime;
      
      // Banner pill
      const pill = document.querySelector('.announce .pill');
      if (pill) {
        pill.innerHTML = `<span class="dot"></span> Personalizados: ${productionTime}`;
      }
      
      // Hero mini-info
      const heroMini = document.querySelector('.mini-info .mini:nth-child(3) .v');
      if (heroMini) {
        heroMini.textContent = `Producción ${productionTime}`;
      }
      
      // FAQ - first question about production time
      const faqAnswers = document.querySelectorAll('.faq-answer p');
      faqAnswers.forEach(p => {
        if (p.textContent.includes('días hábiles')) {
          p.innerHTML = p.innerHTML.replace(/\d+[-–]\d+\s*días\s*hábiles/gi, productionTime);
        }
      });
      
      // Product cards with "X-X días" text
      document.querySelectorAll('.product .price span').forEach(span => {
        if (span.textContent.match(/\d+-\d+\s*días/i)) {
          span.textContent = productionTime;
        }
      });
    }
    
    // ===== UPDATE SHIPPING METHODS =====
    if (data.shipping?.methods) {
      const heroShipping = document.querySelector('.mini-info .mini:nth-child(2) .v');
      if (heroShipping) {
        heroShipping.textContent = data.shipping.methods;
      }
    }
    
    // ===== UPDATE HOURS IN FOOTER AND CHATBOT =====
    if (data.hours) {
      // Update footer hours if exists
      const footerHours = document.querySelector('.footer-hours');
      if (footerHours) {
        footerHours.innerHTML = `
          <p><b>Lunes a Viernes:</b> ${data.hours.weekday || '10:00 - 19:00'}</p>
          <p><b>Sábados:</b> ${data.hours.saturday || '10:00 - 14:00'}</p>
          <p><b>Domingos:</b> ${data.hours.sunday || 'Cerrado'}</p>
        `;
      }
      
      // Update chatbot knowledge
      if (typeof botKnowledge !== 'undefined') {
        const hoursText = `⏰ Atención:\n\nLunes a Viernes: ${data.hours.weekday || '10:00 - 19:00'}\nSábados: ${data.hours.saturday || '10:00 - 14:00'}\nDomingos: ${data.hours.sunday || 'Cerrado'}`;
        botKnowledge['horario'] = hoursText;
        botKnowledge['atienden'] = `⏰ Lun-Vie ${data.hours.weekday}, Sáb ${data.hours.saturday}`;
      }
    }
    
    console.log('✅ All config applied from Firebase');
    
  } catch (error) {
    console.log('⚠️ Using default config:', error.message);
  }
}

// ========== COUPON STATE AND FUNCTIONS ==========
let appliedCoupon = null;
let shippingCost = 0;

async function applyCoupon() {
  const input = document.getElementById('couponInput');
  const message = document.getElementById('couponMessage');
  const code = input.value.trim().toUpperCase();
  
  if (!code) {
    message.textContent = 'Ingresá un código';
    message.className = 'coupon-message error';
    return;
  }
  
  try {
    if (!firebaseDb) {
      initializeFirebase();
    }
    
    const { couponsRef: ref } = getFirebaseCollections();
    if (!ref) {
      message.textContent = 'Error al conectar con el servidor';
      message.className = 'coupon-message error';
      return;
    }
    
    const snapshot = await ref
      .where('code', '==', code)
      .where('active', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      message.textContent = 'Código inválido o expirado';
      message.className = 'coupon-message error';
      return;
    }
    
    const couponDoc = snapshot.docs[0];
    const coupon = couponDoc.data();
    
    // Check expiry
    if (coupon.expiry) {
      const expiryDate = coupon.expiry instanceof Date ? coupon.expiry : new Date(coupon.expiry);
      if (expiryDate < new Date()) {
        message.textContent = 'Este cupón ha expirado';
        message.className = 'coupon-message error';
        return;
      }
    }
    
    // Check max uses
    if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
      message.textContent = 'Este cupón ya no está disponible';
      message.className = 'coupon-message error';
      return;
    }
    
    // Apply coupon
    appliedCoupon = {
      id: couponDoc.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value
    };
    
    // Update UI
    message.textContent = '';
    message.className = 'coupon-message';
    input.value = '';
    
    const appliedDiv = document.getElementById('couponApplied');
    const appliedText = document.getElementById('couponAppliedText');
    const discount = coupon.type === 'percentage' ? `${coupon.value}%` : `$${coupon.value}`;
    appliedText.textContent = `${coupon.code} (-${discount})`;
    appliedDiv.style.display = 'flex';
    
    // Hide input group
    document.querySelector('.coupon-input-group').style.display = 'none';
    
    // Recalculate cart
    updateCartUI();
    showToast('¡Cupón aplicado!');
    
  } catch (error) {
    console.error('Error applying coupon:', error);
    message.textContent = 'Error al verificar cupón';
    message.className = 'coupon-message error';
  }
}

function removeCoupon() {
  appliedCoupon = null;
  
  document.getElementById('couponApplied').style.display = 'none';
  document.querySelector('.coupon-input-group').style.display = 'flex';
  document.getElementById('couponMessage').textContent = '';
  
  updateCartUI();
  showToast('Cupón removido');
}

function calculateCartTotal() {
  let subtotal = cart.reduce((sum, item) => sum + item.price, 0);
  let discount = 0;

  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      discount = Math.round(subtotal * (appliedCoupon.value / 100));
    } else {
      discount = appliedCoupon.value;
    }
  }

  return {
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount + shippingCost)
  };
}

// ========== SHIPPING CALCULATOR ==========
const SHIPPING_ZONES = {
  // CABA (1000-1029)
  '1000':2500,'1001':2500,'1002':2500,'1003':2500,'1004':2500,'1005':2500,'1006':2500,'1007':2500,'1008':2500,'1009':2500,
  '1010':2500,'1011':2500,'1012':2500,'1013':2500,'1014':2500,'1015':2500,'1016':2500,'1017':2500,'1018':2500,'1019':2500,
  '1020':2500,'1021':2500,'1022':2500,'1023':2500,'1024':2500,'1025':2500,'1026':2500,'1027':2500,'1028':2500,'1029':2500,
  // GBA Norte
  '1602':3000,'1603':3000,'1605':3000,'1606':3000,'1607':3000,'1609':3000,'1610':3000,'1611':3000,'1612':3000,'1613':3000,
  '1614':3000,'1615':3000,'1616':3000,'1617':3000,'1618':3000,'1619':3000,'1620':3000,'1621':3000,'1623':3000,'1625':3000,
  '1629':3000,'1630':3000,'1631':3000,'1632':3000,'1633':3000,'1634':3000,'1636':3000,'1638':3000,'1640':3000,'1641':3000,
  '1642':3000,'1643':3000,'1644':3000,'1645':3000,'1646':3000,'1648':3000,'1650':3000,'1651':3000,'1653':3000,'1655':3000,
  '1657':3000,'1659':3000,'1661':3000,'1663':3000,'1665':3000,
  // GBA Oeste
  '1702':3200,'1704':3200,'1706':3200,'1708':3200,'1712':3200,'1714':3200,'1716':3200,'1718':3200,'1744':3200,'1746':3200,
  '1748':3200,'1752':3200,'1754':3200,'1755':3200,'1757':3200,'1759':3200,'1763':3200,'1765':3200,'1766':3200,'1768':3200,
  // GBA Sur
  '1802':3200,'1804':3200,'1806':3200,'1822':3200,'1824':3200,'1826':3200,'1828':3200,'1832':3200,'1834':3200,'1836':3200,
  '1838':3200,'1842':3200,'1846':3200,'1852':3200,'1854':3200,'1856':3200,'1870':3200,'1871':3200,'1872':3200,'1873':3200,
  '1874':3200,'1875':3200,'1876':3200,'1878':3200,'1879':3200,'1880':3200,'1881':3200,'1882':3200,'1884':3200,'1886':3200,
  '1888':3200,'1889':3200,
  // La Plata
  '1900':3500,'1901':3500,'1902':3500,'1903':3500,'1904':3500
};

function calculateShippingCost() {
  const postalCode = document.getElementById('postalCode').value.trim();
  const resultDiv = document.getElementById('shippingResult');
  const addressSection = document.getElementById('shippingAddress');
  const priceSpan = document.getElementById('shippingPrice');

  if (!postalCode || postalCode.length !== 4) {
    resultDiv.innerHTML = '<span style="color:#e74c3c">Ingresá un código postal válido (4 dígitos)</span>';
    return;
  }

  resultDiv.innerHTML = '<span>Calculando...</span>';

  let cost = SHIPPING_ZONES[postalCode];
  if (!cost) {
    const prefix = postalCode.substring(0, 2);
    const baPrefixes = ['10','11','12','13','14','15','16','17','18','19'];
    cost = baPrefixes.includes(prefix) ? 4000 : 5500;
  }

  shippingCost = cost;
  resultDiv.innerHTML = '<span style="color:#27ae60">✓ Envío disponible</span>';
  priceSpan.textContent = `$${cost.toLocaleString('es-AR')}`;
  addressSection.style.display = 'flex';
  updateCartUI();
}

function initShipping() {
  const pickupRadio = document.querySelector('input[value="pickup"]');
  const deliveryRadio = document.querySelector('input[value="delivery"]');
  const calculator = document.getElementById('shippingCalculator');
  const addressSection = document.getElementById('shippingAddress');
  const calculateBtn = document.getElementById('calculateShipping');
  const postalInput = document.getElementById('postalCode');

  if (!pickupRadio || !deliveryRadio) return;

  pickupRadio.addEventListener('change', () => {
    calculator.style.display = 'none';
    addressSection.style.display = 'none';
    shippingCost = 0;
    document.getElementById('shippingPrice').textContent = 'Calcular';
    updateCartUI();
  });

  deliveryRadio.addEventListener('change', () => {
    calculator.style.display = 'flex';
  });

  calculateBtn.addEventListener('click', calculateShippingCost);
  postalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') calculateShippingCost();
  });

  console.log('✅ Shipping calculator initialized');
}

// Event listeners para botones de agregar al carrito
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración
  await loadConfig();
  
  // Load testimonials and banner from Firebase
  await loadTestimonials();
  await loadBannerConfig();
  
  // Coupon event listeners
  document.getElementById('applyCouponBtn')?.addEventListener('click', applyCoupon);
  document.getElementById('removeCouponBtn')?.addEventListener('click', removeCoupon);
  document.getElementById('couponInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCoupon();
    }
  });
  
  // Cargar productos desde Firebase (si está configurado) o fallback a HTML
  const productsLoaded = await loadProducts();

  if (productsLoaded) {
    // Productos cargados dinámicamente desde Firebase
    console.log('💫 Usando productos desde Firebase');
    
    // Renderizar productos dinámicos
    renderProductsPage(1, 'todos', '');
    
    // Agregar event listeners a los botones dinámicos
    document.querySelectorAll('.add-to-cart').forEach(btn => {
      btn.addEventListener('click', function() {
        const product = this.closest('.product');
        const id = product?.dataset?.id;
        const name = product?.dataset?.name;
        const price = Number(product?.dataset?.price);
        if (id && name && price) {
          addToCart(id, name, price);
        }
      });
    });
  } else {
    // Usar productos estáticos del HTML
    console.log('📦 Usando productos estáticos del HTML');
    document.querySelectorAll('.add-to-cart').forEach(btn => {
      btn.addEventListener('click', function() {
        const product = this.closest('.product') || this.closest('.pinfo');
        const id = product?.dataset?.id || this.dataset.id;
        const name = product?.dataset?.name || this.dataset.name;
        const price = Number(product?.dataset?.price || this.dataset.price);
        if (id && name && price) {
          addToCart(id, name, price);
        }
      });
    });
  }

  // Inicializar carrito
  updateCartUI();

  // generar categorías/filtros dinámicamente
  generateCategories();
  filterProducts('todos');

  // Agregar listener al selector de productos por página
  const perPageSelect = document.getElementById('productsPerPage');
  if (perPageSelect) {
    perPageSelect.addEventListener('change', (e) => {
      const newPerPage = e.target.value;
      if (newPerPage === 'all') {
        productsPerPage = filteredProducts.length || 100;
      } else {
        productsPerPage = parseInt(newPerPage);
      }
      currentPage = 1;
      const activeFilter = document.querySelector('.filter-btn.active');
      const category = activeFilter?.dataset?.filter || 'todos';
      const searchTerm = document.getElementById('searchInput')?.value || '';
      renderProductsPage(1, category, searchTerm);
    });
  }

  // Agregar listener al botón de cargar más
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreProducts);
  }

  // Personalization checkbox listener
  // Personalization Modal Handlers
  const personalizationModal = document.getElementById('personalizationModal');
  const openFormBtn = document.getElementById('openPersonalizationForm');
  const closeFormBtn = document.getElementById('closePersonalizationModal');

  if (openFormBtn) {
    openFormBtn.addEventListener('click', () => {
      personalizationModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeFormBtn) {
    closeFormBtn.addEventListener('click', () => {
      personalizationModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  // Close on overlay click
  personalizationModal?.querySelector('.modal-overlay')?.addEventListener('click', () => {
    personalizationModal.classList.remove('active');
    document.body.style.overflow = '';
  });

  // File upload counter
  const fileInput = document.getElementById('personalizationImages');
  const fileCount = document.getElementById('fileCount');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const count = fileInput.files.length;
      fileCount.textContent = count === 0 ? 'Ningún archivo seleccionado' : 
                             count === 1 ? '1 archivo seleccionado' : 
                             `${count} archivos seleccionados`;
    });
  }

  // Form submission - sends to WhatsApp with details
  const personalizationForm = document.getElementById('personalizationForm');

  if (personalizationForm) {
    personalizationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const formData = new FormData(personalizationForm);
      const nombre = formData.get('nombre');
      const telefono = formData.get('telefono');
      const producto = formData.get('producto');
      const detalles = formData.get('detalles');
      const notas = formData.get('notas');
      
      let message = `¡Hola! Ya pagué y quiero enviar los detalles de personalización:\n\n`;
      message += `👤 *Nombre:* ${nombre}\n`;
      message += `📱 *WhatsApp:* ${telefono}\n`;
      message += `📦 *Producto:* ${producto}\n\n`;
      message += `✨ *Personalización:*\n${detalles}\n`;
      if (notas) {
        message += `\n📝 *Notas:* ${notas}\n`;
      }
      message += `\n_Adjunto las imágenes por separado si las tengo._`;
      
      const whatsappUrl = `https://wa.me/5491123199122?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      // Close modal and reset form
      personalizationModal.classList.remove('active');
      document.body.style.overflow = '';
      personalizationForm.reset();
      fileCount.textContent = 'Ningún archivo seleccionado';
      
      showToast('¡Listo! Se abrió WhatsApp para enviar los detalles.');
    });
  }

  // inicializar calculadora de precios (only if exists)
  if (document.getElementById('calcProduct')) {
    updateCalc();
    ['calcProduct','calcPersonalizado','calcCaja','calcEnvio','calcCantidad'].forEach(id=>{
      document.getElementById(id)?.addEventListener('input', updateCalc);
    });
    document.getElementById('calcWhatsappBtn')?.addEventListener('click', () => {
      const qty = document.getElementById('calcCantidad').value;
      const prod = document.getElementById('calcProduct').value;
      let details = `Producto: ${prod}\nCantidad: ${qty}`;
      if(document.getElementById('calcPersonalizado').checked) details += '\n+ Personalización';
      if(document.getElementById('calcCaja').checked) details += '\n+ Caja';
      if(document.getElementById('calcEnvio').checked) details += '\n+ Envío';
      details += `\nSubtotal: $${document.getElementById('calcSubtotal').textContent}`;
      window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=Hola!%20Quiero%20consultar%20este%20pedido:%0A%0A${encodeURIComponent(details)}`, '_blank');
    });
  }

  // listeners para MercadoPago modal
  const mpModal = document.getElementById('mpModal');
  const mpClose = document.getElementById('mpClose');
  mpClose?.addEventListener('click', () => {
    mpModal?.classList.remove('active');
    document.body.style.overflow = '';
  });
  mpModal?.addEventListener('click', e => {
    if (e.target === mpModal) {
      mpModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
  document.getElementById('mpPayBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    processPayment();
  });

  // MercadoPago button (cart)
  const mpBtn = document.getElementById('mpOpenBtn');
  if (mpBtn) {
    mpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      processPayment();
    });
  }
});

// ========== PRODUCT MODAL EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', function() {
  // Close button
  const closeBtn = document.getElementById('closeProductModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeProductModal();
    });
  }

  // Overlay click to close
  const overlay = document.querySelector('.product-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      e.preventDefault();
      closeProductModal();
    });
  }

  // Add to cart from modal
  const addBtn = document.getElementById('modalAddToCart');
  if (addBtn) {
    addBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (currentModalProduct) {
        addToCart(currentModalProduct.id, currentModalProduct.name, currentModalProduct.price);
        closeProductModal();
        showToast('¡Agregado al carrito!');
      }
    });
  }

  // ESC key to close
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('productModal');
      if (modal && modal.classList.contains('active')) {
        closeProductModal();
      }
    }
  });

  console.log('✅ Product modal event listeners attached');
});

// Cart sidebar
const cartBtn = document.getElementById('cartBtn');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');

function openCart() {
  cartSidebar.classList.add('active');
  cartOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartSidebar.classList.remove('active');
  cartOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

cartBtn?.addEventListener('click', openCart);
cartOverlay?.addEventListener('click', closeCart);
cartClose?.addEventListener('click', closeCart);

// ========== COUPON LISTENERS ==========
document.getElementById('applyCouponBtn')?.addEventListener('click', applyCoupon);
document.getElementById('removeCouponBtn')?.addEventListener('click', removeCoupon);
document.getElementById('couponInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyCoupon();
  }
});

// ========== MENÚ MÓVIL ==========
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
});

mobileMenu?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
  });
});

// ========== BUSCADOR Y FILTROS ==========
const searchInput = document.getElementById('searchInput');
let filterBtns = []; // se rellenará después de generar los botones dinámicos
const products = document.querySelectorAll('.product');
const noResults = document.getElementById('noResults');

// Genera dinámicamente etiquetas, tarjetas y botones a partir del array CATEGORIES
function generateCategories() {
  const heroTagsContainer = document.getElementById('heroTags');
  const catGrid = document.getElementById('categoryGrid');
  const filterBtnContainer = document.getElementById('filterButtons');

  if (heroTagsContainer) {
    heroTagsContainer.innerHTML = CATEGORIES.map(cat =>
      `<span class="tag" data-filter="${cat.id}">${cat.label}</span>`
    ).join('');
  }

  if (catGrid) {
    catGrid.innerHTML = CATEGORIES.map(cat =>
      `<article class="cat" onclick="filterProducts('${cat.id}')">
          <div class="emoji">${cat.emoji}</div>
          <strong>${cat.label}</strong>
          <span>${cat.description}</span>
        </article>`
    ).join('');
  }

  if (filterBtnContainer) {
    let html = `<button class="filter-btn active" data-filter="todos">Todos</button>`;
    html += CATEGORIES.map(cat =>
      `<button class="filter-btn" data-filter="${cat.id}">${cat.emoji} ${cat.label}</button>`
    ).join('');
    filterBtnContainer.innerHTML = html;
  }

  // refrescar la colección de botones y agregar listeners
  filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => filterProducts(btn.dataset.filter));
  });

  // tags del hero
  document.querySelectorAll('#heroTags .tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const filter = tag.dataset.filter;
      filterProducts(filter);
      document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}


function filterProducts(category) {
  // Si estamos usando productos dinámicos de Google Sheets
  if (allProducts.length > 0) {
    const searchTerm = searchInput?.value || '';
    renderProductsPage(1, category, searchTerm);
    return;
  }

  // Fallback a filtrado estático de HTML
  let visibleCount = 0;
  const searchTerm = searchInput?.value.toLowerCase() || '';
  const products = document.querySelectorAll('.product');

  products.forEach(product => {
    const productCategory = product.dataset.category;
    const productName = product.dataset.name.toLowerCase();
    const matchesCategory = category === 'todos' || productCategory === category;
    const matchesSearch = productName.includes(searchTerm);

    if (matchesCategory && matchesSearch) {
      product.classList.remove('hidden');
      visibleCount++;
    } else {
      product.classList.add('hidden');
    }
  });

  const noResults = document.getElementById('noResults');
  if (noResults) {
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
  }

  // Update active filter button
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === category);
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => filterProducts(btn.dataset.filter));
});

searchInput?.addEventListener('input', () => {
  const activeFilter = document.querySelector('.filter-btn.active');
  filterProducts(activeFilter?.dataset.filter || 'todos');
});

// ========== LIGHTBOX ==========
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

function openLightbox(src) {
  if (lightboxImg) lightboxImg.src = src;
  lightbox?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox?.classList.remove('active');
  document.body.style.overflow = '';
}

lightbox?.addEventListener('click', (e) => { 
  if (e.target === lightbox) closeLightbox(); 
});

// ========== GALERÍA DE PRODUCTO ==========
function changeMainImg(thumb) {
  const mainImg = document.getElementById('mainImg');
  if (mainImg) {
    mainImg.src = thumb.src.replace('100', '400').replace('70', '340');
  }
  document.querySelectorAll('.thumbs img').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

// ========== FAQ ACORDEÓN ==========
document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', () => {
    const item = question.parentElement;
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
    if (!isActive) item.classList.add('active');
  });
});

// ========== TOAST MEJORADO ==========
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');

  if (toast && toastText) {
    toast.className = 'toast ' + type;
    toastText.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// ========== CALCULADORA DE PRECIO ==========
function updateCalc() {
  // Check if calculator elements exist
  const calcProduct = document.getElementById('calcProduct');
  if (!calcProduct) return; // Calculator not present, skip
  
  const prod = calcProduct.value;
  let subtotal = PRICES[prod] || 0;
  if (document.getElementById('calcPersonalizado').checked) subtotal += PRICES.personalizacion;
  if (document.getElementById('calcCaja').checked) subtotal += PRICES.caja;
  if (document.getElementById('calcEnvio').checked) subtotal += PRICES.envio;
  const qty = parseInt(document.getElementById('calcCantidad').value) || 1;
  subtotal *= qty;
  document.getElementById('calcSubtotal').textContent = subtotal.toLocaleString('es-AR');
}

// ========== ANIMACIONES DE SCROLL ==========
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ========== BOTÓN VOLVER ARRIBA ==========
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  backToTop?.classList.toggle('visible', window.scrollY > 500);
});

backToTop?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ========== FORMULARIO DE CONTACTO ==========
function handleContactForm(e) {
  e.preventDefault();
  showToast('¡Mensaje enviado! Te responderemos pronto.');
  e.target.reset();
}

// ========== TECLADO ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeCart();
    closeChatbot();
    hamburger?.classList.remove('active');
    mobileMenu?.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ========== LOADER ==========
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if (loader) {
    setTimeout(() => loader.classList.add('fade-out'), 1600);
  }
});

// ========== CHATBOT ==========
const chatbotBtn = document.getElementById('chatbotBtn');
const chatbotWindow = document.getElementById('chatbotWindow');
const chatbotClose = document.getElementById('chatbotClose');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

// Base de conocimiento del bot
const botKnowledge = {
  // Saludos
  'hola': '¡Hola! 👋 Soy el asistente de NYC Designs. ¿En qué puedo ayudarte?',
  'buenas': '¡Hola! 👋 ¿Cómo puedo ayudarte hoy?',
  'buen dia': '¡Buen día! 👋 ¿Qué necesitás saber?',
  'buenas tardes': '¡Buenas tardes! 👋 ¿En qué te puedo ayudar?',
  
  // Precios
  'precio': 'Los precios varían según el producto:\n\n☕ Tazas: desde $4.500\n🎁 Packs regalo: desde $8.900\n📅 Calendarios: desde $6.200\n\n¿Te interesa alguno en particular?',
  'cuanto sale': 'Los precios varían según el producto:\n\n☕ Tazas: desde $4.500\n🎁 Packs regalo: desde $8.900\n📅 Calendarios: desde $6.200',
  'cuanto cuesta': 'Los precios arrancan desde $4.500 para tazas. ¿Querés ver el catálogo completo?',
  
  // Envíos
  'envio': '📦 Tenemos dos opciones:\n\n1. **Retiro** en nuestro punto (gratis)\n2. **E-Pick** a domicilio (costo según zona)\n\nAl despachar te mandamos el código de seguimiento.',
  'envios': '📦 Enviamos a todo el país por E-Pick, o podés retirar gratis.',
  'retiro': '📍 Coordinamos el retiro por WhatsApp. Te pasamos dirección y horarios disponibles.',
  'domicilio': '🚚 Sí, enviamos a domicilio por E-Pick a todo el país.',
  
  // Pagos
  'pago': '💳 Aceptamos todos los medios de pago a través de MercadoPago: tarjetas de crédito, débito y transferencia bancaria. ¡Pagás 100% seguro!',
  'pagos': '💳 Pagás fácil con MercadoPago. Aceptamos tarjetas de crédito, débito y transferencia. ¡100% seguro!',
  'transferencia': '🏦 Sí, aceptamos transferencia bancaria a través de MercadoPago. ¡Fácil y seguro!',
  'mercadopago': '¡Sí! Usamos MercadoPago para todos los pagos. Podés usar tarjeta de crédito, débito o transferencia bancaria. ¡Pagás 100% seguro!',
  'medios de pago': 'Aceptamos todos los medios de pago a través de MercadoPago: tarjetas de crédito, débito y transferencia bancaria. ¡Pagás 100% seguro!',
  'como pago': 'Pagás fácil con MercadoPago. Aceptamos tarjetas de crédito, débito y transferencia. Al finalizar tu compra, te redirige automáticamente.',
  
  // Tiempo / Producción
  // NOTE: 'horario' and 'atienden' responses are updated dynamically 
  // by loadBannerConfig() when Firebase config is loaded
  'tiempo': '⏱️ Productos en stock: 1-2 días.\nPersonalizados: 3-7 días hábiles.',
  'tarda': '⏱️ Los personalizados tardan 3-7 días hábiles. Productos en stock salen más rápido.',
  'demora': '⏱️ Personalizados: 3-7 días hábiles + envío.',
  'cuando llega': '📅 Depende si es personalizado (3-7 días) + tiempo de envío según tu zona.',
  
  // Personalizados
  'personalizado': '✨ ¡Sí hacemos personalizados!\n\nPodés mandarnos:\n• Tu foto\n• Un diseño\n• Una idea\n\nY lo armamos juntos. Escribinos por WhatsApp para coordinar.',
  'personalizar': '✨ Mandanos tu idea por WhatsApp y lo armamos juntos. Podés enviar fotos, textos o diseños.',
  'foto': '📷 ¡Sí! Podés mandarnos tu foto y la sublimamos en la taza. Queda hermoso para regalar.',
  
  // Productos
  'taza': '☕ Tenemos tazas sublimadas de cerámica. Vienen con diseños NYC o las personalizamos con tu foto/texto.',
  'tazas': '☕ Nuestras tazas son de cerámica sublimada. Están en la categoría Tazas & Vasos. Desde $4.500.',
  'vasos': '🥤 También tenemos vasos personalizados. Buscalos en Tazas & Vasos.',
  'regalo': '🎁 Tenemos kits para fiestas y eventos armados con taza + caja presentación. Ideales para cumpleaños o fechas especiales.',
  'calendario': '📅 Hacemos calendarios personalizados con tus fotos. Encontralos en Imprimibles & Plantillas.',
  'stickers': '✨ Tenemos stickers para celular, notebook y más. Todos personalizables.',
  'polaroid': '📸 Los polaroids están en la sección Fotos & Recuerdos. Personalizados con tus fotos.',
  'cuadro': '🖼️ Los cuadros están en Decoración. Personalizados para tu hogar.',
  'totebag': '👜 Las totebags están en Accesorios. Personalizadas con tu diseño.',
  'cumpleanos': '🎉 Para cumpleaños tenemos la sección Fiestas & Eventos con kits completos.',
  'imprimible': '📄 Los imprimibles y plantillas digitales los encontrás en Imprimibles & Plantillas.',
  
  // Contacto
  'whatsapp': `📱 Escribinos directo: wa.me/${CONFIG.WHATSAPP_NUMBER}`,
  'instagram': `📸 Seguinos en @${CONFIG.INSTAGRAM_USER}`,
  'contacto': `📬 Podés escribirnos por:\n\n• WhatsApp: wa.me/${CONFIG.WHATSAPP_NUMBER}\n• Instagram: @${CONFIG.INSTAGRAM_USER}`,
  'telefono': `📱 Atendemos por WhatsApp: wa.me/${CONFIG.WHATSAPP_NUMBER}`,
  
  // Horarios
  'horario': '⏰ Atención:\n\nLunes a Viernes: 10:00 - 19:00\nSábados: 10:00 - 14:00',
  'atienden': '⏰ Lunes a Viernes 10-19hs, Sábados 10-14hs.',
  
  // Local
  'local': '📍 No tenemos local físico, pero sí punto de retiro. Coordinamos por WhatsApp.',
  'direccion': '📍 Te pasamos la dirección del punto de retiro cuando confirmes tu pedido.',
  'donde estan': '📍 Trabajamos con punto de retiro. Te mandamos la ubicación por WhatsApp.',
  
  // Garantía
  'garantia': '✅ Si hay algún problema con tu producto, lo resolvemos. Escribinos por WhatsApp.',
  'cambio': '🔄 Si hay algún defecto, hacemos cambio sin problema. Avisanos dentro de las 48hs de recibirlo.',
  'devolucion': '🔄 Aceptamos devoluciones por defectos de fabricación. Escribinos y lo solucionamos.',
  
  // Despedida
  'gracias': '¡De nada! 😊 Cualquier otra duda, escribime.',
  'chau': '¡Chau! 👋 Que tengas un excelente día.',
  'adios': '¡Hasta luego! 👋 Gracias por tu consulta.',
  
  // Comprar
  'comprar': '🛒 Para comprar:\n\n1. Elegí tus productos\n2. Agregalos al carrito\n3. Finalizá el pago con MercadoPago\n\n¡Es súper fácil!',
  'como compro': '🛒 Agregá productos al carrito y pagá con MercadoPago de forma segura. Si es personalizado, te contactamos después.',
  'pedir': '🛒 Podés armar tu pedido desde la tienda o escribirnos directo por WhatsApp si tenés algo específico en mente.',
  
  // Humano
  'humano': `👤 Si preferís hablar con una persona, escribinos por WhatsApp: wa.me/${CONFIG.WHATSAPP_NUMBER}`,
  'persona': `👤 Claro, te atendemos por WhatsApp: wa.me/${CONFIG.WHATSAPP_NUMBER}`,
  'operador': `👤 Te paso con atención humana: wa.me/${CONFIG.WHATSAPP_NUMBER}`
};

const defaultResponses = [
  'No estoy seguro de entender. ¿Podrías reformular tu pregunta?',
  'Mmm, no tengo esa info. ¿Querés que te pase con atención por WhatsApp?',
  'No encontré una respuesta para eso. Probá preguntando sobre precios, envíos, o productos.'
];

const quickReplies = [
  '💰 Precios',
  '🚚 Envíos', 
  '⏱️ Tiempos',
  '✨ Personalizar',
  '👤 Hablar con humano'
];

function sanitizeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}

function addMessage(text, isBot = false, showQuickReplies = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isBot ? 'bot' : 'user'}`;
  messageDiv.innerHTML = sanitizeHTML(text);
  chatMessages?.appendChild(messageDiv);

  if (showQuickReplies && isBot) {
    const quickDiv = document.createElement('div');
    quickDiv.className = 'quick-replies';
    quickReplies.forEach(reply => {
      const btn = document.createElement('button');
      btn.className = 'quick-reply';
      btn.textContent = reply;
      btn.onclick = () => sendMessage(reply);
      quickDiv.appendChild(btn);
    });
    chatMessages?.appendChild(quickDiv);
  }

  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message bot typing';
  typingDiv.id = 'typing';
  typingDiv.innerHTML = '<span></span><span></span><span></span>';
  chatMessages?.appendChild(typingDiv);
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  const typing = document.getElementById('typing');
  if (typing) typing.remove();
}

function getBotResponse(message) {
  const msg = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const [key, response] of Object.entries(botKnowledge)) {
    if (msg.includes(key)) {
      return response;
    }
  }
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

function sendMessage(text = null) {
  const message = text || chatInput?.value.trim();
  if (!message) return;

  addMessage(message, false);
  if (chatInput) chatInput.value = '';

  showTyping();

  setTimeout(() => {
    hideTyping();
    const response = getBotResponse(message);
    addMessage(response, true, message.toLowerCase().includes('hola') || message.toLowerCase().includes('buenas'));
  }, 800 + Math.random() * 700);
}

function openChatbot() {
  chatbotWindow?.classList.add('active');
  chatbotBtn?.classList.remove('has-notification');
  
  const quickRepliesEl = document.getElementById('quickReplies');
  if (quickRepliesEl) {
    quickRepliesEl.classList.add('active');
  }
  
  if (chatMessages && chatMessages.children.length === 0) {
    setTimeout(() => {
      addMessage('¡Hola! Soy NYC Designs. ¿En qué puedo ayudarte?', true, false);
    }, 500);
  }
}

function closeChatbot() {
  chatbotWindow?.classList.remove('active');
}

chatbotBtn?.addEventListener('click', () => {
  if (chatbotWindow?.classList.contains('active')) {
    closeChatbot();
  } else {
    openChatbot();
  }
});

chatbotClose?.addEventListener('click', closeChatbot);

// Quick replies listeners
const quickReplyBtns = document.querySelectorAll('.quick-reply:not(.whatsapp-btn)');
quickReplyBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const msg = btn.dataset.msg;
    if (msg) {
      if (!chatbotWindow?.classList.contains('active')) {
        openChatbot();
      }
      sendMessage(msg);
    }
  });
});
chatSend?.addEventListener('click', () => sendMessage());
chatInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// ========== EXIT POPUP ==========
let exitPopupShown = false;

function showExitPopup() {
  if (exitPopupShown) return;
  if (sessionStorage.getItem('exitPopupClosed')) return;

  const popup = document.getElementById('exitPopup');
  if (popup) {
    popup.classList.add('active');
    exitPopupShown = true;
    trackEvent('exit_intent_shown');
  }
}

function closeExitPopup() {
  const popup = document.getElementById('exitPopup');
  if (popup) {
    popup.classList.remove('active');
    sessionStorage.setItem('exitPopupClosed', 'true');
  }
}

// Detectar intención de salida (mouse sale de la ventana)
document.addEventListener('mouseout', (e) => {
  if (e.clientY <= 0 && !exitPopupShown) {
    showExitPopup();
  }
});

document.getElementById('exitPopupClose')?.addEventListener('click', closeExitPopup);
document.getElementById('exitPopup')?.addEventListener('click', (e) => {
  if (e.target.id === 'exitPopup') closeExitPopup();
});

document.getElementById('copyDiscountCode')?.addEventListener('click', () => {
  const code = document.querySelector('.discount-code')?.textContent;
  if (code) {
    navigator.clipboard.writeText(code);
    showToast('¡Código copiado!', 'success');
  }
});

// ========== CONTADOR ANIMADO ==========
function animateCounters() {
  const counters = document.querySelectorAll('.proof-number[data-target]');

  if (counters.length === 0) {
    console.warn('No counters found');
    return;
  }

  counters.forEach(counter => {
    const target = parseInt(counter.getAttribute('data-target'));
    if (!target || isNaN(target)) return;

    let hasAnimated = false;

    const runAnimation = () => {
      if (hasAnimated) return;
      hasAnimated = true;

      let current = 0;
      const increment = target / 100;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          counter.textContent = target;
          clearInterval(timer);
        } else {
          counter.textContent = Math.floor(current);
        }
      }, 20);
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        runAnimation();
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    observer.observe(counter);
  });

  console.log('✅ Counters initialized:', counters.length);
}

// ========== URGENCIA - POCAS UNIDADES ==========
function updateStockWarnings() {
  document.querySelectorAll('.product').forEach(product => {
    const stockEl = product.querySelector('.price span:last-child');
    if (stockEl) {
      const stockText = stockEl.textContent.toLowerCase();
      if (!stockText.includes('sin stock') && Math.random() < 0.3) {
        const units = Math.floor(Math.random() * 5) + 1;
        const warning = document.createElement('span');
        warning.className = 'stock-warning';
        warning.textContent = `¡Solo ${units} disponibles!`;
        stockEl.parentNode.insertBefore(warning, stockEl);
        stockEl.style.display = 'none';
      }
    }
  });
}

// ========== CUOTAS VISIBLES ==========
function addInstallments() {
  document.querySelectorAll('.product .price strong').forEach(priceEl => {
    const price = parseInt(priceEl.textContent.replace(/\D/g, ''));
    if (price >= 3000) {
      const installment = Math.floor(price / 3);
      const installmentEl = document.createElement('div');
      installmentEl.className = 'installments';
      installmentEl.innerHTML = `o <strong>3 cuotas de $${installment.toLocaleString('es-AR')}</strong>`;
      priceEl.parentNode.appendChild(installmentEl);
    }
  });
}

// ========== SKELETON LOADING ==========
function showProductSkeletons() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.innerHTML = Array(8).fill('').map(() => `
    <article class="product skeleton-product">
      <div class="skeleton" style="height: 200px;"></div>
      <div style="padding: 16px;">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton" style="height: 40px; margin-top: 12px;"></div>
      </div>
    </article>
  `).join('');
}

// ========== INICIALIZAR MEJORAS ==========
document.addEventListener('DOMContentLoaded', () => {
  initShipping();
  setTimeout(animateCounters, 300);

  setTimeout(() => {
    updateStockWarnings();
    addInstallments();
  }, 1500);
});

// ========== PAYMENT SUCCESS HANDLER ==========
function showPersonalizationSection() {
  const section = document.getElementById('personalizados');
  if (section) {
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function checkPaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('collection_status') || urlParams.get('status');

  if (status === 'approved') {
    showPersonalizationSection();
    showToast('¡Pago exitoso! Envianos los detalles de personalización.', 'success');

    // Clear cart after successful payment
    cart = [];
    localStorage.setItem('nycCart', JSON.stringify(cart));
    updateCartUI();

    // Track purchase
    const ref = urlParams.get('external_reference');
    const paymentId = urlParams.get('payment_id');
    if (ref || paymentId) {
      trackPurchase(ref || paymentId, 0);
    }

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);

  } else if (status === 'failure' || status === 'rejected') {
    showToast('El pago no se completó. Intentá de nuevo.', 'error');
  } else if (status === 'pending') {
    showToast('Tu pago está pendiente de confirmación.', 'warning');
  }
}

document.addEventListener('DOMContentLoaded', checkPaymentReturn);

// ========== ANALYTICS TRACKING ==========

function trackEvent(eventName, params = {}) {
  // Google Analytics 4
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, params);
  }

  console.log('📊 Event tracked:', eventName, params);
}

// Track add to cart
const originalAddToCart = addToCart;
addToCart = function(id, name, price) {
  trackEvent('add_to_cart', {
    currency: 'ARS',
    value: price,
    items: [{ item_id: id, item_name: name, price: price }]
  });
  return originalAddToCart.apply(this, arguments);
};

// Track begin checkout
function trackBeginCheckout() {
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  trackEvent('begin_checkout', {
    currency: 'ARS',
    value: total,
    items: cart.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: 1
    }))
  });
}

// Track purchase (call after successful payment)
function trackPurchase(orderId, total) {
  trackEvent('purchase', {
    transaction_id: orderId,
    currency: 'ARS',
    value: total,
    items: cart.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: 1
    }))
  });
}

// Track product view (in modal)
const originalOpenProductModal = openProductModal;
openProductModal = function(productData) {
  trackEvent('view_item', {
    currency: 'ARS',
    value: productData.price,
    items: [{
      item_id: productData.id,
      item_name: productData.name,
      price: productData.price,
      item_category: productData.category
    }]
  });
  return originalOpenProductModal.apply(this, arguments);
};

// Track search
function trackSearch(searchTerm) {
  if (searchTerm && searchTerm.length > 2) {
    trackEvent('search', { search_term: searchTerm });
  }
}

// Track contact form
function trackContactSubmit() {
  trackEvent('generate_lead', { lead_type: 'contact_form' });
}

// ========== MERCADOPAGO CHECKOUT MEJORADO ==========

async function processPayment() {
  if (cart.length === 0) {
    showToast('El carrito está vacío', 'error');
    return;
  }

  const payBtn = document.getElementById('mpOpenBtn');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.classList.add('loading');
  }

  try {
    trackBeginCheckout();

    const name = document.getElementById('mpName')?.value?.trim() || '';
    const email = document.getElementById('mpEmail')?.value?.trim() || '';
    const phone = document.getElementById('mpPhone')?.value?.trim() || '';

    // Build items - include shipping as line item if delivery
    const items = cart.map(item => ({
      id: String(item.id || '1'),
      title: item.name || 'Producto',
      quantity: parseInt(item.quantity) || 1,
      unit_price: parseFloat(item.price) || 0
    }));

    if (items.some(i => i.unit_price === 0)) {
      showToast('Error: algún producto no tiene precio. Revisá el carrito.', 'error');
      throw new Error('unit_price is 0 for one or more items');
    }

    if (shippingCost > 0) {
      items.push({
        id: 'shipping',
        title: 'Envío a domicilio',
        quantity: 1,
        unit_price: shippingCost
      });
    }

    const { total } = calculateCartTotal();
    const shippingType = document.querySelector('input[name="shipping"]:checked')?.value || 'pickup';

    const external_reference = JSON.stringify({
      timestamp: Date.now(),
      shipping_type: shippingType,
      postal_code: document.getElementById('postalCode')?.value || '',
      address: shippingType === 'delivery' ? {
        street: document.getElementById('addressStreet')?.value || '',
        city: document.getElementById('addressCity')?.value || '',
        province: document.getElementById('addressProvince')?.value || ''
      } : null
    });

    const response = await fetch('/api/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        payer: { name: name || 'Cliente', email, phone },
        external_reference
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.details || data.error);
    }

    if (data.init_point) {
      await saveOrderToFirebase({
        items,
        total,
        customer: { name, email, phone },
        shipping: { type: shippingType, cost: shippingCost },
        external_reference
      });
      window.location.href = data.init_point;
    } else {
      throw new Error('No se recibió URL de pago');
    }

  } catch (error) {
    console.error('Payment error:', error);
    showToast('Error al procesar el pago. Intentá de nuevo.', 'error');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.classList.remove('loading');
    }
  }
}

async function saveOrderToFirebase(orderData) {
  if (!firebaseDb) return;

  try {
    await firebaseDb.collection('pedidos').add({
      ...orderData,
      status: 'pendiente',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving order:', error);
  }
}

// ========== EXPONER FUNCIONES GLOBALES ==========
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.changeMainImg = changeMainImg;
window.removeFromCart = removeFromCart;
window.filterProducts = filterProducts;
window.handleContactForm = handleContactForm;
window.applyCoupon = applyCoupon;
window.removeCoupon = removeCoupon;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.showPersonalizationSection = showPersonalizationSection;
window.showExitPopup = showExitPopup;
window.closeExitPopup = closeExitPopup;
window.showToast = showToast;
window.showProductSkeletons = showProductSkeletons;
window.trackBeginCheckout = trackBeginCheckout;
window.trackPurchase = trackPurchase;
window.trackSearch = trackSearch;
window.trackContactSubmit = trackContactSubmit;
window.processPayment = processPayment;
window.calculateShippingCost = calculateShippingCost;
