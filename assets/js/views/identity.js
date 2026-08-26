/** Layar 1 — Identifikasi Siswa (route: `/`, komponen: IdentityForm). */

import { APP } from '../config.js';
import { esc } from '../util.js';
import { screen, brand, footer } from '../ui.js';
import { setStudent, getStudent } from '../state.js';
import { totalTopics } from '../content.js';

export default async function identityView(_params, { router }) {
  const topics = await totalTopics().catch(() => 22);
  const existing = getStudent();

  const el = screen({
    top: `<header class="topbar">
            ${brand()}
            <span class="brand-sub">${esc(APP.tagline)}</span>
          </header>`,
    body: `
      <section class="identity">
        <div class="identity-form">
          <div class="kicker" style="margin-bottom:16px">LANGKAH 1 DARI 1 · IDENTITAS</div>
          <h2>Selamat datang di kelas coding.</h2>
          <p class="identity-lead">
            Isi identitas dengan benar. Nama dan kelas ini yang akan tercatat pada
            rekap nilai guru, jadi pastikan penulisannya sesuai daftar absensi.
          </p>

          <form class="identity-fields" novalidate>
            <div class="field">
              <label class="field-label" for="nama">Nama Lengkap</label>
              <input class="input" id="nama" name="nama" type="text" autocomplete="name"
                     placeholder="Aisyah Ramadhani" value="${esc(existing?.nama || '')}" required>
              <div class="field-error hidden" data-error-for="nama"></div>
            </div>

            <div class="field">
              <label class="field-label" for="kelas">Kelas / NISN</label>
              <input class="input" id="kelas" name="kelas" type="text"
                     placeholder="XI TEI 2 / 0071234567" value="${esc(existing?.kelas || '')}" required>
              <div class="field-hint">Format: Kelas / NISN — dipisah garis miring.</div>
              <div class="field-error hidden" data-error-for="kelas"></div>
            </div>

            <div class="row" style="gap:16px;margin-top:10px;flex-wrap:wrap">
              <button class="btn btn-primary btn-lg" type="submit">Mulai Belajar</button>
              <span class="small muted" style="max-width:22ch">
                Identitas disimpan hanya selama sesi berjalan.
              </span>
            </div>
          </form>
        </div>

        <aside class="identity-side">
          <div class="code-window">
            <div class="lights" aria-hidden="true">
              <span style="background:#d67f48"></span>
              <span style="background:#aebf92"></span>
              <span style="background:#82796a"></span>
            </div>
            <pre><span class="tk-com">&lt;!-- yang akan kamu pelajari --&gt;</span>
&lt;<span class="tk-tag">h1</span>&gt;Struktur HTML&lt;/<span class="tk-tag">h1</span>&gt;
&lt;<span class="tk-tag">p</span>&gt;Box model &amp; Flexbox&lt;/<span class="tk-tag">p</span>&gt;
&lt;<span class="tk-tag">p</span>&gt;Grid, animasi, responsive&lt;/<span class="tk-tag">p</span>&gt;</pre>
          </div>
          <div class="stat-row">
            <div class="stat"><div class="stat-num">${topics}</div><div class="stat-label">TOPIK</div></div>
            <div class="stat"><div class="stat-num">90</div><div class="stat-label">MENIT UJIAN</div></div>
            <div class="stat"><div class="stat-num">1</div><div class="stat-label">CAPSTONE</div></div>
          </div>
        </aside>
      </section>`,
    foot: footer('route: /  ·  komponen: IdentityForm')
  });

  const form = el.querySelector('form');

  const showError = (name, message) => {
    const box = el.querySelector(`[data-error-for="${name}"]`);
    const input = el.querySelector(`#${name}`);
    box.textContent = message;
    box.classList.toggle('hidden', !message);
    input.classList.toggle('invalid', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const nama = form.nama.value.trim();
    const kelas = form.kelas.value.trim();

    let ok = true;
    if (nama.length < 3) { showError('nama', 'Tulis nama lengkap, minimal 3 huruf.'); ok = false; }
    else showError('nama', '');

    // Validasi format sederhana di sisi klien. [Batasan §5.4 PRD] Tidak ada
    // pengecekan terhadap database siswa resmi — identitas tidak terverifikasi.
    if (!/^.+\/\s*\d{4,}$/.test(kelas)) {
      showError('kelas', 'Gunakan format "Kelas / NISN", contoh: XI TEI 2 / 0071234567.');
      ok = false;
    } else showError('kelas', '');

    if (!ok) { el.querySelector('.invalid')?.focus(); return; }

    setStudent(nama, kelas);
    router.navigate('/dashboard');
  });

  return { el };
}
