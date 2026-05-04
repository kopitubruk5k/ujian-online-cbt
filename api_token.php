<?php
// api_token.php - Mengelola Token Ujian
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');

require_once 'config.php';
$pdo = getPDO();
if (!$pdo) {
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT active_token FROM pengaturan WHERE id = 1");
    $res = $stmt->fetch();
    echo json_encode(['status' => 'success', 'token' => $res['active_token'] ?? '']);
} 
elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $action = $input['action'] ?? '';

    if ($action === 'generate') {
        // Buat token baru: 5 karakter huruf kapital & angka
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $token = '';
        for ($i=0; $i<5; $i++) {
            $token .= $chars[rand(0, strlen($chars)-1)];
        }
        
        $stmt = $pdo->prepare("UPDATE pengaturan SET active_token = ? WHERE id = 1");
        if ($stmt->execute([$token])) {
            echo json_encode(['status' => 'success', 'token' => $token]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Gagal generate token']);
        }
    } 
    elseif ($action === 'validate') {
        $userToken = strtoupper(trim($input['token'] ?? ''));
        
        $stmt = $pdo->query("SELECT active_token FROM pengaturan WHERE id = 1");
        $res = $stmt->fetch();
        $activeToken = $res['active_token'] ?? '';

        if ($userToken === $activeToken) {
            echo json_encode(['status' => 'success']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Token tidak valid']);
        }
    }
}
?>
