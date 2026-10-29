import * as THREE from 'three';

// Sistema de partículas basado en THREE.Points (1 draw call por modo de mezcla)
export class ParticleSystem {
  constructor(max, blending, onTop = false) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.fadeIn = new Uint8Array(max);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying float vA; varying vec3 vC; uniform float uScale;
        void main(){
          vA = alpha; vC = color;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA; varying vec3 vC;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.15, r) * vA;
          gl_FragColor = vec4(vC, a);
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: !onTop,
      blending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    // «onTop»: se dibuja encima de todo (también del velo oscuro de Thanos)
    this.points.renderOrder = onTop ? 1000 : 5;
    this.geo = geo;
  }
  emit(o) {
    const c = new THREE.Color(o.color ?? 0xffffff);
    const n = o.count ?? 1;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const sp = o.spread ?? 0;
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * 2 * sp;
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * 2 * sp * 0.5;
      this.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * 2 * sp;
      const v = o.vel || [0, 0, 0];
      const vs = o.velSpread ?? 0;
      this.vel[i * 3] = v[0] + (Math.random() - 0.5) * 2 * vs;
      this.vel[i * 3 + 1] = v[1] + (Math.random() - 0.5) * 2 * vs;
      this.vel[i * 3 + 2] = v[2] + (Math.random() - 0.5) * 2 * vs;
      const cv = o.colorVar ?? 0.1;
      const kk = 1 + (Math.random() - 0.5) * cv * 2;
      this.col[i * 3] = c.r * kk;
      this.col[i * 3 + 1] = c.g * kk;
      this.col[i * 3 + 2] = c.b * kk;
      const life = (o.life ?? 1) * (0.7 + Math.random() * 0.6);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.grav[i] = o.gravity ?? -9;
      this.drag[i] = o.drag ?? 1.5;
      this.size0[i] = (o.size ?? 0.5) * (0.7 + Math.random() * 0.6);
      this.size1[i] = this.size0[i] * (o.grow ?? 1);
      this.fadeIn[i] = o.fadeIn ? 1 : 0;
    }
  }
  update(dt) {
    const { pos, vel, life, maxLife, alpha, size } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
      life[i] -= dt;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      vel[i * 3] *= d;
      vel[i * 3 + 2] *= d;
      vel[i * 3 + 1] = vel[i * 3 + 1] * d + this.grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.05 && this.grav[i] < 0) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.3; }
      const k = Math.max(0, life[i] / maxLife[i]);
      alpha[i] = this.fadeIn[i] ? Math.min(1, (1 - k) * 4) * Math.min(1, k * 2) : Math.min(1, k * 1.6);
      size[i] = this.size1[i] + (this.size0[i] - this.size1[i]) * k;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, camera, container, maxParticles = 1800) {
    this.scene = scene;
    this.camera = camera;
    this.add = new ParticleSystem(maxParticles, THREE.AdditiveBlending);
    this.norm = new ParticleSystem(maxParticles, THREE.NormalBlending);
    this.top = new ParticleSystem(1500, THREE.NormalBlending, true);
    scene.add(this.add.points, this.norm.points, this.top.points);
    this.texts = [];
    this.layer = container;
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
  }
  setScale(h, fovDeg) {
    // tamaño de las partículas en unidades del mundo (diámetro)
    const s = h / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.add.material.uniforms.uScale.value = s;
    this.norm.material.uniforms.uScale.value = s;
    this.top.material.uniforms.uScale.value = s;
  }
  emit(mode, o) {
    (mode === 'add' ? this.add : mode === 'top' ? this.top : this.norm).emit(o);
  }
  // Onda expansiva en el suelo (impacto de catapulta, construcción…)
  shockwave(x, z, color = 0xffffff, radius = 3, dur = 0.45, y = 0.15) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z);
    m.scale.setScalar(0.2);
    this.scene.add(m);
    this.rings.push({ m, t: 0, dur, radius });
  }
  text(str, x, y, z, cls = '') {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`;
    el.textContent = str;
    this.layer.appendChild(el);
    this.texts.push({ el, pos: new THREE.Vector3(x, y, z), t: 0, dur: 1.1 });
  }
  update(dt, w, h) {
    this.add.update(dt);
    this.norm.update(dt);
    this.top.update(dt);
    for (const r of this.rings) {
      r.t += dt;
      const k = r.t / r.dur;
      r.m.scale.setScalar(0.2 + k * r.radius);
      r.m.material.opacity = 0.8 * (1 - k);
    }
    this.rings = this.rings.filter((r) => {
      if (r.t < r.dur) return true;
      this.scene.remove(r.m);
      r.m.material.dispose();
      return false;
    });
    const v = new THREE.Vector3();
    for (const t of this.texts) {
      t.t += dt;
      v.copy(t.pos);
      v.y += t.t * 2.2;
      v.project(this.camera);
      const k = t.t / t.dur;
      t.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%) scale(${1 + (1 - k) * 0.2})`;
      t.el.style.opacity = String(Math.min(1, (1 - k) * 2.5));
    }
    this.texts = this.texts.filter((t) => {
      if (t.t < t.dur) return true;
      t.el.remove();
      return false;
    });
  }
  clear() {
    this.texts.forEach((t) => t.el.remove());
    this.texts = [];
    this.rings.forEach((r) => this.scene.remove(r.m));
    this.rings = [];
    this.add.life.fill(0);
    this.norm.life.fill(0);
    this.top.life.fill(0);
  }
}

// Anillo de alcance (al colocar o seleccionar una torre)
export function createRangeRing() {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x93faa5, transparent: true, opacity: 0.12, depthWrite: false }));
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x93faa5, transparent: true, opacity: 0.85, depthWrite: false }));
  fill.renderOrder = 2;
  edge.renderOrder = 3;
  g.add(fill, edge);
  g.position.y = 0.2;
  g.visible = false;
  g.setColor = (c) => { fill.material.color.set(c); edge.material.color.set(c); };
  g.show = (x, y, z, r, color = 0x93faa5) => {
    g.visible = true;
    g.position.set(x, y + 0.2, z);
    g.scale.set(r, 1, r);
    g.setColor(color);
  };
  return g;
}
