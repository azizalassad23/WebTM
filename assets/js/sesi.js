/**
 * WebTM — profil sesi berpenilaian (Ujian dan Kuis).
 *
 * Ujian dan kuis memakai mesin yang sama persis: anti-cheat, layar penuh,
 * timer, penilaian otomatis, dan pengiriman ke Sheets. Yang berbeda hanya
 * angka aturannya dan kolam soalnya. Karena itu view-nya pun sama — modul ini
 * yang menentukan aturan mana yang berlaku, supaya tidak ada dua salinan kode
 * ujian yang harus diperbaiki dua kali setiap kali ada bug.
 *
 * Sumber kebenaran profil aktif, berurutan:
 *   1. rekaman sesi yang sedang berjalan (`exam.sesi`) — paling dipercaya,
 *      karena siswa bisa saja me-refresh di rute mana pun;
 *   2. awalan rute (`/kuis/...` vs `/ujian/...`);
 *   3. 'ujian' sebagai bawaan.
 */

import { EXAM, KUIS } from './config.js';

const dasar = {
  sheet: 'Ujian',
  blurToleranceMs: 3000,
  warnAtMinutes: 10,
  blinkAtMinutes: 3
};

export const PROFIL = {
  ujian: {
    ...dasar,
    ...EXAM,
    key: 'ujian',
    nama: 'Ujian HTML & CSS',
    ringkas: 'UJIAN',
    mode: 'Ujian',
    /** Ujian memakai seluruh bank; kuis membatasi menurut tingkat. */
    levelPerBank: null
  },
  kuis: {
    ...dasar,
    ...KUIS,
    key: 'kuis',
    ringkas: 'KUIS'
  }
};

/** Awalan rute sebuah profil: `/ujian` atau `/kuis`. */
export const basePath = (key) => `/${key}`;

export function sesiDariPath(path = '') {
  return String(path).startsWith('/kuis') ? 'kuis' : 'ujian';
}

/**
 * Aturan yang berlaku. Berikan `key` bila pemanggil sudah tahu profilnya
 * (mis. view yang terdaftar pada rute tertentu); tanpa itu, profil ditebak
 * dari rekaman sesi lalu dari hash rute.
 */
export function aturan(key) {
  if (key && PROFIL[key]) return PROFIL[key];
  return PROFIL[sesiDariPath(location.hash.replace(/^#/, ''))];
}

/** Aturan untuk sebuah rekaman sesi yang sudah berjalan. */
export function aturanSesi(exam) {
  return PROFIL[exam?.sesi] || PROFIL.ujian;
}

/** Semua awalan rute yang dijaga penguncian. */
export const SEMUA_BASE = Object.keys(PROFIL).map(basePath);
