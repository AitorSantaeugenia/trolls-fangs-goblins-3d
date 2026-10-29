import { getAudio } from './audiostore.js';
// Música (HTMLAudio en streaming) + efectos (WebAudio, se pueden solapar).
//
// Niveles (antes del volumen general MASTER): la música suena a 0.35 (entre −27 y −21 LUFS según la pista). Todos los
// efectos se calibran para quedar por debajo de la pista más baja (objetivo ≈ −33 LUFS),
// salvo el chasquido de Thanos, que va por encima a propósito.

// Volumen general del juego: −3 dB sobre todo (música, efectos, clima y Thanos por igual)
export const MASTER = 0.71;

const SFX = ['jobdone', 'liveless', 'moregold', 'newgame', 'victorySound', 'inevitable', 'deadSong', 'thanosSnap', 'thanosDeath'];

// Ganancia de cada archivo, calculada con su sonoridad medida (ffmpeg ebur128)
const LEVEL = {
  jobdone: 0.13, // −15.2 LUFS
  liveless: 0.08, // −11.1
  moregold: 0.16, // −17.4
  newgame: 0.13, // −15.0
  victorySound: 0.3, // −17.1 (suena con la música parada)
  deadSong: 0.2, // −13.9 (ídem)
  inevitable: 1.2, // −27.3 → ≈ −26: al nivel de la música (que baja a la mitad mientras suena)
  thanosSnap: 0.3, // −12.2 → ≈ −23 (chasquido)
  thanosDeath: 0.14, // −9.1 → ≈ −26: al nivel de «I am inevitable» (muerte por el guantelete)
};
// Música: todas las pistas igualadas a ≈ −18 LUFS (medido con ffmpeg ebur128)
const MUSIC_GAIN = {
  musicbg: 0.89, // −17.0 LUFS
  twistedTreelineSong: 1, // −18.0
  powerofthehordeSong: 0.48, // −11.6 (era ~6 dB más fuerte que el resto)
  goblinMarch: 0.67, // −16.0 → ≈ −19.5: 1.5 dB menos porque apenas tiene dinámica y suena más «llena»
};

const LOUD = new Set(['inevitable', 'thanosSnap', 'thanosDeath']);

// ── Sintetizador (funciones puras: sirven con AudioContext y OfflineAudioContext) ──
export function makeNoise(c, seconds = 9) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
  return b;
}

const R = (a, b) => a + Math.random() * (b - a);

// Tono con barrido de frecuencia y envolvente rápida
function tone(c, out, t, { type = 'sine', f0, f1 = f0, dur, vol, attack = 0.004 }) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  return o;
}

// Ráfaga de ruido filtrado
function burst(c, out, t, noise, { type = 'bandpass', f0, f1 = f0, q = 1, dur, vol, attack = 0.003, rate = 1 }) {
  const s = c.createBufferSource();
  s.buffer = noise;
  s.playbackRate.value = rate;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * (noise.duration - dur - 0.1));
  s.stop(t + dur + 0.02);
  return s;
}

// Disparo de cada torre (por tipo de proyectil). p = variación de tono.
export const SHOTS = {
  sand: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'highpass', f0: 2200 * p, f1: 1200 * p, dur: 0.05, vol: 0.5 }), tone(c, o, t, { type: 'triangle', f0: 520 * p, f1: 300 * p, dur: 0.045, vol: 0.12 })],
  rock: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'lowpass', f0: 900 * p, f1: 200, dur: 0.12, vol: 0.5 }), tone(c, o, t + 0.01, { type: 'triangle', f0: 170 * p, f1: 70, dur: 0.14, vol: 0.32 })],
  snow: (c, o, t, n, p) => [tone(c, o, t, { type: 'sine', f0: 1900 * p, f1: 2600 * p, dur: 0.09, vol: 0.12 }), tone(c, o, t + 0.02, { type: 'sine', f0: 2850 * p, f1: 3300 * p, dur: 0.07, vol: 0.06 }), burst(c, o, t, n, { type: 'highpass', f0: 5000, dur: 0.05, vol: 0.12 })],
  bullet: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'bandpass', f0: 1600 * p, f1: 500, q: 0.8, dur: 0.06, vol: 0.55 }), tone(c, o, t, { type: 'square', f0: 220 * p, f1: 90, dur: 0.05, vol: 0.06 })],
  shell: (c, o, t, n, p) => [tone(c, o, t, { type: 'sine', f0: 110 * p, f1: 38, dur: 0.38, vol: 0.55, attack: 0.006 }), burst(c, o, t, n, { type: 'lowpass', f0: 1400, f1: 120, dur: 0.3, vol: 0.55 })],
  poison: (c, o, t, n, p) => [0, 0.05, 0.1].map((d, i) => tone(c, o, t + d, { type: 'sine', f0: (320 + i * 90) * p, f1: (620 + i * 120) * p, dur: 0.06, vol: 0.09 })),
  fire: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'bandpass', f0: 500 * p, f1: 1600 * p, q: 0.7, dur: 0.16, vol: 0.4, attack: 0.02, rate: 0.7 })],
  // metralleta de Tuerca: chasquido corto y seco (suena muchas veces por segundo, por eso flojo)
  gatling: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'bandpass', f0: 2400 * p, f1: 900, q: 1.2, dur: 0.035, vol: 0.3 }), tone(c, o, t, { type: 'square', f0: 160 * p, f1: 80, dur: 0.03, vol: 0.04 })],
  // cohete: siseo que sube
  rocket: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'bandpass', f0: 600 * p, f1: 2400 * p, q: 0.9, dur: 0.35, vol: 0.35, attack: 0.03 })],
};

// Impactos con peso (piedra, obús, meteorito, rayo)
export const HITS = {
  rock: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'lowpass', f0: 600 * p, f1: 120, dur: 0.16, vol: 0.45 }), tone(c, o, t, { type: 'sine', f0: 95 * p, f1: 45, dur: 0.16, vol: 0.3 })],
  shell: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'lowpass', f0: 1800 * p, f1: 90, dur: 0.5, vol: 0.6 }), tone(c, o, t, { type: 'sine', f0: 75 * p, f1: 32, dur: 0.5, vol: 0.55 })],
  rocket: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'lowpass', f0: 1600 * p, f1: 100, dur: 0.4, vol: 0.5 }), tone(c, o, t, { type: 'sine', f0: 90 * p, f1: 36, dur: 0.38, vol: 0.4 })],
  // cepo: ¡clac! metálico y estallido
  trap: (c, o, t, n, p) => [tone(c, o, t, { type: 'square', f0: 1400 * p, f1: 700, dur: 0.04, vol: 0.12 }), burst(c, o, t + 0.03, n, { type: 'lowpass', f0: 1400 * p, f1: 120, dur: 0.3, vol: 0.5 }), tone(c, o, t + 0.03, { type: 'sine', f0: 110 * p, f1: 45, dur: 0.3, vol: 0.35 })],
  meteor: (c, o, t, n, p) => [burst(c, o, t, n, { type: 'lowpass', f0: 2200 * p, f1: 70, dur: 0.8, vol: 0.7 }), tone(c, o, t, { type: 'sine', f0: 65 * p, f1: 28, dur: 0.8, vol: 0.7, attack: 0.01 })],
};

// Volumen global de cada familia (calibrado con tools/audiolevels.cjs)
export const BUS = { towers: 0.115, hits: 0.145, thunder: 0.14, rain: 0.027, wind: 0.064 };
const GAP = { sand: 0.07, rock: 0.09, snow: 0.08, bullet: 0.07, shell: 0.12, poison: 0.1, fire: 0.16, gatling: 0.09, rocket: 0.1, h_rocket: 0.08, h_trap: 0.06, h_rock: 0.08, h_shell: 0.1, h_meteor: 0.08 };
const MAX_VOICES = 12;

export function thunderVoice(c, out, t, noise, vol = 1) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.5 + Math.random() * 0.2;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(90, t + 2.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.4 * vol, t + 0.05);
  g.gain.setValueAtTime(1.1 * vol, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + 3.4);
  return src;
}

class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.music = null;
    this.musicName = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.musicVolume = 0.35 * MASTER; // 0.25
    this.unlocked = false;
    this.lastPlay = {};
    this.playing = new Set(); // efectos largos que hay que poder cortar
    this.live = new Set(); // voces sintetizadas activas
  }
  async init() {
    try {
      const c = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      this.out = c.createGain(); // salida de todos los efectos (se corta al ir a un menú)
      this.out.gain.value = MASTER;
      this.out.connect(c.destination);
      this.gain = c.createGain(); // efectos normales
      this.gain.connect(this.out);
      this.loud = c.createGain(); // Thanos
      this.loud.connect(this.out);
      this.bus = {};
      for (const [k, v] of Object.entries(BUS)) { const g = c.createGain(); g.gain.value = v; g.connect(this.gain); this.bus[k] = g; }
      this._noise = makeNoise(c);
      await Promise.all(SFX.map(async (n) => {
        try {
          const res = await fetch(`assets/audio/${n}.mp3`);
          const buf = await res.arrayBuffer();
          this.buffers[n] = await new Promise((ok, ko) => c.decodeAudioData(buf, ok, ko));
        } catch (e) { console.warn('sfx', n, e); }
      }));
    } catch (e) {
      console.warn('Audio no disponible', e);
    }
  }
  // Los navegadores móviles exigen un gesto del usuario para sonar
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.ctx?.resume?.();
    if (this.music && this.musicOn) this.music.play().catch(() => {});
  }
  get ready() { return this.sfxOn && this.ctx && this.unlocked; }

  play(name, vol = 1, minGap = 0.05) {
    if (!this.sfxOn || !this.ctx || !this.buffers[name]) return;
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return;
    this.lastPlay[name] = now;
    this.gameOn();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    const g = this.ctx.createGain();
    g.gain.value = vol * (LEVEL[name] ?? 0.15);
    src.connect(g).connect(LOUD.has(name) ? this.loud : this.gain);
    src.start();
    if (src.buffer.duration > 1.5) {
      this.playing.add(src);
      src.onended = () => this.playing.delete(src);
    }
    return src;
  }

  // Voces sintetizadas con límite y separación mínima por tipo
  voice(key, bus, make) {
    if (!this.ready || this.live.size >= MAX_VOICES) return;
    const now = this.ctx.currentTime;
    if (this.lastPlay[key] && now - this.lastPlay[key] < (GAP[key] || 0.06)) return;
    this.lastPlay[key] = now;
    const nodes = make(this.ctx, this.bus[bus], now + 0.005, this._noise, R(0.92, 1.08)).flat().filter(Boolean);
    const last = nodes[nodes.length - 1];
    for (const n of nodes) this.live.add(n);
    last.onended = () => nodes.forEach((n) => this.live.delete(n));
  }
  shot(kind) { if (SHOTS[kind]) this.voice(kind, 'towers', SHOTS[kind]); }
  impact(kind) { if (HITS[kind]) this.voice(`h_${kind}`, 'hits', HITS[kind]); }

  // Trueno: ruido grave filtrado con un retumbe que se apaga
  thunder(vol = 1, delay = 0) {
    if (!this.ready) return;
    const src = thunderVoice(this.ctx, this.bus.thunder, this.ctx.currentTime + delay, this._noise, vol);
    this.live.add(src);
    src.onended = () => this.live.delete(src);
  }

  // Ambiente continuo: 'rain', 'wind' o null; level 0..1
  setAmbience(kind, level) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this.amb || this.amb.kind !== kind) {
      if (this.amb) { const old = this.amb; old.g.gain.setTargetAtTime(0, c.currentTime, 0.4); setTimeout(() => this.killAmb(old), 2000); }
      this.amb = null;
      if (!kind) return;
      const src = c.createBufferSource();
      src.buffer = this._noise;
      src.loop = true;
      const f = c.createBiquadFilter();
      if (kind === 'rain') { f.type = 'highpass'; f.frequency.value = 900; } else { f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6; }
      // variaciones lentas e irregulares (dos osciladores desfasados) para que no suene a bucle
      const mod = c.createGain();
      mod.gain.value = 1;
      const lfos = [[0.11, 0.18], [0.043, 0.12]].map(([hz, depth]) => {
        const o = c.createOscillator();
        o.frequency.value = hz * (0.8 + Math.random() * 0.4);
        const d = c.createGain();
        d.gain.value = depth;
        o.connect(d).connect(mod.gain);
        o.start();
        return o;
      });
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(f).connect(mod).connect(g).connect(this.bus[kind] || this.bus.wind);
      src.start(0, Math.random() * 8);
      this.amb = { kind, src, f, g, lfos };
    }
    const target = this.sfxOn && this.unlocked ? level : 0;
    this.amb.g.gain.setTargetAtTime(target, c.currentTime, 0.6);
    if (kind === 'wind') this.amb.f.frequency.setTargetAtTime(300 + level * 500 + Math.sin(c.currentTime * 0.7) * 120, c.currentTime, 0.5);
  }
  killAmb(a) {
    try { a.src.stop(); a.lfos.forEach((o) => o.stop()); } catch { /* ya parado */ }
  }

  // ── Thanos: efecto de muerte con el resto del juego al mínimo ──
  // «extra»: segundos de más con el juego atenuado (la cámara lenta del final)
  thanosKill(extra = 0) {
    if (!this.ctx || !this.buffers.thanosDeath) return 0;
    this.play('thanosDeath', 1, 0);
    const dur = this.buffers.thanosDeath.duration;
    this.duck(dur + extra);
    return dur;
  }
  // Baja música y efectos normales casi a cero durante «secs» y luego los restablece
  duck(secs, level = 0.03, musicLevel = level) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(level, now, 0.08);
    this.gain.gain.setTargetAtTime(1, now + secs - 0.3, 0.25);
    this.ducked = true;
    this.fadeMusic(musicLevel, 0.3);
    clearTimeout(this._duckT);
    this._duckT = setTimeout(() => this.unduck(), Math.max(0, secs - 0.3) * 1000);
  }
  unduck() {
    clearTimeout(this._duckT);
    if (!this.ducked) return;
    this.ducked = false;
    if (this.ctx) { const now = this.ctx.currentTime; this.gain.gain.cancelScheduledValues(now); this.gain.gain.setTargetAtTime(1, now, 0.25); }
    this.fadeMusic(1, 0.9);
  }
  // Fundido del volumen de la música (HTMLAudio) a «k» × su volumen normal
  fadeMusic(k, secs) {
    clearInterval(this._fadeT);
    const a = this.music;
    if (!a) return;
    const from = a.volume, to = (this.musicBase ?? this.musicVolume) * k, t0 = performance.now();
    this._fadeT = setInterval(() => {
      const x = Math.min(1, (performance.now() - t0) / (secs * 1000));
      if (this.music === a) a.volume = from + (to - from) * x;
      if (x >= 1) clearInterval(this._fadeT);
    }, 30);
  }

  // Al salir a un menú: corta en seco todo lo que sea de la partida (efectos, clima, truenos)
  silenceGame() {
    if (!this.ctx) return;
    if (this.amb) { this.killAmb(this.amb); this.amb = null; }
    for (const n of this.live) { try { n.stop(); } catch { /* */ } }
    this.live.clear();
    this.stopLong();
    if (this.ducked) { this.ducked = false; clearTimeout(this._duckT); clearInterval(this._fadeT); this.gain.gain.cancelScheduledValues(this.ctx.currentTime); this.gain.gain.setValueAtTime(1, this.ctx.currentTime); if (this.music) this.music.volume = this.musicBase ?? this.musicVolume; }
    // por si queda algo programado: silencio inmediato de la salida, que vuelve al jugar
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0, this.ctx.currentTime);
    this.muted = true;
  }
  gameOn() {
    if (!this.muted || !this.ctx) return;
    this.muted = false;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(MASTER, this.ctx.currentTime);
  }

  // name: pista de assets/audio, 'none' (silencio) o 'custom:<id>' (audio propio de un mapa)
  playMusic(name, loop = true) {
    if (this.musicName === name && (this.music || name === 'none')) {
      if (this.music && this.musicOn && this.music.paused) this.music.play().catch(() => {});
      return;
    }
    this.stopMusic();
    if (!name) return;
    this.musicName = name;
    if (name === 'none') return;
    const start = (src, gain = 1) => {
      if (this.musicName !== name) return;
      const a = new Audio(src);
      a.loop = loop;
      this.musicBase = this.musicVolume * gain;
      a.volume = this.musicBase;
      this.music = a;
      clearInterval(this._fadeT);
      if (this.musicOn && this.unlocked) a.play().catch(() => {});
    };
    if (name.startsWith('custom:')) {
      const fallback = () => start('assets/audio/goblinMarch.mp3', MUSIC_GAIN.goblinMarch);
      getAudio(name.slice(7)).then((rec) => {
        if (!rec) return fallback();
        if (this._url) URL.revokeObjectURL(this._url);
        this._url = URL.createObjectURL(rec.blob);
        start(this._url, rec.gain ?? 1);
      }).catch(fallback);
    } else start(`assets/audio/${name}.mp3`, MUSIC_GAIN[name] ?? 1);
  }

  // Corta los efectos largos (música de victoria/derrota, "inevitable")
  stopLong() {
    for (const src of this.playing) { try { src.stop(); } catch { /* ya parado */ } }
    this.playing.clear();
  }
  stopMusic() {
    if (this.music) { this.music.pause(); this.music.src = ''; }
    this.music = null;
    this.musicName = null;
  }
  pauseMusic() { this.music?.pause(); }
  resumeMusic() { if (this.musicOn && this.music) this.music.play().catch(() => {}); }
  setMusic(on) {
    this.musicOn = on;
    if (!on) this.music?.pause();
    else this.resumeMusic();
  }
  setSfx(on) { this.sfxOn = on; if (!on) this.setAmbience(null, 0); }
}

export const audio = new AudioManager();
