/** Layar 2 — Dashboard Modul (route: `/dashboard`, komponen: ModuleCard, ExamBanner). */

import { esc } from '../util.js';
import { screen, brand, footer, identityChip } from '../ui.js';
import { getStudent, clearStudent, modulePercent, getProgress } from '../state.js';
import { getMateri, getBank } from '../content.js';

function moduleCard({ key, no, nama, deskripsi, total, done, percent, headClass, barClass, nextNo, firstSoal }) {
  return `
    <article class="module-card">
      <header class="module-card-head ${headClass}">
        <span class="m-no">MODUL ${no}</span>
        <span class="pill pill-plain" style="background:${key === 'html' ? '#ffc6a5' : '#e1eecc'}">
          ${done} / ${total} topik
        </span>
      </header>
      <div class="module-card-body">
        <h3>${esc(nama)}</h3>
        <p>${esc(deskripsi)}</p>
        <div class="bar ${barClass}"><i style="width:${percent}%"></i></div>
        <div class="levels"><span>DASAR · MENENGAH · LANJUTAN</span><span>${percent}%</span></div>
        <div class="module-actions">
          <a class="btn ${key === 'html' ? 'btn-primary' : 'btn-sage'} btn-sm"
             href="#/materi/${key}/${nextNo}">
            ${done > 0 ? 'Lanjutkan' : 'Mulai'}
          </a>
          ${firstSoal ? `<a class="btn btn-quiet btn-sm" href="#/latihan/${firstSoal}">Latihan</a>` : ''}
        </div>
      </div>
    </article>`;
}

export default async function dashboardView(_params, { router }) {
  const student = getStudent();
  const [html, css, bankHtml, bankCss] = await Promise.all([
    getMateri('html'), getMateri('css'), getBank('html'), getBank('css')
  ]);
  const progress = getProgress();

  const htmlPct = modulePercent('html', html.chapters.length);
  const cssPct = modulePercent('css', css.chapters.length);
  const overall = Math.round((htmlPct + cssPct) / 2);
  const capstoneOpen = htmlPct === 100 && cssPct === 100;

  /** Bab pertama yang belum ditandai selesai — tujuan tombol "Lanjutkan". */
  const nextChapterNo = (materi, key) => {
    const done = progress[key];
    const next = materi.chapters.find((c) => !done.includes(c.id));
    return (next || materi.chapters[0]).no;
  };

  const el = screen({
    top: `<header class="topbar">
            ${brand('')}
            <div class="row" style="gap:10px">
              ${identityChip(student)}
              <button class="chip-dark" type="button" data-act="keluar" title="Keluar dari sesi"
                      aria-label="Keluar dari sesi">↪</button>
            </div>
          </header>`,
    body: `
      <div class="wrap dash">
        <div class="dash-head">
          <div>
            <div class="kicker" style="margin-bottom:10px">DASBOR SISWA</div>
            <h2>Pilih modul yang ingin dikerjakan</h2>
          </div>
          <div class="dash-total">
            <div class="kicker kicker-sage">PROGRES KESELURUHAN</div>
            <div class="n">${overall}%</div>
          </div>
        </div>

        <div class="module-grid">
          ${moduleCard({
            key: 'html', no: '01', nama: html.nama, deskripsi: html.deskripsi,
            total: html.chapters.length, done: progress.html.length, percent: htmlPct,
            headClass: 'head-html', barClass: '',
            nextNo: nextChapterNo(html, 'html'), firstSoal: bankHtml[0]?.id
          })}
          ${moduleCard({
            key: 'css', no: '02', nama: css.nama, deskripsi: css.deskripsi,
            total: css.chapters.length, done: progress.css.length, percent: cssPct,
            headClass: 'head-css', barClass: 'bar-sage',
            nextNo: nextChapterNo(css, 'css'), firstSoal: bankCss[0]?.id
          })}

          <article class="module-card ${capstoneOpen ? '' : 'locked'}">
            <header class="module-card-head head-capstone">
              <span class="m-no">PROYEK AKHIR</span>
              <span class="pill pill-plain pill-ink">${capstoneOpen ? 'Terbuka' : 'Terkunci'}</span>
            </header>
            <div class="module-card-body">
              <h3>Capstone: CV Pribadi</h3>
              <p>Bangun halaman CV dengan HTML + CSS, deploy ke GitHub Pages, lalu kumpulkan tautannya.</p>
              ${capstoneOpen
                ? `<div class="dashed" style="margin-bottom:20px">
                     Kedua modul sudah 100%. Formulir pengumpulan sudah terbuka.
                   </div>
                   <div class="module-actions">
                     <a class="btn btn-sage btn-sm" href="#/capstone">Buka Capstone</a>
                   </div>`
                : `<div class="dashed" style="margin-bottom:20px">
                     Terbuka setelah kedua modul selesai 100%.
                   </div>
                   <span class="btn btn-sm" aria-disabled="true">Belum tersedia</span>`}
            </div>
          </article>
        </div>

        <section class="exam-banner">
          <div class="row" style="gap:20px">
            <div class="exam-banner-icon" aria-hidden="true">⏱</div>
            <div>
              <div class="kicker" style="margin-bottom:5px">UJIAN TERJADWAL</div>
              <h4>Ujian HTML &amp; CSS — 5 set soal</h4>
              <div class="small muted" style="color:var(--n800)">
                90 menit · 2 soal HTML · 2 soal CSS · 1 soal gabungan · diacak per siswa · anti-cheat aktif penuh
              </div>
            </div>
          </div>
          <a class="btn btn-ink btn-lg nowrap" href="#/ujian/mulai">Masuk Ruang Ujian</a>
        </section>
      </div>`,
    foot: footer('route: /dashboard  ·  komponen: ModuleCard, ExamBanner')
  });

  el.querySelector('[data-act="keluar"]').addEventListener('click', () => {
    clearStudent();
    router.navigate('/');
  });

  return { el };
}
