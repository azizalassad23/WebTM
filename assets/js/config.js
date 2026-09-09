/**
 * WebTM — konfigurasi aplikasi.
 *
 * Satu-satunya file yang perlu diubah guru saat memasang sistem ini.
 * Semua nilai di sini bersifat publik (situs statis), jadi jangan menaruh
 * rahasia yang sesungguhnya di sini — lihat catatan di README §Keamanan.
 */

export const APP = {
  name: 'WebTM',
  longName: 'Web Training Module',
  tagline: 'MODUL HTML & CSS INTERAKTIF',
  teacher: 'M. Aziz Al Assad, S.T., Gr.',
  year: 2026
};

/**
 * Endpoint Google Apps Script Web App.
 *
 * Isi `endpoint` dengan URL hasil Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone). Selama masih kosong, aplikasi
 * tetap berjalan penuh namun pengiriman data hanya disimpan di antrean lokal
 * dan ditandai "belum terkirim" agar tidak ada kegagalan senyap.
 */
export const SHEETS = {
  endpoint: 'https://script.google.com/macros/s/AKfycbzwNQ-JWCDkvIElVmTrneuPORSoCdXbGiVFK582kAcmXN0dAngmF55KiOYipwwGVMHY/exec',
  token: 'webtm-OfP6kvulluQE',
  /**
   * Apps Script memang lambat: satu penulisan baris memakan ~7 detik saat
   * server senggang, dan lebih lama lagi bila beberapa siswa submit berdekatan
   * (Google menjalankan permintaan web app milik satu akun secara berurutan).
   * Nilai 12 detik yang semula dipakai terlalu mepet — kiriman yang sebenarnya
   * berhasil ikut dibatalkan, lalu menumpuk di antrean. Diukur langsung di
   * deployment ini, bukan ditebak.
   */
  timeoutMs: 30000,
  /** Jeda antar-kiriman saat menguras antrean, agar tidak menyerbu server sendiri. */
  retryGapMs: 1500
};

/** Aturan ujian — semua angka mengikuti §8.3 dan §8.5 PRD. */
export const EXAM = {
  /**
   * Komposisi 5 set soal ujian. Setiap sesi mengacak soal dari tiap bank
   * sebanyak jumlah di bawah, lalu mengacak urutannya — sehingga tiap siswa
   * dapat kombinasi berbeda tapi bobot materinya selalu sama.
   *
   *   html     → hanya tab HTML yang aktif
   *   css      → HTML disediakan read-only, siswa mengisi CSS
   *   campuran → kedua tab aktif; siswa menulis HTML dan CSS sekaligus
   *
   * Totalnya harus sama dengan `questionCount`.
   */
  komposisi: { html: 2, css: 2, campuran: 1 },
  durationMinutes: 90,
  questionCount: 5,
  maxViolations: 2,
  lockoutMinutes: 60,
  /** Blur lebih pendek dari ini diabaikan (mitigasi false-positive, §8.5). */
  blurToleranceMs: 3000,
  /** Menit tersisa saat bilah peringatan muncul. */
  warnAtMinutes: 10,
  /** Menit tersisa saat angka timer mulai berkedip. */
  blinkAtMinutes: 3
};

/**
 * Kuis Daring 9/9 — sesi pendek dengan aturan lebih ketat daripada ujian.
 *
 * Mesinnya sama persis dengan ujian (anti-cheat, layar penuh, penilaian
 * otomatis, pengiriman ke Sheets); yang berbeda hanya angka dan kolam soalnya.
 *
 * [Yang perlu guru tahu tentang maxViolations: 0]
 * Nol berarti TANPA PERINGATAN: pelanggaran pertama langsung memblokir siswa
 * 15 menit dan menghapus jawabannya. Itu memang yang diminta, tetapi perlu
 * disadari risikonya — pindah tab lebih dari 3 detik, notifikasi yang ditekan
 * tak sengaja, atau Ctrl+C refleks sudah cukup. Ubah ke 1 bila ingin memberi
 * satu peringatan lebih dulu.
 */
export const KUIS = {
  nama: 'Kuis Daring 9/9',
  /** Kolam soal dibatasi per bank menurut tingkatnya. */
  levelPerBank: { html: ['Dasar', 'Menengah'], css: ['Dasar'] },
  komposisi: { html: 3, css: 2 },
  durationMinutes: 45,
  questionCount: 5,
  maxViolations: 0,
  lockoutMinutes: 15,
  blurToleranceMs: 3000,
  warnAtMinutes: 5,
  blinkAtMinutes: 2,
  /**
   * Sheet tujuan. Apps Script yang aktif sekarang hanya mengenal "Latihan",
   * "Ujian", dan "Capstone" — sheet lain akan DITOLAK. Karena itu baris kuis
   * ikut masuk ke sheet "Ujian" dan dibedakan lewat kolom Mode.
   * Setelah apps-script/Code.gs yang baru di-deploy, ganti nilai ini
   * menjadi 'Kuis' agar punya sheet sendiri.
   *
   * JANGAN mengubahnya sebelum deploy: baris yang ditolak server saat ini
   * dilaporkan sebagai terkirim (respons no-cors bersifat opaque) sehingga
   * nilai siswa hilang tanpa peringatan. Sudah diuji langsung ke endpoint yang
   * aktif: sheet 'Ujian' dijawab {ok:true}, sheet 'Kuis' dijawab
   * "Sheet tidak dikenal".
   */
  sheet: 'Ujian',
  mode: 'Kuis 9/9'
};

/** Lebar minimum untuk halaman split-screen (§11 PRD: desktop-first). */
export const MIN_SPLIT_WIDTH = 1024;

/** Jeda debounce live preview, dalam milidetik (§8.4 PRD). */
export const PREVIEW_DEBOUNCE = 500;
