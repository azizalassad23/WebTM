/** Layar 5 — Pra-ujian (route: `/ujian/mulai`, komponen: ExamBriefing, QuestionOutline). */

import { EXAM } from '../config.js';
import { esc, shuffle, toast } from '../util.js';
import { screen, footer } from '../ui.js';
import { getExam, startExam, examSecondsLeft, getLockout } from '../state.js';
import { getBank } from '../content.js';

/** Label bank soal pada daftar isi sesi. */
const BANK_LABEL = { html: 'HTML', css: 'CSS', campuran: 'HTML + CSS' };

export default async function ujianMulaiView(_params, { router, examRuntime }) {
  if (getLockout()) { router.navigate('/ujian/terblokir', true); return { el: document.createElement('div') }; }

  // Sesi yang masih berjalan tidak boleh diacak ulang — lanjutkan di tempatnya.
  const running = getExam();
  if (running && !running.finished && examSecondsLeft(running) > 0) {
    router.navigate(`/ujian/soal/${running.current + 1}`, true);
    return { el: document.createElement('div') };
  }

  const wanted = Object.entries(EXAM.komposisi).filter(([, n]) => n > 0);
  const banks = Object.fromEntries(await Promise.all(
    wanted.map(async ([name]) => [name, await getBank(name)])
  ));

  const kurang = wanted.filter(([name, n]) => (banks[name]?.length ?? 0) < n);
  if (kurang.length) {
    return {
      el: screen({
        body: `<div class="loading">Bank soal belum cukup untuk menyusun ujian:<br><br>
               ${kurang.map(([name, n]) =>
                 `<code>data/soal-${esc(name)}.json</code> berisi ${banks[name]?.length ?? 0} soal, dibutuhkan ${n}.`
               ).join('<br>')}</div>`,
        foot: footer('route: /ujian/mulai')
      })
    };
  }

  // Diacak sekali di layar ini; daftar yang sama dipakai saat sesi dimulai
  // supaya daftar isi cocok dengan soal yang benar-benar keluar.
  // Komposisi dijamin (2 HTML + 2 CSS + 1 campuran), urutannya yang diacak —
  // jadi tiap siswa dapat kombinasi berbeda dengan bobot materi yang sama.
  const picked = shuffle(
    wanted.flatMap(([name, n]) =>
      shuffle(banks[name]).slice(0, n).map((q) => ({ ...q, _bank: name })))
  );

  const komposisiTeks = wanted
    .map(([name, n]) => `${n} ${BANK_LABEL[name]}`)
    .join(' · ');

  const el = screen({
    top: `<header class="topbar topbar-plain" style="background:var(--ink)">
            <span class="brand-name">WebTM · RUANG UJIAN</span>
            <span class="crumbs">sesi belum dimulai — timer belum berjalan</span>
          </header>`,
    body: `
      <section class="briefing">
        <div class="briefing-left">
          <span class="pill-outline-accent">SEBELUM MULAI — BACA SAMPAI HABIS</span>
          <h2>Ujian HTML &amp; CSS</h2>
          <p style="font-size:16px;max-width:52ch;margin-bottom:30px">
            Sesi berlangsung ${EXAM.durationMinutes} menit dan berjalan dalam mode layar penuh.
            Soal ditampilkan satu per satu; setelah disubmit, Anda melanjutkan ke soal
            berikutnya dan tidak dapat kembali. Ujian ini mencampur soal HTML, soal CSS,
            dan soal gabungan — pada soal gabungan Anda menulis <em>index.html</em> dan
            <em>style.css</em> sekaligus, seperti mengerjakan proyek sungguhan.
          </p>

          <div class="brief-grid">
            <div class="brief-stat"><div class="n">${EXAM.durationMinutes}:00</div><div class="l">DURASI · AUTO-SUBMIT SAAT HABIS</div></div>
            <div class="brief-stat"><div class="n">${EXAM.questionCount} soal</div><div class="l">KOMPOSISI: ${esc(komposisiTeks.toUpperCase())}</div></div>
            <div class="brief-stat"><div class="n">maks. ${EXAM.maxViolations}</div><div class="l">PELANGGARAN · KE-${EXAM.maxViolations + 1} = BLOKIR ${EXAM.lockoutMinutes} MENIT</div></div>
            <div class="brief-stat"><div class="n">bebas</div><div class="l">JUMLAH SUBMIT SELAMA WAKTU TERSISA</div></div>
          </div>

          <div class="watch-box">
            <div class="kicker" style="color:var(--a400);margin-bottom:12px">YANG DIPANTAU SISTEM</div>
            <div class="grid">
              <div>◍ Pindah tab / window ≥ ${EXAM.blurToleranceMs / 1000} detik</div>
              <div>◍ Copy, cut, dan paste</div>
              <div>◍ Klik kanan &amp; pintasan DevTools</div>
              <div>◍ Keluar dari mode layar penuh</div>
            </div>
          </div>

          <div class="row" style="gap:16px;flex-wrap:wrap">
            <button class="btn btn-primary btn-on-dark btn-lg" type="button" data-act="mulai">
              Aktifkan Layar Penuh &amp; Mulai
            </button>
            <span class="small" style="color:var(--n500);max-width:24ch">
              Browser akan meminta izin layar penuh. Ujian tidak dapat dimulai tanpa izin ini.
            </span>
          </div>
          <p class="small" style="color:var(--n600);margin-top:22px;max-width:56ch">
            Catatan: deteksi anti-cheat berjalan di browser Anda dan bukan pengaman mutlak.
            Semua kejadian dicatat sebagai bukti dan direkap guru.
          </p>
        </div>

        <aside class="briefing-right">
          <div class="kicker">DAFTAR ISI SESI ANDA</div>
          <h3 style="margin:8px 0 6px">${EXAM.questionCount} soal, urutan terkunci</h3>
          <p class="small muted" style="margin-bottom:22px">
            Judul topik ditampilkan; isi soal baru terbuka saat Anda sampai di soal tersebut.
          </p>
          <div class="outline-list">
            ${picked.map((q, i) => `
              <div class="outline-item${i === 0 ? ' first' : ''}">
                <div class="n">${i + 1}</div>
                <div>
                  <div class="title">${esc(q.topik)}</div>
                  <div class="meta">${esc(BANK_LABEL[q._bank] || q.modul)} · ${esc(q.level.toUpperCase())} · ${q.total_poin || 100} poin</div>
                </div>
              </div>`).join('')}
          </div>
          <div class="dashed" style="margin-top:22px">
            Nilai akhir = rata-rata skor ${EXAM.questionCount} soal. Skor tiap soal muncul segera setelah submit.
          </div>
        </aside>
      </section>`,
    foot: footer('route: /ujian/mulai  ·  komponen: ExamBriefing, QuestionOutline', true)
  });

  el.querySelector('[data-act="mulai"]').addEventListener('click', async () => {
    // Fullscreen API menuntut gestur pengguna, jadi permintaan dilakukan di sini.
    const ok = await examRuntime.requestFullscreen();
    if (!ok) {
      toast('Izin layar penuh ditolak. Ujian tidak dapat dimulai tanpa izin ini.', 'warn', 6000);
      return;
    }
    startExam('campuran', picked.map((q) => q.id));
    router.navigate('/ujian/soal/1');
  });

  return { el };
}
