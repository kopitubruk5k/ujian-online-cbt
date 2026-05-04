# 🧠 Ujian Online CBT
![GitHub repo size](https://img.shields.io/github/repo-size/kopitubruk5k/ujian-online-cbt)
![GitHub stars](https://img.shields.io/github/stars/kopitubruk5k/ujian-online-cbt?style=social)
![GitHub forks](https://img.shields.io/github/forks/kopitubruk5k/ujian-online-cbt?style=social)
![License](https://img.shields.io/badge/license-MIT-green)

**Ujian Online CBT (Computer Based Test)** adalah aplikasi berbasis web yang digunakan untuk mengelola ujian secara digital. Sistem ini mendukung pembuatan soal, pelaksanaan ujian, serta penilaian otomatis untuk meningkatkan efisiensi proses evaluasi pembelajaran.

---

## ✨ Features

- 🔐 **Authentication & Role Management**
  - Admin
  - Dosen / Guru
  - Mahasiswa / Siswa

- 📝 **Question Management**
  - Input dan edit soal
  - Kategori / mata pelajaran
  - Soal pilihan ganda

- ⏱ **Exam Management**
  - Penjadwalan ujian
  - Timer otomatis
  - Randomisasi soal (opsional)

- 📊 **Auto Grading System**
  - Penilaian otomatis
  - Rekap nilai
  - Riwayat ujian peserta

- 👨‍🎓 **User Management**
  - Data peserta
  - Kontrol akses berbasis role

---

## 🖥️ Demo

> Link demo: https://ujian-cbt.sdumsgc.com/

---

## 📸 Screenshots

<img width="500" height="500" alt="image" src="https://github.com/user-attachments/assets/d8386f85-6241-46df-bc08-3d1aae79d4b6" />
> Dashboard halaman ujian

---

## 🛠️ Tech Stack

- **Backend**: PHP (Laravel / Native PHP — sesuaikan)
- **Frontend**: HTML, CSS, JavaScript
- **Database**: MySQL
- **Server**: Apache / Nginx

---

## ⚙️ Installation

### 1. Clone Repository
```bash
git clone https://github.com/kopitubruk5k/ujian-online-cbt.git
cd ujian-online-cbt
```

### 2. Setup Environment
- Copy file `.env.example` menjadi `.env` (jika ada)
- Konfigurasi database:

```env
DB_DATABASE=your_db_name
DB_USERNAME=root
DB_PASSWORD=
```

### 3. Import Database
- Import file `.sql` ke MySQL melalui phpMyAdmin / CLI

### 4. Jalankan Server

Gunakan:
- XAMPP / Laragon / Localhost

atau:

```bash
php artisan serve
```

---

## 🧪 Usage

1. Login sebagai admin  
2. Tambahkan data:
   - User (guru / siswa)
   - Mata pelajaran
   - Soal ujian  
3. Buat jadwal ujian  
4. Peserta login dan mengikuti ujian  
5. Sistem akan otomatis menampilkan hasil  

---

## 📁 Project Structure

```
├── app/
├── config/
├── database/
├── public/
├── resources/
├── routes/
└── ...
```

---

## 🤝 Contributing

1. Fork repository  
2. Buat branch baru (`feature/nama-fitur`)  
3. Commit perubahan  
4. Push ke branch  
5. Buat Pull Request  

---

## 🐛 Issues

Jika menemukan bug atau ingin request fitur:
- Gunakan fitur **Issues** di GitHub  
- Sertakan deskripsi yang jelas dan langkah reproduksi  

---

## 📄 License

Project ini menggunakan lisensi **MIT License**

---

## 👨‍💻 Author

**Muhammad Mus'ab**

email: mm240@ums.ac.id

---

## ⭐ Support

- ⭐ Star repository ini  
- 🍴 Fork untuk pengembangan  
- 📢 Share ke yang lain  
