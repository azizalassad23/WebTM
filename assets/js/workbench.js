/**
 * WebTM — split-screen workbench (§8.4 PRD).
 *
 * Dipakai bersama oleh layar Latihan dan Ujian: panel kiri editor, panel kanan
 * live preview. Aturan tab mengikuti PRD:
 *   - soal modul HTML  → hanya tab HTML aktif
 *   - soal modul CSS   → HTML disediakan read-only, tab CSS yang diisi siswa
 *   - soal campuran    → kedua tab aktif, seperti mengerjakan proyek sungguhan
 *   - Capstone         → tidak memakai workbench sama sekali (§8.9)
 */

import { esc } from './util.js';
import { createEditor } from './editor.js';
import { createPreview } from './preview.js';

/**
 * Mode editor sebuah soal:
 *   'html'     → tab HTML aktif, CSS nonaktif
 *   'css'      → HTML read-only sebagai bahan, siswa mengisi CSS
 *   'campuran' → kedua tab aktif, siswa menulis HTML dan CSS sekaligus
 *
 * `htmlReadOnly: true` pada soal lama tetap dibaca sebagai mode 'css'.
 */
export function editorMode(question) {
  if (question.editor) return question.editor;
  return question.htmlReadOnly ? 'css' : 'html';
}

export function workbenchHTML(question, { editorNote = '', previewNote = '' } = {}) {
  const mode = editorMode(question);
  const first = mode === 'css' ? 'css' : 'html';

  const label = {
    html: mode === 'css' ? 'index.html · terkunci' : 'index.html',
    css: mode === 'html' ? 'style.css · nonaktif' : 'style.css'
  };

  const tab = (id) => `
    <button class="editor-tab" role="tab" data-tab="${id}"
            aria-selected="${id === first}"
            ${id === 'css' && mode === 'html' ? 'disabled' : ''}>${esc(label[id])}</button>`;

  return `
    <div class="editor-pane">
      <div class="editor-tabs">
        <div class="editor-tablist" role="tablist">${tab('html')}${tab('css')}</div>
        <span class="editor-meta">${esc(editorNote)}</span>
      </div>
      <div data-editor-mount style="display:flex;flex:1;min-height:0"></div>
      <div class="editor-status">
        <span data-caret>Ln 1, Col 1 · ${first.toUpperCase()}</span>
        <span class="blocked">paste diblokir ✕</span>
      </div>
    </div>
    <div class="preview-pane">
      <div class="preview-head">
        <span class="row" style="gap:9px"><i class="dot dot-ok"></i>live preview · debounce 500ms</span>
        <span>${esc(previewNote || 'sandbox=allow-scripts')}</span>
      </div>
      <div data-preview-mount style="display:flex;flex-direction:column;flex:1"></div>
      <div data-result-mount></div>
    </div>`;
}

/**
 * @param {HTMLElement} root elemen yang memuat markup dari `workbenchHTML`
 * @param {object} question
 * @param {{initial?: {html?:string, css?:string}}} [opts]
 */
export function mountWorkbench(root, question, opts = {}) {
  const mode = editorMode(question);
  /** Hanya mode 'css' yang mengunci panel HTML. */
  const htmlLocked = mode === 'css';
  const starter = question.starter_code || {};
  const initial = {
    html: opts.initial?.html ?? starter.html ?? '',
    css: opts.initial?.css ?? starter.css ?? ''
  };
  const buffers = { ...initial };
  let active = htmlLocked ? 'css' : 'html';

  const editorMount = root.querySelector('[data-editor-mount]');
  const previewMount = root.querySelector('[data-preview-mount]');
  const caret = root.querySelector('[data-caret]');

  const preview = createPreview({ mount: previewMount, title: `Preview ${question.id}` });

  const editor = createEditor({
    mount: editorMount,
    value: buffers[active],
    language: active,
    readOnly: htmlLocked && active === 'html',
    label: `Editor ${active.toUpperCase()} soal ${question.id}`,
    onChange(value) {
      buffers[active] = value;
      preview.update(buffers.html, buffers.css);
      opts.onChange?.(getCode());
      updateCaret();
    }
  });

  function updateCaret() {
    if (!caret) return;
    const el = editor.element;
    const upto = el.value.slice(0, el.selectionStart);
    const lines = upto.split('\n');
    caret.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1} · ${active.toUpperCase()}`;
  }
  editor.element.addEventListener('keyup', updateCaret);
  editor.element.addEventListener('click', updateCaret);

  function getCode() {
    buffers[active] = editor.getValue();
    return { html: buffers.html, css: buffers.css };
  }

  root.querySelectorAll('.editor-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.disabled) return;
      const target = tab.dataset.tab;
      if (target === active) return;
      buffers[active] = editor.getValue();
      active = target;
      root.querySelectorAll('.editor-tab')
        .forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      editor.setLanguage(target);
      editor.setReadOnly(htmlLocked && target === 'html');
      editor.setValue(buffers[target]);
      updateCaret();
    });
  });

  preview.run(buffers.html, buffers.css);

  return {
    getCode,
    setCode(next) {
      buffers.html = next.html ?? buffers.html;
      buffers.css = next.css ?? buffers.css;
      editor.setValue(buffers[active]);
      preview.run(buffers.html, buffers.css);
    },
    reset() {
      buffers.html = initial.html;
      buffers.css = initial.css;
      editor.setValue(buffers[active]);
      preview.run(buffers.html, buffers.css);
    },
    run() { const code = getCode(); preview.run(code.html, code.css); return code; },
    focus() { editor.focus(); },
    resultMount: root.querySelector('[data-result-mount]'),
    destroy() { preview.destroy(); editor.destroy(); }
  };
}

/** Panel hasil penilaian di bawah preview. */
export function resultPanelHTML(result, { heading = 'Hasil terakhir' } = {}) {
  const passed = result.results.filter((r) => r.ok).length;
  const perfect = passed === result.results.length;
  return `
    <div class="result-pane${perfect ? '' : ' fail'}">
      <div class="result-head">
        <span class="result-score">${esc(heading)}: ${result.score} / 100</span>
        <span class="pill ${perfect ? 'pill-sage' : 'pill-accent'}">
          ${passed} DARI ${result.results.length} KRITERIA
        </span>
      </div>
      <div class="assert-list">
        ${result.results.map((r) => `
          <div class="${r.ok ? '' : 'assert-miss'}">
            ${r.ok ? '✓' : '✕'} ${esc(r.label)} · ${r.ok ? `${r.earned} poin` : `0 / ${r.poin} poin`}
          </div>`).join('')}
        ${result.results.filter((r) => !r.ok && r.hint).map((r) => `
          <div class="muted">→ ${esc(r.hint)}</div>`).join('')}
      </div>
    </div>`;
}
