import * as THREE from 'three';
import { Builder, lowpolyMat, radialTexture } from './util.js';

const C = (r, h, s = 8, rt) => new THREE.CylinderGeometry(rt ?? r, r, h, s);
const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);

let _glowTex = null;
export const glowTexture = () => (_glowTex ||= radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64));

export function glowSprite(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  s.scale.set(size, size, 1);
  return s;
}

const flameMat = (color) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
});

function spikesRing(b, n, radius, y, color, h = 0.45, r = 0.13) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.add(Cone(r, h, 5), color, { x: Math.cos(a) * radius, y: y + h / 2, z: Math.sin(a) * radius });
  }
}
function pillars(b, n, radius, y0, h, color, r = 0.14, offset = Math.PI / 4) {
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * Math.PI * 2;
    b.add(C(r, h, 6), color, { x: Math.cos(a) * radius, y: y0 + h / 2, z: Math.sin(a) * radius });
  }
}

// Pequeñas gemas doradas que indican el nivel de mejora
function levelPips(group, matGold) {
  const pips = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), matGold);
    const a = Math.PI / 2 + (i - 1) * 0.5;
    m.position.set(Math.cos(a) * 1.72, 0.45, Math.sin(a) * 1.72);
    m.visible = i === 0;
    group.add(m);
    pips.push(m);
  }
  return pips;
}

const shared = {};
function mats() {
  if (shared.lp) return shared;
  shared.lp = lowpolyMat();
  shared.gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0x6a4500, metalness: 0.6, roughness: 0.35, flatShading: true });
  shared.ice = new THREE.MeshStandardMaterial({ color: 0xaef0ff, emissive: 0x2ab8ff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
  shared.flameA = flameMat(0xff7a1a);
  shared.flameB = flameMat(0xffd04a);
  return shared;
}

// ── Torres ──────────────────────────────────────────────────
// Cada torre devuelve { group, head, muzzle(Vector3 local), update(dt,time), fire(), setLevel(n) }
export function createTower(type) {
  const M = mats();
  const group = new THREE.Group();
  const api = { group, head: null, recoil: 0, fireT: 0 };
  const b = new Builder();

  if (type === 'sand') {
    b.add(C(1.75, 0.5, 8, 1.6), 0x8e8a80, { y: 0.25, jitter: 0.12 });
    b.add(C(1.55, 0.3, 8, 1.45), 0xb8743a, { y: 0.65, jitter: 0.1 });
    // calaveras decorativas en la base (como el dibujo original)
    for (const a of [0.6, 2.2, 3.8, 5.4]) {
      b.add(new THREE.IcosahedronGeometry(0.18, 0), 0xeee6cc, { x: Math.cos(a) * 1.62, y: 0.33, z: Math.sin(a) * 1.62 });
    }
    pillars(b, 4, 1.08, 0.8, 2.1, 0x4a3220);
    b.add(C(0.95, 0.55, 8, 1.4), 0xd0702e, { y: 2.65, jitter: 0.1 });
    b.add(C(1.5, 0.45, 10), 0xb5652a, { y: 3.12, jitter: 0.12 });
    b.add(C(0.7, 0.48, 8), 0x3a2416, { y: 3.13 });
    spikesRing(b, 7, 1.15, 3.33, 0xd8d8d0);
    group.add(b.mesh(M.lp));
    // Cabezal giratorio: pequeño cañón
    const head = new THREE.Group();
    head.position.y = 1.55;
    const hb = new Builder();
    hb.add(new THREE.DodecahedronGeometry(0.42, 0), 0x6b4a2a, {});
    hb.add(C(0.15, 1.1, 6, 0.2), 0x2f2f33, { rx: Math.PI / 2, z: 0.55, y: 0.05 });
    hb.add(C(0.24, 0.16, 6), 0xc9a34a, { rx: Math.PI / 2, z: 1.05, y: 0.05 });
    head.add(hb.mesh(M.lp));
    group.add(head);
    api.head = head;
    api.barrel = head.children[0];
    api.muzzle = new THREE.Vector3(0, 1.6, 1.1);
  }

  if (type === 'catapult') {
    b.add(C(1.8, 0.6, 8, 1.65), 0x7d7970, { y: 0.3, jitter: 0.12 });
    b.add(C(1.6, 0.2, 8), 0x5f5b55, { y: 0.7 });
    group.add(b.mesh(M.lp));
    const head = new THREE.Group();
    head.position.y = 0.8;
    const hb = new Builder();
    hb.add(Box(2.1, 0.22, 2.3), 0x6b4423, { y: 0.11, jitter: 0.1 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) hb.add(C(0.32, 0.18, 8), 0x3b2a1a, { rz: Math.PI / 2, x: sx * 1.12, y: 0.15, z: sz * 0.75 });
      hb.add(Box(0.18, 1.7, 0.2), 0x7a5230, { x: sx * 0.7, y: 1.05, z: 0.1, rx: -0.12 });
      hb.add(Box(0.16, 1.4, 0.16), 0x5c3c22, { x: sx * 0.7, y: 0.85, z: -0.45, rx: 0.5 });
    }
    hb.add(C(0.08, 1.6, 6), 0x2c2c2c, { rz: Math.PI / 2, y: 1.75, z: 0.1 });
    hb.add(Box(1.2, 0.2, 0.2), 0x7a5230, { y: 1.35, z: 0.85 }); // tope
    head.add(hb.mesh(M.lp));
    // Brazo con cazo y roca
    const arm = new THREE.Group();
    arm.position.set(0, 1.75, 0.1);
    const ab = new Builder();
    ab.add(Box(0.2, 0.2, 2.6), 0x8a5c33, { z: -0.9 });
    ab.add(C(0.38, 0.28, 7, 0.25), 0x5c3c22, { z: -2.15, y: 0.18 });
    ab.add(Box(0.6, 0.5, 0.5), 0x4a4a4a, { z: 0.45, y: -0.2 }); // contrapeso
    arm.add(ab.mesh(M.lp));
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), M.lp.clone());
    rock.material.vertexColors = false;
    rock.material.color.set(0x9a9a9a);
    rock.position.set(0, 0.42, -2.15);
    arm.add(rock);
    head.add(arm);
    group.add(head);
    api.head = head;
    api.arm = arm;
    api.rock = rock;
    arm.rotation.x = -0.35;
    api.muzzle = new THREE.Vector3(0, 3.6, 0.6);
  }

  if (type === 'slow') {
    b.add(C(1.6, 0.5, 6, 1.4), 0xc9d1d8, { y: 0.25, jitter: 0.08 });
    b.add(C(1.25, 0.3, 6, 1.1), 0x5f7a94, { y: 0.65, jitter: 0.08 });
    pillars(b, 3, 0.85, 0.8, 2.7, 0x8a6b4b, 0.12, 0);
    b.add(C(0.95, 0.25, 6), 0x3b4a66, { y: 3.55 });
    b.add(new THREE.TorusGeometry(0.85, 0.11, 4, 10, Math.PI), 0x2d3a55, { y: 3.7, rx: 0, rz: 0 });
    b.add(new THREE.TorusGeometry(0.85, 0.11, 4, 10, Math.PI), 0x2d3a55, { y: 3.7, ry: Math.PI / 2 });
    b.add(Cone(0.3, 0.6, 5), 0xb7ecff, { y: 4.05 });
    group.add(b.mesh(M.lp));
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), M.ice);
      const a = (i / 3) * Math.PI * 2 + 0.5;
      s.position.set(Math.cos(a) * 1.25, 0.95, Math.sin(a) * 1.25);
      s.scale.y = 1.8;
      group.add(s);
    }
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), M.ice);
    crystal.scale.y = 1.5;
    crystal.position.y = 2.15;
    group.add(crystal);
    const glow = glowSprite(0x6fdcff, 3.2, 0.55);
    glow.position.y = 2.15;
    group.add(glow);
    api.crystal = crystal;
    api.glow = glow;
    api.muzzle = new THREE.Vector3(0, 2.15, 0);
  }

  if (type === 'flame') {
    b.add(C(1.75, 0.45, 8, 1.6), 0x6d7178, { y: 0.22, jitter: 0.1 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(Box(0.95, 1.25, 0.38), 0x7a3f4b, { x: Math.cos(a) * 1.02, z: Math.sin(a) * 1.02, y: 1.05, ry: -a + Math.PI / 2, jitter: 0.12 });
    }
    b.add(C(0.62, 0.45, 8, 0.42), 0x2b2b2b, { y: 1.75 });
    pillars(b, 4, 1.05, 1.65, 1.7, 0x3d2b1f, 0.13);
    b.add(C(1.48, 0.42, 10), 0x9a5a2c, { y: 3.45, jitter: 0.1 });
    b.add(C(0.75, 0.44, 8), 0x2a1a10, { y: 3.46 });
    spikesRing(b, 7, 1.15, 3.66, 0xd8d8d0);
    group.add(b.mesh(M.lp));
    const flames = [];
    const fg = new THREE.Group();
    fg.position.y = 2.0;
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(Cone(0.36 - i * 0.07, 1.1 - i * 0.15, 5), i % 2 ? M.flameB : M.flameA);
      f.position.set((i - 1) * 0.18, 0.5, (i % 2) * 0.12);
      fg.add(f);
      flames.push(f);
    }
    group.add(fg);
    const glow = glowSprite(0xff7a2a, 4, 0.7);
    glow.position.y = 2.5;
    group.add(glow);
    api.flames = flames;
    api.glow = glow;
    api.muzzle = new THREE.Vector3(0, 2.6, 0);
  }

  if (type === 'double') {
    // Base gris con anillo naranja de pinchos y dos cañones gemelos (como doubleBarrel.png)
    b.add(C(1.75, 0.55, 8, 1.6), 0x6f747a, { y: 0.27, jitter: 0.1 });
    b.add(C(1.5, 0.2, 8), 0x575b61, { y: 0.65 });
    group.add(b.mesh(M.lp));
    const head = new THREE.Group();
    head.position.y = 0.75;
    const hb = new Builder();
    for (const sx of [-1, 1]) hb.add(C(0.2, 1.6, 6), 0x5f6670, { x: sx * 0.75, y: 0.8 });
    hb.add(C(1.45, 0.42, 12, 1.5), 0xd27a2a, { y: 1.75, jitter: 0.1 });
    spikesRing(hb, 8, 1.3, 1.95, 0xd8d8d0, 0.4, 0.11);
    hb.add(C(0.55, 0.35, 8), 0x3b3f45, { y: 2.1 });
    head.add(hb.mesh(M.lp));
    const barrels = [];
    for (const sx of [-1, 1]) {
      const bg = new THREE.Group();
      bg.position.set(sx * 0.36, 2.35, 0);
      const bb = new Builder();
      bb.add(C(0.2, 1.5, 7, 0.24), 0x2c2f35, { rx: Math.PI / 2, z: 0.55 });
      bb.add(C(0.27, 0.18, 7), 0xc9a34a, { rx: Math.PI / 2, z: 1.28 });
      bg.add(bb.mesh(M.lp));
      head.add(bg);
      barrels.push(bg);
    }
    group.add(head);
    api.head = head;
    api.barrels = barrels;
    api.barrelRecoil = [0, 0];
    api.shot = 0;
    api.muzzle = new THREE.Vector3(0, 3.1, 1.3);
  }

  if (type === 'heavy') {
    // Base de piedra clara con pinchos, dos columnas de hierro y un mortero pesado (heavyTurret.png)
    b.add(C(1.85, 0.7, 8, 1.7), 0xd4cdb0, { y: 0.35, jitter: 0.08 });
    spikesRing(b, 8, 1.45, 0.7, 0x4a4f5a, 0.5, 0.14);
    for (const a of [0.4, 1.9, 3.5, 5.0]) b.add(Box(0.35, 0.18, 0.08), 0x6b6550, { x: Math.cos(a) * 1.82, y: 0.3, z: Math.sin(a) * 1.82, ry: -a + Math.PI / 2 });
    for (const sx of [-1, 1]) b.add(C(0.28, 1.9, 7), 0x8a9098, { x: sx * 0.95, y: 1.65 });
    group.add(b.mesh(M.lp));
    const head = new THREE.Group();
    head.position.y = 2.7;
    const hb = new Builder();
    hb.add(C(1.4, 0.55, 10, 1.55), 0x2f3a52, { jitter: 0.08 });
    hb.add(C(0.65, 0.2, 10), 0x1c2333, { y: 0.32 });
    for (const sx of [-1, 1]) hb.add(new THREE.SphereGeometry(0.42, 8, 6), 0x3d4a68, { x: sx * 1.35 });
    head.add(hb.mesh(M.lp));
    const mortar = new THREE.Group();
    mortar.position.y = 0.3;
    mortar.rotation.x = -0.55;
    const mb = new Builder();
    mb.add(C(0.5, 1.5, 8, 0.6), 0x1f2633, { y: 0.7 });
    mb.add(C(0.62, 0.2, 8), 0x9aa3b5, { y: 1.45 });
    mortar.add(mb.mesh(M.lp));
    head.add(mortar);
    group.add(head);
    api.head = head;
    api.mortar = mortar;
    api.muzzle = new THREE.Vector3(0, 4.3, 0.6);
  }

  if (type === 'poison') {
    // Torre-caldero con líquido verde burbujeante
    b.add(C(1.7, 0.5, 7, 1.55), 0x5d6355, { y: 0.25, jitter: 0.12 });
    pillars(b, 3, 1.05, 0.5, 1.7, 0x3d2f22, 0.15, 0.3);
    b.add(C(1.15, 1.0, 9, 0.8), 0x2d2f2a, { y: 2.6, jitter: 0.08 });
    b.add(C(1.22, 0.18, 9), 0x45483f, { y: 3.12 });
    for (const a of [0, 2.1, 4.2]) b.add(new THREE.IcosahedronGeometry(0.22, 0), 0xe8e0c8, { x: Math.cos(a) * 1.2, y: 2.7, z: Math.sin(a) * 1.2 });
    b.add(new THREE.IcosahedronGeometry(0.5, 0), 0x2d7a2a, { y: 0.9, sy: 0.6 });
    group.add(b.mesh(M.lp));
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7dff4a, toneMapped: false }));
    liquid.position.y = 3.05;
    group.add(liquid);
    const bubbles = [];
    for (let i = 0; i < 4; i++) {
      const bm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xb8ff7a, toneMapped: false }));
      bm.userData.phase = i * 0.7;
      bm.userData.x = Math.cos(i * 1.7) * 0.5;
      bm.userData.z = Math.sin(i * 1.7) * 0.5;
      group.add(bm);
      bubbles.push(bm);
    }
    const glow = glowSprite(0x7dff4a, 3.4, 0.5);
    glow.position.y = 3.3;
    group.add(glow);
    api.bubbles = bubbles;
    api.glow = glow;
    api.muzzle = new THREE.Vector3(0, 3.3, 0);
  }

  group.traverse((o) => { if (o.isMesh && o.material !== M.flameA && o.material !== M.flameB) { o.castShadow = true; o.receiveShadow = true; } });
  api.pips = levelPips(group, M.gold);

  api.setLevel = (lvl) => {
    api.pips.forEach((p, i) => (p.visible = i < lvl));
    group.userData.levelScale = 1 + (lvl - 1) * 0.08;
  };
  group.userData.levelScale = 1;

  api.aim = (dx, dz) => {
    if (api.head) api.targetYaw = Math.atan2(dx, dz);
  };
  api.fire = () => {
    api.fireT = 1;
    api.recoil = 1;
    if (api.barrels) { api.barrelRecoil[api.shot % 2] = 1; api.shot++; }
  };
  api.update = (dt, t) => {
    if (api.head && api.targetYaw != null) {
      let d = api.targetYaw - api.head.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      api.head.rotation.y += d * Math.min(1, dt * 10);
    }
    if (type === 'sand' && api.barrel) {
      api.recoil = Math.max(0, api.recoil - dt * 6);
      api.barrel.position.z = -api.recoil * 0.25;
    }
    if (type === 'double') {
      api.barrels.forEach((bg, i) => {
        api.barrelRecoil[i] = Math.max(0, api.barrelRecoil[i] - dt * 7);
        bg.position.z = -api.barrelRecoil[i] * 0.3;
      });
    }
    if (type === 'heavy') {
      api.fireT = Math.max(0, api.fireT - dt * 2.5);
      api.mortar.position.y = 0.3 - api.fireT * 0.25;
      api.mortar.scale.y = 1 - api.fireT * 0.12;
    }
    if (type === 'poison') {
      api.bubbles.forEach((bm) => {
        const k = ((t * 0.8 + bm.userData.phase) % 1);
        bm.position.set(bm.userData.x, 3.1 + k * 0.9, bm.userData.z);
        bm.scale.setScalar(1 - k);
      });
      api.fireT = Math.max(0, api.fireT - dt * 4);
      const sg = 3.4 + api.fireT * 1.2 + Math.sin(t * 3) * 0.2;
      api.glow.scale.set(sg, sg, 1);
    }
    if (type === 'catapult') {
      // dispara: el brazo gira hacia delante y vuelve despacio
      if (api.fireT > 0) {
        api.fireT = Math.max(0, api.fireT - dt * 2.2);
        const k = api.fireT;
        api.arm.rotation.x = k > 0.8 ? -0.35 + ((1 - k) / 0.2) * 2.25 : 1.9 - (1 - k / 0.8) * 2.25;
        api.rock.visible = k > 0.85 || k < 0.15;
      } else {
        api.arm.rotation.x = -0.35;
        api.rock.visible = true;
      }
    }
    if (type === 'slow') {
      api.crystal.rotation.y += dt * 1.6;
      api.crystal.position.y = 2.15 + Math.sin(t * 2.2) * 0.15;
      api.glow.position.y = api.crystal.position.y;
      api.fireT = Math.max(0, api.fireT - dt * 4);
      const s = 3.2 + api.fireT * 1.5;
      api.glow.scale.set(s, s, 1);
    }
    if (type === 'flame') {
      api.fireT = Math.max(0, api.fireT - dt * 5);
      api.flames.forEach((f, i) => {
        f.scale.y = 0.8 + Math.sin(t * (9 + i * 3) + i) * 0.2 + Math.random() * 0.15 + api.fireT * 0.4;
        f.rotation.y += dt * (2 + i);
      });
      const s = 4 + Math.sin(t * 13) * 0.3 + api.fireT * 1.2;
      api.glow.scale.set(s, s, 1);
    }
  };
  return api;
}

// Versión "fantasma" de la torre para colocar (verde = se puede, rojo = no)
export function createGhost(type) {
  const api = createTower(type);
  const mat = new THREE.MeshBasicMaterial({ color: 0x5cff7a, transparent: true, opacity: 0.45, depthWrite: false });
  api.group.traverse((o) => {
    if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; }
    if (o.isSprite) o.visible = false;
  });
  api.pips.forEach((p) => (p.visible = false));
  api.setValid = (ok) => mat.color.set(ok ? 0x5cff7a : 0xff4a3a);
  return api;
}

// ── Decorados (se añaden a un Builder compartido = 1 draw call) ──
export const Props = {
  deadTree(b, x, y, z, s = 1, r = Math.random, color = 0x2e2824) {
    const ry = r() * 6.28;
    b.add(C(0.45, 3.2, 5, 0.22), color, { x, y: y + 1.6 * s, z, s, jitter: 0.15 });
    for (let i = 0; i < 4; i++) {
      const a = ry + i * 1.7;
      const h = 1.6 + r() * 1.2;
      b.add(C(0.16, h, 4, 0.05), color, {
        x: x + Math.cos(a) * 0.5 * s, y: y + (2.4 + i * 0.25) * s, z: z + Math.sin(a) * 0.5 * s,
        rx: Math.sin(a) * 0.9, rz: -Math.cos(a) * 0.9, s,
      });
    }
  },
  tree(b, x, y, z, s = 1, r = Math.random, leaf = 0x4f8a2e, trunk = 0x5a3b22) {
    b.add(C(0.35, 2, 5, 0.25), trunk, { x, y: y + 1 * s, z, s });
    b.add(new THREE.IcosahedronGeometry(1.6, 0), leaf, { x, y: y + 2.9 * s, z, s, jitter: 0.25, ry: r() * 3 });
    b.add(new THREE.IcosahedronGeometry(1.1, 0), leaf, { x: x + 0.8 * s, y: y + 2.3 * s, z: z + 0.3 * s, s, jitter: 0.25 });
  },
  pine(b, x, y, z, s = 1, r = Math.random, snow = true) {
    b.add(C(0.3, 1.2, 5), 0x5a3b22, { x, y: y + 0.6 * s, z, s });
    const greens = [0x2f5d46, 0x2a5540, 0x356b4f];
    for (let i = 0; i < 3; i++) {
      const rr = (1.7 - i * 0.45) * s;
      const yy = y + (1.5 + i * 1.1) * s;
      b.add(Cone(rr, 1.7 * s, 7), greens[i], { x, y: yy, z, ry: r() * 3, jitter: 0.12 });
      if (snow) b.add(Cone(rr * 0.6, 0.75 * s, 7), 0xf2f7fb, { x, y: yy + 0.55 * s, z });
    }
  },
  bush(b, x, y, z, s = 1, r = Math.random, color = 0x8fbf2f) {
    for (let i = 0; i < 3; i++) {
      b.add(new THREE.IcosahedronGeometry(0.8 + r() * 0.4, 0), color, {
        x: x + (i - 1) * 0.7 * s, y: y + 0.5 * s, z: z + (r() - 0.5) * 0.6 * s, s, sy: 0.75, jitter: 0.2,
      });
    }
  },
  rock(b, x, y, z, s = 1, r = Math.random, color = 0x8b8f94) {
    b.add(new THREE.DodecahedronGeometry(1, 0), color, {
      x, y: y + 0.4 * s, z, s, sx: 1 + r() * 0.5, sy: 0.6 + r() * 0.5, ry: r() * 6, rx: r() * 0.4, jitter: 0.18,
    });
  },
  mushroom(b, x, y, z, s = 1, r, cap = 0xd84a7a) {
    b.add(C(0.12, 0.45, 5), 0xf3ead8, { x, y: y + 0.22 * s, z, s });
    b.add(new THREE.SphereGeometry(0.32, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), cap, { x, y: y + 0.42 * s, z, s });
  },
  skull(b, x, y, z, s = 1, r = Math.random) {
    const ry = r() * 6;
    b.add(new THREE.IcosahedronGeometry(0.45, 0), 0xf1e6c4, { x, y: y + 0.4 * s, z, s, ry });
    b.add(Box(0.5, 0.25, 0.4), 0xe2d6b0, { x, y: y + 0.12 * s, z, s, ry });
    for (const o of [-0.16, 0.16]) b.add(Box(0.14, 0.14, 0.1), 0x111111, { x: x + Math.cos(ry) * o * s + Math.sin(ry) * 0.4 * s, y: y + 0.42 * s, z: z - Math.sin(ry) * o * s + Math.cos(ry) * 0.4 * s, s });
  },
  bones(b, x, y, z, s = 1, r = Math.random) {
    for (let i = 0; i < 3; i++) b.add(C(0.06, 0.8, 4), 0xeee4c8, { x: x + (r() - 0.5), y: y + 0.07, z: z + (r() - 0.5), rz: Math.PI / 2, ry: r() * 6, s });
  },
  grave(b, x, y, z, s = 1, r = Math.random, color = 0x8a8f96) {
    const ry = (r() - 0.5) * 0.4;
    if (r() < 0.5) {
      b.add(Box(0.9, 1.1, 0.25), color, { x, y: y + 0.55 * s, z, s, ry, rz: (r() - 0.5) * 0.2 });
      b.add(C(0.45, 0.25, 8), color, { x, y: y + 1.1 * s, z, s, rx: Math.PI / 2, ry });
    } else {
      b.add(Box(0.22, 1.6, 0.22), color, { x, y: y + 0.8 * s, z, s, ry });
      b.add(Box(0.9, 0.22, 0.22), color, { x, y: y + 1.15 * s, z, s, ry });
    }
    b.add(Box(1.1, 0.12, 0.6), 0x4a3a2a, { x, y: y + 0.06, z, s, ry });
  },
  stump(b, x, y, z, s = 1) {
    b.add(C(0.75, 0.7, 7, 0.6), 0x7a4a26, { x, y: y + 0.35 * s, z, s, jitter: 0.1 });
    b.add(C(0.6, 0.05, 7), 0xd9b27c, { x, y: y + 0.72 * s, z, s });
  },
  crate(b, x, y, z, s = 1, r = Math.random) {
    b.add(Box(1.2, 1.2, 1.2), 0x8a5a30, { x, y: y + 0.6 * s, z, s, ry: r() * 1.5, jitter: 0.1 });
  },
  sign(b, x, y, z, s = 1) {
    b.add(Box(0.2, 2.2, 0.2), 0x5a3b22, { x, y: y + 1.1 * s, z, s });
    b.add(Box(1.6, 0.5, 0.12), 0x7a5230, { x: x + 0.5 * s, y: y + 1.8 * s, z, s, rz: -0.08 });
    b.add(Cone(0.3, 0.4, 3), 0x7a5230, { x: x + 1.4 * s, y: y + 1.75 * s, z, s, rz: -Math.PI / 2 });
  },
  fence(b, x, y, z, s = 1, r = Math.random, len = 4, ry = 0) {
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (let i = 0; i <= len; i++) b.add(Box(0.18, 1.1, 0.18), 0x4b3a2e, { x: x + c * i * s, y: y + 0.55 * s, z: z - sn * i * s, s });
    b.add(Box(len, 0.12, 0.08), 0x4b3a2e, { x: x + c * len * 0.5 * s, y: y + 0.8 * s, z: z - sn * len * 0.5 * s, ry, s });
  },
  spike(b, x, y, z, s = 1, r = Math.random, color = 0x1d1517) {
    b.add(Cone(0.6, 3 + r() * 2, 5), color, { x, y: y + 1.5 * s, z, s, rx: (r() - 0.5) * 0.3, rz: (r() - 0.5) * 0.3, jitter: 0.2 });
  },
  pumpkin(b, x, y, z, s = 1) {
    b.add(new THREE.SphereGeometry(0.5, 7, 4), 0xe0731e, { x, y: y + 0.4 * s, z, s, sy: 0.75, jitter: 0.08 });
    b.add(C(0.06, 0.25, 4), 0x3a5a1a, { x, y: y + 0.85 * s, z, s });
  },
  cactus(b, x, y, z, s = 1, r = Math.random) {
    const g = r.pick ? r.pick([0x4f8a3e, 0x5a9a48, 0x467a36]) : 0x4f8a3e;
    b.add(C(0.38, 2.6, 7, 0.32), g, { x, y: y + 1.3 * s, z, s, jitter: 0.08 });
    b.add(new THREE.SphereGeometry(0.32, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), g, { x, y: y + 2.6 * s, z, s });
    const ry = r() * 6;
    for (const side of [-1, 1]) {
      if (r() < 0.25) continue;
      const h = 0.8 + r() * 0.6, hy = 1 + r() * 0.6;
      const ax = Math.cos(ry) * side, az = Math.sin(ry) * side;
      b.add(C(0.22, 0.8, 6), g, { x: x + ax * 0.55 * s, y: y + hy * s, z: z + az * 0.55 * s, rz: Math.PI / 2, ry: -ry, s });
      b.add(C(0.2, h, 6, 0.24), g, { x: x + ax * 0.9 * s, y: y + (hy + h / 2) * s, z: z + az * 0.9 * s, s });
    }
    if (r() < 0.4) b.add(Cone(0.18, 0.25, 5), 0xff6a8a, { x, y: y + 2.85 * s, z, s });
  },
  palm(b, x, y, z, s = 1, r = Math.random) {
    const lean = (r() - 0.5) * 0.4;
    for (let i = 0; i < 5; i++) b.add(C(0.24 - i * 0.02, 0.9, 6), i % 2 ? 0x8a6a3a : 0x7a5a30, { x: x + lean * i * 0.9 * s, y: y + (0.45 + i * 0.85) * s, z, rz: -lean, s });
    const tx = x + lean * 4.5 * s, ty = y + 4.4 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + r();
      b.add(Box(2.4, 0.08, 0.6), i % 2 ? 0x5a9a3a : 0x4a8a30, { x: tx + Math.cos(a) * 1.1 * s, y: ty - 0.25 * s, z: z + Math.sin(a) * 1.1 * s, ry: -a, rz: -0.35, s });
    }
    b.add(new THREE.IcosahedronGeometry(0.3, 0), 0x6a4a20, { x: tx, y: ty - 0.3 * s, z, s });
  },
  pyramid(b, x, y, z, s = 1) {
    b.add(new THREE.ConeGeometry(5, 5, 4), 0xd8b070, { x, y: y + 2.5 * s, z, s, ry: Math.PI / 4, jitter: 0.06 });
    b.add(new THREE.ConeGeometry(1, 1, 4), 0xf0d090, { x, y: y + 4.6 * s, z, s, ry: Math.PI / 4 });
  },
  snowman(b, x, y, z, s = 1) {
    b.add(new THREE.IcosahedronGeometry(0.8, 1), 0xf4f8fb, { x, y: y + 0.7 * s, z, s });
    b.add(new THREE.IcosahedronGeometry(0.55, 1), 0xf4f8fb, { x, y: y + 1.7 * s, z, s });
    b.add(Cone(0.08, 0.5, 4), 0xff8a2a, { x, y: y + 1.75 * s, z: z + 0.6 * s, rx: Math.PI / 2, s });
  },
};

// Elementos que brillan (sin iluminación): cristales, lava, faroles
export const GlowProps = {
  crystal(b, x, y, z, s = 1, r = Math.random, color = 0x8fe8ff) {
    for (let i = 0; i < 3; i++) {
      b.add(new THREE.OctahedronGeometry(0.45, 0), color, {
        x: x + (r() - 0.5) * 0.9 * s, y: y + 0.6 * s, z: z + (r() - 0.5) * 0.9 * s, sy: 2 + r(), s, rz: (r() - 0.5) * 0.6,
      });
    }
  },
  lavaPool(b, x, y, z, s = 1, r = Math.random) {
    b.add(new THREE.CircleGeometry(1.4, 7), 0xff6a1a, { x, y: y + 0.03, z, rx: -Math.PI / 2, s, sx: 1 + r() * 0.6 });
    b.add(new THREE.CircleGeometry(0.8, 6), 0xffc04a, { x: x + 0.2 * s, y: y + 0.05, z, rx: -Math.PI / 2, s });
  },
  lantern(b, x, y, z, s = 1) {
    b.add(Box(0.35, 0.4, 0.35), 0xffc861, { x, y: y + 2.05 * s, z, s });
  },
};

export function lanternPost(b, x, y, z, s = 1) {
  b.add(Box(0.16, 2.2, 0.16), 0x2b2b30, { x, y: y + 1.1 * s, z, s });
  b.add(Cone(0.35, 0.35, 4), 0x2b2b30, { x, y: y + 2.42 * s, z, s, ry: Math.PI / 4 });
}

// ── Castillo (meta) ─────────────────────────────────────────
export function createCastle(biome) {
  const pal = {
    meadow: { stone: 0xa59f92, dark: 0x6e695f, roof: 0xb03a2c, banner: 0x2f5fb0 },
    spooky: { stone: 0x5e5b68, dark: 0x3b3944, roof: 0x3f2a5c, banner: 0x2e8b8b },
    snow: { stone: 0xc6d0da, dark: 0x8b98a6, roof: 0x3d6fae, banner: 0xd23a3a, snow: true },
    desert: { stone: 0xd8b880, dark: 0xb8945a, roof: 0x2a8a8a, banner: 0xc8302a },
  }[biome];
  const b = new Builder();
  const W = 10; // ancho (eje z)
  // muralla frontal con puerta (mira hacia -X)
  b.add(Box(3, 6, W), pal.stone, { x: 1.5, y: 3, jitter: 0.08 });
  for (let i = -4; i <= 4; i += 2) b.add(Box(3.2, 0.8, 1), pal.stone, { x: 1.5, y: 6.4, z: i });
  b.add(Box(0.3, 4.2, 4.2), 0x1c140e, { x: -0.05, y: 2.1 }); // hueco de la puerta
  b.add(C(2.1, 0.3, 10, 2.1), pal.stone, { x: -0.05, y: 4.2, rz: Math.PI / 2, sz: 1 });
  b.add(Box(0.15, 3.6, 3.6), 0x6b4423, { x: -0.18, y: 1.8 }); // portón de madera
  for (let i = -1; i <= 1; i++) b.add(Box(0.2, 3.6, 0.15), 0x3a2414, { x: -0.25, y: 1.8, z: i * 1.1 });
  // torre del homenaje
  b.add(Box(7, 9, 7), pal.dark, { x: 7, y: 4.5, jitter: 0.06 });
  for (let i = -3; i <= 3; i += 1.5) { b.add(Box(1, 0.9, 1), pal.dark, { x: 3.6, y: 9.4, z: i }); b.add(Box(1, 0.9, 1), pal.dark, { x: 10.4, y: 9.4, z: i }); }
  b.add(Cone(4.6, 4, 4), pal.roof, { x: 7, y: 11.5, ry: Math.PI / 4 });
  // torres redondas
  for (const sz of [-1, 1]) {
    b.add(C(2, 9, 8, 1.8), pal.stone, { x: 1.5, y: 4.5, z: sz * (W / 2 + 0.6), jitter: 0.08 });
    b.add(Cone(2.6, 3.4, 8), pal.roof, { x: 1.5, y: 10.7, z: sz * (W / 2 + 0.6) });
    if (pal.snow) b.add(Cone(1.4, 1.4, 8), 0xf4f8fb, { x: 1.5, y: 11.8, z: sz * (W / 2 + 0.6) });
    b.add(Box(0.1, 2.4, 1.1), pal.banner, { x: -0.1, y: 4.8, z: sz * 3.3 });
    // ventanas
    b.add(Box(0.2, 0.9, 0.4), 0x1c140e, { x: -0.45, y: 6.5, z: sz * (W / 2 + 0.6) });
  }
  if (pal.snow) {
    b.add(Box(3.3, 0.3, W + 0.3), 0xf4f8fb, { x: 1.5, y: 6.1 });
    b.add(Cone(2.8, 1.5, 4), 0xf4f8fb, { x: 7, y: 12.9, ry: Math.PI / 4 });
  }
  const mesh = b.mesh(lowpolyMat());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

// Portal infernal (usa la imagen original hell_castle.png)
export function createPortal(tex) {
  const g = new THREE.Group();
  const b = new Builder();
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    b.add(new THREE.DodecahedronGeometry(1.3, 0), 0x241619, { x: 0, y: Math.sin(a) * 5.2 + 0.3, z: Math.cos(a) * 5.2, s: 1 + (i % 2) * 0.3, jitter: 0.25 });
  }
  b.add(Cone(0.8, 4, 5), 0x1a1012, { y: 2, z: -6.5 });
  b.add(Cone(0.8, 4.5, 5), 0x1a1012, { y: 2.2, z: 6.5 });
  const rocks = b.mesh(lowpolyMat());
  rocks.castShadow = true;
  g.add(rocks);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(4.6, 32), mat);
  swirl.rotation.y = -Math.PI / 2;
  swirl.position.set(0.2, 4.8, 0);
  g.add(swirl);
  const glow = glowSprite(0xff5a1a, 16, 0.6);
  glow.position.set(-1, 4.8, 0);
  g.add(glow);
  g.userData.update = (dt, t) => {
    swirl.rotation.x -= dt * 1.4;
    glow.material.opacity = 0.5 + Math.sin(t * 3) * 0.12;
  };
  return g;
}

// Cueva de entrada de los enemigos
export function createCave(biome) {
  const col = { meadow: 0x6b6258, spooky: 0x3e3b46, snow: 0xb8c6d4, hell: 0x2a1a1c, desert: 0xa8784a }[biome];
  const b = new Builder();
  for (let i = 0; i < 11; i++) {
    const a = (i / 10) * Math.PI;
    b.add(new THREE.DodecahedronGeometry(1.6, 0), col, { x: 0, y: Math.sin(a) * 4.6, z: Math.cos(a) * 4.4, s: 1 + (i % 3) * 0.25, jitter: 0.2, ry: i });
  }
  b.add(new THREE.DodecahedronGeometry(4, 0), col, { x: -4, y: 2.5, z: 0, sx: 1.5, jitter: 0.15 });
  b.add(new THREE.DodecahedronGeometry(3, 0), col, { x: -2, y: 1.2, z: 6.5, jitter: 0.15 });
  b.add(new THREE.DodecahedronGeometry(3, 0), col, { x: -2, y: 1.2, z: -6.5, jitter: 0.15 });
  if (biome === 'snow') b.add(new THREE.DodecahedronGeometry(2.5, 0), 0xf4f8fb, { x: -1, y: 5.4, sy: 0.4, sx: 1.6 });
  const mesh = b.mesh(lowpolyMat());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ color: 0x050303 }));
  hole.rotation.y = Math.PI / 2;
  hole.position.set(-1.6, 2.2, 0);
  g.add(hole);
  return g;
}

// Hoguera animada (como la del original)
export function createCampfire(scale = 1) {
  const M = mats();
  const g = new THREE.Group();
  const b = new Builder();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(new THREE.DodecahedronGeometry(0.32, 0), 0x6f6a64, { x: Math.cos(a) * 1.1, y: 0.15, z: Math.sin(a) * 1.1, jitter: 0.2 });
  }
  b.add(C(0.18, 1.8, 6), 0x4a2a14, { rz: Math.PI / 2, ry: 0.5, y: 0.25 });
  b.add(C(0.18, 1.8, 6), 0x3a200f, { rz: Math.PI / 2, ry: -0.6, y: 0.35 });
  const m = b.mesh(lowpolyMat());
  m.castShadow = true;
  g.add(m);
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(Cone(0.45 - i * 0.07, 1.4 - i * 0.2, 5), i % 2 ? M.flameB : M.flameA);
    f.position.set((i - 1.5) * 0.18, 0.75, ((i * 37) % 3 - 1) * 0.15);
    g.add(f);
    flames.push(f);
  }
  const glow = glowSprite(0xff8a3a, 5, 0.65);
  glow.position.y = 1;
  g.add(glow);
  const light = new THREE.PointLight(0xff8a3a, 30, 22, 1.6);
  light.position.y = 1.6;
  g.add(light);
  g.scale.setScalar(scale);
  g.userData.update = (dt, t) => {
    flames.forEach((f, i) => {
      f.scale.y = 0.75 + Math.sin(t * (8 + i * 2.7) + i) * 0.2 + Math.random() * 0.2;
      f.rotation.y += dt * (1.5 + i);
    });
    light.intensity = 26 + Math.sin(t * 11) * 5 + Math.random() * 5;
    glow.material.opacity = 0.55 + Math.random() * 0.15;
  };
  return g;
}

// ── Guantelete (truco "thanos") ─────────────────────────────
// Mano dorada low-poly con 6 gemas. Mira hacia +z (el dorso con las gemas).
export function createGauntlet() {
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c04a, metalness: 0.7, roughness: 0.3, flatShading: true, emissive: 0x3a2400 });
  const goldDark = new THREE.MeshStandardMaterial({ color: 0xa8741e, metalness: 0.8, roughness: 0.4, flatShading: true });
  const g = new THREE.Group();
  const add = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  // antebrazo y muñeca
  add(g, new THREE.CylinderGeometry(1.1, 1.25, 1.8, 8), goldDark, 0, -2.2, 0);
  add(g, new THREE.CylinderGeometry(1.32, 1.32, 0.3, 8), gold, 0, -1.4, 0);
  add(g, new THREE.CylinderGeometry(1.32, 1.32, 0.3, 8), gold, 0, -3.1, 0);
  // palma
  add(g, new THREE.BoxGeometry(2.3, 2.4, 0.95), gold, 0, 0, 0);
  add(g, new THREE.BoxGeometry(2.0, 1.6, 0.2), goldDark, 0, -0.1, 0.55);
  // dedos (índice → meñique), cada uno con 2 falanges y una articulación
  const fingers = [];
  const spec = [[-0.84, 1.55], [-0.28, 1.75], [0.28, 1.65], [0.84, 1.3]];
  for (const [x, len] of spec) {
    const base = new THREE.Group();
    base.position.set(x, 1.2, 0);
    base.rotation.z = -x * 0.1;
    add(base, new THREE.BoxGeometry(0.5, len * 0.55, 0.58), gold, 0, len * 0.275, 0);
    const tip = new THREE.Group();
    tip.position.y = len * 0.55;
    add(tip, new THREE.BoxGeometry(0.46, len * 0.45, 0.52), gold, 0, len * 0.225, 0);
    add(tip, new THREE.BoxGeometry(0.5, 0.12, 0.56), goldDark, 0, 0, 0);
    base.add(tip);
    g.add(base);
    fingers.push({ base, tip });
  }
  // pulgar
  const thumb = new THREE.Group();
  thumb.position.set(-1.0, -0.25, 0.2);
  thumb.rotation.z = 0.6;
  add(thumb, new THREE.BoxGeometry(0.55, 1.1, 0.6), gold, 0, 0.55, 0);
  const thumbTip = new THREE.Group();
  thumbTip.position.y = 1.1;
  add(thumbTip, new THREE.BoxGeometry(0.5, 0.8, 0.55), gold, 0, 0.4, 0);
  thumb.add(thumbTip);
  g.add(thumb);
  // gemas (brillan con el bloom)
  const gemColors = [0xff3030, 0x3a86ff, 0xffd23a, 0x3aff7a, 0xff8a1a, 0xb44aff];
  const gems = [];
  const gemAt = (parent, color, x, y, z, r) => {
    const m = add(parent, new THREE.IcosahedronGeometry(r, 0), new THREE.MeshBasicMaterial({ color, toneMapped: false }), x, y, z);
    gems.push(m);
    return m;
  };
  spec.forEach(([x], i) => gemAt(g, gemColors[i], x, 0.85, 0.5, 0.2));
  gemAt(thumb, gemColors[4], 0, 0.5, 0.33, 0.19);
  gemAt(g, gemColors[5], 0, -0.3, 0.68, 0.42);
  const glow = glowSprite(0xffd890, 6, 0);
  glow.position.set(0, 0.2, 1);
  g.add(glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // pose: 0 = mano abierta, 1 = preparada (corazón contra pulgar), snap = chasquido
  g.userData.pose = (ready, snap, t) => {
    fingers.forEach((f, i) => {
      const curl = i === 1 ? ready * 0.55 + snap * 1.1 : i === 0 ? ready * 0.15 : ready * 0.35 + snap * 0.6;
      f.base.rotation.x = -curl;
      f.tip.rotation.x = -curl * 0.8;
    });
    thumb.rotation.z = 0.6 - ready * 0.35 + snap * 0.6;
    thumb.rotation.x = -ready * 0.5;
    thumbTip.rotation.z = -ready * 0.3;
    gems.forEach((m, i) => m.scale.setScalar(1 + Math.sin(t * 6 + i) * 0.12 * ready + snap * 0.6));
    glow.material.opacity = ready * 0.12 + snap * 0.6;
  };
  return g;
}
