// API pública del juego (clasificación del modo infinito, mapas de la comunidad y visitas), compartida por:
//   · server.mjs (tu ordenador o un VPS) con el almacén JSON (data/scores.json)
//   · las funciones de Vercel (api/…) con MongoDB Atlas
// La administración NO va por aquí: se hace con la app de escritorio (admin-app/), que se conecta
// directamente a la base de datos. Así no hay nada que atacar desde internet.
import { randomBytes, createHash } from 'node:crypto';
import { LEVEL_ORDER, HEROES } from '../www/js/config.js';
import { validateMapPost, MAP_PUBLIC } from './maps.mjs';

export const PUBLIC = ['id', 'name', 'level', 'hero', 'wave', 'kills', 'towers', 'gold', 'damage', 'time', 'date'];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
// orden: oleada alcanzada, más bajas, menos tiempo, el primero que lo consiguió
export const byRank = (a, b) => b.wave - a.wave || b.kills - a.kills || a.time - b.time || String(a.date).localeCompare(String(b.date));
export const newId = () => randomBytes(6).toString('hex');

// ── Validación ───────────────────────────────────────────
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export function cleanName(n) {
  if (typeof n !== 'string') return '';
  return n.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}
// strict = la manda un jugador (además, que sea creíble)
export function validate(b, strict) {
  if (!b || typeof b !== 'object') return { error: 'Datos no válidos.' };
  const name = cleanName(b.name);
  if (!name) return { error: 'Escribe un nombre (hasta 20 caracteres).' };
  if (!LEVEL_ORDER.includes(b.level)) return { error: 'Mapa no válido para la clasificación.' };
  if (b.hero !== null && b.hero !== undefined && b.hero !== '' && !HEROES[b.hero]) return { error: 'Héroe no válido.' };
  const n = { wave: b.wave, kills: b.kills, towers: b.towers, gold: b.gold, damage: b.damage, time: b.time };
  if (!int(n.wave, 1, 100000) || !int(n.kills, 0, 1e8) || !int(n.towers, 0, 1e6) || !int(n.gold, 0, 1e10) || !int(n.damage, 0, 1e13) || !int(n.time, 0, 1e7)) {
    return { error: 'Datos de la partida no válidos.' };
  }
  if (strict) {
    // cotas generosas para descartar envíos inventados a mano (no es un antitrampas perfecto)
    if (n.kills > n.wave * 400 + 100 || n.time < (n.wave - 1) * 3 || n.gold > (n.kills + 50) * 2000 || n.towers > n.wave * 60 + 40) {
      return { error: 'Esa puntuación no parece de una partida real.' };
    }
  }
  return { ok: { name, level: b.level, hero: b.hero || null, ...n } };
}

// ── Límites por jugador (huella de su IP) ───────────────
export const LIMITS = {
  scoresPerDay: 10, // puntuaciones guardadas en la clasificación cada 24 h
  mapsPerDay: 2, // mapas publicados cada 24 h
};

// ── Utilidades HTTP (valen para node:http y para Vercel) ──
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
function cors(req, res, allowed) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (allowed.includes('*') || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}
function json(res, code, data, extra = {}) {
  res.statusCode = code;
  for (const [k, v] of Object.entries({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC, ...extra })) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}
async function readBody(req, max) {
  // Vercel ya trae el cuerpo leído; node:http no
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    if (raw.length > max) throw new Error('demasiado grande');
    return raw ? (typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(raw)) : {};
  }
  return new Promise((ok, ko) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { ko(new Error('demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { ko(new Error('JSON no válido')); } });
    req.on('error', ko);
  });
}

// ── Rutas ────────────────────────────────────────────────
// store: almacén (lib/store-json.mjs o lib/store-mongo.mjs). opts: { trustProxy, allowedOrigins }
export async function handleApi(req, res, store, opts = {}) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;
  const allowed = opts.allowedOrigins || [];
  cors(req, res, allowed);
  if (method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const fwd = req.headers['x-forwarded-for'];
  const ip = (opts.trustProxy && fwd ? String(fwd).split(',')[0].trim() : req.socket?.remoteAddress) || '?';
  const salt = await store.salt();
  const ipHash = createHash('sha256').update(salt + ip).digest('hex').slice(0, 16);
  const body = async (max = 4096) => readBody(req, max);
  try {
    if (path === '/api/health') return json(res, 200, { ok: true, store: store.kind });

    // Pública: una visita a la web (solo cuenta por día y huella anónima; lo ve la app de administración)
    if (path === '/api/visit' && method === 'POST') {
      if (!(await store.hit(`visit:${ipHash}`, 60, 3600))) await store.visit(ipHash);
      res.statusCode = 204;
      return res.end();
    }
    // jugador bloqueado desde la app de administración: puede jugar y mirar, pero no guardar ni publicar
    const banned = async () => {
      if (!(await store.isBanned(ipHash))) return false;
      json(res, 403, { error: 'Tu acceso para guardar puntuaciones y publicar mapas está bloqueado.' });
      return true;
    };

    // Pública: leer la clasificación de un mapa
    if (path === '/api/scores' && method === 'GET') {
      if (await store.hit(`get:${ipHash}`, 240, 60)) return json(res, 429, { error: 'Demasiadas consultas, espera un momento.' });
      const level = url.searchParams.get('level');
      if (!LEVEL_ORDER.includes(level)) return json(res, 400, { error: 'Mapa no válido.' });
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 50));
      const { total, scores } = await store.top(level, limit);
      return json(res, 200, { level, total, scores: scores.map((s) => pick(s, PUBLIC)) });
    }

    // Pública: guardar una puntuación al acabar una partida infinita
    if (path === '/api/scores' && method === 'POST') {
      if (await store.hit(`post:${ipHash}`, 20, 600)) return json(res, 429, { error: 'Demasiados envíos seguidos. Prueba dentro de unos minutos.' });
      let b;
      try { b = await body(4096); } catch (e) { return json(res, 400, { error: e.message }); }
      const v = validate(b, true);
      if (v.error) return json(res, 400, { error: v.error });
      if (await banned()) return;
      if (await store.hit(`scoreday:${ipHash}`, LIMITS.scoresPerDay, 86400)) return json(res, 429, { error: `Ya has guardado ${LIMITS.scoresPerDay} puntuaciones hoy, que es el máximo. Vuelve mañana.` });
      const entry = { id: newId(), ...v.ok, date: new Date().toISOString(), version: String(b.version || '').slice(0, 12), ipHash };
      await store.add(entry);
      const { rank, total } = await store.rankOf(entry);
      return json(res, 201, { id: entry.id, rank, total });
    }

    // ── Mapas de la comunidad (públicas) ──
    if (path === '/api/maps' && method === 'GET') {
      if (await store.hit(`get:${ipHash}`, 240, 60)) return json(res, 429, { error: 'Demasiadas consultas, espera un momento.' });
      const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'new';
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 60));
      const { total, maps } = await store.maps.list(sort, limit);
      return json(res, 200, { sort, total, maps: maps.map((m) => pick(m, MAP_PUBLIC)) });
    }
    if (path === '/api/maps' && method === 'POST') {
      if (await store.hit(`post:${ipHash}`, 20, 600)) return json(res, 429, { error: 'Demasiados envíos seguidos. Prueba dentro de unos minutos.' });
      let b;
      try { b = await body(8192); } catch (e) { return json(res, 400, { error: e.message }); }
      const v = validateMapPost(b);
      if (v.error) return json(res, 400, { error: v.error });
      if (await banned()) return;
      const dup = await store.maps.byCode(v.ok.code);
      if (dup) return json(res, 409, { error: dup.hidden ? 'Ese mapa ya se publicó y está retirado.' : `Ese mapa ya está publicado («${dup.name}», de ${dup.author}).`, id: dup.id });
      if (await store.hit(`mapday:${ipHash}`, LIMITS.mapsPerDay, 86400)) return json(res, 429, { error: `Ya has publicado ${LIMITS.mapsPerDay} mapas hoy, que es el máximo. Vuelve mañana.` });
      const entry = { id: newId(), ...v.ok, date: new Date().toISOString(), plays: 0, ipHash };
      await store.maps.add(entry);
      return json(res, 201, { map: pick(entry, MAP_PUBLIC) });
    }
    const mp = /^\/api\/maps\/([a-f0-9]+)(\/play)?$/.exec(path);
    if (mp) {
      const m = await store.maps.get(mp[1]);
      if (!m || m.hidden) return json(res, 404, { error: 'Ese mapa ya no está publicado.' });
      if (!mp[2] && method === 'GET') return json(res, 200, { map: pick(m, MAP_PUBLIC) });
      // una partida cuenta como mucho una vez cada 10 minutos por jugador y mapa
      if (mp[2] && method === 'POST') {
        if (!(await store.hit(`play:${m.id}:${ipHash}`, 1, 600))) await store.maps.play(m.id);
        return json(res, 200, { ok: true });
      }
    }

    return json(res, 404, { error: 'No encontrado' });
  } catch (e) {
    console.error('API:', e);
    return json(res, 500, { error: 'Error del servidor. Inténtalo de nuevo en un momento.' });
  }
}
