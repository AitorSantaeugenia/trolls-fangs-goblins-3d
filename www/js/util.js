import * as THREE from 'three';

// ── Aleatorio con semilla ────────────────────────────────────
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  r.range = (a, b) => a + r() * (b - a);
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}

// ── Ruido de valor 2D suave (para el terreno) ────────────────
export function makeNoise(seed = 7) {
  const r = rng(seed);
  const P = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const V = new Float32Array(256).map(() => r() * 2 - 1);
  const fade = (t) => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = V[P[(P[xi & 255] + yi) & 511] & 255];
    const b = V[P[(P[(xi + 1) & 255] + yi) & 511] & 255];
    const c = V[P[(P[xi & 255] + yi + 1) & 511] & 255];
    const d = V[P[(P[(xi + 1) & 255] + yi + 1) & 511] & 255];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 3) => {
    let f = 1, amp = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += n2(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

// ── Constructor de mallas low-poly con colores por vértice ───
// Junta muchas piezas en UNA sola geometría (1 draw call).
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Builder {
  constructor() {
    this.parts = [];
  }
  add(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    const sc = o.s ?? 1;
    _s.set((o.sx ?? 1) * sc, (o.sy ?? 1) * sc, (o.sz ?? 1) * sc);
    _m.compose(_p, _q, _s);
    if (o.matrix) _m.premultiply(o.matrix);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    const jit = o.jitter || 0;
    // Color por cara (3 vértices) con ligera variación → aspecto low-poly
    for (let i = 0; i < n; i += 3) {
      const k = jit ? 1 + (Math.random() - 0.5) * jit : 1;
      for (let v = 0; v < 3; v++) {
        col[(i + v) * 3] = _c.r * k;
        col[(i + v) * 3 + 1] = _c.g * k;
        col[(i + v) * 3 + 2] = _c.b * k;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }
  geometry() {
    let total = 0;
    for (const g of this.parts) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    let o = 0;
    for (const g of this.parts) {
      pos.set(g.attributes.position.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    this.parts = [];
    return geo;
  }
  mesh(material) {
    return new THREE.Mesh(this.geometry(), material);
  }
}

export const lowpolyMat = (opts = {}) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.05, ...opts });

// Textura de brillo radial (para halos, sombras, partículas)
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
