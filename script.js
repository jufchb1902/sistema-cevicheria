// Variables globales
let currentUser = null;
let cart = {};
let currentOrderToClose = null;
let allProducts = [];           // todos los productos cargados (real o mock)
let activeCategory = 'Todos';   // categoría seleccionada en la pantalla de pedido
let pendingOrdersCache = [];    // último listado de pedidos pendientes obtenido
let currentYapePhotoBase64 = null; // foto comprimida lista para enviar

// Elementos del DOM
const loginScreen = document.getElementById('loginScreen');
const orderScreen = document.getElementById('orderScreen');
const confirmScreen = document.getElementById('confirmScreen');
const closeOrdersScreen = document.getElementById('closeOrdersScreen');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const closeOrdersBtn = document.getElementById('closeOrdersBtn');
const backToOrdersBtn = document.getElementById('backToOrdersBtn');
const productList = document.getElementById('productList');
const categoryChips = document.getElementById('categoryChips');
const orderSummary = document.getElementById('orderSummary');
const totalAmount = document.getElementById('totalAmount');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const orderNumber = document.getElementById('orderNumber');
const newOrderBtn = document.getElementById('newOrderBtn');
const pendingOrdersList = document.getElementById('pendingOrdersList');
const historyBtn = document.getElementById('historyBtn');
const backFromHistoryBtn = document.getElementById('backFromHistoryBtn');
const closedOrdersList = document.getElementById('closedOrdersList');
const paymentModal = document.getElementById('paymentModal');
const closeModal = document.getElementById('closeModal');
const cancelPayment = document.getElementById('cancelPayment');
const confirmPayment = document.getElementById('confirmPayment');
const yapePhotoSection = document.getElementById('yapePhotoSection');
const yapePhoto = document.getElementById('yapePhoto');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    showScreen('loginScreen');
    initializeSystem();

    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    closeOrdersBtn.addEventListener('click', showCloseOrdersScreen);
    backToOrdersBtn.addEventListener('click', () => showScreen('orderScreen'));
    placeOrderBtn.addEventListener('click', handlePlaceOrder);
    newOrderBtn.addEventListener('click', handleNewOrder);

    // Modal event listeners
    closeModal.addEventListener('click', closePaymentModal);
    cancelPayment.addEventListener('click', closePaymentModal);
    confirmPayment.addEventListener('click', handleConfirmPayment);

    // Historial
    if (historyBtn) historyBtn.addEventListener('click', showHistoryScreen);
    if (backFromHistoryBtn) backFromHistoryBtn.addEventListener('click', () => showScreen('orderScreen'));

    // Payment method listeners
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', handlePaymentMethodChange);
    });

    // Photo upload listener
    yapePhoto.addEventListener('change', handlePhotoUpload);

    // Listener para tipo de cliente
    document.querySelectorAll('input[name="clientType"]').forEach(radio => {
        radio.addEventListener('change', updateOrderButton);
    });
});

// Inicializar sistema
async function initializeSystem() {
    if (!CONFIG.USE_MOCK_DATA) {
        const initialized = await window.googleSheetsSecureClient.initialize();
        if (!initialized) {
            console.warn('No se pudo inicializar Google Sheets seguro, usando datos mock');
            CONFIG.USE_MOCK_DATA = true;
        }
    }

    loadProducts();
}

// Manejo de pantallas
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Manejo de login
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const submitBtn = loginForm.querySelector('button');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="loading"></span> Verificando...';
    submitBtn.disabled = true;

    try {
        const isValidUser = await validateUser(username, password);

        if (isValidUser) {
            currentUser = username;
            showScreen('orderScreen');
            resetCart();
        } else {
            showError('Usuario o contraseña incorrectos');
        }
    } catch (error) {
        console.error('Error en login:', error);
        showError('Error al verificar usuario. Intente nuevamente.');
    }

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
}

// Validación de usuario
async function validateUser(username, password) {
    if (CONFIG.USE_MOCK_DATA) {
        return CONFIG.MOCK_DATA.usuarios.some(user =>
            user.usuario === username && user.password === password
        );
    } else {
        try {
            const users = await window.googleSheetsSecureClient.getUsers();
            return users.some(user =>
                user.usuario === username && user.password === password
            );
        } catch (error) {
            console.error('Error validando usuario con Google Sheets seguro:', error);
            showError('Error conectando con Google Sheets. Usando datos locales.');
            CONFIG.USE_MOCK_DATA = true;
            return CONFIG.MOCK_DATA.usuarios.some(user =>
                user.usuario === username && user.password === password
            );
        }
    }
}

// =================== PRODUCTOS Y CATEGORÍAS ===================

// Cargar productos
async function loadProducts() {
    let products = [];

    if (CONFIG.USE_MOCK_DATA) {
        products = CONFIG.MOCK_DATA.productos;
    } else {
        try {
            products = await window.googleSheetsSecureClient.getProducts();
        } catch (error) {
            console.error('Error cargando productos desde Google Sheets seguro:', error);
            showError('Error cargando productos. Usando datos locales.');
            products = CONFIG.MOCK_DATA.productos;
        }
    }

    allProducts = products;
    activeCategory = 'Todos';
    renderCategoryChips();
    renderProductList();
}

// Construir los chips de categoría a partir de los productos cargados
function renderCategoryChips() {
    const categories = ['Todos', ...new Set(allProducts.map(p => p.categoria || 'General'))];

    categoryChips.innerHTML = categories.map(cat => `
        <button type="button" class="chip ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">
            ${cat}
        </button>
    `).join('');

    categoryChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            activeCategory = chip.dataset.category;
            renderCategoryChips();
            renderProductList();
        });
    });
}

// Renderizar la lista de productos según la categoría activa
function renderProductList() {
    const filtered = activeCategory === 'Todos'
        ? allProducts
        : allProducts.filter(p => (p.categoria || 'General') === activeCategory);

    if (filtered.length === 0) {
        productList.innerHTML = '<p class="empty-cart">No hay productos en esta categoría</p>';
        return;
    }

    if (activeCategory !== 'Todos') {
        productList.innerHTML = filtered.map(p => createProductElement(p)).join('');
        return;
    }

    // Vista "Todos": agrupado por categoría con subtítulos
    const byCategory = {};
    filtered.forEach(p => {
        const cat = p.categoria || 'General';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(p);
    });

    productList.innerHTML = Object.keys(byCategory).map(cat => `
        <div class="category-group">
            <h4 class="category-group-title">${cat}</h4>
            <div class="category-group-items">
                ${byCategory[cat].map(p => createProductElement(p)).join('')}
            </div>
        </div>
    `).join('');
}

// Crear HTML de un producto
function createProductElement(product) {
    const qty = cart[product.id] ? cart[product.id].quantity : 0;

    return `
        <div class="product-item">
            <div class="product-header">
                <span class="product-name">${product.nombre}</span>
                <span class="product-price">S/ ${product.precio.toFixed(2)}</span>
            </div>
            <div class="quantity-controls">
                <button type="button" class="quantity-btn" onclick="updateQuantity(${product.id}, -1)">-</button>
                <span class="quantity-display" id="qty-${product.id}">${qty}</span>
                <button type="button" class="quantity-btn" onclick="updateQuantity(${product.id}, 1)">+</button>
            </div>
        </div>
    `;
}

// Actualizar cantidad de producto
function updateQuantity(productId, change) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const currentQty = cart[productId] ? cart[productId].quantity : 0;
    const newQty = Math.max(0, currentQty + change);

    if (newQty === 0) {
        delete cart[productId];
    } else {
        cart[productId] = {
            product: product,
            quantity: newQty,
            subtotal: product.precio * newQty
        };
    }

    const qtyDisplay = document.getElementById(`qty-${productId}`);
    if (qtyDisplay) qtyDisplay.textContent = newQty;

    updateOrderSummary();
    updateOrderButton();
}

// Actualizar resumen del pedido
function updateOrderSummary() {
    const cartItems = Object.values(cart);

    if (cartItems.length === 0) {
        orderSummary.innerHTML = '<p class="empty-cart">No hay productos seleccionados</p>';
        totalAmount.textContent = '0.00';
        return;
    }

    let html = '';
    let total = 0;

    cartItems.forEach(item => {
        html += `
            <div class="summary-item">
                <div>
                    <div class="summary-item-name">${item.product.nombre}</div>
                    <div class="summary-item-details">${item.quantity} x S/ ${item.product.precio.toFixed(2)}</div>
                </div>
                <div>S/ ${item.subtotal.toFixed(2)}</div>
            </div>
        `;
        total += item.subtotal;
    });

    orderSummary.innerHTML = html;
    totalAmount.textContent = total.toFixed(2);
}

// Actualizar estado del botón de pedido
function updateOrderButton() {
    const hasItems = Object.keys(cart).length > 0;
    const hasClientType = document.querySelector('input[name="clientType"]:checked');

    placeOrderBtn.disabled = !hasItems || !hasClientType;
}

// Realizar pedido
async function handlePlaceOrder() {
    const clientType = document.querySelector('input[name="clientType"]:checked').value;
    const cartItems = Object.values(cart);

    if (cartItems.length === 0) {
        showError('Debe seleccionar al menos un producto');
        return;
    }

    placeOrderBtn.innerHTML = '<span class="loading"></span> Procesando...';
    placeOrderBtn.disabled = true;

    try {
        const orderData = {
            orderNumber: generateOrderNumber(),
            clientType: clientType,
            user: currentUser,
            items: cartItems,
            total: cartItems.reduce((sum, item) => sum + item.subtotal, 0),
            datetime: getCurrentDateTime(),
            status: 'Preparando'
        };

        await saveOrderToExcel(orderData);

        document.getElementById('orderNumber').textContent = orderData.orderNumber;
        showScreen('confirmScreen');

    } catch (error) {
        console.error('Error al procesar pedido:', error);
        showError('Error al procesar el pedido. Intente nuevamente.');
        placeOrderBtn.textContent = 'Hacer Pedido';
        placeOrderBtn.disabled = false;
    }
}

// Guardar pedido en Excel
async function saveOrderToExcel(orderData) {
    if (CONFIG.USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.push(orderData);
        localStorage.setItem('orders', JSON.stringify(orders));

        console.log('Pedido guardado localmente:', orderData);
    } else {
        try {
            await window.googleSheetsSecureClient.saveOrderComplete(orderData);
            console.log('Pedido guardado de forma segura en Google Sheets:', orderData);

            // Respaldo local
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders.push(orderData);
            localStorage.setItem('orders', JSON.stringify(orders));

        } catch (error) {
            console.error('Error guardando en Google Sheets seguro:', error);
            showError('Error guardando en Google Sheets. Guardado localmente como respaldo.');

            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders.push(orderData);
            localStorage.setItem('orders', JSON.stringify(orders));
        }
    }
}

// Nuevo pedido
function handleNewOrder() {
    resetCart();
    showScreen('orderScreen');
}

// Logout
function handleLogout() {
    currentUser = null;
    resetCart();
    loginForm.reset();
    showScreen('loginScreen');
}

// Reset carrito
function resetCart() {
    cart = {};
    activeCategory = 'Todos';

    document.querySelectorAll('input[name="clientType"]').forEach(radio => {
        radio.checked = false;
    });

    renderCategoryChips();
    renderProductList();
    updateOrderSummary();
    updateOrderButton();

    placeOrderBtn.textContent = 'Hacer Pedido';
}

// Mostrar error
function showError(message) {
    const existingError = document.querySelector('.error');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;

    const activeScreen = document.querySelector('.screen.active');
    const container = activeScreen.querySelector('.container');
    container.insertBefore(errorDiv, container.firstChild);

    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// =================== FUNCIONES PARA CERRAR PEDIDOS ===================

// Mostrar pantalla de cerrar pedidos
function showCloseOrdersScreen() {
    showScreen('closeOrdersScreen');
    loadPendingOrders();
}

// Cargar pedidos pendientes (desde Google Sheets, visibles desde cualquier dispositivo)
async function loadPendingOrders() {
    pendingOrdersList.innerHTML = '<p class="empty-cart">Cargando pedidos...</p>';

    let orders = [];

    if (CONFIG.USE_MOCK_DATA) {
        orders = JSON.parse(localStorage.getItem('orders') || '[]')
            .filter(order => order.status === 'Preparando');
    } else {
        try {
            const remoteOrders = await window.googleSheetsSecureClient.getPendingOrders();
            orders = remoteOrders.map(o => ({
                orderNumber: o.orderNumber,
                clientType: o.clientType,
                user: o.user,
                status: o.status,
                total: parseFloat(o.total) || 0,
                datetime: { date: o.date, time: o.time },
                items: (o.items || []).map(it => ({
                    product: {
                        nombre: it.productName,
                        precio: parseFloat(it.unitPrice) || 0
                    },
                    quantity: parseFloat(it.quantity) || 0,
                    subtotal: parseFloat(it.subtotal) || 0
                }))
            }));
        } catch (error) {
            console.error('Error obteniendo pedidos pendientes de Google Sheets:', error);
            showError('No se pudo conectar con Google Sheets. Mostrando pedidos locales.');
            orders = JSON.parse(localStorage.getItem('orders') || '[]')
                .filter(order => order.status === 'Preparando');
        }
    }

    pendingOrdersCache = orders;

    if (orders.length === 0) {
        pendingOrdersList.innerHTML = `
            <div class="empty-orders">
                <h3>Sin pendientes</h3>
                <p>No hay pedidos pendientes por cerrar</p>
            </div>
        `;
        return;
    }

    pendingOrdersList.innerHTML = orders.map(order => createOrderCard(order)).join('');
}

// Crear tarjeta de pedido (estilo ticket)
function createOrderCard(order) {
    const itemsHtml = order.items.map(item => `
        <div class="order-item">
            <span>${item.quantity}x ${item.product ? item.product.nombre : 'Producto'}</span>
            <span>S/ ${(item.subtotal || 0).toFixed(2)}</span>
        </div>
    `).join('');

    return `
        <div class="order-card preparing">
            <div class="order-header">
                <span class="order-number">${order.orderNumber}</span>
                <span class="order-status">${order.status}</span>
            </div>

            <div class="order-info">
                <div class="order-info-row">
                    <span class="order-info-label">Cliente</span>
                    <span>${getClientTypeLabel(order.clientType)}</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Mesero</span>
                    <span>${order.user}</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Hora</span>
                    <span>${order.datetime.time}</span>
                </div>
            </div>

            <div class="order-items">
                ${itemsHtml}
            </div>

            <div class="order-total">
                Total: S/ ${order.total.toFixed(2)}
            </div>

            <button class="close-order-btn" onclick="openPaymentModal('${order.orderNumber}')">
                Cerrar Pedido
            </button>
        </div>
    `;
}

// =================== HISTORIAL (Pedidos Cerrados) ===================

// Mostrar pantalla de historial
function showHistoryScreen() {
    showScreen('historyScreen');
    loadClosedOrders();
}

// Cargar pedidos cerrados
async function loadClosedOrders() {
    closedOrdersList.innerHTML = '<p class="empty-cart">Cargando historial...</p>';

    let orders = [];

    if (CONFIG.USE_MOCK_DATA) {
        orders = JSON.parse(localStorage.getItem('orders') || '[]')
            .filter(order => order.status === 'Cerrado');
    } else {
        try {
            // Llamamos al endpoint específico que devuelve pedidos cerrados.
            const remote = await window.googleSheetsSecureClient.getClosedOrders();
            // remote ya debe venir como array de pedidos cerrados.
            orders = remote || [];
        } catch (error) {
            console.error('Error obteniendo historial desde Google Sheets:', error);
            showError('No se pudo conectar con Google Sheets. Mostrando historial local.');
            orders = JSON.parse(localStorage.getItem('orders') || '[]')
                .filter(order => order.status === 'Cerrado');
        }
    }

    if (!orders || orders.length === 0) {
        closedOrdersList.innerHTML = `
            <div class="empty-orders">
                <h3>Sin registros</h3>
                <p>No hay pedidos cerrados aún</p>
            </div>
        `;
        return;
    }

    closedOrdersList.innerHTML = orders.map(order => createClosedOrderCard(order)).join('');
}

// Crear tarjeta para pedido cerrado (mostrar info y comprobante si existe)
function createClosedOrderCard(order) {
    const itemsHtml = (order.items || []).map(item => `
        <div class="order-item">
            <span>${item.quantity}x ${item.product ? item.product.nombre : 'Producto'}</span>
            <span>S/ ${(item.subtotal || 0).toFixed(2)}</span>
        </div>
    `).join('');

    const closedInfo = order.closedAt ? `${order.closedAt.date || ''} ${order.closedAt.time || ''}` : (order.closedAt || '');

    return `
        <div class="order-card closed">
            <div class="order-header">
                <span class="order-number">${order.orderNumber}</span>
                <span class="order-status">Cerrado</span>
            </div>

            <div class="order-info">
                <div class="order-info-row">
                    <span class="order-info-label">Cliente</span>
                    <span>${getClientTypeLabel(order.clientType)}</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Mesero</span>
                    <span>${order.user || order.closedBy || ''}</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Cerrado</span>
                    <span>${closedInfo}</span>
                </div>
            </div>

            <div class="order-items">
                ${itemsHtml}
            </div>

            <div class="order-total">
                Total: S/ ${((order.total)||0).toFixed(2)}
            </div>

            ${order.hasYapePhoto ? `<div class="photo-preview"><img src="${order.yapePhoto || ''}" alt="Comprobante"/></div>` : ''}
        </div>
    `;
}

// Obtener etiqueta del tipo de cliente
function getClientTypeLabel(clientType) {
    const labels = {
        'mesa': 'Mesa',
        'varios_llevar': 'Varios Llevar',
        'puesto_mercado': 'Puesto Mercado'
    };
    return labels[clientType] || clientType;
}

// Abrir modal de pago
function openPaymentModal(orderNumber) {
    const order = pendingOrdersCache.find(o => o.orderNumber === orderNumber);

    if (!order) {
        showError('Pedido no encontrado');
        return;
    }

    currentOrderToClose = order;
    currentYapePhotoBase64 = null;

    const orderDetails = document.getElementById('orderDetails');
    const itemsHtml = order.items.map(item => `
        <div class="order-item">
            <span>${item.quantity}x ${item.product ? item.product.nombre : 'Producto'}</span>
            <span>S/ ${(item.subtotal || 0).toFixed(2)}</span>
        </div>
    `).join('');

    orderDetails.innerHTML = `
        <h4>Pedido: ${order.orderNumber}</h4>
        <div class="order-info-row">
            <span class="order-info-label">Cliente:</span>
            <span>${getClientTypeLabel(order.clientType)}</span>
        </div>
        <div class="order-info-row">
            <span class="order-info-label">Mesero:</span>
            <span>${order.user}</span>
        </div>
        <hr class="ticket-divider">
        ${itemsHtml}
        <hr class="ticket-divider">
        <div class="order-details-total">
            Total: S/ ${order.total.toFixed(2)}
        </div>
    `;

    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.checked = false;
    });
    yapePhotoSection.style.display = 'none';
    confirmPayment.disabled = true;
    document.getElementById('photoPreview').innerHTML = '';
    yapePhoto.value = '';

    paymentModal.classList.add('active');
}

// Cerrar modal de pago
function closePaymentModal() {
    paymentModal.classList.remove('active');
    currentOrderToClose = null;
    currentYapePhotoBase64 = null;
}

// Manejar cambio de método de pago
function handlePaymentMethodChange(e) {
    const method = e.target.value;

    if (method === 'yape') {
        yapePhotoSection.style.display = 'block';
        updateConfirmButton();
    } else if (method === 'efectivo') {
        yapePhotoSection.style.display = 'none';
        confirmPayment.disabled = false;
    }
}

// Manejar subida de foto: la comprime antes de guardarla, para que el envío
// sea rápido y liviano (las fotos de cámara pueden pesar varios MB).
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const photoPreview = document.getElementById('photoPreview');
    photoPreview.innerHTML = '<p>Procesando foto...</p>';

    const reader = new FileReader();
    reader.onload = function(ev) {
        const img = new Image();
        img.onload = function() {
            const maxWidth = 1000;
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            currentYapePhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);

            photoPreview.innerHTML = `
                <img src="${currentYapePhotoBase64}" alt="Comprobante Yape">
                <p class="photo-ok">Foto cargada correctamente</p>
            `;
            updateConfirmButton();
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

// Actualizar estado del botón confirmar
function updateConfirmButton() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked');

    if (!selectedMethod) {
        confirmPayment.disabled = true;
        return;
    }

    if (selectedMethod.value === 'efectivo') {
        confirmPayment.disabled = false;
    } else if (selectedMethod.value === 'yape') {
        confirmPayment.disabled = !currentYapePhotoBase64;
    }
}

// Confirmar pago y cerrar pedido
async function handleConfirmPayment() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked');

    if (!selectedMethod || !currentOrderToClose) {
        showError('Error en el proceso de pago');
        return;
    }

    confirmPayment.innerHTML = '<span class="loading"></span> Cerrando...';
    confirmPayment.disabled = true;

    try {
        const paymentData = {
            orderNumber: currentOrderToClose.orderNumber,
            paymentMethod: selectedMethod.value,
            closedBy: currentUser,
            closedAt: getCurrentDateTime(),
            hasPhoto: selectedMethod.value === 'yape' && !!currentYapePhotoBase64
        };

        // Respaldo local
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const orderIndex = orders.findIndex(o => o.orderNumber === currentOrderToClose.orderNumber);
        if (orderIndex !== -1) {
            orders[orderIndex] = {
                ...orders[orderIndex],
                status: 'Cerrado',
                paymentMethod: selectedMethod.value,
                closedBy: currentUser,
                closedAt: paymentData.closedAt,
                hasYapePhoto: paymentData.hasPhoto
            };
            localStorage.setItem('orders', JSON.stringify(orders));
        }

        await savePaymentToExcel(paymentData);

        // Si hay foto, se manda en segundo plano (no bloquea el cierre)
        if (paymentData.hasPhoto && currentYapePhotoBase64 && !CONFIG.USE_MOCK_DATA) {
            window.googleSheetsSecureClient.uploadYapePhoto(
                currentOrderToClose.orderNumber,
                currentYapePhotoBase64
            );
        }

        closePaymentModal();
        loadPendingOrders();

        showSuccessMessage(`Pedido ${paymentData.orderNumber} cerrado exitosamente`);

    } catch (error) {
        console.error('Error al cerrar pedido:', error);
        showError('Error al cerrar el pedido. Intente nuevamente.');
        confirmPayment.textContent = 'Cerrar Pedido';
        confirmPayment.disabled = false;
    }
}

// Guardar cierre de pago en Excel
async function savePaymentToExcel(paymentData) {
    if (CONFIG.USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log('Pago registrado localmente:', paymentData);
    } else {
        try {
            const orderToClose = {
                orderNumber: paymentData.orderNumber,
                paymentMethod: paymentData.paymentMethod,
                closedBy: paymentData.closedBy,
                closedAt: paymentData.closedAt,
                hasYapePhoto: paymentData.hasPhoto
            };

            await window.googleSheetsSecureClient.closeOrder(orderToClose);
            console.log('Pago registrado de forma segura en Google Sheets:', paymentData);
        } catch (error) {
            console.error('Error guardando pago en Google Sheets seguro:', error);
            showError('Error guardando pago en Google Sheets. Registrado localmente.');
        }
    }
}

// Mostrar mensaje de éxito
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;

    const container = closeOrdersScreen.querySelector('.container');
    container.insertBefore(successDiv, container.firstChild);

    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}
