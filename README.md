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

Token bersama **sudah terisi** dan sama di kedua sisi
(`apps-script/Code.gs` → `TOKEN`, `assets/js/config.js` → `SHEETS.token`),
jadi yang perlu diisi guru hanya satu hal: URL `/exec`.

1. Buka [sheets.new](https://sheets.new) untuk membuat spreadsheet baru, beri nama
   mis. **WebTM — Rekap Nilai**.
2. Di spreadsheet itu: **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, tempel seluruh isi
   [`apps-script/Code.gs`](apps-script/Code.gs) dari repo ini, lalu simpan.
4. **Deploy → New deployment → ⚙️ → Web app**
   - Description: `WebTM`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - klik **Deploy**, setujui izin yang diminta
5. Salin **Web app URL** (berakhiran `/exec`).
6. Tempel ke `assets/js/config.js`:

```js
export const SHEETS = {
  endpoint: 'https://script.google.com/macros/s/AKfycb.../exec',
  ...
};
```

7. Commit & push — GitHub Pages membangun ulang sendiri dalam ~1 menit.

**Cara memastikan berhasil:** buka URL `/exec` itu langsung di browser. Kalau
muncul `{"ok":true,"service":"WebTM",...}`, deployment-nya sudah benar.

### Sheet yang terbentuk

Ketiganya dibuat otomatis beserta baris judulnya saat kiriman pertama masuk —
terpisah, tidak pernah bercampur:

| Sheet | Isi | Kolom |
|---|---|---|
| **Latihan** | Tiap submit latihan (percobaan tak terbatas) | 15 |
| **Ujian** | Tiap submit soal ujian **dan** baris ringkasan nilai akhir | 22 |
| **Capstone** | Pengumpulan link CV | 6 |

Sheet **Ujian** punya kolom **`Jenis`** yang membedakan dua macam baris:

- `Per Soal` — satu baris tiap kali siswa submit sebuah soal (boleh berkali-kali)
- `Ringkasan` — satu baris per sesi, berisi **nilai akhir**, rincian skor tiap soal,
  durasi, jumlah pelanggaran, dan alasan selesai

Untuk rekap nilai, filter kolom `Jenis` = `Ringkasan`; kolom `Skor` pada baris itu
adalah nilai akhir siswa.

Selama `endpoint` masih kosong, aplikasi tetap berjalan penuh: setiap kiriman masuk
**antrean lokal** dan siswa diberi tahu datanya belum terkirim — bukan gagal
diam-diam. Antrean dicoba ulang otomatis saat halaman dimuat.

> **[Batasan keamanan]** Token ikut terbaca siapa pun yang membuka kode klien.
> Ia menahan spam iseng, **bukan** pengaman. Jangan menaruh data sensitif di
> spreadsheet ini selain yang memang dibutuhkan rekap nilai.

---

## Mengubah materi & bank soal

Semua konten adalah JSON statis di `data/`, bisa disunting langsung lewat GitHub
tanpa panel admin:

| Berkas | Isi |
|---|---|
| `data/materi-html.json` | 15 bab HTML (dasar → lanjutan) |
| `data/materi-css.json` | 13 bab CSS (dasar → lanjutan) |
| `data/soal-html.json` | 45 soal HTML — **3 soal per bab** |
| `data/soal-css.json` | 39 soal CSS — **3 soal per bab** |
| `data/soal-campuran.json` | 6 soal gabungan HTML + CSS |

Total **28 bab** dan **90 soal**. Cakupan materi mengikuti w3schools, tetapi
disaring: hanya topik yang benar-benar terpakai di proyek capstone (CV pribadi).
Enam bab terakhir sengaja diarahkan ke sana — jalur berkas & struktur proyek,
elemen kontak/kutipan, merakit halaman CV, background & gradient, border &
bayangan, serta menata daftar/tabel/tautan.

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

### Menilai penggunaan yang benar, bukan sekadar keberadaan tag

Assertion biasa memakai `querySelector` — hanya elemen **pertama**. Akibatnya
tiga gambar yang cuma satu ber-`alt` tetap lulus. Tipe di bawah ini menutup
celah itu, dan sebagian memeriksa **teks sumber**, bukan DOM, karena parser
browser diam-diam memperbaiki markup yang rusak sehingga jejaknya hilang.

| Tipe | Menangkap |
|---|---|
| `all_match` | Syarat diterapkan ke **setiap** elemen yang cocok, bukan yang pertama |
| `tags_balanced` | Tag tidak ditutup, atau urutan penutupnya tertukar |
| `nesting_valid` | `<li>` di luar list, `<a>` di dalam `<a>`, block di dalam inline |
| `heading_order_valid` | Heading melompat tingkat (h1 → h3) |
| `label_for_valid` | `<label for>` menunjuk `id` yang tidak ada |
| `no_duplicate_ids` | `id` yang sama dipakai dua kali |
| `table_structure_valid` | Jumlah kolom tiap baris tidak konsisten setelah `colspan`/`rowspan` dihitung |
| `element_not_empty` | Elemen ada tetapi isinya kosong |
| `attribute_not_one_of` | Nilai asal-asalan seperti `href="#"` |
| `elements_in_order` | Urutan elemen di dokumen |
| `source_not_matches` | Larangan, mis. `style=` inline atau jalur berawalan `/` |

Ketika gagal, pemeriksa struktural memberi **alasan konkret** — bukan sekadar
tanda silang:

```
✕ jumlah kolom tiap baris konsisten  → baris 4 punya 3 kolom, baris pertama 2
✕ urutan heading tidak melompat      → melompat dari <h1> ke <h4>
✕ semua tag dibuka & ditutup         → <div> belum ditutup sebelum </body>
```

Setiap soal yang siswanya menulis HTML otomatis mendapat **gerbang mutu**
`tags_balanced` + `nesting_valid` (20 dari 100 poin). Soal yang jawabannya
benar tidak terpengaruh — gerbang ini hanya menggigit saat kodenya ceroboh.

**Contoh `all_match`:**

```json
{
  "type": "all_match",
  "selector": "img",
  "min": 3,
  "must": { "attribute_min_words": { "attribute": "alt", "min_words": 2 } },
  "poin": 20,
  "label": "SETIAP gambar punya alt minimal 2 kata"
}
```

Syarat yang didukung `must`: `not_empty`, `min_words`, `attribute_exists`,
`attribute_not_empty`, `attribute_equals`, `attribute_min_words`,
`attribute_not_one_of`, `contains_selector`, `computed_style_equals`.

> **[Batas yang jujur]** Ini bukan validator W3C. Ia menangkap kesalahan yang
> paling sering terjadi dan bisa diperiksa secara terukur — bukan seluruh
> pelanggaran spesifikasi HTML.

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
9. **Apps Script lambat, dan bisa kena rate-limit.** Diukur langsung pada deployment
   ini: satu penulisan baris memakan **3–7 detik** saat server senggang. Google
   menjalankan permintaan web app milik satu akun **secara berurutan**, jadi bila
   banyak siswa menekan Submit berbarengan, yang terakhir menunggu antrean.

   Saat diuji beban (puluhan kiriman dalam ~20 menit), Google mulai membalas
   **HTTP 404 "tidak dapat membuka file"** khusus pada `doPost` — sementara `doGet`
   tetap normal. Ini rate-limit, bukan kerusakan: setelah **±3 menit tanpa lalu
   lintas, layanan pulih sendiri** dan kembali merespons 3 detik. Sudah diverifikasi
   pulih.

   Mitigasi yang terpasang: timeout klien 30 detik, jeda 1,5 detik antar-kiriman saat
   menguras antrean, dan kiriman yang tetap gagal masuk **antrean lokal** lalu dicoba
   ulang otomatis saat halaman dimuat — sudah diuji dan antrean berhasil terkuras.
   Datanya tidak hilang, hanya bisa telat masuk.

   **Saran praktis saat ujian:** jangan menyuruh seluruh kelas menekan Submit di
   detik yang sama. Karena siswa boleh submit berkali-kali selama waktu berjalan,
   sebarkan saja secara alami.
10. **Baris ganda mungkin muncul.** Bila sebuah kiriman sebenarnya berhasil di server
   tapi jawabannya tidak sempat sampai ke siswa, percobaan ulang akan menulis baris
   kedua. Ini tidak merusak nilai: untuk rekap, filter `Jenis = Ringkasan` lalu ambil
   baris terakhir per sesi — kolom `Sesi` membedakan satu sesi ujian dari yang lain.
11. **Contoh gambar memakai layanan luar.** Beberapa contoh materi dan template soal
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
