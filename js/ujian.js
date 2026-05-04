// =============================================
// LOGIKA UJIAN CBT
// =============================================

// State aplikasi
let state = {
  sesiIndex: 0,         // sesi saat ini (0=Pedagogik, 1=Profesional)
  soalIndex: 0,         // nomor soal saat ini dalam sesi
  jawaban: [],          // array jawaban per sesi: [{key: nilai}, ...]
  flagged: [],          // array soal ditandai per sesi: [Set, Set]
  timer: null,          // interval timer
  timeLeft: 0,          // sisa waktu (detik)
  selesai: false,       // apakah ujian sudah selesai
};

const PROGRESS_KEY = 'cbt_exam_progress';
const EXAM_DONE_KEY = 'cbt_exam_completed';

// ─────────────────────────────────────────────
// INISIALISASI
// ─────────────────────────────────────────────
async function initUjian() {
  // Tunggu sinkronisasi soal dari server PHP
  const isSynced = await syncSoalFromServer();
  if (!isSynced) {
    alert("Gagal memuat soal dari server. Hubungi admin.");
    return;
  }

  // Load data peserta
  const peserta = JSON.parse(sessionStorage.getItem('peserta_ujian') || '{}');
  if (!peserta.nama) {
    window.location.href = 'index.html';
    return;
  }

  // ── Cek apakah ujian sudah pernah diselesaikan ──
  if (isExamCompleted(peserta.nik)) {
    showExamLockedModal();
    return;
  }

  // Init state jawaban & flagged untuk semua sesi
  SESI_CONFIG.forEach((sesi, i) => {
    state.jawaban[i] = {};
    state.flagged[i] = new Set();
  });

  // Tampilkan info peserta di header
  const el = document.getElementById('peserta-info');
  if (el) el.textContent = peserta.nama;

  // ── Cek apakah ada progress tersimpan ──
  const saved = loadProgress();
  if (saved) {
    showRecoveryModal(saved);
    return; // Tunggu user pilih Lanjutkan atau Mulai Ulang
  }

  // Mulai sesi pertama (fresh)
  renderSesiTabs();
  startSesi(0);
}

// ─────────────────────────────────────────────
// SESI
// ─────────────────────────────────────────────
function startSesi(index, resumeTime) {
  state.sesiIndex = index;
  state.soalIndex = 0;
  // Gunakan resumeTime jika ada (dari recovery), jika tidak pakai durasi penuh
  state.timeLeft = resumeTime !== undefined ? resumeTime : SESI_CONFIG[index].durasi;

  renderSesiTabs();
  renderQGrid();
  renderSoal();
  startTimer();
  updateProgress();
  saveProgress(); // auto-save saat mulai sesi
}

function renderSesiTabs() {
  const container = document.getElementById('session-tabs');
  if (!container) return;

  container.innerHTML = '';
  SESI_CONFIG.forEach((sesi, i) => {
    const tab = document.createElement('div');
    tab.id = `tab-sesi-${i}`;
    tab.className = 'session-tab';
    if (i === state.sesiIndex) tab.classList.add('active');
    else if (i < state.sesiIndex) tab.classList.add('done');

    const totalSoal = sesi.soal.length;
    const menit = Math.round(sesi.durasi / 60);

    tab.innerHTML = `
      <div class="session-tab-num">${i + 1}</div>
      <div>
        <div style="font-weight:600; font-size:0.82rem;">${sesi.singkatan}</div>
        <div style="font-size:0.72rem; opacity:0.7;">${totalSoal} soal · ${menit} mnt</div>
      </div>
    `;
    container.appendChild(tab);
  });

  // Update header sesi
  const sesi = SESI_CONFIG[state.sesiIndex];
  setEl('session-name', sesi.nama);
  setEl('session-label', `Sesi ${state.sesiIndex + 1} dari ${SESI_CONFIG.length}`);
}

// ─────────────────────────────────────────────
// TIMER
// ─────────────────────────────────────────────
function startTimer() {
  clearInterval(state.timer);
  updateTimerDisplay();

  state.timer = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();

    // Auto-save timer setiap 5 detik
    if (state.timeLeft % 5 === 0) saveProgress();

    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      // Simpan progress terakhir sebelum auto-submit
      saveProgress();
      // Tampilkan modal tenang bahwa jawaban tersimpan
      showTimeUpModal();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const menit = Math.floor(state.timeLeft / 60);
  const detik = state.timeLeft % 60;
  const str = `${String(menit).padStart(2, '0')}:${String(detik).padStart(2, '0')}`;

  const timerEl = document.getElementById('timer-display');
  const timerBox = document.getElementById('timer-box');
  if (timerEl) timerEl.textContent = str;

  if (timerBox) {
    timerBox.className = 'timer-box';
    if (state.timeLeft <= 60) timerBox.classList.add('critical');
    else if (state.timeLeft <= 300) timerBox.classList.add('warning');
  }
}

// ─────────────────────────────────────────────
// RENDER SOAL
// ─────────────────────────────────────────────
function renderSoal() {
  const sesi = SESI_CONFIG[state.sesiIndex];
  const soal = sesi.soal[state.soalIndex];
  const jawaban = state.jawaban[state.sesiIndex];
  const isFlagged = state.flagged[state.sesiIndex].has(state.soalIndex);
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const isMulti = soal.tipe === 'multi';

  // Update nomor soal
  setEl('q-number', `Soal ${state.soalIndex + 1} dari ${sesi.soal.length}`);
  setEl('q-kategori', soal.kategori);

  // Badge tipe soal
  const qKategoriEl = document.getElementById('q-kategori');
  if (qKategoriEl) {
    // Hapus badge lama jika ada
    const oldBadge = document.getElementById('tipe-badge');
    if (oldBadge) oldBadge.remove();
    // Tambah badge tipe multi jika perlu
    if (isMulti) {
      const badge = document.createElement('span');
      badge.id = 'tipe-badge';
      badge.style.cssText = 'display:inline-block;margin-left:8px;background:#fef3c7;color:#92400e;font-size:0.65rem;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #fde68a;vertical-align:middle;';
      badge.textContent = '✔ Multi Jawab — Pilih lebih dari satu';
      qKategoriEl.insertAdjacentElement('afterend', badge);
    }
  }

  // Update teks soal
  const qtextEl = document.getElementById('question-text');
  if (qtextEl) qtextEl.textContent = soal.soal;

  // Tampilkan gambar jika ada
  const imgEl = document.getElementById('question-image');
  if (imgEl) {
    if (soal.gambar) {
      imgEl.src = 'uploads/' + soal.gambar;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }
  }

  // Jawaban saat ini
  const currentAnswer = jawaban[state.soalIndex]; // string (single) atau array (multi)

  // Cek apakah soal punya gambar per pilihan
  const gp = soal.gambar_pilihan || {};

  // Render pilihan
  const optList = document.getElementById('options-list');
  if (optList) {
    optList.innerHTML = '';

    if (isMulti) {
      // ── Multi-jawab: checkbox ──
      soal.pilihan.forEach((opsi, idx) => {
        const letter = letters[idx];
        const opsiText = opsi.substring(3).trim();
        const hasImg = gp[letter];
        if (!opsiText && !hasImg) return; // Skip opsi kosong
        const isChecked = Array.isArray(currentAnswer) && currentAnswer.includes(letter);
        const optionImg = hasImg ? `<img src="uploads/${gp[letter]}" class="option-image" alt="Gambar ${letter}" onclick="event.stopPropagation(); showLightbox(this.src)">` : '';
        const div = document.createElement('div');
        div.className = 'option-item option-multi' + (isChecked ? ' selected-multi' : '');
        div.setAttribute('data-letter', letter);
        div.innerHTML = `
          <input type="checkbox" name="answer-multi" value="${letter}" ${isChecked ? 'checked' : ''}>
          <div class="option-letter option-letter-multi">${letter}</div>
          <div class="option-text">${opsiText}${optionImg}</div>
        `;
        div.addEventListener('click', () => toggleMultiJawaban(letter));
        optList.appendChild(div);
      });
    } else {
      // ── Pilihan tunggal: radio ──
      soal.pilihan.forEach((opsi, idx) => {
        const letter = letters[idx];
        const opsiText = opsi.substring(3).trim();
        const hasImg = gp[letter];
        if (!opsiText && !hasImg) return; // Skip opsi kosong
        const isSelected = jawaban[state.soalIndex] === letter;
        const optionImg = hasImg ? `<img src="uploads/${gp[letter]}" class="option-image" alt="Gambar ${letter}" onclick="event.stopPropagation(); showLightbox(this.src)">` : '';
        const div = document.createElement('div');
        div.className = 'option-item' + (isSelected ? ' selected' : '');
        div.setAttribute('data-letter', letter);
        div.innerHTML = `
          <input type="radio" name="answer" value="${letter}" ${isSelected ? 'checked' : ''}>
          <div class="option-letter">${letter}</div>
          <div class="option-text">${opsiText}${optionImg}</div>
        `;
        div.addEventListener('click', () => pilihJawaban(letter));
        optList.appendChild(div);
      });
    }
  }

  // ── Render KaTeX math formulas ──
  try {
    if (window.renderMathInElement) {
      const qCard = document.getElementById('question-card');
      if (qCard) {
        renderMathInElement(qCard, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }
    }
  } catch(e) { /* KaTeX not loaded yet, skip */ }

  // Update tombol flag
  const flagBtn = document.getElementById('btn-flag');
  if (flagBtn) {
    flagBtn.className = 'btn-flag' + (isFlagged ? ' flagged' : '');
    flagBtn.innerHTML = isFlagged ? 'Ditandai' : 'Tandai';
  }

  // Update tombol prev/next
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  if (prevBtn) prevBtn.disabled = state.soalIndex === 0;
  if (nextBtn) {
    const isLast = state.soalIndex === sesi.soal.length - 1;
    nextBtn.textContent = isLast ? 'Selesai Sesi ›' : 'Berikutnya →';
  }

  // Highlight q-grid
  highlightQGrid();
  updateProgress();
  updateSubmitStats();
}

function pilihJawaban(letter) {
  state.jawaban[state.sesiIndex][state.soalIndex] = letter;
  renderSoal();
  renderQGrid();
  saveProgress();
  showToast(`Jawaban ${letter} dipilih`, 'success');
}

function toggleMultiJawaban(letter) {
  const current = state.jawaban[state.sesiIndex][state.soalIndex];
  let arr = Array.isArray(current) ? [...current] : [];
  const idx = arr.indexOf(letter);
  if (idx === -1) {
    arr.push(letter);
    arr.sort();
    showToast(`+${letter} dipilih`, 'success');
  } else {
    arr.splice(idx, 1);
    showToast(`${letter} dibatalkan`, 'info');
  }
  // Jika array kosong, hapus jawaban (belum menjawab)
  if (arr.length === 0) {
    delete state.jawaban[state.sesiIndex][state.soalIndex];
  } else {
    state.jawaban[state.sesiIndex][state.soalIndex] = arr;
  }
  renderSoal();
  renderQGrid();
  saveProgress();
}

// ─────────────────────────────────────────────
// GRID NOMOR SOAL
// ─────────────────────────────────────────────
function renderQGrid() {
  const sesi = SESI_CONFIG[state.sesiIndex];
  const grid = document.getElementById('q-grid');
  if (!grid) return;

  grid.innerHTML = '';
  sesi.soal.forEach((_, idx) => {
    const btn = document.createElement('button');
    btn.className = getQBtnClass(idx);
    btn.textContent = idx + 1;
    btn.title = `Soal ${idx + 1}`;
    btn.addEventListener('click', () => goToSoal(idx));
    grid.appendChild(btn);
  });
}

function getQBtnClass(idx) {
  let cls = 'q-btn';
  const answered = state.jawaban[state.sesiIndex][idx] !== undefined;
  const flagged = state.flagged[state.sesiIndex].has(idx);
  if (idx === state.soalIndex) cls += ' current';
  else if (flagged) cls += ' flagged';
  else if (answered) cls += ' answered';
  return cls;
}

function highlightQGrid() {
  const btns = document.querySelectorAll('#q-grid .q-btn');
  btns.forEach((btn, idx) => {
    btn.className = getQBtnClass(idx);
  });
}

function goToSoal(idx) {
  state.soalIndex = idx;
  renderSoal();
  saveProgress();
}

// ─────────────────────────────────────────────
// NAVIGASI
// ─────────────────────────────────────────────
function prevSoal() {
  if (state.soalIndex > 0) {
    state.soalIndex--;
    renderSoal();
    saveProgress();
  }
}

function nextSoal() {
  const sesi = SESI_CONFIG[state.sesiIndex];
  if (state.soalIndex < sesi.soal.length - 1) {
    state.soalIndex++;
    renderSoal();
  } else {
    // Soal terakhir dalam sesi
    showKonfirmasiSesi();
  }
}

function toggleFlag() {
  const flagSet = state.flagged[state.sesiIndex];
  if (flagSet.has(state.soalIndex)) {
    flagSet.delete(state.soalIndex);
    showToast('Tanda dilepas', 'info');
  } else {
    flagSet.add(state.soalIndex);
    showToast('Soal ditandai', 'warning');
  }
  renderSoal();
  renderQGrid();
  saveProgress();
}

// ─────────────────────────────────────────────
// PROGRESS & STATS
// ─────────────────────────────────────────────
function updateProgress() {
  const sesi = SESI_CONFIG[state.sesiIndex];
  const total = sesi.soal.length;
  const answered = Object.keys(state.jawaban[state.sesiIndex]).length;
  const pct = Math.round((answered / total) * 100);

  const fillEl = document.getElementById('progress-fill');
  const labelAnswered = document.getElementById('progress-answered');
  const labelTotal = document.getElementById('progress-total');

  if (fillEl) fillEl.style.width = pct + '%';
  if (labelAnswered) labelAnswered.textContent = answered;
  if (labelTotal) labelTotal.textContent = total;
}

function updateSubmitStats() {
  const sesi = SESI_CONFIG[state.sesiIndex];
  const total = sesi.soal.length;
  const answered = Object.keys(state.jawaban[state.sesiIndex]).length;
  const flagged = state.flagged[state.sesiIndex].size;
  const empty = total - answered;

  setEl('stat-answered', answered);
  setEl('stat-flagged', flagged);
  setEl('stat-empty', empty);
}

// ─────────────────────────────────────────────
// KONFIRMASI & LANJUT SESI
// ─────────────────────────────────────────────
function showKonfirmasiSesi() {
  const sesi = SESI_CONFIG[state.sesiIndex];
  const total = sesi.soal.length;
  const answered = Object.keys(state.jawaban[state.sesiIndex]).length;
  const empty = total - answered;
  const isLast = state.sesiIndex === SESI_CONFIG.length - 1;

  const modal = document.getElementById('modal-konfirmasi');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const btnConfirm = document.getElementById('modal-confirm');

  if (modalTitle) modalTitle.textContent = isLast ? 'Selesaikan Ujian?' : `Selesaikan Sesi ${sesi.singkatan}?`;
  if (modalText) modalText.innerHTML = `
    Anda telah menjawab <strong>${answered}</strong> dari <strong>${total}</strong> soal.<br>
    ${empty > 0 ? `<span style="color:var(--accent-amber)">${empty} soal belum dijawab!</span>` : 'Semua soal sudah dijawab.'}
    <br><br>${isLast ? 'Klik <strong>Selesai</strong> untuk mengakhiri ujian.' : 'Klik <strong>Lanjutkan</strong> untuk ke sesi berikutnya.'}
  `;
  if (btnConfirm) btnConfirm.textContent = isLast ? 'Selesai Ujian' : 'Lanjutkan →';

  showModal('modal-konfirmasi');
}

function konfirmasiLanjut() {
  hideModal('modal-konfirmasi');
  nextSesi(false);
}

function nextSesi(auto = false) {
  clearInterval(state.timer);

  if (state.sesiIndex < SESI_CONFIG.length - 1) {
    state.sesiIndex++;
    renderSesiTabs();
    startSesi(state.sesiIndex);
    showToast(`Memasuki sesi ${SESI_CONFIG[state.sesiIndex].singkatan}`, 'info');
  } else {
    selesaiUjian();
  }
}

// ─────────────────────────────────────────────
// SELESAI UJIAN
// ─────────────────────────────────────────────
function selesaiUjian() {
  clearInterval(state.timer);
  state.selesai = true;

  // Hitung skor
  const hasil = SESI_CONFIG.map((sesi, i) => {
    let benar = 0;
    sesi.soal.forEach((q, idx) => {
      const jawabanPeserta = state.jawaban[i][idx];
      if (q.tipe === 'multi') {
        // Multi-jawab: semua harus tepat (strict)
        if (Array.isArray(jawabanPeserta) && Array.isArray(q.jawaban)) {
          const sortedPeserta = [...jawabanPeserta].sort().join(',');
          const sortedKunci   = [...q.jawaban].sort().join(',');
          if (sortedPeserta === sortedKunci) benar++;
        }
      } else {
        if (jawabanPeserta === q.jawaban) benar++;
      }
    });
    const skor = Math.round((benar / sesi.soal.length) * 100);
    return { benar, total: sesi.soal.length, skor };
  });

  const waktuSelesai = new Date().toISOString();

  // Simpan ke sessionStorage
  sessionStorage.setItem('hasil_ujian', JSON.stringify({
    sesi: hasil,
    jawaban: state.jawaban.map((j) => ({ ...j })),
    flagged: state.flagged.map((f) => [...f]),
    waktu_selesai: waktuSelesai,
  }));

  // ── BACKUP HASIL KE LOCAL STORAGE (ANTI-HILANG) ──
  const peserta = JSON.parse(sessionStorage.getItem('peserta_ujian') || '{}');
  localStorage.setItem('cbt_unsent_result', JSON.stringify({
    peserta: peserta,
    hasil: hasil,
    waktu_selesai: waktuSelesai
  }));

  // Hapus progress tersimpan (ujian sudah selesai)
  clearProgress();
  sessionStorage.removeItem('cbt_exam_questions');

  // ── Tandai ujian sebagai selesai (cegah ujian ulang) ──
  markExamCompleted();

  // Redirect ke halaman hasil
  window.location.href = 'hasil.html';
}

// ─────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────
function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ─────────────────────────────────────────────
// HTML HELPER
// ─────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Lightbox untuk zoom gambar pilihan ──
function showLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'img-lightbox';
  overlay.innerHTML = `<img src="${src}" alt="Zoom">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
  const handler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', handler); } };
  document.addEventListener('keydown', handler);
}

// ─────────────────────────────────────────────
// AUTO-SAVE & RECOVERY SYSTEM
// ─────────────────────────────────────────────
function saveProgress() {
  if (state.selesai) return;
  try {
    const data = {
      sesiIndex: state.sesiIndex,
      soalIndex: state.soalIndex,
      timeLeft: state.timeLeft,
      jawaban: state.jawaban.map(j => ({ ...j })),
      flagged: state.flagged.map(f => [...f]),
      savedAt: Date.now(),
    };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch(e) { /* storage full, ignore */ }
}

function loadProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Validasi: progress tidak lebih dari 4 jam
    if (Date.now() - data.savedAt > 4 * 60 * 60 * 1000) {
      clearProgress();
      return null;
    }
    return data;
  } catch(e) { return null; }
}

function clearProgress() {
  sessionStorage.removeItem(PROGRESS_KEY);
}

function restoreProgress(saved) {
  // Restore jawaban
  if (saved.jawaban) {
    saved.jawaban.forEach((j, i) => {
      if (i < SESI_CONFIG.length) state.jawaban[i] = j || {};
    });
  }
  // Restore flagged (array → Set)
  if (saved.flagged) {
    saved.flagged.forEach((f, i) => {
      if (i < SESI_CONFIG.length) state.flagged[i] = new Set(f || []);
    });
  }
  // Restore posisi
  state.sesiIndex = saved.sesiIndex || 0;
  state.soalIndex = saved.soalIndex || 0;

  // Mulai sesi dengan sisa waktu
  renderSesiTabs();
  startSesi(state.sesiIndex, saved.timeLeft);
  // Navigate ke soal terakhir yang dikerjakan
  state.soalIndex = saved.soalIndex || 0;
  renderSoal();
  renderQGrid();
  updateProgress();
  updateSubmitStats();
}

function showRecoveryModal(saved) {
  // Hitung info progress
  const totalAnswered = saved.jawaban
    ? saved.jawaban.reduce((sum, j) => sum + Object.keys(j || {}).length, 0)
    : 0;
  const sesiName = SESI_CONFIG[saved.sesiIndex]?.singkatan || 'Sesi 1';
  const timeStr = Math.floor((saved.timeLeft || 0) / 60) + ' menit ' + ((saved.timeLeft || 0) % 60) + ' detik';

  // Buat modal recovery
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'modal-recovery';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:500px; text-align:center; padding:2.5rem;">
      <div style="width:72px;height:72px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:2rem;box-shadow:0 8px 24px rgba(245,158,11,0.25);">
        🔄
      </div>
      <h2 style="font-family:'Outfit',sans-serif;font-size:1.5rem;font-weight:800;color:#1e293b;margin-bottom:0.75rem;">
        Ujian Terdeteksi
      </h2>
      <p style="color:#64748b;font-size:0.95rem;line-height:1.7;margin-bottom:1.5rem;">
        Halaman ter-refresh saat ujian berlangsung.<br>
        Progress Anda masih tersimpan.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin-bottom:2rem;text-align:left;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#94a3b8;font-size:0.82rem;font-weight:600;">Sesi Terakhir</span>
          <span style="font-weight:700;color:#1e293b;font-size:0.85rem;">${sesiName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#94a3b8;font-size:0.82rem;font-weight:600;">Soal Terjawab</span>
          <span style="font-weight:700;color:#22c55e;font-size:0.85rem;">${totalAnswered} soal</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="color:#94a3b8;font-size:0.82rem;font-weight:600;">Sisa Waktu</span>
          <span style="font-weight:700;color:#dc2626;font-size:0.85rem;">${timeStr}</span>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-direction:column;">
        <button onclick="resumeExam()" style="padding:0.9rem 2rem;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;border:none;border-radius:12px;font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,0.3);transition:all 0.2s ease;">
          ▶ Lanjutkan Ujian
        </button>
        <button onclick="restartExam()" style="padding:0.75rem 2rem;background:transparent;color:#94a3b8;border:1px solid #e2e8f0;border-radius:12px;font-weight:600;font-size:0.85rem;cursor:pointer;transition:all 0.2s ease;">
          Mulai Ulang dari Awal
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function resumeExam() {
  const saved = loadProgress();
  const modal = document.getElementById('modal-recovery');
  if (modal) modal.remove();
  if (saved) {
    restoreProgress(saved);
    showToast('✅ Progress berhasil dipulihkan!', 'success');
  } else {
    renderSesiTabs();
    startSesi(0);
  }
}

function restartExam() {
  clearProgress();
  const modal = document.getElementById('modal-recovery');
  if (modal) modal.remove();
  // Reset state
  SESI_CONFIG.forEach((sesi, i) => {
    state.jawaban[i] = {};
    state.flagged[i] = new Set();
  });
  renderSesiTabs();
  startSesi(0);
  showToast('Ujian dimulai dari awal', 'info');
}

// ─────────────────────────────────────────────
// WAKTU HABIS — MODAL TENANG (Anti Panik)
// ─────────────────────────────────────────────
function showTimeUpModal() {
  const sesi = SESI_CONFIG[state.sesiIndex];
  const total = sesi.soal.length;
  const answered = Object.keys(state.jawaban[state.sesiIndex]).length;
  const isLast = state.sesiIndex === SESI_CONFIG.length - 1;

  // Hapus modal lama jika ada
  const oldModal = document.getElementById('modal-timeup');
  if (oldModal) oldModal.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'modal-timeup';
  overlay.style.zIndex = '10000';

  const nextAction = isLast ? 'Menghitung hasil ujian...' : `Melanjutkan ke sesi ${SESI_CONFIG[state.sesiIndex + 1]?.singkatan || 'berikutnya'}...`;

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px; text-align:center; padding:2.5rem; animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
      <div style="width:80px;height:80px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:2.2rem;box-shadow:0 8px 24px rgba(34,197,94,0.2);">
        ✅
      </div>
      <h2 style="font-family:'Outfit',sans-serif;font-size:1.5rem;font-weight:800;color:#0f172a;margin-bottom:0.5rem;">
        Waktu Sesi Habis
      </h2>
      <p style="color:#22c55e;font-size:0.9rem;font-weight:700;margin-bottom:1rem;">
        ✓ Semua jawaban Anda sudah otomatis tersimpan!
      </p>
      <p style="color:#64748b;font-size:0.88rem;line-height:1.7;margin-bottom:1.5rem;">
        Tenang, tidak perlu khawatir. Jawaban yang sudah Anda pilih<br>
        telah disimpan oleh sistem secara otomatis.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:1rem;margin-bottom:1.5rem;text-align:left;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #dcfce7;">
          <span style="color:#6b7280;font-size:0.82rem;font-weight:600;">Sesi</span>
          <span style="font-weight:700;color:#0f172a;font-size:0.85rem;">${sesi.singkatan}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #dcfce7;">
          <span style="color:#6b7280;font-size:0.82rem;font-weight:600;">Soal Terjawab</span>
          <span style="font-weight:700;color:#22c55e;font-size:0.85rem;">${answered} dari ${total} soal</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;">
          <span style="color:#6b7280;font-size:0.82rem;font-weight:600;">Status</span>
          <span style="font-weight:700;color:#22c55e;font-size:0.85rem;">✓ Tersimpan Aman</span>
        </div>
      </div>
      <p style="color:#94a3b8;font-size:0.82rem;margin-bottom:1rem;">
        ${nextAction}
      </p>
      <div style="width:100%;height:4px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
        <div id="timeup-progress" style="height:100%;background:linear-gradient(90deg,#22c55e,#10b981);border-radius:99px;width:0%;transition:width 0.1s linear;"></div>
      </div>
      <p style="color:#94a3b8;font-size:0.75rem;margin-top:0.5rem;" id="timeup-countdown">Otomatis lanjut dalam 5 detik...</p>
    </div>
  `;
  document.body.appendChild(overlay);

  // Countdown & auto-advance
  let countdown = 5;
  const progressBar = document.getElementById('timeup-progress');
  const countdownText = document.getElementById('timeup-countdown');
  const countdownInterval = setInterval(() => {
    countdown--;
    const pct = ((5 - countdown) / 5) * 100;
    if (progressBar) progressBar.style.width = pct + '%';
    if (countdownText) countdownText.textContent = `Otomatis lanjut dalam ${countdown} detik...`;
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      overlay.remove();
      nextSesi(true);
    }
  }, 1000);
}

// ─────────────────────────────────────────────
// EXAM LOCK — CEGAH UJIAN ULANG
// ─────────────────────────────────────────────
function getCompletedExams() {
  try {
    return JSON.parse(localStorage.getItem(EXAM_DONE_KEY) || '[]');
  } catch(e) { return []; }
}

function isExamCompleted(nik) {
  if (!nik) return false;
  const completed = getCompletedExams();
  return completed.some(entry => entry.nik === nik);
}

function markExamCompleted() {
  const peserta = JSON.parse(sessionStorage.getItem('peserta_ujian') || '{}');
  if (!peserta.nik) return;
  const completed = getCompletedExams();
  // Cek duplikat
  if (!completed.some(e => e.nik === peserta.nik)) {
    completed.push({
      nik: peserta.nik,
      nama: peserta.nama,
      waktu: new Date().toISOString(),
    });
    localStorage.setItem(EXAM_DONE_KEY, JSON.stringify(completed));
  }
}

function showExamLockedModal() {
  const peserta = JSON.parse(sessionStorage.getItem('peserta_ujian') || '{}');
  const completed = getCompletedExams();
  const entry = completed.find(e => e.nik === peserta.nik);
  const waktu = entry ? new Date(entry.waktu).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '–';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'modal-locked';
  overlay.style.zIndex = '10000';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px; text-align:center; padding:2.5rem; animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
      <div style="width:80px;height:80px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:2.2rem;box-shadow:0 8px 24px rgba(245,158,11,0.2);">
        🔒
      </div>
      <h2 style="font-family:'Outfit',sans-serif;font-size:1.5rem;font-weight:800;color:#0f172a;margin-bottom:0.75rem;">
        Ujian Sudah Selesai
      </h2>
      <p style="color:#64748b;font-size:0.9rem;line-height:1.7;margin-bottom:1.5rem;">
        Anda sudah menyelesaikan ujian ini sebelumnya.<br>
        Setiap peserta hanya dapat mengerjakan ujian <strong>satu kali</strong>.
      </p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:1rem;margin-bottom:1.5rem;text-align:left;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #fef3c7;">
          <span style="color:#92400e;font-size:0.82rem;font-weight:600;">Peserta</span>
          <span style="font-weight:700;color:#0f172a;font-size:0.85rem;">${peserta.nama || '–'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #fef3c7;">
          <span style="color:#92400e;font-size:0.82rem;font-weight:600;">NIK</span>
          <span style="font-weight:700;color:#0f172a;font-size:0.85rem;">${peserta.nik || '–'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;">
          <span style="color:#92400e;font-size:0.82rem;font-weight:600;">Diselesaikan</span>
          <span style="font-weight:700;color:#0f172a;font-size:0.85rem;">${waktu}</span>
        </div>
      </div>
      <p style="color:#94a3b8;font-size:0.82rem;margin-bottom:1.5rem;">
        Jika Anda merasa ini adalah kesalahan, silakan hubungi admin/pengawas ujian.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <a href="hasil.html" style="padding:0.85rem 2rem;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;border:none;border-radius:12px;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,0.3);text-decoration:none;display:inline-block;">
          📊 Lihat Hasil Ujian
        </a>
        <a href="index.html" style="padding:0.85rem 2rem;background:transparent;color:#64748b;border:1px solid #e2e8f0;border-radius:12px;font-weight:600;font-size:0.85rem;cursor:pointer;text-decoration:none;display:inline-block;">
          ← Kembali ke Beranda
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ─────────────────────────────────────────────
// EVENT LISTENERS - KEYBOARD NAVIGATION
// ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (!state || state.selesai) return;
  const key = e.key.toUpperCase();
  const sesi = SESI_CONFIG[state.sesiIndex];
  const soal = sesi?.soal[state.soalIndex];
  const isMulti = soal?.tipe === 'multi';

  if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
    if (isMulti) {
      toggleMultiJawaban(key);
    } else {
      pilihJawaban(key);
    }
  } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
    nextSoal();
  } else if (e.key === 'ArrowLeft') {
    prevSoal();
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFlag();
  }
});

// Cegah tutup tab/browser
window.addEventListener('beforeunload', (e) => {
  if (!state.selesai) {
    e.preventDefault();
    e.returnValue = 'Ujian sedang berlangsung. Yakin ingin meninggalkan halaman?';
  }
});

// Start saat DOM ready
document.addEventListener('DOMContentLoaded', initUjian);
