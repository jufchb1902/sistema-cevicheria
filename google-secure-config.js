// Configuración SEGURA para Google Sheets usando Apps Script + JSONP
// JSONP evita por completo el problema de CORS: en vez de usar fetch(),
// carga la respuesta como un <script>, que el navegador nunca bloquea por CORS.
const GOOGLE_SECURE_CONFIG = {
    // Tu Apps Script URL (la obtienes después de deployar)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxS-z9jW_Hw6Mo6XvUqLBwug_JrM8uulrtMU7xUMx23dccRbDhCnBxFkZolYmwQRNpP/exec', // Cambiar por la URL real

    // ID de tu Google Sheets (no cambiar)
    SPREADSHEET_ID: '1KeHJ2MIWuepvvGFDpg3cnwwAPfQuqg_8dy2Ts_hz02w',

    // Usar método seguro (Apps Script)
    USE_SECURE_METHOD: true,

    // Nombres de las hojas
    SHEET_NAMES: {
        usuarios: 'Usuario',
        productos: 'Productos',
        cabecera: 'Cabecera',
        detalle: 'Detalle',
        pagos: 'Pagos'
    },

    // Tiempo máximo de espera por respuesta (ms)
    JSONP_TIMEOUT: 15000
};

// Hace una petición JSONP a una URL dada con parámetros.
// No usa fetch ni XHR, así que NUNCA dispara CORS / preflight.
function jsonpRequest(baseUrl, params) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
        const script = document.createElement('script');
        let finished = false;

        const cleanup = () => {
            finished = true;
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            clearTimeout(timeoutId);
        };

        const timeoutId = setTimeout(() => {
            if (finished) return;
            cleanup();
            reject(new Error('Tiempo de espera agotado conectando con Google Sheets'));
        }, GOOGLE_SECURE_CONFIG.JSONP_TIMEOUT);

        window[callbackName] = function(data) {
            if (finished) return;
            cleanup();
            resolve(data);
        };

        const url = new URL(baseUrl);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        url.searchParams.append('callback', callbackName);

        script.src = url.toString();
        script.onerror = () => {
            if (finished) return;
            cleanup();
            reject(new Error('No se pudo conectar con Google Sheets (revisa la URL del Apps Script)'));
        };

        document.body.appendChild(script);
    });
}

// Envía datos por POST usando un <form> + <iframe> oculto. Esto NUNCA pasa
// por CORS porque es una navegación de formulario, no un fetch/XHR. Se usa
// solo para la foto de Yape, que puede pesar varios MB y no cabe en una URL.
// Limitación: no podemos leer la respuesta del iframe (otro origen), así que
// es "fire and forget" — confiamos en que llegó tras un tiempo prudencial.
function postViaHiddenForm(url, params) {
    return new Promise((resolve) => {
        const iframeName = 'hidden_iframe_' + Date.now();
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.display = 'none';
        
        // Ignoramos errores de carga del iframe (pueden ser CORS o 403)
        iframe.onerror = () => {
            // No hacer nada, solo dejar que falle silenciosamente
        };
        
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url;
        form.target = iframeName;
        form.style.display = 'none';

        Object.keys(params).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key];
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();

        setTimeout(() => {
            resolve(true);
            setTimeout(() => {
                if (form.parentNode) form.parentNode.removeChild(form);
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 5000);
        }, 1500);
    });
}

// Cliente SEGURO para Google Sheets
class GoogleSheetsSecureClient {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        console.log('Inicializando cliente seguro de Google Sheets (modo JSONP)...');
        this.isInitialized = true;
        return true;
    }

    // Petición genérica vía JSONP
    async makeRequest(action, params = {}) {
        try {
            console.log(`Haciendo petición JSONP: ${action}`, params);

            const data = await jsonpRequest(GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL, {
                action,
                ...params
            });

            if (!data.success) {
                throw new Error(data.error || 'Error desconocido');
            }

            return data;
        } catch (error) {
            console.error(`Error en petición ${action}:`, error);
            throw error;
        }
    }

    // Obtener usuarios
    async getUsers() {
        try {
            const result = await this.makeRequest('getUsers');
            const data = result.data;

            if (data.length <= 1) {
                throw new Error('No se encontraron usuarios');
            }

            const users = [];
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] && data[i][1]) {
                    users.push({
                        usuario: data[i][0].toString().trim(),
                        password: data[i][1].toString().trim()
                    });
                }
            }

            console.log('Usuarios obtenidos de forma segura:', users);
            return users;
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            throw error;
        }
    }

    // Obtener productos
    async getProducts() {
        try {
            const result = await this.makeRequest('getProducts');
            const data = result.data;

            if (data.length <= 1) {
                throw new Error('No se encontraron productos');
            }

            const products = [];
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] && data[i][1]) {
                    products.push({
                        id: parseInt(data[i][0]) || i,
                        nombre: data[i][1].toString().trim(),
                        precio: parseFloat(data[i][2]) || 0,
                        categoria: (data[i][3] || 'General').toString().trim()
                    });
                }
            }

            console.log('Productos obtenidos de forma segura:', products);
            return products;
        } catch (error) {
            console.error('Error obteniendo productos:', error);
            throw error;
        }
    }

    // Obtener pedidos pendientes (estado "Preparando") desde Google Sheets,
    // visibles desde cualquier dispositivo (no solo el que tomó el pedido).
    async getPendingOrders() {
        try {
            const result = await this.makeRequest('getPendingOrders');
            return result.data || [];
        } catch (error) {
            console.error('Error obteniendo pedidos pendientes:', error);
            throw error;
        }
    }

    // Obtener pedidos cerrados (estado "Cerrado")
    async getClosedOrders() {
        try {
            const result = await this.makeRequest('getClosedOrders');
            // Esperamos que el Apps Script devuelva un array de objetos con la
            // misma forma que getPendingOrders pero con status 'Cerrado' y
            // opcionalmente información de pago (hasYapePhoto, yapePhotoUrl).
            return result.data || [];
        } catch (error) {
            console.error('Error obteniendo pedidos cerrados:', error);
            throw error;
        }
    }

    // Guardar pedido nuevo (estado "Preparando")
    async saveOrderComplete(orderData) {
        try {
            const params = {
                orderNumber: orderData.orderNumber,
                clientType: orderData.clientType,
                user: orderData.user,
                date: orderData.datetime.date,
                time: orderData.datetime.time,
                total: orderData.total,
                status: orderData.status,
                items: JSON.stringify(orderData.items.map(item => ({
                    productName: item.product.nombre,
                    quantity: item.quantity,
                    unitPrice: item.product.precio,
                    subtotal: item.subtotal
                })))
            };

            const result = await this.makeRequest('saveOrder', params);
            console.log('Pedido guardado de forma segura:', result);
            return true;
        } catch (error) {
            console.error('Error guardando pedido:', error);
            throw error;
        }
    }

    // Cerrar un pedido existente: SOLO actualiza estado y registra el pago.
    async closeOrder(orderData) {
        try {
            const params = {
                orderNumber: orderData.orderNumber,
                paymentMethod: orderData.paymentMethod,
                closedBy: orderData.closedBy,
                closedDate: orderData.closedAt.date,
                closedTime: orderData.closedAt.time,
                hasYapePhoto: orderData.hasYapePhoto ? 'true' : 'false'
            };

            const result = await this.makeRequest('closeOrder', params);
            console.log('Pedido cerrado de forma segura:', result);
            return true;
        } catch (error) {
            console.error('Error cerrando pedido:', error);
            throw error;
        }
    }

    // Sube la foto del comprobante de Yape (dataURL base64) y reemplaza el
    // valor "Sí" en la columna tieneComprobanteYape de Pagos por el link real.
    // Se envía después de closeOrder, en segundo plano.
    async uploadYapePhoto(orderNumber, photoBase64) {
        try {
            await postViaHiddenForm(GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL, {
                action: 'uploadYapePhoto',
                orderNumber: orderNumber,
                photoBase64: photoBase64
            });
            console.log('Foto de Yape enviada a Drive (sin confirmación de lectura, por diseño)');
            return true;
        } catch (error) {
            console.error('Error enviando foto de Yape:', error);
            return false;
        }
    }

    // Método de prueba
    async testConnection() {
        try {
            console.log('Probando conexión segura (JSONP)...');

            if (!GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL || GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL.includes('TU_APPS_SCRIPT_URL_AQUI')) {
                throw new Error('Apps Script URL no configurada. Sigue los pasos de configuración segura.');
            }

            const users = await this.getUsers();

            return {
                success: true,
                message: 'Conexión segura exitosa',
                sampleData: users,
                security: 'Datos protegidos mediante Google Apps Script (JSONP, sin CORS)'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error,
                instructions: 'Configura Google Apps Script para acceso seguro'
            };
        }
    }
}

// Instancia global del cliente seguro
window.googleSheetsSecureClient = new GoogleSheetsSecureClient();
