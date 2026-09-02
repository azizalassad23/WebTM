/**
 * Alat guru — menyiapkan "akun demo" yang sudah menyelesaikan seluruh latihan
 * dan ujian, sehingga tinggal mengumpulkan Capstone (route: `/alat/akun-demo`).
 *
 * Gunanya untuk mendemokan atau menguji layar Capstone tanpa harus mengerjakan
 * 90 soal lebih dulu.
 *
 * [Yang perlu diketahui — jujur soal batasannya]
 * Halaman ini tidak terhubung dari mana pun di antarmuka, tetapi situs ini
 * statis: siapa pun yang tahu alamatnya bisa membukanya. Dampaknya kecil dan
 * disengaja:
 *   - progres bab dan skor latihan hanya hidup di localStorage peramban,
 *     TIDAK PERNAH dikirim ke Google Sheets, jadi tidak membentuk nilai apa pun;
 *   - yang terbuka hanyalah formulir Capstone, yang tetap dinilai manual guru;
 *   - nilai ujian di Sheet hanya berasal dari submission sungguhan.
 * Alat ini juga sengaja TIDAK mengirim apa pun ke Sheets, supaya rekap nilai
 * guru tidak tercemar data palsu.
 */

import { esc, toast } from '../util.js';
import { screen, brand, footer } from '../ui.js';
import { getMateri, getBank } from '../content.js';
import {
  setStudent, getStudent, clearStudent, getProgress, resetProgress,
  setCapstoneSubmitted, clearExam, setExam, getCapstone
} from '../state.js';
import { local, session } from '../util.js';

const DEMO = { nama: 'Aisyah Ramadhani (DEMO)', kelas: 'XI TEI 2 / 0071234567' };

/** Ringkasan keadaan lokal saat ini, untuk ditampilkan di layar. */
async function ringkasan() {
  const [mh, mc] = await Promise.all([getMateri('html'), getMateri('css')]);
  const total = mh.chapters.length + mc.chapters.length;
  const p = getProgress();
  const latihan = local.get('webtm.practice', {});
  const tuntas = Object.values(latihan).filter((r) => r.lastScore === 100).length;
  return {
    siswa: getStudent(),
    babSelesai: p.html.length + p.css.length,
    babTotal: total,
    latihanTuntas: tuntas,
    capstoneTerkirim: !!getCapstone(),
    ujianSelesai: !!session.get('webtm.examDemoSelesai', false)
  };
}

export default async function alatDemoView(_params, { router }) {
  const [mh, mc, bh, bc, bm] = await Promise.all([
    getMateri('html'), getMateri('css'),
    getBank('html'), getBank('css'), getBank('campuran')
  ]);
  const semuaSoal = [...bh, ...bc, ...bm];
  const totalBab = mh.chapters.length + mc.chapters.length;
  const r = await ringkasan();

  const el = screen({
    top: `<header class="topbar">
            ${brand('')}
            <span class="brand-sub">ALAT GURU · TIDAK TERHUBUNG DARI MENU</span>
          </header>`,
    body: `
      <div class="wrap" style="padding:40px 0 56px;max-width:820px">

        <div class="kicker" style="margin-bottom:10px">ALAT GURU</div>
        <h2>Akun demo — sudah lulus semua latihan &amp; ujian</h2>
        <p class="muted" style="max-width:62ch">
          Menyiapkan keadaan peramban seolah satu siswa sudah menuntaskan seluruh
          modul, sehingga layar <strong>Capstone</strong> langsung terbuka dan bisa
          didemokan tanpa mengerjakan ${semuaSoal.length} soal lebih dulu.
        </p>

        <div class="panel panel-peach pad sh-4" style="margin:24px 0">
          <div class="kicker" style="margin-bottom:8px">YANG PERLU DIKETAHUI</div>
          <ul class="prose-list" style="margin:0;font-size:14px">
            <li>Alat ini <strong>tidak mengirim apa pun ke Google Sheets</strong> — rekap
              nilai Bapak tidak akan tercemar data palsu.</li>
            <li>Progres bab dan skor latihan memang hanya hidup di peramban ini dan
              tidak pernah dikirim ke Sheet, jadi <strong>tidak membentuk nilai apa pun</strong>.</li>
            <li>Halaman ini tidak terhubung dari menu mana pun, tetapi situs statis
              tidak bisa menyembunyikan alamat. Yang bisa "dicurangi" hanyalah
              terbukanya formulir Capstone — yang tetap Bapak nilai manual.</li>
            <li>Data hanya berlaku di peramban dan perangkat ini.</li>
          </ul>
        </div>

        <h3 style="margin-top:32px">Keadaan sekarang</h3>
        <div class="ref-table" style="max-width:none">
          <table>
            <thead><tr><th>Item</th><th>Nilai</th></tr></thead>
            <tbody data-ringkas>
              <tr><td>Identitas siswa</td><td>${r.siswa ? esc(r.siswa.nama + ' · ' + r.siswa.kelas) : '<em>belum diisi</em>'}</td></tr>
              <tr><td>Bab ditandai selesai</td><td>${r.babSelesai} / ${r.babTotal}</td></tr>
              <tr><td>Latihan berskor 100</td><td>${r.latihanTuntas} / ${semuaSoal.length}</td></tr>
              <tr><td>Capstone</td><td>${r.capstoneTerkirim ? 'sudah dikumpulkan' : 'belum dikumpulkan'}</td></tr>
            </tbody>
          </table>
        </div>

        <h3 style="margin-top:32px">Yang akan disiapkan</h3>
        <ul class="prose-list">
          <li>Identitas: <code>${esc(DEMO.nama)}</code> · <code>${esc(DEMO.kelas)}</code></li>
          <li>Seluruh <strong>${totalBab} bab</strong> materi ditandai selesai (HTML + CSS 100%)</li>
          <li>Seluruh <strong>${semuaSoal.length} soal latihan</strong> tercatat berskor 100</li>
          <li>Satu <strong>sesi ujian selesai</strong> dengan nilai akhir 100, tanpa pelanggaran</li>
          <li>Formulir <strong>Capstone terbuka</strong> dan siap diisi</li>
        </ul>

        <div class="row" style="gap:12px;margin-top:28px;flex-wrap:wrap">
          <button class="btn btn-primary btn-lg" type="button" data-act="buat">
            Siapkan akun demo
          </button>
          <button class="btn btn-white" type="button" data-act="capstone">
            Langsung ke layar Capstone
          </button>
          <button class="btn btn-quiet" type="button" data-act="hapus">
            Hapus semua data lokal
          </button>
        </div>

        <p class="small muted" style="margin-top:26px">
          Alamat halaman ini: <code>#/alat/akun-demo</code> — simpan sebagai penanda
          bila sering dipakai.
        </p>
      </div>`,
    foot: footer('route: /alat/akun-demo  ·  alat guru, bukan bagian alur siswa')
  });

  /* ----------------------------------------------------------- tindakan */

  async function segarkan() {
    const s = await ringkasan();
    el.querySelector('[data-ringkas]').innerHTML = `
      <tr><td>Identitas siswa</td><td>${s.siswa ? esc(s.siswa.nama + ' · ' + s.siswa.kelas) : '<em>belum diisi</em>'}</td></tr>
      <tr><td>Bab ditandai selesai</td><td>${s.babSelesai} / ${s.babTotal}</td></tr>
      <tr><td>Latihan berskor 100</td><td>${s.latihanTuntas} / ${semuaSoal.length}</td></tr>
      <tr><td>Capstone</td><td>${s.capstoneTerkirim ? 'sudah dikumpulkan' : 'belum dikumpulkan'}</td></tr>`;
  }

  el.querySelector('[data-act="buat"]').addEventListener('click', async () => {
    setStudent(DEMO.nama, DEMO.kelas);

    // Semua bab ditandai selesai → modul HTML & CSS mencapai 100%,
    // yang inilah syarat terbukanya Capstone.
    local.set('webtm.progress', {
      html: mh.chapters.map((c) => c.id),
      css: mc.chapters.map((c) => c.id),
      capstoneSubmitted: false
    });

    // Riwayat latihan: tiap soal tercatat pernah dikerjakan dan berskor 100.
    const latihan = {};
    for (const q of semuaSoal) {
      latihan[q.id] = {
        attempts: 1,
        lastScore: 100,
        lastCode: null,
        lastResult: {
          score: 100,
          earned: 100,
          total: 100,
          results: (q.assertions || []).map((a) => ({
            type: a.type, label: a.label || a.type, poin: a.poin,
            earned: a.poin, ok: true, hint: null
          }))
        }
      };
    }
    local.set('webtm.practice', latihan);

    // Satu sesi ujian yang sudah selesai dengan nilai 100.
    const idUjian = [bh[0], bh[1], bc[0], bc[1], bm[0]].filter(Boolean).map((q) => q.id);
    const mulai = Date.now() - 64 * 60_000;
    const exam = {
      id: '#DEMO', modul: 'campuran',
      startedAt: mulai, endsAt: mulai + 90 * 60_000,
      questionIds: idUjian, current: idUjian.length - 1,
      answers: {}, scores: {}, submitCount: idUjian.length,
      violations: [], finished: true,
      finishedAt: Date.now(), finishReason: 'manual', finalScore: 100
    };
    for (const id of idUjian) {
      const q = semuaSoal.find((x) => x.id === id);
      exam.scores[id] = {
        score: 100, submittedAt: Date.now(),
        result: {
          score: 100, earned: 100, total: 100,
          results: (q?.assertions || []).map((a) => ({
            type: a.type, label: a.label || a.type, poin: a.poin,
            earned: a.poin, ok: true, hint: null
          }))
        }
      };
    }
    setExam(exam);
    session.set('webtm.examDemoSelesai', true);

    await segarkan();
    toast('Akun demo siap. Capstone sudah terbuka.', 'ok', 5000);
  });

  el.querySelector('[data-act="capstone"]').addEventListener('click', () => {
    if (!getStudent()) { toast('Siapkan akun demo dulu.', 'warn'); return; }
    router.navigate('/capstone');
  });

  el.querySelector('[data-act="hapus"]').addEventListener('click', async () => {
    resetProgress();
    clearExam();
    clearStudent();
    local.remove('webtm.capstone');
    local.remove('webtm.outbox');
    local.remove('webtm.lockout');
    local.remove('webtm.lockoutCycles');
    session.remove('webtm.examDemoSelesai');
    setCapstoneSubmitted(false);
    await segarkan();
    toast('Semua data lokal dihapus.', '', 4000);
  });

  return { el };
}

