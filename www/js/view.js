import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { TOWERS } from './config.js';
import { createWorld } from './world.js';
import { createTower, createGhost, glowSprite, createGauntlet } from './models.js';
import { FX, createRangeRing } from './fx.js';
import { createBoss, BOSS_COLORS } from './bosses.js';
import { MinionRenderer, SKINS } from './minions3d.js';
import { radialTexture, clamp } from './util.js';
import { Weather } from './weather.js';
import { HeroView } from './heroview.js';


// SpriteMaterial que muestra una celda (frame) concreta de una hoja de sprites
function cellSpriteMaterial(tex) {
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3, depthWrite: true });
  m.userData.cell = { value: new THREE.Vector4(0, 0.75, 1 / 3, 1 / 4) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCell = m.userData.cell;
    sh.vertexShader = 'uniform vec4 uCell;\n' + sh.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uv * uCell.zw + uCell.xy;\n#endif',
    );
  };
  m.customProgramCacheKey = () => 'cellsprite';
  return m;
}

const BULLETS = {
  sand: { tex: 'bullet_sandrock', size: 0.9, spin: 10, glow: null },
  rock: { tex: 'bullet_rockchain', size: 1.5, spin: 5, glow: null },
  snow: { tex: 'bullet_snowball', size: 0.95, spin: 6, glow: 0x9feaff },
  fire: { tex: 'bullet_fireball', size: 1.3, spin: 12, glow: 0xff7a2a },
  bullet: { tex: 'bullet_sandrock', size: 0.55, spin: 14, glow: null, color: 0x4a4a52 },
  shell: { tex: 'bullet_rockchain', size: 1.6, spin: 4, glow: null, color: 0x5a6070 },
  poison: { tex: 'bullet_snowball', size: 0.95, spin: 6, glow: 0x7dff4a, color: 0x8dff5a },
  arcane: { tex: 'bullet_snowball', size: 1.0, spin: 9, glow: 0x4ad8ff, color: 0x9af6ff },
  gatling: { tex: 'bullet_sandrock', size: 0.32, spin: 0, glow: 0xffd060, glowSize: 1.1, color: 0xffe0a0 },
  rocket: { tex: 'bullet_fireball', size: 0.9, spin: 0, glow: 0xff8a2a, color: 0xffc080 },
};

const RGB_SHIFT = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, angle: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float angle; varying vec2 vUv;
    void main(){
      vec2 off = amount * vec2(cos(angle), sin(angle)) * (0.4 + length(vUv - 0.5));
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(texture2D(tDiffuse, vUv + off).r, c.g, texture2D(tDiffuse, vUv - off).b, c.a);
    }`,
};

export class GameView {
  constructor(canvas, assets, quality) {
    this.assets = assets;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 700);
    this.controls = new OrbitControls(this.camera, canvas);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.minPolarAngle = 0.2;
    c.maxPolarAngle = 1.12;
    c.minAzimuthAngle = -1.0;
    c.maxAzimuthAngle = 1.0;
    c.minDistance = 22;
    c.screenSpacePanning = false;
    c.zoomSpeed = 0.9;
    c.rotateSpeed = 0.6;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.addEventListener('change', () => {
      c.target.x = clamp(c.target.x, -55, 55);
      c.target.z = clamp(c.target.z, -32, 32);
      c.target.y = 0;
    });
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.textLayer = document.getElementById('float-layer');
    this.fx = new FX(this.scene, this.camera, this.textLayer, quality.particles);
    this.range = createRangeRing();
    this.scene.add(this.range);
    this.shadowTex = radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 64);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false });
    this.shadowGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
    this.barGeoMat = {
      bg: new THREE.SpriteMaterial({ color: 0x1b0d08, depthTest: false, transparent: true, opacity: 0.85 }),
    };
    this.enemyViews = new Map();
    this.towerViews = new Map();
    this.projViews = new Map();
    this.ghosts = {};
    this.time = 0;
    this.camRight = new THREE.Vector3();
    this.camFwd = new THREE.Vector3();
    this.shake = 0;
    this.boss3d = true;
    this.minion3d = true;
    this.minions = new MinionRenderer(this.scene);
    this.minions.setShadows(quality.shadows);
    this.avgColors = {};
    this.weather = new Weather(this);
    this.heroes = new HeroView(this);
    this.setupDark();
    this.setupComposer();
  }

  // Velo oscuro de Thanos: un quad a pantalla completa dibujado encima de la escena
  // (pero debajo del humo, que va en fx.top)
  setupDark() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uOpacity;
        void main(){
          float r = distance(vUv, vec2(0.5, 0.55)) * 1.35;
          // colores en espacio lineal (gris oscuro en el centro, casi negro en los bordes)
          vec3 c = mix(vec3(0.032, 0.031, 0.036), vec3(0.003, 0.0028, 0.004), smoothstep(0.1, 0.95, r));
          float a = mix(0.86, 0.97, smoothstep(0.0, 1.0, r)) * uOpacity;
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.dark = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.dark.frustumCulled = false;
    this.dark.renderOrder = 900;
    this.dark.visible = false;
    this.darkTarget = 0;
    this.darkSpeed = 2;
    this.scene.add(this.dark);
  }
  // Oscurece (1) o aclara (0) en «secs» segundos
  setDark(target, secs = 0.45) {
    this.darkTarget = target;
    this.darkSpeed = 1 / Math.max(0.05, secs);
  }
  updateDark(dt) {
    const u = this.dark.material.uniforms.uOpacity;
    const d = this.darkTarget - u.value;
    const step = this.darkSpeed * dt;
    u.value = Math.abs(d) <= step ? this.darkTarget : u.value + Math.sign(d) * step;
    this.dark.visible = u.value > 0.001;
  }

  // Brillo (bloom) sobre lava, fuego, cristales y gemas
  setupComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.quality.msaa ?? 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 1.0);
    this.composer.addPass(this.bloom);
    // separación de colores (aberración cromática) para los golpes de definitiva, estilo Arcane
    this.rgbShift = new ShaderPass(RGB_SHIFT);
    this.rgbShift.enabled = false;
    this.composer.addPass(this.rgbShift);
    this.composer.addPass(new OutputPass());
  }

  // Golpe de definitiva: zoom breve de cámara y separación de colores que se desvanece
  punch(k = 1, color = 0x4af0ff) {
    this.punchT = k;
    this.shake = Math.max(this.shake, 0.5 * k);
    this.punchColor = color;
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.minions?.setShadows(q.shadows);
    this.composer?.dispose?.();
    this.setupComposer();
    if (this.world) {
      this.bloom.threshold = this.world.env.bloom.threshold;
      this.bloom.strength = this.world.env.bloom.strength;
    }
    this.resize();
  }

  // ── Nivel ──────────────────────────────────────────────
  loadLevel(sim) {
    this.clearLevel();
    this.sim = sim;
    const world = createWorld(sim.level, sim.path, this.assets, this.quality);
    this.world = world;
    sim.obstacles = world.obstacles;
    this.scene.add(world.root);
    this.scene.background = world.env.background;
    this.scene.fog = world.env.fog;
    this.renderer.toneMappingExposure = world.env.exposure;
    this.bloom.threshold = world.env.bloom.threshold;
    this.bloom.strength = world.env.bloom.strength;
    this.bloom.radius = 0.45;
    this.tint = new THREE.Color(...world.biome.tint);
    this.weather.start(world, sim.level.biome, this.quality);
    this.resetCamera(true);
  }

  clearLevel() {
    this.weather.stop();
    this.heroes.clear();
    this.setDark(0, 0.05);
    this.dark.material.uniforms.uOpacity.value = 0;
    this.dark.visible = false;
    if (this.world) {
      this.scene.remove(this.world.root);
      this.world.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !o.material.isShared) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose?.());
        }
      });
    }
    for (const v of this.enemyViews.values()) this.removeEnemyView(v);
    for (const v of this.towerViews.values()) this.scene.remove(v.api.group);
    for (const v of this.projViews.values()) this.scene.remove(v.obj);
    this.enemyViews.clear();
    this.minions.begin();
    this.minions.end();
    (this.meteors || []).forEach((o) => this.scene.remove(o.m));
    (this.scorches || []).forEach((s) => this.scene.remove(s.m));
    this.meteors = [];
    this.scorches = [];
    this.towerViews.clear();
    this.projViews.clear();
    this.fx.clear();
    this.hideGhost();
    this.range.visible = false;
    this.world = null;
  }

  // ── Cámara ─────────────────────────────────────────────
  setInsets(i) { this.insets = i; this.resize(); }

  resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const { top, bottom, left, right } = this.insets;
    this.camera.setViewOffset(w, h, -(left - right) / 2, -(top - bottom) / 2, w, h);
    this.camera.updateProjectionMatrix();
    this.fx.setScale(this.renderer.domElement.height, this.camera.fov);
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    // el bloom trabaja a media resolución salvo en Ultra
    const bd = this.quality.bloomFull ? 1 : 2;
    this.bloom.setSize(Math.round((w * pr) / bd), Math.round((h * pr) / bd));
    this.w = w;
    this.h = h;
    if (this.fitted) this.resetCamera(true);
  }

  // Coloca la cámara para que se vea todo el mapa en el espacio libre de la UI
  resetCamera(instant = false) {
    const polar = 0.66;
    const az = 0;
    // Encuadra la zona útil: el camino dentro del mapa + margen para torres
    let minX = 60, maxX = -60, minZ = 35, maxZ = -35;
    for (const [x, z] of this.sim ? this.sim.path.mapPoints : [[-60, -35], [60, 35]]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const m = 9;
    minX = Math.max(-61, minX - m); maxX = Math.min(61, maxX + m);
    minZ = Math.max(-36, minZ - m); maxZ = Math.min(36, maxZ + m);
    const MAP_CORNERS = [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ], [(minX + maxX) / 2, minZ], [(minX + maxX) / 2, maxZ]];
    const target = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2 + 1);
    const w = this.w || window.innerWidth, h = this.h || window.innerHeight;
    const { top, bottom, left, right } = this.insets;
    const fits = (d) => {
      const cam = this.camera;
      cam.position.set(target.x + d * Math.sin(polar) * Math.sin(az), d * Math.cos(polar), target.z + d * Math.sin(polar) * Math.cos(az));
      cam.lookAt(target);
      cam.updateMatrixWorld();
      const v = new THREE.Vector3();
      for (const [x, z] of MAP_CORNERS) {
        v.set(x, 0, z).project(cam);
        const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h;
        if (px < left + 4 || px > w - right - 4 || py < top + 4 || py > h - bottom - 4) return false;
      }
      return true;
    };
    let lo = 20, hi = 600;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid; else lo = mid;
    }
    const d = hi;
    this.controls.maxDistance = Math.max(d * 1.6, 90);
    this.controls.target.copy(target);
    this.camera.position.set(target.x, d * Math.cos(polar), target.z + d * Math.sin(polar));
    this.camera.lookAt(target);
    this.controls.update();
    this.fitted = true;
    this.camera.far = d * 3 + 200;
    this.camera.updateProjectionMatrix();
  }

  pickGround(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, p) ? { x: p.x, z: p.z } : null;
  }

  towerAt(x, z) {
    if (!this.sim) return null;
    let best = null, bd = Infinity;
    for (const t of this.sim.towers) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < this.sim.footprint * 1.25 && d < bd) { bd = d; best = t; }
    }
    return best;
  }

  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h, behind: v.z > 1 };
  }

  heightAt(x, z) { return this.world ? this.world.heightAt(x, z) : 0; }

  // ── Fantasma de construcción ───────────────────────────
  showGhost(type, x, z, ok) {
    for (const k in this.ghosts) this.ghosts[k].group.visible = false;
    if (!this.ghosts[type]) {
      this.ghosts[type] = createGhost(type);
      this.scene.add(this.ghosts[type].group);
    }
    const g = this.ghosts[type];
    const y = this.heightAt(x, z);
    g.group.visible = true;
    g.group.position.set(x, y, z);
    g.group.scale.setScalar(this.sim.towerScale);
    g.setValid(ok);
    this.range.show(x, y, z, TOWERS[type].range, ok ? 0x93faa5 : 0xff6a5a);
  }
  hideGhost() {
    for (const k in this.ghosts) this.ghosts[k].group.visible = false;
    if (!this.selected) this.range.visible = false;
  }
  showRange(t) {
    this.selected = t;
    if (!t) { this.range.visible = false; return; }
    this.range.show(t.x, this.heightAt(t.x, t.z), t.z, t.range, 0xffd36a);
  }

  // ── Eventos de la simulación ───────────────────────────
  handle(ev) {
    switch (ev.type) {
      case 'spawn': this.addEnemyView(ev.e); break;
      case 'death': this.onDeath(ev.e, ev.gold, ev.silent); break;
      case 'escape': if (ev.e) this.onEscape(ev.e); break;
      case 'damage': {
        const v = this.enemyViews.get(ev.e.uid);
        if (v) v.flash = 0.1;
        break;
      }
      case 'build': this.addTowerView(ev.t); break;
      case 'upgrade': this.onUpgrade(ev.t); break;
      case 'sell': this.onSell(ev.t, ev.refund); break;
      case 'fire': this.onFire(ev.t, ev.p); break;
      case 'heroPlace': case 'heroMove': case 'heroAttack': case 'heroHurt': case 'heroDeath': case 'heroRespawn': case 'heroLeap': case 'heroHowl': case 'heroUlt': case 'heroJam': case 'heroRetreat': case 'gadget': case 'gadgetEnd': case 'gadgetHurt': this.heroes.handle(ev); break;
      case 'hit': this.onHit(ev); break;
      case 'meteor': this.onMeteor(ev); break;
      case 'meteorHit': this.onMeteorHit(ev); break;
      case 'blizzard': this.onBlizzard(); break;
      default: break;
    }
  }

  // ── Enemigos ───────────────────────────────────────────
  addEnemyView(e) {
    const key = e.code === 'm' ? `${this.sim.level.minions}_${e.skin}` : `boss_${e.def.sheet}`;
    const hgt = e.def.size * 1.25 * (this.sim.level.unitScale || 1);
    const barW = Math.max(2, Math.min(5, hgt * 0.55));
    const v = {
      e, key, hgt, barW, off: new THREE.Vector2(), center: {}, row: 1, animT: Math.random() * 3,
      flash: 0, dying: 0, escaping: 0, phase: Math.random() * 6, yaw: null,
    };
    if (this.boss3d && e.def.sheet) {
      // Jefe en 3D
      const model = createBoss(e.code);
      v.model = model;
      v.scale = (hgt * 0.95) / model.height;
      model.group.scale.setScalar(v.scale);
      v.obj = model.group;
      this.scene.add(model.group);
    } else if (this.minion3d && !e.def.sheet) {
      // Esbirro en 3D (instanciado)
      v.mskin = SKINS[this.sim.level.minions][e.skin];
      v.scale = (hgt * 1.08) / this.minions.heightOf(v.mskin);
      v.obj = new THREE.Object3D();
    } else {
      const tex = this.assets.tex[key];
      const mat = cellSpriteMaterial(tex);
      if (this.tint) mat.color.copy(this.tint);
      const sprite = new THREE.Sprite(mat);
      sprite.center.set(0.5, 0.06);
      const img = tex.image;
      const aspect = img ? (img.width / 3) / (img.height / 4) : 1;
      sprite.scale.set(hgt * aspect, hgt, 1);
      sprite.renderOrder = 1;
      v.sprite = sprite;
      v.mat = mat;
      v.obj = sprite;
      this.scene.add(sprite);
    }
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    const sr = hgt * (e.def.fly ? 0.3 : 0.32);
    shadow.scale.set(sr, 1, sr * 0.75);
    shadow.visible = !(v.model || v.mskin) || !this.quality.shadows || e.def.fly;
    const bg = new THREE.Sprite(this.barGeoMat.bg);
    bg.scale.set(barW + 0.18, 0.42, 1);
    bg.renderOrder = 10;
    const fgMat = new THREE.SpriteMaterial({ color: 0x5bd65b, depthTest: false, transparent: true });
    const fg = new THREE.Sprite(fgMat);
    fg.scale.set(barW, 0.26, 1);
    fg.renderOrder = 11;
    bg.visible = fg.visible = !!e.def.boss;
    Object.assign(v, { shadow, bg, fg, fgMat });
    this.scene.add(shadow, bg, fg);
    this.positionEnemy(v, 0);
    this.enemyViews.set(e.uid, v);
  }

  removeEnemyView(v) {
    this.scene.remove(v.obj, v.shadow, v.bg, v.fg);
    if (v.model) v.model.dispose();
    else if (v.mat) v.mat.dispose();
    v.fgMat.dispose();
  }

  positionEnemy(v, dt) {
    const e = v.e;
    const c = this.sim.path.at(e.dist, v.center);
    const tx = e.x - c.x, tz = e.z - c.z;
    const k = dt ? 1 - Math.exp(-8 * dt) : 1;
    v.off.x += (tx - v.off.x) * k;
    v.off.y += (tz - v.off.y) * k;
    const x = c.x + v.off.x, z = c.z + v.off.y;
    const ground = this.heightAt(x, z);
    const t = this.time + v.phase;
    let lift;
    if (v.mskin) lift = 0;
    else if (v.model) lift = e.def.fly ? v.model.liftY * v.scale + Math.sin(t * 2.2) * 0.4 : 0;
    else lift = e.def.fly ? 1.4 + Math.sin(t * 2.6) * 0.35 : Math.abs(Math.sin(t * 7)) * 0.12;
    v.obj.position.set(x, ground + lift, z);
    v.ground = ground;
    v.shadow.position.set(x, ground + 0.12, z);
    const top = ground + lift + v.hgt * 0.98;
    v.bg.position.set(x, top + 0.35, z);
    v.fg.position.set(x, top + 0.35, z);
    v.dirx = c.dx; v.dirz = c.dz;
  }

  updateEnemies(dt) {
    const cam = this.camera;
    this.camRight.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    this.camFwd.setFromMatrixColumn(cam.matrixWorld, 2).multiplyScalar(-1).setY(0).normalize();
    const animSpeed = 6;
    this.minions.begin();
    const ONE = [1, 1, 1];
    for (const [uid, v] of this.enemyViews) {
      const e = v.e;
      if (v.mskin && (v.dying > 0 || v.escaping > 0)) {
        const left = v.dying > 0 ? (v.dying -= dt) : (v.escaping -= dt);
        const k = 1 - Math.max(0, left) / 0.4;
        this.minions.add(v.mskin, v.obj.position, v.yaw ?? 0, v.scale * (v.escaping > 0 ? 1 - k : 1), this.time + v.phase, v.walk || 0, ONE, v.dying > 0 ? k : 0);
        v.bg.visible = v.fg.visible = false;
        v.shadow.visible = false;
        if (left <= 0) { this.removeEnemyView(v); this.enemyViews.delete(uid); }
        continue;
      }
      if (v.model && v.dying > 0) {
        // jefe 3D: cae al suelo, se desploma y se hunde
        v.dying -= dt;
        const k = 1 - Math.max(0, v.dying) / 1.3;
        v.model.die(k);
        v.obj.position.y += ((v.ground ?? 0) - v.obj.position.y) * Math.min(1, dt * 6);
        v.bg.visible = v.fg.visible = false;
        if (v.dying <= 0) { this.removeEnemyView(v); this.enemyViews.delete(uid); }
        continue;
      }
      if (v.dying > 0 || v.escaping > 0) {
        const left = v.dying > 0 ? (v.dying -= dt) : (v.escaping -= dt);
        const k = Math.max(0, left / 0.35);
        if (v.model) v.obj.scale.setScalar(v.scale * k);
        else { v.mat.opacity = k; v.sprite.scale.multiplyScalar(v.dying > 0 ? 0.97 : 1); }
        v.bg.visible = v.fg.visible = false;
        v.shadow.visible = k > 0.2;
        if (left <= 0) { this.removeEnemyView(v); this.enemyViews.delete(uid); }
        continue;
      }
      this.positionEnemy(v, dt);
      // fila de la hoja según la dirección respecto a la cámara
      const sx = v.dirx * this.camRight.x + v.dirz * this.camRight.z;
      const sz = v.dirx * this.camFwd.x + v.dirz * this.camFwd.z;
      v.row = Math.abs(sx) >= Math.abs(sz) * 0.8 ? (sx > 0 ? 0 : 2) : sz > 0 ? 3 : 1;
      const slowed = this.sim.time < e.slowUntil;
      v.animT += dt * animSpeed * (slowed ? 0.4 : 1);
      const seq = [0, 1, 2, 1];
      const frame = seq[Math.floor(v.animT) % 4];
      v.flash = Math.max(0, v.flash - dt);
      const poisoned = this.sim.time < e.poisonUntil;
      let tr = 1, tg = 1, tb = 1;
      if (v.flash > 0) [tr, tg, tb] = [1, 0.55, 0.5];
      else if (slowed) [tr, tg, tb] = [0.55, 0.8, 1.15];
      else if (poisoned) [tr, tg, tb] = [0.65, 1.1, 0.55];
      else if (!v.model && !v.mskin) [tr, tg, tb] = [this.tint.r, this.tint.g, this.tint.b];
      if (v.mskin) {
        const want = Math.atan2(v.dirx, v.dirz);
        if (v.yaw == null) v.yaw = want;
        let d = want - v.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        v.yaw += d * Math.min(1, dt * 8);
        v.walk = (v.walk || 0) + dt * (slowed ? 3 : 9);
        this.minions.add(v.mskin, v.obj.position, v.yaw, v.scale, this.time + v.phase, v.walk, [tr, tg, tb], 0);
      } else if (v.model) {
        // orientado hacia donde camina
        const want = Math.atan2(v.dirx, v.dirz);
        if (v.yaw == null) v.yaw = want;
        let d = want - v.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        v.yaw += d * Math.min(1, dt * 6);
        v.obj.rotation.y = v.yaw;
        v.model.update(dt, this.time + v.phase, slowed ? 0.35 : 1);
        v.model.tint(tr, tg, tb);
        if (v.model.fire && Math.random() < dt * 6) {
          const mp = new THREE.Vector3();
          v.model.mouth.getWorldPosition(mp);
          this.fx.emit('add', { x: mp.x + Math.sin(v.yaw) * 0.8, y: mp.y, z: mp.z + Math.cos(v.yaw) * 0.8, count: 1, spread: 0.2, vel: [Math.sin(v.yaw) * 2, 1, Math.cos(v.yaw) * 2], velSpread: 0.6, color: 0xffa040, size: 0.6, life: 0.5, gravity: 1 });
        }
      } else {
        v.mat.userData.cell.value.set(frame / 3, 1 - (v.row + 1) / 4, 1 / 3, 1 / 4);
        v.mat.color.setRGB(tr, tg, tb);
      }
      if (poisoned && Math.random() < dt * 4) {
        const sp = v.obj.position;
        this.fx.emit('add', { x: sp.x, y: sp.y + v.hgt * 0.6, z: sp.z, count: 1, spread: v.hgt * 0.2, vel: [0, 1.2, 0], velSpread: 0.3, color: 0x8dff5a, size: 0.35, life: 0.8, gravity: 0 });
      }
      // barra de vida
      const pct = Math.max(0, e.hp / e.maxHp);
      const show = e.def.boss || pct < 0.999;
      v.bg.visible = v.fg.visible = show;
      if (show) {
        v.fg.scale.x = Math.max(0.001, v.barW * pct);
        v.fg.center.set(0.5 / Math.max(pct, 0.001), 0.5);
        v.fgMat.color.set(pct > 0.5 ? 0x5bd65b : pct > 0.25 ? 0xf2c230 : 0xe8463a);
      }
    }
    this.minions.end();
  }

  // Color medio de una hoja de sprites (para teñir las partículas al morir)
  avgColor(key) {
    if (this.avgColors[key] != null) return this.avgColors[key];
    let col = 0x6a5a7a;
    try {
      const img = this.assets.tex[key]?.image;
      const c = document.createElement('canvas');
      c.width = c.height = 12;
      const g = c.getContext('2d');
      g.drawImage(img, 0, img.height / 4, img.width / 3, img.height / 4, 0, 0, 12, 12);
      const d = g.getImageData(0, 0, 12, 12).data;
      let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      if (n) col = (Math.round(r / n) << 16) | (Math.round(gg / n) << 8) | Math.round(b / n);
    } catch { /* sin canvas */ }
    this.avgColors[key] = col;
    return col;
  }

  // Estilo de muerte según el tipo de esbirro (sprites originales)
  deathStyle(e) {
    const hell = this.sim.level.minions === 'hell';
    const k = e.skin;
    if (k === 1 || (!hell && k === 11)) return 'bones';
    if (hell && [13, 2, 3, 4].includes(k)) return 'flame';
    if ((hell && k === 14) || (!hell && (k === 5 || k === 8))) return 'fire';
    if (!hell && k === 2) return 'ghost';
    if (hell && [10, 11, 12, 5, 6, 7, 8, 9].includes(k)) return 'burst';
    return 'smoke';
  }

  onDeath(e, gold, silent) {
    const v = this.enemyViews.get(e.uid);
    if (!v) return;
    const p = v.obj.position;
    const y = p.y + v.hgt * 0.45;
    if (v.model) {
      v.dying = 1.3;
      const col = BOSS_COLORS[e.code] ?? 0xffcf6a;
      if (!silent) {
        this.fx.emit('norm', { x: p.x, y, z: p.z, count: 30, spread: v.hgt * 0.25, vel: [0, 2, 0], velSpread: 3, color: 0x4a4048, size: 1.8, grow: 1.8, life: 1.1, gravity: 0.5, drag: 2.5 });
        this.fx.emit('add', { x: p.x, y, z: p.z, count: 26, spread: 0.6, vel: [0, 5, 0], velSpread: 4, color: col, size: 0.6, life: 1, gravity: -6 });
        this.fx.shockwave(p.x, p.z, col, 7, 0.7);
        this.shake = Math.min(0.6, this.shake + 0.25);
      }
      this.fx.text(`+${gold}`, p.x, p.y + v.hgt + 0.6, p.z, 'gold');
      return;
    }
    v.dying = v.mskin ? 0.4 : 0.35;
    if (!silent) {
      const big = e.def.size > 5;
      const col = this.avgColor(v.key);
      const style = big ? 'smoke' : this.deathStyle(e);
      if (style === 'bones') {
        this.fx.emit('norm', { x: p.x, y, z: p.z, count: 14, spread: 0.4, vel: [0, 4, 0], velSpread: 3, color: 0xeee4c8, colorVar: 0.15, size: 0.45, life: 1.1, gravity: -14, drag: 0.8 });
        this.fx.emit('norm', { x: p.x, y: p.y + 0.3, z: p.z, count: 6, spread: 0.5, vel: [0, 0.6, 0], velSpread: 1, color: 0x9a9080, size: 1.0, grow: 1.6, life: 0.6, gravity: 0 });
      } else if (style === 'flame') {
        this.fx.emit('add', { x: p.x, y, z: p.z, count: 22, spread: 0.4, vel: [0, 3.5, 0], velSpread: 1.4, color: col, colorVar: 0.3, size: 0.7, life: 0.8, gravity: 2 });
      } else if (style === 'fire') {
        this.fx.emit('add', { x: p.x, y, z: p.z, count: 18, spread: 0.4, vel: [0, 3, 0], velSpread: 2.5, color: 0xff8a2a, size: 0.7, life: 0.6, gravity: 1 });
        this.fx.emit('norm', { x: p.x, y: y + 0.5, z: p.z, count: 8, spread: 0.4, vel: [0, 1.6, 0], velSpread: 0.8, color: 0x2a2224, size: 1.2, grow: 1.8, life: 1, gravity: 0.3 });
      } else if (style === 'ghost') {
        this.fx.emit('add', { x: p.x, y, z: p.z, count: 14, spread: 0.6, vel: [0, 1.4, 0], velSpread: 0.5, color: 0x9a7aff, size: 1.0, life: 1.4, gravity: 0, fadeIn: true });
      } else if (style === 'burst') {
        this.fx.emit('norm', { x: p.x, y, z: p.z, count: 16, spread: 0.3, vel: [0, 3, 0], velSpread: 3.5, color: col, colorVar: 0.25, size: 0.5, life: 0.8, gravity: -12, drag: 0.6 });
        this.fx.emit('norm', { x: p.x, y, z: p.z, count: 6, spread: 0.4, vel: [0, 1, 0], velSpread: 1, color: 0x3a3040, size: 1.1, grow: 1.7, life: 0.8, gravity: 0.3 });
      } else {
        this.fx.emit('norm', { x: p.x, y, z: p.z, count: 12, spread: v.hgt * 0.2, vel: [0, 1.5, 0], velSpread: 2.2, color: col, colorVar: 0.25, size: 1.0, grow: 1.8, life: 0.8, gravity: 0.5, drag: 2.5 });
      }
      this.fx.emit('add', { x: p.x, y, z: p.z, count: big ? 16 : 6, spread: 0.3, vel: [0, 4, 0], velSpread: 3, color: 0xffd34a, size: 0.35, life: 0.8, gravity: -9 });
      if (big) this.fx.shockwave(p.x, p.z, 0xffcf6a, 6, 0.6);
    }
    this.fx.text(`+${gold}`, p.x, p.y + v.hgt + 0.6, p.z, 'gold');
  }

  // Polvo marrón al estilo "chasquido" (truco thanos)
  dust(e) {
    const v = this.enemyViews.get(e.uid);
    if (!v) return;
    const p = v.obj.position;
    for (let i = 0; i < 4; i++) {
      // capa «top»: el humo se ve por encima de la oscuridad de Thanos
      this.fx.emit('top', { x: p.x, y: p.y + v.hgt * (0.2 + i * 0.2), z: p.z, count: 14, spread: v.hgt * 0.25, vel: [1.6, 0.8, -0.4], velSpread: 0.9, color: 0x7a3a12, colorVar: 0.3, size: 0.55, grow: 2.4, life: 3.4, gravity: 0.15, drag: 0.4 });
    }
  }

  onEscape(e) {
    const v = this.enemyViews.get(e.uid);
    if (!v) return;
    v.escaping = v.mskin ? 0.4 : 0.35;
    const p = v.obj.position;
    this.fx.text('-1 ❤', p.x, p.y + v.hgt + 1, p.z, 'hurt');
    this.fx.emit('add', { x: p.x, y: p.y + 1.5, z: p.z, count: 14, spread: 1, vel: [0, 2, 0], velSpread: 2, color: 0xff3a3a, size: 0.5, life: 0.7, gravity: 0 });
  }

  // ── Torres ─────────────────────────────────────────────
  addTowerView(t) {
    const api = createTower(t.type);
    const y = this.heightAt(t.x, t.z);
    api.group.position.set(t.x, y, t.z);
    api.group.rotation.y = Math.random() * 0.4 - 0.2;
    api.setLevel(t.level || 1);
    this.scene.add(api.group);
    this.towerViews.set(t.uid, { t, api, born: 0 });
    this.fx.shockwave(t.x, t.z, 0xffffff, 3.5, 0.45);
    this.fx.emit('norm', { x: t.x, y: y + 0.3, z: t.z, count: 18, spread: 1.4, vel: [0, 1.2, 0], velSpread: 2.2, color: 0xb9a07a, size: 0.9, grow: 1.6, life: 0.7, gravity: 0.3, drag: 3 });
  }
  onUpgrade(t) {
    const v = this.towerViews.get(t.uid);
    if (!v) return;
    v.api.setLevel(t.level);
    v.born = 0.6;
    const y = this.heightAt(t.x, t.z);
    this.fx.emit('add', { x: t.x, y: y + 1, z: t.z, count: 30, spread: 1.4, vel: [0, 5, 0], velSpread: 2, color: 0xffd34a, size: 0.45, life: 1, gravity: -4 });
    this.fx.shockwave(t.x, t.z, 0xffd34a, 4.5, 0.6);
    if (this.selected === t) this.showRange(t);
  }
  onSell(t, refund) {
    const v = this.towerViews.get(t.uid);
    if (!v) return;
    this.scene.remove(v.api.group);
    this.towerViews.delete(t.uid);
    const y = this.heightAt(t.x, t.z);
    this.fx.emit('norm', { x: t.x, y: y + 1, z: t.z, count: 26, spread: 1.4, vel: [0, 1.5, 0], velSpread: 2.5, color: 0x9a8a72, size: 1.1, grow: 1.6, life: 0.9, gravity: 0.3, drag: 2.5 });
    this.fx.text(`+${refund}`, t.x, y + 3, t.z, 'gold');
  }
  onFire(t, p) {
    const v = this.towerViews.get(t.uid);
    if (v) {
      v.api.aim(p.target.x - t.x, p.target.z - t.z);
      v.api.fire();
    } else if (t.gadget) this.heroes.onGadgetFire(t, p);
    const def = BULLETS[p.kind];
    const mat = new THREE.SpriteMaterial({ map: this.assets.tex[def.tex], transparent: true, depthWrite: false, color: def.color ?? 0xffffff });
    const obj = new THREE.Sprite(mat);
    const bs = def.size * 1.35 * (this.sim.level.unitScale || 1);
    obj.scale.set(bs, bs, 1);
    obj.renderOrder = 4;
    if (def.glow) obj.add(glowSprite(def.glow, def.glowSize || 2.6, 0.7));
    obj.position.set(p.x, p.y, p.z);
    this.scene.add(obj);
    this.projViews.set(p.uid, { p, obj, def, trail: 0 });
  }
  onHit(ev) {
    const v = this.projViews.get(ev.p.uid);
    if (v) { this.scene.remove(v.obj); v.obj.material.dispose(); this.projViews.delete(ev.p.uid); }
    const { x, y, z, kind } = ev;
    if (kind === 'arcane') {
      this.fx.emit('add', { x, y, z, count: 14, spread: 0.3, vel: [0, 1, 0], velSpread: 3, color: 0x6af4ff, size: 0.5, life: 0.4, gravity: 0 });
      this.fx.shockwave(x, z, 0x6af4ff, ev.p.splash || 1.8, 0.3, y > 1.5 ? y - 1 : 0.15);
    } else if (kind === 'sand') {
      this.fx.emit('norm', { x, y, z, count: 6, spread: 0.3, vel: [0, 2, 0], velSpread: 2, color: 0xc8a466, size: 0.5, life: 0.45, gravity: -6 });
    } else if (kind === 'rock') {
      this.fx.emit('norm', { x, y: 0.4, z, count: 16, spread: 0.8, vel: [0, 2.5, 0], velSpread: 3, color: 0x8d8a85, size: 0.9, grow: 1.7, life: 0.7, gravity: -2, drag: 2.5 });
      this.fx.shockwave(x, z, 0xd8d0c0, ev.p.splash || 3, 0.4);
      this.shake = Math.min(0.5, this.shake + 0.12);
    } else if (kind === 'bullet') {
      this.fx.emit('norm', { x, y, z, count: 4, spread: 0.2, vel: [0, 1.5, 0], velSpread: 1.6, color: 0x8a8a90, size: 0.4, life: 0.35, gravity: -6 });
      this.fx.emit('add', { x, y, z, count: 2, spread: 0.1, vel: [0, 1, 0], velSpread: 1.5, color: 0xffd080, size: 0.3, life: 0.2, gravity: 0 });
    } else if (kind === 'gatling') {
      this.fx.emit('add', { x, y, z, count: 2, spread: 0.1, vel: [0, 1, 0], velSpread: 2, color: 0xffd080, size: 0.22, life: 0.18, gravity: -4 });
    } else if (kind === 'rocket') {
      this.fx.emit('add', { x, y: y + 0.4, z, count: 18, spread: 0.5, vel: [0, 4, 0], velSpread: 4, color: 0xffa040, size: 0.75, life: 0.45, gravity: -3 });
      this.fx.emit('norm', { x, y: y + 0.5, z, count: 16, spread: 1, vel: [0, 2.5, 0], velSpread: 2.5, color: 0x4a4440, size: 1.2, grow: 1.9, life: 0.9, gravity: 0.4, drag: 2.2 });
      this.fx.shockwave(x, z, 0xffb070, ev.p.splash || 2.6, 0.4);
      this.shake = Math.min(0.6, this.shake + 0.12);
    } else if (kind === 'shell') {
      this.fx.emit('add', { x, y: 0.8, z, count: 14, spread: 0.6, vel: [0, 4, 0], velSpread: 3.5, color: 0xffa040, size: 0.8, life: 0.45, gravity: -3 });
      this.fx.emit('norm', { x, y: 0.6, z, count: 22, spread: 1.2, vel: [0, 3, 0], velSpread: 3, color: 0x4a4a4a, size: 1.3, grow: 1.9, life: 1, gravity: 0.4, drag: 2.2 });
      this.fx.shockwave(x, z, 0xffc070, ev.p.splash || 4, 0.5);
      this.shake = Math.min(0.6, this.shake + 0.22);
    } else if (kind === 'poison') {
      this.fx.emit('add', { x, y, z, count: 10, spread: 0.3, vel: [0, 1.4, 0], velSpread: 2, color: 0x8dff5a, size: 0.5, life: 0.6, gravity: -2 });
      this.fx.emit('norm', { x, y, z, count: 4, spread: 0.4, vel: [0, 0.6, 0], velSpread: 0.6, color: 0x4a9a3a, size: 1.1, grow: 1.8, life: 0.9, gravity: 0.2 });
    } else if (kind === 'snow') {
      this.fx.emit('add', { x, y, z, count: 10, spread: 0.3, vel: [0, 1.5, 0], velSpread: 2.6, color: 0xbff4ff, size: 0.45, life: 0.6, gravity: -3 });
    } else if (kind === 'fire') {
      this.fx.emit('add', { x, y, z, count: 9, spread: 0.3, vel: [0, 2.5, 0], velSpread: 2.5, color: 0xff8a2a, size: 0.6, life: 0.45, gravity: 1 });
      this.fx.emit('norm', { x, y: y + 0.5, z, count: 2, spread: 0.3, vel: [0, 1.5, 0], velSpread: 0.6, color: 0x3a3030, size: 0.9, grow: 1.8, life: 0.8, gravity: 0.4 });
    }
  }

  // ── Habilidades ────────────────────────────────────────
  onMeteor(ev) {
    this.meteors = this.meteors || [];
    if (!this.meteorGeo) {
      this.meteorGeo = new THREE.DodecahedronGeometry(1.1, 0);
      this.meteorMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false });
      this.scorchTex = radialTexture('rgba(20,10,5,0.85)', 'rgba(20,10,5,0)', 64);
    }
    for (const d of ev.drops) {
      const m = new THREE.Mesh(this.meteorGeo, this.meteorMat);
      m.add(glowSprite(0xffa040, 5, 0.8));
      m.visible = false;
      this.scene.add(m);
      this.meteors.push({ m, d, t: -d.delay });
    }
    this.fx.shockwave(ev.x, ev.z, 0xff8a2a, ev.radius, 1.2, 0.3);
  }
  onMeteorHit(ev) {
    const y = this.heightAt(ev.x, ev.z);
    this.fx.emit('add', { x: ev.x, y: y + 0.5, z: ev.z, count: 26, spread: 0.6, vel: [0, 6, 0], velSpread: 5, color: 0xffa040, size: 0.9, life: 0.6, gravity: -6 });
    this.fx.emit('norm', { x: ev.x, y: y + 0.6, z: ev.z, count: 16, spread: 1, vel: [0, 2.5, 0], velSpread: 2.5, color: 0x3a2a24, size: 1.8, grow: 2, life: 1.4, gravity: 0.3, drag: 2 });
    this.fx.shockwave(ev.x, ev.z, 0xffc070, ev.r * 1.4, 0.5);
    this.shake = Math.min(0.9, this.shake + 0.3);
    // cráter que se desvanece
    const sc = new THREE.Mesh(new THREE.CircleGeometry(ev.r, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.scorchTex, transparent: true, depthWrite: false }));
    sc.position.set(ev.x, y + 0.12, ev.z);
    this.scene.add(sc);
    this.scorches = this.scorches || [];
    this.scorches.push({ m: sc, t: 0 });
  }
  onBlizzard() {
    const f = document.getElementById('freeze-flash');
    if (f) { f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
    for (let i = 0; i < 160; i++) {
      this.fx.emit('add', { x: (Math.random() - 0.5) * 120, y: 10 + Math.random() * 15, z: (Math.random() - 0.5) * 70, count: 1, vel: [6, -6, 2], velSpread: 2, color: 0xdff6ff, size: 0.5, life: 2.2, gravity: 0, drag: 0 });
    }
    for (const v of this.enemyViews.values()) {
      const p = v.obj.position;
      this.fx.emit('add', { x: p.x, y: p.y + v.hgt * 0.5, z: p.z, count: 10, spread: v.hgt * 0.3, vel: [0, 0.5, 0], velSpread: 1.5, color: 0x9feaff, size: 0.5, life: 1, gravity: 0 });
    }
    this.fx.shockwave(this.controls.target.x, this.controls.target.z, 0xbff4ff, 70, 1.2, 0.5);
  }
  updateAbilities(dt) {
    if (this.meteors?.length) {
      for (const o of this.meteors) {
        o.t += dt;
        const k = o.t / 0.7;
        o.m.visible = k > 0 && k < 1;
        if (k > 0 && k < 1) {
          const y0 = this.heightAt(o.d.x, o.d.z);
          o.m.position.set(o.d.x + (1 - k) * 14, y0 + (1 - k) * 46, o.d.z - (1 - k) * 10);
          o.m.rotation.x += dt * 5;
          if (Math.random() < 0.8) this.fx.emit('add', { x: o.m.position.x, y: o.m.position.y, z: o.m.position.z, count: 1, spread: 0.4, vel: [0, 0, 0], velSpread: 0.6, color: 0xff7a2a, size: 1, life: 0.4, gravity: 0 });
        }
      }
      this.meteors = this.meteors.filter((o) => {
        if (o.t < 0.7) return true;
        this.scene.remove(o.m);
        return false;
      });
    }
    if (this.scorches?.length) {
      for (const s of this.scorches) { s.t += dt; s.m.material.opacity = Math.max(0, 1 - Math.max(0, s.t - 4) / 3); }
      this.scorches = this.scorches.filter((s) => {
        if (s.t < 7) return true;
        this.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose();
        return false;
      });
    }
  }

  updateTowers(dt) {
    for (const v of this.towerViews.values()) {
      const t = v.t;
      if (t.target && t.target.alive) v.api.aim(t.target.x - t.x, t.target.z - t.z);
      v.api.update(dt, this.time);
      // animación de aparición / mejora (rebote)
      let s = 1;
      if (v.born < 1) {
        v.born = Math.min(1, v.born + dt * 2.6);
        const k = v.born;
        s = k < 0.7 ? (k / 0.7) * 1.12 : 1.12 - ((k - 0.7) / 0.3) * 0.12;
      }
      v.api.group.scale.setScalar(this.sim.towerScale * v.api.group.userData.levelScale * s);
    }
  }

  updateProjectiles(dt) {
    for (const v of this.projViews.values()) {
      const p = v.p;
      v.obj.position.set(p.x, p.y, p.z);
      v.obj.material.rotation += dt * v.def.spin;
      v.trail += dt;
      if (v.trail > 0.03) {
        v.trail = 0;
        if (p.kind === 'poison') this.fx.emit('add', { x: p.x, y: p.y, z: p.z, count: 1, spread: 0.1, vel: [0, 0, 0], velSpread: 0.3, color: 0x8dff5a, size: 0.35, life: 0.35, gravity: 0 });
        else if (p.kind === 'fire') this.fx.emit('add', { x: p.x, y: p.y, z: p.z, count: 1, spread: 0.15, vel: [0, 0.6, 0], velSpread: 0.4, color: 0xff7a2a, size: 0.55, life: 0.3, gravity: 0 });
        else if (p.kind === 'arcane') this.fx.emit('add', { x: p.x, y: p.y, z: p.z, count: 1, spread: 0.12, vel: [0, 0, 0], velSpread: 0.4, color: 0x6af4ff, size: 0.45, life: 0.35, gravity: 0 });
        else if (p.kind === 'rocket') {
          this.fx.emit('norm', { x: p.x, y: p.y, z: p.z, count: 1, spread: 0.1, vel: [0, 0.4, 0], velSpread: 0.3, color: 0x7a7470, size: 0.7, grow: 2, life: 0.7, gravity: 0, drag: 1 });
          this.fx.emit('add', { x: p.x, y: p.y, z: p.z, count: 1, spread: 0.05, vel: [0, 0, 0], velSpread: 0.3, color: 0xffa040, size: 0.5, life: 0.2, gravity: 0 });
        } else if (p.kind === 'snow') this.fx.emit('add', { x: p.x, y: p.y, z: p.z, count: 1, spread: 0.1, vel: [0, 0, 0], velSpread: 0.3, color: 0xcff6ff, size: 0.3, life: 0.35, gravity: 0 });
      }
    }
  }

  // ── Bucle ──────────────────────────────────────────────
  update(dt, simDt) {
    this.time += dt;
    if (this.world) this.world.update(dt, this.time, this.fx);
    this.weather.update(dt);
    if (this.sim) {
      this.updateEnemies(simDt > 0 ? dt : 0);
      this.updateTowers(simDt > 0 ? simDt : dt * 0.3);
      this.updateProjectiles(simDt > 0 ? dt : 0);
    }
    this.heroes.update(dt, simDt);
    this.fx.update(dt, this.w, this.h);
    this.updateSnap(dt);
    this.updateAbilities(simDt > 0 ? dt : 0);
    this.controls.update();
    this.shake = Math.max(0, this.shake - dt * 2);
  }

  draw() {
    if (this.quality.bloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  render() {
    const cam = this.camera;
    // zoom y separación de colores del golpe de definitiva
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - 0.016 * 1.6);
      const k = this.punchT;
      cam.fov = 40 - 7 * Math.sin(Math.min(1, k) * Math.PI * 0.5);
      cam.updateProjectionMatrix();
      if (this.rgbShift) { this.rgbShift.enabled = k > 0.02; this.rgbShift.uniforms.amount.value = 0.007 * k; this.rgbShift.uniforms.angle.value += 0.2; }
    } else if (cam.fov !== 40) { cam.fov = 40; cam.updateProjectionMatrix(); if (this.rgbShift) this.rgbShift.enabled = false; }
    if (this.shake > 0) {
      const s = this.shake * 0.4;
      const ox = (Math.random() - 0.5) * s, oy = (Math.random() - 0.5) * s;
      cam.position.x += ox; cam.position.y += oy;
      this.draw();
      cam.position.x -= ox; cam.position.y -= oy;
    } else {
      this.draw();
    }
  }

  // ── Chasquido del guantelete ───────────────────────────
  // onSnap se llama en el instante del chasquido (3,2 s, como el original)
  startSnap(onSnap, onSound) {
    if (!this.gauntlet) {
      this.gauntlet = createGauntlet();
      // el guantelete se dibuja después del velo oscuro de Thanos (renderOrder 900), así no se oscurece.
      // Tres.js pinta los opacos antes que los transparentes, por eso sus materiales pasan a la cola
      // de transparentes (opacidad 1, con profundidad: se ve igual que antes).
      this.gauntlet.traverse((o) => {
        o.renderOrder = 950 + (o.renderOrder || 0);
        for (const m of [].concat(o.material || [])) {
          if (!m.transparent) { m.transparent = true; m.opacity = 1; m.depthWrite = true; m.needsUpdate = true; }
        }
      });
      this.scene.add(this.gauntlet);
    }
    this.gauntlet.visible = false;
    this.snap = { t: 0, onSnap, onSound, fired: false };
  }

  updateSnap(dt) {
    const S = this.snap;
    if (!S) return;
    S.t += dt;
    const t = S.t;
    const g = this.gauntlet;
    const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const dist = this.camera.position.distanceTo(this.controls.target);
    const appear = smooth(0.6, 1.9, t);
    const leave = smooth(3.9, 4.8, t);
    const ready = smooth(1.6, 2.6, t);
    const snapK = smooth(3.0, 3.12, t);
    g.visible = t > 0.6 && t < 4.8;
    const tgt = this.controls.target;
    // entre la cámara y el centro del mapa, flotando
    const toCam = new THREE.Vector3().subVectors(this.camera.position, tgt).normalize();
    const base = tgt.clone().addScaledVector(toCam, dist * 0.2);
    base.y += dist * 0.06;
    g.position.copy(base);
    g.position.y += (1 - appear) * dist * 0.5 + leave * dist * 0.5 + Math.sin(t * 2) * 0.3;
    g.scale.setScalar(dist * 0.028 * (1 - leave * 0.4));
    g.lookAt(this.camera.position);
    g.rotateZ((1 - appear) * 0.6 - snapK * 0.12);
    g.userData.pose(ready, snapK, t);
    // el golpe del sonido del chasquido llega 0.2 s después de empezar: se lanza antes del destello
    if (t > 2.85 && !S.sounded) { S.sounded = true; S.onSound?.(); }
    if (t > 3.05 && !S.flashed) {
      S.flashed = true;
      const f = document.getElementById('snap-flash');
      if (f) { f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
      this.fx.shockwave(tgt.x, tgt.z, 0xfff0c0, 90, 1.1, 0.6);
      this.shake = 0.6;
    }
    if (t > 3.2 && !S.fired) { S.fired = true; S.onSnap?.(); }
    if (t > 4.8) { g.visible = false; this.snap = null; }
  }
}
