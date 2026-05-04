<?php
// export_hasil.php - Export CSV & PDF hasil ujian peserta
require_once 'config.php';
$pdo = getPDO();

$format = $_GET['format'] ?? 'csv';

$data = [];
if ($pdo) {
    $stmt = $pdo->query("SELECT * FROM hasil_ujian ORDER BY waktu_selesai DESC");
    $results = $stmt->fetchAll();
    foreach ($results as $r) {
        $data[] = [
            'id' => $r['id'],
            'peserta' => json_decode($r['peserta'], true),
            'hasil' => json_decode($r['hasil_sesi'], true),
            'waktu_selesai' => $r['waktu_selesai']
        ];
    }
}

$tglCetak = date('d-m-Y H:i');
$tglFile  = date('d-m-Y');

// ──────────────── CSV ────────────────
if ($format === 'csv') {
    $filename = "Hasil_Ujian_CBT_{$tglFile}.csv";
    header('Content-Type: text/csv; charset=UTF-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache, no-store, must-revalidate');

    $out = fopen('php://output', 'w');
    // BOM UTF-8 agar Excel terbaca dengan benar
    fputs($out, "\xEF\xBB\xBF");

    // Header
    fputcsv($out, [
        'No','Nama Lengkap','NIK','Jenis Kelamin','Tempat Lahir','Tgl Lahir',
        'Pendidikan','No. HP','Email','Posisi Dilamar',
        'Skor Pedagogik','Benar Pedagogik','Total Pedagogik',
        'Skor Profesional','Benar Profesional','Total Profesional',
        'Rata-rata','Waktu Selesai'
    ]);

    foreach ($data as $i => $r) {
        $p   = $r['peserta'] ?? [];
        $ped = $r['hasil'][0] ?? ['skor'=>0,'benar'=>0,'total'=>0];
        $pro = $r['hasil'][1] ?? ['skor'=>0,'benar'=>0,'total'=>0];
        $avg = round(($ped['skor'] + $pro['skor']) / 2);
        $waktu = !empty($r['waktu_selesai'])
            ? date('d/m/Y H:i', strtotime($r['waktu_selesai'])) : '-';

        fputcsv($out, [
            $i + 1,
            $p['nama']         ?? '-',
            $p['nik']          ?? '-',
            $p['jk']           ?? '-',
            $p['tempat_lahir'] ?? '-',
            !empty($p['tgl_lahir']) ? date('d/m/Y', strtotime($p['tgl_lahir'])) : '-',
            $p['pendidikan']   ?? '-',
            $p['hp']           ?? '-',
            $p['email']        ?? '-',
            $p['posisi']       ?? '-',
            $ped['skor'],  $ped['benar'],  $ped['total'],
            $pro['skor'],  $pro['benar'],  $pro['total'],
            $avg,
            $waktu
        ]);
    }
    fclose($out);
    exit;
}

// ──────────────── PDF (HTML → Print) ────────────────
if ($format === 'pdf') {
    $filename = "Hasil_Ujian_CBT_{$tglFile}.pdf";
    $totalPeserta = count($data);
    $sumPed = 0; $sumPro = 0;
    foreach ($data as $r) {
        $sumPed += ($r['hasil'][0]['skor'] ?? 0);
        $sumPro += ($r['hasil'][1]['skor'] ?? 0);
    }
    $avgPed = $totalPeserta ? round($sumPed / $totalPeserta) : 0;
    $avgPro = $totalPeserta ? round($sumPro / $totalPeserta) : 0;
    $avgAll = round(($avgPed + $avgPro) / 2);

    $rows = '';
    foreach ($data as $i => $r) {
        $p   = $r['peserta'] ?? [];
        $ped = $r['hasil'][0] ?? ['skor'=>0,'benar'=>0,'total'=>0];
        $pro = $r['hasil'][1] ?? ['skor'=>0,'benar'=>0,'total'=>0];
        $avg = round(($ped['skor'] + $pro['skor']) / 2);
        $waktu = !empty($r['waktu_selesai'])
            ? date('d M Y H:i', strtotime($r['waktu_selesai'])) : '-';
        $rowBg = ($i % 2 === 0) ? '#ffffff' : '#f0f4ff';
        $avgColor = $avg >= 70 ? '#065f46' : ($avg >= 50 ? '#92400e' : '#991b1b');
        $avgBg    = $avg >= 70 ? '#d1fae5' : ($avg >= 50 ? '#fef3c7' : '#fee2e2');

        $rows .= "<tr style=\"background:{$rowBg};\">
            <td style=\"text-align:center;color:#94a3b8;font-weight:600;\">" . ($i+1) . "</td>
            <td><strong>" . htmlspecialchars($p['nama'] ?? '-') . "</strong><br>
                <span style=\"font-size:9px;color:#64748b;\">" . htmlspecialchars($p['nik'] ?? '') . "</span></td>
            <td>" . htmlspecialchars($p['posisi'] ?? '-') . "</td>
            <td>" . htmlspecialchars($p['pendidikan'] ?? '-') . "</td>
            <td style=\"text-align:center;\"><span style=\"font-weight:700;color:#1d4ed8;font-size:13px;\">" . $ped['skor'] . "</span><br>
                <span style=\"font-size:9px;color:#64748b;\">" . $ped['benar'] . "/" . $ped['total'] . " benar</span></td>
            <td style=\"text-align:center;\"><span style=\"font-weight:700;color:#065f46;font-size:13px;\">" . $pro['skor'] . "</span><br>
                <span style=\"font-size:9px;color:#64748b;\">" . $pro['benar'] . "/" . $pro['total'] . " benar</span></td>
            <td style=\"text-align:center;\"><span style=\"background:{$avgBg};color:{$avgColor};font-weight:800;font-size:14px;padding:3px 10px;border-radius:20px;\">" . $avg . "</span></td>
            <td style=\"font-size:10px;color:#475569;\">" . $waktu . "</td>
        </tr>\n";
    }

    header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Rekap Hasil Ujian CBT</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }

  .header {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
    color: white; padding: 20px 24px 16px; margin-bottom: 0;
  }
  .header h1 { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px; }
  .header p  { font-size: 11px; opacity: 0.75; margin-bottom: 2px; }
  .header-bar { height: 4px; background: linear-gradient(90deg, #60a5fa, #34d399, #818cf8); margin-bottom: 14px; }

  .summary {
    display: flex; gap: 12px; padding: 12px 24px; background: #f8fafc;
    border-bottom: 1px solid #e2e8f0; margin-bottom: 14px;
  }
  .sum-box {
    background: white; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 8px 16px; text-align: center; min-width: 100px;
  }
  .sum-box .val { font-size: 20px; font-weight: 800; color: #1e3a8a; }
  .sum-box .lbl { font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

  table { width: 100%; border-collapse: collapse; margin: 0 24px; width: calc(100% - 48px); }
  thead th {
    background: #1e3a8a; color: white; font-size: 10px; font-weight: 700;
    padding: 8px 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.3px;
  }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: middle; }
  tbody tr:hover { background: #eff6ff !important; }

  .footer {
    margin-top: 16px; padding: 10px 24px; border-top: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; color: #94a3b8; font-size: 9px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    @page { size: A4 landscape; margin: 10mm; }
  }

  .print-btn {
    position: fixed; top: 16px; right: 16px; z-index: 999;
    background: #2563eb; color: white; border: none; padding: 10px 20px;
    border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(37,99,235,0.3);
  }
  .print-btn:hover { background: #1d4ed8; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨️ Cetak / Save PDF</button>

<div class="header">
  <h1>REKAP HASIL UJIAN SELEKSI MASUK KERJA</h1>
  <p>Computer Based Test (CBT) – Sistem Ujian Digital</p>
  <p>Dicetak: <?= $tglCetak ?> &nbsp;|&nbsp; Total Peserta: <?= $totalPeserta ?></p>
</div>
<div class="header-bar"></div>

<div class="summary">
  <div class="sum-box">
    <div class="val"><?= $totalPeserta ?></div>
    <div class="lbl">Total Peserta</div>
  </div>
  <div class="sum-box" style="border-color:#bfdbfe;">
    <div class="val" style="color:#1d4ed8;"><?= $avgPed ?></div>
    <div class="lbl">Avg Pedagogik</div>
  </div>
  <div class="sum-box" style="border-color:#a7f3d0;">
    <div class="val" style="color:#065f46;"><?= $avgPro ?></div>
    <div class="lbl">Avg Profesional</div>
  </div>
  <div class="sum-box" style="border-color:#c7d2fe;">
    <div class="val" style="color:#4338ca;"><?= $avgAll ?></div>
    <div class="lbl">Avg Keseluruhan</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:30px;">No</th>
      <th>Nama Peserta</th>
      <th>Posisi Dilamar</th>
      <th>Pendidikan</th>
      <th style="text-align:center;">Pedagogik</th>
      <th style="text-align:center;">Profesional</th>
      <th style="text-align:center;">Rata-rata</th>
      <th>Waktu Selesai</th>
    </tr>
  </thead>
  <tbody>
    <?php if (empty($data)): ?>
    <tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">Belum ada data peserta.</td></tr>
    <?php else: ?>
    <?= $rows ?>
    <?php endif; ?>
  </tbody>
</table>

<div class="footer">
  <span>Sistem Ujian CBT – Seleksi Masuk Kerja</span>
  <span>Dicetak: <?= $tglCetak ?></span>
</div>

<script>
  // Auto trigger print dialog after page loads (for PDF save)
  window.addEventListener('load', function() {
    setTimeout(() => window.print(), 500);
  });
</script>
</body>
</html>
<?php
    exit;
}
?>
