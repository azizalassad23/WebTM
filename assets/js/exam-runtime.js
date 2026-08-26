/**
 * WebTM — runtime ujian.
 *
 * Anti-cheat dan mode layar penuh harus bertahan saat siswa berpindah dari
 * soal 1 ke soal 2, padahal router mengganti seluruh view. Karena itu keduanya
 * dipegang satu objek berumur sesi di sini, bukan di dalam view.
 *
 * Hitungan pelanggaran juga ditulis balik ke sessionStorage setiap kali terjadi,
 * supaya refresh halaman di tengah ujian tidak mengosongkan riwayatnya.
 */

import { EXAM } from './config.js';
import { createAntiCheat } from './anticheat.js';
import { getExam, setExam, applyLockout } from './state.js';

const listeners = new Set();
let engine = null;

function emit(event, payload) {
  listeners.forEach((fn) => { try { fn(event, payload); } catch (err) { console.error(err); } });
}

function ensureEngine() {
  if (engine) return engine;
  const exam = getExam();
  engine = createAntiCheat({
    mode: 'ujian',
    requireFullscreen: true,
    initialViolations: exam?.violations || [],
    onViolation(violation, count) {
      const current = getExam();
      if (current) {
        current.violations = engine.violations;
        setExam(current);
      }
      emit('violation', { violation, count });
    },
    onLockout(violations) {
      applyLockout(violations);
      emit('lockout', { violations });
    },
    onFullscreenChange(active) { emit('fullscreen', { active }); }
  });
  return engine;
}

export const examRuntime = {
  /** Dipanggil dari handler klik — Fullscreen API menuntut gestur pengguna. */
  async requestFullscreen() {
    return ensureEngine().requestFullscreen(document.documentElement);
  },

  start() { ensureEngine().start(); },

  /** Mematikan pemantauan dan keluar dari layar penuh. */
  async stop({ exitFullscreen = true } = {}) {
    if (!engine) return;
    engine.stop();
    if (exitFullscreen) await engine.exitFullscreen();
    engine = null;
  },

  get violations() { return engine ? engine.violations : (getExam()?.violations || []); },
  get count() { return this.violations.length; },
  get max() { return EXAM.maxViolations; },
  get isFullscreen() { return !!document.fullscreenElement; },

  /** Berlangganan kejadian: 'violation' | 'lockout' | 'fullscreen'. */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /**
   * Menyelaraskan runtime dengan rute aktif: pemantauan hanya hidup di halaman
   * soal ujian, dan dimatikan begitu siswa keluar dari sana.
   */
  syncWithRoute(path) {
    const inExam = /^\/ujian\/soal\//.test(path);
    if (inExam) {
      if (getExam()) this.start();
    } else if (engine) {
      this.stop();
    }
  }
};
