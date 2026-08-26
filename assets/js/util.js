/** WebTM — helper kecil yang dipakai lintas modul. */

/** Escape untuk interpolasi aman ke dalam template HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Detik → "MM:SS" (atau "HH:MM:SS" bila melebihi satu jam). */
export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Date → "HH:MM:SS" waktu lokal. */
export function timeOfDay(date = new Date()) {
  return date.toLocaleTimeString('id-ID', { hour12: false });
}

/** Date → "26 Agu 2026, 11:12". */
export function stamp(date = new Date()) {
  return date.toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function debounce(fn, wait) {
  let t = null;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(t);
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  return wrapped;
}

export function uid(prefix = '') {
  const n = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return prefix + n;
}

/**
 * Pengacakan Fisher–Yates. Dipakai untuk mengacak set soal ujian per siswa
 * (§8.3 PRD) — tiap sesi baru memanggil ini lagi sehingga kombinasi berbeda.
 */
export function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

/* ------------------------------------------------------------------ storage */

function makeStore(backing) {
  return {
    get(key, fallback = null) {
      try {
        const raw = backing.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { backing.setItem(key, JSON.stringify(value)); return true; }
      catch { return false; }
    },
    remove(key) {
      try { backing.removeItem(key); } catch { /* mode privat / kuota penuh */ }
    }
  };
}

export const local = makeStore(window.localStorage);
export const session = makeStore(window.sessionStorage);

/* -------------------------------------------------------------------- toast */

let toastHost = null;

export function toast(message, kind = '', ms = 3600) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-stack';
    document.body.appendChild(toastHost);
  }
  const node = document.createElement('div');
  node.className = 'toast' + (kind ? ` toast-${kind}` : '');
  node.setAttribute('role', 'status');
  node.textContent = message;
  toastHost.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

/* --------------------------------------------------------------------- misc */

/** Menunggu satu frame — dipakai sebelum mengukur layout. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Ambil JSON dengan pesan error yang jelas bila file bank soal/materi hilang. */
export async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Gagal memuat ${path} (HTTP ${res.status})`);
  return res.json();
}
