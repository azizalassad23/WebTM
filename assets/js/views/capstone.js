/** Layar 8 — Capstone: submission link CV (route: `/capstone`, komponen: CapstoneForm, NetworkStatusBadge). */

import { esc, toast } from '../util.js';
import { screen, brand, footer } from '../ui.js';
import { getStudent, getCapstone, setCapstone, setCapstoneSubmitted } from '../state.js';
import { checkReachable, submitRow } from '../submit.js';

const RUBRIK = [
  'Kelengkapan isi CV',
  'Struktur HTML semantik',
  'Penerapan CSS &amp; keterbacaan',
  'Kerapian layout responsif'
];

const LANGKAH = [
  { title: 'Buat repository baru di GitHub', desc: 'Isi minimal: <code>index.html</code> dan <code>style.css</code>.' },
  { title: 'Aktifkan GitHub Pages', desc: 'Settings → Pages → branch <code>main</code> → Save.' },
  { title: 'Kumpulkan tautannya di formulir ini', desc: 'Pastikan halaman sudah bisa dibuka di browser lain.' }
];

export default async function capstoneView() {
  const student = getStudent();
  const previous = getCapstone();

  const el = screen({
    top: `<header class="topbar" style="background:var(--sage)">
            ${brand('')}
            <span class="crumbs" style="color:var(--s100)">PROYEK AKHIR · MASUK NILAI AKHIR</span>
          </header>`,
    body: `
      <section class="capstone">
        <div class="capstone-left">
          <span class="pill pill-sage" style="margin-bottom:18px">CAPSTONE · MASUK NILAI AKHIR</span>
          <h2>Proyek CV Pribadi</h2>
          <p style="font-size:16px;color:var(--n800);max-width:56ch;margin-bottom:26px">
            Bangun satu halaman CV menggunakan HTML dan CSS, deploy ke GitHub Pages milik Anda
            sendiri, lalu kumpulkan tautannya di sini. Guru akan membuka dan menilai setiap
            tautan secara manual.
          </p>

          <div class="steps">
            ${LANGKAH.map((s, i) => `
              <div class="step">
                <span class="n">${i + 1}</span>
                <div><div class="title">${esc(s.title)}</div><div class="desc">${s.desc}</div></div>
              </div>`).join('')}
          </div>

          <div class="rubric">
            <div class="kicker kicker-sage" style="margin-bottom:9px">KRITERIA PENILAIAN GURU</div>
            <div class="grid">${RUBRIK.map((r) => `<div>◍ ${r}</div>`).join('')}</div>
          </div>

          <p class="small muted" style="margin-top:20px;max-width:56ch">
            Catatan teknis: sistem hanya memeriksa apakah alamat merespons di level jaringan.
            Karena kebijakan CORS, isi halaman Anda tidak bisa dibaca dari sini — penilaian
            kualitas CV dilakukan guru dengan membuka tautannya satu per satu.
          </p>
        </div>

        <div class="capstone-right">
          <h3 style="margin-bottom:20px">Formulir pengumpulan</h3>
          <form class="stack" style="gap:16px" novalidate>
            <div class="field">
              <label class="field-label" for="cap-nama">Nama Lengkap</label>
              <input class="input" id="cap-nama" value="${esc(student?.nama || '')}" readonly>
            </div>
            <div class="field">
              <label class="field-label" for="cap-kelas">Kelas / NISN</label>
              <input class="input" id="cap-kelas" value="${esc(student?.kelas || '')}" readonly>
            </div>
            <div class="field">
              <label class="field-label" for="cap-link">Link CV (GitHub Pages)</label>
              <input class="input input-mono" id="cap-link" type="url" required
                     placeholder="https://namaanda.github.io/cv-saya/"
                     value="${esc(previous?.link || '')}">
              <div class="field-error hidden" data-error></div>
              <div class="netcheck pending hidden" data-netcheck>
                <span class="mark" aria-hidden="true">?</span>
                <p data-netcheck-text></p>
              </div>
            </div>

            <div class="dashed">
              Status awal setelah dikirim: <strong>Menunggu Review</strong>.
              Guru akan mengubahnya menjadi <em>Disetujui</em> atau <em>Perlu Revisi</em>.
            </div>

            <div class="row" style="gap:14px;margin-top:4px;flex-wrap:wrap">
              <button class="btn btn-white" type="button" data-act="cek">Cek tautan</button>
              <button class="btn btn-sage btn-lg" type="submit">Kirim Tautan CV</button>
              <span class="small muted" style="max-width:18ch">Bisa dikirim ulang bila ada perbaikan.</span>
            </div>

            <div class="panel panel-sage pad-sm${previous ? '' : ' hidden'}"
                 style="border-radius:16px" data-last>
              <div class="kicker kicker-sage" style="margin-bottom:6px">TERAKHIR DIKIRIM</div>
              <div class="small mono" data-last-text>
                ${previous ? `${esc(previous.link)} · ${esc(previous.status)} · ${esc(previous.sentAt)}` : ''}
              </div>
            </div>
          </form>

          <div class="row" style="gap:12px;margin-top:24px">
            <a class="btn btn-quiet btn-sm" href="#/dashboard">← Kembali ke dasbor</a>
          </div>
        </div>
      </section>`,
    foot: footer('route: /capstone  ·  komponen: CapstoneForm, NetworkStatusBadge')
  });

  const form = el.querySelector('form');
  const linkInput = el.querySelector('#cap-link');
  const errorBox = el.querySelector('[data-error]');
  const netBox = el.querySelector('[data-netcheck]');
  const netText = el.querySelector('[data-netcheck-text]');

  const setError = (message) => {
    errorBox.textContent = message;
    errorBox.classList.toggle('hidden', !message);
    linkInput.classList.toggle('invalid', !!message);
  };

  function validLink() {
    const value = linkInput.value.trim();
    if (!value) { setError('Tautan belum diisi.'); return null; }
    let url;
    try { url = new URL(value); } catch { setError('Format URL tidak valid. Contoh: https://nama.github.io/cv-saya/'); return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') { setError('Gunakan tautan http atau https.'); return null; }
    setError('');
    return url.href;
  }

  function showNet(state, message) {
    netBox.classList.remove('hidden', 'pending', 'bad');
    if (state !== 'ok') netBox.classList.add(state);
    netBox.querySelector('.mark').textContent = state === 'ok' ? '✓' : (state === 'bad' ? '✕' : '…');
    netText.innerHTML = message;
  }

  async function runCheck(href) {
    showNet('pending', 'Memeriksa apakah alamat merespons…');
    const net = await checkReachable(href);
    showNet(net.ok ? 'ok' : 'bad', net.ok
      ? '<strong>Domain merespons.</strong> Pengecekan ini hanya memastikan alamat dapat dijangkau jaringan — bukan memeriksa isi halaman.'
      : `<strong>Tidak merespons.</strong> ${esc(net.error || '')} Periksa kembali tautannya, lalu coba lagi.`);
    return net;
  }

  el.querySelector('[data-act="cek"]').addEventListener('click', async () => {
    const href = validLink();
    if (href) await runCheck(href);
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const href = validLink();
    if (!href) { linkInput.focus(); return; }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Mengirim…';

    try {
      const net = await runCheck(href);
      const record = {
        link: href,
        status: net.status,
        review: 'Menunggu Review',
        sentAt: new Date().toLocaleString('id-ID')
      };

      const outcome = await submitRow('Capstone', {
        nama: student?.nama || '',
        kelas: student?.kelas || '',
        linkCv: href,
        statusJaringan: net.status,
        statusReviewGuru: 'Menunggu Review'
      });

      setCapstone(record);
      setCapstoneSubmitted(true);

      // Diperbarui di tempat, bukan lewat render ulang: hasil pengecekan
      // jaringan yang baru saja dilihat siswa harus tetap terpampang.
      const lastBox = el.querySelector('[data-last]');
      lastBox.classList.remove('hidden');
      el.querySelector('[data-last-text]').textContent =
        `${record.link} · ${record.status} · ${record.sentAt}`;

      if (outcome.ok) {
        toast(outcome.confirmed
          ? 'Tautan CV terkirim. Status: Menunggu Review.'
          : 'Tautan CV terkirim (konfirmasi server tidak terbaca karena CORS).', 'ok', 5000);
      } else {
        toast(outcome.queued
          ? 'Tautan tersimpan di perangkat, belum terkirim ke guru. Akan dicoba lagi otomatis.'
          : `Pengiriman gagal: ${outcome.error}`, 'warn', 6000);
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Kirim Tautan CV';
    }
  });

  return { el };
}
