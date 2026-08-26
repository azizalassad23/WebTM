/** Layar 6 & 6b — Ujian split-screen (route: `/ujian/soal/:n`, komponen: ExamHeader, ViolationDots, SplitEditor). */

import { EXAM } from '../config.js';
import { esc, clock, toast, debounce } from '../util.js';
import { screen, footer, narrowNotice, openModal, violationDots, violationLog } from '../ui.js';
import {
  getExam, setExam, examSecondsLeft, getStudent, getLockout
} from '../state.js';
import { getQuestion } from '../content.js';
import { grade } from '../grader.js';
import { summarizeViolations } from '../anticheat.js';
import { submitRow } from '../submit.js';
import { workbenchHTML, mountWorkbench, resultPanelHTML } from '../workbench.js';

const blank = () => ({ el: document.createElement('div') });

/** Rata-rata skor seluruh soal; soal yang tidak sempat disubmit bernilai 0. */
export function finalScore(exam) {
  const total = exam.questionIds.reduce((sum, id) => sum + (exam.scores[id]?.score ?? 0), 0);
  return Math.round(total / exam.questionIds.length);
}

/** Menutup sesi, mengirim ringkasan ke sheet "Ujian", lalu pindah ke layar hasil. */
export async function finishExam(reason = 'manual') {
  const exam = getExam();
  if (!exam || exam.finished) return exam;

  exam.finished = true;
  exam.finishedAt = Date.now();
  exam.finishReason = reason;
  exam.finalScore = finalScore(exam);
  setExam(exam);

  const student = getStudent();
  await submitRow('Ujian', {
    nama: student?.nama || '',
    kelas: student?.kelas || '',
    mode: 'Ujian',
    modul: exam.modul.toUpperCase(),
    idSoal: 'RINGKASAN',
    sesi: exam.id,
    daftarSoal: exam.questionIds.join(', '),
    skor: exam.finalScore,
    rincianSkor: exam.questionIds.map((id) => `${id}=${exam.scores[id]?.score ?? 0}`).join(' | '),
    jumlahSubmit: exam.submitCount,
    waktuMulai: new Date(exam.startedAt).toISOString(),
    waktuSubmit: new Date(exam.finishedAt).toISOString(),
    durasiDetik: Math.round((exam.finishedAt - exam.startedAt) / 1000),
    jumlahPelanggaran: exam.violations.length,
    detailPelanggaran: summarizeViolations(exam.violations),
    statusBlokir: 'tidak ada',
    alasanSelesai: reason === 'timeout' ? 'auto-submit waktu habis' : 'submit manual'
  });

  return exam;
}

export default async function ujianSoalView({ n }, { router, examRuntime }) {
  if (getLockout()) { router.navigate('/ujian/terblokir', true); return blank(); }

  let exam = getExam();
  if (!exam) { router.navigate('/ujian/mulai', true); return blank(); }
  if (exam.finished) { router.navigate('/ujian/hasil', true); return blank(); }

  if (examSecondsLeft(exam) <= 0) {
    await finishExam('timeout');
    router.navigate('/ujian/hasil', true);
    return blank();
  }

  // Sequential, tanpa navigasi mundur (§8.3). Nomor apa pun selain soal berjalan
  // dikembalikan ke soal yang sedang dikerjakan.
  const index = Number(n) - 1;
  if (!Number.isInteger(index) || index !== exam.current) {
    router.navigate(`/ujian/soal/${exam.current + 1}`, true);
    return blank();
  }

  const questionId = exam.questionIds[index];
  const question = await getQuestion(questionId);
  if (!question) {
    return { el: screen({ body: `<div class="loading">Soal ${esc(questionId)} tidak ada di bank soal.</div>`, foot: footer('route: /ujian/soal') }) };
  }

  const student = getStudent();
  const isLast = index === exam.questionIds.length - 1;
  const saved = exam.scores[questionId] || null;

  const el = screen({
    className: 'needs-wide',
    top: `
      <div class="banner hidden" data-warn-banner>
        <span data-warn-text>◤ WAKTU HAMPIR HABIS — SISTEM AKAN AUTO-SUBMIT</span>
        <span class="banner-note">jawaban tersimpan otomatis</span>
      </div>
      <header class="topbar" style="padding:12px 24px">
        <div class="row" style="gap:14px">
          <span class="mode-badge mode-badge-exam">● UJIAN BERLANGSUNG</span>
          <span class="crumbs">${esc(student?.nama || '')} · ${esc(student?.kelas || '')} · sesi ${esc(exam.id)}</span>
        </div>
        <div class="row" style="gap:12px">
          <span class="row" style="gap:7px;font:400 11px var(--font-mono);color:var(--s200)"
                data-fs-indicator><i class="dot dot-ok"></i>layar penuh aktif</span>
          <div class="violation-dots" data-dots
               aria-label="Pelanggaran ${exam.violations.length} dari ${EXAM.maxViolations}">
            <span class="label">PELANGGARAN</span>
            ${violationDots(exam.violations.length, EXAM.maxViolations)}
          </div>
          <div class="timer-card" data-timer>
            <div class="t">--:--</div>
            <div class="l">SISA WAKTU</div>
          </div>
        </div>
      </header>
      <div class="exam-strip">
        <div class="exam-progress">
          <span class="label">SOAL ${index + 1} / ${exam.questionIds.length}</span>
          ${exam.questionIds.map((id, i) => `
            <i class="${i < index ? 'done' : (i === index ? 'current' : '')}"></i>`).join('')}
        </div>
        <span class="note">soal selesai tidak dapat dibuka kembali</span>
      </div>`,
    body: `
      ${narrowNotice('Halaman ujian')}
      <div class="wide-only" style="display:flex;flex-direction:column;flex:1">
        <div class="task-head">
          <div class="task-id dark">
            <div class="t">ID SOAL</div>
            <div class="v">${esc(question.id)}</div>
          </div>
          <div class="grow">
            <div class="kicker" style="margin-bottom:7px">
              SOAL ${index + 1} · ${esc(question.topik.toUpperCase())} · ${question.total_poin || 100} POIN
            </div>
            <div class="task-instruction">${question.instruksi}</div>
          </div>
          <div class="task-aside panel pad-sm">
            <div class="kicker kicker-dim" style="margin-bottom:6px">KRITERIA DINILAI</div>
            <div class="small" style="color:var(--n800)">
              ${(question.assertions || []).length} assertion terukur; skor muncul segera setelah submit.
            </div>
          </div>
        </div>

        <div class="work-area">
          ${workbenchHTML(question, {
            editorNote: 'clipboard diblokir · klik kanan diblokir',
            previewNote: 'tersimpan otomatis di sessionStorage'
          })}
        </div>

        <div class="action-bar">
          <div class="small muted" style="max-width:44ch">
            Keluar dari halaman ini akan dicatat sebagai pelanggaran. Gunakan tombol di kanan untuk melanjutkan.
          </div>
          <div class="group">
            <button class="btn btn-white" type="button" data-act="run">▶ Run</button>
            <button class="btn btn-primary" type="button" data-act="submit">Submit Soal ${index + 1}</button>
            <button class="btn" type="button" data-act="lanjut" ${saved ? '' : 'disabled'}>
              ${isLast ? 'Selesaikan Ujian →' : `Lanjut ke Soal ${index + 2} →`}
            </button>
          </div>
        </div>
      </div>`,
    foot: footer(`route: /ujian/soal/${index + 1}  ·  komponen: ExamHeader, ViolationDots, SplitEditor`)
  });

  /* ------------------------------------------------------------ workbench */

  const workArea = el.querySelector('.work-area');
  const bench = mountWorkbench(workArea, question, {
    initial: exam.answers[questionId] || undefined,
    onChange: debounce((code) => {
      const live = getExam();
      if (!live || live.finished) return;
      live.answers[questionId] = code;
      setExam(live);
    }, 700)
  });

  const resultMount = bench.resultMount;
  if (saved) {
    resultMount.innerHTML = resultPanelHTML(saved.result, { heading: `Skor soal ${index + 1}` });
  } else {
    resultMount.innerHTML = `
      <div class="note-strip">
        <span class="mark" aria-hidden="true">!</span>
        <p>Skor soal ini belum dihitung. Selama waktu masih tersisa, Anda boleh submit ulang untuk memperbaiki jawaban.</p>
      </div>`;
  }

  /* ---------------------------------------------------------------- timer */

  const timerCard = el.querySelector('[data-timer]');
  const timerValue = timerCard.querySelector('.t');
  const banner = el.querySelector('[data-warn-banner]');
  let finishing = false;

  function tickTimer() {
    const left = examSecondsLeft();
    timerValue.textContent = clock(left);

    const warn = left <= EXAM.warnAtMinutes * 60;
    banner.classList.toggle('hidden', !warn);
    timerCard.classList.toggle('warn', warn);
    timerCard.classList.toggle('blink', left <= EXAM.blinkAtMinutes * 60);

    if (left <= 0 && !finishing) {
      finishing = true;
      clearInterval(timer);
      autoSubmit();
    }
  }

  async function autoSubmit() {
    toast('Waktu habis — jawaban terakhir dikirim otomatis.', 'warn', 6000);
    try { await gradeAndStore({ silent: true }); } catch { /* skor 0 bila gagal */ }
    await finishExam('timeout');
    await examRuntime.stop();
    router.navigate('/ujian/hasil');
  }

  const timer = setInterval(tickTimer, 1000);
  tickTimer();

  /* ----------------------------------------------------------- anti-cheat */

  const dots = el.querySelector('[data-dots]');
  const fsIndicator = el.querySelector('[data-fs-indicator]');
  let openWarning = null;

  const unsubscribe = examRuntime.subscribe((event, payload) => {
    if (event === 'violation') {
      const { count } = payload;
      dots.innerHTML = `<span class="label">PELANGGARAN</span>${violationDots(count, EXAM.maxViolations)}`;
      dots.setAttribute('aria-label', `Pelanggaran ${count} dari ${EXAM.maxViolations}`);
      if (count <= EXAM.maxViolations) showWarning(payload.violation, count);
    }

    if (event === 'fullscreen') {
      fsIndicator.innerHTML = payload.active
        ? '<i class="dot dot-ok"></i>layar penuh aktif'
        : '<i class="dot dot-warn"></i>layar penuh nonaktif';
    }

    if (event === 'lockout') {
      clearInterval(timer);
      openWarning?.close();
      router.navigate('/ujian/terblokir');
    }
  });

  function showWarning(violation, count) {
    openWarning?.close();
    const last = count === EXAM.maxViolations;
    openWarning = openModal(`
      <div class="modal" role="alertdialog" aria-labelledby="ac-title">
        <div class="modal-head">
          <span class="t">PERINGATAN ANTI-CHEAT</span>
          <div class="modal-dots">${violationDots(count, EXAM.maxViolations + 1)}</div>
        </div>
        <div class="modal-body">
          <div class="modal-icon" aria-hidden="true">!</div>
          <div class="kicker" style="margin-bottom:10px">
            PELANGGARAN KE-${count} DARI MAKSIMAL ${EXAM.maxViolations}
          </div>
          <h3 id="ac-title">${last ? 'Ini peringatan terakhir Anda' : 'Pelanggaran tercatat'}</h3>
          <p class="lead">
            Sistem mendeteksi: <strong>${esc(violation.label)}</strong>.
            ${last
              ? `Satu pelanggaran lagi akan memblokir sesi ini: jawaban dikosongkan dan Anda
                 harus menunggu ${EXAM.lockoutMinutes} menit sebelum bisa memulai ulang.`
              : 'Sesi berlanjut normal, tetapi kejadian ini ikut terkirim ke rekap guru.'}
          </p>
          <div class="log-box">
            <div class="t">CATATAN PELANGGARAN — TERKIRIM KE GURU</div>
            ${violationLog(examRuntime.violations)}
          </div>
          <button class="btn btn-primary btn-lg" type="button" data-act="paham">
            Saya mengerti, lanjutkan ujian
          </button>
          <div class="small mono muted" style="margin-top:14px">
            timer tetap berjalan · ${clock(examSecondsLeft())} tersisa
          </div>
        </div>
      </div>`, { onClose: () => { openWarning = null; } });

    openWarning.el.querySelector('[data-act="paham"]').addEventListener('click', async () => {
      openWarning?.close();
      // Keluar dari layar penuh adalah pelanggaran; ajak siswa kembali ke sana.
      if (!document.fullscreenElement) await examRuntime.requestFullscreen();
    });
  }

  /* --------------------------------------------------------------- submit */

  const submitBtn = el.querySelector('[data-act="submit"]');
  const nextBtn = el.querySelector('[data-act="lanjut"]');

  async function gradeAndStore({ silent = false } = {}) {
    const code = bench.getCode();
    const result = await grade(question, code);

    const live = getExam();
    if (!live) return result;
    live.answers[questionId] = code;
    live.scores[questionId] = { score: result.score, result, submittedAt: Date.now() };
    live.submitCount += 1;
    setExam(live);
    exam = live;

    resultMount.innerHTML = resultPanelHTML(result, { heading: `Skor soal ${index + 1}` });
    nextBtn.disabled = false;

    if (!silent) {
      toast(`Soal ${index + 1}: ${result.score}/100 tersimpan. Boleh submit ulang selama waktu tersisa.`,
        result.score === 100 ? 'ok' : '');
    }

    await submitRow('Ujian', {
      nama: student?.nama || '',
      kelas: student?.kelas || '',
      mode: 'Ujian',
      modul: question.modul,
      idSoal: question.id,
      sesi: live.id,
      nomorSoal: `${index + 1}/${live.questionIds.length}`,
      kodeHtml: code.html || '',
      kodeCss: code.css || '',
      skor: result.score,
      waktuMulai: new Date(live.startedAt).toISOString(),
      waktuSubmit: new Date().toISOString(),
      durasiDetik: Math.round((Date.now() - live.startedAt) / 1000),
      jumlahPelanggaran: live.violations.length,
      detailPelanggaran: summarizeViolations(live.violations)
    });

    return result;
  }

  el.querySelector('[data-act="run"]').addEventListener('click', () => bench.run());

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Menilai…';
    try {
      await gradeAndStore();
    } catch (err) {
      console.error(err);
      toast(`Penilaian gagal: ${err.message}`, 'warn', 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });

  nextBtn.addEventListener('click', async () => {
    const live = getExam();
    if (!live) return;
    if (isLast) {
      clearInterval(timer);
      await finishExam('manual');
      await examRuntime.stop();
      router.navigate('/ujian/hasil');
      return;
    }
    live.current = index + 1;
    setExam(live);
    router.navigate(`/ujian/soal/${index + 2}`);
  });

  return {
    el,
    destroy() {
      clearInterval(timer);
      unsubscribe();
      openWarning?.close();
      bench.destroy();
    }
  };
}

