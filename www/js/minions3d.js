// Esbirros en 3D (fase 5). Los 30 aspectos originales se agrupan en 9 arquetipos
// low-poly. Cada pieza de cada arquetipo es UN InstancedMesh: todos los esbirros
// de ese tipo se dibujan juntos (pocas llamadas de dibujo, apto para móvil).
import * as THREE from 'three';
import { Builder } from './util.js';

const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Cyl = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const Cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const W = 0xffffff; // blanco = se tiñe con el color del aspecto

// Aspecto de cada sprite: arquetipo + color principal (c1) y secundario (c2)
export const SKINS = {
  minions: [
    { a: 'hooded', c1: 0x2a4a4a, c2: 0xc83030 }, // 0 encapuchado alas rojas
    { a: 'skeleton', c1: 0xeee6d0, c2: 0x8a3030 }, // 1 esqueleto
    { a: 'ghost', c1: 0x3a3440, c2: 0xb070ff }, // 2 sombra de ojos morados
    { a: 'ogre', c1: 0xc8a070, c2: 0x6a5040 }, // 3 ogro
    { a: 'gargoyle', c1: 0x4a9a3a, c2: 0x2a6a2a }, // 4 gárgola verde
    { a: 'demon', c1: 0xe0602a, c2: 0x5a2a1a }, // 5 demonio de fuego
    { a: 'imp', c1: 0xe8e0d0, c2: 0xd8b860 }, // 6 elfo de pelo blanco
    { a: 'hooded', c1: 0x283a6a, c2: 0x283a6a, noWings: true }, // 7 segador
    { a: 'demon', c1: 0xd8702a, c2: 0x8a6a2a }, // 8 rey cornudo de fuego
    { a: 'imp', c1: 0x8aa098, c2: 0x5a4a3a }, // 9 elfo zombi
    { a: 'gargoyle', c1: 0x4a8ad0, c2: 0x2a4a8a, noWings: true }, // 10 gato azul
    { a: 'skeleton', c1: 0x9ad0c0, c2: 0x2a5a5a }, // 11 necrófago
    { a: 'gargoyle', c1: 0x3a6aa0, c2: 0x1a3a6a }, // 12 gárgola azul
    { a: 'imp', c1: 0x3a2a30, c2: 0xc8302a, wings: true }, // 13 demonio alado
    { a: 'imp', c1: 0x2a4a4a, c2: 0x5ac080 }, // 14 elfo demonio
  ],
  hell: [
    { a: 'hooded', c1: 0x2a4a4a, c2: 0xc83030 },
    { a: 'skeleton', c1: 0xeee6d0, c2: 0x8a3030 },
    { a: 'flameskull', c1: 0x4affff, c2: 0x4affff },
    { a: 'flameskull', c1: 0xffa040, c2: 0xffa040 },
    { a: 'flameskull', c1: 0xb04aff, c2: 0xb04aff },
    { a: 'bateye', c1: 0x2a2a2e, c2: 0xc83030 },
    { a: 'bateye', c1: 0x3a9a8a, c2: 0xd8d040 },
    { a: 'bateye', c1: 0x8a9a3a, c2: 0xd84a7a },
    { a: 'bateye', c1: 0x9a8a9a, c2: 0x7ac040 },
    { a: 'bateye', c1: 0xd8602a, c2: 0xd8d040 },
    { a: 'bateye', c1: 0x9a4ad0, c2: 0xd84aa0 },
    { a: 'bateye', c1: 0xa82a2a, c2: 0x8a2a2a },
    { a: 'bateye', c1: 0xd8d8d8, c2: 0xd0d0d0 },
    { a: 'flameskull', c1: 0x4a8aff, c2: 0x4a8aff },
    { a: 'demon', c1: 0xe0602a, c2: 0x5a2a1a },
  ],
};

// ── Construcción de piezas ──────────────────────────────────
// Cada pieza: geometría relativa a su pivote, material, tinte (0 = c1, 1 = c2, null = fijo)
const geo = (fn) => { const b = new Builder(); fn(b); return b.geometry(); };

const legPair = (h = 1.0, w = 0.32, col = W, tint = 0) => [-1, 1].map((s) => ({
  name: `leg${s}`, tint, pivot: [s * 0.28, h, 0],
  geo: geo((b) => { b.add(Box(w, h, w * 1.1), col, { y: -h / 2 }); b.add(Box(w * 1.1, 0.16, w * 1.6), col, { y: -h + 0.08, z: 0.08 }); }),
  anim: (o, t, ph, sp) => { o.rx = Math.sin(ph) * 0.6 * s * sp; },
}));
const armPair = (y, x, len = 0.9, w = 0.26, tint = 0) => [-1, 1].map((s) => ({
  name: `arm${s}`, tint, pivot: [s * x, y, 0],
  geo: geo((b) => b.add(Box(w, len, w), W, { y: -len / 2 })),
  anim: (o, t, ph, sp) => { o.rx = -Math.sin(ph) * 0.5 * s * sp; o.rz = s * 0.15; },
}));
const wingPair = (y, x, span, tint = 1, flap = 9) => [-1, 1].map((s) => ({
  name: `wing${s}`, tint, thin: true, pivot: [s * x, y, -0.1],
  geo: geo((b) => {
    const g = new THREE.BufferGeometry();
    const p = [0, 0, 0, s * span, span * 0.35, -0.2, s * span * 0.8, -span * 0.25, -0.3, 0, 0, 0, s * span * 0.8, -span * 0.25, -0.3, s * span * 0.3, -span * 0.35, -0.2];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    b.add(g, W);
  }),
  anim: (o, t) => { o.rz = s * Math.sin(t * flap) * 0.6; o.ry = -s * 0.3; },
}));

const ARCH = {
  bateye: {
    height: 2.6,
    parts: [
      { name: 'body', tint: 0, pivot: [0, 1.6, 0], geo: geo((b) => { b.add(Ico(0.9, 1), W, { jitter: 0.05 }); b.add(Cone(0.18, 0.5, 4), W, { y: 0.95 }); }), anim: (o, t) => { o.py = Math.sin(t * 3) * 0.2; } },
      { name: 'eye', tint: null, pivot: [0, 1.65, 0.62], geo: geo((b) => { b.add(Ico(0.5, 1), 0xf4f0e8, { sz: 0.45 }); b.add(Ico(0.26, 1), 0xd8b020, { z: 0.16, sz: 0.4 }); b.add(Ico(0.12, 0), 0x101010, { z: 0.25, sz: 0.4 }); }), anim: (o, t) => { o.py = Math.sin(t * 3) * 0.2; } },
      { name: 'teeth', tint: null, pivot: [0, 1.1, 0.62], geo: geo((b) => { for (let i = -2; i <= 2; i++) b.add(Cone(0.08, 0.22, 4), 0xffffff, { x: i * 0.16, rx: Math.PI, z: 0.05 - Math.abs(i) * 0.04 }); }), anim: (o, t) => { o.py = Math.sin(t * 3) * 0.2; } },
      ...wingPair(1.8, 0.7, 1.6, 1, 14).map((w) => ({ ...w, anim: (o, t) => { o.rz = (w.name === 'wing1' ? 1 : -1) * Math.sin(t * 14) * 0.7; o.ry = (w.name === 'wing1' ? -0.3 : 0.3); o.py = Math.sin(t * 3) * 0.2; } })),
    ],
    fly: true,
  },
  flameskull: {
    height: 2.8,
    parts: [
      { name: 'skull', tint: null, pivot: [0, 1.3, 0], geo: geo((b) => { b.add(Ico(0.6, 1), 0xf2ead8, { sy: 0.9 }); b.add(Box(0.6, 0.28, 0.5), 0xe8dcc0, { y: -0.5, z: 0.1 }); for (const s of [-1, 1]) b.add(Box(0.2, 0.2, 0.1), 0x201010, { x: s * 0.22, y: 0.02, z: 0.55 }); }), anim: (o, t) => { o.py = Math.sin(t * 2.5) * 0.15; } },
      { name: 'eyes', tint: null, glow: true, pivot: [0, 1.32, 0.6], geo: geo((b) => { for (const s of [-1, 1]) b.add(Ico(0.07, 0), 0xff2020, { x: s * 0.22 }); }), anim: (o, t) => { o.py = Math.sin(t * 2.5) * 0.15; } },
      { name: 'flame', tint: 0, glow: true, pivot: [0, 1.6, -0.1], geo: geo((b) => { b.add(Cone(0.55, 1.6, 6), W, { y: 0.6 }); b.add(Cone(0.3, 1.1, 5), W, { y: 0.9, x: 0.25 }); b.add(Cone(0.3, 1.0, 5), W, { y: 0.8, x: -0.28 }); }), anim: (o, t, ph) => { o.sy = 0.85 + Math.sin(t * 12 + ph) * 0.2; o.py = Math.sin(t * 2.5) * 0.15; } },
    ],
    fly: true,
  },
  skeleton: {
    height: 2.9,
    parts: [
      ...legPair(1.0, 0.2),
      { name: 'torso', tint: 0, pivot: [0, 1.0, 0], geo: geo((b) => { b.add(Cyl(0.12, 0.12, 0.6, 5), W, { y: 0.3 }); for (let i = 0; i < 3; i++) b.add(Box(0.7 - i * 0.08, 0.1, 0.42), W, { y: 0.55 + i * 0.18 }); b.add(Box(0.6, 0.16, 0.35), W, { y: 0.05 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      ...armPair(1.9, 0.42, 0.9, 0.16),
      { name: 'skull', tint: 0, pivot: [0, 2.1, 0], geo: geo((b) => { b.add(Ico(0.38, 1), W, { y: 0.32 }); b.add(Box(0.42, 0.18, 0.36), W, { y: 0.02, z: 0.08 }); for (const s of [-1, 1]) b.add(Box(0.13, 0.13, 0.05), 0x151010, { x: s * 0.14, y: 0.33, z: 0.35 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; o.ry = Math.sin(t * 2) * 0.2; } },
      { name: 'cape', tint: 1, thin: true, pivot: [0, 1.85, -0.25], geo: geo((b) => b.add(Box(0.8, 1.3, 0.04), W, { y: -0.65 })), anim: (o, t, ph) => { o.rx = 0.2 + Math.abs(Math.sin(ph)) * 0.3; } },
    ],
  },
  hooded: {
    height: 3.0,
    parts: [
      { name: 'robe', tint: 0, pivot: [0, 0, 0], geo: geo((b) => { b.add(Cyl(0.45, 0.85, 1.9, 7), W, { y: 0.95, jitter: 0.08 }); b.add(Cone(0.5, 0.9, 6), W, { y: 2.3 }); b.add(Ico(0.48, 0), W, { y: 2.0 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.sin(ph)) * 0.1; o.rz = Math.sin(ph) * 0.05; } },
      { name: 'face', tint: null, pivot: [0, 2.0, 0.33], geo: geo((b) => b.add(Box(0.5, 0.5, 0.12), 0x060606)), anim: (o, t, ph) => { o.py = Math.abs(Math.sin(ph)) * 0.1; } },
      { name: 'eyes', tint: 1, glow: true, pivot: [0, 2.05, 0.41], geo: geo((b) => { for (const s of [-1, 1]) b.add(Ico(0.07, 0), W, { x: s * 0.13 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.sin(ph)) * 0.1; } },
      ...wingPair(1.9, 0.35, 1.4, 1, 7).map((w) => ({ ...w, optional: 'wings' })),
    ],
  },
  ghost: {
    height: 2.8,
    parts: [
      { name: 'body', tint: 0, ghost: true, pivot: [0, 0.4, 0], geo: geo((b) => { b.add(Cone(0.85, 2.0, 7), W, { y: 0.9, rx: Math.PI }); b.add(Ico(0.62, 1), W, { y: 1.85 }); }), anim: (o, t) => { o.py = 0.3 + Math.sin(t * 2) * 0.25; o.rz = Math.sin(t * 1.5) * 0.08; } },
      { name: 'eyes', tint: 1, glow: true, pivot: [0, 2.35, 0.55], geo: geo((b) => { for (const s of [-1, 1]) b.add(Ico(0.13, 0), W, { x: s * 0.22 }); }), anim: (o, t) => { o.py = 0.3 + Math.sin(t * 2) * 0.25; } },
    ],
    fly: true,
  },
  ogre: {
    height: 2.8,
    parts: [
      ...legPair(0.8, 0.42, W, 1),
      { name: 'body', tint: 0, pivot: [0, 0.8, 0], geo: geo((b) => { b.add(Ico(0.85, 1), W, { y: 0.75, sx: 1.1, sz: 0.85, jitter: 0.06 }); b.add(Box(1.3, 0.3, 0.9), 0x5a4030, { y: 0.15 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.1; o.rz = Math.sin(ph) * 0.06; } },
      ...armPair(1.9, 0.85, 1.1, 0.36),
      { name: 'head', tint: 0, pivot: [0, 2.2, 0.1], geo: geo((b) => { b.add(Ico(0.45, 1), W, { y: 0.2 }); b.add(Box(0.5, 0.2, 0.3), W, { y: -0.05, z: 0.25 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.1; } },
      { name: 'tusks', tint: null, pivot: [0, 2.15, 0.45], geo: geo((b) => { for (const s of [-1, 1]) b.add(Cone(0.06, 0.25, 4), 0xf0e8d0, { x: s * 0.16 }); for (const s of [-1, 1]) b.add(Ico(0.05, 0), 0xffc030, { x: s * 0.15, y: 0.25, z: 0.05 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.1; } },
    ],
  },
  gargoyle: {
    height: 2.7,
    parts: [
      ...legPair(0.7, 0.3),
      { name: 'body', tint: 0, pivot: [0, 0.7, 0], geo: geo((b) => { b.add(Box(0.9, 1.0, 0.7), W, { y: 0.5, rx: 0.25, jitter: 0.06 }); b.add(Box(0.5, 0.15, 0.6), W, { y: -0.05, z: -0.4 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.sin(ph)) * 0.15; } },
      ...armPair(1.5, 0.55, 0.8, 0.22),
      { name: 'head', tint: 0, pivot: [0, 1.75, 0.2], geo: geo((b) => { b.add(Box(0.6, 0.55, 0.6), W, { y: 0.25 }); b.add(Box(0.42, 0.25, 0.3), W, { y: 0.12, z: 0.38 }); for (const s of [-1, 1]) b.add(Cone(0.08, 0.45, 4), W, { x: s * 0.24, y: 0.65, rz: -s * 0.4 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.sin(ph)) * 0.15; } },
      { name: 'eyes', tint: null, glow: true, pivot: [0, 2.08, 0.51], geo: geo((b) => { for (const s of [-1, 1]) b.add(Ico(0.06, 0), 0xffd030, { x: s * 0.15 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.sin(ph)) * 0.15; } },
      ...wingPair(1.5, 0.35, 1.3, 1, 6).map((w) => ({ ...w, optional: 'gwings' })),
    ],
  },
  demon: {
    height: 2.9,
    parts: [
      ...legPair(0.9, 0.3, W, 1),
      { name: 'body', tint: 0, pivot: [0, 0.9, 0], geo: geo((b) => { b.add(Box(0.95, 0.95, 0.6), W, { y: 0.5, jitter: 0.06 }); b.add(Box(1.0, 0.18, 0.62), 0x3a1a10, { y: 0.05 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      ...armPair(1.75, 0.6, 0.85, 0.26),
      { name: 'head', tint: 0, pivot: [0, 1.95, 0], geo: geo((b) => { b.add(Box(0.55, 0.55, 0.5), W, { y: 0.27 }); for (const s of [-1, 1]) b.add(Cone(0.09, 0.5, 4), 0x2a1a14, { x: s * 0.25, y: 0.7, rz: -s * 0.5 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      { name: 'fire', tint: null, glow: true, pivot: [0, 2.6, -0.1], geo: geo((b) => { b.add(Cone(0.4, 0.9, 6), 0xff8a2a, { y: 0.35 }); b.add(Cone(0.22, 0.6, 5), 0xffd04a, { y: 0.3, x: 0.2 }); }), anim: (o, t, ph) => { o.sy = 0.8 + Math.sin(t * 13 + ph) * 0.25; o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      { name: 'eyes', tint: null, glow: true, pivot: [0, 2.25, 0.26], geo: geo((b) => { for (const s of [-1, 1]) b.add(Ico(0.06, 0), 0xffe040, { x: s * 0.13 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
    ],
  },
  imp: {
    height: 2.8,
    parts: [
      ...legPair(0.95, 0.24, W, 1),
      { name: 'body', tint: 1, pivot: [0, 0.95, 0], geo: geo((b) => b.add(Box(0.7, 0.85, 0.42), W, { y: 0.42, jitter: 0.05 })), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      ...armPair(1.7, 0.45, 0.8, 0.18),
      { name: 'head', tint: 0, pivot: [0, 1.85, 0], geo: geo((b) => { b.add(Box(0.5, 0.52, 0.48), W, { y: 0.26 }); for (const s of [-1, 1]) b.add(Cone(0.08, 0.35, 4), W, { x: s * 0.32, y: 0.32, rz: -s * 1.2 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      { name: 'hair', tint: 1, pivot: [0, 2.2, -0.08], geo: geo((b) => { b.add(Box(0.6, 0.22, 0.58), W, { y: 0.08 }); b.add(Box(0.6, 0.6, 0.18), W, { y: -0.2, z: -0.25 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      { name: 'eyes', tint: null, glow: true, pivot: [0, 2.13, 0.25], geo: geo((b) => { for (const s of [-1, 1]) b.add(Ico(0.05, 0), 0xff4040, { x: s * 0.12 }); }), anim: (o, t, ph) => { o.py = Math.abs(Math.cos(ph)) * 0.08; } },
      ...wingPair(1.6, 0.3, 1.2, 1, 7).map((w) => ({ ...w, optional: 'wings' })),
    ],
  },
};

const MAX = 48;
const _m = new THREE.Matrix4();
const _l = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();

export class MinionRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mats = {
      solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }),
      thin: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      ghost: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.72, depthWrite: false }),
    };
    this.meshes = {};
    for (const [name, arch] of Object.entries(ARCH)) {
      this.meshes[name] = arch.parts.map((p) => {
        const mat = p.glow ? this.mats.glow : p.ghost ? this.mats.ghost : p.thin ? this.mats.thin : this.mats.solid;
        const m = new THREE.InstancedMesh(p.geo, mat, MAX);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
        m.count = 0;
        m.frustumCulled = false;
        m.castShadow = !p.glow && !p.ghost;
        m.visible = false;
        scene.add(m);
        return m;
      });
    }
    this.o = {};
  }

  heightOf(skin) { return ARCH[skin.a].height; }
  flies(skin) { return !!ARCH[skin.a].fly; }

  begin() { for (const list of Object.values(this.meshes)) for (const m of list) m.count = 0; }

  // Añade un esbirro: posición, orientación, escala, tiempo, fase de paso, tinte de estado, caída (0..1)
  // y brazos en alto para cargar algo (0..1; lo usa la animación del ataúd)
  add(skin, pos, yaw, scale, t, ph, tint, die = 0, carry = 0) {
    const arch = ARCH[skin.a];
    const meshes = this.meshes[skin.a];
    const sp = 1;
    _e.set(die * 1.2, yaw, 0);
    _q.setFromEuler(_e);
    _s.setScalar(scale * (1 - die * 0.6));
    _m.compose(pos, _q, _s);
    arch.parts.forEach((p, i) => {
      if (p.optional === 'wings' && !(skin.wings || (skin.a === 'hooded' && !skin.noWings))) return;
      if (p.optional === 'gwings' && skin.noWings) return;
      const mesh = meshes[i];
      if (mesh.count >= MAX) return;
      const o = this.o;
      o.px = 0; o.py = 0; o.pz = 0; o.rx = 0; o.ry = 0; o.rz = 0; o.sx = 1; o.sy = 1; o.sz = 1;
      p.anim?.(o, t, ph, sp);
      if (carry && p.name && p.name.startsWith('arm')) o.rx += (-Math.PI * 0.9 - o.rx) * carry;
      _e.set(o.rx, o.ry, o.rz);
      _q.setFromEuler(_e);
      _p.set(p.pivot[0] + o.px, p.pivot[1] + o.py, p.pivot[2] + o.pz);
      _s.set(o.sx, o.sy, o.sz);
      _l.compose(_p, _q, _s);
      _l.premultiply(_m);
      mesh.setMatrixAt(mesh.count, _l);
      if (p.tint === 0) _c.set(skin.c1);
      else if (p.tint === 1) _c.set(skin.c2);
      else _c.setRGB(1, 1, 1);
      _c.r *= tint[0]; _c.g *= tint[1]; _c.b *= tint[2];
      mesh.setColorAt(mesh.count, _c);
      mesh.count++;
    });
  }

  end() {
    for (const list of Object.values(this.meshes)) for (const m of list) {
      m.visible = m.count > 0;
      if (m.count) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
  }

  setShadows(on) {
    for (const list of Object.values(this.meshes)) for (const m of list) if (m.material !== this.mats.glow && m.material !== this.mats.ghost) m.castShadow = on;
  }
}
