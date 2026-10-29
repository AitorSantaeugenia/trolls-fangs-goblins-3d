// Vista del héroe: modelo 3D, anillo de alcance y marca de su punto de guardia, barra de vida,
// fantasma de colocación y efectos (ataque, salto, aullido, muerte y reaparición).
// También los artilugios de Tuerca: cepos en el camino y la minitorreta.
import * as THREE from 'three';
import { createHero } from './heroes.js';
import { createRangeRing } from './fx.js';
import { HEROES } from './config.js';
import { radialTexture } from './util.js';
import { createGadget } from './gadgets.js';

const HERO_PURPLE = 0xb48cff;

// Anillo discontinuo en el suelo (punto de guardia del héroe)
function dashedRing(color) {
  const segs = 48;
  const geos = [];
  for (let i = 0; i < segs; i += 2) {
    const g = new THREE.RingGeometry(0.97, 1, 3, 1, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs);
    geos.push(g);
  }
  const pos = [];
  for (const g of geos) { const ng = g.toNonIndexed(); pos.push(...ng.attributes.position.array); ng.dispose(); g.dispose(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
  m.renderOrder = 3;
  m.visible = false;
  return m;
}

export class HeroView {
  constructor(view) {
    this.view = view;
    this.v = null; // { h, api, ... }
    this.ghosts = {};
    this.ring = createRangeRing(); // alcance del arma (héroe a distancia)
    this.moveRing = dashedRing(0xd8c8ff); // punto de guardia (adonde vuelve cuando no hay enemigos)
    this.marker = createRangeRing(); // destino al mandar mover
    view.scene.add(this.ring, this.moveRing, this.marker);
    this.selected = false;
    this.markerT = 0;
    this.gadgets = new Map(); // uid → { g, obj, ... }
  }

  get scene() { return this.view.scene; }
  heightAt(x, z) { return this.view.heightAt(x, z); }
  // altura en el mundo: HEROES[id].size (incluye el bastón del Chamán), algo mayor que un esbirro
  scale(api) { return ((this.view.sim?.level.unitScale || 1) * (HEROES[api.id]?.size || 6.5)) / api.height; }

  // ── Colocación ─────────────────────────────────────────
  showGhost(id, x, z, ok) {
    for (const k in this.ghosts) this.ghosts[k].group.visible = false;
    if (!this.ghosts[id]) {
      const g = createHero(id);
      Object.values(g.mats).forEach((m) => { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; });
      g.group.traverse((o) => { o.castShadow = false; });
      this.ghosts[id] = g;
      this.scene.add(g.group);
    }
    const g = this.ghosts[id];
    const y = this.heightAt(x, z);
    g.group.visible = true;
    g.group.position.set(x, y, z);
    g.group.scale.setScalar(this.scale(g));
    g.tint(ok ? 0.75 : 1.6, ok ? 1.1 : 0.45, ok ? 1.6 : 0.45);
    g.update(0.016, performance.now() / 1000);
    const d = HEROES[id];
    // si es de distancia, el alcance de su arma
    this.moveRing.visible = false;
    if (d.type === 'ranged') this.ring.show(x, y, z, d.range, ok ? HERO_PURPLE : 0xff6a5a);
    else this.ring.visible = false;
    this.moveRing.material.color.set(ok ? 0xd8c8ff : 0xff8a7a);
  }
  hideGhost() {
    for (const k in this.ghosts) this.ghosts[k].group.visible = false;
    if (!this.selected) { this.ring.visible = false; this.moveRing.visible = false; }
  }

  setSelected(on) {
    this.selected = on;
    if (!on) { this.ring.visible = false; this.moveRing.visible = false; }
  }

  // ── Eventos de la simulación ───────────────────────────
  handle(ev) {
    switch (ev.type) {
      case 'heroPlace': this.onPlace(ev.h, ev.first); break;
      case 'heroMove': this.onMove(ev); break;
      case 'heroAttack': this.onAttack(ev); break;
      case 'heroHurt': if (this.v) this.v.hurt = 0.18; break;
      case 'heroDeath': this.onDeath(); break;
      case 'heroRespawn': this.onRespawn(); break;
      case 'heroLeap': this.onLeap(ev); break;
      case 'heroHowl': this.onHowl(ev); break;
      case 'heroUlt': this.onUlt(ev); break;
      case 'heroJam': this.onJam(ev); break;
      case 'gadget': this.addGadget(ev.g); break;
      case 'gadgetEnd': this.endGadget(ev); break;
      case 'gadgetHurt': { const r = this.gadgets.get(ev.g.uid); if (r) r.hurt = 0.15; break; }
      case 'heroRetreat': if (this.v) { const p = this.v.api.group.position; this.view.fx.text('¡Retirada!', p.x, p.y + 6, p.z, 'gold'); } break;
      default: break;
    }
  }

  onPlace(h, first) {
    if (!this.v) {
      const api = createHero(h.id);
      this.scene.add(api.group);
      const bg = new THREE.Sprite(this.view.barGeoMat.bg);
      const fgMat = new THREE.SpriteMaterial({ color: HERO_PURPLE, depthTest: false, transparent: true });
      const fg = new THREE.Sprite(fgMat);
      bg.renderOrder = fg.renderOrder = 10;
      bg.scale.set(3.4, 0.46, 1);
      fg.scale.set(3.2, 0.3, 1);
      // brillo de color en el suelo bajo sus pies: se distingue siempre entre los enemigos
      const aura = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 64), color: h.def.color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      aura.renderOrder = 2;
      this.scene.add(bg, fg, aura);
      this.v = { h, api, bg, fg, fgMat, aura, x: h.x, z: h.z, yaw: 0, deadT: 0, hurt: 0, leap: null, born: 0 };
    }
    const v = this.v;
    v.x = h.x; v.z = h.z; v.born = 0;
    const y = this.heightAt(h.x, h.z);
    this.view.fx.shockwave(h.x, h.z, HERO_PURPLE, 4, 0.5);
    this.view.fx.emit('add', { x: h.x, y: y + 0.5, z: h.z, count: 28, spread: 0.8, vel: [0, 4, 0], velSpread: 2, color: h.def.color, size: 0.5, life: 0.8, gravity: -2 });
  }

  onMove(ev) {
    const y = this.heightAt(ev.x, ev.z);
    this.marker.show(ev.x, y, ev.z, 1.6, HERO_PURPLE);
    this.markerT = 0.6;
  }

  onAttack(ev) {
    const v = this.v;
    if (!v) return;
    v.api.attack();
    const t = ev.target;
    if (ev.h.def.type === 'melee' && t) {
      // zarpazo: chispas y estela
      const y = this.heightAt(t.x, t.z) + 1.4;
      this.view.fx.emit('add', { x: t.x, y, z: t.z, count: 10, spread: 0.4, vel: [0, 1.5, 0], velSpread: 3, color: 0xfff0d0, size: 0.35, life: 0.3, gravity: 0 });
      this.view.fx.emit('norm', { x: t.x, y: y - 0.4, z: t.z, count: 4, spread: 0.3, vel: [0, 2, 0], velSpread: 2, color: 0x7a1010, size: 0.35, life: 0.5, gravity: -8 });
    }
  }

  onDeath() {
    const v = this.v;
    if (!v) return;
    v.deadT = 0.0001;
    const p = v.api.group.position;
    this.view.fx.emit('norm', { x: p.x, y: p.y + 1, z: p.z, count: 30, spread: 1, vel: [0, 2, 0], velSpread: 2, color: 0x3a2a4a, size: 1, grow: 1.8, life: 1.2, gravity: 0.2, drag: 2 });
    this.view.fx.text('¡Héroe caído!', p.x, p.y + 5, p.z, 'hurt');
  }

  onRespawn() {
    const v = this.v;
    if (!v) return;
    v.deadT = 0;
    v.x = v.h.x; v.z = v.h.z;
    v.api.revive();
    v.born = 0;
    const y = this.heightAt(v.x, v.z);
    // haz de luz al reaparecer
    this.view.fx.emit('add', { x: v.x, y: y + 6, z: v.z, count: 60, spread: 0.4, vel: [0, -8, 0], velSpread: 1.2, color: v.h.def.color, size: 0.6, life: 0.7, gravity: 0 });
    this.view.fx.shockwave(v.x, v.z, v.h.def.color, 5, 0.6);
  }

  onLeap(ev) {
    const v = this.v;
    if (!v) return;
    v.leap = { t: 0, from: { ...ev.from }, to: { ...ev.to }, r: ev.radius };
  }

  onHowl(ev) {
    const v = this.v;
    if (!v) return;
    const { x, z } = ev.h;
    for (let i = 0; i < 3; i++) setTimeout(() => this.view.fx.shockwave(x, z, 0xd8c8ff, ev.radius * (0.6 + i * 0.25), 0.6), i * 120);
    this.view.fx.emit('add', { x, y: this.heightAt(x, z) + 4, z, count: 30, spread: 0.6, vel: [0, 2, 0], velSpread: 4, color: 0xe8e0ff, size: 0.5, life: 0.8, gravity: 0 });
    this.view.shake = Math.max(this.view.shake, 0.35);
  }

  // Definitivas: nova arcana (anillos cian y rosa, estallido de runas) o frenesí (aura roja)
  onUlt(ev) {
    const v = this.v;
    if (!v) return;
    const { x, z } = ev.h;
    const y = this.heightAt(x, z);
    const fx = this.view.fx;
    if (ev.kind === 'arcaneNova') {
      for (let i = 0; i < 4; i++) setTimeout(() => fx.shockwave(x, z, i % 2 ? 0xff3fa4 : 0x4af0ff, ev.radius * (0.35 + i * 0.22), 0.7), i * 90);
      fx.emit('add', { x, y: y + 2, z, count: 120, spread: 1, vel: [0, 3, 0], velSpread: 14, color: 0x4af0ff, size: 0.7, life: 0.9, gravity: 0, drag: 2 });
      fx.emit('add', { x, y: y + 2, z, count: 60, spread: 1, vel: [0, 6, 0], velSpread: 9, color: 0xff3fa4, size: 0.6, life: 1.1, gravity: 2, drag: 1.5 });
      fx.emit('top', { x, y: y + 1, z, count: 40, spread: 2, vel: [0, 2, 0], velSpread: 6, color: 0xffe14a, size: 0.35, life: 0.8, gravity: 0 });
    } else if (ev.kind === 'rockets') {
      fx.shockwave(x, z, 0xffb03a, 5, 0.5);
      fx.emit('add', { x, y: y + 2.5, z, count: 50, spread: 0.6, vel: [0, 7, 0], velSpread: 4, color: 0xffb03a, size: 0.55, life: 0.7, gravity: 3 });
      fx.emit('norm', { x, y: y + 1.5, z, count: 24, spread: 1, vel: [0, 2, 0], velSpread: 2, color: 0x5a5048, size: 1.2, grow: 1.8, life: 1.2, gravity: 0.3, drag: 2 });
    } else {
      v.frenzy = ev.time;
      fx.shockwave(x, z, 0xff3a5a, 6, 0.6);
      fx.emit('add', { x, y: y + 2, z, count: 60, spread: 1, vel: [0, 4, 0], velSpread: 6, color: 0xff3a5a, size: 0.6, life: 0.8, gravity: 0 });
    }
  }

  // Tuerca: metralleta recalentada o encasquillada (humo durante el tiempo de espera)
  onJam(ev) {
    const v = this.v;
    if (!v) return;
    v.jam = ev.time;
    const p = v.api.group.position;
    this.view.fx.text(ev.kind === 'heat' ? '¡Recalentada!' : '¡Encasquillada!', p.x, p.y + 6, p.z, ev.kind === 'heat' ? 'hurt' : 'gold');
    const m = v.api.muzzle();
    this.view.fx.emit('add', { x: m.x, y: m.y, z: m.z, count: 12, spread: 0.2, vel: [0, 1.5, 0], velSpread: 2.5, color: 0xffa040, size: 0.35, life: 0.4, gravity: -4 });
  }

  // ── Artilugios de Tuerca ───────────────────────────────
  addGadget(g) {
    const y = this.heightAt(g.x, g.z);
    const rec = createGadget(g.kind);
    rec.g = g;
    rec.obj.position.set(g.x, y, g.z);
    if (g.kind === 'trap') {
      this.view.fx.emit('norm', { x: g.x, y: y + 0.3, z: g.z, count: 10, spread: 0.6, vel: [0, 1.5, 0], velSpread: 1.5, color: 0x9a8a72, size: 0.6, grow: 1.5, life: 0.6, gravity: 0.3 });
    } else {
      this.view.fx.shockwave(g.x, g.z, 0xffb03a, 2.5, 0.4);
      this.view.fx.emit('add', { x: g.x, y: y + 1.4, z: g.z, count: 16, spread: 0.4, vel: [0, 3, 0], velSpread: 2, color: 0xffd060, size: 0.35, life: 0.5, gravity: -5 });
      // en el camino le pegan: barra de vida
      if (g.maxHp) {
        rec.bg = new THREE.Sprite(this.view.barGeoMat.bg);
        rec.fgMat = new THREE.SpriteMaterial({ color: 0xffb03a, depthTest: false, transparent: true });
        rec.fg = new THREE.Sprite(rec.fgMat);
        rec.bg.renderOrder = rec.fg.renderOrder = 10;
        rec.bg.scale.set(2.2, 0.36, 1);
        rec.fg.scale.set(2.0, 0.22, 1);
        this.scene.add(rec.bg, rec.fg);
      }
    }
    this.scene.add(rec.obj);
    rec.born = 0;
    rec.hurt = 0;
    this.gadgets.set(g.uid, rec);
  }

  // Vista previa al apuntar el cepo o la minitorreta (verde si se puede, rojo si no)
  showGadgetGhost(kind, x, z, ok) {
    this.ghostG = this.ghostG || {};
    for (const k in this.ghostG) this.ghostG[k].obj.visible = false;
    if (!this.ghostG[kind]) { this.ghostG[kind] = createGadget(kind, { ghost: true }); this.scene.add(this.ghostG[kind].obj); }
    const gh = this.ghostG[kind];
    gh.obj.visible = true;
    gh.obj.position.set(x, this.heightAt(x, z), z);
    gh.obj.scale.setScalar(this.view.sim?.level.unitScale || 1);
    if (gh.ok !== ok) { gh.setOk(ok); gh.ok = ok; }
    if (gh.head) gh.head.rotation.y += 0.02;
  }
  hideGadgetGhost() { if (this.ghostG) for (const k in this.ghostG) this.ghostG[k].obj.visible = false; }

  onGadgetFire(t, p) {
    const r = this.gadgets.get(t.uid);
    if (!r || !r.head) return;
    r.yaw = Math.atan2(p.target.x - t.x, p.target.z - t.z);
    r.spin = 30;
    r.fire = 0.06;
  }

  endGadget(ev) {
    const r = this.gadgets.get(ev.g.uid);
    if (!r) return;
    const { x, z } = ev.g;
    const y = this.heightAt(x, z);
    const fx = this.view.fx;
    if (ev.destroyed) {
      // la minitorreta destrozada por los enemigos: chispas, piezas y humo
      fx.emit('add', { x, y: y + 1.3, z, count: 26, spread: 0.4, vel: [0, 3, 0], velSpread: 4, color: 0xffc060, size: 0.4, life: 0.5, gravity: -6 });
      fx.emit('norm', { x, y: y + 1, z, count: 10, spread: 0.5, vel: [0, 4, 0], velSpread: 3, color: 0x6a6a72, size: 0.45, life: 0.8, gravity: -9 });
      fx.emit('norm', { x, y: y + 1, z, count: 16, spread: 0.6, vel: [0, 1.5, 0], velSpread: 1.5, color: 0x3a3634, size: 1.1, grow: 1.8, life: 1, gravity: 0.3, drag: 2 });
      fx.text('¡Destrozada!', x, y + 3.2, z, 'hurt');
      this.view.shake = Math.max(this.view.shake, 0.2);
    } else if (ev.boom) {
      // ¡clac! + estallido
      fx.shockwave(x, z, 0xffb03a, ev.radius || 2.6, 0.45);
      fx.emit('add', { x, y: y + 0.6, z, count: 24, spread: 0.5, vel: [0, 4, 0], velSpread: 4, color: 0xffa040, size: 0.55, life: 0.45, gravity: -4 });
      fx.emit('norm', { x, y: y + 0.5, z, count: 18, spread: 0.8, vel: [0, 2.5, 0], velSpread: 2.5, color: 0x4a4440, size: 1.1, grow: 1.8, life: 0.9, gravity: 0.3, drag: 2 });
      this.view.shake = Math.max(this.view.shake, 0.25);
    } else {
      fx.emit('norm', { x, y: y + 0.6, z, count: 12, spread: 0.6, vel: [0, 1.5, 0], velSpread: 1.5, color: 0x8a8278, size: 0.8, grow: 1.6, life: 0.7, gravity: 0.2 });
    }
    this.removeGadget(r);
  }

  removeGadget(r) {
    this.scene.remove(r.obj);
    if (r.bg) { this.scene.remove(r.bg, r.fg); r.fgMat.dispose(); }
    r.dispose();
    this.gadgets.delete(r.g.uid);
  }

  updateGadgets(dt) {
    const time = this.view.time;
    for (const r of this.gadgets.values()) {
      r.born = Math.min(1, r.born + dt * 4);
      const k = this.view.sim?.level.unitScale || 1;
      r.obj.scale.setScalar(k * (r.born < 0.7 ? (r.born / 0.7) * 1.15 : 1.15 - ((r.born - 0.7) / 0.3) * 0.15));
      const left = r.g.until - (this.view.sim?.time ?? 0);
      // la luz parpadea más deprisa cuando le queda poco
      const blink = left < 4 ? 10 : 2.5;
      if (r.led) r.led.visible = Math.sin(time * blink * Math.PI) > -0.3;
      if (r.head) {
        if (r.yaw != null) { const d = Math.atan2(Math.sin(r.yaw - r.head.rotation.y), Math.cos(r.yaw - r.head.rotation.y)); r.head.rotation.y += d * Math.min(1, dt * 14); }
        r.spin = Math.max(0, r.spin - dt * 40);
        r.barrels.rotation.z += r.spin * dt;
        r.fire = Math.max(0, (r.fire || 0) - dt);
        r.flash.visible = r.fire > 0;
      }
      if (r.bg) {
        const p = r.obj.position, pct = Math.max(0, r.g.hp / r.g.maxHp);
        r.bg.position.set(p.x, p.y + 3.6 * k, p.z);
        r.fg.position.copy(r.bg.position);
        r.fg.scale.x = Math.max(0.001, 2.0 * pct);
        r.fg.center.set(0.5 / Math.max(pct, 0.001), 0.5);
        r.fgMat.color.set(pct > 0.5 ? 0xffb03a : pct > 0.25 ? 0xf2c230 : 0xe8463a);
        // tiembla un poco al recibir golpes
        r.hurt = Math.max(0, r.hurt - dt);
        r.obj.position.x = r.g.x + (r.hurt > 0 ? (Math.random() - 0.5) * 0.12 : 0);
      }
    }
  }

  // ── Bucle ──────────────────────────────────────────────
  update(dt, simDt) {
    const v = this.v;
    this.updateGadgets(dt);
    if (this.markerT > 0) { this.markerT -= dt; if (this.markerT <= 0) this.marker.visible = false; else this.marker.scale.setScalar(1.6 * (0.6 + this.markerT)); }
    if (!v) return;
    const h = v.h;
    const api = v.api;
    const g = api.group;
    // salto de Colmillo: arco desde «from» hasta «to»
    if (v.leap) {
      const L = v.leap;
      L.t += dt / 0.38;
      const k = Math.min(1, L.t);
      v.x = L.from.x + (L.to.x - L.from.x) * k;
      v.z = L.from.z + (L.to.z - L.from.z) * k;
      g.position.set(v.x, this.heightAt(v.x, v.z) + Math.sin(k * Math.PI) * 4, v.z);
      if (k >= 1) {
        v.leap = null;
        this.view.fx.shockwave(v.x, v.z, 0xffd38a, L.r * 1.4, 0.45);
        this.view.fx.emit('norm', { x: v.x, y: this.heightAt(v.x, v.z) + 0.3, z: v.z, count: 26, spread: 1, vel: [0, 2, 0], velSpread: 3, color: 0x9a8a72, size: 1, grow: 1.8, life: 0.8, gravity: 0.3, drag: 2.5 });
        this.view.shake = Math.max(this.view.shake, 0.5);
      }
    } else {
      // sigue a la simulación con suavizado
      const k = 1 - Math.exp(-dt * 14);
      v.x += (h.x - v.x) * k;
      v.z += (h.z - v.z) * k;
      g.position.set(v.x, this.heightAt(v.x, v.z), v.z);
    }
    // orientación
    let yaw = h.facing;
    const dy = Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw));
    v.yaw += dy * Math.min(1, dt * 10);
    g.rotation.y = v.yaw;
    // aparición con rebote
    v.born = Math.min(1, v.born + dt * 3);
    const b = v.born < 0.7 ? (v.born / 0.7) * 1.1 : 1.1 - ((v.born - 0.7) / 0.3) * 0.1;
    g.scale.setScalar(this.scale(api) * b);
    // animación, muerte y golpe recibido
    if (!h.alive) {
      v.deadT = Math.min(1, v.deadT + dt * 1.2);
      api.die(v.deadT);
    } else {
      api.update(simDt > 0 ? dt : 0, this.view.time, { moving: h.moving || !!v.leap });
    }
    // Tuerca: cañones al rojo según el calor; humo mientras está recalentada o encasquillada
    if (h.def.overheat) {
      const jammed = (this.view.sim?.time ?? 0) < (h.jamUntil || 0);
      v.api.setHeat(jammed ? 1 : (h.heat || 0) / h.def.overheat);
      if (jammed && h.alive && Math.random() < dt * 14) {
        const m = v.api.muzzle();
        this.view.fx.emit('norm', { x: m.x, y: m.y, z: m.z, count: 1, spread: 0.15, vel: [0, 1.6, 0], velSpread: 0.4, color: 0x6a6460, size: 0.6, grow: 2, life: 0.9, gravity: 0, drag: 1 });
      }
    }
    if (v.frenzy > 0 && h.alive) {
      v.frenzy -= dt;
      if (Math.random() < dt * 30) this.view.fx.emit('add', { x: g.position.x, y: g.position.y + 1 + Math.random() * 3, z: g.position.z, count: 1, spread: 0.9, vel: [0, 2.5, 0], velSpread: 0.6, color: Math.random() < 0.5 ? 0xff3a5a : 0xff8a3a, size: 0.45, life: 0.6, gravity: 0 });
    }
    v.hurt = Math.max(0, v.hurt - dt);
    const hk = v.hurt > 0 ? 1 : 0;
    const fz = v.frenzy > 0 ? 0.35 + Math.sin(this.view.time * 12) * 0.15 : 0;
    api.tint(1 + hk * 0.9 + fz, 1 - hk * 0.45 - fz * 0.4, 1 - hk * 0.45 - fz * 0.4);
    v.aura.visible = h.alive;
    v.aura.position.set(g.position.x, this.heightAt(g.position.x, g.position.z) + 0.12, g.position.z);
    v.aura.material.opacity = 0.42 + Math.sin(this.view.time * 3) * 0.12 + (this.selected ? 0.25 : 0);
    // barra de vida
    const top = g.position.y + api.height * this.scale(api) + 0.6;
    v.bg.position.set(g.position.x, top, g.position.z);
    v.fg.position.copy(v.bg.position);
    const pct = h.alive ? Math.max(0, h.hp / h.maxHp) : 0;
    v.bg.visible = v.fg.visible = h.alive;
    v.fg.scale.x = Math.max(0.001, 3.2 * pct);
    v.fg.center.set(0.5 / Math.max(pct, 0.001), 0.5);
    v.fgMat.color.set(pct > 0.5 ? HERO_PURPLE : pct > 0.25 ? 0xf2c230 : 0xe8463a);
    // cuando está seleccionado: su punto de guardia (marca discontinua) y el alcance del arma
    if (this.selected) {
      const d = h.def;
      this.moveRing.material.color.set(0xd8c8ff);
      this.showZone(h.ax, this.heightAt(h.ax, h.az), h.az, 1.6);
      if (d.type === 'ranged') this.ring.show(g.position.x, g.position.y, g.position.z, d.range, HERO_PURPLE);
      else this.ring.visible = false;
    }
  }

  showZone(x, y, z, r) {
    this.moveRing.visible = true;
    this.moveRing.position.set(x, y + 0.25, z);
    this.moveRing.scale.set(r, 1, r);
  }

  // ¿Hay un héroe cerca de este punto del suelo? (para seleccionarlo con un clic)
  at(x, z) {
    const v = this.v;
    if (!v || !v.h.alive) return false;
    return Math.hypot(v.x - x, v.z - z) < 2.4;
  }

  clear() {
    if (this.v) {
      this.scene.remove(this.v.api.group, this.v.bg, this.v.fg, this.v.aura);
      this.v.aura.geometry.dispose(); this.v.aura.material.map?.dispose(); this.v.aura.material.dispose();
      this.v.api.dispose();
      this.v.fgMat.dispose();
      this.v = null;
    }
    for (const r of [...this.gadgets.values()]) this.removeGadget(r);
    if (this.ghostG) { for (const k in this.ghostG) { this.scene.remove(this.ghostG[k].obj); this.ghostG[k].dispose(); } this.ghostG = null; }
    for (const k in this.ghosts) { this.scene.remove(this.ghosts[k].group); this.ghosts[k].dispose(); }
    this.ghosts = {};
    this.selected = false;
    this.ring.visible = false;
    this.moveRing.visible = false;
    this.marker.visible = false;
  }
}
