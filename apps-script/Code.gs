/**
 * WebTM — Google Apps Script Web App.
 *
 * Menerima POST dari situs statis dan menuliskannya sebagai satu baris ke
 * sheet "Latihan", "Ujian", atau "Capstone".
 *
 * Pasang:
 *   1. Buka Google Sheets baru → Extensions → Apps Script.
 *   2. Tempel isi berkas ini, ganti TOKEN di bawah.
 *   3. Deploy → New deployment → Web app
 *        Execute as       : Me
 *        Who has access   : Anyone
 *   4. Salin URL /exec ke `SHEETS.endpoint` di assets/js/config.js,
 *      dan token yang sama ke `SHEETS.token`.
 *
 * [Batasan keamanan — §5.2 PRD] Token ini ikut terkirim dari kode klien dan
 * bisa dibaca siapa pun yang membuka DevTools. Gunanya mengurangi spam iseng,
 * BUKAN mengamankan data. Jangan menyimpan data sensitif di sheet ini.
 */

var TOKEN = 'webtm-OfP6kvulluQE';

/**
 * Tiap mode punya sheet sendiri — "Latihan" dan "Ujian" tidak pernah bercampur,
 * sehingga rekap nilai ujian bisa langsung difilter tanpa menyaring baris latihan.
 */
var SHEETS = {
  Latihan: [
    'Timestamp', 'Nama', 'Kelas/NISN', 'Mode', 'Modul', 'ID Soal', 'Percobaan',
    'Kode HTML Siswa', 'Kode CSS Siswa', 'Skor', 'Waktu Mulai', 'Waktu Submit',
    'Durasi (detik)', 'Jumlah Pelanggaran', 'Detail Pelanggaran'
  ],
  Ujian: [
    'Timestamp', 'Nama', 'Kelas/NISN', 'Jenis', 'Mode', 'Modul', 'ID Soal', 'Sesi',
    'Nomor Soal', 'Daftar Soal', 'Kode HTML Siswa', 'Kode CSS Siswa', 'Skor',
    'Rincian Skor', 'Jumlah Submit', 'Waktu Mulai', 'Waktu Submit',
    'Durasi (detik)', 'Jumlah Pelanggaran', 'Detail Pelanggaran',
    'Status Blokir', 'Alasan Selesai'
  ],
  Capstone: [
    'Timestamp', 'Nama', 'Kelas/NISN', 'Link CV', 'Status Jaringan', 'Status Review Guru'
  ]
};

/** Nama kolom → nama field pada payload dari klien. */
var FIELD = {
  'Nama': 'nama',
  'Kelas/NISN': 'kelas',
  'Mode': 'mode',
  'Modul': 'modul',
  'ID Soal': 'idSoal',
  'Percobaan': 'percobaan',
  'Sesi': 'sesi',
  'Nomor Soal': 'nomorSoal',
  'Daftar Soal': 'daftarSoal',
  'Kode HTML Siswa': 'kodeHtml',
  'Kode CSS Siswa': 'kodeCss',
  'Skor': 'skor',
  'Rincian Skor': 'rincianSkor',
  'Jumlah Submit': 'jumlahSubmit',
  'Waktu Mulai': 'waktuMulai',
  'Waktu Submit': 'waktuSubmit',
  'Durasi (detik)': 'durasiDetik',
  'Jumlah Pelanggaran': 'jumlahPelanggaran',
  'Detail Pelanggaran': 'detailPelanggaran',
  'Status Blokir': 'statusBlokir',
  'Alasan Selesai': 'alasanSelesai',
  'Link CV': 'linkCv',
  'Status Jaringan': 'statusJaringan',
  'Status Review Guru': 'statusReviewGuru'
};

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetFor_(name) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(SHEETS[name]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEETS[name]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'Body kosong.' });
    }

    var body = JSON.parse(e.postData.contents);

    if (body.token !== TOKEN) {
      return json_({ ok: false, error: 'Token tidak cocok.' });
    }

    var name = body.sheet;
    if (!SHEETS[name]) {
      return json_({ ok: false, error: 'Sheet tidak dikenal: ' + name });
    }

    var data = body.data || {};

    // Google sudah menjalankan permintaan web app milik satu akun secara
    // berurutan, jadi lock ini hanya lapis tambahan untuk pembuatan header
    // sheet. Menunggunya lama justru menumpuk antrean sampai klien timeout —
    // karena itu tunggu sebentar saja, dan tetap lanjutkan bila tidak dapat:
    // appendRow() sendiri sudah menambah baris secara atomik di sisi server.
    var lock = LockService.getScriptLock();
    var punyaLock = false;
    try { lock.waitLock(5000); punyaLock = true; } catch (lockErr) { /* lanjut tanpa lock */ }
    try {
      var sheet = sheetFor_(name);
      var row = SHEETS[name].map(function (column) {
        if (column === 'Timestamp') return new Date();
        if (column === 'Status Review Guru') return data.statusReviewGuru || 'Menunggu Review';
        // Sheet "Ujian" memuat dua jenis baris: satu baris per soal yang disubmit,
        // dan satu baris ringkasan berisi nilai akhir sesi. Kolom ini memisahkannya
        // supaya rekap nilai tinggal memfilter "Ringkasan".
        if (column === 'Jenis') return data.idSoal === 'RINGKASAN' ? 'Ringkasan' : 'Per Soal';
        var key = FIELD[column];
        var value = key ? data[key] : '';
        return (value === undefined || value === null) ? '' : value;
      });
      sheet.appendRow(row);
    } finally {
      // Hanya lepaskan bila memang sempat didapat — releaseLock() pada lock
      // yang tak pernah dipegang akan melempar error dan menutupi error asli.
      if (punyaLock) lock.releaseLock();
    }

    return json_({ ok: true, sheet: name });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'WebTM', sheets: Object.keys(SHEETS) });
}
