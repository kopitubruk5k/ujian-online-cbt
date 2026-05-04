// =============================================
// BANK SOAL UJIAN CBT - PEDAGOGIK & PROFESIONAL
// =============================================

// Soal dikelola sepenuhnya dari Admin Panel (api.php / soal_custom.json)
// Tidak ada soal hardcoded — semua soal diambil dari server

let SOAL_PEDAGOGIK  = [];
let SOAL_PROFESIONAL = [];
let SESI_CONFIG = [];

// Fungsi shuffle array Fisher-Yates
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Fungsi untuk sinkronisasi soal dari PHP (Server)
async function syncSoalFromServer() {
  try {
    const cachedSoal = sessionStorage.getItem('cbt_exam_questions');
    let custom;

    if (cachedSoal) {
      custom = JSON.parse(cachedSoal);
    } else {
      const response = await fetch('api.php');
      custom = await response.json();
      
      // Acak urutan soal agar peserta mendapat soal yang berbeda-beda di sebelahnya
      if (custom.pedagogik) shuffleArray(custom.pedagogik);
      if (custom.profesional) shuffleArray(custom.profesional);
      
      // Simpan urutan soal yang sudah diacak agar urutan tidak berubah jika halaman di-refresh
      sessionStorage.setItem('cbt_exam_questions', JSON.stringify(custom));
    }

    // Gunakan HANYA soal dari server — tidak ditambah soal hardcoded
    SOAL_PEDAGOGIK  = custom.pedagogik  || [];
    SOAL_PROFESIONAL = custom.profesional || [];

    SESI_CONFIG = [
      {
        id: 'pedagogik',
        nama: 'Tes Kompetensi Pedagogik',
        singkatan: 'PED',
        durasi: 60 * 60, // 60 menit
        icon: '',
        soal: SOAL_PEDAGOGIK,
        passingGrade: 70
      },
      {
        id: 'profesional',
        nama: 'Tes Kompetensi Profesional',
        singkatan: 'PRO',
        durasi: 60 * 60, // 60 menit
        icon: '',
        soal: SOAL_PROFESIONAL,
        passingGrade: 70
      },
    ];

    return true;
  } catch (e) {
    console.error("Gagal load soal dari server:", e);

    // Fallback jika API gagal — array tetap kosong
    SESI_CONFIG = [
      { id: 'pedagogik',   nama: 'Tes Kompetensi Pedagogik',   singkatan: 'PED', durasi: 60*60, icon: '', soal: SOAL_PEDAGOGIK,  passingGrade: 70 },
      { id: 'profesional', nama: 'Tes Kompetensi Profesional', singkatan: 'PRO', durasi: 60*60, icon: '', soal: SOAL_PROFESIONAL, passingGrade: 70 },
    ];
    return false;
  }
}
