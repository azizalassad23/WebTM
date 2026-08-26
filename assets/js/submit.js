/**
 * WebTM — submission engine (§8.8 PRD).
 *
 * Mengirim satu baris data ke Google Apps Script Web App, yang lalu melakukan
 * `appendRow()` ke sheet "Latihan" / "Ujian" / "Capstone".
 *
 * Catatan CORS: body dikirim sebagai `text/plain` supaya termasuk *simple
 * request* dan browser tidak melakukan preflight OPTIONS — Apps Script tidak
 * menjawab OPTIONS. Bila permintaan ber-CORS tetap gagal, kita ulang sekali
 * dengan `mode: 'no-cors'`; pengiriman itu berhasil sampai ke server tetapi
 * responsnya *opaque*, jadi kita tidak bisa memastikan isinya — status itu
 * dilaporkan apa adanya ke pemanggil, bukan diklaim sukses.
 */

import { SHEETS } from './config.js';
import { outbox, pushOutbox, setOutbox } from './state.js';

function withTimeout(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

async function post(body) {
  const { signal, done } = withTimeout(SHEETS.timeoutMs);
  try {
    const res = await fetch(SHEETS.endpoint, {
      method: 'POST',
      // text/plain menjaga permintaan tetap "simple" (tanpa preflight).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* Apps Script bisa balas HTML */ }
    if (parsed && parsed.ok === false) throw new Error(parsed.error || 'ditolak server');
    return { ok: true, confirmed: true, response: parsed };
  } finally {
    done();
  }
}

async function postOpaque(body) {
  const { signal, done } = withTimeout(SHEETS.timeoutMs);
  try {
    await fetch(SHEETS.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal
    });
    // Respons opaque: tidak ada status yang bisa dibaca.
    return { ok: true, confirmed: false };
  } finally {
    done();
  }
}

/**
 * @param {'Latihan'|'Ujian'|'Capstone'} sheet
 * @param {object} data kolom-kolom baris
 * @returns {Promise<{ok:boolean, confirmed:boolean, queued?:boolean, error?:string}>}
 */
export async function submitRow(sheet, data) {
  const body = { token: SHEETS.token, sheet, data, clientAt: new Date().toISOString() };

  if (!SHEETS.endpoint) {
    pushOutbox(body);
    return {
      ok: false,
      confirmed: false,
      queued: true,
      error: 'Endpoint Apps Script belum diisi di assets/js/config.js.'
    };
  }

  try {
    return await post(body);
  } catch (err) {
    try {
      const opaque = await postOpaque(body);
      return { ...opaque, note: `CORS gagal (${err.message}); dikirim mode no-cors.` };
    } catch (err2) {
      pushOutbox(body);
      return { ok: false, confirmed: false, queued: true, error: err2.message || String(err2) };
    }
  }
}

/** Coba kirim ulang antrean lokal. Dipanggil saat aplikasi dimuat. */
export async function flushOutbox() {
  if (!SHEETS.endpoint) return { sent: 0, left: outbox().length };
  const queue = outbox();
  if (!queue.length) return { sent: 0, left: 0 };

  const left = [];
  let sent = 0;
  for (const body of queue) {
    try { await post(body); sent++; }
    catch { left.push(body); }
  }
  setOutbox(left);
  return { sent, left: left.length };
}

/**
 * Pengecekan jaringan dasar untuk tautan Capstone (§8.9 PRD).
 *
 * [Catatan teknis penting] Respons lintas-origin bersifat opaque. Yang bisa
 * dibedakan hanyalah "ada respons di level jaringan" vs "tidak ada" (DNS gagal,
 * host mati). Ini TIDAK memastikan HTTP 200 vs 404, dan sama sekali tidak
 * memeriksa isi halaman. Penilaian isi CV tetap manual oleh guru.
 */
export async function checkReachable(url) {
  const { signal, done } = withTimeout(8000);
  try {
    await fetch(url, { mode: 'no-cors', method: 'GET', cache: 'no-store', signal });
    return { status: 'Merespons', ok: true };
  } catch (err) {
    return {
      status: 'Tidak Merespons',
      ok: false,
      error: err.name === 'AbortError' ? 'Waktu tunggu habis.' : 'Alamat tidak dapat dijangkau.'
    };
  } finally {
    done();
  }
}
