/** Layar Hasil Ujian (route: `/ujian/hasil`, komponen: ScoreCard, AssertionBreakdown). */

import { EXAM } from '../config.js';
import { esc, stamp } from '../util.js';
import { screen, footer } from '../ui.js';
import { getExam, clearExam, lockoutCycles } from '../state.js';
import { getQuestion } from '../content.js';

const BANK_LABEL = { html: 'HTML', css: 'CSS', campuran: 'HTML + CSS' };

export default async function ujianHasilView(_params, { router }) {
  const exam = getExam();
  if (!exam || !exam.finished) { router.navigate('/dashboard', true); return { el: document.createElement('div') }; }

  const questions = await Promise.all(exam.questionIds.map((id) => getQuestion(id)));
  const durasiMenit = Math.round((exam.finishedAt - exam.startedAt) / 60000);
  const low = exam.finalScore < 75;

  /**
   * Soal dengan skor terendah yang masih punya bab materi — tombol "pelajari
   * ulang" mengarah ke sana, bukan ke bab pertama secara asal.
   */
  const weakest = questions
    .filter((q) => q?.chapterId && q.chapterModul)
    .sort((a, b) => (exam.scores[a.id]?.score ?? 0) - (exam.scores[b.id]?.score ?? 0))[0];
  const weakestHref = weakest
    ? `#/materi/${weakest.chapterModul}/${weakest.chapterId.split('-')[1]}`
    : '#/dashboard';

  const detail = questions.map((q, i) => {
    const entry = exam.scores[q?.id];
    const score = entry?.score ?? 0;
    const results = entry?.result?.results || [];
    return `
      <article class="qresult">
        <header class="qresult-head">
          <div class="row" style="gap:12px;flex-wrap:wrap">
            <span class="n${score === 100 ? ' full' : ''}">${i + 1}</span>
            <span class="title">${esc(q?.topik || 'Soal tidak ditemukan')}</span>
            <span class="pill pill-plain">${esc(BANK_LABEL[q?._bank] || '—')}</span>
            <span class="qid">${esc(q?.id || exam.questionIds[i])}</span>
          </div>
          <span class="score${score < 100 ? ' low' : ''}">${score}</span>
        </header>
        <div class="qresult-body">
          ${results.length
            ? results.map((r) => `
                <div${r.ok ? '' : ' class="assert-miss"'}>
                  ${r.ok ? '✓' : '✕'} ${esc(r.label)} · ${r.earned}/${r.poin}
                </div>`).join('')
            : '<div class="assert-miss">✕ tidak disubmit · 0 poin</div>'}
        </div>
      </article>`;
  }).join('');

  const el = screen({
    top: `<header class="topbar">
            <span class="brand-name">WebTM · HASIL UJIAN</span>
            <span class="crumbs">terkirim ke sheet “Ujian” · ${esc(stamp(new Date(exam.finishedAt)))}</span>
          </header>`,
    body: `
      <div class="wrap result-layout">
        <div>
          <div class="score-card${low ? ' low' : ''}">
            <div class="kicker ${low ? '' : 'kicker-sage'}" style="margin-bottom:14px">NILAI AKHIR UJIAN</div>
            <div class="big">${exam.finalScore}</div>
            <div class="sub">dari 100 · rata-rata ${exam.questionIds.length} soal</div>
            <div class="rule"></div>
            <div class="score-meta">
              <div><span>Durasi pengerjaan</span><span>${durasiMenit} menit</span></div>
              <div><span>Jumlah submit</span><span>${exam.submitCount} kali</span></div>
              <div><span>Pelanggaran</span><span>${exam.violations.length} dari maks. ${EXAM.maxViolations}</span></div>
              <div><span>Status blokir</span><span>${lockoutCycles() ? `${lockoutCycles()} siklus tercatat` : 'tidak ada'}</span></div>
              <div><span>Cara selesai</span><span>${exam.finishReason === 'timeout' ? 'auto-submit' : 'submit manual'}</span></div>
            </div>
          </div>
          <div class="dashed" style="margin-top:18px;border-radius:20px">
            Nilai ini dihitung otomatis dari assertion checklist tiap soal, bukan penilaian
            subjektif. Guru dapat melihat kode Anda di Google Sheets.
          </div>
        </div>

        <div>
          <h2>Rincian penilaian per soal</h2>
          <p class="muted" style="margin-bottom:22px">
            Setiap kriteria punya bobot poin sendiri. Kriteria yang belum terpenuhi ditandai
            dan bisa Anda pelajari lagi lewat materi terkait.
          </p>
          <div class="stack" style="gap:14px">${detail}</div>

          <div class="row" style="gap:12px;margin-top:26px;flex-wrap:wrap">
            <button class="btn btn-primary" type="button" data-act="dasbor">Kembali ke Dasbor</button>
            <a class="btn btn-white" href="${esc(weakestHref)}">
              ${weakest ? `Pelajari ulang: ${esc(weakest.topik)}` : 'Ulangi materi'}
            </a>
            <span class="small muted">Kode jawaban Anda sudah tersimpan; tidak bisa diubah lagi.</span>
          </div>
        </div>
      </div>`,
    foot: footer('route: /ujian/hasil  ·  komponen: ScoreCard, AssertionBreakdown')
  });

  el.querySelector('[data-act="dasbor"]').addEventListener('click', () => {
    clearExam();
    router.navigate('/dashboard');
  });

  return { el };
}
