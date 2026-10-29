// Función de Vercel: toda la API de la clasificación (/api/…) contra MongoDB Atlas.
// vercel.json manda aquí cualquier /api/<ruta> como /api/index?__p=<ruta>.
// Variables en Vercel: MONGODB_URI, ALLOWED_ORIGINS (la web de GitHub Pages) y, si quieres, MONGODB_DB.
// La administración no pasa por aquí: se hace con la app de escritorio (admin-app/) directamente contra Atlas.
import { handleApi } from '../lib/scores-api.mjs';
import { mongoStoreFromEnv } from '../lib/store-mongo.mjs';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = u.searchParams.get('__p');
  if (p !== null) {
    u.searchParams.delete('__p');
    req.url = `/api/${p}${u.search}`;
  }
  let store;
  try {
    store = await mongoStoreFromEnv();
  } catch (e) {
    console.error('MongoDB:', e.message);
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) res.setHeader('Access-Control-Allow-Origin', origin);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'La base de datos no está disponible ahora mismo.' }));
  }
  return handleApi(req, res, store, { trustProxy: true, allowedOrigins });
}
