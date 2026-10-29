// Función de Vercel: toda la API de la clasificación (/api/…) contra MongoDB Atlas.
// vercel.json manda aquí cualquier /api/<ruta> como /api/index?__p=<ruta>.
// Variables en Vercel: MONGODB_URI, ALLOWED_ORIGINS (la web de GitHub Pages) y, si quieres, MONGODB_DB.
// La administración no pasa por aquí: se hace con la app de escritorio (admin-app/) directamente contra Atlas.
import { handleApi } from '../lib/scores-api.mjs';
import { mongoStoreFromEnv } from '../lib/store-mongo.mjs';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

// Motivo del fallo de conexión, sin datos sensibles (para saber qué revisar en Vercel o en Atlas)
function reasonOf(e) {
  const m = String(e?.message || e);
  if (/MONGODB_URI/.test(m)) return 'Falta la variable MONGODB_URI en Vercel (o no se ha vuelto a desplegar tras añadirla).';
  if (/Invalid scheme|Invalid connection string|URI must include|malformed/i.test(m)) return 'La cadena MONGODB_URI no es válida (revisa que empiece por mongodb+srv:// y no tenga comillas ni espacios).';
  if (/auth|authentication|bad auth/i.test(m)) return 'Usuario o contraseña incorrectos en MONGODB_URI (¿sigue puesto <db_password>? ¿la contraseña tiene símbolos?).';
  if (/ENOTFOUND|querySrv|EREFUSED|ENODATA/i.test(m)) return 'No se encuentra el clúster: revisa la dirección del clúster en MONGODB_URI.';
  if (/timed out|ETIMEDOUT|Server selection|ECONNREFUSED|not authorized on|whitelist|IP/i.test(m)) return 'Atlas no responde: añade 0.0.0.0/0 en Network Access.';
  if (/Cannot find (module|package)/i.test(m)) return 'Falta el paquete mongodb en el despliegue.';
  return 'Error de conexión con MongoDB (mira Logs en Vercel, línea «MongoDB:»).';
}

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
    return res.end(JSON.stringify({ error: 'La base de datos no está disponible ahora mismo.', reason: reasonOf(e) }));
  }
  return handleApi(req, res, store, { trustProxy: true, allowedOrigins });
}
