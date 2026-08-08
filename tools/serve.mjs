// Gelistirme sunucusu. Sadece test icin; uygulamanin calismasi buna bagli degil.
// Hicbir paket kurmaz, Node'un yerlesik http modulunu kullanir.
//
// Kullanim:  node tools/serve.mjs        (varsayilan port 8080)
//            node tools/serve.mjs 3000
//
// Telefondan test etmek icin: bilgisayarla ayni wifi'ye baglan ve asagida yazan
// http://192.168.x.x:8080 adresini telefonun tarayicisina yaz.
//
// NOT: Service worker ve "Ana ekrana ekle" yalnizca https veya localhost'ta calisir.
// Telefondan IP ile girdiginde uygulama calisir ama cevrimdisi kurulum icin
// GitHub Pages (https) adresini kullanmak gerekir.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { networkInterfaces } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    // Dizin disina cikmayi engelle.
    const target = normalize(join(root, pathname));
    if (!target.startsWith(root + sep) && target !== root) {
      response.writeHead(403).end('Yasak');
      return;
    }

    const info = await stat(target).catch(() => null);
    if (!info || info.isDirectory()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı');
      return;
    }

    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      // Gelistirme sirasinda tarayici eski dosyayi tutmasin.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Sunucu hatası');
    console.error(error);
  }
});

server.listen(port, () => {
  console.log(`\nYKS Takip geliştirme sunucusu çalışıyor:\n`);
  console.log(`  Bilgisayarda:  http://localhost:${port}`);
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`  Telefonda:     http://${address.address}:${port}   (${name})`);
      }
    }
  }
  console.log('\nDurdurmak için Ctrl+C.\n');
});
