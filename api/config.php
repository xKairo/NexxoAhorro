<?php
session_start();

$host = 'localhost';
$user = 'root';
$password = '';
$dbname = 'nexxoahorro';

function getDB() {
    global $host, $user, $password, $dbname;
    try {
        // Primera opción: Conectar directamente a la base de datos
        $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    } catch (PDOException $e) {
        try {
            // Segunda opción: Conectar solo al host para verificar si existe el servidor
            $pdo = new PDO("mysql:host=$host;charset=utf8", $user, $password);
            // Si llegamos aquí, el servidor existe pero la DB no.
            return null; 
        } catch (PDOException $e2) {
            // El servidor MySQL ni siquiera responde
            return false;
        }
    }
}

// Helper para responder con JSON al JavaScript
function jsonResponse($success, $data = null, $error = null) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error
    ]);
    exit;
}
?>
