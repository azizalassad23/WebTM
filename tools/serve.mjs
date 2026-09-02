/**
 * WebTM — server statis untuk pengembangan lokal.
 *
 * Situs ini memakai ES module dan `fetch()` untuk memuat JSON, jadi tidak bisa
 * dibuka langsung lewat `file://` — browser memblokirnya karena kebijakan
 * origin. Jalankan:
 *
 *   node tools/serve.mjs
 *
 * lalu buka http://localhost:4173. Saat di-deploy ke GitHub Pages, berkas ini
 * tidak diperlukan sama sekali: hosting-nya sudah menyajikan berkas statis.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  // Tanpa baris ini .mjs disajikan sebagai octet-stream dan browser menolak
  // menjalankannya sebagai ES module.
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);

  // Jangan sajikan apa pun di luar folder proyek.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('403 Forbidden');
    return;
  }

  fs.readFile(file, (err, buffer) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end(`404 Tidak ditemukan: ${url}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buffer);
  });
}).listen(PORT, () => {
  console.log(`WebTM berjalan di http://localhost:${PORT}`);
});
