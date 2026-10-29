// Almacén en un archivo JSON (servidor propio: tu ordenador o un VPS). Mismo contenido que las colecciones de MongoDB:
// { version: 1, salt, scores: [ … ], maps: [ … ], visits: [ … ], bans: [ … ] }
// Escritura atómica (temporal + renombrar) en cola, con copia scores.json.bak. Si otro programa (la app de
// administración) cambia el archivo mientras el servidor está encendido, se vuelve a leer antes de seguir.
import { readFile, writeFile, rename, mkdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { byRank } from './scores-api.mjs';

const VISIT_DAYS = 400; // las visitas se guardan algo más de un año
const today = () => new Date().toISOString().slice(0, 10);

export async function createJsonStore(dataDir) {
  const file = join(dataDir, 'scores.json');
  let db = { version: 1, salt: '', scores: [], maps: [], visits: [], bans: [] };
  let mtime = 0;
  let writing = Promise.resolve();
  await mkdir(dataDir, { recursive: true });

  const load = async () => {
    try {
      const d = JSON.parse(await readFile(file, 'utf8'));
      const arr = (k) => (Array.isArray(d[k]) ? d[k] : []);
      db = { version: 1, salt: d.salt || db.salt || '', scores: arr('scores'), maps: arr('maps'), visits: arr('visits'), bans: arr('bans') };
      mtime = (await stat(file)).mtimeMs;
    } catch (e) {
      console.error(`  ⚠ No se pudo leer ${file}: ${e.message}. Se guarda una copia y se empieza vacío.`);
      await copyFile(file, `${file}.roto-${Date.now()}`).catch(() => {});
    }
  };
  // ¿lo ha cambiado otro programa?
  const fresh = async () => {
    await writing;
    if (!existsSync(file)) return;
    const m = (await stat(file)).mtimeMs;
    if (m !== mtime) await load();
  };
  const save = () => {
    writing = writing.then(async () => {
      const limit = new Date(Date.now() - VISIT_DAYS * 864e5).toISOString().slice(0, 10);
      db.visits = db.visits.filter((v) => v.day >= limit);
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(db, null, 2));
      if (existsSync(file)) await copyFile(file, `${file}.bak`).catch(() => {});
      await rename(tmp, file);
      mtime = (await stat(file)).mtimeMs;
    }).catch((e) => console.error('  ⚠ Error guardando:', e.message));
    return writing;
  };
  if (existsSync(file)) await load();
  if (!db.salt) { db.salt = randomBytes(16).toString('hex'); await save(); }

  // límites por IP en memoria (se reinician al reiniciar el servidor)
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 864e5)) hits.delete(k); }, 600e3).unref();
  const visible = (level) => db.scores.filter((s) => s.level === level && !s.hidden).sort(byRank);

  return {
    kind: 'json',
    file,
    count: () => db.scores.length,
    async salt() { return db.salt; },
    async hit(key, max, windowS) {
      const now = Date.now();
      const list = (hits.get(key) || []).filter((t) => now - t < windowS * 1000);
      list.push(now);
      hits.set(key, list);
      return list.length > max;
    },
    async isBanned(ipHash) { await fresh(); return db.bans.some((b) => b.ipHash === ipHash); },
    async visit(ipHash) {
      await fresh();
      const day = today();
      const now = new Date().toISOString();
      const v = db.visits.find((x) => x.day === day && x.ipHash === ipHash);
      if (v) { v.n++; v.last = now; } else db.visits.push({ day, ipHash, n: 1, first: now, last: now });
      await save();
    },
    async top(level, limit) { await fresh(); const all = visible(level); return { total: all.length, scores: all.slice(0, limit) }; },
    async rankOf(entry) { const all = visible(entry.level); return { rank: all.findIndex((s) => s.id === entry.id) + 1, total: all.length }; },
    async add(entry) { await fresh(); db.scores.push(entry); await save(); },
    // mapas de la comunidad
    maps: {
      async list(sort, limit) {
        await fresh();
        const vis = db.maps.filter((m) => !m.hidden)
          .sort(sort === 'popular' ? (a, b) => b.plays - a.plays || b.date.localeCompare(a.date) : (a, b) => b.date.localeCompare(a.date));
        return { total: vis.length, maps: vis.slice(0, limit) };
      },
      async get(id) { await fresh(); return db.maps.find((m) => m.id === id) || null; },
      async byCode(code) { await fresh(); return db.maps.find((m) => m.code === code) || null; },
      async add(m) { await fresh(); db.maps.push(m); await save(); },
      async play(id) { await fresh(); const m = db.maps.find((x) => x.id === id); if (m) { m.plays = (m.plays || 0) + 1; await save(); } },
    },
  };
}
