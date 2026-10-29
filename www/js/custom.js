// Mapas propios (editor): guardado, registro como niveles jugables y códigos para compartir
import { LEVELS, WAVES } from './config.js';
import { Path } from './sim.js';
import { save } from './save.js';
import { delAudio } from './audiostore.js';

export const BIOME_INFO = {
  meadow: { label: 'Pradera', tile: 'grass', music: 'musicbg', minions: 'minions', color: '#8f5c35', path: '#6fb43a' },
  spooky: { label: 'Cementerio', tile: 'stone', music: 'twistedTreelineSong', minions: 'minions', color: '#4b321e', path: '#a8a8a0' },
  desert: { label: 'Desierto', tile: 'stone', music: 'powerofthehordeSong', minions: 'minions', color: '#e4c088', path: '#c8b090' },
  snow: { label: 'Glaciar', tile: 'iceBox', music: 'musicbg', minions: 'minions', color: '#d8e5f1', path: '#9cc8ee' },
  hell: { label: 'Infierno', tile: 'lava', music: 'powerofthehordeSong', minions: 'hell', color: '#3b1c16', path: '#ff6a1a' },
};
export const PRESETS = ['easy', 'normal', 'desert', 'hard', 'hell'];

// Música de los mapas propios. Por defecto el tema libre, compuesto para el juego.
// Las pistas «original» vienen del juego original y no son de uso libre.
export const MUSIC = [
  { id: 'goblinMarch', label: 'Marcha del Goblin (tema libre)' },
  { id: 'musicbg', label: 'Pradera (música original)' },
  { id: 'twistedTreelineSong', label: 'Cementerio (música original)' },
  { id: 'powerofthehordeSong', label: 'La Horda (música original)' },
  { id: 'none', label: 'Sin música' },
  { id: 'custom', label: 'Mi propio audio…' },
];
export const DEFAULT_MUSIC = 'goblinMarch';
const SHAREABLE = new Set(MUSIC.map((m) => m.id).filter((id) => id !== 'custom'));

// Sitio libre para la hoguera, lo más lejos posible del camino
function campfireFor(pathPx) {
  const p = new Path(pathPx);
  let best = [600, 650], bd = -1;
  for (let x = 100; x <= 1100; x += 50) for (let y = 60; y <= 640; y += 40) {
    const d = p.distanceTo((x - 600) / 10, (y - 350) / 10);
    if (d > 6 && d < 14 && d > bd) { bd = d; best = [x, y]; }
  }
  return best;
}

// Convierte un mapa guardado en un nivel jugable y lo registra
export function registerMap(m) {
  const preset = LEVELS[m.preset] || LEVELS.normal;
  const B = BIOME_INFO[m.biome] || BIOME_INFO.meadow;
  LEVELS[m.id] = {
    id: m.id,
    custom: true,
    label: 'Mío',
    name: m.name || 'Mapa sin nombre',
    hp: m.hp,
    gold: m.gold,
    path: m.path,
    tile: B.tile,
    music: m.music === 'custom' ? `custom:${m.id}` : SHAREABLE.has(m.music) ? m.music : DEFAULT_MUSIC,
    biome: m.biome,
    campfire: campfireFor(m.path),
    minions: B.minions,
    thumb: m.thumb || '',
    towerScale: 1.25,
    unitScale: 1.1,
    hpMult: preset.hpMult,
    hpGrowth: preset.hpGrowth,
    endlessGrowth: preset.endlessGrowth,
    preset: m.preset,
  };
  WAVES[m.id] = WAVES[m.preset] || WAVES.normal;
}

export function customMaps() {
  return save.data.customMaps || [];
}

export function registerAll() {
  for (const m of customMaps()) registerMap(m);
}

export function upsertMap(m) {
  const list = customMaps().filter((x) => x.id !== m.id);
  list.push(m);
  save.data.customMaps = list;
  save.write();
  registerMap(m);
}

export function deleteMap(id) {
  save.data.customMaps = customMaps().filter((x) => x.id !== id);
  save.write();
  delAudio(id);
  delete LEVELS[id];
  delete WAVES[id];
}

// Validación del camino: empieza en el borde izquierdo, acaba en el derecho, tramos rectos
export function validatePath(path) {
  if (path.length < 2) return 'Dibuja al menos un tramo.';
  if (path[0][0] !== 0) return 'El camino tiene que empezar en el borde izquierdo.';
  if (path[path.length - 1][0] !== 1200) return 'El camino tiene que terminar en el borde derecho (el castillo).';
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    if (a[0] !== b[0] && a[1] !== b[1]) return 'Los tramos deben ser horizontales o verticales.';
  }
  return null;
}

// Código para compartir: "TFG1:" + base64 de un JSON compacto
export function exportCode(m) {
  // el audio propio no viaja en el código: quien lo cargue oirá el tema libre
  const data = { n: m.name, b: m.biome, h: m.hp, g: m.gold, w: m.preset, m: SHAREABLE.has(m.music) ? m.music : DEFAULT_MUSIC, p: m.path.map(([x, y]) => [x / 50, y / 50]) };
  const json = JSON.stringify(data);
  return 'TFG1:' + btoa(unescape(encodeURIComponent(json)));
}

export function importCode(code) {
  const c = (code || '').trim();
  if (!c.startsWith('TFG1:')) throw new Error('El código debe empezar por TFG1:');
  const d = JSON.parse(decodeURIComponent(escape(atob(c.slice(5)))));
  const m = {
    id: `custom_${Date.now().toString(36)}`,
    name: String(d.n || 'Mapa importado').slice(0, 40),
    biome: BIOME_INFO[d.b] ? d.b : 'meadow',
    hp: Math.max(1, Math.min(99, d.h | 0 || 20)),
    gold: Math.max(100, Math.min(5000, d.g | 0 || 600)),
    preset: PRESETS.includes(d.w) ? d.w : 'normal',
    music: SHAREABLE.has(d.m) ? d.m : DEFAULT_MUSIC,
    path: (d.p || []).map(([x, y]) => [Math.round(x) * 50, Math.round(y) * 50]),
  };
  const why = validatePath(m.path);
  if (why) throw new Error(why);
  return m;
}
