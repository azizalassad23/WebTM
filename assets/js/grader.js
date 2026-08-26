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
  source_matches: (a) => `kode ${a.target || 'css'} memuat ${a.describe || a.pattern}`
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
      try { return new RegExp(a.pattern, a.flags || 'i').test(src); }
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
    frame.srcdoc = buildDocument(html, css);
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
      try { ok = evaluate(a, doc, win, code); }
      catch (err) { console.warn('[WebTM] assertion gagal dievaluasi', a, err); }
      return {
        type: a.type,
        label: labelFor(a),
        poin: a.poin || 0,
        earned: ok ? (a.poin || 0) : 0,
        ok,
        hint: ok ? null : (a.hint || null)
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
