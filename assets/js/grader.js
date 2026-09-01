/**
 * WebTM — auto-grading engine (§8.6 PRD).
 *
 * Kode siswa dirender ke iframe tersembunyi yang *same-origin tapi tanpa
 * script* (`sandbox="allow-same-origin"`), sehingga kita bisa membaca DOM dan
 * `getComputedStyle` sementara script siswa tidak pernah dieksekusi.
 *
 * Batas yang jujur: mesin ini hanya menilai kriteria yang terukur — keberadaan
 * elemen, isi teks, atribut, dan computed style. Ia tidak menilai estetika.
 * Soal harus ditulis dengan assertion eksplisit agar skornya valid.
 */

import { buildDocument } from './preview.js';

/**
 * Label cadangan bila soal tidak menuliskannya sendiri.
 * Teks polos — pemanggil meng-escape-nya sebelum ditampilkan, karena selector
 * bisa memuat karakter seperti `>` yang akan merusak markup bila dibiarkan.
 */
const LABELS = {
  element_exists: (a) => `elemen ${a.selector} ditemukan`,
  element_count_min: (a) => `minimal ${a.min} elemen ${a.selector}`,
  element_count_equals: (a) => `tepat ${a.count} elemen ${a.selector}`,
  attribute_starts_with: (a) => `${a.selector}[${a.attribute}] diawali "${a.expected}"`,
  attribute_min_word_count: (a) => `${a.selector}[${a.attribute}] minimal ${a.min_words} kata`,
  descendant_count_min: (a) => `${a.selector} berisi minimal ${a.min} ${a.child_selector}`,
  text_content_equals: (a) => `teks ${a.selector} = "${a.expected}"`,
  text_contains: (a) => `teks ${a.selector} memuat "${a.expected}"`,
  text_min_word_count: (a) => `${a.selector} minimal ${a.min_words} kata`,
  attribute_exists: (a) => `atribut ${a.attribute} pada ${a.selector}`,
  attribute_equals: (a) => `${a.selector}[${a.attribute}] = "${a.expected}"`,
  computed_style_equals: (a) => `${a.selector} ${a.property} = ${a.expected}`,
  computed_style_one_of: (a) => `${a.selector} ${a.property} salah satu dari ${(a.expected || []).join(' / ')}`,
  computed_style_contains: (a) => `${a.selector} ${a.property} memuat "${a.contains}"`,
  grid_column_count: (a) => `${a.selector} punya ${a.count} kolom grid`,
  source_matches: (a) => `kode ${a.target || 'css'} memuat ${a.describe || a.pattern}`,
  source_not_matches: (a) => `kode ${a.target || 'css'} TIDAK memuat ${a.describe || a.pattern}`,
  all_match: (a) => `setiap ${a.selector} memenuhi syarat`,
  tags_balanced: () => 'semua tag dibuka dan ditutup dengan benar',
  heading_order_valid: () => 'urutan heading tidak melompat tingkat',
  label_for_valid: () => 'setiap <label for> menunjuk isian yang ada',
  no_duplicate_ids: () => 'tidak ada id yang dipakai dua kali',
  nesting_valid: () => 'tidak ada elemen yang salah sarang',
  table_structure_valid: () => 'jumlah kolom tiap baris tabel konsisten',
  element_not_empty: (a) => `${a.selector} tidak kosong`,
  attribute_not_one_of: (a) => `${a.selector}[${a.attribute}] bukan ${(a.forbidden || []).join('/')}`,
  elements_in_order: (a) => `${a.before} muncul sebelum ${a.after}`
};

function labelFor(assertion) {
  if (assertion.label) return assertion.label;
  const make = LABELS[assertion.type];
  return make ? make(assertion) : assertion.type;
}

/* ------------------------------------------------------------- normalisasi */

/**
 * Menyamakan penulisan warna: "red", "#f00", dan "rgb(255,0,0)" harus dianggap
 * sama. Caranya dengan meminta browser di dalam iframe menghitung sendiri.
 */
function normalizeColor(doc, value) {
  try {
    const probe = doc.createElement('span');
    probe.style.color = '';
    probe.style.color = value;
    if (!probe.style.color) return String(value).trim().toLowerCase();
    doc.body.appendChild(probe);
    const out = doc.defaultView.getComputedStyle(probe).color;
    probe.remove();
    return out || String(value).trim().toLowerCase();
  } catch {
    return String(value).trim().toLowerCase();
  }
}

const isColorProp = (prop) => /color/i.test(prop);

function normalizeValue(doc, prop, value) {
  const raw = String(value ?? '').trim();
  if (isColorProp(prop)) return normalizeColor(doc, raw);
  return raw.toLowerCase().replace(/\s+/g, ' ');
}

/** Cocok bila angka (px, %, dst.) berada dalam toleransi yang diminta soal. */
function numericMatch(actual, expected, tolerance) {
  const na = parseFloat(actual);
  const ne = parseFloat(expected);
  if (Number.isNaN(na) || Number.isNaN(ne)) return false;
  return Math.abs(na - ne) <= (tolerance ?? 0);
}

const words = (text) => text.trim().split(/\s+/).filter(Boolean);
const norm = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

/* ------------------------------------------- pemeriksa kebenaran struktural */

/** Tag yang memang tidak punya penutup. */
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Tag yang penutupnya boleh dihilangkan menurut spesifikasi HTML. */
const OPTIONAL_CLOSE = new Set(['li', 'dt', 'dd', 'p', 'option', 'thead', 'tbody',
  'tfoot', 'tr', 'td', 'th', 'html', 'head', 'body']);

/**
 * Memeriksa keseimbangan tag pada TEKS SUMBER, bukan pada DOM.
 *
 * Ini penting: browser diam-diam memperbaiki markup yang rusak saat mem-parse,
 * sehingga DOM hasil parsing sering terlihat benar padahal kode siswa salah.
 * Contoh `<p>Halo <strong>dunia</p></strong>` menghasilkan DOM yang rapi, tapi
 * penulisannya keliru. Pemeriksaan di level sumber inilah yang menangkapnya.
 *
 * @returns {{ok: boolean, alasan: string|null}}
 */
function tagsBalanced(html) {
  const src = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')          // komentar
    .replace(/<!DOCTYPE[^>]*>/gi, '')          // doctype
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ''); // isi script/style

  const tumpukan = [];
  const re = /<(\/?)([a-zA-Z][-\w]*)([^>]*?)(\/?)>/g;
  let m;

  while ((m = re.exec(src)) !== null) {
    const penutup = m[1] === '/';
    const nama = m[2].toLowerCase();
    const tutupSendiri = m[4] === '/';

    if (VOID_TAGS.has(nama) || tutupSendiri) continue;

    if (!penutup) { tumpukan.push(nama); continue; }

    if (!tumpukan.length) return { ok: false, alasan: `</${nama}> menutup sesuatu yang tidak pernah dibuka` };

    const terakhir = tumpukan[tumpukan.length - 1];
    if (terakhir === nama) { tumpukan.pop(); continue; }

    // Urutan tertukar, mis. <p><strong></p></strong>
    const posisi = tumpukan.lastIndexOf(nama);
    if (posisi === -1) return { ok: false, alasan: `</${nama}> tidak cocok dengan tag mana pun yang terbuka` };

    const belumTertutup = tumpukan.slice(posisi + 1).filter((t) => !OPTIONAL_CLOSE.has(t));
    if (belumTertutup.length) {
      return { ok: false, alasan: `<${belumTertutup[belumTertutup.length - 1]}> belum ditutup sebelum </${nama}>` };
    }
    tumpukan.length = posisi;
  }

  const sisa = tumpukan.filter((t) => !OPTIONAL_CLOSE.has(t));
  if (sisa.length) return { ok: false, alasan: `<${sisa[sisa.length - 1]}> tidak pernah ditutup` };
  return { ok: true, alasan: null };
}

/** Heading tidak boleh melompat tingkat (h1 → h3). */
function headingOrderValid(doc) {
  const tingkat = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map((el) => Number(el.tagName[1]));
  if (!tingkat.length) return { ok: false, alasan: 'tidak ada heading sama sekali' };
  if (tingkat[0] !== 1) return { ok: false, alasan: `heading pertama <h${tingkat[0]}>, seharusnya <h1>` };
  for (let i = 1; i < tingkat.length; i++) {
    if (tingkat[i] - tingkat[i - 1] > 1) {
      return { ok: false, alasan: `melompat dari <h${tingkat[i - 1]}> ke <h${tingkat[i]}>` };
    }
  }
  return { ok: true, alasan: null };
}

/**
 * Jumlah kolom tiap baris harus sama setelah colspan/rowspan diperhitungkan.
 * Inilah beda antara "ada tag colspan" dan "colspan dipakai dengan benar".
 */
function tableStructureValid(table) {
  const baris = Array.from(table.querySelectorAll('tr'));
  if (!baris.length) return { ok: false, alasan: 'tabel tidak punya baris' };

  const terpakai = [];   // sisa rowspan yang menjorok ke baris berikutnya
  let lebar = null;

  for (let r = 0; r < baris.length; r++) {
    let kolom = terpakai[r] || 0;
    for (const sel of baris[r].children) {
      if (!/^(TD|TH)$/.test(sel.tagName)) continue;
      const cs = Math.max(1, parseInt(sel.getAttribute('colspan') || '1', 10) || 1);
      const rs = Math.max(1, parseInt(sel.getAttribute('rowspan') || '1', 10) || 1);
      kolom += cs;
      for (let k = 1; k < rs; k++) terpakai[r + k] = (terpakai[r + k] || 0) + cs;
    }
    if (lebar === null) lebar = kolom;
    else if (kolom !== lebar) {
      return { ok: false, alasan: `baris ${r + 1} punya ${kolom} kolom, baris pertama ${lebar}` };
    }
  }
  return { ok: true, alasan: null };
}

/** Setiap <label for="..."> harus menemukan elemen ber-id itu. */
function labelForValid(doc) {
  const label = Array.from(doc.querySelectorAll('label[for]'));
  if (!label.length) return { ok: false, alasan: 'tidak ada <label for="..."> sama sekali' };
  for (const l of label) {
    const target = l.getAttribute('for');
    if (!target) return { ok: false, alasan: 'ada <label for=""> yang kosong' };
    let ada = null;
    try { ada = doc.getElementById(target); } catch { /* id tak valid */ }
    if (!ada) return { ok: false, alasan: `<label for="${target}"> menunjuk id yang tidak ada` };
  }
  return { ok: true, alasan: null };
}

/** Id yang dipakai lebih dari sekali. */
function duplicateIds(doc) {
  const hitung = Object.create(null);
  for (const el of doc.querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    if (!id) continue;
    hitung[id] = (hitung[id] || 0) + 1;
  }
  return Object.keys(hitung).filter((id) => hitung[id] > 1);
}

/**
 * Elemen yang isinya terbatas pada phrasing content, jadi tidak boleh
 * membungkus elemen block.
 *
 * `<a>` sengaja TIDAK masuk daftar: pada HTML5 content model-nya *transparent*,
 * sehingga `<a href="..."><div>…</div></a>` justru sah — itu pola kartu yang
 * bisa diklik. Menandainya sebagai kesalahan akan menghukum kode yang benar.
 */
const INLINE_WRAP = new Set(['span', 'em', 'strong', 'b', 'i', 'small', 'label', 'button']);
const BLOCK_TAGS = new Set(['div', 'section', 'article', 'aside', 'header', 'footer', 'main',
  'nav', 'p', 'ul', 'ol', 'dl', 'table', 'form', 'figure', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
/** Elemen yang tidak boleh bersarang di dalam dirinya sendiri. */
const NO_SELF_NEST = new Set(['a', 'form', 'p', 'button', 'label']);

/**
 * Sarang salah yang DIPERBAIKI DIAM-DIAM oleh parser browser, sehingga tidak
 * pernah terlihat di DOM. `<a href><a href>` misalnya dipecah jadi dua elemen
 * bersaudara — DOM-nya bersih, kode siswanya tetap keliru. Karena itu di sini
 * yang diperiksa adalah teks sumbernya.
 */
function nestingProblemsSource(html) {
  const src = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');

  const tumpukan = [];
  const masalah = [];
  const re = /<(\/?)([a-zA-Z][-\w]*)([^>]*?)(\/?)>/g;
  let m;

  while ((m = re.exec(src)) !== null) {
    const penutup = m[1] === '/';
    const nama = m[2].toLowerCase();
    if (VOID_TAGS.has(nama) || m[4] === '/') continue;

    if (penutup) {
      const i = tumpukan.lastIndexOf(nama);
      if (i !== -1) tumpukan.length = i;
      continue;
    }

    if (NO_SELF_NEST.has(nama) && tumpukan.includes(nama)) {
      masalah.push(`ada <${nama}> di dalam <${nama}>`);
    }
    if (BLOCK_TAGS.has(nama)) {
      const pembungkus = tumpukan.filter((t) => INLINE_WRAP.has(t));
      if (pembungkus.length) {
        masalah.push(`<${nama}> (block) berada di dalam <${pembungkus[pembungkus.length - 1]}> (inline)`);
      }
      if (tumpukan[tumpukan.length - 1] === 'p' && nama !== 'p') {
        masalah.push(`<${nama}> berada di dalam <p> — browser akan memutus paragrafnya`);
      }
    }
    tumpukan.push(nama);
  }
  return masalah;
}

/**
 * Sarang yang salah menurut aturan HTML dan tidak selalu terlihat di DOM.
 * Dipakai bersama tagsBalanced untuk menangkap penggunaan yang keliru.
 */
function nestingProblems(doc) {
  const masalah = [];
  const cek = (sel, pesan) => { if (doc.querySelector(sel)) masalah.push(pesan); };

  cek('li:not(ul > li):not(ol > li):not(menu > li)', '<li> berada di luar <ul>/<ol>');
  cek('td:not(tr > td), th:not(tr > th)', '<td>/<th> berada di luar <tr>');
  cek('tr:not(table > tr):not(thead > tr):not(tbody > tr):not(tfoot > tr)', '<tr> berada di luar tabel');
  cek('option:not(select > option):not(optgroup > option):not(datalist > option)', '<option> berada di luar <select>');
  cek('dt:not(dl > dt), dd:not(dl > dd)', '<dt>/<dd> berada di luar <dl>');
  cek('a a', 'ada <a> di dalam <a>');
  cek('form form', 'ada <form> di dalam <form>');
  cek('figcaption:not(figure > figcaption)', '<figcaption> berada di luar <figure>');
  cek('summary:not(details > summary)', '<summary> berada di luar <details>');
  // `a > div` sengaja tidak didaftarkan: content model <a> bersifat transparent
  // pada HTML5, jadi membungkus block adalah pola yang sah (kartu yang diklik).
  cek('span > div, span > p, span > section, em > div, strong > div, label > div',
    'elemen block berada di dalam elemen inline');
  return masalah;
}

/* ---------------------------------------------------------------- evaluasi */

function evaluate(assertion, doc, win, code) {
  const a = assertion;
  const q = (sel) => { try { return doc.querySelector(sel); } catch { return null; } };
  const qa = (sel) => { try { return Array.from(doc.querySelectorAll(sel)); } catch { return []; } };

  switch (a.type) {
    case 'element_exists':
      return !!q(a.selector);

    case 'element_count_min':
      return qa(a.selector).length >= (a.min ?? 1);

    case 'element_count_equals':
      return qa(a.selector).length === (a.count ?? 0);

    case 'descendant_count_min': {
      const host = q(a.selector);
      if (!host) return false;
      try { return host.querySelectorAll(a.child_selector).length >= (a.min ?? 1); }
      catch { return false; }
    }

    case 'text_content_equals': {
      const el = q(a.selector);
      if (!el) return false;
      const actual = norm(el.textContent);
      const expected = norm(a.expected);
      return a.case_sensitive === false || a.case_sensitive === undefined
        ? actual.toLowerCase() === expected.toLowerCase()
        : actual === expected;
    }

    case 'text_contains': {
      const el = q(a.selector);
      if (!el) return false;
      return norm(el.textContent).toLowerCase().includes(norm(a.expected).toLowerCase());
    }

    case 'text_min_word_count': {
      const el = q(a.selector);
      if (!el) return false;
      return words(el.textContent).length >= (a.min_words ?? 1);
    }

    case 'attribute_exists': {
      const el = q(a.selector);
      return !!el && el.hasAttribute(a.attribute);
    }

    case 'attribute_equals': {
      const el = q(a.selector);
      if (!el || !el.hasAttribute(a.attribute)) return false;
      const actual = norm(el.getAttribute(a.attribute));
      const expected = norm(a.expected);
      return a.case_sensitive ? actual === expected
        : actual.toLowerCase() === expected.toLowerCase();
    }

    case 'attribute_starts_with': {
      const el = q(a.selector);
      if (!el || !el.hasAttribute(a.attribute)) return false;
      return norm(el.getAttribute(a.attribute)).toLowerCase()
        .startsWith(norm(a.expected).toLowerCase());
    }

    case 'attribute_min_word_count': {
      const el = q(a.selector);
      if (!el || !el.hasAttribute(a.attribute)) return false;
      return words(el.getAttribute(a.attribute)).length >= (a.min_words ?? 1);
    }

    case 'computed_style_equals': {
      const el = q(a.selector);
      if (!el) return false;
      const actual = win.getComputedStyle(el).getPropertyValue(a.property);
      if (a.tolerance != null) return numericMatch(actual, a.expected, a.tolerance);
      return normalizeValue(doc, a.property, actual) === normalizeValue(doc, a.property, a.expected);
    }

    case 'computed_style_one_of': {
      const el = q(a.selector);
      if (!el) return false;
      const actual = normalizeValue(doc, a.property, win.getComputedStyle(el).getPropertyValue(a.property));
      return (a.expected || []).some((v) => normalizeValue(doc, a.property, v) === actual);
    }

    case 'computed_style_contains': {
      const el = q(a.selector);
      if (!el) return false;
      const actual = win.getComputedStyle(el).getPropertyValue(a.property).toLowerCase();
      return actual.includes(String(a.contains).toLowerCase());
    }

    case 'grid_column_count': {
      const el = q(a.selector);
      if (!el) return false;
      const cols = win.getComputedStyle(el).getPropertyValue('grid-template-columns').trim();
      // Computed value selalu berupa daftar panjang piksel, mis. "306px 306px 306px",
      // jadi jumlah kolom dibaca dari banyaknya nilai — bukan dari teks "repeat(3, 1fr)".
      if (!cols || cols === 'none') return false;
      return cols.split(/\s+/).filter(Boolean).length === (a.count ?? 0);
    }

    case 'source_matches': {
      // Beberapa hal (mis. @keyframes, @media) tidak tercermin di computed style
      // satu elemen. Untuk itu kriteria diperiksa pada teks kode — tetap eksplisit
      // dan terukur, karena polanya ditulis di soal.
      const src = (a.target === 'html' ? code.html : code.css) || '';
      try { return new RegExp(a.pattern, a.flags ?? 'i'   /* `??` agar flags:'' (peka huruf besar-kecil) tidak diubah jadi 'i' */).test(src); }
      catch { return false; }
    }

    /* ------------------------------------------------ kebenaran penggunaan */

    /**
     * Menerapkan satu syarat ke SETIAP elemen yang cocok, bukan hanya yang
     * pertama. Assertion biasa memakai querySelector sehingga tiga gambar yang
     * cuma satu ber-alt tetap lulus — di sinilah bedanya.
     */
    case 'all_match': {
      const semua = qa(a.selector);
      if (semua.length < (a.min ?? 1)) return false;
      const syarat = a.must || {};
      return semua.every((el) => {
        if (syarat.not_empty && !norm(el.textContent)) return false;
        if (syarat.min_words != null && words(el.textContent).length < syarat.min_words) return false;
        if (syarat.attribute_exists && !el.hasAttribute(syarat.attribute_exists)) return false;
        if (syarat.attribute_not_empty) {
          const v = norm(el.getAttribute(syarat.attribute_not_empty));
          if (!v) return false;
        }
        if (syarat.attribute_min_words) {
          const { attribute, min_words } = syarat.attribute_min_words;
          if (words(el.getAttribute(attribute) || '').length < min_words) return false;
        }
        if (syarat.attribute_equals) {
          const { attribute, expected } = syarat.attribute_equals;
          if (norm(el.getAttribute(attribute)).toLowerCase() !== norm(expected).toLowerCase()) return false;
        }
        if (syarat.attribute_not_one_of) {
          const { attribute, forbidden } = syarat.attribute_not_one_of;
          const v = norm(el.getAttribute(attribute)).toLowerCase();
          if (!el.hasAttribute(attribute)) return false;
          if ((forbidden || []).some((f) => norm(f).toLowerCase() === v)) return false;
        }
        if (syarat.contains_selector) {
          try { if (!el.querySelector(syarat.contains_selector)) return false; }
          catch { return false; }
        }
        if (syarat.computed_style_equals) {
          const { property, expected } = syarat.computed_style_equals;
          const aktual = win.getComputedStyle(el).getPropertyValue(property);
          if (normalizeValue(doc, property, aktual) !== normalizeValue(doc, property, expected)) return false;
        }
        return true;
      });
    }

    case 'tags_balanced':
      return tagsBalanced(code.html || '');

    case 'heading_order_valid':
      return headingOrderValid(doc);

    case 'label_for_valid':
      return labelForValid(doc);

    case 'no_duplicate_ids': {
      const ganda = duplicateIds(doc);
      return ganda.length
        ? { ok: false, alasan: `id dipakai lebih dari sekali: ${ganda.join(', ')}` }
        : { ok: true };
    }

    case 'nesting_valid': {
      // Dua lapis: DOM menangkap yang tersisa setelah parsing, sumber menangkap
      // yang keburu "diperbaiki" parser sehingga hilang jejaknya di DOM.
      const m = nestingProblemsSource(code.html || '').concat(nestingProblems(doc));
      return m.length ? { ok: false, alasan: m[0] } : { ok: true };
    }

    case 'table_structure_valid': {
      const t = q(a.selector || 'table');
      if (!t) return { ok: false, alasan: 'tabel tidak ditemukan' };
      return tableStructureValid(t);
    }

    case 'element_not_empty': {
      const el = q(a.selector);
      return !!el && norm(el.textContent).length > 0;
    }

    case 'attribute_not_one_of': {
      const el = q(a.selector);
      if (!el || !el.hasAttribute(a.attribute)) return false;
      const v = norm(el.getAttribute(a.attribute)).toLowerCase();
      return !(a.forbidden || []).some((f) => norm(f).toLowerCase() === v);
    }

    case 'elements_in_order': {
      const b = q(a.before);
      const c2 = q(a.after);
      if (!b || !c2) return false;
      // DOCUMENT_POSITION_FOLLOWING = 4: `after` muncul sesudah `before`.
      return (b.compareDocumentPosition(c2) & 4) !== 0;
    }

    case 'source_not_matches': {
      const src = (a.target === 'html' ? code.html : code.css) || '';
      try { return !new RegExp(a.pattern, a.flags ?? 'i'   /* `??` agar flags:'' (peka huruf besar-kecil) tidak diubah jadi 'i' */).test(src); }
      catch { return false; }
    }

    default:
      // Tipe assertion tak dikenal tidak boleh diam-diam lulus.
      console.warn('[WebTM] tipe assertion tidak dikenal:', a.type);
      return false;
  }
}

/* ------------------------------------------------------------------ runner */

function mountGradingFrame(html, css) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    // same-origin agar DOM terbaca, TANPA allow-scripts agar kode siswa mati.
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    // Harus punya ukuran nyata: getBoundingClientRect & layout butuh viewport.
    frame.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1000px;height:700px;border:0;visibility:hidden;';

    const done = (fn) => {
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      frame.remove();
      reject(new Error('Render penilaian melebihi batas waktu.'));
    }, 8000);

    frame.addEventListener('load', () => done(() => resolve(frame)), { once: true });
    frame.addEventListener('error', () => done(() => { frame.remove(); reject(new Error('Gagal merender kode.')); }), { once: true });

    // srcdoc HARUS diisi sebelum iframe masuk ke dokumen. Bila dibalik, iframe
    // sempat memuat about:blank lebih dulu dan `load` pertama yang kita tangkap
    // adalah halaman kosong itu — penilaian lalu berjalan atas DOM kosong.
    frame.srcdoc = buildDocument(html, css, { pertahankanLink: true });
    document.body.appendChild(frame);
  });
}

/**
 * Menilai satu soal.
 *
 * @param {object} question soal dari bank soal (punya `assertions`)
 * @param {{html?: string, css?: string}} code jawaban siswa
 * @returns {Promise<{score:number, earned:number, total:number, results:Array}>}
 */
export async function grade(question, code) {
  const assertions = question.assertions || [];
  const total = assertions.reduce((sum, a) => sum + (a.poin || 0), 0) || 100;

  let frame;
  try {
    frame = await mountGradingFrame(code.html || '', code.css || '');
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error('Dokumen penilaian tidak dapat dibaca.');

    // Memaksa satu kali layout supaya computed style Flexbox/Grid sudah final.
    void doc.body.getBoundingClientRect();

    const results = assertions.map((a) => {
      let ok = false;
      let alasan = null;
      try {
        // evaluate() boleh mengembalikan boolean, atau {ok, alasan} bila ia
        // punya penjelasan konkret — alasan itu jauh lebih mendidik daripada
        // sekadar tanda silang.
        const keluaran = evaluate(a, doc, win, code);
        if (keluaran && typeof keluaran === 'object') { ok = !!keluaran.ok; alasan = keluaran.alasan || null; }
        else ok = !!keluaran;
      } catch (err) { console.warn('[WebTM] assertion gagal dievaluasi', a, err); }
      return {
        type: a.type,
        label: labelFor(a),
        poin: a.poin || 0,
        earned: ok ? (a.poin || 0) : 0,
        ok,
        hint: ok ? null : (a.hint || alasan || null)
      };
    });

    const earned = results.reduce((sum, r) => sum + r.earned, 0);
    return {
      score: Math.round((earned / total) * 100),
      earned,
      total,
      results
    };
  } finally {
    frame?.remove();
  }
}
