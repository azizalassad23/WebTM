/**
 * WebTM — pemuat konten.
 *
 * Materi dan bank soal disimpan sebagai JSON statis di `data/` supaya guru
 * bisa menyuntingnya langsung lewat GitHub tanpa panel admin (§12 PRD).
 * Hasil fetch di-cache di memori selama satu sesi halaman.
 */

import { loadJSON } from './util.js';

const cache = new Map();

function once(key, loader) {
  if (!cache.has(key)) cache.set(key, loader().catch((err) => { cache.delete(key); throw err; }));
  return cache.get(key);
}

/** Modul materi yang punya bab. */
export const MODULES = ['html', 'css'];

/** Bank soal yang ada. "campuran" tidak punya materi sendiri — ia memakai keduanya. */
export const BANKS = ['html', 'css', 'campuran'];

export function getMateri(modul) {
  return once(`materi:${modul}`, () => loadJSON(`data/materi-${modul}.json`));
}

export function getBank(bank) {
  return once(`soal:${bank}`, () => loadJSON(`data/soal-${bank}.json`));
}

export async function getChapter(modul, chapterId) {
  const materi = await getMateri(modul);
  return materi.chapters.find((c) => c.id === chapterId) || null;
}

export async function getChapterByIndex(modul, index) {
  const materi = await getMateri(modul);
  return materi.chapters[index] || null;
}

export async function getQuestion(questionId) {
  for (const name of BANKS) {
    const bank = await getBank(name);
    const found = bank.find((q) => q.id === questionId);
    if (found) return { ...found, _bank: name, _modul: found.chapterModul || name };
  }
  return null;
}

/**
 * Seluruh soal latihan satu bab, terurut. Satu bab punya beberapa soal (§7 PRD:
 * 3–5 per topik), jadi layar latihan menampilkannya sebagai satu rangkaian.
 */
export async function questionsForChapter(modul, chapterId) {
  const bank = await getBank(modul);
  return bank.filter((q) => q.chapterId === chapterId);
}

/**
 * Rangkaian latihan tempat sebuah soal berada, plus posisinya.
 * Dipakai layar Latihan untuk menampilkan "Soal 2 dari 4" dan navigasinya.
 */
export async function practiceSet(question) {
  const modul = question.chapterModul || question._bank || question._modul;
  if (!question.chapterId || !MODULES.includes(modul)) {
    return { set: [question], index: 0, modul };
  }
  const set = await questionsForChapter(modul, question.chapterId);
  const index = set.findIndex((q) => q.id === question.id);
  return index === -1 ? { set: [question], index: 0, modul } : { set, index, modul };
}

/** Total bab kedua modul — dipakai untuk statistik "22 topik". */
export async function totalTopics() {
  const [html, css] = await Promise.all([getMateri('html'), getMateri('css')]);
  return html.chapters.length + css.chapters.length;
}
