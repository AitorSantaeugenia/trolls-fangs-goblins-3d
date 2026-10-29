// Editor de mapas: dibuja el camino sobre una cuadrícula y guárdalo como nivel propio
import { LEVELS } from './config.js';
import { BIOME_INFO, PRESETS, MUSIC, DEFAULT_MUSIC, validatePath, upsertMap, exportCode, importCode } from './custom.js';
import { putAudio, measureGain } from './audiostore.js';
import { audio } from './audio.js';

const MAX_AUDIO_MB = 25;

const $ = (id) => document.getElementById(id);
const STEP = 50; // la cuadrícula va de 50 en 50 px del mapa original (1200 × 700)
const HALF = 20; // medio ancho del camino

export class Editor {
  constructor({ onPlay, onClose }) {
    this.onPlay = onPlay;
    this.onClose = onClose;
    this.canvas = $('ed-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hover = null;
    this.bind();
  }

  open(map) {
    this.map = map
      ? JSON.parse(JSON.stringify(map))
      : { id: `custom_${Date.now().toString(36)}`, name: 'Mi mapa', biome: 'meadow', hp: 20, gold: 600, preset: 'normal', music: DEFAULT_MUSIC, path: [] };
    if (!this.map.music) this.map.music = DEFAULT_MUSIC;
    $('ed-name').value = this.map.name;
    $('ed-hp').value = this.map.hp;
    $('ed-gold').value = this.map.gold;
    $('ed-preset').value = this.map.preset;
    $('ed-music').value = this.map.music;
    this.musicHint();
    $('ed-code-box').classList.add('hidden');
    this.renderBiomes();
    this.draw();
    this.status();
  }

  bind() {
    $('ed-preset').innerHTML = PRESETS.map((p) => `<option value="${p}">${LEVELS[p].label} · ${LEVELS[p].name}</option>`).join('');
    const pick = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 1200;
      const y = ((e.clientY - r.top) / r.height) * 700;
      let sx = Math.max(0, Math.min(1200, Math.round(x / STEP) * STEP));
      if (x > 1200 - STEP) sx = 1200; // zona del castillo
      if (x < STEP * 0.75) sx = 0; // zona de entrada
      return { x: sx, y: Math.max(STEP, Math.min(700 - STEP, Math.round(y / STEP) * STEP)) };
    };
    this.canvas.addEventListener('pointermove', (e) => { this.hover = pick(e); this.draw(); });
    this.canvas.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    this.canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); this.addPoint(pick(e)); });
    $('ed-undo').addEventListener('click', () => { this.map.path.pop(); this.after(); });
    $('ed-clear').addEventListener('click', () => { this.map.path = []; this.after(); });
    $('ed-name').addEventListener('input', (e) => { this.map.name = e.target.value.slice(0, 40); });
    $('ed-hp').addEventListener('change', (e) => { this.map.hp = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 20)); e.target.value = this.map.hp; });
    $('ed-gold').addEventListener('change', (e) => { this.map.gold = Math.max(100, Math.min(5000, parseInt(e.target.value, 10) || 600)); e.target.value = this.map.gold; });
    $('ed-preset').addEventListener('change', (e) => { this.map.preset = e.target.value; });
    // Música: el tema libre por defecto, pistas del juego, silencio o un audio propio del ordenador
    $('ed-music').innerHTML = MUSIC.map((m) => `<option value="${m.id}">${m.label}</option>`).join('');
    $('ed-music').addEventListener('change', (e) => {
      if (e.target.value === 'custom') { $('ed-music-file').click(); e.target.value = this.map.music; return; }
      this.map.music = e.target.value;
      this.musicHint();
    });
    $('ed-music-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!f.type.startsWith('audio/')) { this.toast('Ese archivo no es un audio'); return; }
      if (f.size > MAX_AUDIO_MB * 1024 * 1024) { this.toast(`El audio no puede pasar de ${MAX_AUDIO_MB} MB`); return; }
      this.toast('Preparando el audio…');
      try {
        const gain = audio.ctx ? await measureGain(audio.ctx, f) : 1;
        await putAudio({ id: this.map.id, blob: f, name: f.name, gain });
        this.map.music = 'custom';
        this.map.musicName = f.name;
        $('ed-music').value = 'custom';
        this.musicHint();
        this.toast('Audio guardado para este mapa');
      } catch {
        this.toast('No se pudo guardar el audio en este navegador');
      }
    });
    $('ed-play').addEventListener('click', () => { if (this.commit()) this.onPlay(this.map.id); });
    $('ed-save').addEventListener('click', () => { if (this.commit()) this.toast('Mapa guardado en «Mis mapas»'); });
    $('ed-back').addEventListener('click', () => this.onClose());
    $('ed-export').addEventListener('click', () => {
      const why = validatePath(this.map.path);
      if (why) { this.toast(why); return; }
      $('ed-code-box').classList.remove('hidden');
      $('ed-code').value = exportCode(this.map);
      $('ed-code').select();
      $('ed-code-hint').textContent = 'Copia este código y compártelo. Para cargar uno, pégalo aquí y pulsa «Cargar código».';
    });
    $('ed-copy').addEventListener('click', async () => {
      const t = $('ed-code');
      try { await navigator.clipboard.writeText(t.value); this.toast('Código copiado'); } catch { t.select(); this.toast('Selecciónalo y cópialo con Ctrl+C'); }
    });
    $('ed-import').addEventListener('click', () => {
      const box = $('ed-code-box');
      if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
        $('ed-code').value = '';
        $('ed-code-hint').textContent = 'Pega aquí un código TFG1:… y pulsa otra vez «Cargar código».';
        $('ed-code').focus();
        return;
      }
      try {
        const m = importCode($('ed-code').value);
        this.open(m);
        this.toast(`Cargado: ${m.name}`);
      } catch (err) { this.toast(err.message || 'Código no válido'); }
    });
  }

  musicHint() {
    const el = $('ed-music-hint');
    const m = this.map.music;
    el.classList.toggle('warn', m === 'custom');
    if (m === 'custom') el.textContent = `🎵 ${this.map.musicName || 'Audio propio'} · solo en este navegador: no se incluye al compartir el código.`;
    else if (m === DEFAULT_MUSIC) el.textContent = 'Tema compuesto para el juego, de uso libre.';
    else if (m === 'none') el.textContent = 'El mapa se jugará sin música.';
    else el.textContent = 'Música del juego original (no es de uso libre).';
  }

  renderBiomes() {
    $('ed-biomes').innerHTML = Object.entries(BIOME_INFO).map(([id, b]) =>
      `<button class="ed-biome ${id === this.map.biome ? 'on' : ''}" data-b="${id}" style="--c:${b.color};--p:${b.path}">${b.label}</button>`).join('');
    $('ed-biomes').querySelectorAll('.ed-biome').forEach((el) => el.addEventListener('click', () => { this.map.biome = el.dataset.b; this.renderBiomes(); this.draw(); }));
  }

  // Añade un punto; si no está alineado con el anterior, mete una esquina automática
  addPoint(p) {
    const path = this.map.path;
    if (!path.length) {
      path.push([0, p.y]);
      if (p.x > 0) path.push([p.x, p.y]);
    } else {
      const last = path[path.length - 1];
      if (last[0] === 1200) { this.toast('El camino ya llega al castillo. Usa «Deshacer» para cambiarlo.'); return; }
      if (p.x === last[0] && p.y === last[1]) return;
      if (p.x !== last[0] && p.y !== last[1]) path.push([p.x, last[1]]);
      path.push([p.x, p.y]);
    }
    // quita puntos intermedios alineados (A-B-C en línea → A-C)
    for (let i = path.length - 2; i > 0; i--) {
      const [a, b, c] = [path[i - 1], path[i], path[i + 1]];
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) {
        const sameDir = Math.sign(b[0] - a[0]) === Math.sign(c[0] - b[0]) && Math.sign(b[1] - a[1]) === Math.sign(c[1] - b[1]);
        if (sameDir) path.splice(i, 1);
      }
    }
    this.after();
  }

  after() { this.draw(); this.status(); }

  status() {
    const why = validatePath(this.map.path);
    const el = $('ed-status');
    if (!this.map.path.length) el.textContent = 'Toca el borde izquierdo para empezar el camino; luego ve tocando puntos hasta el borde derecho.';
    else el.textContent = why || '¡Camino completo! Ya puedes probarlo o guardarlo.';
    el.classList.toggle('ok', !why);
    $('ed-play').disabled = !!why;
    $('ed-save').disabled = !!why;
  }

  commit() {
    const why = validatePath(this.map.path);
    if (why) { this.toast(why); return false; }
    this.map.name = ($('ed-name').value || 'Mi mapa').slice(0, 40);
    this.map.thumb = this.thumbnail();
    upsertMap(this.map);
    return true;
  }

  thumbnail() {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 175;
    this.paint(c.getContext('2d'), 300 / 1200, false);
    return c.toDataURL('image/jpeg', 0.75);
  }

  draw() {
    const cv = this.canvas;
    const w = cv.clientWidth || 600;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * 700 / 1200); }
    this.paint(this.ctx, cv.width / 1200, true);
  }

  // Dibuja el mapa a escala k (1 = 1200 × 700)
  paint(g, k, editing) {
    const B = BIOME_INFO[this.map.biome];
    g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = B.color;
    g.fillRect(0, 0, 1200, 700);
    if (editing) {
      g.strokeStyle = 'rgba(0,0,0,.18)';
      g.lineWidth = 1 / k;
      for (let x = 0; x <= 1200; x += STEP) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 700); g.stroke(); }
      for (let y = 0; y <= 700; y += STEP) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
      g.fillStyle = 'rgba(255,220,120,.18)';
      g.fillRect(0, 0, STEP / 2, 700);
      g.fillStyle = 'rgba(120,200,255,.18)';
      g.fillRect(1200 - STEP / 2, 0, STEP / 2, 700);
    }
    const path = this.map.path;
    const rect = (a, b, h, col) => {
      g.fillStyle = col;
      g.fillRect(Math.min(a[0], b[0]) - h, Math.min(a[1], b[1]) - h, Math.abs(a[0] - b[0]) + 2 * h, Math.abs(a[1] - b[1]) + 2 * h);
    };
    for (let i = 1; i < path.length; i++) rect(path[i - 1], path[i], HALF + 6, 'rgba(0,0,0,.35)');
    for (let i = 1; i < path.length; i++) rect(path[i - 1], path[i], HALF, B.path);
    if (path.length === 1) rect(path[0], path[0], HALF, B.path);
    // previsualización del siguiente tramo
    if (editing && this.hover && path.length && path[path.length - 1][0] !== 1200) {
      const last = path[path.length - 1];
      const h = this.hover;
      g.globalAlpha = 0.45;
      const corner = h.x !== last[0] && h.y !== last[1] ? [h.x, last[1]] : null;
      if (corner) { rect(last, corner, HALF, B.path); rect(corner, [h.x, h.y], HALF, B.path); } else rect(last, [h.x, h.y], HALF, B.path);
      g.globalAlpha = 1;
    }
    if (editing) {
      g.fillStyle = '#fff';
      for (const [x, y] of path) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
      if (this.hover) { g.strokeStyle = '#ffd36a'; g.lineWidth = 3; g.beginPath(); g.arc(this.hover.x, this.hover.y, 10, 0, Math.PI * 2); g.stroke(); }
      g.font = 'bold 26px Georgia';
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillText('Entrada', 10, 34);
      g.textAlign = 'right';
      g.fillText('Castillo', 1190, 34);
      g.textAlign = 'left';
    }
    if (path.length && path[path.length - 1][0] === 1200) {
      const [, y] = path[path.length - 1];
      g.fillStyle = '#7a6a5a';
      g.fillRect(1160, y - 50, 40, 100);
    }
  }

  toast(msg) {
    const el = $('ed-toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove('show'), 2200);
  }
}
