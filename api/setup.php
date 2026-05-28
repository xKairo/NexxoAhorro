<?php
$host = 'localhost';
$user = 'root';
$password = '';

try {
    // Connect to XAMPP default MySQL port without DB selected
    $pdo = new PDO("mysql:host=$host;charset=utf8", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create the NexxoAhorro Database
    $pdo->exec("CREATE DATABASE IF NOT EXISTS nexxoahorro");
    $pdo->exec("USE nexxoahorro");

    // Desactivar temporalmente revisión de llaves foráneas para limpiar todo
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    // Table: Users (Login System) - UPDATED VERSION
    $pdo->exec("DROP TABLE IF EXISTS expenses"); // Drop dependents first
    $pdo->exec("DROP TABLE IF EXISTS user_state");
    $pdo->exec("DROP TABLE IF EXISTS users");

    $pdo->exec("CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(150) NOT NULL,
        first_name VARCHAR(100) DEFAULT '',
        last_name VARCHAR(100) DEFAULT '',
        phone VARCHAR(20) DEFAULT '',
        avatar VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // Table: User Preferences/State
    $pdo->exec("CREATE TABLE user_state (
        user_id INT PRIMARY KEY,
        base_income DECIMAL(10,2) DEFAULT 0,
        frequency VARCHAR(20) DEFAULT 'monthly',
        period_value VARCHAR(10) DEFAULT '1m',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");

    // Table: Expenses Memory - Refeactorizada para Simulador v5
    $pdo->exec("CREATE TABLE expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        local_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        color VARCHAR(20) NOT NULL,
        type ENUM('variable', 'fixed_monthly') DEFAULT 'variable',
        is_fixed TINYINT(1) DEFAULT 0,
        frequency VARCHAR(50) DEFAULT 'monthly',
        specific_days JSON DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_local (user_id, local_id)
    )");

    // Table: Credit Cards (Módulo de Calendario)
    $pdo->exec("CREATE TABLE credit_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        cut_off_day INT NOT NULL,
        payment_day INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        is_active_in_sim TINYINT(1) DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    // Create uploads directory
    $dir = __DIR__ . '/../uploads/avatars/';
    if (!is_dir($dir)) mkdir($dir, 0777, true);

    echo "<div style='font-family:sans-serif; text-align:center; padding: 50px; color:#333'>";
    echo "<h1>✅ ¡Estructura de Simulador Financiero v5 Lista!</h1>";
    echo "<p>Se han añadido las tablas de Tarjetas de Crédito y campos extendidos de frecuencia.</p>";
    echo "<p>Ya puedes volver a la aplicación.</p>";
    echo "<a href='../index.html' style='background:#6366f1; color:white; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block; margin-top:20px;'>Ir al Sistema</a>";
    echo "</div>";

} catch (PDOException $e) {
    echo "<h2 style='color:red;'>⚠️ Error al sincronizar con tu XAMPP:</h2>";
    echo "<p>" . $e->getMessage() . "</p>";
}
?>
