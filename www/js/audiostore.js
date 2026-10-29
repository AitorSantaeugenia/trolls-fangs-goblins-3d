// Audios propios de los mapas del editor, guardados en IndexedDB (caben archivos grandes).
// Cada registro: { id, blob, name, gain }  (gain iguala su volumen al resto de la música)
const DB = 'tfg3d-audio';
const STORE = 'music';

function open() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

function tx(mode, fn) {
  return open().then((db) => new Promise((ok, ko) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); ok(req?.result); };
    t.onerror = () => { db.close(); ko(t.error); };
  }));
}

export const putAudio = (rec) => tx('readwrite', (s) => s.put(rec));
export const getAudio = (id) => tx('readonly', (s) => s.get(id));
export const delAudio = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {});

// Mide el volumen medio del audio (RMS) y devuelve la ganancia para dejarlo cerca de la música del juego
export async function measureGain(ctx, blob) {
  try {
    const buf = await new Promise((ok, ko) => blob.arrayBuffer().then((b) => ctx.decodeAudioData(b, ok, ko), ko));
    let sum = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i += 16) { sum += d[i] * d[i]; n++; }
    }
    const rmsDb = 10 * Math.log10(sum / Math.max(1, n) + 1e-12);
    // la música del juego está igualada a ≈ −18 LUFS, que en RMS ronda −20 dB; HTMLAudio no puede subir de 1
    return Math.max(0.05, Math.min(1, Math.pow(10, (-20 - rmsDb) / 20)));
  } catch {
    return 1;
  }
}
