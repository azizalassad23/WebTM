/** Layar 3 — Halaman Materi (route: `/materi/:modul/:no`, komponen: ChapterNav, LessonBody, MiniPreview). */

import { esc } from '../util.js';
import { screen, brand, footer, identityChip } from '../ui.js';
import { getStudent, markChapterDone, getProgress } from '../state.js';
import { getMateri, questionsForChapter } from '../content.js';
import { createEditor } from '../editor.js';
import { createPreview } from '../preview.js';

function chapterNav(materi, currentId, done, modul) {
  const groups = [];
  let lastLevel = null;
  for (const c of materi.chapters) {
    if (c.level !== lastLevel) { groups.push({ level: c.level, items: [] }); lastLevel = c.level; }
    groups[groups.length - 1].items.push(c);
  }
  return groups.map((g) => `
    <div class="chapter-group">${esc(g.level.toUpperCase())}</div>
    ${g.items.map((c) => {
      const isDone = done.includes(c.id);
      const isCurrent = c.id === currentId;
      const cls = isCurrent ? 'current' : (isDone ? 'done' : '');
      return `<a class="chapter-item ${cls}" href="#/materi/${modul}/${c.no}"
                 ${isCurrent ? 'aria-current="page"' : ''}>
                <span class="no">${esc(c.no)}${isDone && !isCurrent ? ' ✓' : ''}</span>${esc(c.title)}
              </a>`;
    }).join('')}
  `).join('');
}

export default async function materiView({ modul, no }, { router }) {
  if (modul !== 'html' && modul !== 'css') { router.navigate('/dashboard', true); return { el: document.createElement('div') }; }

  const materi = await getMateri(modul);
  const index = materi.chapters.findIndex((c) => c.no === no);
  if (index === -1) { router.navigate(`/materi/${modul}/${materi.chapters[0].no}`, true); return { el: document.createElement('div') }; }

  const chapter = materi.chapters[index];
  const prev = materi.chapters[index - 1] || null;
  const next = materi.chapters[index + 1] || null;
  const done = getProgress()[modul];
  const soal = await questionsForChapter(modul, chapter.id);
  const percent = Math.round(((index + 1) / materi.chapters.length) * 100);

  const hasCss = !!chapter.example?.css;

  const el = screen({
    top: `<header class="topbar">
            <div class="row" style="gap:16px">
              ${brand('')}
              <span class="crumbs">/ Modul ${esc(materi.nama)} / ${esc(chapter.level)} / ${esc(chapter.title)}</span>
            </div>
            <div class="row" style="gap:10px">
              <span class="crumbs">Bab ${index + 1} dari ${materi.chapters.length}</span>
              <span class="bar bar-slim" style="width:120px"><i style="width:${percent}%"></i></span>
              ${identityChip(getStudent())}
            </div>
          </header>`,
    body: `
      <section class="lesson">
        <nav class="chapter-nav" aria-label="Daftar bab">
          <div class="kicker" style="margin-bottom:14px">DAFTAR BAB — ${esc(materi.nama)}</div>
          <div class="chapter-list">${chapterNav(materi, chapter.id, done, modul)}</div>
        </nav>

        <article class="lesson-body">
          <span class="pill pill-accent" style="margin-bottom:16px">MATERI · TINGKAT ${esc(chapter.level.toUpperCase())}</span>
          <h2>${esc(chapter.title)}</h2>
          <p class="lead">${chapter.lead}</p>

          <div class="concept-grid">
            ${(chapter.concepts || []).map((c) => `
              <div class="concept"><h5>${esc(c.title)}</h5><p>${c.body}</p></div>
            `).join('')}
          </div>

          ${(chapter.sections || []).map((s) => `
            <h4 style="margin-top:26px">${s.heading}</h4>
            <div class="prose">${s.body}</div>
          `).join('')}

          ${chapter.reference?.length ? `
            <h4 style="margin-top:30px">Referensi cepat</h4>
            <div class="ref-table">
              <table>
                <thead><tr><th>${esc(chapter.referenceHead?.[0] || 'Kode')}</th><th>${esc(chapter.referenceHead?.[1] || 'Kegunaan')}</th></tr></thead>
                <tbody>
                  ${chapter.reference.map((r) => `
                    <tr><td><code>${esc(r.kode)}</code></td><td>${r.arti}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>` : ''}

          ${chapter.pitfalls?.length ? `
            <h4 style="margin-top:30px">Kesalahan yang sering terjadi</h4>
            <div class="pitfalls">
              ${chapter.pitfalls.map((p) => `
                <div class="pitfall">
                  <div class="pf-row pf-bad"><span class="pf-mark">✕</span><code>${esc(p.salah)}</code></div>
                  <div class="pf-row pf-good"><span class="pf-mark">✓</span><code>${esc(p.benar)}</code></div>
                  <p class="pf-why">${p.kenapa}</p>
                </div>`).join('')}
            </div>` : ''}

          <div class="playground" style="margin-top:28px">
            <div class="playground-head">
              <div class="row" style="gap:10px">
                <span class="label">CONTOH INTERAKTIF</span>
                <span class="chip-dark">tidak dinilai</span>
              </div>
              <div class="row" style="gap:8px">
                <button class="chip-dark" type="button" data-act="reset">Reset</button>
                <button class="chip-dark" type="button" data-act="run"
                        style="border-color:var(--accent);background:var(--accent);color:var(--ink)">▶ Run</button>
              </div>
            </div>
            <div class="playground-body">
              <div class="editor-pane">
                <div class="editor-tabs">
                  <div class="editor-tablist" role="tablist">
                    <button class="editor-tab" role="tab" data-tab="html" aria-selected="true">index.html</button>
                    <button class="editor-tab" role="tab" data-tab="css" aria-selected="false"
                            ${hasCss ? '' : 'disabled'}>style.css${hasCss ? '' : ' · nonaktif'}</button>
                  </div>
                  <span class="editor-meta">bebas diubah · auto-indent</span>
                </div>
                <div data-editor-mount style="display:flex;flex:1;min-height:0"></div>
              </div>
              <div class="preview-pane">
                <div class="preview-head">
                  <span class="row" style="gap:9px"><i class="dot dot-ok"></i>preview · sandboxed iframe</span>
                  <span>debounce 500ms</span>
                </div>
                <div data-preview-mount style="display:flex;flex-direction:column;flex:1"></div>
              </div>
            </div>
          </div>

          <div class="lesson-foot">
            ${prev
              ? `<a class="btn btn-quiet" href="#/materi/${modul}/${prev.no}">← Bab sebelumnya</a>`
              : `<span class="btn" aria-disabled="true">← Bab sebelumnya</span>`}
            <span class="small mono muted">progres bab disimpan di localStorage</span>
            <div class="row" style="gap:12px;flex-wrap:wrap">
              ${soal.length
                ? `<a class="btn btn-soft" href="#/latihan/${soal[0].id}" data-act="latihan">Kerjakan ${soal.length} Latihan</a>`
                : ''}
              ${next
                ? `<a class="btn btn-primary" href="#/materi/${modul}/${next.no}" data-act="next">Bab berikutnya →</a>`
                : `<a class="btn btn-primary" href="#/dashboard" data-act="next">Selesaikan modul →</a>`}
            </div>
          </div>
        </article>
      </section>`,
    foot: footer(`route: /materi/${modul}/${no}  ·  komponen: ChapterNav, LessonBody, MiniPreview`)
  });

  /* ------------------------------------------------------------ interaksi */

  const editorMount = el.querySelector('[data-editor-mount]');
  const previewMount = el.querySelector('[data-preview-mount]');

  const start = {
    html: chapter.example?.html || '',
    css: chapter.example?.css || ''
  };
  const buffers = { ...start };
  let active = 'html';

  const preview = createPreview({ mount: previewMount, title: `Contoh ${chapter.title}` });

  const editor = createEditor({
    mount: editorMount,
    value: buffers.html,
    language: 'html',
    label: `Editor contoh ${chapter.title}`,
    onChange(value) {
      buffers[active] = value;
      preview.update(buffers.html, buffers.css);
    }
  });

  preview.run(buffers.html, buffers.css);

  el.querySelectorAll('.editor-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.disabled) return;
      const target = tab.dataset.tab;
      if (target === active) return;
      buffers[active] = editor.getValue();
      active = target;
      el.querySelectorAll('.editor-tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      editor.setLanguage(target);
      editor.setValue(buffers[target]);
    });
  });

  el.querySelector('[data-act="run"]').addEventListener('click', () => {
    buffers[active] = editor.getValue();
    preview.run(buffers.html, buffers.css);
  });

  el.querySelector('[data-act="reset"]').addEventListener('click', () => {
    buffers.html = start.html;
    buffers.css = start.css;
    editor.setValue(buffers[active]);
    preview.run(buffers.html, buffers.css);
  });

  // Bab dianggap selesai ketika siswa melanjutkan atau masuk ke latihannya.
  const complete = () => markChapterDone(modul, chapter.id);
  el.querySelector('[data-act="next"]')?.addEventListener('click', complete);
  el.querySelector('[data-act="latihan"]')?.addEventListener('click', complete);

  return {
    el,
    destroy() { preview.destroy(); editor.destroy(); }
  };
}
