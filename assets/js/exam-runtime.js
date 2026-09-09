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

import { PROFIL, aturanSesi } from './sesi.js';
import { createAntiCheat } from './anticheat.js';
import { getExam, setExam, applyLockout, getStudent } from './state.js';
import { submitRow } from './submit.js';
import { summarizeViolations } from './anticheat.js';

const listeners = new Set();
let engine = null;

function emit(event, payload) {
  listeners.forEach((fn) => { try { fn(event, payload); } catch (err) { console.error(err); } });
}

function ensureEngine() {
  if (engine) return engine;
  const exam = getExam();
  const sesi = exam?.sesi || 'ujian';
  engine = createAntiCheat({
    mode: sesi,
    sesi,
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
      // Rekamnya DULU: applyLockout menghapus sesi, dan tanpa baris ini siswa
      // yang curang di soal pertama tidak meninggalkan jejak apa pun di rekap
      // guru — padahal layar blokir menjanjikan sebaliknya.
      laporkanBlokir(getExam(), violations, sesi);
      applyLockout(violations, sesi);
      emit('lockout', { violations });
    },
    onFullscreenChange(active) { emit('fullscreen', { active }); }
  });
  return engine;
}

/**
 * Satu baris "BLOKIR" ke sheet: siapa, kapan, pelanggaran apa, dan skor yang
 * sempat terkumpul. Sengaja tidak di-await — kegagalan jaringan sudah ditangani
 * antrean lokal di submit.js, dan siswa tidak boleh tertahan di layar mana pun
 * hanya karena Apps Script sedang lambat.
 */
function laporkanBlokir(exam, violations, sesi) {
  if (!exam) return;
  const R = PROFIL[sesi] || PROFIL.ujian;
  const siswa = getStudent();
  const skor = exam.questionIds.map((id) => `${id}=${exam.scores[id]?.score ?? 0}`).join(' | ');
  submitRow(R.sheet, {
    nama: siswa?.nama || '',
    kelas: siswa?.kelas || '',
    mode: R.mode,
    modul: (exam.modul || '').toUpperCase(),
    idSoal: 'BLOKIR',
    sesi: exam.id,
    nomorSoal: `${exam.current + 1}/${exam.questionIds.length}`,
    daftarSoal: exam.questionIds.join(', '),
    skor: 0,
    rincianSkor: skor,
    jumlahSubmit: exam.submitCount,
    waktuMulai: new Date(exam.startedAt).toISOString(),
    waktuSubmit: new Date().toISOString(),
    durasiDetik: Math.round((Date.now() - exam.startedAt) / 1000),
    jumlahPelanggaran: violations.length,
    detailPelanggaran: summarizeViolations(violations),
    statusBlokir: `diblokir ${R.lockoutMinutes} menit — jawaban dihapus`,
    alasanSelesai: 'dihentikan karena pelanggaran'
  }).catch(() => { /* sudah masuk antrean lokal */ });
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
  get max() { return aturanSesi(getExam()).maxViolations; },
  get isFullscreen() { return !!document.fullscreenElement; },

  /** Berlangganan kejadian: 'violation' | 'lockout' | 'fullscreen'. */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /**
   * Menyelaraskan runtime dengan rute aktif: pemantauan hanya hidup di halaman
   * soal ujian, dan dimatikan begitu siswa keluar dari sana.
   */
  syncWithRoute(path) {
    const inExam = Object.keys(PROFIL).some((k) => path.startsWith('/' + k + '/soal/'));
    if (inExam) {
      if (getExam()) this.start();
    } else if (engine) {
      this.stop();
    }
  }
};
