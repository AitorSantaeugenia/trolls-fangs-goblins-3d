// Vista previa de un mapa propio o de la comunidad (sin el editor): fondo del bioma, camino con su sombra,
// entrada y castillo. Mismas medidas que el editor (mapa de 1200 × 700 px, camino de 40 px de ancho).
import { BIOME_INFO } from './custom.js';

const HALF = 20;

export function paintMap(g, map, k) {
  const B = BIOME_INFO[map.biome] || BIOME_INFO.meadow;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = B.color;
  g.fillRect(0, 0, 1200, 700);
  // algo de textura para que no sea un color plano
  // (manchas repartidas al azar, pero siempre igual para el mismo mapa)
  let seed = 7;
  for (const [x, y] of map.path || []) seed = (seed * 31 + x * 7 + y * 13) % 2147483647;
  seed = seed || 1;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)';
    g.beginPath(); g.arc(rnd() * 1200, rnd() * 700, 10 + rnd() * 34, 0, Math.PI * 2); g.fill();
  }
  const path = map.path || [];
  const rect = (a, b, h, col) => {
    g.fillStyle = col;
    g.fillRect(Math.min(a[0], b[0]) - h, Math.min(a[1], b[1]) - h, Math.abs(a[0] - b[0]) + 2 * h, Math.abs(a[1] - b[1]) + 2 * h);
  };
  for (let i = 1; i < path.length; i++) rect(path[i - 1], path[i], HALF + 6, 'rgba(0,0,0,.35)');
  for (let i = 1; i < path.length; i++) rect(path[i - 1], path[i], HALF, B.path);
  if (path.length) {
    // cueva de entrada y castillo
    const [, y0] = path[0];
    g.fillStyle = '#2a1c14';
    g.beginPath(); g.ellipse(0, y0, 42, 54, 0, -Math.PI / 2, Math.PI / 2); g.fill();
    const [, y1] = path[path.length - 1];
    g.fillStyle = '#7a6a5a';
    g.fillRect(1150, y1 - 56, 50, 112);
    g.fillStyle = '#5a4a3e';
    for (let i = 0; i < 4; i++) g.fillRect(1150 + i * 14, y1 - 70, 9, 16);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// Imagen JPEG del mapa (para las tarjetas); w = ancho en píxeles
export function mapThumb(map, w = 300) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.round(w * 700 / 1200);
  paintMap(c.getContext('2d'), map, w / 1200);
  return c.toDataURL('image/jpeg', 0.8);
}
