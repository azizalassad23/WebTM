/**
 * Uji apps-script/Code.gs di luar Google: rekap nilai dan penulisan baris.
 *
 *   node tools/uji-rekap.mjs
 *
 * Code.gs dijalankan di dalam vm dengan SpreadsheetApp tiruan, supaya logika
 * yang akan menyentuh sheet guru teruji dulu terhadap semua bentuk baris yang
 * pernah dikirim aplikasi — termasuk sheet lama yang susunan kolomnya berbeda.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kode = fs.readFileSync(path.join(AKAR, 'apps-script', 'Code.gs'), 'utf8');

/* ------------------------------------------------ SpreadsheetApp tiruan */

function buatSheet(nama, grid = []) {
  const data = grid.map((r) => r.slice());
  const lebar = () => data.reduce((m, r) => Math.max(m, r.length), 0);
  const sheet = {
    nama, data, note: null, filter: null, lindung: [],
    getProtections: () => sheet.lindung,
    getLastRow: () => data.length,
    getLastColumn: () => lebar(),
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getValues: () => Array.from({ length: nr }, (_, i) =>
          Array.from({ length: nc }, (_, j) => (data[r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValues(v) {
          v.forEach((row, i) => row.forEach((val, j) => {
            while (data.length < r + i) data.push([]);
            data[r - 1 + i][c - 1 + j] = val;
          }));
          return this;
        },
        setFontWeight() { return this; }, setBackground() { return this; },
        setFontColor() { return this; }, setNumberFormat() { return this; },
        setNote(n) { sheet.note = n; return this; },
        createFilter() { sheet.filter = {}; return this; },
        protect() { const pr = { d: '', setDescription(x) { pr.d = x; return pr; }, setWarningOnly() { sheet.lindung.push(pr); return pr; }, getDescription: () => pr.d }; return pr; }
      };
    },
    appendRow(row) { data.push(row.slice()); },
    setFrozenRows() {}, autoResizeColumns() {},
    getFilter: () => (sheet.filter ? { remove: () => { sheet.filter = null; } } : null),
    clear() { data.length = 0; }
  };
  return sheet;
}

function buatBook(sheets) {
  return {
    sheets,
    getSheetByName: (n) => sheets[n] || null,
    insertSheet(n) { sheets[n] = buatSheet(n); return sheets[n]; },
    toast() {}
  };
}

function jalankan(book) {
  const ctx = {
    SpreadsheetApp: { ProtectionType: { RANGE: 'RANGE' }, getActiveSpreadsheet: () => book, getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }) },
    ContentService: { createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 'json' } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Date, JSON, Math, Object, String, Number, isNaN, Infinity
  };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx);
  return ctx;
}

/* ------------------------------------------------------------ data uji */

// Header lama: dibuat versi skrip SEBELUM kolom "Jenis" ada.
const HEADER_LAMA = ['Timestamp', 'Nama', 'Kelas/NISN', 'Mode', 'Modul', 'ID Soal', 'Sesi',
  'Nomor Soal', 'Daftar Soal', 'Kode HTML Siswa', 'Kode CSS Siswa', 'Skor', 'Rincian Skor',
  'Jumlah Submit', 'Waktu Mulai', 'Waktu Submit', 'Durasi (detik)', 'Jumlah Pelanggaran',
  'Detail Pelanggaran', 'Status Blokir', 'Alasan Selesai'];

const t = (menit) => new Date(Date.UTC(2026, 8, 9, 3, menit));
const D5 = 'html-dasar-001, html-dasar-002, html-menengah-016, css-dasar-001, css-dasar-004';

function baris(o) {
  return HEADER_LAMA.map((h) => ({
    Timestamp: o.t, Nama: o.nama, 'Kelas/NISN': o.kelas, Mode: o.mode || 'Kuis 9/9',
    Modul: 'CAMPURAN', 'ID Soal': o.id, Sesi: o.sesi, 'Nomor Soal': o.nomor || '', 'Daftar Soal': o.daftar || '',
    'Kode HTML Siswa': '<h1>panjang sekali</h1>', Skor: o.skor ?? '',
    'Rincian Skor': o.rincian || '', 'Alasan Selesai': o.alasan || ''
  }[h] ?? ''));
}

const rows = [
  // Budi: kuis selesai normal, sempat submit ulang soal 1 (80 → 100)
  baris({ t: t(1), nama: 'Budi', kelas: 'XI TEI 1', id: 'html-dasar-001', sesi: '#B1', skor: 80 }),
  baris({ t: t(3), nama: 'Budi', kelas: 'XI TEI 1', id: 'html-dasar-001', sesi: '#B1', skor: 100 }),
  baris({ t: t(40), nama: 'Budi', kelas: 'XI TEI 1', id: 'RINGKASAN', sesi: '#B1', skor: 84, daftar: D5,
    rincian: 'html-dasar-001=100 | html-dasar-002=90 | html-menengah-016=70 | css-dasar-001=100 | css-dasar-004=60',
    alasan: 'submit manual' }),

  // Citra: diblokir, lalu mengulang dan selesai karena waktu habis
  baris({ t: t(5), nama: 'Citra', kelas: 'XI TEI 1', id: 'BLOKIR', sesi: '#C1', skor: 0, daftar: D5,
    rincian: 'html-dasar-001=0 | html-dasar-002=0 | html-menengah-016=0 | css-dasar-001=0 | css-dasar-004=0' }),
  baris({ t: t(30), nama: 'Citra', kelas: 'XI TEI 1', id: 'RINGKASAN', sesi: '#C2', skor: 72, daftar: D5,
    rincian: 'html-dasar-001=100 | html-dasar-002=100 | html-menengah-016=60 | css-dasar-001=100 | css-dasar-004=0',
    alasan: 'auto-submit waktu habis' }),

  // Dewi: diblokir dan tidak mengulang
  baris({ t: t(8), nama: 'Dewi', kelas: 'XI TEI 2', id: 'html-dasar-001', sesi: '#D1', skor: 100 }),
  baris({ t: t(9), nama: 'Dewi', kelas: 'XI TEI 2', id: 'BLOKIR', sesi: '#D1', skor: 0, daftar: D5,
    rincian: 'html-dasar-001=100 | html-dasar-002=0 | html-menengah-016=0 | css-dasar-001=0 | css-dasar-004=0' }),

  // Eko: tab ditutup setelah 2 dari 5 soal — tanpa ringkasan maupun daftar soal
  baris({ t: t(10), nama: 'Eko', kelas: 'XI TEI 2', id: 'html-dasar-001', sesi: '#E1', skor: 100, nomor: '1/5' }),
  baris({ t: t(12), nama: 'Eko', kelas: 'XI TEI 2', id: 'html-dasar-002', sesi: '#E1', skor: 50, nomor: '2/5' }),

  // Fajar: selesai, lalu mengulang dan dapat lebih tinggi — yang dipakai sesi PERTAMA
  baris({ t: t(20), nama: 'Fajar', kelas: 'XI TEI 1', id: 'RINGKASAN', sesi: '#F1', skor: 60, daftar: D5,
    rincian: 'html-dasar-001=60 | html-dasar-002=60 | html-menengah-016=60 | css-dasar-001=60 | css-dasar-004=60', alasan: 'submit manual' }),
  baris({ t: t(50), nama: 'Fajar', kelas: 'XI TEI 1', id: 'RINGKASAN', sesi: '#F2', skor: 95, daftar: D5,
    rincian: 'html-dasar-001=95 | html-dasar-002=95 | html-menengah-016=95 | css-dasar-001=95 | css-dasar-004=95', alasan: 'submit manual' }),

  // Budi juga ikut UJIAN — harus jadi baris terpisah dari kuisnya
  baris({ t: t(60), nama: 'Budi', kelas: 'XI TEI 1', mode: 'Ujian', id: 'RINGKASAN', sesi: '#BU', skor: 90, daftar: D5,
    rincian: 'html-dasar-001=90 | html-dasar-002=90 | html-menengah-016=90 | css-dasar-001=90 | css-dasar-004=90', alasan: 'submit manual' }),

  // Baris uji pengembang — tidak boleh masuk rekap
  baris({ t: t(2), nama: 'UJI COBA KUIS — boleh dihapus', kelas: 'XI TEI 1 / 000', id: 'BLOKIR', sesi: '#UJICOBA', skor: 0 })
];

/* -------------------------------------------------------------- uji */

let lulus = 0;
const cek = (nama, fn) => { fn(); lulus++; console.log('  ✓ ' + nama); };

console.log('Rekap nilai');
const book = buatBook({ Ujian: buatSheet('Ujian', [HEADER_LAMA, ...rows]) });
const ctx = jalankan(book);
const jumlah = ctx.perbaruiRekap();
const rekap = book.sheets.Rekap.data;
const H = rekap[0];
const cari = (nama, jenis) => {
  const r = rekap.find((x) => x[0] === nama && x[2] === jenis);
  return r && Object.fromEntries(H.map((h, i) => [h, r[i]]));
};

cek('satu baris per siswa per jenis; baris uji dibuang', () => {
  assert.equal(jumlah, 6);   // Budi (kuis + ujian), Citra, Dewi, Eko, Fajar
  assert.equal(rekap.filter((r) => String(r[0]).includes('boleh dihapus')).length, 0);
});
cek('selesai normal: nilai dari ringkasan, soal diurai ke kolom sendiri', () => {
  const b = cari('Budi', 'Kuis 9/9');
  assert.equal(b['Nilai Akhir'], 84);
  assert.equal(b.Status, 'Selesai');
  assert.deepEqual([b['Soal 1'], b['Soal 2'], b['Soal 3'], b['Soal 4'], b['Soal 5']], [100, 90, 70, 100, 60]);
});
cek('diblokir lalu mengulang: nilai sesi yang selesai, riwayat mencatat blokir', () => {
  const c = cari('Citra', 'Kuis 9/9');
  assert.equal(c['Nilai Akhir'], 72);
  assert.equal(c.Status, 'Selesai (waktu habis)');
  assert.equal(c['Jumlah Sesi'], 2);
  assert.equal(c.Diblokir, 1);
  assert.equal(c['Riwayat Nilai'], 'BLOKIR · 72');
});
cek('diblokir tanpa mengulang: nilai 0, status Diblokir', () => {
  const d = cari('Dewi', 'Kuis 9/9');
  assert.equal(d['Nilai Akhir'], 0);
  assert.equal(d.Status, 'Diblokir');
});
cek('tidak selesai: soal yang belum disubmit dihitung 0, pembagi tetap 5', () => {
  const e = cari('Eko', 'Kuis 9/9');
  assert.equal(e.Status, 'Tidak selesai');
  assert.equal(e['Nilai Akhir'], 30);   // (100 + 50 + 0 + 0 + 0) / 5 — bukan 75
  assert.deepEqual([e['Soal 1'], e['Soal 2'], e['Soal 3'], e['Soal 4'], e['Soal 5']], [100, 50, 0, 0, 0]);
});
cek('mengulang setelah selesai: sesi PERTAMA yang dipakai, sesi lain tetap tampak', () => {
  const f = cari('Fajar', 'Kuis 9/9');
  assert.equal(f['Nilai Akhir'], 60);
  assert.equal(f['Riwayat Nilai'], '60 · 95');
});
cek('ujian dan kuis siswa yang sama tidak tercampur', () => {
  assert.equal(cari('Budi', 'Ujian')['Nilai Akhir'], 90);
  assert.equal(cari('Budi', 'Kuis 9/9')['Nilai Akhir'], 84);
});
cek('data mentah tidak disentuh', () => {
  assert.equal(book.sheets.Ujian.data.length, rows.length + 1);
});
cek('aman dijalankan berulang: hasilnya identik', () => {
  const sebelum = JSON.stringify(book.sheets.Rekap.data);
  ctx.perbaruiRekap();
  assert.equal(JSON.stringify(book.sheets.Rekap.data), sebelum);
});

cek('Nomor Soal yang diubah Sheets menjadi tanggal: pembagi tetap 5', () => {
  const r = (id, tgl) => {
    const x = baris({ t: t(70), nama: 'Hana', kelas: 'XI TEI 2', id, sesi: '#H1', skor: 100 });
    x[HEADER_LAMA.indexOf('Nomor Soal')] = tgl;
    return x;
  };
  const b3 = buatBook({ Ujian: buatSheet('Ujian', [HEADER_LAMA,
    r('html-dasar-001', new Date(2026, 4, 1)), r('html-dasar-002', new Date(2026, 4, 2))]) });
  jalankan(b3).perbaruiRekap();
  const [hh, row] = b3.sheets.Rekap.data;
  assert.equal(row[hh.indexOf('Nilai Akhir')], 40);   // (100 + 100) / 5, bukan 100
});

console.log('\nJudul kolom yang rusak');

// Susunan baku saat ini (dengan kolom "Jenis") dan baris yang ditulis menurutnya.
const BAKU = ['Timestamp', 'Nama', 'Kelas/NISN', 'Jenis', ...HEADER_LAMA.slice(3)];
const bakuRow = (o) => { const r = baris(o); r.splice(3, 0, 'Per Soal'); return r; };

cek('kejadian nyata: B1 kosong, C1 "Nama" → judul dipulihkan, nama bukan NISN', () => {
  const rusak = BAKU.slice(); rusak[1] = ''; rusak[2] = 'Nama';
  const b4 = buatBook({ Ujian: buatSheet('Ujian', [rusak,
    bakuRow({ t: t(1), nama: 'Ridho Evrilian', kelas: 'XIIB / 0099240680', id: 'RINGKASAN', sesi: '#R1',
      skor: 88, daftar: D5, rincian: 'html-dasar-001=88', alasan: 'submit manual' })]) });
  jalankan(b4).perbaruiRekap();
  assert.deepEqual(b4.sheets.Ujian.data[0], BAKU);
  const [hh, row] = b4.sheets.Rekap.data;
  assert.equal(row[hh.indexOf('Nama')], 'Ridho Evrilian');
  assert.equal(row[hh.indexOf('Kelas/NISN')], 'XIIB / 0099240680');
  assert.equal(b4.sheets.Ujian.lindung.length, 1);          // judul kini diberi peringatan
});

cek('baris baru setelah pemulihan sejajar dengan baris lama', () => {
  const rusak = BAKU.slice(); rusak[1] = ''; rusak[2] = 'Nama';
  const b5 = buatBook({ Ujian: buatSheet('Ujian', [rusak]) });
  jalankan(b5).doPost({ postData: { contents: JSON.stringify({
    token: 'webtm-OfP6kvulluQE', sheet: 'Ujian',
    data: { nama: 'Ridho Evrilian', kelas: 'XIIB / 0099240680', idSoal: 'RINGKASAN', sesi: '#R2', skor: 90 }
  }) } });
  const [h, r] = b5.sheets.Ujian.data;
  assert.equal(h.length, BAKU.length);                     // tidak ada kolom liar di kanan
  assert.equal(r[1], 'Ridho Evrilian');
  assert.equal(r[2], 'XIIB / 0099240680');
});

cek('sheet versi lama (tanpa "Jenis") TIDAK ditimpa ke susunan baru', () => {
  const b6 = buatBook({ Ujian: buatSheet('Ujian', [HEADER_LAMA.slice(), rows[0]]) });
  jalankan(b6).perbaruiRekap();
  assert.deepEqual(b6.sheets.Ujian.data[0], HEADER_LAMA);
});

console.log('\nPenulisan baris ke sheet berheader lama');
cek('kolom mengikuti header yang ada, "Jenis" ditambah di ujung — tidak ada yang bergeser', () => {
  const b2 = buatBook({ Ujian: buatSheet('Ujian', [HEADER_LAMA.slice()]) });
  const c2 = jalankan(b2);
  const res = c2.doPost({ postData: { contents: JSON.stringify({
    token: 'webtm-OfP6kvulluQE', sheet: 'Ujian',
    data: { nama: 'Gita', kelas: 'XI TEI 2', mode: 'Kuis 9/9', idSoal: 'RINGKASAN', sesi: '#G1', skor: 88 }
  }) } });
  assert.equal(res.ok, true);
  const [h, r] = b2.sheets.Ujian.data;
  assert.equal(h[h.length - 1], 'Jenis');
  assert.equal(r[h.indexOf('Nama')], 'Gita');
  assert.equal(r[h.indexOf('Skor')], 88);
  assert.equal(r[h.indexOf('Sesi')], '#G1');
  assert.equal(r[h.indexOf('Jenis')], 'Ringkasan');
});

console.log(`\n${lulus} uji lulus.`);
