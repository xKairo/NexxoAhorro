<?php
// Desactivar salida de errores HTML para prevenir SyntaxError en fetch
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once 'config.php';

// Asegurar que siempre respondamos JSON
header('Content-Type: application/json');

// Validar que hay un usuario activo
if (!isset($_SESSION['user_id'])) {
    jsonResponse(false, null, "Usuario no autenticado");
}

$userId = $_SESSION['user_id'];
$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // 1. Obtener ajustes financieros
    $stmt = $pdo->prepare("SELECT base_income, frequency, period_value FROM user_state WHERE user_id = ?");
    $stmt->execute([$userId]);
    $state = $stmt->fetch(PDO::FETCH_ASSOC);

    // 2. Obtener gastos con metadatos v5
    $stmt = $pdo->prepare("SELECT local_id as id, name, amount, color, type, is_fixed, frequency, specific_days FROM expenses WHERE user_id = ?");
    $stmt->execute([$userId]);
    $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Obtener Tarjetas de Crédito
    $stmt = $pdo->prepare("SELECT id, name, cut_off_day, payment_day, amount, is_active_in_sim FROM credit_cards WHERE user_id = ?");
    $stmt->execute([$userId]);
    $cards = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatear correctamente cuidando que sean arrays
    if ($expenses && is_array($expenses)) {
        foreach($expenses as &$exp) {
            $exp['id'] = (int)$exp['id'];
            $exp['amount'] = (float)$exp['amount'];
            $exp['specific_days'] = $exp['specific_days'] ? json_decode($exp['specific_days'], true) : null;
        }
    } else {
        $expenses = [];
    }
    
    if ($cards && is_array($cards)) {
        foreach($cards as &$c) {
            $c['id'] = (int)$c['id'];
            $c['amount'] = (float)$c['amount'];
            $c['cut_off_day'] = (int)$c['cut_off_day'];
            $c['payment_day'] = (int)$c['payment_day'];
            $c['is_active_in_sim'] = (bool)$c['is_active_in_sim'];
        }
    } else {
        $cards = [];
    }

    jsonResponse(true, [
        'income' => (float)($state['base_income'] ?? 0),
        'frequency' => $state['frequency'] ?? 'monthly',
        'periodValue' => $state['period_value'] ?? '1m',
        'expenses' => $expenses,
        'credit_cards' => $cards
    ]);
} 
elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validar JSON
    if (!$input) {
        error_log("NexxoAhorro Sync - Error: JSON inválido recibido.");
        jsonResponse(false, null, "JSON inválido");
    }

    // Debug Log principal
    error_log("NexxoAhorro Sync - Iniciando proceso de guardado para usuario $userId");
    error_log("NexxoAhorro Sync - Payload: " . json_encode($input));

    try {
        // 1. Sobreescribir estado de ingresos (Opcional, solo si viene en el input)
        if (isset($input['income'])) {
            $stmt = $pdo->prepare("UPDATE user_state SET base_income=?, frequency=?, period_value=? WHERE user_id=?");
            $stmt->execute([
                (float)($input['income'] ?? 0), 
                $input['frequency'] ?? 'monthly', 
                $input['periodValue'] ?? '1m',
                $userId
            ]);
            error_log("NexxoAhorro Sync - Ingresos actualizados.");
        }
        
        // 2. Sincronización Inteligente (Smart Sync) tipo Firebase
        if (isset($input['expenses']) && is_array($input['expenses'])) {
            $incomingExpenses = $input['expenses'];
            $localIdsReceived = [];
            
            error_log("NexxoAhorro Sync - Iniciando UPSERT para " . count($incomingExpenses) . " gastos.");

            // A. Preparar consulta UPSERT
            $upsertSql = "INSERT INTO expenses 
                (user_id, local_id, name, amount, color, type, is_fixed, frequency, specific_days) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                name = VALUES(name), 
                amount = VALUES(amount), 
                color = VALUES(color), 
                type = VALUES(type), 
                is_fixed = VALUES(is_fixed), 
                frequency = VALUES(frequency), 
                specific_days = VALUES(specific_days)";
            
            $stmt = $pdo->prepare($upsertSql);

            foreach($incomingExpenses as $exp) {
                $localId = (int)($exp['id'] ?? 0);
                $localIdsReceived[] = $localId;
                
                $eType = $exp['type'] ?? 'variable';
                $isFixed = ($eType === 'fixed_monthly') ? 1 : 0;
                
                try {
                    $stmt->execute([
                        $userId,
                        $localId,
                        $exp['name'] ?? 'Gasto sin nombre',
                        (float)($exp['amount'] ?? 0),
                        $exp['color'] ?? '#cccccc',
                        $eType,
                        $isFixed,
                        $exp['frequency'] ?? 'monthly',
                        isset($exp['specific_days']) ? json_encode($exp['specific_days']) : null
                    ]);
                } catch (PDOException $ex) {
                    error_log("NexxoAhorro Sync - Error al insertar local_id $localId: " . $ex->getMessage());
                }
            }

            // B. Eliminación Selectiva (Borrar solo lo que ya no está en el cliente)
            try {
                if (count($localIdsReceived) > 0) {
                    $placeholders = implode(',', array_fill(0, count($localIdsReceived), '?'));
                    $deleteSql = "DELETE FROM expenses WHERE user_id = ? AND local_id NOT IN ($placeholders)";
                    $deleteParams = array_merge([$userId], $localIdsReceived);
                    $pdo->prepare($deleteSql)->execute($deleteParams);
                } else {
                    // Si recibimos array vacío, borrar todo
                    $pdo->prepare("DELETE FROM expenses WHERE user_id = ?")->execute([$userId]);
                }
            } catch (PDOException $ex) {
                error_log("NexxoAhorro Sync - Error en DELETE selectivo: " . $ex->getMessage());
            }
            
            error_log("NexxoAhorro Sync - Smart Sync completado exitosamente.");
        }

        // 3. Sincronización de Tarjetas (Protegida)
        if (isset($input['credit_cards']) && is_array($input['credit_cards'])) {
            error_log("NexxoAhorro Sync - Sincronizando tarjetas...");
            $pdo->prepare("DELETE FROM credit_cards WHERE user_id = ?")->execute([$userId]);
            
            $stmt = $pdo->prepare("INSERT INTO credit_cards (user_id, name, cut_off_day, payment_day, amount, is_active_in_sim) VALUES (?, ?, ?, ?, ?, ?)");
            foreach($input['credit_cards'] as $card) {
                $stmt->execute([
                    $userId,
                    $card['name'] ?? 'Tarjeta',
                    (int)($card['cut_off_day'] ?? 1),
                    (int)($card['payment_day'] ?? 1),
                    (float)($card['amount'] ?? 0),
                    isset($card['is_active_in_sim']) ? (int)$card['is_active_in_sim'] : 1
                ]);
            }
        }

        jsonResponse(true, null, "Sincronización exitosa");

    } catch (Exception $e) {
        error_log("NexxoAhorro Sync - ERROR FATAL: " . $e->getMessage());
        jsonResponse(false, null, "Error interno del servidor: " . $e->getMessage());
    }
}
?>
