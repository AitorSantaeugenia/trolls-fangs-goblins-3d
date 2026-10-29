// Jefes en 3D low-poly con animación procedural (fase 3, modelo híbrido).
// Cada jefe se inspira en su sprite original. Todos miran hacia +z.
import * as THREE from 'three';
import { Builder } from './util.js';

const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Cyl = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const Cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);

// Paletas tomadas de los sprites
const P = {
  d: { body: 0x4f8a3e, belly: 0xc9c25a, wing: 0xb8b84a, wing2: 0x6f9a3a, horn: 0xd8a040, eye: 0xffa020, claw: 0xe0c070 },
  D: { body: 0x26262c, belly: 0x5aa83a, wing: 0x8a3ad0, wing2: 0x5a2290, horn: 0xff8a2a, eye: 0xff2020, claw: 0xff8a2a, bracer: 0x8ab8ff },
  L: { body: 0x8a2a16, belly: 0xff8a2a, wing: 0xd8502a, wing2: 0x7a1a10, horn: 0xffc04a, eye: 0xffe060, claw: 0x2a1a14, lava: 0xffa030 },
  K: { robe: 0x34343c, robe2: 0x22222a, wing: 0x2c3a5a, wing2: 0x1c2438, eye: 0xff2a2a, lava: 0xff7a2a },
  B: { robe: 0x1c1c22, gold: 0xe0b040, gold2: 0xa87a20, cape: 0xc8402a, armor: 0x8a8f9a, eye: 0xffd040 },
  l: { armor: 0x7a3aa0, armor2: 0x4a2266, trim: 0x55d040, horn: 0x9a9a98, cape: 0xa82a2a, eye: 0x7dff4a },
  q: { skin: 0xf2c8a8, hair: 0xc8302a, outfit: 0x7a3a9a, outfit2: 0x4a2266, horn: 0x8a6aa8, eye: 0xff4a6a, wing: 0x6a2a7a },
  S: { armor: 0xe8eef4, armor2: 0xb8c8d8, stripe: 0x2a7ad0, dark: 0x1a2030, gold: 0xf0c040, cloth: 0x7a2a3a, eye: 0x6ad8ff },
};

export function makeMats() {
  return {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, metalness: 0.1 }),
    thin: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
}

// Añade a `parent` una malla construida con un Builder
export function part(parent, mat, fn, pos) {
  const b = new Builder();
  fn(b);
  const m = b.mesh(mat);
  m.castShadow = true;
  if (pos) m.position.set(...pos);
  parent.add(m);
  return m;
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// Membrana de ala (abanico de triángulos) con hueso en el borde
function wingGeo(span, depth) {
  const pts = [[0, 0, 0], [span * 0.45, span * 0.28, -depth * 0.1], [span, span * 0.05, -depth * 0.35], [span * 0.82, -span * 0.22, -depth * 0.75], [span * 0.5, -span * 0.25, -depth], [span * 0.18, -span * 0.12, -depth * 0.8]];
  const pos = [];
  for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
function addWings(root, mats, pal, x, y, z, span, depth) {
  const wings = [];
  for (const side of [1, -1]) {
    const w = group(root, side * x, y, z);
    w.scale.x = side;
    part(w, mats.thin, (b) => {
      b.add(wingGeo(span, depth), pal.wing, { jitter: 0.12 });
      b.add(Cyl(0.08, 0.12, span * 0.55, 5), pal.wing2, { rz: -Math.PI / 2 + 0.55, x: span * 0.22, y: span * 0.14 });
      b.add(Cyl(0.06, 0.1, span * 0.6, 5), pal.wing2, { rz: -Math.PI / 2 + 0.05, x: span * 0.72, y: span * 0.18 });
    });
    wings.push(w);
  }
  return wings;
}
export function addTail(root, mats, color, tipColor, y, z, n = 5, len = 0.7, r = 0.32) {
  const segs = [];
  let parent = group(root, 0, y, z);
  for (let i = 0; i < n; i++) {
    const s = group(parent, 0, 0, i === 0 ? 0 : -len);
    const rr = r * (1 - i / (n + 1));
    part(s, mats.solid, (b) => b.add(Cyl(rr * 0.8, rr, len, 6), i === n - 1 ? tipColor : color, { rx: Math.PI / 2, z: -len / 2 }));
    if (i === n - 1) part(s, mats.solid, (b) => b.add(Cone(rr * 1.6, 0.6, 4), tipColor, { rx: -Math.PI / 2, z: -len - 0.2 }));
    segs.push(s);
    parent = s;
  }
  return segs;
}

// ── Cuerpo humanoide articulado (jefes que caminan) ─────────
export function humanoid(root, mats, c, o = {}) {
  const k = o.bulk || 1;
  const rig = {};
  const hips = group(root, 0, 2.2, 0);
  rig.hips = hips;
  rig.legs = [];
  if (!o.noLegs) {
    for (const side of [-1, 1]) {
      const leg = group(hips, side * 0.4 * k, 0, 0);
      part(leg, mats.solid, (b) => b.add(Box(0.48 * k, 1.1, 0.52 * k), c.leg, { y: -0.55, jitter: 0.08 }));
      const knee = group(leg, 0, -1.1, 0);
      part(knee, mats.solid, (b) => {
        b.add(Box(0.44 * k, 1.0, 0.5 * k), c.shin ?? c.leg, { y: -0.5, jitter: 0.08 });
        b.add(Box(0.52 * k, 0.22, 0.8 * k), c.foot ?? c.leg, { y: -1.0, z: 0.14 });
        if (c.claw) for (const cx of [-0.15, 0.15]) b.add(Cone(0.08, 0.28, 4), c.claw, { x: cx * k, y: -1.05, z: 0.6 * k, rx: Math.PI / 2 });
      });
      rig.legs.push({ leg, knee });
    }
  }
  const torso = group(hips, 0, 0, 0);
  rig.torso = torso;
  part(torso, mats.solid, (b) => {
    b.add(Box(1.05 * k, 0.75, 0.62 * k), c.belly ?? c.body, { y: 0.4, jitter: 0.06 });
    b.add(Box(1.45 * k, 1.0, 0.85 * k), c.body, { y: 1.2, jitter: 0.06 });
    if (c.belly) for (let i = 0; i < 3; i++) b.add(Box(0.9 * k, 0.14, 0.1), c.belly, { y: 0.3 + i * 0.3, z: 0.42 * k });
    if (c.belt) b.add(Box(1.15 * k, 0.2, 0.7 * k), c.belt, { y: 0.05 });
  });
  rig.arms = [];
  for (const side of [-1, 1]) {
    const arm = group(torso, side * 0.9 * k, 1.5, 0);
    part(arm, mats.solid, (b) => {
      b.add(Box(0.42 * k, 0.9, 0.44 * k), c.arm ?? c.body, { y: -0.45, jitter: 0.08 });
      if (c.pauldron) b.add(new THREE.SphereGeometry(0.42 * k, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), c.pauldron, { y: 0.05, sx: 1.2 });
      if (c.spike) b.add(Cone(0.12, 0.5, 4), c.spike, { y: 0.4, x: side * 0.15 });
    });
    const elbow = group(arm, 0, -0.9, 0);
    part(elbow, mats.solid, (b) => {
      b.add(Box(0.38 * k, 0.85, 0.4 * k), c.forearm ?? c.arm ?? c.body, { y: -0.42, jitter: 0.08 });
      b.add(Box(0.38 * k, 0.34, 0.38 * k), c.hand ?? c.forearm ?? c.body, { y: -0.98 });
      if (c.claw) for (const cx of [-0.12, 0.12]) b.add(Cone(0.07, 0.3, 4), c.claw, { x: cx, y: -1.25 });
    });
    rig.arms.push({ arm, elbow, side });
  }
  const head = group(torso, 0, 1.75, 0);
  rig.head = head;
  return rig;
}

export function eyes(parent, mats, color, y, z, gap = 0.17, r = 0.08) {
  part(parent, mats.glow, (b) => {
    for (const s of [-1, 1]) b.add(Ico(r, 0), color, { x: s * gap, y, z });
  });
}

// ── Constructores por jefe ──────────────────────────────────
const BUILD = {
  // Dragón: wyvern esbelto verde de alas amarillas
  d(root, m) {
    const c = P.d;
    const body = group(root, 0, 2.6, 0);
    part(body, m.solid, (b) => {
      b.add(Ico(1, 1), c.body, { sx: 0.75, sy: 0.65, sz: 1.5, jitter: 0.08 });
      b.add(Ico(0.8, 0), c.belly, { y: -0.3, z: 0.3, sx: 0.6, sy: 0.4, sz: 1.1 });
      for (let i = 0; i < 4; i++) b.add(Cone(0.12, 0.4, 4), c.horn, { y: 0.6, z: 0.9 - i * 0.55 });
    });
    const neck = group(body, 0, 0.3, 1.3);
    neck.rotation.x = -0.5;
    part(neck, m.solid, (b) => b.add(Cyl(0.25, 0.4, 1.4, 6), c.body, { rx: Math.PI / 2, z: 0.6 }));
    const head = group(neck, 0, 0, 1.4);
    head.rotation.x = 0.5;
    part(head, m.solid, (b) => {
      b.add(Box(0.6, 0.5, 0.8), c.body, { jitter: 0.08 });
      b.add(Box(0.42, 0.32, 0.7), c.body, { z: 0.65, y: -0.08 });
      for (const s of [-1, 1]) b.add(Cone(0.1, 0.7, 4), c.horn, { x: s * 0.2, y: 0.3, z: -0.45, rx: -2.3 });
    });
    eyes(head, m, c.eye, 0.12, 0.38, 0.2);
    const wings = addWings(body, m, c, 0.45, 0.35, 0.3, 3.4, 2.2);
    const tail = addTail(body, m, c.body, c.horn, 0, -1.4, 6, 0.6, 0.3);
    const legs = [];
    for (const s of [-1, 1]) legs.push(part(body, m.solid, (b) => b.add(Box(0.22, 0.7, 0.3), c.body, { y: -0.55 }), [s * 0.4, -0.3, -0.2]));
    return { kind: 'fly', body, wings, tail, head, flap: 7, liftY: 2.6, mouth: head };
  },

  // Dragón Mayor: hombre-dragón negro, vientre verde, alas moradas
  D(root, m) {
    const c = { ...P.D, leg: P.D.body, arm: P.D.body, forearm: P.D.body, hand: P.D.body, belly: P.D.belly, claw: P.D.claw };
    const rig = humanoid(root, m, c, { bulk: 1.05 });
    part(rig.head, m.solid, (b) => {
      b.add(Box(0.7, 0.6, 0.75), c.body, { y: 0.3, jitter: 0.08 });
      b.add(Box(0.5, 0.36, 0.6), c.body, { y: 0.2, z: 0.6 });
      for (const s of [-1, 1]) {
        b.add(Cone(0.12, 0.8, 4), c.horn, { x: s * 0.3, y: 0.8, z: -0.1, rz: s * -0.4 });
        b.add(Cone(0.1, 0.55, 4), c.horn, { x: s * 0.42, y: 0.55, z: -0.25, rz: s * -1.0 });
      }
    });
    eyes(rig.head, m, c.eye, 0.42, 0.38, 0.2);
    for (const a of rig.arms) part(a.elbow, m.solid, (b) => b.add(Cone(0.14, 1.4, 4), c.bracer, { y: -0.4, z: -0.25, x: a.side * 0.12, rx: Math.PI }));
    const wings = addWings(rig.torso, m, c, 0.4, 1.4, -0.35, 3.2, 2.0);
    const tail = addTail(rig.hips, m, c.body, c.horn, 0.1, -0.35, 5, 0.6, 0.3);
    return { kind: 'walkfly', rig, wings, tail, flap: 4.5, liftY: 1.2, mouth: rig.head };
  },

  // Señor Dragón: hombre-dragón de lava, alas rojas, corona de cuernos
  L(root, m) {
    const c = { ...P.L, leg: P.L.body, arm: P.L.body, belly: P.L.belly, claw: P.L.claw, pauldron: P.L.wing2, spike: P.L.horn };
    const rig = humanoid(root, m, c, { bulk: 1.15 });
    part(rig.head, m.solid, (b) => {
      b.add(Box(0.8, 0.65, 0.8), c.body, { y: 0.32, jitter: 0.1 });
      b.add(Box(0.55, 0.38, 0.6), c.body, { y: 0.22, z: 0.62 });
      for (let i = -2; i <= 2; i++) b.add(Cone(0.12, 0.7 + (2 - Math.abs(i)) * 0.3, 4), c.horn, { x: i * 0.17, y: 0.9 + (2 - Math.abs(i)) * 0.12, z: -0.1, rz: -i * 0.18 });
    });
    eyes(rig.head, m, c.eye, 0.45, 0.42, 0.2, 0.09);
    // grietas de lava que brillan
    part(rig.torso, m.glow, (b) => {
      for (let i = 0; i < 5; i++) b.add(Box(0.08, 0.5, 0.05), c.lava, { x: -0.5 + i * 0.25, y: 1.1 + (i % 2) * 0.2, z: 0.45, rz: (i - 2) * 0.3 });
    });
    const wings = addWings(rig.torso, m, c, 0.45, 1.5, -0.4, 3.8, 2.4);
    const tail = addTail(rig.hips, m, c.body, c.lava, 0.1, -0.4, 6, 0.6, 0.34);
    return { kind: 'walkfly', rig, wings, tail, flap: 3.5, liftY: 1.2, mouth: rig.head, fire: true };
  },

  // Rey: segador encapuchado sobre una túnica, enormes alas de murciélago
  K(root, m) {
    const c = P.K;
    const body = group(root, 0, 0.4, 0);
    part(body, m.solid, (b) => {
      b.add(Cyl(0.7, 1.4, 2.8, 8), c.robe, { y: 1.4, jitter: 0.1 });
      b.add(Box(1.5, 1.0, 0.9), c.robe, { y: 3.0, jitter: 0.08 });
      b.add(Cone(0.75, 1.5, 7), c.robe2, { y: 4.1 });
      b.add(Box(0.7, 0.75, 0.2), 0x050506, { y: 3.85, z: 0.38 });
      for (const s of [-1, 1]) b.add(Box(0.35, 1.5, 0.4), c.robe2, { x: s * 0.95, y: 2.5, rz: s * 0.15 });
    });
    eyes(body, m, c.eye, 3.9, 0.5, 0.15, 0.08);
    part(body, m.glow, (b) => { for (let i = 0; i < 4; i++) b.add(Box(0.06, 0.6, 0.05), c.lava, { x: -0.45 + i * 0.3, y: 1.2 + (i % 2) * 0.5, z: 0.95 - (i % 2) * 0.15 }); });
    const wings = addWings(body, m, c, 0.55, 3.0, -0.4, 4.2, 2.8);
    return { kind: 'hover', body, wings, flap: 2.6, liftY: 0.5 };
  },

  // Gran Lord: capucha negra sin rostro, corona y armadura doradas, capa roja
  B(root, m) {
    const c = { body: P.B.gold2, leg: P.B.armor, arm: P.B.robe, forearm: P.B.gold, hand: P.B.gold, belt: P.B.gold, pauldron: P.B.gold, spike: P.B.gold };
    const rig = humanoid(root, m, c, { bulk: 1.1 });
    part(rig.torso, m.solid, (b) => b.add(Box(1.7, 0.4, 1.0), P.B.gold, { y: 1.55 }));
    part(rig.head, m.solid, (b) => {
      b.add(Cyl(0.55, 0.7, 1.0, 8), P.B.robe, { y: 0.45, jitter: 0.08 });
      b.add(Box(0.6, 0.6, 0.15), 0x030304, { y: 0.4, z: 0.55 });
      b.add(Cyl(0.62, 0.62, 0.18, 10), P.B.gold, { y: 0.95 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.add(Cone(0.1, 0.55, 4), P.B.gold, { x: Math.cos(a) * 0.55, y: 1.25, z: Math.sin(a) * 0.55 });
      }
    });
    eyes(rig.head, m, P.B.eye, 0.42, 0.6, 0.15, 0.06);
    const cape = group(rig.torso, 0, 1.6, -0.5);
    part(cape, m.thin, (b) => {
      b.add(Box(1.8, 2.6, 0.06), P.B.robe, { y: -1.3 });
      b.add(Box(1.9, 0.6, 0.07), P.B.cape, { y: -2.5 });
    });
    const staff = group(rig.arms[1].elbow, 0, -1, 0.1);
    part(staff, m.solid, (b) => { b.add(Cyl(0.06, 0.06, 3.2, 5), P.B.gold2, { y: 0.4 }); b.add(Ico(0.25, 0), P.B.gold, { y: 2.05 }); });
    return { kind: 'walk', rig, cape };
  },

  // Lord: caballero morado y verde con grandes cuernos y capa roja
  l(root, m) {
    const c = { body: P.l.armor, leg: P.l.armor2, shin: P.l.armor, arm: P.l.armor2, forearm: P.l.armor, belly: P.l.armor2, belt: P.l.trim, pauldron: P.l.armor, spike: P.l.horn };
    const rig = humanoid(root, m, c);
    part(rig.torso, m.glow, (b) => { b.add(Box(0.9, 0.1, 0.05), P.l.trim, { y: 1.05, z: 0.44 }); b.add(Box(0.1, 0.7, 0.05), P.l.trim, { y: 0.6, z: 0.33 }); });
    part(rig.head, m.solid, (b) => {
      b.add(Box(0.8, 0.85, 0.8), P.l.horn, { y: 0.4, jitter: 0.06 });
      b.add(Box(0.85, 0.2, 0.85), P.l.armor2, { y: 0.1 });
      for (const s of [-1, 1]) {
        b.add(Cyl(0.14, 0.3, 1.6, 5), P.l.horn, { x: s * 0.95, y: 0.85, rz: s * 1.2 });
        b.add(Cyl(0.06, 0.15, 1.0, 5), P.l.horn, { x: s * 1.65, y: 1.45, rz: s * 0.35 });
      }
    });
    part(rig.head, m.glow, (b) => b.add(Box(0.6, 0.12, 0.05), P.l.eye, { y: 0.48, z: 0.42 }));
    const cape = group(rig.torso, 0, 1.6, -0.48);
    part(cape, m.thin, (b) => b.add(Box(1.6, 2.7, 0.06), P.l.cape, { y: -1.35 }));
    const sword = group(rig.arms[1].elbow, 0, -1, 0.15);
    sword.rotation.x = Math.PI / 2;
    part(sword, m.solid, (b) => { b.add(Box(0.12, 1.9, 0.04), 0xd8dde4, { y: 1.1 }); b.add(Box(0.6, 0.1, 0.12), P.l.trim, { y: 0.15 }); });
    return { kind: 'walk', rig, cape };
  },

  // Reina: melena roja, cuernos morados, alas pequeñas y capa
  q(root, m) {
    const c = { body: P.q.outfit, leg: P.q.skin, shin: P.q.outfit2, arm: P.q.skin, forearm: P.q.outfit, hand: P.q.skin, belly: P.q.skin, belt: P.q.outfit2 };
    const rig = humanoid(root, m, c, { bulk: 0.85 });
    part(rig.head, m.solid, (b) => {
      b.add(Box(0.72, 0.78, 0.7), P.q.skin, { y: 0.4 });
      b.add(Ico(0.62, 0), P.q.hair, { y: 0.55, z: -0.35, sx: 1.25, sy: 1.1, jitter: 0.1 });
      b.add(Box(1.25, 1.7, 0.4), P.q.hair, { y: -0.3, z: -0.5, jitter: 0.12 });
      for (const s of [-1, 1]) b.add(Box(0.25, 1.3, 0.5), P.q.hair, { x: s * 0.48, y: -0.05, z: -0.05, jitter: 0.12 });
      b.add(Box(0.8, 0.2, 0.25), P.q.hair, { y: 0.8, z: 0.22 });
      for (const s of [-1, 1]) b.add(Cyl(0.05, 0.16, 0.9, 5), P.q.horn, { x: s * 0.5, y: 0.95, z: -0.1, rz: s * -0.6 });
      b.add(Cone(0.12, 0.45, 4), P.q.horn, { y: 0.98, z: 0.15 });
    });
    eyes(rig.head, m, P.q.eye, 0.42, 0.36, 0.16, 0.06);
    const wings = addWings(rig.torso, m, { wing: P.q.wing, wing2: P.q.outfit2 }, 0.35, 1.3, -0.35, 2.0, 1.3);
    const cape = group(rig.torso, 0, 1.5, -0.42);
    part(cape, m.thin, (b) => b.add(Box(1.3, 2.3, 0.05), P.q.outfit2, { y: -1.15 }));
    return { kind: 'walk', rig, wings, cape, flap: 5 };
  },

  // Señor de las Nieves: armadura blanca voluminosa, tocado a rayas azules
  S(root, m) {
    const c = { body: P.S.armor, leg: P.S.armor, shin: P.S.armor2, arm: P.S.armor, forearm: P.S.armor2, belly: P.S.armor2, belt: P.S.gold };
    const rig = humanoid(root, m, c, { bulk: 1.35 });
    part(rig.torso, m.solid, (b) => {
      b.add(Cyl(0.9, 1.0, 0.25, 10), P.S.gold, { y: 1.65 });
      b.add(Box(0.6, 1.2, 0.08), P.S.cloth, { y: -0.4, z: 0.45 });
      for (const s of [-1, 1]) {
        b.add(Box(0.95, 0.85, 1.05), P.S.armor, { x: s * 1.2, y: 1.75, jitter: 0.05 });
        for (let i = 0; i < 3; i++) b.add(Box(0.98, 0.1, 1.08), i % 2 ? P.S.dark : P.S.stripe, { x: s * 1.2, y: 1.5 + i * 0.25 });
      }
    });
    part(rig.head, m.solid, (b) => {
      b.add(Box(0.85, 0.85, 0.85), P.S.armor, { y: 0.4, jitter: 0.05 });
      b.add(Cone(0.3, 0.6, 4), P.S.armor2, { y: 0.25, z: 0.6, rx: Math.PI / 2 });
      // tocado (nemes) a rayas
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) b.add(Box(0.25, 0.14, 0.7), i % 2 ? P.S.dark : P.S.stripe, { x: s * 0.6, y: 0.75 - i * 0.22, z: -0.05, rz: s * 0.15 });
      b.add(Box(1.0, 0.18, 0.9), P.S.stripe, { y: 0.9 });
    });
    eyes(rig.head, m, P.S.eye, 0.5, 0.44, 0.2, 0.08);
    part(rig.torso, m.glow, (b) => { for (const s of [-1, 1]) b.add(new THREE.OctahedronGeometry(0.3), 0x9feaff, { x: s * 1.25, y: 1.9, sy: 1.8 }); });
    return { kind: 'walk', rig };
  },
};

const tmpBox = new THREE.Box3();

export function createBoss(code) {
  const mats = makeMats();
  const root = new THREE.Group();
  const inner = new THREE.Group(); // inclinación al morir
  root.add(inner);
  const rig = BUILD[code](inner, mats);
  tmpBox.setFromObject(inner);
  const height = tmpBox.max.y - Math.min(0, tmpBox.min.y);
  let phase = Math.random() * 6;

  const api = {
    group: root,
    inner,
    height,
    liftY: rig.liftY || 0,
    flying: rig.kind === 'fly' || rig.kind === 'walkfly',
    mats,
    mouth: rig.mouth,
    fire: rig.fire,
    // tinte (golpe, congelado, envenenado) en todas las piezas
    tint(r, g, b) {
      mats.solid.color.setRGB(r, g, b);
      mats.thin.color.setRGB(r, g, b);
    },
    update(dt, t, speedMul = 1) {
      phase += dt * 5.5 * speedMul;
      const s = Math.sin(phase);
      if (rig.wings) {
        const f = Math.sin(t * (rig.flap || 4) + phase * 0.1);
        rig.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (f * 0.55 - 0.1); w.rotation.y = (i ? 1 : -1) * 0.25; });
      }
      if (rig.tail) rig.tail.forEach((seg, i) => { seg.rotation.y = Math.sin(t * 2.5 - i * 0.7) * 0.22; seg.rotation.x = Math.sin(t * 1.7 - i * 0.5) * 0.08; });
      if (rig.cape) rig.cape.rotation.x = 0.15 + Math.abs(s) * 0.25 + Math.sin(t * 3) * 0.05;
      const r = rig.rig;
      if (r) {
        const flyingNow = rig.kind === 'walkfly';
        r.legs.forEach((l, i) => {
          const sw = flyingNow ? 0.25 + Math.sin(t * 2 + i) * 0.1 : (i ? s : -s) * 0.55;
          l.leg.rotation.x = sw;
          l.knee.rotation.x = flyingNow ? 0.6 : Math.max(0, (i ? -s : s)) * 0.7;
        });
        r.arms.forEach((a, i) => {
          a.arm.rotation.x = (i ? -s : s) * 0.45;
          a.arm.rotation.z = a.side * 0.12;
          a.elbow.rotation.x = -0.35;
        });
        r.torso.rotation.y = s * 0.06;
        r.hips.position.y = 2.2 + (flyingNow ? 0 : Math.abs(Math.cos(phase)) * 0.12);
        r.head.rotation.y = Math.sin(t * 0.8) * 0.15;
      }
      if (rig.body && rig.kind === 'fly') { rig.body.rotation.z = Math.sin(t * 1.3) * 0.08; }
      if (rig.body && rig.kind === 'hover') { rig.body.position.y = 0.4 + Math.sin(t * 1.6) * 0.2; }
    },
    // k: 0 → 1 durante la muerte (cae hacia delante y se hunde)
    die(k) {
      inner.rotation.x = Math.min(1, k * 1.6) * 1.45;
      inner.position.y = -Math.max(0, k - 0.55) * height * 0.6;
    },
    dispose() {
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      Object.values(mats).forEach((mm) => mm.dispose());
    },
  };
  return api;
}

export const BOSS_COLORS = {
  d: 0x7ac04a, D: 0x8a3ad0, L: 0xff7a2a, K: 0x3a4a7a, B: 0xe0b040, l: 0x8a3aa0, q: 0xc8302a, S: 0x9feaff,
};
