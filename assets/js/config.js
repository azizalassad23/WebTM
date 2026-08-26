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

/** Lebar minimum untuk halaman split-screen (§11 PRD: desktop-first). */
export const MIN_SPLIT_WIDTH = 1024;

/** Jeda debounce live preview, dalam milidetik (§8.4 PRD). */
export const PREVIEW_DEBOUNCE = 500;
