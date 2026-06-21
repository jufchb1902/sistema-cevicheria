// Configuración SEGURA para Google Sheets usando Apps Script
const GOOGLE_SECURE_CONFIG = {
    // Tu Apps Script URL (la obtienes después de deployar)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby9fvPu5mvu3Yn176-OuQgFFa9rrRS1picMy2xSSTj4woyOZuMeK9ER8C-3M6i2X5N4/exec', // Cambiar por la URL real
    
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
    }
};

// Cliente SEGURO para Google Sheets
class GoogleSheetsSecureClient {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        console.log('Inicializando cliente seguro de Google Sheets...');
        this.isInitialized = true;
        return true;
    }

    // Hacer petición al Apps Script
    async makeRequest(action, params = {}) {
        try {
            const url = new URL(GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', action);
            
            // Agregar parámetros
            Object.keys(params).forEach(key => {
                url.searchParams.append(key, params[key]);
            });

            console.log(`Haciendo petición segura: ${action}`, params);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Error desconocido');
            }

            return data;
        } catch (error) {
            console.error(`Error en petición ${action}:`, error);
            throw error;
        }
    }

    // Hacer petición POST para guardar datos
    async makePostRequest(data) {
        try {
            console.log('Guardando datos de forma segura...', data);

            const response = await fetch(GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Error guardando datos');
            }

            return result;
        } catch (error) {
            console.error('Error en petición POST:', error);
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
            
            // Parsear datos (primera fila = headers)
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
            
            // Parsear datos (primera fila = headers)
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

    // Guardar pedido completo
    async saveOrderComplete(orderData) {
        try {
            const saveData = {
                action: 'saveOrder',
                orderNumber: orderData.orderNumber,
                clientType: orderData.clientType,
                user: orderData.user,
                date: orderData.datetime.date,
                time: orderData.datetime.time,
                total: orderData.total,
                status: orderData.status,
                items: orderData.items.map(item => ({
                    productName: item.product.nombre,
                    quantity: item.quantity,
                    unitPrice: item.product.precio,
                    subtotal: item.subtotal
                }))
            };

            // Agregar datos de pago si existen
            if (orderData.paymentMethod) {
                saveData.paymentMethod = orderData.paymentMethod;
                saveData.closedBy = orderData.closedBy;
                saveData.closedDate = orderData.closedAt.date;
                saveData.closedTime = orderData.closedAt.time;
                saveData.hasYapePhoto = orderData.hasYapePhoto || false;
            }

            const result = await this.makePostRequest(saveData);
            console.log('Pedido guardado de forma segura:', result);
            return true;
        } catch (error) {
            console.error('Error guardando pedido:', error);
            throw error;
        }
    }

    // Método de prueba
    async testConnection() {
        try {
            console.log('Probando conexión segura...');
            
            if (!GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL || GOOGLE_SECURE_CONFIG.APPS_SCRIPT_URL.includes('TU_APPS_SCRIPT_URL_AQUI')) {
                throw new Error('Apps Script URL no configurada. Sigue los pasos de configuración segura.');
            }

            // Intentar obtener usuarios como prueba
            const users = await this.getUsers();
            
            return {
                success: true,
                message: 'Conexión segura exitosa',
                sampleData: users,
                security: 'Datos protegidos mediante Google Apps Script'
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
