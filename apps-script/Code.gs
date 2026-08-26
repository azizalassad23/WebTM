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

var TOKEN = 'ganti-token-ini';

var SHEETS = {
  Latihan: [
    'Timestamp', 'Nama', 'Kelas/NISN', 'Mode', 'Modul', 'ID Soal', 'Percobaan',
    'Kode HTML Siswa', 'Kode CSS Siswa', 'Skor', 'Waktu Mulai', 'Waktu Submit',
    'Durasi (detik)', 'Jumlah Pelanggaran', 'Detail Pelanggaran'
  ],
  Ujian: [
    'Timestamp', 'Nama', 'Kelas/NISN', 'Mode', 'Modul', 'ID Soal', 'Sesi',
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
    // Satu penulis pada satu waktu — mencegah dua submission serentak saling menimpa.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = sheetFor_(name);
      var row = SHEETS[name].map(function (column) {
        if (column === 'Timestamp') return new Date();
        if (column === 'Status Review Guru') return data.statusReviewGuru || 'Menunggu Review';
        var key = FIELD[column];
        var value = key ? data[key] : '';
        return (value === undefined || value === null) ? '' : value;
      });
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true, sheet: name });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'WebTM', sheets: Object.keys(SHEETS) });
}
