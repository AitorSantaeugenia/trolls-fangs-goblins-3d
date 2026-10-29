import * as THREE from 'three';
import { ENEMIES } from './config.js';

// Carga de texturas con barra de progreso
export async function loadAssets(onProgress) {
  const loader = new THREE.TextureLoader();
  const list = [];
  const tex = {};
  const add = (key, url, opts = {}) => list.push({ key, url, opts });

  for (let i = 0; i < 15; i++) {
    add(`minions_${i}`, `assets/enemies/minions/${i}.webp`, { sprite: true });
    add(`hell_${i}`, `assets/enemies/hell/${i}.webp`, { sprite: true });
  }
  const sheets = new Set(Object.values(ENEMIES).map((e) => e.sheet).filter(Boolean));
  for (const s of sheets) add(`boss_${s}`, `assets/enemies/bosses/${s}.webp`, { sprite: true });
  for (const b of ['fireball', 'rockchain', 'sandrock', 'snowball']) add(`bullet_${b}`, `assets/bullets/${b}.webp`, { sprite: true });
  for (const t of ['grass', 'stone', 'iceBox', 'lava']) add(`tile_${t}`, `assets/terrain/${t}.png`);
  add('portal', 'assets/ui/hell_castle.webp', { sprite: true });
  add('coin', 'assets/ui/coin.webp', { sprite: true });

  let done = 0;
  await Promise.all(
    list.map(
      ({ key, url, opts }) =>
        new Promise((resolve) => {
          loader.load(
            url,
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              if (opts.sprite) {
                t.generateMipmaps = true;
                t.minFilter = THREE.LinearMipmapLinearFilter;
                t.magFilter = THREE.LinearFilter;
              }
              tex[key] = t;
              onProgress?.(++done / list.length);
              resolve();
            },
            undefined,
            () => {
              console.warn('No se pudo cargar', url);
              tex[key] = new THREE.Texture();
              onProgress?.(++done / list.length);
              resolve();
            },
          );
        }),
    ),
  );
  return { tex };
}
