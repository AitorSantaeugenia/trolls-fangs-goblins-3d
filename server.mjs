// Servidor del juego, sin dependencias: sirve la web (carpeta www/) y la API de la clasificación del modo infinito.
//
//   node server.mjs        → http://localhost:8080 (solo este ordenador)
//
// La clasificación, los mapas de la comunidad y las visitas se guardan en un JSON propio (data/scores.json)
// o, si defines MONGODB_URI, en MongoDB. Para administrarlos: la app de escritorio (admin-app/).
// En internet, la opción prevista es GitHub Pages + Vercel + MongoDB Atlas (ver docs/DEPLOY.md);
// este servidor sirve para jugar en tu ordenador y para un VPS propio.
//
// Variables de entorno (también se pueden poner en un archivo .env junto a este, que no se sube a Git;
// mira .env.example):
//   PORT            puerto (8080)
//   HOST            interfaz donde escucha (127.0.0.1; en un servidor público, 0.0.0.0)
//   DATA_DIR        carpeta del JSON de la clasificación (./data)
//   MONGODB_URI     si está, guarda en MongoDB en vez de en el JSON (necesita «npm install»)
//   MONGODB_DB      base de datos de MongoDB (tfg3d)
//   TRUST_PROXY     1 si va detrás de un proxy (Nginx, Caddy…) para leer la IP real de X-Forwarded-For
//   ALLOWED_ORIGINS webs de otro dominio que pueden usar esta API, separadas por comas
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './lib/scores-api.mjs';
import { createJsonStore } from './lib/store-json.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
loadEnv(join(here, '.env'));
const root = join(here, 'www');
const devRoot = join(here, 'tools', 'dev'); // páginas de herramientas (retratos 3D…), solo en este ordenador
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '127.0.0.1';
const opts = {
  public: host !== '127.0.0.1' && host !== 'localhost' && host !== '::1',
  trustProxy: process.env.TRUST_PROXY === '1',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
};

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

// .env: lo que ya venga de fuera (PowerShell, el sistema) manda sobre el archivo
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

async function serveStatic(req, res, url) {
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  // /dev/… → tools/dev/ (no se publica; solo para las herramientas, con el servidor en este ordenador)
  const isDev = path.startsWith('/dev/') && !opts.public;
  const base = isDev ? devRoot : root;
  const file = normalize(join(base, isDev ? path.slice(4) : path));
  if (!file.startsWith(base)) throw new Error('fuera');
  const st = await stat(file);
  if (!st.isFile()) throw new Error('no es un archivo');
  const ext = extname(file).toLowerCase();
  // HTML, JS y CSS siempre frescos (cambian con cada versión); imágenes, sonidos y fuentes, un día en caché
  const cache = ['.html', '.js', '.css', '.json', '.webmanifest'].includes(ext) ? 'no-cache' : 'public, max-age=86400';
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SEC });
  if (req.method === 'HEAD') return res.end();
  res.end(await readFile(file));
}

let store;
let where;
if (process.env.MONGODB_URI) {
  const { mongoStoreFromEnv } = await import('./lib/store-mongo.mjs');
  store = await mongoStoreFromEnv();
  where = `MongoDB (base de datos ${process.env.MONGODB_DB || 'tfg3d'})`;
} else {
  store = await createJsonStore(process.env.DATA_DIR || join(here, 'data'));
  where = `${store.file} (${store.count()} puntuaciones)`;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, store, opts);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    await serveStatic(req, res, url);
  } catch {
    if (!res.headersSent) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No encontrado'); }
  }
}).listen(port, host, () => {
  const local = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  console.log(`\n  Trolls, Fangs and Goblins 3D\n\n  Abre en el navegador:  http://${local}:${port}`);
  console.log(`  Datos (clasificación, mapas y visitas): ${where}`);
  console.log('  Administración: la app de escritorio (carpeta admin-app, «npm run dev»)');
  console.log('\n  Ctrl+C para parar.\n');
});
