// Almacén en MongoDB (Atlas). Lo usan las funciones de Vercel (api/…) y server.mjs si arrancas con MONGODB_URI.
//
// Base de datos MONGODB_DB (por defecto «tfg3d»):
//   scores  → una puntuación de la clasificación por documento
//   maps    → un mapa de la comunidad por documento (código TFG1, nombre, nick, descripción, partidas…)
//   visits  → una fila por día y visitante anónimo { day, ipHash, n, first, last } (se borra sola a los ~400 días)
//   bans    → jugadores bloqueados { ipHash, reason, date } (los gestiona la app de administración)
//   limits  → contadores de los límites por IP (se borran solos cuando caducan)
//   meta    → { _id: 'salt', value } para la huella anónima de las IP
import { randomBytes } from 'node:crypto';

const RANK_SORT = { wave: -1, kills: -1, time: 1, date: 1 };
const VISIT_DAYS = 400;
const strip = (d) => { if (!d) return d; const { _id, ...rest } = d; return rest; };

// Con un cliente «db» ya conectado (o uno simulado en las pruebas)
export async function createMongoStore(db) {
  const scores = db.collection('scores');
  const maps = db.collection('maps');
  const visits = db.collection('visits');
  const bans = db.collection('bans');
  const limits = db.collection('limits');
  const meta = db.collection('meta');
  let salt = null;
  let indexed = false;
  const ensure = async () => {
    if (indexed) return;
    indexed = true;
    await Promise.all([
      scores.createIndex({ id: 1 }, { unique: true }),
      scores.createIndex({ level: 1, hidden: 1, ...RANK_SORT }),
      maps.createIndex({ id: 1 }, { unique: true }),
      maps.createIndex({ code: 1 }),
      maps.createIndex({ hidden: 1, date: -1 }),
      maps.createIndex({ hidden: 1, plays: -1, date: -1 }),
      visits.createIndex({ day: 1, ipHash: 1 }, { unique: true }),
      visits.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }),
      bans.createIndex({ ipHash: 1 }, { unique: true }),
      limits.createIndex({ k: 1, at: 1 }),
      limits.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((e) => console.error('Índices:', e.message));
  };
  const visibleQ = (level) => ({ level, hidden: { $ne: true } });

  return {
    kind: 'mongo',
    async salt() {
      if (salt) return salt;
      await ensure();
      const doc = await meta.findOne({ _id: 'salt' });
      if (doc) return (salt = doc.value);
      const value = randomBytes(16).toString('hex');
      // si dos funciones arrancan a la vez, gana la primera que lo escriba
      await meta.updateOne({ _id: 'salt' }, { $setOnInsert: { value } }, { upsert: true });
      return (salt = (await meta.findOne({ _id: 'salt' })).value);
    },
    // cuenta un intento; devuelve true si ya se ha pasado del máximo en la ventana
    async hit(key, max, windowS) {
      const now = new Date();
      await limits.insertOne({ k: key, at: now, exp: new Date(now.getTime() + windowS * 1000) });
      const n = await limits.countDocuments({ k: key, at: { $gt: new Date(now.getTime() - windowS * 1000) } });
      return n > max;
    },
    async isBanned(ipHash) { return !!(await bans.findOne({ ipHash })); },
    async visit(ipHash) {
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      await visits.updateOne(
        { day, ipHash },
        { $inc: { n: 1 }, $set: { last: now.toISOString(), exp: new Date(now.getTime() + VISIT_DAYS * 864e5) }, $setOnInsert: { first: now.toISOString() } },
        { upsert: true },
      );
    },
    async top(level, limit) {
      const [total, list] = await Promise.all([
        scores.countDocuments(visibleQ(level)),
        scores.find(visibleQ(level)).sort(RANK_SORT).limit(limit).toArray(),
      ]);
      return { total, scores: list.map(strip) };
    },
    async rankOf(entry) {
      // puesto = cuántas visibles del mapa van por delante + 1
      const ahead = await scores.countDocuments({
        ...visibleQ(entry.level),
        $or: [
          { wave: { $gt: entry.wave } },
          { wave: entry.wave, kills: { $gt: entry.kills } },
          { wave: entry.wave, kills: entry.kills, time: { $lt: entry.time } },
          { wave: entry.wave, kills: entry.kills, time: entry.time, date: { $lt: entry.date } },
        ],
      });
      return { rank: ahead + 1, total: await scores.countDocuments(visibleQ(entry.level)) };
    },
    async add(entry) { await scores.insertOne({ ...entry }); },
    // mapas de la comunidad
    maps: {
      async list(sort, limit) {
        const q = { hidden: { $ne: true } };
        await ensure();
        const [total, list] = await Promise.all([
          maps.countDocuments(q),
          maps.find(q).sort(sort === 'popular' ? { plays: -1, date: -1 } : { date: -1 }).limit(limit).toArray(),
        ]);
        return { total, maps: list.map(strip) };
      },
      async get(id) { return strip(await maps.findOne({ id })); },
      async byCode(code) { return strip(await maps.findOne({ code })); },
      async add(m) { await maps.insertOne({ ...m }); },
      async play(id) { await maps.updateOne({ id }, { $inc: { plays: 1 } }); },
    },
  };
}

// Conexión a Atlas reutilizada entre llamadas (las funciones de Vercel se quedan «calientes» un rato)
export async function mongoStoreFromEnv() {
  if (globalThis.__tfgMongo) return globalThis.__tfgMongo;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta la variable MONGODB_URI');
  globalThis.__tfgMongo = (async () => {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
    await client.connect();
    return createMongoStore(client.db(process.env.MONGODB_DB || 'tfg3d'));
  })().catch((e) => { globalThis.__tfgMongo = null; throw e; });
  return globalThis.__tfgMongo;
}
