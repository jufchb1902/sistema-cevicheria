// Variables globales
let currentUser = null;
let cart = {};
let orderCounter = 1;
let currentOrderToClose = null;

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
const orderSummary = document.getElementById('orderSummary');
const totalAmount = document.getElementById('totalAmount');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const orderNumber = document.getElementById('orderNumber');
const newOrderBtn = document.getElementById('newOrderBtn');
const pendingOrdersList = document.getElementById('pendingOrdersList');
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
        // Inicializar Google Sheets Seguro
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
    
    // Mostrar loading
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
    
    // Restaurar botón
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
}

// Validación de usuario
async function validateUser(username, password) {
    if (CONFIG.USE_MOCK_DATA) {
        // Usar datos de ejemplo
        return CONFIG.MOCK_DATA.usuarios.some(user => 
            user.usuario === username && user.password === password
        );
    } else {
        // Usar Google Sheets Seguro
        try {
            // Obtener usuarios del Google Sheets de forma segura
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
    
    productList.innerHTML = '';
    
    products.forEach(product => {
        const productElement = createProductElement(product);
        productList.appendChild(productElement);
    });
}

// Crear elemento de producto
function createProductElement(product) {
    const div = document.createElement('div');
    div.className = 'product-item';
    
    div.innerHTML = `
        <div class="product-header">
            <span class="product-name">${product.nombre}</span>
            <span class="product-price">S/ ${product.precio.toFixed(2)}</span>
        </div>
        <div class="quantity-controls">
            <button type="button" class="quantity-btn" onclick="updateQuantity(${product.id}, -1)">-</button>
            <span class="quantity-display" id="qty-${product.id}">0</span>
            <button type="button" class="quantity-btn" onclick="updateQuantity(${product.id}, 1)">+</button>
        </div>
    `;
    
    return div;
}

// Actualizar cantidad de producto
function updateQuantity(productId, change) {
    const product = CONFIG.MOCK_DATA.productos.find(p => p.id === productId);
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
    
    // Actualizar display
    document.getElementById(`qty-${productId}`).textContent = newQty;
    
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
    
    // Mostrar loading
    placeOrderBtn.innerHTML = '<span class="loading"></span> Procesando...';
    placeOrderBtn.disabled = true;
    
    try {
        // Generar datos del pedido
        const orderData = {
            orderNumber: generateOrderNumber(),
            clientType: clientType,
            user: currentUser,
            items: cartItems,
            total: cartItems.reduce((sum, item) => sum + item.subtotal, 0),
            datetime: getCurrentDateTime(),
            status: 'Preparando'
        };
        
        // Guardar en "Excel" (simular por ahora)
        await saveOrderToExcel(orderData);
        
        // Mostrar confirmación
        document.getElementById('orderNumber').textContent = orderData.orderNumber;
        showScreen('confirmScreen');
        
    } catch (error) {
        console.error('Error al procesar pedido:', error);
        showError('Error al procesar el pedido. Intente nuevamente.');
        placeOrderBtn.textContent = 'Hacer Pedido';
        placeOrderBtn.disabled = false;
    }
}

// Simular guardado en Excel
async function saveOrderToExcel(orderData) {
    if (CONFIG.USE_MOCK_DATA) {
        // Simular delay de guardado
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Guardar en localStorage para demostración
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.push(orderData);
        localStorage.setItem('orders', JSON.stringify(orders));
        
        console.log('Pedido guardado localmente:', orderData);
    } else {
        // Guardar en Google Sheets de forma SEGURA
        try {
            // Guardar todo el pedido de una vez (más eficiente y seguro)
            await window.googleSheetsSecureClient.saveOrderComplete(orderData);
            
            console.log('Pedido guardado de forma segura en Google Sheets:', orderData);
            
            // También guardar localmente como respaldo
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders.push(orderData);
            localStorage.setItem('orders', JSON.stringify(orders));
            
        } catch (error) {
            console.error('Error guardando en Google Sheets seguro:', error);
            showError('Error guardando en Google Sheets. Guardado localmente como respaldo.');
            
            // Guardar localmente como respaldo
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders.push(orderData);
            localStorage.setItem('orders', JSON.stringify(orders));
        }
    }
    
    // Logs para debugging
    console.log('Datos para hoja Cabecera:', {
        numeroPedido: orderData.orderNumber,
        tipoCliente: orderData.clientType,
        usuario: orderData.user,
        fecha: orderData.datetime.date,
        hora: orderData.datetime.time,
        total: orderData.total,
        estado: orderData.status
    });
    
    console.log('Datos para hoja Detalle:', orderData.items.map(item => ({
        numeroPedido: orderData.orderNumber,
        producto: item.product.nombre,
        cantidad: item.quantity,
        precioUnitario: item.product.precio,
        subtotal: item.subtotal
    })));
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
    
    // Reset quantities display
    document.querySelectorAll('.quantity-display').forEach(display => {
        display.textContent = '0';
    });
    
    // Reset client type
    document.querySelectorAll('input[name="clientType"]').forEach(radio => {
        radio.checked = false;
    });
    
    updateOrderSummary();
    updateOrderButton();
    
    // Reset order button text
    placeOrderBtn.textContent = 'Hacer Pedido';
}

// Mostrar error
function showError(message) {
    // Remover errores anteriores
    const existingError = document.querySelector('.error');
    if (existingError) {
        existingError.remove();
    }
    
    // Crear nuevo mensaje de error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    // Agregar al formulario activo
    const activeScreen = document.querySelector('.screen.active');
    const container = activeScreen.querySelector('.container');
    container.insertBefore(errorDiv, container.firstChild);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Función para exportar datos (para debugging)
function exportOrdersToConsole() {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    console.log('Todos los pedidos:', orders);
    
    // Formato para copiar a Excel
    console.log('=== DATOS PARA HOJA CABECERA ===');
    console.log('Número Pedido\tTipo Cliente\tUsuario\tFecha\tHora\tTotal\tEstado');
    orders.forEach(order => {
        console.log(`${order.orderNumber}\t${order.clientType}\t${order.user}\t${order.datetime.date}\t${order.datetime.time}\t${order.total}\t${order.status}`);
    });
    
    console.log('\n=== DATOS PARA HOJA DETALLE ===');
    console.log('Número Pedido\tProducto\tCantidad\tPrecio Unitario\tSubtotal');
    orders.forEach(order => {
        order.items.forEach(item => {
            console.log(`${order.orderNumber}\t${item.product.nombre}\t${item.quantity}\t${item.product.precio}\t${item.subtotal}`);
        });
    });
}

// =================== FUNCIONES PARA CERRAR PEDIDOS ===================

// Mostrar pantalla de cerrar pedidos
function showCloseOrdersScreen() {
    showScreen('closeOrdersScreen');
    loadPendingOrders();
}

// Cargar pedidos pendientes
function loadPendingOrders() {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const pendingOrders = orders.filter(order => order.status === 'Preparando');
    
    if (pendingOrders.length === 0) {
        pendingOrdersList.innerHTML = `
            <div class="empty-orders">
                <h3>🎉 ¡Excelente!</h3>
                <p>No hay pedidos pendientes por cerrar</p>
            </div>
        `;
        return;
    }
    
    pendingOrdersList.innerHTML = '';
    
    pendingOrders.forEach(order => {
        const orderElement = createOrderCard(order);
        pendingOrdersList.appendChild(orderElement);
    });
}

// Crear tarjeta de pedido
function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-card preparing';
    
    const itemsHtml = order.items.map(item => `
        <div class="order-item">
            <span>${item.quantity}x ${item.product.nombre}</span>
            <span>S/ ${item.subtotal.toFixed(2)}</span>
        </div>
    `).join('');
    
    div.innerHTML = `
        <div class="order-header">
            <span class="order-number">${order.orderNumber}</span>
            <span class="order-status">${order.status}</span>
        </div>
        
        <div class="order-info">
            <div class="order-info-row">
                <span class="order-info-label">Cliente:</span>
                <span>${getClientTypeLabel(order.clientType)}</span>
            </div>
            <div class="order-info-row">
                <span class="order-info-label">Mesero:</span>
                <span>${order.user}</span>
            </div>
            <div class="order-info-row">
                <span class="order-info-label">Hora:</span>
                <span>${order.datetime.time}</span>
            </div>
        </div>
        
        <div class="order-items">
            <h4>Productos:</h4>
            ${itemsHtml}
        </div>
        
        <div class="order-total">
            Total: S/ ${order.total.toFixed(2)}
        </div>
        
        <button class="close-order-btn" onclick="openPaymentModal('${order.orderNumber}')">
            Cerrar Pedido
        </button>
    `;
    
    return div;
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
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const order = orders.find(o => o.orderNumber === orderNumber);
    
    if (!order) {
        showError('Pedido no encontrado');
        return;
    }
    
    currentOrderToClose = order;
    
    // Mostrar detalles del pedido en el modal
    const orderDetails = document.getElementById('orderDetails');
    const itemsHtml = order.items.map(item => `
        <div class="order-item">
            <span>${item.quantity}x ${item.product.nombre}</span>
            <span>S/ ${item.subtotal.toFixed(2)}</span>
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
        <hr style="margin: 15px 0; border: none; border-top: 1px solid #e1e5e9;">
        ${itemsHtml}
        <hr style="margin: 15px 0; border: none; border-top: 1px solid #e1e5e9;">
        <div style="text-align: right; font-size: 1.2em; font-weight: 700; color: #667eea;">
            Total: S/ ${order.total.toFixed(2)}
        </div>
    `;
    
    // Reset modal state
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.checked = false;
    });
    yapePhotoSection.style.display = 'none';
    confirmPayment.disabled = true;
    document.getElementById('photoPreview').innerHTML = '';
    
    paymentModal.classList.add('active');
}

// Cerrar modal de pago
function closePaymentModal() {
    paymentModal.classList.remove('active');
    currentOrderToClose = null;
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

// Manejar subida de foto
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const photoPreview = document.getElementById('photoPreview');
            photoPreview.innerHTML = `
                <img src="${e.target.result}" alt="Comprobante Yape">
                <p style="margin-top: 10px; color: #28a745; font-weight: 600;">
                    ✅ Foto cargada correctamente
                </p>
            `;
            updateConfirmButton();
        };
        reader.readAsDataURL(file);
    }
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
        const hasPhoto = yapePhoto.files.length > 0;
        confirmPayment.disabled = !hasPhoto;
    }
}

// Confirmar pago y cerrar pedido
async function handleConfirmPayment() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked');
    
    if (!selectedMethod || !currentOrderToClose) {
        showError('Error en el proceso de pago');
        return;
    }
    
    // Mostrar loading
    confirmPayment.innerHTML = '<span class="loading"></span> Cerrando...';
    confirmPayment.disabled = true;
    
    try {
        // Preparar datos del cierre
        const paymentData = {
            orderNumber: currentOrderToClose.orderNumber,
            paymentMethod: selectedMethod.value,
            closedBy: currentUser,
            closedAt: getCurrentDateTime(),
            hasPhoto: selectedMethod.value === 'yape' && yapePhoto.files.length > 0
        };
        
        // Actualizar pedido en localStorage
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
        
        // Simular guardado en Excel
        await savePaymentToExcel(paymentData);
        
        // Cerrar modal y recargar lista
        closePaymentModal();
        loadPendingOrders();
        
        // Mostrar mensaje de éxito
        showSuccessMessage(`Pedido ${currentOrderToClose.orderNumber} cerrado exitosamente`);
        
    } catch (error) {
        console.error('Error al cerrar pedido:', error);
        showError('Error al cerrar el pedido. Intente nuevamente.');
        confirmPayment.textContent = 'Cerrar Pedido';
        confirmPayment.disabled = false;
    }
}

// Simular guardado de pago en Excel
async function savePaymentToExcel(paymentData) {
    if (CONFIG.USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Pago registrado localmente:', paymentData);
    } else {
        try {
            // Obtener el pedido original y agregar info de pago
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const order = orders.find(o => o.orderNumber === paymentData.orderNumber);
            
            if (order) {
                // Agregar información de pago al pedido
                const completeOrderData = {
                    ...order,
                    paymentMethod: paymentData.paymentMethod,
                    closedBy: paymentData.closedBy,
                    closedAt: paymentData.closedAt,
                    hasYapePhoto: paymentData.hasPhoto,
                    status: 'Cerrado'
                };
                
                // Guardar el pedido completo con información de pago
                await window.googleSheetsSecureClient.saveOrderComplete(completeOrderData);
            }
            
            console.log('Pago registrado de forma segura en Google Sheets:', paymentData);
        } catch (error) {
            console.error('Error guardando pago en Google Sheets seguro:', error);
            showError('Error guardando pago en Google Sheets. Registrado localmente.');
        }
    }
    
    console.log('Datos para hoja Pagos:', {
        numeroPedido: paymentData.orderNumber,
        metodoPago: paymentData.paymentMethod,
        cerradoPor: paymentData.closedBy,
        fechaCierre: paymentData.closedAt.date,
        horaCierre: paymentData.closedAt.time,
        tieneComprobanteYape: paymentData.hasPhoto
    });
}

// Mostrar mensaje de éxito
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'error'; // Reusamos el estilo pero cambiaremos el color
    successDiv.style.background = '#d4edda';
    successDiv.style.color = '#155724';
    successDiv.style.borderColor = '#c3e6cb';
    successDiv.textContent = message;
    
    const container = closeOrdersScreen.querySelector('.container');
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}