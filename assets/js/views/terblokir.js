/** Layar 9 — Halaman blokir 60 menit (route: `/ujian/terblokir`). */

import { EXAM } from '../config.js';
import { clock } from '../util.js';
import { screen, footer, violationLog } from '../ui.js';
import { getLockout, lockoutSecondsLeft, lockoutCycles } from '../state.js';

export default async function terblokirView(_params, { router }) {
  const lock = getLockout();
  if (!lock) { router.navigate('/dashboard', true); return { el: document.createElement('div') }; }

  const totalSeconds = EXAM.lockoutMinutes * 60;
  const endsAt = new Date(lock.until).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const el = screen({
    top: `<header class="topbar topbar-plain" style="background:var(--ink)">
            <span class="brand-name">WebTM · RUANG UJIAN</span>
            <span class="crumbs">akses ujian ditangguhkan</span>
          </header>`,
    body: `
      <section class="lockout">
        <div class="lockout-inner">
          <div class="lockout-mark" aria-hidden="true">✕</div>
          <div class="kicker" style="color:var(--a400);letter-spacing:.2em;margin-bottom:12px">
            SESI DIBLOKIR — PELANGGARAN KE-${EXAM.maxViolations + 1}
          </div>
          <h2>Ujian Anda dihentikan</h2>
          <p style="max-width:48ch;margin:0 auto 28px">
            Jumlah pelanggaran melewati batas maksimal ${EXAM.maxViolations}. Seluruh jawaban
            pada sesi ini dikosongkan dan dicatat di rekap guru. Anda dapat memulai sesi baru
            setelah masa tunggu berakhir.
          </p>

          <div class="lockout-timer">
            <div class="kicker" style="color:var(--n500);margin-bottom:10px">SISA MASA BLOKIR</div>
            <div class="big" data-countdown>--:--</div>
            <div class="bar" style="border-color:var(--n700);background:transparent;margin-top:18px">
              <i data-progress style="width:0%;background:var(--accent)"></i>
            </div>
            <div class="small mono" style="color:var(--n600);margin-top:9px">
              dari total ${EXAM.lockoutMinutes} menit · berakhir ${endsAt} WIB
            </div>
          </div>

          <div class="lockout-log">
            <div class="kicker" style="color:var(--n500);margin-bottom:10px">
              CATATAN YANG DIKIRIM KE GOOGLE SHEETS
            </div>
            ${violationLog(lock.violations || [])}
            <div class="small mono" style="color:var(--n600);margin-top:12px">
              siklus blokir ke-${lockoutCycles()}
            </div>
          </div>

          <p class="small" style="max-width:44ch;margin:0 auto 20px">
            Saat masa tunggu berakhir, sesi dimulai dari awal: timer ${EXAM.durationMinutes} menit
            baru dan ${EXAM.questionCount} soal yang diacak ulang.
          </p>
          <button class="btn" type="button" data-act="mulai" disabled>
            Mulai Ujian Baru — tersedia dalam <span data-countdown-inline>--:--</span>
          </button>
        </div>
      </section>`,
    foot: footer('route: /ujian/terblokir', true)
  });

  const countdown = el.querySelector('[data-countdown]');
  const inline = el.querySelector('[data-countdown-inline]');
  const progress = el.querySelector('[data-progress]');
  const button = el.querySelector('[data-act="mulai"]');

  function tick() {
    const left = lockoutSecondsLeft();
    countdown.textContent = clock(left);
    inline.textContent = clock(left);
    progress.style.width = `${Math.round(((totalSeconds - left) / totalSeconds) * 100)}%`;

    if (left <= 0) {
      clearInterval(timer);
      button.disabled = false;
      button.textContent = 'Mulai Ujian Baru';
      button.classList.add('btn-primary', 'btn-on-dark');
    }
  }

  const timer = setInterval(tick, 1000);
  tick();

  button.addEventListener('click', () => {
    if (button.disabled) return;
    router.navigate('/ujian/mulai');
  });

  return { el, destroy() { clearInterval(timer); } };
}
