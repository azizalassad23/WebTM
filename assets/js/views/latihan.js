/** Layar 4 — Latihan split-screen (route: `/latihan/:soalId`, komponen: SplitEditor, AssertionResult). */

import { esc, toast } from '../util.js';
import { screen, brand, footer, narrowNotice } from '../ui.js';
import { getStudent, getPracticeRecord, savePracticeRecord } from '../state.js';
import { getQuestion, practiceSet } from '../content.js';
import { grade } from '../grader.js';
import { createAntiCheat, summarizeViolations } from '../anticheat.js';
import { submitRow } from '../submit.js';
import { workbenchHTML, mountWorkbench, resultPanelHTML } from '../workbench.js';

export default async function latihanView({ soalId }, { router }) {
  const question = await getQuestion(soalId);
  if (!question) {
    return { el: screen({ body: '<div class="loading">Soal tidak ditemukan.</div>', foot: footer('route: /latihan') }) };
  }

  const student = getStudent();
  const record = getPracticeRecord(question.id);
  const attempt = record.attempts + 1;
  const startedAt = Date.now();
  const criteria = (question.assertions || []).length;
  const totalPoin = question.total_poin || 100;

  // Satu bab berisi beberapa soal latihan; tampilkan seluruh rangkaiannya
  // supaya siswa tahu ada berapa dan sudah mengerjakan yang mana.
  const { set, index, modul } = await practiceSet(question);
  const prev = set[index - 1] || null;
  const next = set[index + 1] || null;
  const chapterNo = (question.chapterId || '').split('-')[1] || '01';

  const setStrip = set.map((q, i) => {
    const done = getPracticeRecord(q.id);
    const state = i === index ? 'current' : (done.lastScore === 100 ? 'done' : (done.attempts ? 'tried' : ''));
    const title = done.attempts
      ? `Soal ${i + 1} — skor terakhir ${done.lastScore}/100`
      : `Soal ${i + 1} — belum dikerjakan`;
    return `<a class="set-chip ${state}" href="#/latihan/${esc(q.id)}" title="${esc(title)}"
               ${i === index ? 'aria-current="step"' : ''}>${i + 1}</a>`;
  }).join('');

  const el = screen({
    className: 'needs-wide',
    top: `<header class="topbar" style="padding:13px 24px">
            <div class="row" style="gap:14px">
              ${brand('')}
              <span class="mode-badge">MODE LATIHAN · UNLIMITED ATTEMPT</span>
            </div>
            <div class="row" style="gap:10px">
              <span class="chip-dark" data-ac-status><i class="dot dot-ok"></i>anti-cheat aktif · 0 pelanggaran</span>
              <span class="chip-dark">${esc(student?.nama || '')} · ${esc(student?.kelas || '')}</span>
            </div>
          </header>`,
    body: `
      ${narrowNotice('Halaman latihan')}
      <div class="wide-only" style="display:flex;flex-direction:column;flex:1">
        <div class="set-strip">
          <span class="label">LATIHAN BAB ${esc(chapterNo)} · SOAL ${index + 1} DARI ${set.length}</span>
          <nav class="set-chips" aria-label="Daftar soal latihan bab ini">${setStrip}</nav>
          <span class="note">skor tiap soal tersimpan di perangkat ini</span>
        </div>

        <div class="task-head">
          <div class="task-id">
            <div class="t">ID SOAL</div>
            <div class="v">${esc(question.id)}</div>
          </div>
          <div class="grow">
            <div class="kicker" style="margin-bottom:7px">
              INSTRUKSI SOAL · ${esc(question.level.toUpperCase())} · ${esc(question.topik.toUpperCase())}
            </div>
            <div class="task-instruction">${question.instruksi}</div>
            <div class="task-tags">
              <span class="pill pill-sage">${criteria} KRITERIA PENILAIAN</span>
              <span class="pill">TOTAL ${totalPoin} POIN</span>
              <span class="pill" data-attempt>PERCOBAAN KE-${attempt}</span>
            </div>
          </div>
          <div class="task-aside dashed">
            Copy-paste, klik kanan, dan DevTools dinonaktifkan di halaman ini — ketik kodenya sendiri, ya.
          </div>
        </div>

        <div class="work-area">
          ${workbenchHTML(question, { editorNote: 'auto-indent · nomor baris' })}
        </div>

        <div class="action-bar">
          <div class="group">
            <a class="btn btn-quiet btn-sm" href="#/materi/${esc(modul)}/${esc(chapterNo)}">← Materi</a>
            ${prev
              ? `<a class="btn btn-quiet btn-sm" href="#/latihan/${esc(prev.id)}">← Soal ${index}</a>`
              : ''}
            <button class="btn btn-white btn-sm" type="button" data-act="reset">Reset kode</button>
          </div>
          <div class="group">
            <span class="small muted" style="max-width:26ch;text-align:right">Setiap submit terkirim ke sheet “Latihan”.</span>
            <button class="btn btn-white" type="button" data-act="run">▶ Run</button>
            <button class="btn btn-primary" type="button" data-act="submit">Submit Jawaban</button>
            ${next
              ? `<a class="btn btn-soft" href="#/latihan/${esc(next.id)}">Soal ${index + 2} →</a>`
              : `<a class="btn btn-soft" href="#/materi/${esc(modul)}/${esc(chapterNo)}">Selesai, kembali ke materi →</a>`}
          </div>
        </div>
      </div>`,
    foot: footer(`route: /latihan/${question.id}  ·  komponen: SplitEditor, AssertionResult`)
  });

  const workArea = el.querySelector('.work-area');
  const bench = mountWorkbench(workArea, question, {
    initial: record.lastCode || undefined
  });

  /* --------------------------------------------------------- anti-cheat */

  const acStatus = el.querySelector('[data-ac-status]');
  // Anti-cheat aktif juga di Latihan (§8.5), tetapi tanpa konsekuensi blokir:
  // percobaan latihan memang tidak dibatasi (§8.2). Pelanggaran tetap dicatat
  // dan ikut terkirim ke sheet "Latihan".
  const antiCheat = createAntiCheat({
    mode: 'latihan',
    onViolation(v, count) {
      acStatus.innerHTML =
        `<i class="dot dot-warn"></i>anti-cheat aktif · ${count} pelanggaran`;
      toast(`Tercatat: ${v.label}.`, 'warn');
    }
  });
  antiCheat.start();

  /* ------------------------------------------------------------ submit */

  const resultMount = bench.resultMount;
  if (record.lastResult) {
    resultMount.innerHTML = resultPanelHTML(record.lastResult, { heading: 'Hasil terakhir' });
  }

  const submitBtn = el.querySelector('[data-act="submit"]');
  let attempts = record.attempts;

  el.querySelector('[data-act="run"]').addEventListener('click', () => bench.run());
  el.querySelector('[data-act="reset"]').addEventListener('click', () => {
    bench.reset();
    toast('Kode dikembalikan ke bentuk awal.');
  });

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menilai…';
    const code = bench.run();

    try {
      const result = await grade(question, code);
      attempts += 1;

      resultMount.innerHTML = resultPanelHTML(result, { heading: 'Hasil terakhir' });
      el.querySelector('[data-attempt]').textContent = `PERCOBAAN KE-${attempts + 1}`;

      savePracticeRecord(question.id, {
        attempts,
        lastScore: result.score,
        lastCode: code,
        lastResult: result
      });

      toast(`Skor ${result.score}/100 — ${result.results.filter((r) => r.ok).length} dari ${result.results.length} kriteria terpenuhi.`,
        result.score === 100 ? 'ok' : '');

      const outcome = await submitRow('Latihan', {
        nama: student?.nama || '',
        kelas: student?.kelas || '',
        mode: 'Latihan',
        modul: question.modul,
        idSoal: question.id,
        percobaan: attempts,
        kodeHtml: code.html || '',
        kodeCss: code.css || '',
        skor: result.score,
        waktuMulai: new Date(startedAt).toISOString(),
        waktuSubmit: new Date().toISOString(),
        durasiDetik: Math.round((Date.now() - startedAt) / 1000),
        jumlahPelanggaran: antiCheat.count,
        detailPelanggaran: summarizeViolations(antiCheat.violations)
      });

      if (!outcome.ok) {
        toast(outcome.queued
          ? 'Skor tersimpan di perangkat, tapi belum terkirim ke guru. Akan dicoba lagi otomatis.'
          : `Pengiriman gagal: ${outcome.error}`, 'warn', 6000);
      } else if (!outcome.confirmed) {
        toast('Terkirim, namun konfirmasi dari server tidak dapat dibaca (batasan CORS).', '', 5000);
      }
    } catch (err) {
      console.error(err);
      toast(`Penilaian gagal: ${err.message}`, 'warn', 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Jawaban';
    }
  });

  return {
    el,
    destroy() { antiCheat.stop(); bench.destroy(); }
  };
}
