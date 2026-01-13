# PSE Aguas de Barrancabermeja

Sistema de consulta y pago de facturas de servicios de agua para Aguas de Barrancabermeja.

## Estructura del Proyecto

```
pse-aguas-barranca/
├── index.html          # Pagina principal
├── css/
│   └── styles.css      # Estilos personalizados
├── js/
│   └── app.js          # Logica JavaScript
├── images/
│   ├── logo-aguas.png  # Logo de la empresa
│   └── img_cabecera.png # Imagen decorativa
├── server.js           # Servidor Node.js con API mock
├── package.json        # Dependencias npm
└── README.md           # Este archivo
```

## Instalacion

### Opcion 1: Sin servidor (solo frontend)

Simplemente abre `index.html` en tu navegador. La aplicacion incluye un mock de API integrado para desarrollo.

### Opcion 2: Con servidor Node.js

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

El servidor estara disponible en `http://localhost:3000`

### Opcion 3: Servidor HTTP simple

```bash
# Usando Python
python -m http.server 8080

# Usando npx
npx http-server -p 8080 -o
```

## Codigos de Prueba

| Codigo | Cliente | Estado |
|--------|---------|--------|
| 123456 | Juan Carlos Rodriguez Martinez | Pendiente |
| 789012 | Maria Fernanda Lopez Garcia | Vencida |
| 111111 | Empresa Pruebas S.A.S | Pagada |
| 222222 | Andres Felipe Gomez Ruiz | Pendiente |
| 333333 | Rosa Elena Perez Quintero | Vencida |

## API Endpoints

### POST /api/consultar-factura

Consulta una factura por codigo de usuario.

**Request:**
```json
{
  "codigoUsuario": "123456"
}
```

**Response (exito):**
```json
{
  "success": true,
  "data": {
    "numeroFactura": "FAC-2024-001234",
    "nombreCliente": "JUAN CARLOS RODRIGUEZ MARTINEZ",
    "direccion": "Calle 45 # 12-34, Barrio Centro",
    "valorFactura": 85600,
    "fechaVencimiento": "2024-02-15",
    "estado": "Pendiente"
  }
}
```

**Response (error):**
```json
{
  "success": false,
  "message": "El codigo de usuario ingresado no corresponde a ninguna factura"
}
```

### GET /api/health

Verifica el estado del servidor.

### GET /api/codigos-prueba

Obtiene la lista de codigos de prueba disponibles.

## Tecnologias Utilizadas

- **HTML5** - Estructura semantica
- **CSS3** - Estilos personalizados
- **JavaScript ES6+** - Logica de la aplicacion
- **Bootstrap 5.3** - Framework CSS
- **Font Awesome 6.5** - Iconos
- **SweetAlert2** - Modales y alertas
- **Express.js** - Servidor Node.js

## Colores del Diseno

| Elemento | Color | RGB |
|----------|-------|-----|
| Titulo formulario | #004f80 | rgb(0, 79, 128) |
| Borde input | #28a745 | rgb(40, 167, 69) |
| Mensaje validacion | #8abc02 | rgb(138, 188, 2) |
| Boton consultar | #337ab7 | rgb(51, 122, 183) |
| Borde contenedor | #ced4da | rgb(206, 212, 218) |
| Footer texto | #6c757d | rgb(108, 117, 125) |
| Footer link | #0077cc | rgb(0, 119, 204) |

## Caracteristicas

- Validacion en tiempo real
- Solo acepta numeros en el campo de codigo
- Maximo 10 caracteres
- Responsive design (mobile-first)
- Accesibilidad ARIA
- API mock integrada para desarrollo
- Modales interactivos con SweetAlert2

## Responsive Breakpoints

- **Desktop:** > 992px
- **Tablet:** 768px - 992px
- **Mobile Landscape:** 576px - 768px
- **Mobile Portrait:** < 576px

## Desarrollo

Para modificar el proyecto:

1. Edita los archivos HTML, CSS o JS segun necesites
2. El servidor de desarrollo soporta hot-reload con nodemon:
   ```bash
   npx nodemon server.js
   ```

## Produccion

Para desplegar en produccion:

1. Configura las variables de entorno
2. Actualiza la URL de la API real en `js/app.js`
3. Configura el endpoint de pago PSE real
4. Considera agregar HTTPS y seguridad adicional

## Licencia

MIT License - Desarrollado por Microshif Smart Systems

## Contacto

[Microshif Smart Systems](https://microshif.com.co/)
