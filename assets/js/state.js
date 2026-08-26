/**
 * WebTM — state klien.
 *
 * Tidak ada backend, jadi seluruh state hidup di browser:
 *   - identitas siswa  → sessionStorage (§8.7 PRD: hanya selama sesi)
 *   - progres materi   → localStorage   (§8.1 PRD: tidak dikirim ke Sheet)
 *   - sesi ujian aktif → sessionStorage (§12 PRD)
 *   - masa blokir      → localStorage   (harus bertahan walau tab ditutup)
 */

import { local, session, uid } from './util.js';
import { EXAM } from './config.js';

const K = {
  student: 'webtm.student',
  progress: 'webtm.progress',
  exam: 'webtm.exam',
  lockout: 'webtm.lockout',
  practice: 'webtm.practice',
  capstone: 'webtm.capstone',
  outbox: 'webtm.outbox'
};

/* ------------------------------------------------------------------ student */

export function getStudent() {
  return session.get(K.student, null);
}

export function setStudent(nama, kelas) {
  const student = { nama: nama.trim(), kelas: kelas.trim(), sesi: uid('#') };
  session.set(K.student, student);
  return student;
}

export function clearStudent() {
  session.remove(K.student);
  session.remove(K.exam);
}

/* ----------------------------------------------------------------- progress */

function emptyProgress() {
  return { html: [], css: [], capstoneSubmitted: false };
}

export function getProgress() {
  const p = local.get(K.progress, null);
  if (!p || typeof p !== 'object') return emptyProgress();
  return { ...emptyProgress(), ...p, html: p.html || [], css: p.css || [] };
}

/** Tandai satu bab selesai. Idempoten. */
export function markChapterDone(modul, chapterId) {
  const p = getProgress();
  const list = p[modul] || [];
  if (!list.includes(chapterId)) {
    list.push(chapterId);
    p[modul] = list;
    local.set(K.progress, p);
  }
  return p;
}

export function chapterDone(modul, chapterId) {
  return getProgress()[modul]?.includes(chapterId) ?? false;
}

export function modulePercent(modul, totalChapters) {
  if (!totalChapters) return 0;
  const done = getProgress()[modul]?.length ?? 0;
  return Math.round((Math.min(done, totalChapters) / totalChapters) * 100);
}

export function setCapstoneSubmitted(value) {
  const p = getProgress();
  p.capstoneSubmitted = !!value;
  local.set(K.progress, p);
}

export function resetProgress() {
  local.remove(K.progress);
  local.remove(K.practice);
}

/* ----------------------------------------------------------- latihan (skor) */

/** Skor latihan terakhir + jumlah percobaan, per id soal. */
export function getPracticeRecord(questionId) {
  const all = local.get(K.practice, {});
  return all[questionId] || { attempts: 0, lastScore: null, lastCode: null };
}

export function savePracticeRecord(questionId, patch) {
  const all = local.get(K.practice, {});
  all[questionId] = { ...getPracticeRecord(questionId), ...patch };
  local.set(K.practice, all);
  return all[questionId];
}

/* -------------------------------------------------------------- sesi ujian */

/**
 * Bentuk sesi ujian:
 * {
 *   id, modul, startedAt, endsAt, questionIds: [],
 *   current: 0, answers: { [qid]: {html, css} },
 *   scores: { [qid]: {score, results, submittedAt} },
 *   submitCount, violations: [{type, label, at}], finished: bool
 * }
 */
export function getExam() {
  return session.get(K.exam, null);
}

export function setExam(exam) {
  session.set(K.exam, exam);
  return exam;
}

export function clearExam() {
  session.remove(K.exam);
}

export function startExam(modul, questionIds) {
  const now = Date.now();
  const exam = {
    id: uid('#'),
    modul,
    startedAt: now,
    endsAt: now + EXAM.durationMinutes * 60_000,
    questionIds,
    current: 0,
    answers: {},
    scores: {},
    submitCount: 0,
    violations: [],
    finished: false
  };
  return setExam(exam);
}

export function examSecondsLeft(exam = getExam()) {
  if (!exam) return 0;
  return Math.max(0, Math.round((exam.endsAt - Date.now()) / 1000));
}

/* ------------------------------------------------------------------ lockout */

export function getLockout() {
  const l = local.get(K.lockout, null);
  if (!l) return null;
  if (Date.now() >= l.until) { local.remove(K.lockout); return null; }
  return l;
}

export function lockoutSecondsLeft() {
  const l = getLockout();
  return l ? Math.max(0, Math.round((l.until - Date.now()) / 1000)) : 0;
}

/**
 * Blokir sesi (§8.5 PRD): progres jawaban dikosongkan, siswa menunggu 60 menit,
 * dan jumlah siklus blokir dicatat agar guru bisa melihat pola.
 */
export function applyLockout(violations) {
  const previous = local.get('webtm.lockoutCycles', 0);
  const cycles = previous + 1;
  local.set('webtm.lockoutCycles', cycles);
  const record = {
    startedAt: Date.now(),
    until: Date.now() + EXAM.lockoutMinutes * 60_000,
    violations: violations || [],
    cycle: cycles
  };
  local.set(K.lockout, record);
  clearExam();
  return record;
}

export function lockoutCycles() {
  return local.get('webtm.lockoutCycles', 0);
}

/* ----------------------------------------------------------------- capstone */

export function getCapstone() {
  return local.get(K.capstone, null);
}

export function setCapstone(record) {
  local.set(K.capstone, record);
}

/* ------------------------------------------------------- antrean pengiriman */

export function outbox() {
  return local.get(K.outbox, []);
}

export function pushOutbox(item) {
  const list = outbox();
  list.push(item);
  local.set(K.outbox, list.slice(-50));
}

export function setOutbox(list) {
  local.set(K.outbox, list);
}
