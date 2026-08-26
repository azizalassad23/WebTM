/**
 * WebTM — anti-cheat engine (§8.5 PRD).
 *
 * Empat mekanisme: deteksi pindah tab/window, blokir copy-paste, blokir klik
 * kanan + pintasan DevTools, dan wajib layar penuh.
 *
 * [Perlu diketahui — batasan inheren, §5.3 PRD] Seluruh deteksi berjalan di
 * sisi klien. Siswa yang paham teknis dapat mematikan JavaScript atau memakai
 * extension untuk melewatinya. Sistem ini adalah pencegah tingkat dasar-menengah
 * sekaligus alat pencatat bukti — bukan kontrol keamanan absolut. Pengawasan
 * manual guru tetap diperlukan saat ujian.
 */

import { EXAM } from './config.js';
import { timeOfDay } from './util.js';

const TYPE_LABEL = {
  blur: 'pindah tab / window',
  clipboard: 'copy-paste diblokir',
  contextmenu: 'klik kanan diblokir',
  devtools: 'pintasan DevTools diblokir',
  fullscreen: 'keluar layar penuh'
};

/** Jeda agar satu aksi beruntun (mis. Ctrl+V ditahan) tidak dihitung berkali-kali. */
const COOLDOWN_MS = 2000;

const DEVTOOLS_KEYS = (ev) => {
  const k = (ev.key || '').toLowerCase();
  if (k === 'f12') return true;
  if (ev.ctrlKey && ev.shiftKey && ['i', 'j', 'c'].includes(k)) return true;
  if (ev.metaKey && ev.altKey && ['i', 'j', 'c'].includes(k)) return true; // macOS
  if (ev.ctrlKey && k === 'u') return true;
  if (ev.metaKey && ev.altKey && k === 'u') return true;
  return false;
};

const CLIPBOARD_KEYS = (ev) => {
  const k = (ev.key || '').toLowerCase();
  const mod = ev.ctrlKey || ev.metaKey;
  return mod && ['c', 'v', 'x'].includes(k);
};

/**
 * @param {object} opts
 * @param {'latihan'|'ujian'} opts.mode
 * @param {boolean} [opts.requireFullscreen]
 * @param {Array}   [opts.initialViolations] lanjutkan hitungan dari sesi tersimpan
 * @param {(violation:object, count:number)=>void} [opts.onViolation]
 * @param {(violations:Array)=>void} [opts.onLockout]
 * @param {(active:boolean)=>void}   [opts.onFullscreenChange]
 */
export function createAntiCheat(opts) {
  const {
    mode = 'latihan',
    requireFullscreen = false,
    initialViolations = [],
    onViolation = () => {},
    onLockout = () => {},
    onFullscreenChange = () => {}
  } = opts;

  const violations = initialViolations.slice();
  const lastAt = Object.create(null);
  let running = false;
  let awayAt = 0;
  let lockedOut = false;

  function record(type, detail) {
    if (lockedOut) return;
    const now = Date.now();
    if (now - (lastAt[type] || 0) < COOLDOWN_MS) return;
    lastAt[type] = now;

    const violation = {
      no: violations.length + 1,
      type,
      label: detail ? `${TYPE_LABEL[type]} (${detail})` : TYPE_LABEL[type],
      at: now,
      time: timeOfDay(new Date(now))
    };
    violations.push(violation);
    onViolation(violation, violations.length);

    // Blokir hanya berlaku pada mode Ujian (§8.5). Latihan tetap mencatat
    // pelanggaran, tetapi percobaannya memang tak terbatas (§8.2).
    if (mode === 'ujian' && violations.length > EXAM.maxViolations) {
      lockedOut = true;
      stop();
      onLockout(violations.slice());
    }
  }

  /* ------------------------------------------------------------- handlers */

  const onBlur = () => { if (!awayAt) awayAt = Date.now(); };

  const onFocus = () => {
    if (!awayAt) return;
    const away = Date.now() - awayAt;
    awayAt = 0;
    // [Dikonfirmasi guru] blur < 3 detik diabaikan — mengakomodasi notifikasi
    // sistem yang muncul sekilas.
    if (away >= EXAM.blurToleranceMs) {
      record('blur', `${Math.round(away / 1000)} detik`);
    }
  };

  const onVisibility = () => {
    if (document.hidden) onBlur();
    else onFocus();
  };

  const onClipboard = (ev) => {
    ev.preventDefault();
    record('clipboard');
  };

  const onContextMenu = (ev) => {
    ev.preventDefault();
    record('contextmenu');
  };

  const onKeyDown = (ev) => {
    if (DEVTOOLS_KEYS(ev)) {
      ev.preventDefault();
      record('devtools');
      return;
    }
    if (CLIPBOARD_KEYS(ev)) {
      ev.preventDefault();
      record('clipboard');
    }
  };

  const onFsChange = () => {
    const active = !!document.fullscreenElement;
    onFullscreenChange(active);
    if (requireFullscreen && !active && running) record('fullscreen');
  };

  const onDragStart = (ev) => ev.preventDefault();

  /* ---------------------------------------------------------------- API */

  function start() {
    if (running) return;
    running = true;
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onClipboard, true);
    document.addEventListener('cut', onClipboard, true);
    document.addEventListener('paste', onClipboard, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('fullscreenchange', onFsChange);
  }

  function stop() {
    running = false;
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('copy', onClipboard, true);
    document.removeEventListener('cut', onClipboard, true);
    document.removeEventListener('paste', onClipboard, true);
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('dragstart', onDragStart, true);
    document.removeEventListener('fullscreenchange', onFsChange);
  }

  return {
    start,
    stop,
    get violations() { return violations.slice(); },
    get count() { return violations.length; },
    get isFullscreen() { return !!document.fullscreenElement; },
    /** Dipanggil dari handler klik — Fullscreen API butuh gestur pengguna. */
    async requestFullscreen(target = document.documentElement) {
      if (document.fullscreenElement) return true;
      try {
        await target.requestFullscreen({ navigationUI: 'hide' });
        return true;
      } catch (err) {
        console.warn('[WebTM] permintaan layar penuh ditolak', err);
        return false;
      }
    },
    async exitFullscreen() {
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch { /* diabaikan */ }
      }
    }
  };
}

export { TYPE_LABEL };

/** Ringkasan teks log pelanggaran untuk kolom "Detail Pelanggaran" di Sheet. */
export function summarizeViolations(violations = []) {
  if (!violations.length) return 'tidak ada';
  return violations.map((v) => `${v.no}. ${v.label} @ ${v.time}`).join(' | ');
}
