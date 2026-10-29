// Pantalla de derrota: seis enemigos del juego, elegidos al azar, se llevan el ataúd bailando.
// Es una escena 3D pequeña y aparte (su propio lienzo), que solo existe mientras se ve la derrota.
import * as THREE from 'three';
import { MinionRenderer, SKINS } from './minions3d.js';
import { Builder } from './util.js';

// Solo los que andan (los voladores no pueden cargar con nada)
const WALKERS = new Set(['skeleton', 'hooded', 'ogre', 'gargoyle', 'demon', 'imp']);
const POOL = [...SKINS.minions, ...SKINS.hell].filter((s) => WALKERS.has(s.a));
const PIXEL = 2.5; // se pinta a menos resolución y se amplía: aspecto de píxel, como un GIF
const BEAT = 0.52; // segundos por paso (marcha lenta)
const WHITE = [1, 1, 1];

let st = null;

// Ataúd clásico (hexagonal visto desde arriba), madera con remates dorados
function buildCoffin() {
  const outline = (w, l, k = 1) => {
    const s = new THREE.Shape();
    s.moveTo(-0.5 * w * k, -l);
    s.lineTo(0.5 * w * k, -l);
    s.lineTo(0.75 * w * k, 0.45 * l);
    s.lineTo(0.55 * w * k, l);
    s.lineTo(-0.55 * w * k, l);
    s.lineTo(-0.75 * w * k, 0.45 * l);
    s.closePath();
    return s;
  };
  const slab = (shape, depth) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // la silueta queda en el suelo y el grosor hacia arriba
    return g;
  };
  const L = 2.65, W = 1.45;
  const b = new Builder();
  b.add(slab(outline(W, L), 0.62), 0x9a6234, { jitter: 0.06 }); // caja
  b.add(slab(outline(W * 1.04, L * 1.015), 0.1), 0x5a361c, { y: 0.24 }); // moldura oscura
  b.add(slab(outline(W * 1.06, L * 1.02), 0.12), 0xc48a4c, { y: 0.62, jitter: 0.05 }); // tapa
  b.add(slab(outline(W * 0.82, L * 0.9), 0.1), 0xdba468, { y: 0.74 }); // relieve de la tapa
  // asas doradas a los lados
  for (const s of [-1, 1]) {
    for (const z of [-1.55, -0.2, 1.05]) {
      const x = s * (0.5 + (0.75 - 0.5) * ((-z + L) / (1.45 * L))) * W + s * 0.06;
      b.add(new THREE.BoxGeometry(0.1, 0.12, 0.62), 0xffd23a, { x, y: 0.36, z });
    }
  }
  b.add(new THREE.BoxGeometry(0.42, 0.06, 0.12), 0xffd23a, { y: 0.85, z: -1.15 }); // placa de la tapa
  const geo = b.geometry();
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.65, metalness: 0.05 }));
}

const pick = () => {
  const out = [];
  for (let i = 0; i < 6; i++) out.push(POOL[Math.floor(Math.random() * POOL.length)]);
  return out;
};

// box: el contenedor (#coffin). Cada vez se crea un lienzo nuevo y al ocultarlo se libera.
export function showCoffin(box) {
  hideCoffin();
  const canvas = document.createElement('canvas');
  box.replaceChildren(canvas);
  box.classList.remove('hidden');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  } catch {
    box.classList.add('hidden'); // sin WebGL extra: la derrota se ve igual, sin el desfile
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2a1a14, 1.6));
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
  sun.position.set(5, 9, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  camera.position.set(7.2, 4.4, 10.5);
  camera.lookAt(0.2, 1.75, 0);
  const minions = new MinionRenderer(scene);
  const coffin = buildCoffin();
  scene.add(coffin);
  const crew = pick().map((skin, i) => ({
    skin,
    side: i < 3 ? -1 : 1,
    row: i % 3,
    scale: 0.92 + Math.random() * 0.1,
  }));
  const pos = new THREE.Vector3();
  st = { renderer, scene, camera, minions, coffin, crew, canvas, box, raf: 0, t0: performance.now(), w: 0, h: 0 };

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth / PIXEL));
    const h = Math.max(1, Math.round(canvas.clientHeight / PIXEL));
    if (w === st.w && h === st.h) return;
    st.w = w; st.h = h;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const frame = () => {
    if (!st) return;
    st.raf = requestAnimationFrame(frame);
    resize();
    const t = (performance.now() - st.t0) / 1000;
    const beat = t / BEAT;
    // coreografía: paso a paso, balanceo de lado a lado y cada 8 pasos todos se agachan a la vez
    const sway = Math.sin(beat * Math.PI) * 0.32;
    const bar = beat % 8;
    const dip = bar > 6 ? Math.sin((bar - 6) / 2 * Math.PI) * 0.55 : 0;
    const bob = Math.abs(Math.sin(beat * Math.PI)) * 0.12;
    const ph = beat * Math.PI;
    minions.begin();
    for (const c of crew) {
      pos.set(c.side * 0.95 + sway, -dip - bob * 0.4, (c.row - 1) * 1.75);
      // los de cada lado van a contrapié; el del medio un poco adelantado, como en el original
      minions.add(c.skin, pos, Math.sin(beat * Math.PI) * 0.18, c.scale, t, ph + (c.side > 0 ? Math.PI : 0) + c.row * 0.15, WHITE, 0, 1);
    }
    minions.end();
    coffin.position.set(sway, 2.95 - dip - bob * 0.5, 0);
    coffin.rotation.set(Math.sin(beat * Math.PI * 0.5) * 0.04, Math.sin(beat * Math.PI) * 0.12, Math.sin(beat * Math.PI) * 0.06);
    renderer.render(scene, camera);
  };
  frame();
}

export function hideCoffin() {
  if (!st) return;
  cancelAnimationFrame(st.raf);
  const { renderer, minions, coffin, canvas, box } = st;
  st = null;
  // las geometrías de los esbirros son compartidas con la partida: no se tocan
  coffin.geometry.dispose();
  coffin.material.dispose();
  for (const list of Object.values(minions.meshes)) for (const m of list) m.dispose();
  for (const m of Object.values(minions.mats)) m.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  canvas.remove();
  box.classList.add('hidden');
}
