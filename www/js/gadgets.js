// Artilugios de Tuerca en 3D: el cepo explosivo y la minitorreta.
// Se usan en la partida, como fantasma verde/rojo al colocarlos y para dibujar sus iconos.
import * as THREE from 'three';
import { glowSprite } from './models.js';

export const SCALE = { trap: 1.35, turret: 1.7 };

// opts.ghost: materiales semitransparentes para la vista previa (se tiñen con setOk)
export function createGadget(kind, opts = {}) {
  const ghost = !!opts.ghost;
  const std = (color, rough, metal) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true, transparent: ghost, opacity: ghost ? 0.82 : 1, depthWrite: !ghost });
  const metal = std(0x8a8a92, 0.5, 0.6);
  const dark = std(0x3a3a40, 0.7, 0.4);
  const copper = std(0xb8743a, 0.5, 0.5);
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffb03a, toneMapped: false, transparent: ghost, opacity: ghost ? 0.6 : 1 });
  const mats = [metal, dark, copper, glowM];
  // tamaño base: a escala de los héroes (si no, en el mapa se pierden entre los enemigos)
  const root = new THREE.Group();
  const obj = new THREE.Group();
  obj.scale.setScalar(SCALE[kind] || 1);
  root.add(obj);
  const g = { kind, obj: root, mats };
  if (kind === 'trap') {
    // aro dentado abierto con una placa de presión y una luz que parpadea
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 5, 14), metal);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    obj.add(ring);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 4), metal);
      tooth.position.set(Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9);
      tooth.rotation.z = Math.cos(a) * 0.5; tooth.rotation.x = -Math.sin(a) * 0.5;
      obj.add(tooth);
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 8), copper);
    plate.position.y = 0.08;
    obj.add(plate);
    for (const s of [-1, 1]) {
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 4, 8), dark);
      spring.position.set(s * 0.95, 0.18, 0);
      spring.rotation.y = Math.PI / 2;
      obj.add(spring);
    }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), glowM);
    led.position.y = 0.22;
    obj.add(led);
    g.led = led;
  } else {
    // minitorreta: trípode, caja de cobre y metralleta de cuatro cañones que gira hacia su objetivo
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 5), dark);
      leg.position.set(Math.cos(a) * 0.45, 0.6, Math.sin(a) * 0.45);
      leg.rotation.z = Math.cos(a) * 0.45; leg.rotation.x = -Math.sin(a) * 0.45;
      obj.add(leg);
    }
    const head = new THREE.Group();
    head.position.y = 1.4;
    obj.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.8), copper));
    const ammo = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.35), dark);
    ammo.position.set(0.42, 0, -0.1);
    head.add(ammo);
    const barrels = new THREE.Group();
    barrels.position.z = 0.4;
    head.add(barrels);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), metal);
      b.rotation.x = Math.PI / 2;
      b.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.4);
      barrels.add(b);
    }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), glowM);
    led.position.set(0, 0.3, -0.2);
    head.add(led);
    Object.assign(g, { head, barrels, led, spin: 0 });
    if (!ghost) {
      g.flash = glowSprite(0xffd060, 1.2, 0.9);
      g.flash.position.set(0, 0, 0.9);
      g.flash.visible = false;
      barrels.add(g.flash);
    }
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = !ghost; });
  // fantasma: verde si se puede colocar, rojo si no
  g.setOk = (ok) => {
    const c = ok ? new THREE.Color(0x6aff8a) : new THREE.Color(0xff5a4a);
    for (const m of mats) { if (m.emissive) { m.emissive.copy(c).multiplyScalar(0.8); m.color.lerp(c, 0.6); } else m.color.copy(c); }
  };
  if (ghost) {
    const base = mats.map((m) => m.color.clone());
    const set = g.setOk;
    g.setOk = (ok) => { mats.forEach((m, i) => m.color.copy(base[i])); set(ok); };
  }
  g.dispose = () => {
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    mats.forEach((m) => m.dispose());
    if (g.flash) g.flash.material.dispose();
  };
  return g;
}
