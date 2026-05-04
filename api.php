<?php
// api.php - Backend untuk mengelola soal custom & upload gambar (MySQL Version)
header('Content-Type: application/json');
require_once 'config.php';

$uploadDir = 'uploads/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

$pdo = getPDO();
if (!$pdo) {
    echo json_encode(['status' => 'error', 'message' => 'Koneksi database gagal']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM soal ORDER BY created_at ASC");
    $allSoal = $stmt->fetchAll();
    
    $data = ['pedagogik' => [], 'profesional' => []];
    foreach ($allSoal as $row) {
        $sesi = $row['sesi'];
        if (!isset($data[$sesi])) $data[$sesi] = [];
        
        $data[$sesi][] = [
            'id' => $row['id'],
            'kategori' => $row['kategori'],
            'tipe' => $row['tipe'],
            'soal' => $row['soal'],
            'pilihan' => json_decode($row['pilihan'], true),
            'jawaban' => json_decode($row['jawaban'], true),
            'gambar' => $row['gambar'],
            'gambar_pilihan' => json_decode($row['gambar_pilihan'], true)
        ];
    }
    echo json_encode($data);
} 
elseif ($method === 'POST') {
    $isFormData = !empty($_POST);
    
    if ($isFormData) {
        $category = $_POST['sesi'] ?? '';
        $kategori = $_POST['kategori'] ?? 'Umum';
        $soal = $_POST['soal'] ?? '';
        $pilihan = $_POST['pilihan'] ?? '[]';
        $tipe = $_POST['tipe'] ?? 'single';
        $jawabanRaw = $_POST['jawaban'] ?? '';
        $jawaban = ($tipe === 'multi') ? json_encode(json_decode($jawabanRaw, true)) : json_encode($jawabanRaw);
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
        $category = $input['sesi'] ?? '';
        $kategori = $input['kategori'] ?? 'Umum';
        $soal = $input['soal'] ?? '';
        $pilihan = json_encode($input['pilihan'] ?? []);
        $tipe = $input['tipe'] ?? 'single';
        $jawaban = json_encode($input['jawaban'] ?? '');
    }

    if (!$category) {
        echo json_encode(['status' => 'error', 'message' => 'Data tidak lengkap']);
        exit;
    }

    $editIndex = $_POST['edit_index'] ?? '';
    $editCat = $_POST['edit_cat'] ?? '';
    $isEdit = false;
    $oldSoal = null;

    if ($editIndex !== '' && $editCat !== '') {
        // Karena sistem frontend lama menggunakan index array, kita perlu mencari ID berdasarkan index
        // Akan lebih baik jika frontend mengirimkan ID, tapi untuk kompatibilitas kita cari index ke-$editIndex
        $stmt = $pdo->prepare("SELECT * FROM soal WHERE sesi = ? ORDER BY created_at ASC LIMIT 1 OFFSET ?");
        // LIMIT OFFSET needs to be int
        $stmt->bindValue(1, $editCat, PDO::PARAM_STR);
        $stmt->bindValue(2, (int)$editIndex, PDO::PARAM_INT);
        $stmt->execute();
        $oldSoal = $stmt->fetch();
        if ($oldSoal) $isEdit = true;
    }

    $gambar = '';
    if (isset($_FILES['gambar']) && $_FILES['gambar']['error'] === 0) {
        $ext = pathinfo($_FILES['gambar']['name'], PATHINFO_EXTENSION);
        $filename = 'q_' . bin2hex(random_bytes(8)) . '.' . $ext;
        if (move_uploaded_file($_FILES['gambar']['tmp_name'], $uploadDir . $filename)) {
            $gambar = $filename;
            if ($isEdit && !empty($oldSoal['gambar']) && file_exists($uploadDir . $oldSoal['gambar'])) {
                unlink($uploadDir . $oldSoal['gambar']);
            }
        }
    } else {
        if ($isEdit && !empty($oldSoal['gambar'])) {
            if (isset($_POST['remove_gambar']) && $_POST['remove_gambar'] === '1') {
                if (file_exists($uploadDir . $oldSoal['gambar'])) unlink($uploadDir . $oldSoal['gambar']);
            } else {
                $gambar = $oldSoal['gambar'];
            }
        }
    }

    $gambar_pilihan = [];
    $old_gambar_pilihan = $isEdit && !empty($oldSoal['gambar_pilihan']) ? json_decode($oldSoal['gambar_pilihan'], true) : [];
    
    foreach (['a','b','c','d','e'] as $letter) {
        $upper = strtoupper($letter);
        $key = 'gambar_' . $letter;
        $removeKey = 'remove_gambar_' . $letter;
        
        if (isset($_FILES[$key]) && $_FILES[$key]['error'] === 0) {
            $ext = pathinfo($_FILES[$key]['name'], PATHINFO_EXTENSION);
            $fname = 'opt_' . $upper . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
            if (move_uploaded_file($_FILES[$key]['tmp_name'], $uploadDir . $fname)) {
                $gambar_pilihan[$upper] = $fname;
                if (isset($old_gambar_pilihan[$upper]) && file_exists($uploadDir . $old_gambar_pilihan[$upper])) {
                    unlink($uploadDir . $old_gambar_pilihan[$upper]);
                }
            }
        } else {
            if (isset($old_gambar_pilihan[$upper])) {
                if (isset($_POST[$removeKey]) && $_POST[$removeKey] === '1') {
                    if (file_exists($uploadDir . $old_gambar_pilihan[$upper])) unlink($uploadDir . $old_gambar_pilihan[$upper]);
                } else {
                    $gambar_pilihan[$upper] = $old_gambar_pilihan[$upper];
                }
            }
        }
    }
    
    $gambarPilihanJson = json_encode((object)$gambar_pilihan);

    if ($isEdit) {
        $id = $oldSoal['id'];
        $stmt = $pdo->prepare("UPDATE soal SET sesi=?, kategori=?, tipe=?, soal=?, pilihan=?, jawaban=?, gambar=?, gambar_pilihan=? WHERE id=?");
        $res = $stmt->execute([$category, $kategori, $tipe, $soal, $pilihan, $jawaban, $gambar, $gambarPilihanJson, $id]);
    } else {
        $id = $category . '_' . bin2hex(random_bytes(4));
        $stmt = $pdo->prepare("INSERT INTO soal (id, sesi, kategori, tipe, soal, pilihan, jawaban, gambar, gambar_pilihan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $res = $stmt->execute([$id, $category, $kategori, $tipe, $soal, $pilihan, $jawaban, $gambar, $gambarPilihanJson]);
    }
    
    if ($res) {
        echo json_encode(['status' => 'success', 'message' => 'Soal berhasil disimpan']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan database']);
    }
} 
elseif ($method === 'DELETE') {
    $category = $_GET['cat'] ?? '';
    $index = (int)($_GET['index'] ?? -1);
    
    $stmt = $pdo->prepare("SELECT * FROM soal WHERE sesi = ? ORDER BY created_at ASC LIMIT 1 OFFSET ?");
    $stmt->bindValue(1, $category, PDO::PARAM_STR);
    $stmt->bindValue(2, $index, PDO::PARAM_INT);
    $stmt->execute();
    $soal = $stmt->fetch();

    if ($soal) {
        if (!empty($soal['gambar']) && file_exists($uploadDir . $soal['gambar'])) {
            unlink($uploadDir . $soal['gambar']);
        }
        $gp = json_decode($soal['gambar_pilihan'], true);
        if ($gp && is_array($gp)) {
            foreach ($gp as $img) {
                if (!empty($img) && file_exists($uploadDir . $img)) unlink($uploadDir . $img);
            }
        }

        $delStmt = $pdo->prepare("DELETE FROM soal WHERE id = ?");
        $delStmt->execute([$soal['id']]);
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Soal tidak ditemukan']);
    }
}
?>
