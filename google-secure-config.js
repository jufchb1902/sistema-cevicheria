// Configuración SEGURA para Google Sheets usando Apps Script + JSONP
// JSONP evita por completo el problema de CORS: en vez de usar fetch(),
// carga la respuesta como un <script>, que el navegador nunca bloquea por CORS.
const GOOGLE_SECURE_CONFIG = {
    // Tu Apps Script URL (la obtienes después de deployar)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx4l7zZV4TCJW95ze6eEKDskU4PL22mmG0flP_n_jY8pImNrA_WqwN0f_exbaIze9hy/exec', // Cambiar por la URL real

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
    // (antes esto reenviaba todo el pedido y duplicaba filas en Cabecera/Detalle)
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
