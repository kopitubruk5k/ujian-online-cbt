<?php
// setup_db.php - Setup Database dan Migrasi JSON
header('Content-Type: text/html; charset=utf-8');

require_once 'config.php';

echo "<div style='font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;'>";
echo "<h2>🛠️ Setup Database & Migrasi Data CBT</h2>";

try {
    // Di Hostinger/Shared Hosting, database sudah dibuat via cPanel.
    // Kita langsung terhubung ke database tersebut.
    $pdoSetup = getPDO();
    if (!$pdoSetup) {
        throw new PDOException("Gagal terhubung ke database. Cek config.php Anda!");
    }
    
    // 2. Create Tables
    $sql_soal = "CREATE TABLE IF NOT EXISTS `soal` (
        `id` VARCHAR(50) PRIMARY KEY,
        `sesi` VARCHAR(50) NOT NULL,
        `kategori` VARCHAR(100),
        `tipe` VARCHAR(20) DEFAULT 'single',
        `soal` TEXT NOT NULL,
        `pilihan` JSON,
        `jawaban` JSON,
        `gambar` VARCHAR(255),
        `gambar_pilihan` JSON,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $pdoSetup->exec($sql_soal);
    echo "<p style='color:green;'>✅ Tabel <b>soal</b> berhasil disiapkan.</p>";

    $sql_hasil = "CREATE TABLE IF NOT EXISTS `hasil_ujian` (
        `id` VARCHAR(50) PRIMARY KEY,
        `nik` VARCHAR(50),
        `nama` VARCHAR(150),
        `peserta` JSON,
        `hasil_sesi` JSON,
        `waktu_selesai` DATETIME,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $pdoSetup->exec($sql_hasil);
    echo "<p style='color:green;'>✅ Tabel <b>hasil_ujian</b> berhasil disiapkan.</p>";

    $sql_token = "CREATE TABLE IF NOT EXISTS `pengaturan` (
        `id` INT PRIMARY KEY DEFAULT 1,
        `active_token` VARCHAR(10) NOT NULL
    )";
    $pdoSetup->exec($sql_token);
    // Init token default if not exists
    $pdoSetup->exec("INSERT IGNORE INTO `pengaturan` (`id`, `active_token`) VALUES (1, 'CBT26')");
    echo "<p style='color:green;'>✅ Tabel <b>pengaturan</b> (Token) berhasil disiapkan.</p>";

    // 3. Migrate Data from soal_custom.json
    $jsonFile = 'soal_custom.json';
    if (file_exists($jsonFile)) {
        $data = json_decode(file_get_contents($jsonFile), true);
        if ($data) {
            $stmt = $pdoSetup->prepare("INSERT IGNORE INTO `soal` (`id`, `sesi`, `kategori`, `tipe`, `soal`, `pilihan`, `jawaban`, `gambar`, `gambar_pilihan`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $countSoal = 0;
            
            foreach (['pedagogik', 'profesional'] as $sesi) {
                if (isset($data[$sesi]) && is_array($data[$sesi])) {
                    foreach ($data[$sesi] as $q) {
                        $pilihanJson = json_encode($q['pilihan'] ?? []);
                        $jawabanJson = json_encode($q['jawaban'] ?? '');
                        $gambarPilihanJson = json_encode($q['gambar_pilihan'] ?? new stdClass());
                        
                        $q_id = $q['id'] ?? ($sesi . '_' . bin2hex(random_bytes(4)));
                        
                        $stmt->execute([
                            $q_id,
                            $sesi,
                            $q['kategori'] ?? 'Umum',
                            $q['tipe'] ?? 'single',
                            $q['soal'] ?? '',
                            $pilihanJson,
                            $jawabanJson,
                            $q['gambar'] ?? '',
                            $gambarPilihanJson
                        ]);
                        if ($stmt->rowCount() > 0) $countSoal++;
                    }
                }
            }
            echo "<p style='color:blue;'>ℹ️ Migrasi Soal selesai. <b>$countSoal</b> soal baru ditambahkan dari JSON.</p>";
        }
    }

    // 4. Migrate Data from hasil_peserta.json
    $hasilFile = 'hasil_peserta.json';
    if (file_exists($hasilFile)) {
        $hData = json_decode(file_get_contents($hasilFile), true);
        if ($hData && is_array($hData)) {
            $stmt = $pdoSetup->prepare("INSERT IGNORE INTO `hasil_ujian` (`id`, `nik`, `nama`, `peserta`, `hasil_sesi`, `waktu_selesai`) VALUES (?, ?, ?, ?, ?, ?)");
            $countHasil = 0;
            foreach ($hData as $h) {
                $h_id = $h['id'] ?? bin2hex(random_bytes(6));
                $nik = $h['peserta']['nik'] ?? '';
                $nama = $h['peserta']['nama'] ?? '';
                $pesertaJson = json_encode($h['peserta'] ?? []);
                $hasilSesiJson = json_encode($h['hasil'] ?? []);
                
                $waktu = $h['waktu_selesai'] ?? $h['disimpan_pada'] ?? date('Y-m-d H:i:s');
                $waktu_db = date('Y-m-d H:i:s', strtotime($waktu));

                $stmt->execute([$h_id, $nik, $nama, $pesertaJson, $hasilSesiJson, $waktu_db]);
                if ($stmt->rowCount() > 0) $countHasil++;
            }
            echo "<p style='color:blue;'>ℹ️ Migrasi Hasil selesai. <b>$countHasil</b> riwayat ujian ditambahkan dari JSON.</p>";
        }
    }

    echo "<hr><h3>🎉 Instalasi dan Migrasi Selesai!</h3>";
    echo "<p>Sistem Anda sekarang resmi menggunakan MySQL. Data JSON lama aman sebagai backup namun tidak digunakan lagi.</p>";
    echo "<p><a href='admin.html' style='background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;'>Kembali ke Panel Admin</a></p>";

} catch (PDOException $e) {
    echo "<p style='color:red;'>❌ <b>Kesalahan Database:</b> " . $e->getMessage() . "</p>";
    echo "<p>Pastikan XAMPP (MySQL) sudah berjalan.</p>";
}
echo "</div>";
?>
