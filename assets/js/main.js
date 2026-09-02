/**
 * WebTM — Web Training Module.
 * Titik masuk aplikasi: mendaftarkan rute, memasang penjaga akses, dan boot.
 */

import { APP } from './config.js';
import { toast } from './util.js';
import { createRouter } from './router.js';
import { examRuntime } from './exam-runtime.js';
import { flushOutbox } from './submit.js';
import {
  getStudent, getLockout, getExam, modulePercent
} from './state.js';
import { getMateri } from './content.js';

import identityView from './views/identity.js';
import dashboardView from './views/dashboard.js';
import materiView from './views/materi.js';
import latihanView from './views/latihan.js';
import ujianMulaiView from './views/ujian-mulai.js';
import ujianSoalView from './views/ujian-soal.js';
import ujianHasilView from './views/ujian-hasil.js';
import terblokirView from './views/terblokir.js';
import capstoneView from './views/capstone.js';
import alatDemoView from './views/alat-demo.js';

const root = document.getElementById('app');

/** Cache ringan supaya penjaga rute tidak menunggu fetch tiap navigasi. */
let capstoneUnlocked = false;
async function refreshCapstoneGate() {
  try {
    const [html, css] = await Promise.all([getMateri('html'), getMateri('css')]);
    capstoneUnlocked =
      modulePercent('html', html.chapters.length) === 100 &&
      modulePercent('css', css.chapters.length) === 100;
  } catch { capstoneUnlocked = false; }
}

const routes = [
  { path: '/', view: identityView },
  { path: '/dashboard', view: dashboardView },
  { path: '/materi/:modul/:no', view: materiView },
  { path: '/latihan/:soalId', view: latihanView },
  { path: '/ujian/mulai', view: ujianMulaiView },
  { path: '/ujian/soal/:n', view: ujianSoalView },
  { path: '/ujian/hasil', view: ujianHasilView },
  { path: '/ujian/terblokir', view: terblokirView },
  { path: '/capstone', view: capstoneView },

  /**
   * Alat guru, sengaja tidak terhubung dari menu mana pun: menyiapkan keadaan
   * peramban seolah satu siswa sudah menuntaskan seluruh modul, agar layar
   * Capstone bisa didemokan tanpa mengerjakan 90 soal.
   */
  { path: '/alat/akun-demo', view: alatDemoView }
];

const router = createRouter({
  root,
  routes,
  context: { examRuntime },
  fallback: dashboardView,

  onBeforeNavigate(path) {
    // Alat guru boleh dibuka tanpa identitas — ia justru yang mengisinya.
    if (path === '/alat/akun-demo') return null;

    // 1. Identitas wajib sebelum apa pun (§8.7 PRD).
    if (!getStudent() && path !== '/') return '/';
    if (getStudent() && path === '/' && getExam()) return '/dashboard';

    // 2. Masa blokir mengunci seluruh ruang ujian (§8.5 PRD).
    if (getLockout() && path.startsWith('/ujian') && path !== '/ujian/terblokir') {
      return '/ujian/terblokir';
    }
    if (!getLockout() && path === '/ujian/terblokir') return '/dashboard';

    // 3. Capstone terbuka setelah kedua modul selesai (§9 PRD).
    if (path === '/capstone' && !capstoneUnlocked) {
      toast('Capstone terbuka setelah modul HTML dan CSS selesai 100%.', 'warn', 5000);
      return '/dashboard';
    }

    examRuntime.syncWithRoute(path);
    return null;
  }
});

/**
 * Menutup tab saat ujian berlangsung berisiko kehilangan sisa waktu, jadi
 * browser diminta memunculkan konfirmasi bawaannya.
 */
window.addEventListener('beforeunload', (ev) => {
  const exam = getExam();
  if (exam && !exam.finished) { ev.preventDefault(); ev.returnValue = ''; }
});

(async function boot() {
  document.title = `${APP.name} — ${APP.longName}`;
  await refreshCapstoneGate();

  // Progres materi berubah lewat navigasi, jadi gerbang capstone disegarkan
  // setiap kali rute berganti.
  window.addEventListener('hashchange', refreshCapstoneGate);

  router.start();

  // Kiriman yang sempat gagal (jaringan sekolah putus, dsb.) dicoba lagi diam-diam.
  flushOutbox()
    .then(({ sent }) => { if (sent) toast(`${sent} kiriman tertunda berhasil dikirim ulang.`, 'ok'); })
    .catch(() => { /* diamkan: bukan kegagalan yang perlu ditampilkan ke siswa */ });
})();
