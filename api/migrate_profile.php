<?php
require_once 'config.php';

$pdo = getDB();
if (!$pdo) die("<h2 style='color:red;'>Error conectando a BD. Asegura que SQL está corriendo.</h2>");

echo "<div style='font-family:sans-serif; text-align:center; padding: 50px;'>";

try {
    // 1. Alterar tabla existente para no perder usuarios viejos
    $pdo->exec("ALTER TABLE users ADD COLUMN first_name VARCHAR(100) DEFAULT ''");
    $pdo->exec("ALTER TABLE users ADD COLUMN last_name VARCHAR(100) DEFAULT ''");
    $pdo->exec("ALTER TABLE users ADD COLUMN email VARCHAR(150) DEFAULT ''");
    $pdo->exec("ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT ''");
    $pdo->exec("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT ''");
    
    echo "<h1 style='color:green;'>✅ Migración Base de Datos Exitosa</h1>";
    echo "<p>Las columnas de perfiles extendidos fueron adheridas al Esquema MySQL de forma segura.</p>";
} catch (PDOException $e) {
    // Si la columna ya existe, MySQL bota error que es seguro ignorar.
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "<h1 style='color:#6366f1;'>✔️ La tabla ya contaba con los perfiles.</h1>";
        echo "<p>No hubo necesidad de re-escribir las columnas.</p>";
    } else {
        echo "<h1 style='color:red;'>⚠️ Ocurrió una alerta DB:</h1><p>" . $e->getMessage() . "</p>";
    }
}

// 2. Crear el Directorio de Guardado Físico
$dir = __DIR__ . '/../uploads/avatars/';
if (!is_dir($dir)) {
    if(mkdir($dir, 0777, true)) {
        echo "<br><p style='color:gray;'>* Carpeta /uploads/avatars generada en tu Disco Duro.</p>";
    }
}

echo "<br><a href='../index.html' style='background:#6366f1; color:white; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block; margin-top:20px;'>Volver a NexxoAhorro</a>";
echo "</div>";
?>
