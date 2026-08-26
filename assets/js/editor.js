/**
 * WebTM — editor kode ringan.
 *
 * Alih-alih menarik CodeMirror 6 (butuh build step / CDN ESM), panel kiri
 * memakai teknik overlay: sebuah <pre> ber-syntax-highlight di lapisan bawah
 * dan <textarea> transparan di atasnya. Hasilnya: highlighting, nomor baris,
 * auto-indent, dan Tab — tanpa dependensi eksternal, sehingga situs tetap
 * bisa di-deploy apa adanya ke GitHub Pages (§12 PRD: rekomendasi, bukan
 * kewajiban).
 */

import { esc } from './util.js';

const INDENT = '  ';

/* ------------------------------------------------------------ highlighting */

function highlightHTML(src) {
  let out = '';
  let last = 0;
  const re = /<!--[\s\S]*?(?:-->|$)|<[!/]?[A-Za-z][^>]*>?/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out += esc(src.slice(last, m.index));
    out += m[0].startsWith('<!--')
      ? `<span class="tk-com">${esc(m[0])}</span>`
      : highlightTag(m[0]);
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}

function highlightTag(token) {
  let out = '';
  let rest = token;
  const head = /^(<[!/]?)([A-Za-z][-\w:.]*)/.exec(token);
  if (head) {
    out += `<span class="tk-tag">${esc(head[1] + head[2])}</span>`;
    rest = token.slice(head[0].length);
  }
  const re = /("[^"]*"|'[^']*')|([A-Za-z_:][-\w:.]*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(rest)) !== null) {
    out += esc(rest.slice(last, m.index));
    out += m[1]
      ? `<span class="tk-str">${esc(m[1])}</span>`
      : `<span class="tk-attr">${esc(m[2])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(rest.slice(last));
}

function highlightCSS(src) {
  let out = '';
  let i = 0;
  let depth = 0;

  const emit = (text, cls) => {
    if (!text) return;
    out += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
  };

  while (i < src.length) {
    // komentar boleh muncul di mana saja
    if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      emit(src.slice(i, stop), 'tk-com');
      i = stop;
      continue;
    }

    if (depth === 0) {
      // selektor sampai '{' berikutnya
      const brace = src.indexOf('{', i);
      const comment = src.indexOf('/*', i);
      if (brace === -1) { emit(src.slice(i), 'tk-sel'); break; }
      if (comment !== -1 && comment < brace) { emit(src.slice(i, comment), 'tk-sel'); i = comment; continue; }
      emit(src.slice(i, brace), 'tk-sel');
      emit('{', null);
      i = brace + 1;
      depth++;
      continue;
    }

    // di dalam blok: properti : nilai ;
    const ch = src[i];
    if (ch === '}') { emit('}', null); i++; depth--; continue; }
    if (ch === '{') { emit('{', null); i++; depth++; continue; }

    const colon = src.indexOf(':', i);
    const semi = src.indexOf(';', i);
    const close = src.indexOf('}', i);
    const nextStop = [semi, close].filter((n) => n !== -1).sort((a, b) => a - b)[0] ?? src.length;

    if (colon !== -1 && colon < nextStop) {
      emit(src.slice(i, colon), 'tk-prop');
      emit(':', null);
      emit(src.slice(colon + 1, nextStop), 'tk-val');
      i = nextStop;
    } else {
      emit(src.slice(i, nextStop), null);
      i = nextStop;
    }
    if (i < src.length && src[i] === ';') { emit(';', null); i++; }
  }
  return out;
}

export function highlight(code, language) {
  return language === 'css' ? highlightCSS(code) : highlightHTML(code);
}

/* ------------------------------------------------------------- auto-indent */

function indentOf(line) {
  return (/^[ \t]*/.exec(line) || [''])[0];
}

/** Menambah satu level indentasi setelah `{` atau setelah tag pembuka. */
function opensBlock(line) {
  const trimmed = line.trim();
  if (trimmed.endsWith('{')) return true;
  const tag = /<([A-Za-z][-\w:.]*)(?:\s[^<>]*)?>$/.exec(trimmed);
  if (!tag) return false;
  if (trimmed.endsWith('/>')) return false;
  const VOID = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'source', 'track', 'wbr'];
  if (VOID.includes(tag[1].toLowerCase())) return false;
  // <p>teks</p> di satu baris tidak menambah indentasi
  return !new RegExp(`</${tag[1]}\\s*>$`, 'i').test(trimmed) || trimmed === tag[0];
}

/* ---------------------------------------------------------------- komponen */

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount   wadah kosong yang akan diisi editor
 * @param {string}  [opts.value]     isi awal
 * @param {'html'|'css'} [opts.language]
 * @param {boolean} [opts.readOnly]
 * @param {(value:string)=>void} [opts.onChange]
 * @param {string}  [opts.label]     label a11y
 */
export function createEditor(opts) {
  const {
    mount, value = '', language = 'html', readOnly = false,
    onChange = () => {}, label = 'Editor kode'
  } = opts;

  mount.innerHTML = `
    <div class="code-area">
      <pre class="code-gutter" aria-hidden="true"></pre>
      <div class="code-stack">
        <pre class="code-hl" aria-hidden="true"></pre>
        <textarea class="code-input" spellcheck="false" autocapitalize="off"
                  autocomplete="off" autocorrect="off" wrap="off"
                  aria-label="${esc(label)}"${readOnly ? ' readonly' : ''}></textarea>
      </div>
    </div>`;

  const area = mount.querySelector('.code-area');
  const gutter = mount.querySelector('.code-gutter');
  const hl = mount.querySelector('.code-hl');
  const input = mount.querySelector('.code-input');

  let lang = language;
  input.value = value;

  function paint() {
    const code = input.value;
    // baris kosong di akhir tetap perlu tinggi, jadi tambahkan spasi semu
    hl.innerHTML = highlight(code, lang) + '\n ';
    const lines = code.split('\n').length;
    let g = '';
    for (let n = 1; n <= lines; n++) g += n + '\n';
    gutter.textContent = g;
  }

  function emit() {
    paint();
    onChange(input.value);
  }

  input.addEventListener('input', emit);
  input.addEventListener('scroll', () => { area.scrollTop = input.scrollTop; });

  input.addEventListener('keydown', (ev) => {
    if (readOnly) return;

    if (ev.key === 'Tab') {
      ev.preventDefault();
      const { selectionStart: a, selectionEnd: b, value: v } = input;
      if (ev.shiftKey) {
        const lineStart = v.lastIndexOf('\n', a - 1) + 1;
        const head = v.slice(lineStart, a);
        const cut = /^ {1,2}/.exec(head);
        if (cut) {
          input.value = v.slice(0, lineStart) + head.slice(cut[0].length) + v.slice(a);
          input.selectionStart = input.selectionEnd = a - cut[0].length;
        }
      } else {
        input.value = v.slice(0, a) + INDENT + v.slice(b);
        input.selectionStart = input.selectionEnd = a + INDENT.length;
      }
      emit();
      return;
    }

    if (ev.key === 'Enter') {
      ev.preventDefault();
      const { selectionStart: a, selectionEnd: b, value: v } = input;
      const lineStart = v.lastIndexOf('\n', a - 1) + 1;
      const line = v.slice(lineStart, a);
      let pad = indentOf(line);
      if (opensBlock(line)) pad += INDENT;
      const insert = '\n' + pad;
      input.value = v.slice(0, a) + insert + v.slice(b);
      input.selectionStart = input.selectionEnd = a + insert.length;
      emit();
    }
  });

  paint();

  return {
    get value() { return input.value; },
    getValue: () => input.value,
    setValue(next) { input.value = next ?? ''; emit(); },
    setLanguage(next) { lang = next; paint(); },
    setReadOnly(flag) { input.readOnly = !!flag; },
    focus() { input.focus(); },
    element: input,
    destroy() { mount.innerHTML = ''; }
  };
}
