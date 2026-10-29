// Héroes en 3D low-poly (fase 6), con el mismo esqueleto humanoide que los jefes.
// Todos miran hacia +z. API: { group, inner, height, update(dt, t, st), attack(), die(k), tint(), dispose(), muzzle }
import * as THREE from 'three';
import { makeMats, part, group, humanoid, eyes, addTail } from './bosses.js';
import { glowSprite } from './models.js';

const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Cyl = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const Cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const Oct = (r) => new THREE.OctahedronGeometry(r);

const BUILD = {
  // Chamán troll: encorvado, piel verde azulada, colmillos, máscara de hueso con plumas y bastón con orbe arcano
  shaman(root, m) {
    const c = { body: 0x3f8a7a, belly: 0x5aa894, leg: 0x3a7a6c, shin: 0x34705f, foot: 0x2a5a4c, arm: 0x3f8a7a, forearm: 0x3a7f70, hand: 0x4a9a88, belt: 0x6a3a22 };
    const rig = humanoid(root, m, c, { bulk: 0.95 });
    rig.torso.rotation.x = 0.22; // encorvado
    part(rig.torso, m.solid, (b) => {
      // taparrabos y faja de cuero, collar de huesos, hombreras de piel
      b.add(Box(1.2, 0.7, 0.75), 0x7a4a2a, { y: -0.25, jitter: 0.08 });
      for (let i = -2; i <= 2; i++) b.add(Cone(0.08, 0.32, 4), 0xeee6cc, { x: i * 0.22, y: 1.55, z: 0.46, rx: Math.PI });
      for (const s of [-1, 1]) b.add(Ico(0.45, 0), 0x8a6a4a, { x: s * 0.82, y: 1.72, sy: 0.6, jitter: 0.15 });
      // runas brillantes pintadas en el pecho
    });
    part(rig.torso, m.glow, (b) => { b.add(Oct(0.12), 0x5af0ff, { y: 1.15, z: 0.46, sy: 1.6 }); b.add(Box(0.5, 0.05, 0.02), 0x5af0ff, { y: 0.9, z: 0.45 }); });
    part(rig.head, m.solid, (b) => {
      b.add(Box(0.8, 0.75, 0.8), c.body, { y: 0.35, jitter: 0.06 });
      b.add(Cone(0.18, 0.55, 4), 0x4a9a88, { y: 0.32, z: 0.55, rx: Math.PI / 2 }); // nariz larga
      for (const s of [-1, 1]) {
        b.add(Cone(0.07, 0.42, 4), 0xf4ecd4, { x: s * 0.22, y: 0.12, z: 0.42, rx: -0.5 }); // colmillos
        b.add(Cone(0.16, 0.7, 4), c.body, { x: s * 0.52, y: 0.5, z: -0.05, rz: -s * 1.2 }); // orejas puntiagudas
      }
      // máscara de hueso y plumas
      b.add(Box(0.86, 0.32, 0.12), 0xe8dcc0, { y: 0.55, z: 0.42 });
      for (let i = -2; i <= 2; i++) b.add(Box(0.1, 0.75, 0.04), i % 2 ? 0x2a8ad0 : 0xd84a2a, { x: i * 0.16, y: 1.05, z: -0.1, rz: i * 0.18, rx: -0.3 });
      // cresta de pelo
      b.add(Cone(0.22, 0.7, 5), 0xd84a2a, { y: 0.95, z: -0.2, rx: -0.6 });
    });
    eyes(rig.head, m, 0x7af8ff, 0.52, 0.49, 0.2, 0.07);
    // bastón en la mano derecha con un orbe arcano flotando
    const hand = rig.arms[1].elbow;
    const staff = group(hand, 0.32, -1.0, 0.3);
    staff.rotation.x = 0.75; // compensa la inclinación del brazo: el bastón queda casi vertical
    part(staff, m.solid, (b) => {
      b.add(Cyl(0.07, 0.09, 3.4, 6), 0x5a3a22, { y: 0.6 });
      b.add(Ico(0.22, 0), 0x3a2414, { y: 2.3 });
      for (let i = 0; i < 3; i++) b.add(Cone(0.06, 0.45, 4), 0xe8dcc0, { y: 2.45, rz: (i - 1) * 0.6, x: (i - 1) * 0.12 });
    });
    const orb = group(staff, 0, 2.75, 0);
    part(orb, m.glow, (b) => b.add(Ico(0.26, 1), 0x6af4ff));
    orb.add(glowSprite(0x4ad8ff, 2.4, 0.85));
    return { rig, orb, staff, kind: 'caster' };
  },

  // Colmillo, el cazador: lobo humanoide gris, hocico, orejas, garras, cola y correas de cuero
  fang(root, m) {
    const c = { body: 0x6a6a72, belly: 0xa8a49a, leg: 0x5a5a62, shin: 0x52525a, foot: 0x3a3a40, arm: 0x6a6a72, forearm: 0x62626a, hand: 0x4a4a52, claw: 0xf0ead8, belt: 0x5a3420, pauldron: 0x6a4a2a };
    const rig = humanoid(root, m, c, { bulk: 1.15 });
    rig.torso.rotation.x = 0.12;
    part(rig.torso, m.solid, (b) => {
      // pelo del pecho, correas cruzadas y pantalón roto
      b.add(Ico(0.6, 0), c.belly, { y: 1.3, z: 0.35, sx: 1.2, sy: 0.9, sz: 0.5, jitter: 0.15 });
      b.add(Box(0.14, 1.8, 0.1), 0x5a3420, { y: 1.0, z: 0.5, rz: 0.75 });
      b.add(Box(1.3, 0.6, 0.8), 0x3a3a5a, { y: -0.2, jitter: 0.1 });
      for (let i = 0; i < 5; i++) b.add(Cone(0.12, 0.45, 4), 0x5a5a62, { x: (i - 2) * 0.28, y: 1.9, z: -0.35, rx: -0.9 }); // melena
    });
    part(rig.head, m.solid, (b) => {
      b.add(Box(0.8, 0.72, 0.8), c.body, { y: 0.35, jitter: 0.06 });
      b.add(Box(0.46, 0.38, 0.7), 0x7a7a82, { y: 0.22, z: 0.6 }); // hocico
      b.add(Box(0.2, 0.16, 0.16), 0x1a1a1e, { y: 0.36, z: 0.98 }); // nariz
      b.add(Box(0.42, 0.12, 0.55), 0x4a4a52, { y: 0.02, z: 0.58 }); // mandíbula
      for (const s of [-1, 1]) {
        b.add(Cone(0.18, 0.55, 4), c.body, { x: s * 0.28, y: 0.95, z: -0.05 }); // orejas
        b.add(Cone(0.05, 0.2, 4), 0xf4ecd4, { x: s * 0.14, y: 0.1, z: 0.84, rx: Math.PI }); // colmillos
      }
    });
    eyes(rig.head, m, 0xffb03a, 0.5, 0.42, 0.2, 0.075);
    const tail = addTail(rig.hips, m, c.body, c.belly, 0.2, -0.45, 4, 0.5, 0.26);
    return { rig, tail, kind: 'brawler' };
  },

  // Tuerca, la artillera goblin: bajita y cabezona, gafas de soldar, depósito de combustible a la espalda
  // y una metralleta de cañones giratorios agarrada con las dos manos
  gunner(root, m) {
    const c = { body: 0x5f9a3e, belly: 0x7ab452, leg: 0x4a3a2a, shin: 0x3f3226, foot: 0x2a221a, arm: 0x5f9a3e, forearm: 0x6a4a2a, hand: 0x6aa846, belt: 0x3a2a1a, pauldron: 0x8a8a92 };
    const rig = humanoid(root, m, c, { bulk: 0.85 });
    rig.torso.rotation.x = 0.1;
    part(rig.torso, m.solid, (b) => {
      // peto de cuero con remaches, cinturón de herramientas y correas del depósito
      b.add(Box(1.3, 0.9, 0.2), 0x7a5230, { y: 1.15, z: 0.38 });
      for (const x of [-0.45, 0.45]) b.add(Ico(0.06, 0), 0xd8c070, { x, y: 1.45, z: 0.5 });
      for (const x of [-0.42, 0, 0.42]) b.add(Box(0.18, 0.28, 0.16), 0x9a7a4a, { x, y: 0.02, z: 0.42 });
      for (const s of [-1, 1]) b.add(Box(0.12, 1.3, 0.08), 0x3a2a1a, { x: s * 0.4, y: 1.15, z: 0.47, rz: s * 0.08 });
      // depósito de combustible (bombona de cobre) y tuberías
      b.add(Cyl(0.42, 0.42, 1.5, 8), 0xb8743a, { y: 1.15, z: -0.75 });
      b.add(Ico(0.43, 1), 0xb8743a, { y: 1.92, z: -0.75, sy: 0.5 });
      b.add(Cyl(0.08, 0.08, 0.35, 6), 0x8a8a92, { y: 2.15, z: -0.75 });
      for (const y of [0.7, 1.6]) b.add(Cyl(0.45, 0.45, 0.08, 8), 0x5a5a62, { y, z: -0.75 });
      b.add(Box(0.1, 0.1, 1.0), 0x5a5a62, { x: 0.45, y: 0.75, z: -0.15 });
    });
    part(rig.head, m.solid, (b) => {
      // cabeza grande, orejas enormes, narizota y mueca con un diente
      b.add(Box(0.95, 0.85, 0.85), c.body, { y: 0.4, jitter: 0.05 });
      b.add(Cone(0.17, 0.5, 4), 0x6aa846, { y: 0.3, z: 0.56, rx: Math.PI / 2 });
      for (const s of [-1, 1]) b.add(Cone(0.22, 1.05, 4), c.body, { x: s * 0.82, y: 0.55, z: -0.05, rz: s * 1.35, sx: 0.5 });
      b.add(Box(0.5, 0.08, 0.05), 0x2a1a10, { y: 0.06, z: 0.44 });
      b.add(Box(0.09, 0.12, 0.05), 0xf4ecd4, { x: 0.1, y: 0.0, z: 0.46 });
      // gorro de aviador con la correa de las gafas y un mechón rojo
      b.add(Box(1.02, 0.4, 0.92), 0x6a4a2a, { y: 0.82, jitter: 0.04 });
      b.add(Box(1.05, 0.12, 0.92), 0x2a221a, { y: 0.66 });
      b.add(Cone(0.18, 0.55, 4), 0xd84a2a, { y: 1.12, z: -0.15, rx: -0.7 });
      // marco de las gafas de soldar
      for (const s of [-1, 1]) b.add(Cyl(0.19, 0.19, 0.14, 8), 0x8a8a92, { x: s * 0.24, y: 0.66, z: 0.44, rx: Math.PI / 2 });
    });
    // cristales de las gafas (brillan en ámbar)
    part(rig.head, m.glow, (b) => { for (const s of [-1, 1]) b.add(Cyl(0.14, 0.14, 0.05, 8), 0xffb03a, { x: s * 0.24, y: 0.66, z: 0.52, rx: Math.PI / 2 }); });
    // metralleta: va a la altura de la cintura (sujeta al torso) y los brazos la agarran
    const gun = group(rig.torso, 0.2, 0.55, 0.75);
    gun.scale.setScalar(1.3);
    part(gun, m.solid, (b) => {
      b.add(Box(0.55, 0.5, 1.0), 0x4a4a52, { z: -0.1 }); // cuerpo
      b.add(Box(0.2, 0.45, 0.25), 0x3a2a1a, { y: -0.35, z: -0.35 }); // empuñadura
      b.add(Box(0.35, 0.3, 0.4), 0x8a6a3a, { y: 0.35, z: -0.2 }); // caja de munición
      b.add(Cyl(0.3, 0.3, 0.12, 8), 0x2a2a30, { z: 0.45, rx: Math.PI / 2 }); // anillo trasero de los cañones
    });
    const barrels = group(gun, 0, 0, 0.5);
    part(barrels, m.solid, (b) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.add(Cyl(0.06, 0.06, 1.1, 5), 0x6a6a72, { x: Math.cos(a) * 0.17, y: Math.sin(a) * 0.17, z: 0.55, rx: Math.PI / 2 });
      }
      b.add(Cyl(0.26, 0.26, 0.08, 8), 0x2a2a30, { z: 0.95, rx: Math.PI / 2 });
      b.add(Cyl(0.08, 0.08, 1.2, 6), 0x2a2a30, { z: 0.55, rx: Math.PI / 2 });
    });
    // brillo de la boca de los cañones (se enciende al disparar y en rojo al recalentarse)
    const flash = new THREE.Group();
    flash.position.set(0, 0, 1.2);
    barrels.add(flash);
    const glow = glowSprite(0xffd060, 1.6, 0.9);
    glow.visible = false;
    flash.add(glow);
    return { rig, gun, barrels, flash, glow, kind: 'gunner' };
  },
};

const tmpBox = new THREE.Box3();

export function createHero(id) {
  const mats = makeMats();
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const r = BUILD[id](inner, mats);
  tmpBox.setFromObject(inner);
  const height = tmpBox.max.y - Math.min(0, tmpBox.min.y);
  let phase = 0;
  let atk = 0; // 1 → 0 durante la animación de ataque
  let atkSide = 1;
  const rig = r.rig;
  const muzzle = new THREE.Vector3();

  const api = {
    id,
    head: rig.head, // para encuadrar el retrato del panel
    group: root,
    inner,
    height,
    mats,
    tint(rr, gg, bb) { mats.solid.color.setRGB(rr, gg, bb); mats.thin.color.setRGB(rr, gg, bb); },
    attack() { atk = 1; atkSide = -atkSide; },
    // posición del orbe (origen de los proyectiles del Chamán)
    muzzle() { if (r.orb) r.orb.getWorldPosition(muzzle); else if (r.flash) r.flash.getWorldPosition(muzzle); else root.getWorldPosition(muzzle).y += height * 0.6; return muzzle; },
    // Tuerca: «heat» 0..1 pone los cañones al rojo; «jam» los deja quietos echando humo (lo dibuja la vista)
    setHeat(k) { r.heatK = k; },
    // st: { moving, speed }
    update(dt, t, st = {}) {
      const moving = !!st.moving;
      phase += dt * (moving ? 9 : 0);
      const s = Math.sin(phase);
      atk = Math.max(0, atk - dt * 3.2);
      const a = Math.sin(Math.min(1, (1 - atk)) * Math.PI) * (atk > 0 ? 1 : 0); // curva del golpe
      rig.legs.forEach((l, i) => {
        l.leg.rotation.x = moving ? (i ? s : -s) * 0.6 : 0;
        l.knee.rotation.x = moving ? Math.max(0, (i ? -s : s)) * 0.8 : 0.05;
      });
      rig.hips.position.y = 2.2 + (moving ? Math.abs(Math.cos(phase)) * 0.14 : Math.sin(t * 2) * 0.03);
      rig.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.015; // respira
      rig.head.rotation.y = Math.sin(t * 0.7) * 0.2;
      const [L, R] = rig.arms;
      if (r.kind === 'gunner') {
        // agarra la metralleta con las dos manos; retroceso y giro de los cañones al disparar
        const fire = atk > 0 ? 1 : 0;
        r.spin = Math.max(fire ? 28 : 0, (r.spin || 0) - dt * 30);
        r.barrels.rotation.z += r.spin * dt;
        r.gun.position.z = 0.75 - fire * Math.random() * 0.06;
        R.arm.rotation.x = -0.45 + (moving ? -s * 0.1 : 0); R.arm.rotation.z = 0.12; R.elbow.rotation.x = -1.0;
        L.arm.rotation.x = -0.7 + (moving ? s * 0.1 : 0); L.arm.rotation.z = -0.15; L.elbow.rotation.x = -0.9;
        r.glow.visible = fire > 0 && Math.random() < 0.7;
        const hk = r.heatK || 0;
        r.glow.material.color.setRGB(1, 0.85 - hk * 0.6, 0.4 - hk * 0.35);
      } else if (r.kind === 'caster') {
        // brazo del bastón: lo alza y lo descarga al atacar
        R.arm.rotation.x = -0.35 - a * 1.9 + (moving ? -s * 0.2 : 0);
        R.arm.rotation.z = 0.15;
        R.elbow.rotation.x = -0.6 + a * 0.5;
        L.arm.rotation.x = moving ? s * 0.5 : Math.sin(t * 1.3) * 0.08 - 0.2;
        L.arm.rotation.z = -0.25 - a * 0.4;
        L.elbow.rotation.x = -0.5;
        if (r.orb) { r.orb.position.y = 2.75 + Math.sin(t * 3) * 0.08; r.orb.rotation.y += dt * 2; r.orb.scale.setScalar(1 + a * 0.5); }
      } else {
        // zarpazo alternando brazos
        const hitL = atkSide > 0 ? a : 0, hitR = atkSide < 0 ? a : 0;
        L.arm.rotation.x = (moving ? s * 0.6 : -0.3) - hitL * 1.8;
        R.arm.rotation.x = (moving ? -s * 0.6 : -0.3) - hitR * 1.8;
        L.arm.rotation.z = -0.25 + hitL * 0.6;
        R.arm.rotation.z = 0.25 - hitR * 0.6;
        L.elbow.rotation.x = -0.7 + hitL * 0.6;
        R.elbow.rotation.x = -0.7 + hitR * 0.6;
        rig.torso.rotation.y = (hitL - hitR) * 0.35;
        if (r.tail) r.tail.forEach((seg, i) => { seg.rotation.y = Math.sin(t * 3 - i * 0.8) * 0.3; seg.rotation.x = i === 0 ? 0.45 : 0.1; });
      }
    },
    // k: 0 → 1 durante la muerte (cae de lado y se hunde)
    die(k) {
      inner.rotation.z = Math.min(1, k * 1.8) * 1.4;
      inner.position.y = -Math.max(0, k - 0.6) * height * 0.5;
    },
    revive() { inner.rotation.set(0, 0, 0); inner.position.set(0, 0, 0); },
    dispose() {
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      Object.values(mats).forEach((mm) => mm.dispose());
    },
  };
  return api;
}
