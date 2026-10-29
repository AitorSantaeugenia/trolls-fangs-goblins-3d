import * as THREE from 'three';
import { PATH_HALF, toWorld } from './config.js';
import { Builder, lowpolyMat, makeNoise, rng } from './util.js';
import { Props, GlowProps, lanternPost, createCastle, createPortal, createCave, createCampfire } from './models.js';

export const BIOMES = {
  meadow: {
    bg: 0x9fcbe6, fog: [0xa9cfe4, 120, 260], hemi: [0xd8ecff, 0x6b4a2a, 1.25], sun: [0xfff0d2, 2.7],
    ground: { a: 0x7b4b2a, b: 0x8f5c35, c: 0x6b8f30, hill: 0x5d8a33, hill2: 0x4b7a2c, rock: 0x8a8478 },
    border: 0xa6d23e, tileSize: [4, 4], exposure: 1.05, ambient: 'pollen', bloom: { threshold: 1.15, strength: 0.45 }, tint: [1, 1, 1],
  },
  spooky: {
    bg: 0x161e33, fog: [0x1b2540, 110, 260], hemi: [0x8296cc, 0x2a1d14, 1.7], sun: [0xc4d0ff, 2.1],
    ground: { a: 0x4a3220, b: 0x5a3d25, c: 0x30524c, hill: 0x34333f, hill2: 0x2a2933, rock: 0x5d5a66 },
    border: 0x2b6a73, tileSize: [6, 6], exposure: 1.35, ambient: 'wisps', bloom: { threshold: 0.75, strength: 0.7 }, tint: [0.9, 0.92, 1],
  },
  snow: {
    bg: 0xc9def0, fog: [0xd6e7f3, 110, 250], hemi: [0xffffff, 0x9fb4c8, 1.2], sun: [0xffffff, 2.3],
    ground: { a: 0xe4edf5, b: 0xd2dfec, c: 0xc4dbee, hill: 0xf2f6fa, hill2: 0xdfe8f1, rock: 0x9aa8b6 },
    border: 0x3f78b0, tileSize: [6, 1.8], exposure: 0.95, ambient: 'snow', bloom: { threshold: 1.9, strength: 0.35 }, tint: [1, 1, 1],
  },
  desert: {
    bg: 0xf2d9a8, fog: [0xf0d8b0, 120, 270], hemi: [0xfff2d8, 0x9a6a3a, 1.2], sun: [0xffe6b8, 3.0],
    ground: { a: 0xd8b070, b: 0xe4c088, c: 0xc89a5a, hill: 0xe0b878, hill2: 0xc8965a, rock: 0xa8784a },
    border: 0x9a6a3a, tileSize: [6, 6], exposure: 1.0, ambient: 'sand', bloom: { threshold: 1.6, strength: 0.35 }, tint: [1, 0.97, 0.92],
  },
  hell: {
    bg: 0x1c0605, fog: [0x2c0907, 85, 210], hemi: [0xff7a4a, 0x200404, 0.8], sun: [0xffa070, 1.7],
    ground: { a: 0x2c1512, b: 0x3b1c16, c: 0x4d1f13, hill: 0x221111, hill2: 0x170b0b, rock: 0x3a2a2a },
    border: 0xff5a14, tileSize: [3, 3], exposure: 1.1, ambient: 'embers', bloom: { threshold: 0.9, strength: 0.75 }, tint: [1, 0.9, 0.85],
  },
};

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createWorld(level, path, assets, quality) {
  const biome = BIOMES[level.biome];
  const root = new THREE.Group();
  const noise = makeNoise(level.id.length * 13 + 5);
  const R = rng(level.id.charCodeAt(0) * 97 + level.id.length);
  const first = path.points[1];
  const last = path.points[path.points.length - 2];
  const castlePos = { x: last[0] + 6, z: last[1] };
  const cavePos = { x: path.points[0][0] + 3, z: path.points[0][1] };
  const camp = toWorld(level.campfire);
  const campPos = { x: camp[0], z: camp[1] };

  // ── Altura del terreno ──────────────────────────────────
  const heightAt = (x, z) => {
    const out = Math.max(0, Math.abs(x) - 61, Math.abs(z) - 36);
    let h = noise(x * 0.06 + 3, z * 0.06 - 2, 2) * 0.35;
    if (out > 0) h += out * 0.6 + noise(x * 0.04, z * 0.04, 3) * Math.min(out, 14) * 0.6 + Math.min(out, 6) * 0.3;
    const dp = path.distanceTo(x, z);
    h *= smooth(PATH_HALF + 0.6, PATH_HALF + 4, dp);
    const dc = Math.max(Math.abs(x - castlePos.x - 6) - 9, Math.abs(z - castlePos.z) - 10);
    h *= smooth(0, 5, dc);
    const dv = Math.hypot(x - cavePos.x, z - cavePos.z);
    h *= smooth(4, 10, dv);
    return h;
  };

  // ── Terreno (low-poly, color por triángulo) ─────────────
  {
    const W = 220, H = 160, NX = 110, NZ = 80;
    const hs = new Float32Array((NX + 1) * (NZ + 1));
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = -W / 2 + (i / NX) * W + (j % 2 ? 0 : 0);
      const z = -H / 2 + (j / NZ) * H;
      hs[j * (NX + 1) + i] = heightAt(x, z);
    }
    const pos = [];
    const col = [];
    const g = biome.ground;
    const cA = new THREE.Color(g.a), cB = new THREE.Color(g.b), cC = new THREE.Color(g.c);
    const cH = new THREE.Color(g.hill), cH2 = new THREE.Color(g.hill2), cR = new THREE.Color(g.rock);
    const tmp = new THREE.Color();
    const P = (i, j) => [-W / 2 + (i / NX) * W, hs[j * (NX + 1) + i], -H / 2 + (j / NZ) * H];
    const tri = (a, b, c) => {
      pos.push(...a, ...b, ...c);
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      const n1 = noise(cx * 0.08, cz * 0.08, 3);
      const n2 = noise(cx * 0.3 + 40, cz * 0.3, 1);
      tmp.copy(cA).lerp(cB, 0.5 + n2 * 0.5);
      if (n1 > 0.18) tmp.lerp(cC, smooth(0.18, 0.4, n1));
      if (cy > 0.8) tmp.lerp(cH, smooth(0.8, 3, cy));
      if (cy > 5) tmp.lerp(cH2, smooth(5, 12, cy) * 0.7);
      // pendientes pronunciadas → roca
      const slope = Math.max(Math.abs(a[1] - b[1]), Math.abs(b[1] - c[1]), Math.abs(a[1] - c[1]));
      if (slope > 2.6) tmp.lerp(cR, smooth(2.6, 4.5, slope) * 0.8);
      const k = 1 + (Math.random() - 0.5) * 0.05;
      for (let v = 0; v < 3; v++) col.push(tmp.r * k, tmp.g * k, tmp.b * k);
    };
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
      if ((i + j) % 2) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, lowpolyMat({ roughness: level.biome === 'snow' ? 0.75 : 0.95 }));
    ground.receiveShadow = true;
    ground.name = 'ground';
    root.add(ground);
  }

  // ── Camino con la textura original del nivel ────────────
  let pathMat;
  {
    const [tu, tv] = biome.tileSize;
    const build = (hw, y, uvScale) => {
      const pos = [], uv = [];
      path.segs.forEach((s, si) => {
        const yy = y + si * (uvScale ? 0.003 : 0.0008);
        const minX = Math.min(s.ax, s.bx) - hw, maxX = Math.max(s.ax, s.bx) + hw;
        const minZ = Math.min(s.az, s.bz) - hw, maxZ = Math.max(s.az, s.bz) + hw;
        const q = [[minX, minZ], [minX, maxZ], [maxX, maxZ], [maxX, minZ]];
        const vertical = Math.abs(s.dz) > Math.abs(s.dx);
        const order = [0, 1, 2, 0, 2, 3];
        for (const k of order) {
          const [x, z] = q[k];
          pos.push(x, yy, z);
          if (uvScale) uv.push(vertical ? z / tu : x / tu, vertical ? x / tv : z / tv);
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (uvScale) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      return geo;
    };
    const tex = assets.tex[`tile_${level.tile}`];
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (level.biome === 'hell') {
      pathMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, toneMapped: false });
    } else if (level.biome === 'snow') {
      pathMat = new THREE.MeshStandardMaterial({ map: tex, color: 0x9cc8ee, roughness: 0.3, metalness: 0.15, emissive: 0x1a3550 });
    } else {
      pathMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    }
    const p = new THREE.Mesh(build(PATH_HALF, 0.08, true), pathMat);
    p.receiveShadow = true;
    root.add(p);
    const borderMat = level.biome === 'hell'
      ? new THREE.MeshBasicMaterial({ color: biome.border, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: biome.border, roughness: 0.9 });
    const border = new THREE.Mesh(build(PATH_HALF + 0.7, 0.025, false), borderMat);
    border.receiveShadow = true;
    root.add(border);
  }

  // ── Luces, cielo y niebla ───────────────────────────────
  const hemi = new THREE.HemisphereLight(biome.hemi[0], biome.hemi[1], biome.hemi[2]);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(biome.sun[0], biome.sun[1]);
  sun.position.set(-45, 80, 40);
  sun.target.position.set(0, 0, 0);
  root.add(sun, sun.target);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    const sc = sun.shadow.camera;
    sc.left = -85; sc.right = 85; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 220;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.06;
  }

  // ── Decorados ───────────────────────────────────────────
  const obstacles = [];
  const deco = new Builder();
  const glow = new Builder();
  const updaters = [];
  const B = level.biome;
  const lightsCount = { n: 0 };

  const okSpot = (x, z, clear, list) => {
    if (path.distanceTo(x, z) < PATH_HALF + clear) return false;
    if (Math.hypot(x - campPos.x, z - campPos.z) < 4 + clear) return false;
    if (Math.abs(x - castlePos.x - 6) < 12 && Math.abs(z - castlePos.z) < 12) return false;
    if (Math.hypot(x - cavePos.x, z - cavePos.z) < 10) return false;
    for (const o of list) if (Math.hypot(o.x - x, o.z - z) < o.r + clear) return false;
    return true;
  };

  const big = {
    meadow: ['deadTree', 'bush', 'rock', 'stump', 'crate', 'grave'],
    spooky: ['deadTree', 'grave', 'grave', 'rock', 'lantern', 'bushTeal', 'pumpkin'],
    snow: ['pine', 'pine', 'rock', 'crystal', 'snowman'],
    hell: ['spike', 'spike', 'rock', 'lavaPool', 'deadTree'],
    desert: ['cactus', 'cactus', 'rock', 'palm', 'deadTree'],
  }[B];
  const small = {
    meadow: ['skull', 'bones', 'mushroom', 'mushroom'],
    spooky: ['skull', 'bones', 'pumpkin'],
    snow: ['crystalSmall', 'rockSmall'],
    hell: ['skull', 'bones', 'lavaSmall'],
    desert: ['skull', 'bones', 'cactusSmall', 'rockSmall'],
  }[B];
  const outer = {
    meadow: ['tree', 'tree', 'tree', 'deadTree', 'rock', 'bush', 'bush'],
    spooky: ['deadTree', 'deadTree', 'deadTree', 'bushTeal', 'rock', 'grave'],
    snow: ['pine', 'pine', 'pine', 'pine', 'rock', 'crystal'],
    hell: ['spike', 'spike', 'rock', 'lavaPool', 'deadTree'],
    desert: ['cactus', 'rock', 'rock', 'palm', 'pyramid', 'cactus'],
  }[B];

  const place = (kind, x, z, s, inside) => {
    const y = heightAt(x, z);
    const r = R;
    switch (kind) {
      case 'deadTree': Props.deadTree(deco, x, y, z, s, r, B === 'hell' ? 0x140c0c : B === 'spooky' ? 0x231d22 : 0x2e2824); return 1.1;
      case 'cactus': Props.cactus(deco, x, y, z, s, r); return 0.9;
      case 'cactusSmall': Props.cactus(deco, x, y, z, 0.55, r); return 0;
      case 'palm': Props.palm(deco, x, y, z, s, r); return 1;
      case 'pyramid': if (inside) return 0; Props.pyramid(deco, x, y, z, s * 1.6, r); return 6;
      case 'tree': Props.tree(deco, x, y, z, s, r, r.pick([0x4f8a2e, 0x5f9a35, 0x467d2a])); return 1.6;
      case 'pine': Props.pine(deco, x, y, z, s, r, true); return 1.5;
      case 'bush': Props.bush(deco, x, y, z, s, r, r.pick([0x9cc23a, 0x86b030])); return 1.3;
      case 'bushTeal': Props.bush(deco, x, y, z, s, r, r.pick([0x2f7a80, 0x2a6a70])); return 1.3;
      case 'rock': Props.rock(deco, x, y, z, s * (inside ? 1 : 1.6), r, B === 'snow' ? 0xa8b6c4 : B === 'hell' ? 0x2e2222 : B === 'spooky' ? 0x5a5664 : B === 'desert' ? 0xb88a58 : 0x8b8f94); return 1.2 * s;
      case 'rockSmall': Props.rock(deco, x, y, z, 0.45, r, 0xa8b6c4); return 0;
      case 'stump': Props.stump(deco, x, y, z, s); return 0.9;
      case 'crate': Props.crate(deco, x, y, z, s, r); return 0.9;
      case 'grave': Props.grave(deco, x, y, z, s, r, B === 'spooky' ? 0x7d8088 : 0x8a8f96); return 0.8;
      case 'pumpkin': Props.pumpkin(deco, x, y, z, s * 0.9); return inside ? 0 : 0.6;
      case 'snowman': Props.snowman(deco, x, y, z, s); return 1;
      case 'spike': Props.spike(deco, x, y, z, s, r, r.pick([0x1d1517, 0x2a1a1a, 0x140d0f])); return 0.9;
      case 'skull': Props.skull(deco, x, y, z, s * 0.9, r); return 0;
      case 'bones': Props.bones(deco, x, y, z, s, r); return 0;
      case 'mushroom': Props.mushroom(deco, x, y, z, s * 1.2, r, r.pick([0xd84a7a, 0xe8562a, 0xf0a020])); return 0;
      case 'crystal': GlowProps.crystal(glow, x, y, z, s, r, r.pick([0x8fe8ff, 0x7fd2ff, 0xb5f2ff])); return 1;
      case 'crystalSmall': GlowProps.crystal(glow, x, y, z, 0.5, r, 0x9fe6ff); return 0;
      case 'lavaPool': if (!inside || y > 1.2) { Props.spike(deco, x, y, z, s, r); return 0.9; } GlowProps.lavaPool(glow, x, y, z, s, r); Props.rock(deco, x + 1.4 * s, y, z + 0.6, 0.6 * s, r, 0x2a1d1d); return 1.6 * s;
      case 'lavaSmall': GlowProps.lavaPool(glow, x, y, z, 0.5, r); return 0;
      case 'lantern': lanternPost(deco, x, y, z, s); GlowProps.lantern(glow, x, y, z, s); return 0.6;
      default: return 0;
    }
  };

  // Dentro del mapa: algunos obstáculos grandes y detalles pequeños
  for (let n = 0, tries = 0; n < 11 && tries < 600; tries++) {
    const x = R.range(-57, 57), z = R.range(-32, 32);
    if (!okSpot(x, z, 4.5, obstacles)) continue;
    const s = R.range(1.4, 1.9);
    const r = place(R.pick(big), x, z, s, true);
    if (r > 0) obstacles.push({ x, z, r });
    n++;
  }
  const smallList = [];
  for (let n = 0, tries = 0; n < 28 && tries < 800; tries++) {
    const x = R.range(-58, 58), z = R.range(-33, 33);
    if (!okSpot(x, z, 1.2, obstacles) || !okSpot(x, z, 1.2, smallList)) continue;
    place(R.pick(small), x, z, R.range(1.6, 2.2), true);
    smallList.push({ x, z, r: 1 });
    n++;
  }
  // Fuera del mapa: bosque/rocas que enmarcan la escena
  const outerList = [];
  for (let n = 0, tries = 0; n < 190 && tries < 4000; tries++) {
    const x = R.range(-105, 105), z = R.range(-78, 78);
    if (Math.abs(x) < 64 && Math.abs(z) < 39) continue;
    if (!okSpot(x, z, 2.5, outerList)) continue;
    let s = R.range(1.4, 2.4);
    let kind = R.pick(outer);
    if (kind === 'pyramid') {
      // Las pirámides son enormes: solo al fondo o muy a los lados, lejos del camino y sin tapar el mapa
      const rad = 8 * s;
      const far = z < -39 - rad * 0.6 || Math.abs(x) > 64 + rad;
      if (!far || path.distanceTo(x, z) < rad + 6 || !okSpot(x, z, rad, outerList)) kind = 'rock';
    }
    // delante de la cámara (z alto) nada demasiado alto que tape el campo
    if (z > 39) s = Math.min(s, 1.6);
    place(kind, x, z, s, false);
    outerList.push({ x, z, r: kind === 'pyramid' ? 8 * s : 2.2 * s });
    n++;
  }
  // Cartel de entrada (como en el mapa original)
  if (B !== 'hell') Props.sign(deco, first[0] + 2.5, 0, first[1] - PATH_HALF - 2.6, 1.6);
  obstacles.push({ x: first[0] + 2.5, z: first[1] - PATH_HALF - 2.2, r: 0.9 });

  const decoMesh = deco.mesh(lowpolyMat());
  decoMesh.castShadow = true;
  decoMesh.receiveShadow = true;
  root.add(decoMesh);
  if (glow.parts.length) {
    const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    root.add(gm);
  }

  // ── Castillo / portal y cueva ───────────────────────────
  if (B === 'hell') {
    const portal = createPortal(assets.tex.portal);
    portal.position.set(castlePos.x + 1, 0, castlePos.z);
    root.add(portal);
    updaters.push(portal.userData.update);
  } else {
    const castle = createCastle(B);
    castle.position.set(castlePos.x, 0, castlePos.z);
    root.add(castle);
  }
  const cave = createCave(B);
  cave.position.set(cavePos.x - 4, 0, cavePos.z);
  root.add(cave);

  // ── Hoguera ─────────────────────────────────────────────
  const fire = createCampfire(level.biome === 'hell' ? 1.2 : 1.6);
  fire.position.set(campPos.x, heightAt(campPos.x, campPos.z), campPos.z);
  root.add(fire);
  updaters.push(fire.userData.update);
  obstacles.push({ x: campPos.x, z: campPos.z, r: 2.4 });

  // ── Partículas ambientales ──────────────────────────────
  let ambT = 0;
  let emberT = 0;
  const lavaSpots = path.segs;
  const ambient = (dt, fx) => {
    ambT += dt;
    emberT += dt;
    if (emberT > 0.18) {
      emberT = 0;
      fx.emit('add', { x: campPos.x, y: 1.4, z: campPos.z, count: 1, spread: 0.4, vel: [0, 2.2, 0], velSpread: 0.6, color: 0xffa040, size: 0.35, life: 1.6, gravity: -0.4 });
    }
    const A = biome.ambient;
    if (A === 'snow') {
      const n = Math.floor(ambT * 45);
      if (n > 0) {
        ambT -= n / 45;
        for (let i = 0; i < n; i++) fx.emit('norm', { x: R.range(-80, 80), y: R.range(25, 35), z: R.range(-55, 55), count: 1, vel: [R.range(-1, 1), -3.2, R.range(-0.5, 0.5)], velSpread: 0.4, color: 0xffffff, size: R.range(0.25, 0.45), life: 9, gravity: 0, drag: 0 });
      }
    } else if (A === 'embers') {
      const n = Math.floor(ambT * 30);
      if (n > 0) {
        ambT -= n / 30;
        for (let i = 0; i < n; i++) {
          const s = R.pick(lavaSpots);
          const t = R();
          fx.emit('add', { x: s.ax + (s.bx - s.ax) * t + R.range(-2, 2), y: 0.3, z: s.az + (s.bz - s.az) * t + R.range(-2, 2), count: 1, vel: [R.range(-0.4, 0.4), R.range(1.5, 3.5), R.range(-0.4, 0.4)], color: R() < 0.5 ? 0xff7a2a : 0xffc04a, size: R.range(0.2, 0.4), life: R.range(1.2, 2.6), gravity: -0.3 });
        }
      }
    } else if (A === 'sand') {
      const n = Math.floor(ambT * 18);
      if (n > 0) {
        ambT -= n / 18;
        for (let i = 0; i < n; i++) fx.emit('norm', { x: R.range(-80, 40), y: R.range(0.3, 4), z: R.range(-40, 40), count: 1, vel: [R.range(5, 9), R.range(-0.3, 0.3), R.range(-1, 1)], color: 0xd8b882, size: R.range(0.3, 0.7), life: R.range(2, 4), gravity: 0, drag: 0, fadeIn: true });
      }
    } else if (A === 'pollen' || A === 'wisps') {
      const rate = A === 'pollen' ? 6 : 5;
      const n = Math.floor(ambT * rate);
      if (n > 0) {
        ambT -= n / rate;
        for (let i = 0; i < n; i++) fx.emit('add', {
          x: R.range(-60, 60), y: R.range(0.8, 3), z: R.range(-35, 35), count: 1,
          vel: [R.range(-0.6, 0.6), R.range(0.1, 0.5), R.range(-0.6, 0.6)],
          color: A === 'pollen' ? 0xfff2a0 : R.pick([0x6effc8, 0x8affd8, 0x9a8aff]),
          size: A === 'pollen' ? 0.3 : 0.6, life: R.range(3, 6), gravity: 0, fadeIn: true,
        });
      }
    }
  };

  let lavaT = 0;
  const update = (dt, t, fx) => {
    for (const u of updaters) u(dt, t);
    if (level.biome === 'hell' && pathMat.map) {
      lavaT += dt;
      pathMat.map.offset.set(lavaT * 0.05, Math.sin(lavaT * 0.4) * 0.05);
      const k = 1 + Math.sin(t * 1.8) * 0.12;
      pathMat.color.setRGB(2.6 * k, 1.15 * k, 0.6 * k);
    }
    if (fx) ambient(dt, fx);
  };

  const env = {
    background: new THREE.Color(biome.bg),
    fog: new THREE.Fog(biome.fog[0], biome.fog[1], biome.fog[2]),
    exposure: biome.exposure,
    bloom: biome.bloom,
  };

  return { root, obstacles, heightAt, update, env, biome, castlePos, cavePos, sun, hemi, lightsCount };
}
