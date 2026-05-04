<?php
// api_hasil.php - Menyimpan dan mengambil hasil ujian peserta (MySQL Version)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'config.php';
$pdo = getPDO();
if (!$pdo) {
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM hasil_ujian ORDER BY waktu_selesai DESC");
    $results = $stmt->fetchAll();
    
    $out = [];
    foreach ($results as $r) {
        $out[] = [
            'id' => $r['id'],
            'peserta' => json_decode($r['peserta'], true),
            'hasil' => json_decode($r['hasil_sesi'], true),
            'waktu_selesai' => $r['waktu_selesai'],
            'disimpan_pada' => $r['created_at']
        ];
    }
    echo json_encode($out);
}
elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['peserta'])) {
        echo json_encode(['status' => 'error', 'message' => 'Data tidak valid']);
        exit;
    }
    
    $id = bin2hex(random_bytes(6));
    $nik = $input['peserta']['nik'] ?? '';
    $nama = $input['peserta']['nama'] ?? '';
    $pesertaJson = json_encode($input['peserta']);
    $hasilSesiJson = json_encode($input['hasil'] ?? []);
    
    $waktu = $input['waktu_selesai'] ?? date('Y-m-d H:i:s');
    $waktu_db = date('Y-m-d H:i:s', strtotime($waktu));

    // Cegah duplikasi pengiriman (jika nik dan waktu selesai sama)
    $cek = $pdo->prepare("SELECT id FROM hasil_ujian WHERE nik = ? AND waktu_selesai = ?");
    $cek->execute([$nik, $waktu_db]);
    if ($cek->fetch()) {
        echo json_encode(['status' => 'success', 'id' => 'exists']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO hasil_ujian (id, nik, nama, peserta, hasil_sesi, waktu_selesai) VALUES (?, ?, ?, ?, ?, ?)");
    if ($stmt->execute([$id, $nik, $nama, $pesertaJson, $hasilSesiJson, $waktu_db])) {
        echo json_encode(['status' => 'success', 'id' => $id]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan']);
    }
}
elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if ($id) {
        $stmt = $pdo->prepare("DELETE FROM hasil_ujian WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error']);
    }
}
?>
