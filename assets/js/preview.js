/**
 * WebTM — live preview engine (§8.4 PRD).
 *
 * Kode siswa dirender di dalam <iframe sandbox srcdoc>. Sandbox tanpa
 * `allow-same-origin` berarti dokumen di dalamnya berada di origin unik:
 * script siswa boleh jalan, tapi tidak bisa menyentuh halaman WebTM,
 * localStorage, maupun sesi ujian.
 */

import { PREVIEW_DEBOUNCE } from './config.js';
import { debounce } from './util.js';

/** Tipografi dasar supaya hasil render tidak terlihat "telanjang". */
const BASE_STYLE = `<style>
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; padding: 22px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         font-size: 16px; line-height: 1.55; color: #201e1d; background: #fff; }
  img { max-width: 100%; }
</style>`;

/**
 * Template soal CSS sengaja memuat `<link rel="stylesheet" href="style.css">`
 * supaya siswa melihat bagaimana CSS sungguhan disambungkan. Berkas itu tidak
 * ada — isinya kita suntikkan sendiri dari panel editor — jadi tautannya
 * dinetralkan di sini agar preview tidak memicu permintaan yang pasti gagal.
 * Tautan ke alamat mutlak (mis. Google Fonts) tetap dibiarkan bekerja.
 */
function dropLocalStylesheets(html) {
  return html.replace(
    /<link\b[^>]*>/gi,
    (tag) => {
      if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
      const href = /href\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] || '';
      const external = /^(https?:)?\/\//i.test(href) || href.startsWith('data:');
      return external ? tag : `<!-- ${tag.replace(/--+/g, '-')} -->`;
    }
  );
}

/** Menyusun dokumen utuh dari potongan HTML + CSS milik siswa. */
export function buildDocument(rawHtml = '', css = '', opsi = {}) {
  // Penilaian perlu MELIHAT tag <link> untuk memeriksa jalur berkasnya, jadi di
  // sana tautan lokal dibiarkan utuh. Di panel preview ia tetap dinetralkan
  // supaya tidak memicu permintaan yang pasti gagal.
  const html = opsi.pertahankanLink ? rawHtml : dropLocalStylesheets(rawHtml);
  const userStyle = css.trim() ? `<style>\n${css}\n</style>` : '';
  const injected = BASE_STYLE + userStyle;

  if (/<html[\s>]/i.test(html)) {
    if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, injected + '</head>');
    if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => m + injected);
    return html + injected;
  }
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">${injected}</head>
<body>
${html}
</body></html>`;
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount wadah untuk iframe
 * @param {number} [opts.debounceMs]
 * @param {string} [opts.title]
 */
export function createPreview({ mount, debounceMs = PREVIEW_DEBOUNCE, title = 'Live preview' }) {
  const frame = document.createElement('iframe');
  frame.className = 'preview-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('title', title);
  frame.setAttribute('referrerpolicy', 'no-referrer');
  mount.appendChild(frame);

  const write = (html, css) => { frame.srcdoc = buildDocument(html, css); };
  const debounced = debounce(write, debounceMs);

  return {
    /** Update otomatis dengan debounce (§8.4: ±500ms). */
    update(html, css) { debounced(html, css); },
    /** Tombol "Run" — langsung, tanpa menunggu debounce. */
    run(html, css) { debounced.cancel(); write(html, css); },
    destroy() { debounced.cancel(); frame.remove(); }
  };
}
