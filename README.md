# WebTM — Web Training Module

Modul pembelajaran interaktif **HTML & CSS** dengan live-coding editor, latihan
ber-umpan-balik instan, ujian ber-auto-grading, anti-cheat client-side, dan
pengiriman hasil otomatis ke Google Sheets.

Situs sepenuhnya statis — bisa di-deploy apa adanya ke GitHub Pages. Tanpa build
step, tanpa dependensi npm, tanpa framework.

Diimplementasikan dari mockup Claude Design `Modul HTML CSS - Mockup.dc.html`
(12 layar) dan PRD `PRD_Modul_HTML_CSS_Interaktif.md`.

---

## Menjalankan secara lokal

Situs memakai ES module dan `fetch()` untuk memuat JSON, jadi **tidak bisa**
dibuka lewat `file://`. Jalankan server statis kecil yang sudah disertakan:

```bash
node tools/serve.mjs
```

Lalu buka <http://localhost:4173>.

---

## Deploy ke GitHub Pages

1. Push seluruh isi folder ini ke sebuah repository.
2. Settings → Pages → Source: `Deploy from a branch` → branch `main`, folder `/ (root)`.
3. Selesai. Routing memakai hash (`#/dashboard`), jadi refresh dan bookmark
   tetap bekerja tanpa konfigurasi rewrite apa pun.

---

## Menyambungkan ke Google Sheets

1. Buat Google Sheets baru → **Extensions → Apps Script**.
2. Tempel isi [`apps-script/Code.gs`](apps-script/Code.gs), ganti nilai `TOKEN`.
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Salin URL `/exec` ke `assets/js/config.js`:

```js
export const SHEETS = {
  endpoint: 'https://script.google.com/macros/s/AKfycb.../exec',
  token: 'token-yang-sama-dengan-Code.gs',
  ...
};
```

Sheet `Latihan`, `Ujian`, dan `Capstone` dibuat otomatis beserta barisan
judulnya saat kiriman pertama masuk.

Selama `endpoint` masih kosong, aplikasi tetap berjalan penuh: setiap kiriman
masuk **antrean lokal** dan siswa diberi tahu bahwa datanya belum terkirim —
bukan gagal diam-diam. Antrean dicoba ulang otomatis saat halaman dimuat.

---

## Mengubah materi & bank soal

Semua konten adalah JSON statis di `data/`, bisa disunting langsung lewat GitHub
tanpa panel admin:

| Berkas | Isi |
|---|---|
| `data/materi-html.json` | 12 bab HTML (dasar → lanjutan) |
| `data/materi-css.json` | 10 bab CSS (dasar → lanjutan) |
| `data/soal-html.json` | 36 soal HTML — **3 soal per bab** |
| `data/soal-css.json` | 30 soal CSS — **3 soal per bab** |
| `data/soal-campuran.json` | 6 soal gabungan HTML + CSS |

Setiap bab punya beberapa soal latihan; layar Latihan menampilkannya sebagai satu
rangkaian ("Soal 2 dari 3") dengan navigasi maju-mundur dan penanda soal mana yang
sudah dikerjakan.

### Struktur satu bab materi

Selain `lead`, `concepts`, dan `sections`, tiap bab bisa menyertakan:

| Field | Isi |
|---|---|
| `reference` | Tabel referensi cepat: `[{ "kode": "...", "arti": "..." }]` |
| `referenceHead` | Judul dua kolom tabel itu, mis. `["Tag", "Kegunaan"]` |
| `pitfalls` | Kesalahan umum: `[{ "salah": "...", "benar": "...", "kenapa": "..." }]` |
| `example` | Contoh interaktif; `html` (dan `css` bila relevan) |

### Format satu soal

```json
{
  "id": "html-dasar-001",
  "modul": "HTML",
  "level": "Dasar",
  "chapterId": "html-01",
  "chapterModul": "html",
  "topik": "Pengenalan HTML",
  "editor": "html",
  "instruksi": "Di dalam <code>&lt;body&gt;</code>, buat heading level 1…",
  "starter_code": {
    "html": "<!DOCTYPE html>
<html lang=\"id\">
<head>…</head>
<body>

  <!-- ✏️ TULIS JAWABAN ANDA DI SINI -->

</body>
</html>"
  },
  "assertions": [
    { "type": "element_exists", "selector": "h1", "poin": 30, "label": "elemen <h1> ditemukan" }
  ],
  "total_poin": 100
}
```

**Starter code selalu berupa dokumen HTML utuh** — lengkap dengan `<!DOCTYPE>`,
`<html>`, `<head>`, dan `<body>` — dan siswa mengisi bagian bertanda
`<!-- ✏️ TULIS JAWABAN ANDA DI SINI -->`. Ini disengaja: siswa tidak pernah melihat
potongan HTML yang menggantung, jadi tidak bingung ke mana perginya kerangka dokumen
saat ujian.

Field `editor` menentukan panel mana yang aktif:

| Nilai | Panel HTML | Panel CSS |
|---|---|---|
| `"html"` (bawaan) | aktif | nonaktif |
| `"css"` | terkunci, disediakan sebagai bahan | aktif |
| `"campuran"` | aktif | aktif |

Pada soal `"css"`, HTML yang terkunci sudah memuat
`<link rel="stylesheet" href="style.css">` — panel CSS itulah berkasnya. Preview
menetralkan tautan tersebut (CSS disuntikkan langsung) agar tidak ada permintaan
yang gagal; tag-nya tetap terlihat di editor karena itu bagian pelajarannya.

`"htmlReadOnly": true` pada soal lama masih dibaca sebagai `editor: "css"`.

Skor = (poin terpenuhi ÷ total poin) × 100.

### Tipe assertion yang tersedia

| Tipe | Parameter | Memeriksa |
|---|---|---|
| `element_exists` | `selector` | Elemen ada |
| `element_count_min` | `selector`, `min` | Jumlah elemen minimal |
| `element_count_equals` | `selector`, `count` | Jumlah elemen persis |
| `descendant_count_min` | `selector`, `child_selector`, `min` | Jumlah anak di dalam elemen |
| `text_content_equals` | `selector`, `expected`, `case_sensitive?` | Isi teks persis |
| `text_contains` | `selector`, `expected` | Isi teks memuat |
| `text_min_word_count` | `selector`, `min_words` | Jumlah kata |
| `attribute_exists` | `selector`, `attribute` | Atribut ada |
| `attribute_equals` | `selector`, `attribute`, `expected` | Nilai atribut |
| `attribute_starts_with` | `selector`, `attribute`, `expected` | Awalan nilai atribut |
| `attribute_min_word_count` | `selector`, `attribute`, `min_words` | Jumlah kata dalam atribut (mis. `alt`) |
| `computed_style_equals` | `selector`, `property`, `expected`, `tolerance?` | Computed style (warna dinormalkan; `tolerance` untuk nilai numerik) |
| `computed_style_one_of` | `selector`, `property`, `expected[]` | Salah satu nilai diterima |
| `computed_style_contains` | `selector`, `property`, `contains` | Substring computed style |
| `grid_column_count` | `selector`, `count` | Jumlah kolom grid |
| `source_matches` | `pattern`, `target` (`css`/`html`), `flags?`, `describe?` | Pola pada teks kode — untuk `@keyframes`, `@media`, `::before` yang tidak tercermin di computed style satu elemen |

Setiap assertion boleh menambahkan `"label"` (teks yang dilihat siswa) dan
`"hint"` (petunjuk yang muncul hanya bila kriteria itu belum terpenuhi).

> Iframe penilaian berukuran **1000 × 700 px**. Soal responsif harus menuliskan
> breakpoint yang aktif pada lebar itu.

---

## Aturan ujian

Diatur di `assets/js/config.js` → `EXAM`:

| Aturan | Nilai |
|---|---|
| Durasi | 90 menit, auto-submit saat habis |
| Jumlah soal | 5, diacak per siswa |
| Komposisi | 2 soal HTML · 2 soal CSS · 1 soal gabungan (`EXAM.komposisi`) |
| Urutan | Sequential — tidak bisa kembali ke soal sebelumnya |
| Jumlah submit | Bebas, selama waktu tersisa |
| Batas pelanggaran | 2; pelanggaran ke-3 memblokir sesi |
| Masa blokir | 60 menit, lalu sesi dimulai fresh (timer baru + soal diacak ulang) |
| Toleransi blur | Pindah tab < 3 detik tidak dihitung |

Komposisi dijamin setiap sesi — yang diacak adalah *soal mana* dari tiap bank dan
urutannya, sehingga tiap siswa dapat kombinasi berbeda dengan bobot materi yang sama.
Ubah perbandingannya di `EXAM.komposisi`; totalnya harus sama dengan `questionCount`.

---

## Struktur proyek

```
index.html                  kerangka SPA
assets/css/app.css          design system retro (token Organic)
assets/js/
  config.js                 satu-satunya berkas yang perlu diubah guru
  main.js                   rute + penjaga akses
  router.js                 hash router
  state.js                  identitas, progres, sesi ujian, blokir
  content.js                pemuat materi & bank soal
  editor.js                 editor kode (highlight overlay + nomor baris)
  preview.js                live preview (iframe sandbox)
  grader.js                 auto-grading engine
  anticheat.js              deteksi pelanggaran
  exam-runtime.js           anti-cheat & fullscreen lintas-layar ujian
  submit.js                 pengiriman ke Apps Script + antrean lokal
  workbench.js              split-screen editor + preview
  ui.js                     potongan antarmuka bersama
  views/                    9 layar
data/                       materi & 3 bank soal (JSON)
apps-script/Code.gs         backend Google Sheets
tools/serve.mjs             server statis untuk pengembangan
```

### Peta layar → rute

| Layar | Rute |
|---|---|
| Identifikasi siswa | `#/` |
| Dashboard modul | `#/dashboard` |
| Materi + mini live-preview | `#/materi/:modul/:no` |
| Latihan (split-screen) | `#/latihan/:soalId` |
| Pra-ujian (briefing) | `#/ujian/mulai` |
| Ujian (split-screen) | `#/ujian/soal/:n` |
| Hasil & skor | `#/ujian/hasil` |
| Blokir 60 menit | `#/ujian/terblokir` |
| Capstone (submission CV) | `#/capstone` |

---

## Batasan yang perlu diketahui

Poin-poin berikut adalah **konsekuensi arsitektur** (static hosting + anti-cheat
client-side), bukan bug yang bisa diperbaiki di implementasi ini.

1. **Anti-cheat bisa dilewati.** Semua deteksi berjalan di browser siswa. Siapa
   pun yang mematikan JavaScript atau memakai extension tertentu dapat
   melewatinya. Sistem ini berfungsi sebagai pencegah tingkat dasar–menengah dan
   alat pencatat bukti — **pengawasan manual guru tetap diperlukan**.
2. **Endpoint dan token terekspos.** Keduanya ada di kode klien yang bisa dibaca
   siapa saja lewat DevTools. Token hanya mengurangi spam iseng, bukan pengaman.
3. **Identitas tidak terverifikasi.** Nama dan NISN tidak dicek terhadap
   database sekolah; siswa bisa mengisi identitas yang tidak akurat.
4. **Fullscreen & Visibility API** paling stabil di Chrome/Edge terbaru.
   Perilaku di Safari/Firefox, terutama iOS Safari, dapat berbeda dan **belum
   diuji langsung** di proyek ini.
5. **Validasi link Capstone hanya level jaringan.** Karena respons lintas-origin
   bersifat opaque, sistem hanya bisa membedakan "ada respons" vs "tidak ada
   respons" — bukan HTTP 200 vs 404, dan sama sekali tidak membaca isi halaman.
   Penilaian CV dilakukan guru secara manual.
6. **Auto-grading tidak menilai estetika.** Hanya kriteria terukur (struktur DOM,
   teks, atribut, computed style). Soal harus ditulis dengan assertion eksplisit.
7. **Split-screen butuh layar ≥ 1024px.** Di bawah itu halaman latihan dan ujian
   menampilkan pesan "gunakan laptop/PC"; materi dan capstone tetap bisa dibuka.
8. **NISN adalah data pribadi.** Pastikan penggunaan Google Sheets ini sesuai
   kebijakan privasi data sekolah.
9. **Contoh gambar memakai layanan luar.** Beberapa contoh materi dan template soal
   merujuk `https://placehold.co/...`. Bila jaringan sekolah memblokir domain itu,
   gambarnya tidak tampil — ganti saja URL-nya di `data/*.json` dengan gambar milik
   sendiri. Ini **belum diuji** pada jaringan sekolah.

### Catatan implementasi

- **Anti-cheat di Latihan** aktif dan mencatat pelanggaran (§8.5 PRD), tetapi
  tidak memicu blokir — percobaan latihan memang tidak dibatasi (§8.2).
  Konsekuensi blokir hanya berlaku pada Ujian.
- **Pelanggaran beruntun** dari jenis yang sama diberi jeda 2 detik agar satu
  tombol yang ditahan tidak menghabiskan seluruh kuota pelanggaran sekaligus.
- **Editor** tidak memakai CodeMirror 6. PRD menyebutnya sebagai rekomendasi,
  bukan kewajiban; editor overlay bawaan memberi highlighting, nomor baris, dan
  auto-indent tanpa dependensi eksternal maupun build step.

---

*M. Aziz Al Assad, S.T., Gr. | 2026*
