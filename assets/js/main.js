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

/**
 * Yang di-cache adalah JUMLAH BAB, bukan status terbuka/terkuncinya.
 *
 * Semula yang disimpan adalah boolean hasil perhitungan, dan diperbarui secara
 * asinkron pada tiap `hashchange`. Penjaga rute membacanya serentak, jadi siswa
 * yang baru menuntaskan bab terakhir lalu langsung menekan "Buka Capstone"
 * terlempar balik ke dasbor karena nilainya masih yang lama.
 *
 * Jumlah bab tidak pernah berubah saat aplikasi berjalan, sedangkan progres ada
 * di localStorage dan bisa dibaca seketika — jadi statusnya dihitung ulang tiap
 * kali penjaga dipanggil, tanpa balapan.
 */
let jumlahBab = null;
async function muatJumlahBab() {
  try {
    const [html, css] = await Promise.all([getMateri('html'), getMateri('css')]);
    jumlahBab = { html: html.chapters.length, css: css.chapters.length };
  } catch { jumlahBab = null; }
}

function capstoneTerbuka() {
  if (!jumlahBab) return false;
  return modulePercent('html', jumlahBab.html) === 100
    && modulePercent('css', jumlahBab.css) === 100;
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
    if (path === '/capstone' && !capstoneTerbuka()) {
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
  await muatJumlahBab();

  router.start();

  // Kiriman yang sempat gagal (jaringan sekolah putus, dsb.) dicoba lagi diam-diam.
  flushOutbox()
    .then(({ sent }) => { if (sent) toast(`${sent} kiriman tertunda berhasil dikirim ulang.`, 'ok'); })
    .catch(() => { /* diamkan: bukan kegagalan yang perlu ditampilkan ke siswa */ });
})();
