/**
 * WebTM — router berbasis hash.
 *
 * Hash routing dipilih karena GitHub Pages tidak bisa mengarahkan ulang
 * (rewrite) URL dalam ke `index.html`; dengan `#/dashboard`, refresh dan
 * bookmark tetap bekerja tanpa konfigurasi server apa pun.
 */

function compile(pattern) {
  const names = [];
  const source = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:(\w+)/g, (_, name) => { names.push(name); return '/([^/]+)'; });
  return { re: new RegExp(`^${source}$`), names };
}

export function createRouter({ root, routes, fallback, onBeforeNavigate, context = {} }) {
  const compiled = routes.map((r) => ({ ...r, ...compile(r.path) }));
  let current = null;
  let token = 0;
  /** Diteruskan ke setiap view sebagai argumen kedua. */
  const ctx = { ...context };

  function parse() {
    const raw = location.hash.replace(/^#/, '');
    return raw.startsWith('/') ? raw : '/';
  }

  function match(path) {
    for (const route of compiled) {
      const m = route.re.exec(path);
      if (!m) continue;
      const params = {};
      route.names.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { route, params };
    }
    return null;
  }

  async function render() {
    const myToken = ++token;
    const path = parse();

    // Guard global (identitas belum diisi, sesi terblokir, dst.)
    const redirect = onBeforeNavigate ? onBeforeNavigate(path) : null;
    if (redirect && redirect !== path) { navigate(redirect, true); return; }

    const found = match(path) || (fallback ? { route: { view: fallback }, params: {} } : null);
    if (!found) return;

    root.innerHTML = '<div class="loading">Memuat…</div>';
    let view;
    try {
      view = await found.route.view(found.params, ctx);
    } catch (err) {
      console.error('[WebTM] gagal memuat layar', err);
      root.innerHTML =
        `<div class="loading">Gagal memuat halaman.<br><br>${err.message}</div>`;
      return;
    }
    // Navigasi lain sudah menyusul selagi view ini dimuat — buang hasilnya.
    if (myToken !== token) { view?.destroy?.(); return; }

    current?.destroy?.();
    current = view;
    root.replaceChildren(view.el);
    window.scrollTo(0, 0);
    const heading = view.el.querySelector('h1, h2');
    if (heading) document.title = `${heading.textContent.trim()} · WebTM`;
  }

  function navigate(path, replace = false) {
    const target = '#' + path;
    if (location.hash === target) { render(); return; }
    if (replace) location.replace(target);
    else location.hash = target;
  }

  window.addEventListener('hashchange', render);

  const api = {
    start() { render(); },
    navigate,
    get path() { return parse(); },
    refresh: render
  };
  ctx.router = api;
  return api;
}
