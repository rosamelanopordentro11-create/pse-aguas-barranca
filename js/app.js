/**
 * PSE Aguas de Barrancabermeja - JavaScript Principal
 * Sistema de consulta y pago de facturas
 * Conectado a la API real de Aguas de Barrancabermeja
 * 
 * COMPORTAMIENTO: Igual al sitio original
 * - Consulta el codigo de usuario
 * - Si encuentra factura, redirige DIRECTAMENTE a factura.html
 * - Si no encuentra, muestra mensaje de error
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURACION
    // ============================================
    const CONFIG = {
        // URL base de la API
        API_BASE_URL: '/api',
        // Endpoint de consulta de facturas
        CONSULTA_ENDPOINT: '/consultar-factura',
        // Maximo de caracteres permitidos
        MAX_LENGTH: 10,
        // Colores para SweetAlert
        COLORS: {
            PRIMARY: '#337ab7',
            SUCCESS: '#28a745',
            WARNING: '#ffc107',
            ERROR: '#dc3545'
        }
    };

    // ============================================
    // ELEMENTOS DEL DOM
    // ============================================
    const elements = {
        form: null,
        input: null,
        mensajeAyuda: null,
        btnConsultar: null
    };

    // ============================================
    // INICIALIZACION
    // ============================================
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        // Capturar elementos del DOM
        elements.form = document.getElementById('consultaForm');
        elements.input = document.getElementById('codigoUsuario');
        elements.mensajeAyuda = document.getElementById('mensajeAyuda');
        elements.btnConsultar = document.querySelector('.btn-consultar');

        // Verificar que existan los elementos
        if (!elements.form || !elements.input) {
            console.error('Error: No se encontraron los elementos del formulario');
            return;
        }

        // Configurar event listeners
        setupEventListeners();

        // Focus inicial en el input
        elements.input.focus();

        console.log('PSE Aguas Barranca - Conectado a API Real');
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function setupEventListeners() {
        elements.form.addEventListener('submit', handleFormSubmit);
        elements.input.addEventListener('input', handleInputChange);
        elements.input.addEventListener('keypress', handleKeyPress);
        elements.input.addEventListener('paste', handlePaste);
        elements.input.addEventListener('focus', handleInputFocus);
    }

    // ============================================
    // HANDLERS DE EVENTOS
    // ============================================

    async function handleFormSubmit(event) {
        event.preventDefault();

        const codigo = elements.input.value.trim();

        if (!codigo) {
            showValidationError();
            return;
        }

        await consultarFactura(codigo);
    }

    function handleInputChange(event) {
        const value = event.target.value;
        const cleanValue = value.replace(/[^0-9]/g, '');

        if (cleanValue !== value) {
            event.target.value = cleanValue;
        }

        clearInputError();
    }

    function handleKeyPress(event) {
        if (event.ctrlKey || event.metaKey) {
            return;
        }

        const charCode = event.which || event.keyCode;
        if (charCode < 48 || charCode > 57) {
            if (charCode !== 13) {
                event.preventDefault();
            }
        }
    }

    function handlePaste(event) {
        event.preventDefault();

        const pastedText = (event.clipboardData || window.clipboardData).getData('text');
        const numericText = pastedText.replace(/[^0-9]/g, '');

        const currentValue = elements.input.value;
        const selectionStart = elements.input.selectionStart;
        const selectionEnd = elements.input.selectionEnd;

        const newValue = currentValue.substring(0, selectionStart) +
                         numericText +
                         currentValue.substring(selectionEnd);

        elements.input.value = newValue.substring(0, CONFIG.MAX_LENGTH);
        elements.input.dispatchEvent(new Event('input'));
    }

    function handleInputFocus() {
        clearInputError();
    }

    // ============================================
    // VALIDACION
    // ============================================

    function showValidationError() {
        elements.input.classList.add('input-error', 'shake');

        Swal.fire({
            icon: 'warning',
            title: 'Atencion',
            text: 'El codigo de usuario es obligatorio',
            confirmButtonText: 'OK',
            confirmButtonColor: CONFIG.COLORS.PRIMARY,
            allowOutsideClick: true,
            allowEscapeKey: true
        }).then(() => {
            elements.input.focus();
        });

        setTimeout(() => {
            elements.input.classList.remove('shake');
        }, 500);
    }

    function clearInputError() {
        elements.input.classList.remove('input-error', 'shake');
    }

    // ============================================
    // API - CONSULTA DE FACTURAS (API REAL)
    // ============================================

    async function consultarFactura(codigo) {
        setLoadingState(true);

        // Mostrar loading igual que el original
        Swal.fire({
            title: 'Cargando...',
            text: 'Un momento por favor, no cierre el navegador',
            icon: 'info',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.CONSULTA_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ codigoUsuario: codigo })
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.data) {
                // *** COMPORTAMIENTO ORIGINAL ***
                // Redirigir DIRECTAMENTE a la pagina de factura sin modal intermedio
                redirigirAFactura(data.data.codigoUsuario);
            } else {
                showFacturaNoEncontrada(data);
            }

        } catch (error) {
            console.error('Error en consulta:', error);
            handleApiError(error);
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * Redirige directamente a la pagina de factura (comportamiento original)
     */
    function redirigirAFactura(codigoUsuario) {
        // Guardar codigo en sessionStorage
        sessionStorage.setItem('codigoUsuario', codigoUsuario);
        
        // Cerrar el loading de SweetAlert
        Swal.close();
        
        // Redirigir directamente a factura.html (igual que el sitio original)
        window.location.href = `/factura.html?codigo=${codigoUsuario}`;
    }

    /**
     * Muestra mensaje cuando no se encuentra la factura o tiene estado especial
     */
    function showFacturaNoEncontrada(data) {
        const mensaje = data.message;
        const estadoCodigo = data.estadoCodigo;
        let icon = 'warning';
        let title = 'Atencion';

        // Personalizar segun el estado
        if (estadoCodigo === 'C') {
            icon = 'info';
            title = 'Factura Pagada';
        } else if (estadoCodigo === 'A') {
            icon = 'error';
            title = 'Factura Anulada';
        } else if (estadoCodigo === 'TRANSACCION PENDIENTE') {
            icon = 'info';
            title = 'Transaccion Pendiente';
        }

        // Si la factura puede imprimirse (ya fue pagada)
        if (data.puedeImprimir && data.datosImpresion) {
            const { codigoUsuario, numeroFactura, numeroRecibo } = data.datosImpresion;

            Swal.fire({
                title: 'Atención',
                html: `La factura ya ha sido cancelada, puede imprimirla dando click en el botón: <button onclick="window.open('https://ws.suiteneptuno.com/BarrancaAguasWeb/?handler=Recibo&codigoUsuario=${codigoUsuario}&numero=${numeroFactura}&numRecaudo=${numeroRecibo}', '_blank')" style="padding:5px 10px; background-color:#007bff; color:white; border:none; border-radius:5px; cursor:pointer;">Imprimir Factura</button>`,
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: CONFIG.COLORS.PRIMARY
            }).then(() => {
                elements.input.focus();
                elements.input.select();
            });
        } else {
            Swal.fire({
                icon: icon,
                title: title,
                text: mensaje || 'El codigo de usuario ingresado no corresponde a ninguna factura',
                confirmButtonText: 'OK',
                confirmButtonColor: CONFIG.COLORS.PRIMARY
            }).then(() => {
                elements.input.focus();
                elements.input.select();
            });
        }
    }

    /**
     * Maneja errores de la API
     */
    function handleApiError(error) {
        let mensajeError = 'Error al consultar. Por favor intente nuevamente.';

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            mensajeError = 'Error de conexion. Verifique su conexion a internet.';
        } else if (error.message.includes('404')) {
            mensajeError = 'El servicio de consulta no esta disponible.';
        } else if (error.message.includes('500')) {
            mensajeError = 'Error interno del servidor. Intente mas tarde.';
        }

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: mensajeError,
            confirmButtonText: 'OK',
            confirmButtonColor: CONFIG.COLORS.PRIMARY
        });
    }

    // ============================================
    // UTILIDADES
    // ============================================

    function setLoadingState(loading) {
        if (elements.btnConsultar) {
            elements.btnConsultar.disabled = loading;
        }
        if (elements.input) {
            elements.input.disabled = loading;
        }
    }

})();
