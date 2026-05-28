<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';
$pdo = getDB();

if ($pdo === false) {
    jsonResponse(false, null, "Error crítico: El servidor MySQL de XAMPP no responde. Asegúrate de que MySQL esté activo en el panel de control.");
}

if ($pdo === null) {
    jsonResponse(false, null, "La base de datos '$dbname' no existe. Por favor, ejecuta /api/setup.php para crearla.");
}

// Validar JSON Post
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($username) || empty($password)) {
        jsonResponse(false, null, "Por favor completa el usuario y la contraseña.");
    }

    if ($action === 'register') {
        $email = trim($input['email'] ?? '');
        
        // Validación de Dominio Backend
        $validDomains = ['gmail.com', 'hotmail.com', 'virtual.utsc.edu'];
        $parts = explode('@', $email);
        if (count($parts) !== 2 || !in_array(strtolower($parts[1]), $validDomains)) {
            jsonResponse(false, null, "Dominio inválido. Correos autorizados: @gmail.com, @hotmail.com, @virtual.utsc.edu.");
        }

        // Verificar existencia
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, "Ese nombre de usuario ya está ocupado.");
        }

        // Insertar seguro
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password, email) VALUES (?, ?, ?)");
        
        if ($stmt->execute([$username, $hash, $email])) {
            $userId = $pdo->lastInsertId();
            // Estado inicial vacío en la BD
            $pdo->prepare("INSERT INTO user_state (user_id) VALUES (?)")->execute([$userId]);
            
            // ELIMINADO: Auto-login para obligar al usuario a iniciar sesión manualmente
            jsonResponse(true, ['username' => $username, 'message' => 'Registro exitoso. Por favor, inicia sesión.']);
        } else {
            jsonResponse(false, null, "Ocurrió un error creando la cuenta.");
        }
    } 
    elseif ($action === 'login') {
        // Obtenemos los campos extendidos de la Migración V2
        $stmt = $pdo->prepare("SELECT id, username, password, first_name, avatar FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            
            jsonResponse(true, [
                'username' => $user['username'],
                'first_name' => $user['first_name'] ?? '',
                'avatar' => $user['avatar'] ?? ''
            ]);
        } else {
            jsonResponse(false, null, "Credenciales incorrectas (Usuario o Contraseña erróneas).");
        }
    }
} 
elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'check') {
        if (isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
            // Traer avatar si está recargando la página
            try {
                $stmt = $pdo->prepare("SELECT first_name, avatar FROM users WHERE id = ?");
                $stmt->execute([$_SESSION['user_id']]);
                $prof = $stmt->fetch(PDO::FETCH_ASSOC);
                
                jsonResponse(true, [
                    'username' => $_SESSION['username'],
                    'first_name' => $prof['first_name'] ?? '',
                    'avatar' => $prof['avatar'] ?? ''
                ]);
            } catch (Exception $e) {
                // Fallback clásico por si no habían migrado la BD
                jsonResponse(true, ['username' => $_SESSION['username']]);
            }
        } else {
            jsonResponse(false);
        }
    }
    elseif ($action === 'logout') {
        session_destroy();
        jsonResponse(true);
    }
}
?>
