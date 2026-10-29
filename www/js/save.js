import { isTouch } from './util.js';

const KEY = 'tfg3d-save-v1';

const defaults = () => ({
  stars: {},
  flameUnlocked: false,
  settings: { music: true, sfx: true, boss3d: true, minion3d: true, quality: isTouch() ? 'medium' : 'ultra', weather: true, weatherFx: true },
});

export const save = (() => {
  let data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = { ...defaults(), ...JSON.parse(raw), settings: { ...defaults().settings, ...(JSON.parse(raw).settings || {}) } };
  } catch { /* almacenamiento no disponible */ }
  return {
    get data() { return data; },
    write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* sin almacenamiento */ } },
    reset() { const s = data.settings; data = defaults(); data.settings = s; this.write(); },
  };
})();

export const QUALITY = {
  low: { pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false, particles: 700, bloom: false, msaa: 0, rain: 400 },
  medium: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, antialias: true, particles: 1200, bloom: true, msaa: 2, rain: 1000 },
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, antialias: true, particles: 1800, bloom: true, msaa: 4, rain: 1800 },
  // Ultra: pensado para ordenador (resolución nativa, sombras finas, bloom a resolución completa)
  ultra: { pixelRatio: 3, shadows: true, shadowSize: 4096, antialias: true, particles: 3200, bloom: true, msaa: 8, bloomFull: true, rain: 3200, ultra: true },
};
