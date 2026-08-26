/** WebTM — potongan antarmuka yang dipakai berulang di banyak layar. */

import { APP } from './config.js';
import { esc } from './util.js';

/** String HTML → elemen. Konten berasal dari repo, bukan input siswa. */
export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function brand(sub = APP.tagline) {
  return `
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">&lt;/&gt;</span>
      <span class="brand-name">${esc(APP.name)}</span>
      ${sub ? `<span class="brand-sub">${esc(sub)}</span>` : ''}
    </div>`;
}

export function identityChip(student) {
  if (!student) return '';
  return `<span class="chip-dark">${esc(student.nama)} · ${esc(student.kelas)}</span>`;
}

export function footer(route, dark = false) {
  return `
    <footer class="footer${dark ? ' footer-dark' : ''}">
      <span>${esc(APP.teacher)} | ${APP.year}</span>
      <span class="route">${esc(route)}</span>
    </footer>`;
}

/**
 * Kerangka satu layar: topbar → isi → footer.
 * @returns {HTMLElement}
 */
export function screen({ top = '', body = '', foot = '', className = '' }) {
  return frag(`
    <div class="app-shell ${className}">
      ${top}
      <main class="app-main">${body}</main>
      ${foot}
    </div>`);
}

/** Pesan untuk layar < 1024px pada halaman split-screen (§11 PRD). */
export function narrowNotice(what = 'Halaman ini') {
  return `
    <div class="too-narrow">
      <div class="panel sh-6 pad" style="max-width:520px">
        <div class="kicker" style="margin-bottom:10px">LAYAR TERLALU SEMPIT</div>
        <h3>Gunakan laptop atau PC</h3>
        <p class="muted" style="margin:0">
          ${esc(what)} memakai tata letak split-screen: editor kode di kiri dan
          hasil render di kanan. Di layar di bawah 1024px keduanya tidak muat
          berdampingan. Halaman materi dan capstone tetap bisa dibuka dari
          perangkat ini.
        </p>
      </div>
    </div>`;
}

/**
 * Modal sederhana. Mengembalikan objek dengan `close()`.
 * Fokus dikunci di dalam modal selama terbuka.
 */
export function openModal(html, { onClose } = {}) {
  const host = document.getElementById('overlay-root');
  const backdrop = frag(`<div class="modal-backdrop" role="dialog" aria-modal="true">${html}</div>`);
  host.appendChild(backdrop);

  const previous = document.activeElement;
  const focusable = () => Array.from(
    backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((el) => !el.disabled);

  focusable()[0]?.focus();

  function trap(ev) {
    if (ev.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }
  backdrop.addEventListener('keydown', trap);

  function close() {
    backdrop.remove();
    previous?.focus?.();
    onClose?.();
  }

  return { el: backdrop, close };
}

/** Rangkaian titik pelanggaran: terisi sesuai jumlah, sisanya putus-putus. */
export function violationDots(count, max) {
  let out = '';
  for (let i = 0; i < max; i++) out += `<i class="${i < count ? 'on' : ''}"></i>`;
  return out;
}

/** Daftar log pelanggaran untuk modal, hasil, dan halaman blokir. */
export function violationLog(violations) {
  if (!violations.length) return '<div class="log-list"><div><span>tidak ada pelanggaran</span></div></div>';
  return `<div class="log-list">${violations.map((v) => `
    <div><span>${v.no} · ${esc(v.label)}</span><span class="time">${esc(v.time)}</span></div>
  `).join('')}</div>`;
}
