// Mapas de la comunidad: comprobación en el servidor del código TFG1 que genera el editor
// (www/js/custom.js → exportCode) y de los datos con los que se publica.
// Las listas tienen que coincidir con las del juego (BIOME_INFO, PRESETS y MUSIC de custom.js).
export const BIOMES = { meadow: 'Pradera', spooky: 'Cementerio', desert: 'Desierto', snow: 'Glaciar', hell: 'Infierno' };
export const PRESETS = ['easy', 'normal', 'desert', 'hard', 'hell'];
const MUSIC = ['goblinMarch', 'musicbg', 'twistedTreelineSong', 'powerofthehordeSong', 'none'];
const GRID_W = 24; // el mapa mide 1200 × 700 px y el código guarda la cuadrícula de 50 en 50
const GRID_H = 14;
export const MAP_PUBLIC = ['id', 'name', 'author', 'desc', 'code', 'biome', 'preset', 'hp', 'gold', 'turns', 'date', 'plays'];

const clean = (s, max) => (typeof s === 'string' ? s.normalize('NFC').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max) : '');

// Lee y comprueba un código «TFG1:…». Devuelve { map } o { error }
export function decodeMapCode(code) {
  if (typeof code !== 'string') return { error: 'Falta el código del mapa.' };
  const c = code.trim();
  if (!c.startsWith('TFG1:')) return { error: 'El código debe empezar por TFG1:' };
  if (c.length > 6000) return { error: 'El código es demasiado largo.' };
  let d;
  try { d = JSON.parse(Buffer.from(c.slice(5), 'base64').toString('utf8')); } catch { return { error: 'El código no es válido (¿está completo?).' }; }
  if (!d || typeof d !== 'object' || !Array.isArray(d.p)) return { error: 'El código no es válido.' };
  const p = d.p;
  if (p.length < 2 || p.length > 120) return { error: 'El camino del mapa no es válido.' };
  for (const pt of p) {
    if (!Array.isArray(pt) || pt.length !== 2 || !Number.isInteger(pt[0]) || !Number.isInteger(pt[1]) || pt[0] < 0 || pt[0] > GRID_W || pt[1] < 0 || pt[1] > GRID_H) return { error: 'El camino se sale del mapa.' };
  }
  if (p[0][0] !== 0) return { error: 'El camino tiene que empezar en el borde izquierdo.' };
  if (p[p.length - 1][0] !== GRID_W) return { error: 'El camino tiene que terminar en el castillo (borde derecho).' };
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1], p[i]];
    if (a[0] !== b[0] && a[1] !== b[1]) return { error: 'Los tramos del camino deben ser horizontales o verticales.' };
  }
  const map = {
    name: clean(d.n, 40) || 'Mapa sin nombre',
    biome: BIOMES[d.b] ? d.b : 'meadow',
    hp: Math.max(1, Math.min(99, d.h | 0 || 20)),
    gold: Math.max(100, Math.min(5000, d.g | 0 || 600)),
    preset: PRESETS.includes(d.w) ? d.w : 'normal',
    music: MUSIC.includes(d.m) ? d.m : 'goblinMarch',
    turns: p.length - 2,
  };
  return { map, canonical: c };
}

// Datos de una publicación: código + nombre, nick y descripción
export function validateMapPost(b) {
  if (!b || typeof b !== 'object') return { error: 'Datos no válidos.' };
  const dec = decodeMapCode(b.code);
  if (dec.error) return dec;
  const author = clean(b.author, 20);
  if (!author) return { error: 'Escribe tu nick (hasta 20 caracteres).' };
  const name = clean(b.name, 40) || dec.map.name;
  const desc = clean(b.desc, 400);
  return { ok: { name, author, desc, code: dec.canonical, biome: dec.map.biome, preset: dec.map.preset, hp: dec.map.hp, gold: dec.map.gold, turns: dec.map.turns } };
}
