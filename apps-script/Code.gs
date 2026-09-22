/**
 * WebTM — Google Apps Script Web App.
 *
 * Menerima POST dari situs statis dan menuliskannya sebagai satu baris ke
 * sheet "Latihan", "Ujian", "Kuis", atau "Capstone".
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

/**
 * Kuis memakai kolom yang sama persis dengan Ujian — sesi berpenilaian yang
 * sama, hanya aturannya yang berbeda. Selama versi ini BELUM di-deploy, sheet
 * "Kuis" tidak dikenal dan barisnya akan ditolak; karena itu KUIS.sheet di
 * assets/js/config.js masih diarahkan ke "Ujian" dan dibedakan lewat kolom Mode.
 * Setelah versi ini aktif, barulah ubah nilai itu menjadi 'Kuis'.
 */
SHEETS.Kuis = SHEETS.Ujian.slice();

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

/**
 * Urutan kolom mengikuti BARIS JUDUL yang sudah ada di sheet, bukan daftar di
 * atas. Sheet yang dibuat oleh versi skrip lebih lama bisa punya susunan kolom
 * berbeda (mis. belum ada kolom "Jenis"); menulis menurut daftar akan membuat
 * setiap nilai bergeser satu kolom tanpa ada yang menyadarinya. Kolom yang
 * belum ada ditambahkan di ujung kanan.
 */
/**
 * Memulihkan baris judul yang rusak karena tersunting tangan.
 *
 * Kejadian nyata: di sheet Ujian guru, judul B1 menjadi kosong dan C1 menjadi
 * "Nama" — judul "Kelas/NISN" hilang. Datanya utuh (ditulis skrip dalam urutan
 * baku), tetapi rekap membaca kolom menurut judulnya, sehingga NISN terbaca
 * sebagai nama. Lebih buruk lagi, penulisan baris baru yang mengikuti judul
 * akan menaruh nama di kolom yang salah.
 *
 * Judul hanya ditulis ulang bila ketiganya terpenuhi:
 *   1. ada kolom baku yang hilang dari judul;
 *   2. lebarnya SAMA PERSIS dengan daftar baku — sheet buatan versi skrip lain
 *      (mis. sebelum kolom "Jenis" ada) punya lebar berbeda, dan barisnya
 *      memang tersusun menurut judul lamanya; menimpanya justru merusak;
 *   3. selisihnya hanya beberapa sel — tanda sunting tak sengaja, bukan
 *      susunan yang memang lain.
 * Selain itu judul dibiarkan apa adanya.
 */
function pulihkanJudul_(sheet, wajib) {
  var lastCol = sheet.getLastColumn();
  if (lastCol !== wajib.length) return false;
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var hilang = wajib.some(function (c) { return header.indexOf(c) === -1; });
  var beda = wajib.filter(function (c, i) { return header[i] !== c; }).length;
  if (!hilang || beda > 3) return false;
  sheet.getRange(1, 1, 1, wajib.length).setValues([wajib]);
  return true;
}

/** Peringatan saat judul kolom hendak disunting (tidak menghalangi). */
function lindungiJudul_(sheet, lebar) {
  var ada = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (p) {
    return p.getDescription() === 'Judul kolom WebTM';
  });
  if (ada || !lebar) return;
  sheet.getRange(1, 1, 1, lebar).protect()
    .setDescription('Judul kolom WebTM')
    .setWarningOnly(true);
}

function headerSelaras_(sheet, wajib) {
  var lastCol = sheet.getLastColumn();
  var header = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var kurang = wajib.filter(function (c) { return header.indexOf(c) === -1; });
  if (kurang.length) {
    sheet.getRange(1, header.length + 1, 1, kurang.length).setValues([kurang]);
    header = header.concat(kurang);
  }
  return header;
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
      pulihkanJudul_(sheet, SHEETS[name]);
      var row = headerSelaras_(sheet, SHEETS[name]).map(function (column) {
        if (column === 'Timestamp') return new Date();
        if (column === 'Status Review Guru') return data.statusReviewGuru || 'Menunggu Review';
        // Sheet "Ujian" memuat dua jenis baris: satu baris per soal yang disubmit,
        // dan satu baris ringkasan berisi nilai akhir sesi. Kolom ini memisahkannya
        // supaya rekap nilai tinggal memfilter "Ringkasan".
        if (column === 'Jenis') {
          if (data.idSoal === 'RINGKASAN') return 'Ringkasan';
          // Baris BLOKIR dikirim saat siswa dihentikan karena pelanggaran:
          // sesinya dihapus tanpa nilai akhir, jadi tanpa penanda ini guru
          // tidak punya jejak apa pun tentang kejadian itu.
          if (data.idSoal === 'BLOKIR') return 'Blokir';
          return 'Per Soal';
        }
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

/* ========================================================================== *
 * REKAP NILAI
 *
 * Sheet "Ujian" menyimpan SEMUA kejadian: satu baris tiap submit, satu baris
 * ringkasan, satu baris blokir — lengkap dengan kode siswa. Itu bukti yang
 * berharga, tetapi mencari nilai akhir di sana berarti menyaring ratusan baris.
 *
 * Sheet "Rekap" menyarikannya menjadi SATU BARIS per siswa per jenis sesi
 * (Ujian / Kuis). Ia dibangun ulang seluruhnya dari data mentah setiap kali:
 *   - spreadsheet dibuka, dan
 *   - menu WebTM → Perbarui Rekap Nilai ditekan.
 * Data mentah tidak pernah diubah atau dihapus.
 *
 * Aturan nilai akhir: sesi PERTAMA yang selesai (submit manual atau waktu
 * habis). Siswa yang mengulang tidak bisa "memancing" soal yang lebih mudah;
 * semua hasil sesinya tetap terlihat di kolom Riwayat.
 * ========================================================================== */

var REKAP = 'Rekap';
var SUMBER_REKAP = ['Ujian', 'Kuis'];
var JUMLAH_KOLOM_SOAL = 5;

/** Baris uji dari pengembang — ditandai begitu di kolom Nama. */
function barisUji_(nama) {
  return String(nama || '').toLowerCase().indexOf('boleh dihapus') !== -1;
}

function rapikan_(s) {
  return String(s == null ? '' : s).trim().toLowerCase().split(' ').filter(Boolean).join(' ');
}

function angka_(v) {
  var n = Number(v);
  return isNaN(n) || v === '' || v === null ? null : n;
}

/** "html-dasar-001=80 | css-dasar-004=100" → { 'html-dasar-001': 80, ... } */
function uraiRincian_(teks) {
  var out = {};
  String(teks || '').split('|').forEach(function (bagian) {
    var p = bagian.split('=');
    if (p.length === 2) {
      var n = angka_(p[1].trim());
      if (n !== null) out[p[0].trim()] = n;
    }
  });
  return out;
}

function waktu_(v) {
  if (v instanceof Date) return v.getTime();
  var t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Inti rekap — fungsi murni, tanpa SpreadsheetApp, supaya bisa diuji di luar
 * Google. `tabel` = [{ header: [...], rows: [[...], ...] }, ...].
 */
function susunRekap_(tabel) {
  var sesi = {};   // id sesi → ringkasan sesi

  tabel.forEach(function (t) {
    var idx = {};
    t.header.forEach(function (h, i) { idx[String(h).trim()] = i; });
    var ambil = function (row, kolom) { return idx[kolom] === undefined ? '' : row[idx[kolom]]; };

    t.rows.forEach(function (row) {
      var nama = ambil(row, 'Nama');
      var idSesi = String(ambil(row, 'Sesi') || '').trim();
      if (!idSesi || !String(nama).trim() || barisUji_(nama)) return;

      var s = sesi[idSesi];
      if (!s) {
        s = sesi[idSesi] = {
          id: idSesi, nama: String(nama).trim(), kelas: String(ambil(row, 'Kelas/NISN')).trim(),
          jenis: String(ambil(row, 'Mode') || 'Ujian').trim(),
          daftar: [], perSoal: {}, mulai: Infinity, akhir: 0,
          ringkasan: null, blokir: null
        };
      }

      var t0 = waktu_(ambil(row, 'Timestamp'));
      s.mulai = Math.min(s.mulai, t0 || Infinity);
      s.akhir = Math.max(s.akhir, t0);

      var daftar = String(ambil(row, 'Daftar Soal') || '');
      if (daftar && !s.daftar.length) {
        s.daftar = daftar.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      }

      var idSoal = String(ambil(row, 'ID Soal') || '').trim();
      var skor = angka_(ambil(row, 'Skor'));

      if (idSoal === 'RINGKASAN') {
        s.ringkasan = {
          skor: skor, rincian: uraiRincian_(ambil(row, 'Rincian Skor')),
          habis: String(ambil(row, 'Alasan Selesai')).indexOf('waktu habis') !== -1, t: t0
        };
      } else if (idSoal === 'BLOKIR') {
        s.blokir = { t: t0, rincian: uraiRincian_(ambil(row, 'Rincian Skor')) };
      } else if (idSoal) {
        // Siswa boleh submit ulang; yang berlaku adalah submit TERAKHIR —
        // sama persis dengan cara aplikasi menghitung nilai akhir.
        var lama = s.perSoal[idSoal];
        if (!lama || t0 >= lama.t) s.perSoal[idSoal] = { skor: skor === null ? 0 : skor, t: t0 };
        // "2/5": posisi soal dan JUMLAH soal sesi. Sesi yang tak pernah selesai
        // tidak punya "Daftar Soal", jadi pembaginya harus dibaca dari sini —
        // kalau tidak, soal yang belum disubmit ikut hilang dari pembagi dan
        // nilainya menggelembung.
        var nomor = String(ambil(row, 'Nomor Soal') || '').split('/');
        var total = nomor.length === 2 ? angka_(nomor[1]) : null;
        if (total) s.total = Math.max(s.total || 0, total);
        var posisi = nomor.length === 2 ? angka_(nomor[0]) : null;
        if (posisi) {
          s.posisi = s.posisi || {};
          s.posisi[idSoal] = posisi;
        }
      }
    });
  });

  // Kelompokkan sesi per siswa per jenis.
  var grup = {};
  Object.keys(sesi).forEach(function (id) {
    var s = sesi[id];
    var kunci = rapikan_(s.nama) + '||' + rapikan_(s.kelas) + '||' + rapikan_(s.jenis);
    (grup[kunci] = grup[kunci] || []).push(s);
  });

  var status = function (s) {
    if (s.ringkasan) return s.ringkasan.habis ? 'Selesai (waktu habis)' : 'Selesai';
    if (s.blokir) return 'Diblokir';
    return 'Tidak selesai';
  };

  var skorSoal = function (s) {
    if (s.daftar.length) {
      return s.daftar.map(function (id) {
        if (s.ringkasan && s.ringkasan.rincian[id] !== undefined) return s.ringkasan.rincian[id];
        return s.perSoal[id] ? s.perSoal[id].skor : 0;
      });
    }
    // Tanpa daftar soal: susun menurut nomor soal; yang belum disubmit = 0.
    // Bila "Nomor Soal" tak terbaca — Sheets kerap mengubah teks "2/5" menjadi
    // TANGGAL — pakai JUMLAH_KOLOM_SOAL (5), jumlah soal ujian dan kuis saat ini.
    var n = s.total || Math.max(JUMLAH_KOLOM_SOAL, Object.keys(s.perSoal).length);
    var out = [];
    for (var i = 0; i < n; i++) out.push(0);
    Object.keys(s.perSoal).forEach(function (id, urutan) {
      var p = (s.posisi && s.posisi[id]) || urutan + 1;
      if (p >= 1 && p <= n) out[p - 1] = s.perSoal[id].skor;
    });
    return out;
  };

  var nilai = function (s) {
    if (s.ringkasan && s.ringkasan.skor !== null) return s.ringkasan.skor;
    if (s.blokir) return 0;   // aturan sesi: blokir = jawaban dihapus
    var sk = skorSoal(s);
    if (!sk.length) return 0;
    return Math.round(sk.reduce(function (a, b) { return a + b; }, 0) / sk.length);
  };

  var hasil = Object.keys(grup).map(function (k) {
    var daftar = grup[k].sort(function (a, b) { return a.mulai - b.mulai; });
    var selesai = daftar.filter(function (s) { return s.ringkasan; });
    // Nilai akhir: sesi selesai yang PERTAMA; bila belum ada, sesi terakhir.
    var dipakai = selesai.length ? selesai[0] : daftar[daftar.length - 1];
    var sk = skorSoal(dipakai);
    var riwayat = daftar.map(function (s) { return s.blokir && !s.ringkasan ? 'BLOKIR' : String(nilai(s)); }).join(' · ');

    var baris = [dipakai.nama, dipakai.kelas, dipakai.jenis, nilai(dipakai), status(dipakai)];
    for (var i = 0; i < JUMLAH_KOLOM_SOAL; i++) baris.push(i < sk.length ? sk[i] : '');
    baris.push(
      daftar.length,
      daftar.filter(function (s) { return s.blokir && !s.ringkasan; }).length,
      riwayat,
      dipakai.akhir ? new Date(dipakai.akhir) : '',
      dipakai.id
    );
    return baris;
  });

  hasil.sort(function (a, b) {
    return String(a[2]).localeCompare(String(b[2]))     // jenis
      || String(a[1]).localeCompare(String(b[1]))       // kelas
      || String(a[0]).localeCompare(String(b[0]));      // nama
  });
  return hasil;
}

function headerRekap_() {
  var h = ['Nama', 'Kelas/NISN', 'Jenis', 'Nilai Akhir', 'Status'];
  for (var i = 1; i <= JUMLAH_KOLOM_SOAL; i++) h.push('Soal ' + i);
  return h.concat(['Jumlah Sesi', 'Diblokir', 'Riwayat Nilai', 'Waktu Terakhir', 'ID Sesi']);
}

/** Dipanggil menu dan onOpen. Aman dijalankan berulang kali. */
function perbaruiRekap() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var tabel = [];
  SUMBER_REKAP.forEach(function (nama) {
    var sh = book.getSheetByName(nama);
    if (!sh || sh.getLastRow() < 2) return;
    pulihkanJudul_(sh, SHEETS[nama]);
    lindungiJudul_(sh, sh.getLastColumn());
    var semua = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    tabel.push({ header: semua[0], rows: semua.slice(1) });
  });

  var header = headerRekap_();
  var isi = susunRekap_(tabel);

  var rekap = book.getSheetByName(REKAP) || book.insertSheet(REKAP, 0);
  if (rekap.getFilter()) rekap.getFilter().remove();
  rekap.clear();
  rekap.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground('#201e1d').setFontColor('#f5ead8');
  rekap.setFrozenRows(1);
  rekap.getRange(1, 1).setNote(
    'Sheet ini dibangun ulang otomatis dari sheet Ujian/Kuis setiap spreadsheet dibuka ' +
    'atau lewat menu WebTM → Perbarui Rekap Nilai. Suntingan manual di sini akan tertimpa.');

  if (isi.length) {
    rekap.getRange(2, 1, isi.length, header.length).setValues(isi);
    rekap.getRange(2, 4, isi.length, 1).setFontWeight('bold');
    rekap.getRange(2, header.length - 1, isi.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  }
  rekap.getRange(1, 1, isi.length + 1, header.length).createFilter();
  rekap.autoResizeColumns(1, header.length);
  return isi.length;
}

/** Menu kustom + penyegaran otomatis setiap spreadsheet dibuka. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WebTM')
    .addItem('Perbarui Rekap Nilai', 'perbaruiRekapDariMenu')
    .addToUi();
  try { perbaruiRekap(); } catch (err) { /* jangan halangi spreadsheet terbuka */ }
}

function perbaruiRekapDariMenu() {
  var n = perbaruiRekap();
  SpreadsheetApp.getActiveSpreadsheet().toast(n + ' baris rekap diperbarui.', 'WebTM', 5);
}
