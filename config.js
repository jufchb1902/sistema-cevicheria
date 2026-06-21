// Configuración para integración con Google Sheets
const CONFIG = {
    // URL de tu Google Sheets
    GOOGLE_SHEETS_URL: 'https://docs.google.com/spreadsheets/d/1KeHJ2MIWuepvvGFDpg3cnwwAPfQuqg_8dy2Ts_hz02w/edit?usp=sharing',
    
    // Cambiar a false para usar Google Sheets real
    USE_MOCK_DATA: false, // ⚠️ Cambia a FALSE después de configurar las hojas
    
    // Datos de ejemplo (reemplazar con datos reales de tu Google Sheets)
    MOCK_DATA: {
        usuarios: [
            { usuario: 'admin', password: '123' },
            { usuario: 'mesero1', password: 'mesero1' },
            { usuario: 'cocina', password: 'cocina123' }
        ],
        productos: [
            { id: 1, nombre: 'Ceviche Mixto', precio: 25.00, categoria: 'Ceviches' },
            { id: 2, nombre: 'Ceviche de Pescado', precio: 20.00, categoria: 'Ceviches' },
            { id: 3, nombre: 'Tiradito de Pescado', precio: 22.00, categoria: 'Tiraditos' },
            { id: 4, nombre: 'Chaufa de Mariscos', precio: 28.00, categoria: 'Arroces' },
            { id: 5, nombre: 'Jalea Mixta', precio: 35.00, categoria: 'Frituras' },
            { id: 6, nombre: 'Sudado de Pescado', precio: 24.00, categoria: 'Sudados' },
            { id: 7, nombre: 'Leche de Tigre', precio: 8.00, categoria: 'Bebidas' },
            { id: 8, nombre: 'Chicha Morada', precio: 6.00, categoria: 'Bebidas' },
            { id: 9, nombre: 'Arroz con Mariscos', precio: 26.00, categoria: 'Arroces' },
            { id: 10, nombre: 'Causa Limeña', precio: 15.00, categoria: 'Entradas' }
        ]
    },
    
    // Estructura de hojas Google Sheets esperada
    GOOGLE_SHEETS: {
        usuarios: 'Usuario',      // Hoja con usuarios y contraseñas
        productos: 'Productos',   // Hoja con productos y precios
        cabecera: 'Cabecera',     // Hoja con datos principales del pedido
        detalle: 'Detalle',       // Hoja con items del pedido
        pagos: 'Pagos'           // Hoja con información de pagos
    }
};

// Función para generar número de pedido
function generateOrderNumber() {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getHours().toString().padStart(2, '0') + 
                 now.getMinutes().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    
    return `P${year}${month}${day}${time}${random}`;
}

// Función para obtener fecha y hora actual
function getCurrentDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString('es-PE');
    const time = now.toLocaleTimeString('es-PE', { hour12: false });
    return { date, time, datetime: now };
}