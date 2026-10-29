// Panel del héroe (estilo Warcraft III, sin adornos): retrato 3D en vivo con vida y energía,
// nombre, nivel y estadísticas, tarjetas de habilidad (Q, W, definitiva E), pasiva y AUTO.
// Efectos inspirados en Arcane: luz hextech en el marco, runas al recargar, salpicaduras
// pintadas y garabatos neón al lanzar habilidades.
import * as THREE from 'three';
import { createHero } from './heroes.js';
import { ABILITIES, ABILITY_DESC, abilityIcon } from './config.js';

const $ = (id) => document.getElementById(id);
const NEON = ['#ff3fa4', '#4af0ff', '#ffe14a', '#b48cff'];

// Garabatos neón (trazos en un lienzo de 100×100) que se dibujan alrededor del retrato
const DOODLES = [
  'M10 20 L16 8 L22 20 L8 12 L24 12 Z', // estrella
  'M80 10 C95 10 95 30 80 30 C70 30 70 18 80 18', // espiral
  'M6 80 L26 70 M20 66 L26 70 L22 76', // flecha
  'M78 78 L92 92 M92 78 L78 92', // X
  'M88 48 L80 58 L88 58 L80 70', // rayo
  'M8 46 C12 38 20 38 22 46 C24 54 14 58 8 52', // garabato
  'M44 4 L48 12 L56 12 L50 17 L52 25 L44 20 L36 25 L38 17 L32 12 L40 12 Z', // estrella grande
];

export class HeroPanel {
  constructor(game) {
    this.game = game;
    this.el = $('hero-panel');
    this.canvas = $('hpn-canvas');
    this.renderer = null;
    this.api = null;
    this.t = 0;
    this.shake = 0;
    this.cache = {};
    this.wasReady = {};
  }

  // ── Montaje para el héroe de la partida ────────────────
  mount(sim) {
    this.unmount();
    const d = sim.heroDef;
    document.body.classList.toggle('has-hero', !!d);
    this.el.classList.toggle('hidden', !d);
    if (!d) return;
    this.sim = sim;
    this.def = d;
    this.el.style.setProperty('--hc', `#${d.color.toString(16).padStart(6, '0')}`);
    $('hpn-name').textContent = d.name;
    $('hpn-class').textContent = `Nivel 1 · ${d.type === 'melee' ? 'Cuerpo a cuerpo' : 'A distancia'}`;
    const p = d.passive;
    $('hpn-passive').innerHTML = p ? `<span class="hpn-pas-icon">${p.icon}</span><span class="hpn-tip"><b>${p.name}</b> · pasiva<br>${p.desc}</span>` : '';
    // tarjetas de habilidad
    $('hpn-abil').innerHTML = sim.abilities.map((id) => {
      const A = ABILITIES[id];
      const desc = A.desc || ABILITY_DESC[id] || '';
      return `<button class="ability hcard${A.ult ? ' ult' : ''}" id="ab-${id}" data-ab="${id}">
        <span class="runes"></span><span class="ab-icon">${abilityIcon(id)}</span><span class="ab-key">${A.key}</span>
        <span class="hpn-tip"><b>${A.name}</b> · ${A.ult ? 'definitiva (energía)' : `recarga ${A.cooldown} s`}<br>${desc}</span></button>`;
    }).join('');
    this.cache = {};
    this.wasReady = {};
    this.mountPortrait(d.id);
  }

  unmount() {
    if (this.api) { this.scene.remove(this.api.group); this.api.dispose(); this.api = null; }
    this.sim = null;
    document.body.classList.remove('has-hero');
    this.el.classList.add('hidden');
    this.el.classList.remove('dead', 'sel', 'frenzy');
  }

  // Retrato: un renderizador pequeño propio con el modelo del héroe encuadrado en el busto
  mountPortrait(id) {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2a1a30, 1.3));
      const key = new THREE.DirectionalLight(0xffe0b0, 2.4);
      key.position.set(2, 3, 4);
      this.rim = new THREE.DirectionalLight(0x4af0ff, 3.2); // luz de contorno «hextech»
      this.rim.position.set(-3, 2, -3);
      this.scene.add(key, this.rim);
      this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    }
    const s = this.canvas.clientWidth || 112;
    this.renderer.setSize(s, s, false);
    this.api = createHero(id);
    const k = 1 / this.api.height;
    this.api.group.scale.setScalar(k);
    this.api.group.rotation.y = 0.45;
    this.scene.add(this.api.group);
    // encuadre de cabeza y hombros, como los retratos de Warcraft III (a partir de la cabeza real)
    this.api.update(0, 0, {});
    this.api.group.updateMatrixWorld(true);
    const hp = new THREE.Vector3();
    this.api.head.getWorldPosition(hp);
    // encuadre propio de cada héroe si lo necesita (Tuerca: cabezona y con gorro)
    const po = this.def.portrait || {};
    const fy = hp.y + 0.05 + (po.y || 0);
    this.cam.position.set(0.06, fy + 0.02, hp.z + 0.95 * (po.dist || 1));
    this.cam.lookAt(0, fy - 0.09, hp.z);
    this.rim.color.set(this.def.color);
  }

  // ── Eventos de la partida ──────────────────────────────
  onEvent(ev) {
    if (!this.api) return;
    switch (ev.type) {
      case 'heroAttack': this.api.attack(); break;
      case 'heroHurt': this.shake = 0.25; break;
      case 'heroDeath': this.doodles(2, ['#ff3a3a', '#8a8a8a']); break;
      case 'heroRespawn': this.api.revive(); this.doodles(4); break;
      case 'heroUlt': this.cast(ev.kind, true); break;
      case 'heroJam': this.shake = 0.2; this.doodles(2, ['#ffb03a', '#8a8a8a']); break;
      default: break;
    }
  }

  // Lanzar una habilidad: salpicadura pintada en su tarjeta y garabatos alrededor del retrato
  cast(id, big = false) {
    const card = $(`ab-${id}`);
    if (card) {
      const sp = document.createElement('span');
      sp.className = 'splash';
      for (let i = 0; i < 5; i++) {
        const b = document.createElement('i');
        const c = NEON[(i + Math.floor(Math.random() * 4)) % 4];
        b.style.cssText = `--c:${c};--x:${(Math.random() - 0.5) * 70}px;--y:${(Math.random() - 0.5) * 70}px;--r:${Math.random() * 360}deg;--s:${0.6 + Math.random() * 0.9};border-radius:${40 + Math.random() * 30}% ${30 + Math.random() * 40}% ${45 + Math.random() * 25}% ${35 + Math.random() * 35}%`;
        sp.appendChild(b);
      }
      card.appendChild(sp);
      setTimeout(() => sp.remove(), 900);
    }
    this.doodles(big ? 6 : 3);
    if (this.api) { this.api.attack(); this.flash = big ? 1 : 0.6; }
  }

  doodles(n, colors = NEON) {
    const svg = $('hpn-doodles');
    if (!svg) return;
    const picks = [...DOODLES].sort(() => Math.random() - 0.5).slice(0, n);
    for (const d of picks) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', colors[Math.floor(Math.random() * colors.length)]);
      p.setAttribute('class', 'doodle');
      p.style.setProperty('--rot', `${(Math.random() - 0.5) * 30}deg`);
      svg.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  }

  // ── Cada fotograma ─────────────────────────────────────
  update(dt) {
    const sim = this.sim;
    if (!sim || !this.api) return;
    const h = sim.hero;
    const d = this.def;
    this.t += dt;
    // retrato
    if (h && !h.alive) this.api.die(1);
    else this.api.update(dt, this.t, { moving: false });
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, (this.flash || 0) - dt * 1.5);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * 0.03 : 0;
    this.api.group.position.set(sx, 0, 0);
    this.api.group.rotation.y = 0.45 + Math.sin(this.t * 0.6) * 0.12;
    this.rim.intensity = 3.2 + this.flash * 6 + Math.sin(this.t * 2) * 0.4;
    const hurt = this.shake > 0 ? 1 : 0;
    this.api.tint(1 + hurt * 0.8 + this.flash * 0.3, 1 - hurt * 0.4 + this.flash * 0.3, 1 - hurt * 0.4 + this.flash * 0.5);
    this.renderer.render(this.scene, this.cam);

    // barras y estado
    const c = this.cache;
    const hp = h ? Math.round((h.hp / h.maxHp) * 100) : 100;
    const en = h ? Math.floor(h.energy || 0) : 0;
    if (c.hp !== hp) { $('hpn-hp').style.width = `${hp}%`; $('hpn-hp-t').textContent = `${hp}%`; c.hp = hp; }
    if (c.en !== en) { $('hpn-en').style.width = `${en}%`; $('hpn-en-t').textContent = `${en}%`; this.el.classList.toggle('ult-ready', en >= 100); c.en = en; }
    const dead = !!h && !h.alive;
    const deadTxt = dead ? `Vuelve en ${Math.ceil(h.respawn)} s` : !h ? (this.game.placingHero ? 'Elige su sitio' : 'Sin colocar') : '';
    if (c.dead !== deadTxt) { $('hpn-dead').textContent = deadTxt; this.el.classList.toggle('dead', dead); this.el.classList.toggle('unplaced', !h); c.dead = deadTxt; }
    const frenzy = !!h && sim.time < (h.frenzyUntil || 0);
    if (c.frenzy !== frenzy) { this.el.classList.toggle('frenzy', frenzy); c.frenzy = frenzy; c.stats = null; }
    // estadísticas (el daño crece con las oleadas)
    const power = sim.heroPower();
    const rate = (1 / d.cooldown) * (frenzy ? ABILITIES.frenzy.rate : 1);
    // Tuerca: en vez de los ataques por segundo, el calor de la metralleta (o los segundos que le quedan atascada)
    const jam = d.overheat && h ? Math.max(0, (h.jamUntil || 0) - sim.time) : 0;
    const stats = [
      ['⚔', 'Daño', `${Math.round(d.dmg * power)}${d.cleave ? ` <small>+${Math.round(d.cleave * 100)} %</small>` : d.splash ? ' <small>área</small>' : d.overheat ? ` <small>×${Math.round(rate)}/s</small>` : ''}`],
      ['🛡', 'Armadura', `${Math.round((d.armor || 0) * 100)} %`],
      ['🎯', 'Alcance', `${d.type === 'melee' ? d.reach : d.range}`],
      d.overheat ? ['🔥', 'Calor', jam > 0 ? `Atascada ${Math.ceil(jam)} s` : `${Math.floor(h?.heat || 0)} <small>/ ${d.overheat}</small>`] : ['⚡', 'Ataques', `${rate.toFixed(1)}/s`],
    ];
    const key = stats.map((s) => s[2]).join('|') + frenzy;
    if (c.stats !== key) {
      $('hpn-stats').innerHTML = stats.map(([i, n, v]) => `<div class="hpn-stat"><span class="hpn-si">${i}</span><span class="hpn-sl">${n}</span><b class="${(frenzy && n === 'Ataques') || (n === 'Calor' && jam > 0) ? 'boost' : ''}">${v}</b></div>`).join('');
      c.stats = key;
    }
    // runas girando mientras recarga y destello hextech al quedar lista
    for (const id of sim.abilities) {
      const el = $(`ab-${id}`);
      if (!el) continue;
      const ready = sim.canUse(id);
      const charging = !ready && sim.waveIndex >= 0 && !dead;
      el.classList.toggle('charging', charging);
      if (ready && this.wasReady[id] === false) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      this.wasReady[id] = ready;
    }
  }
}
