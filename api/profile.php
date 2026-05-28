<?php
require_once 'config.php';

if (!isset($_SESSION['user_id'])) {
    jsonResponse(false, null, "Debes iniciar sesión para hacer esto.");
}

$userId = $_SESSION['user_id'];
$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT username, first_name, last_name, email, phone, avatar FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    jsonResponse(true, $stmt->fetch(PDO::FETCH_ASSOC));
} 
elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Es posible que el form venga como multipart, NO como application/json crudo.
    $firstName = $_POST['first_name'] ?? '';
    $lastName = $_POST['last_name'] ?? '';
    $email = $_POST['email'] ?? '';
    $phone = $_POST['phone'] ?? '';
    
    // Ruta base actual para el Avatar
    $stmt = $pdo->prepare("SELECT avatar FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $avatarPath = $stmt->fetchColumn();

    // Procesar Carga de Fotografía en el Servidor XAMPP
    if (isset($_FILES['avatar_file']) && $_FILES['avatar_file']['error'] === UPLOAD_ERR_OK) {
        $allowed = ['jpg', 'jpeg', 'png', 'webp'];
        $fileInfo = pathinfo($_FILES['avatar_file']['name']);
        $ext = strtolower($fileInfo['extension'] ?? '');
        
        if (in_array($ext, $allowed)) {
            $dir = __DIR__ . '/../uploads/avatars/';
            if (!is_dir($dir)) mkdir($dir, 0777, true);
            
            // Renombrar la foto segun estandar "user_6_16xxxx.jpg"
            $filename = "user_" . $userId . "_" . time() . "." . $ext;
            $destination = $dir . $filename;
            
            if (move_uploaded_file($_FILES['avatar_file']['tmp_name'], $destination)) {
                // Borrar foto de perfil anterior para ahorrar espacio en disco HD
                if ($avatarPath && file_exists(__DIR__ . '/../' . $avatarPath)) {
                    @unlink(__DIR__ . '/../' . $avatarPath);
                }
                
                // Setear nuevo local path relativo a index
                $avatarPath = 'uploads/avatars/' . $filename;
            }
        }
    }

    $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, email=?, phone=?, avatar=? WHERE id=?");
    if ($stmt->execute([$firstName, $lastName, $email, $phone, $avatarPath, $userId])) {
        // Retornamos foto y nombre para que el front lo pinte en la barra top
        jsonResponse(true, [
            'avatar' => $avatarPath,
            'first_name' => $firstName
        ]);
    } else {
        jsonResponse(false, null, "Error conectando a la base de datos.");
    }
}
?>
