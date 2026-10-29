// Clima dinámico por bioma: lluvia, tormentas con rayos, niebla baja, ventisca,
// tormenta de arena y ceniza. Solo visual y sonoro: no cambia la partida.
import * as THREE from 'three';
import { audio } from './audio.js';
import { radialTexture } from './util.js';

// Estados posibles por bioma (el primero es el "tranquilo")
const STATES = {
  meadow: { calm: {}, rain: { rain: 0.55, dim: 0.78, sunDim: 0.45, fogK: 0.75, fogMix: 0.45, fogColor: 0x8a98a8, sound: 'rain', wind: [3, 1] },
    storm: { rain: 1, lightning: 0.12, dim: 0.62, sunDim: 0.3, fogK: 0.6, fogMix: 0.65, fogColor: 0x5a6474, sound: 'rain', wind: [9, 3] } },
  spooky: { calm: { mist: 0.5 }, mist: { mist: 1, fogK: 0.8 },
    storm: { rain: 0.8, lightning: 0.2, dim: 0.85, sunDim: 0.6, fogK: 0.8, mist: 0.4, sound: 'rain', wind: [6, 2] } },
  snow: { calm: {}, blizzard: { snow: 1, fogK: 0.78, fogMix: 0.35, fogColor: 0xe8f0f8, sunDim: 0.6, sound: 'wind', wind: [16, 4] } },
  desert: { calm: {}, sandstorm: { sand: 0.85, fogK: 0.75, fogMix: 0.42, fogColor: 0xd0a060, sunDim: 0.55, dim: 0.9, sound: 'wind', wind: [18, 2] } },
  hell: { calm: { ash: 0.6 }, firestorm: { ash: 0.8, embers: 1, lightning: 0.1, red: true, fogK: 0.8, fogMix: 0.4, fogColor: 0x6a1406, sound: 'wind', wind: [5, 1] } },
};
const NAMES = { rain: '🌧 Empieza a llover', storm: '⛈ Se acerca una tormenta', mist: '🌫 La niebla se levanta', blizzard: '❄ Ventisca', sandstorm: '🌪 Tormenta de arena', firestorm: '🔥 Lluvia de fuego' };

const KEYS = ['rain', 'lightning', 'dim', 'sunDim', 'fogK', 'fogMix', 'mist', 'snow', 'sand', 'ash', 'embers'];
const DEF = { rain: 0, lightning: 0, dim: 1, sunDim: 1, fogK: 1, fogMix: 0, mist: 0, snow: 0, sand: 0, ash: 0, embers: 0 };
const R = (a, b) => a + Math.random() * (b - a);

export class Weather {
  constructor(view) {
    this.view = view;
    this.enabled = true;
    this.flashEl = document.getElementById('weather-flash');
    this.mistTex = radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 128);
  }

  start(world, biomeId, quality) {
    this.muted = false; // true en la pantalla final: el clima sigue viéndose pero no suena
    this.stop();
    this.world = world;
    this.states = STATES[biomeId] || STATES.meadow;
    const env = world.env;
    this.base = {
      fogColor: env.fog.color.clone(), near: env.fog.near, far: env.fog.far, bg: env.background.clone(),
      hemi: world.hemi.intensity, sun: world.sun.intensity,
    };
    this.cur = { ...DEF };
    this.fogColor = this.base.fogColor.clone();
    this.wind = [0, 0];
    this.flash = 0;
    this.red = false;
    this.bolt = null;
    this.acc = { snow: 0, sand: 0, ash: 0, embers: 0 };
    this.group = new THREE.Group();
    this.view.scene.add(this.group);
    // lluvia: segmentos de línea reciclados
    const N = quality.rain || 1500;
    this.N = N;
    this.drops = new Float32Array(N * 3);
    this.pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) this.resetDrop(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xb8c8de, transparent: true, opacity: 0.5, depthWrite: false });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.group.add(this.rain);
    // niebla baja: grandes manchas blancas que se arrastran
    this.mist = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.mistTex, color: 0xc8d4ff, transparent: true, opacity: 0, depthWrite: false, fog: true }));
      m.position.set(R(-80, 80), R(1, 3), R(-50, 50));
      m.scale.set(R(26, 40), R(8, 12), 1);
      m.userData.v = R(0.6, 1.4);
      this.mist.push(m);
      this.group.add(m);
    }
    // primer estado: casi siempre tranquilo; el clima cambia con el tiempo
    const ids = Object.keys(this.states);
    this.set(Math.random() < 0.25 ? ids[1 + Math.floor(Math.random() * (ids.length - 1))] : ids[0], true);
  }

  stop() {
    if (this.group) {
      this.view.scene.remove(this.group);
      this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    }
    this.group = null;
    this.world = null;
    if (this.flashEl) this.flashEl.style.opacity = 0;
    audio.setAmbience(null, 0);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.world) this.set(Object.keys(this.states)[0], true);
  }

  set(id, quiet = false) {
    const ids = Object.keys(this.states);
    if (!this.enabled) id = ids[0];
    const prev = this.state;
    this.state = id;
    this.target = { ...DEF, ...this.states[id] };
    this.timer = id === ids[0] ? R(45, 90) : R(30, 55);
    let msg = null;
    if (!quiet) msg = NAMES[id] || (prev && prev !== ids[0] ? '☀ El tiempo se calma' : null);
    this.view.onWeather?.(id, msg);
  }

  // Truco «ororo»: lanza ya un fenómeno al azar del bioma, solo si ahora mismo no hay ninguno.
  // Devuelve el id elegido, 'busy' si ya hay uno en curso u 'off' si el clima está desactivado.
  forceRandom() {
    if (!this.world) return null;
    if (!this.enabled) return 'off';
    const ids = Object.keys(this.states);
    if (this.state !== ids[0]) return 'busy';
    const pool = ids.slice(1);
    const id = pool[Math.floor(Math.random() * pool.length)];
    this.set(id);
    return id;
  }

  resetDrop(i, anyY) {
    const d = this.drops;
    d[i * 3] = R(-95, 95);
    d[i * 3 + 1] = anyY ? R(0, 45) : R(38, 48);
    d[i * 3 + 2] = R(-65, 65);
  }

  update(dt) {
    if (!this.world) return;
    const ids = Object.keys(this.states);
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.state !== ids[0]) this.set(ids[0]);
      else this.set(ids[1 + Math.floor(Math.random() * (ids.length - 1))]);
    }
    const k = 1 - Math.exp(-dt / 3.5);
    for (const key of KEYS) this.cur[key] += (this.target[key] - this.cur[key]) * k;
    const tw = this.target.wind || [0, 0];
    this.wind[0] += (tw[0] - this.wind[0]) * k;
    this.wind[1] += (tw[1] - this.wind[1]) * k;
    if (this.target.fogColor != null) this._fc = this.target.fogColor;
    const c = this.cur;
    const w = this.world;
    const B = this.base;

    // rayos
    if (c.lightning > 0.02 && Math.random() < c.lightning * dt * (this.target.lightning ? 1 : 0)) this.strike(this.view.onLightning?.());
    this.flash = Math.max(0, this.flash - dt * 3.2);
    const fl = this.flash > 0 ? this.flash * (0.6 + 0.4 * Math.sin(this.flash * 40)) : 0;
    if (this.bolt) {
      this.bolt.userData.life -= dt;
      this.bolt.material.opacity = Math.max(0, this.bolt.userData.life * 5);
      if (this.bolt.userData.life <= 0) { this.group.remove(this.bolt); this.bolt.geometry.dispose(); this.bolt.material.dispose(); this.bolt = null; }
    }

    // niebla, cielo y luces
    const fogTarget = new THREE.Color(this._fc ?? B.fogColor.getHex());
    this.fogColor.copy(B.fogColor).lerp(fogTarget, c.fogMix);
    w.env.fog.color.copy(this.fogColor);
    w.env.fog.near = B.near * c.fogK;
    w.env.fog.far = B.far * (0.6 + 0.4 * c.fogK);
    const flashCol = this.target.red ? 0xff5a2a : 0xe8f0ff;
    w.env.background.copy(B.bg).lerp(this.fogColor, Math.min(1, c.fogMix * 1.1));
    if (fl > 0) { w.env.background.lerp(new THREE.Color(flashCol), fl * 0.5); w.env.fog.color.lerp(new THREE.Color(flashCol), fl * 0.4); }
    w.hemi.intensity = B.hemi * c.dim + fl * 2.2;
    w.sun.intensity = B.sun * c.sunDim + fl * 1.5;
    if (this.flashEl) {
      this.flashEl.style.opacity = (fl * 0.45).toFixed(3);
      this.flashEl.style.background = this.target.red ? 'rgba(255,90,40,.35)' : 'rgba(225,235,255,.4)';
    }

    // lluvia
    const n = Math.round(this.N * Math.min(1, c.rain));
    this.rain.geometry.setDrawRange(0, n * 2);
    if (n > 0) {
      const d = this.drops, p = this.pos;
      const vy = -48, vx = this.wind[0], vz = this.wind[1];
      const lx = vx * 0.025, ly = vy * 0.025, lz = vz * 0.025;
      let splashes = 0;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        d[j] += vx * dt; d[j + 1] += vy * dt; d[j + 2] += vz * dt;
        if (d[j + 1] < 0) {
          if (splashes < 5 && Math.random() < 0.08) {
            splashes++;
            const x = d[j], z = d[j + 2];
            this.view.fx.emit('norm', { x, y: w.heightAt(x, z) + 0.1, z, count: 2, vel: [0, 2.2, 0], velSpread: 1.2, color: 0xd6e4f2, size: 0.18, life: 0.28, gravity: 10 });
          }
          this.resetDrop(i, false);
          if (d[j] > 95) d[j] -= 190;
        }
        const o = i * 6;
        p[o] = d[j]; p[o + 1] = d[j + 1]; p[o + 2] = d[j + 2];
        p[o + 3] = d[j] - lx; p[o + 4] = d[j + 1] - ly; p[o + 5] = d[j + 2] - lz;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rainMat.opacity = 0.25 + 0.3 * Math.min(1, c.rain);
    }

    // niebla baja
    for (const m of this.mist) {
      m.position.x += (m.userData.v + this.wind[0] * 0.1) * dt;
      if (m.position.x > 95) m.position.x = -95;
      m.material.opacity = c.mist * 0.2;
      m.visible = c.mist > 0.02;
    }

    // partículas: nieve, arena, ceniza y brasas
    const fx = this.view.fx;
    const emit = (key, rate, fn) => {
      this.acc[key] += c[key] * rate * dt;
      while (this.acc[key] >= 1) { this.acc[key] -= 1; fn(); }
    };
    const [wx, wz] = this.wind;
    emit('snow', 160, () => fx.emit('norm', { x: R(-110, 70), y: R(4, 30), z: R(-55, 55), count: 1, vel: [wx * R(0.8, 1.2), -R(3, 6), wz + R(-1, 1)], velSpread: 0.6, color: 0xffffff, size: R(0.25, 0.5), life: 6, gravity: 0, drag: 0 }));
    emit('sand', 150, () => fx.emit('norm', { x: R(-120, 60), y: R(0.3, 9), z: R(-50, 50), count: 1, vel: [wx * R(0.8, 1.3), R(-0.5, 0.8), wz + R(-1.5, 1.5)], color: Math.random() < 0.5 ? 0xd8b070 : 0xc89a5a, size: R(0.4, 1.1), life: R(3, 5), gravity: 0, drag: 0, fadeIn: true }));
    emit('ash', 40, () => fx.emit('norm', { x: R(-90, 90), y: R(20, 32), z: R(-55, 55), count: 1, vel: [wx * 0.5 + R(-0.6, 0.6), -R(1.2, 2.2), R(-0.6, 0.6)], velSpread: 0.3, color: Math.random() < 0.7 ? 0x3a3232 : 0x6a5a55, size: R(0.25, 0.45), life: 12, gravity: 0, drag: 0 }));
    emit('embers', 35, () => fx.emit('add', { x: R(-90, 90), y: R(22, 34), z: R(-55, 55), count: 1, vel: [wx * 0.6, -R(4, 7), R(-0.5, 0.5)], color: Math.random() < 0.5 ? 0xff6a1a : 0xffb040, size: R(0.35, 0.7), life: 6, gravity: 0, drag: 0 }));

    if (this.muted) audio.setAmbience(null, 0);
    else audio.setAmbience(this.target.sound || (c.rain > 0.1 ? 'rain' : c.snow + c.sand > 0.1 ? 'wind' : null), Math.max(c.rain, c.snow, c.sand, c.embers * 0.6));
  }

  // Rayo: destello + relámpago dibujado en el horizonte + trueno con retraso
  // Con «at» el rayo cae sobre ese punto del mapa (golpe a un enemigo)
  strike(at) {
    this.flash = 1;
    const pts = [];
    if (at) {
      const gy = this.world.heightAt(at.x, at.z);
      let px = at.x + R(-8, 8), pz = at.z + R(-4, 4);
      for (let y = 70; y > gy + 4; y -= R(4, 8)) {
        const k = (y - gy) / 70;
        pts.push(new THREE.Vector3(at.x + (px - at.x) * k, y, at.z + (pz - at.z) * k));
        px += R(-2.5, 2.5); pz += R(-2.5, 2.5);
      }
      pts.push(new THREE.Vector3(at.x, gy, at.z));
      const fx = this.view.fx;
      fx.shockwave(at.x, at.z, this.target.red ? 0xff7a3a : 0xbfd8ff, 5, 0.5);
      fx.emit('add', { x: at.x, y: gy + 0.5, z: at.z, count: 30, spread: 0.6, vel: [0, 5, 0], velSpread: 6, color: 0xdfeaff, size: 0.5, life: 0.5, gravity: 6 });
      this.view.shake = Math.max(this.view.shake, 0.6);
    } else {
      const x = R(-80, 80), z = R(-75, -45);
      let px = x, pz = z;
      for (let y = 70; y > 0; y -= R(4, 8)) { pts.push(new THREE.Vector3(px, y, pz)); px += R(-3, 3); pz += R(-1, 1); }
      pts.push(new THREE.Vector3(px, 0, pz));
    }
    if (this.bolt) { this.group.remove(this.bolt); this.bolt.geometry.dispose(); this.bolt.material.dispose(); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 48, 0.35, 5, false);
    const col = this.target.red ? new THREE.Color(4, 1.4, 0.6) : new THREE.Color(3.5, 3.8, 5);
    const bolt = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, fog: false }));
    bolt.userData.life = 0.22;
    this.bolt = bolt;
    this.group.add(bolt);
    if (!this.muted) audio.thunder(at ? 1 : R(0.5, 0.9), at ? 0.05 : R(0.25, 1.4));
  }
}
