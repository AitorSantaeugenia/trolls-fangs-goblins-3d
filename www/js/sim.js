// Lógica pura del juego (sin three.js): se puede ejecutar en Node para
// probar el equilibrio. La vista 3D escucha los eventos que emite.
import {
  TOWERS, ENEMIES, WAVES, LEVELS, PATH_HALF, BUILD_BOUNDS, SPAWN_INTERVAL,
  UPGRADE, MAX_LEVEL, SELL_RATIO, WAVE_HP_GROWTH, damageMult, ENDLESS, ABILITIES, toWorld, WEATHER_FX, WEATHER_BOLT, HEROES, HERO_RULES,
} from './config.js';

export const PREP_TIME = 20;
export const INTERMISSION = 8;
export const FOOTPRINT = 1.7;

export class Path {
  constructor(pointsPx) {
    const pts = pointsPx.map(toWorld);
    // Extiende la entrada fuera del mapa (cueva) y la salida hacia el castillo
    const [x0, z0] = pts[0];
    const [xn, zn] = pts[pts.length - 1];
    this.mapPoints = pts.map((p) => p.slice());
    this.points = [[x0 - 14, z0], ...pts, [xn + 7, zn]];
    this.segs = [];
    let acc = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const [ax, az] = this.points[i];
      const [bx, bz] = this.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-6) continue;
      this.segs.push({ ax, az, bx, bz, len, start: acc, dx: (bx - ax) / len, dz: (bz - az) / len });
      acc += len;
    }
    this.length = acc;
  }
  at(d, out = {}) {
    const segs = this.segs;
    let s = segs[segs.length - 1];
    if (d <= 0) s = segs[0];
    else {
      for (let i = 0; i < segs.length; i++) {
        if (d < segs[i].start + segs[i].len) { s = segs[i]; break; }
      }
    }
    const t = Math.min(Math.max(d - s.start, 0), s.len);
    out.x = s.ax + s.dx * t;
    out.z = s.az + s.dz * t;
    out.dx = s.dx;
    out.dz = s.dz;
    return out;
  }
  distanceTo(x, z) {
    let best = Infinity;
    for (const s of this.segs) {
      const t = Math.max(0, Math.min(s.len, (x - s.ax) * s.dx + (z - s.az) * s.dz));
      const px = s.ax + s.dx * t;
      const pz = s.az + s.dz * t;
      // Distancia "cuadrada" (Chebyshev) en coordenadas del segmento, como el camino rectangular
      const ox = Math.abs(x - px);
      const oz = Math.abs(z - pz);
      const d = Math.max(ox, oz);
      if (d < best) best = d;
    }
    return best;
  }
}

let UID = 1;

export class Sim {
  constructor(levelId, opts = {}) {
    this.level = LEVELS[levelId];
    this.levelId = levelId;
    this.path = new Path(this.level.path);
    this.endless = !!opts.endless;
    // héroe elegido (o null = modo clásico, sin héroe y con las oleadas originales)
    this.heroDef = opts.hero ? HEROES[opts.hero] || null : null;
    this.hero = null;
    this.heroAuto = opts.heroAuto !== false;
    this.waves = this.endless ? [] : WAVES[levelId].map((w) => this.expandWave(w.split('')));
    this.gold = this.level.gold;
    this.hp = this.level.hp;
    this.maxHp = this.level.hp;
    this.time = 0;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.events = [];
    this.obstacles = [];
    this.waveIndex = -1;
    this.state = 'prep';
    this.timer = PREP_TIME;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.flameUnlocked = !!opts.flameUnlocked;
    this.towerScale = this.level.towerScale || 1;
    this.footprint = FOOTPRINT * this.towerScale;
    this.stats = { kills: 0, built: 0, goldEarned: 0, escaped: 0, damage: 0 };
    this.cheated = false; // con trucos (o partida recuperada) no entra en la clasificación
    this.nextWaveAt = Infinity; // modo infinito: cuándo sale la siguiente oleada
    this.rand = opts.rand || Math.random;
    this.best = 0;
    this.abilities = this.heroDef ? [...this.heroDef.abilities, this.heroDef.ult] : ['meteor', 'blizzard'];
    this.abilityCd = Object.fromEntries(this.abilities.map((a) => [a, 0]));
    this.scheduled = [];
    this.traps = []; // cepos de Tuerca
    this.turrets = []; // minitorretas de Tuerca
    this.wx = { speed: 1, range: 1, fire: 1, freeze: 1, burn: 0, bolts: false };
    this.weather = 'calm';
  }

  emit(type, data = {}) {
    data.type = type;
    this.events.push(data);
  }

  get totalWaves() { return this.endless ? Infinity : this.waves.length; }
  get over() { return this.state === 'won' || this.state === 'lost'; }

  // ── Oleadas ─────────────────────────────────────────────
  callWave() {
    // infinito: con la oleada ya en marcha solo se puede adelantar la siguiente cuando ya han salido todos
    if (this.endless && this.waveIndex >= 0) {
      if (this.over || this.state !== 'clearing') return false;
      const bonus = Math.round(Math.max(0, this.nextWaveAt - this.time) * ENDLESS.earlyBonus);
      if (bonus > 0) { this.addGold(bonus); this.emit('bonus', { amount: bonus }); }
      this.startWave(this.waveIndex + 1);
      return true;
    }
    if (this.state !== 'prep' && this.state !== 'intermission') return false;
    if (this.state === 'intermission' && this.timer > 0) {
      const bonus = Math.round(this.timer * 3);
      if (bonus > 0) { this.addGold(bonus); this.emit('bonus', { amount: bonus }); }
    }
    this.startWave(this.waveIndex + 1);
    return true;
  }

  // Modo infinito: oleadas generadas cada vez más grandes y variadas, sin final
  genWave(n) {
    const pick = (a) => a[Math.floor(this.rand() * a.length)];
    const count = Math.min(ENDLESS.maxCount, ENDLESS.baseCount + ENDLESS.countStep * n);
    const w = [];
    for (let i = 0; i < count; i++) {
      let c = 'm';
      if (n >= 1 && i % 5 === 4) c = pick(['d', 'q']);
      if (n >= 3 && i % 7 === 6) c = pick(['D', 'l']);
      if (n >= 5 && i % 11 === 10) c = 'B';
      w.push(c);
    }
    if (n >= 6 && n % 2 === 0) w.push(pick(['K', 'B']));
    if (n >= 9 && n % 3 === 0) w.push(pick(['S', 'L']));
    // a partir de la 15, un jefe extra cada vez más a menudo
    if (n >= 15) for (let k = 0; k < Math.floor((n - 10) / 5); k++) w.push(pick(['K', 'B', 'S', 'L']));
    return w;
  }
  // segundos hasta la siguiente oleada y separación entre enemigos (infinito)
  endlessGap(i) { return Math.max(ENDLESS.gapMin, ENDLESS.gap - i * ENDLESS.gapStep); }
  spawnGap() { return this.endless ? Math.max(ENDLESS.spawnMin, SPAWN_INTERVAL * Math.pow(ENDLESS.spawnDecay, Math.max(0, this.waveIndex))) : SPAWN_INTERVAL; }

  // Con héroe salen más esbirros (HERO_RULES.minionMult)
  expandWave(list) {
    if (!this.heroDef) return list;
    // multiplicador propio de cada héroe (puede ser decimal: 1.5 = uno extra cada dos esbirros)
    const k = this.heroDef.minionMult ?? HERO_RULES.minionMult;
    let acc = 0;
    return list.flatMap((c) => {
      if (c !== 'm') return [c];
      acc += k - 1;
      const extra = Math.floor(acc + 1e-9);
      acc -= extra;
      return Array(1 + extra).fill('m');
    });
  }

  startWave(i) {
    // si se llama la oleada sin haber colocado al héroe, se coloca solo en el mejor sitio
    if (this.heroDef && !this.hero) { const b = this.bestHeroSpot(); if (b) this.placeHero(b.x, b.z); }
    if (this.endless && !this.waves[i]) this.waves[i] = this.expandWave(this.genWave(i));
    this.waveIndex = i;
    // en infinito la nueva oleada se suma a lo que quede por salir de la anterior
    this.spawnQueue = this.endless ? this.spawnQueue.concat(this.waves[i]) : this.waves[i].slice();
    if (this.endless) this.nextWaveAt = this.time + this.endlessGap(i);
    if (!this.endless || this.state !== 'spawning') this.spawnTimer = 0;
    this.state = 'spawning';
    this.emit('wave', { index: i, total: this.totalWaves, count: this.spawnQueue.length });
  }

  spawn(code) {
    const def = ENEMIES[code];
    const wi = Math.max(0, this.waveIndex);
    const ramp = wi / Math.max(1, this.totalWaves - 1); // 0 → 1 a lo largo del nivel
    const mult = this.endless
      ? Math.pow(this.level.endlessGrowth || ENDLESS.hpGrowth, wi)
      : (1 + ((this.level.hpMult || 1) - 1) * ramp) * (1 + (this.level.hpGrowth ?? WAVE_HP_GROWTH) * wi);
    const hp = Math.round(def.hp * mult);
    const e = {
      uid: UID++,
      code,
      def,
      hp,
      maxHp: hp,
      dist: 0,
      speed: def.speed,
      slowUntil: 0,
      slowFactor: 1,
      poisonUntil: 0,
      poisonDps: 0,
      hellMinion: code === 'm' && this.level.minions === 'hell',
      lateral: def.boss || def.size > 6 ? 0 : (this.rand() - 0.5) * 1.6,
      // con héroe hay más esbirros, pero el oro total que dan es parecido al del modo clásico
      gold: code === 'm' && this.heroDef ? Math.round(def.gold * HERO_RULES.minionGoldTotal / (this.heroDef.minionMult ?? HERO_RULES.minionMult)) : def.gold,
      atk: (def.atk || 0) * Math.sqrt(mult),
      atkCd: 0.6,
      stunUntil: 0,
      blockedBy: null,
      skin: Math.floor(this.rand() * 15),
      x: 0, z: 0, dx: 1, dz: 0,
      alive: true,
    };
    this.placeEnemy(e);
    this.enemies.push(e);
    this.emit('spawn', { e });
  }

  placeEnemy(e) {
    const p = this.path.at(e.dist, e);
    e.x = p.x - p.dz * e.lateral;
    e.z = p.z + p.dx * e.lateral;
  }

  // ── Bucle ───────────────────────────────────────────────
  update(dt) {
    if (this.over) return;
    this.time += dt;

    if (this.state === 'prep' || this.state === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave(this.waveIndex + 1);
    }
    // infinito: la siguiente oleada sale sola a su hora, haya o no enemigos en pie
    if (this.endless && this.waveIndex >= 0 && this.time >= this.nextWaveAt) this.startWave(this.waveIndex + 1);

    if (this.state === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawnQueue.length) {
        this.spawn(this.spawnQueue.shift());
        this.spawnTimer = this.spawnGap();
      }
      if (!this.spawnQueue.length) this.state = 'clearing';
    }

    for (const k in this.abilityCd) this.abilityCd[k] = Math.max(0, this.abilityCd[k] - dt);
    if (this.scheduled.length) {
      const due = this.scheduled.filter((s) => s.at <= this.time);
      this.scheduled = this.scheduled.filter((s) => s.at > this.time);
      for (const s of due) s.run();
    }
    this.updateHero(dt);
    this.updateGadgets(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);

    if (this.state === 'clearing' && this.enemies.length === 0 && !this.endless) {
      this.best = Math.max(this.best, this.waveIndex + 1);
      if (this.waveIndex >= this.totalWaves - 1) {
        this.state = 'won';
        this.emit('victory');
      } else {
        this.state = 'intermission';
        this.timer = INTERMISSION;
        this.emit('waveClear', { index: this.waveIndex });
      }
    }
  }

  updateEnemies(dt) {
    const L = this.path.length;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const slowed = this.time < e.slowUntil;
      if (!slowed) e.slowFactor = 1;
      // aturdido (aullido) o bloqueado por el héroe: no avanza
      const held = this.time < e.stunUntil || (e.blockedBy && e.blockedBy.alive);
      if (!held) e.dist += e.speed * e.slowFactor * this.wx.speed * dt;
      if (this.wx.burn > 0) {
        const b = Math.min(e.hp, this.wx.burn * this.abilityPower() * dt);
        e.hp -= b;
        this.stats.damage += b;
        if (e.hp <= 0) { e.lastHit = 'burn'; this.kill(e); continue; }
      }
      if (this.time < e.poisonUntil) {
        const pd = Math.min(e.hp, e.poisonDps * dt);
        e.hp -= pd;
        this.stats.damage += pd;
        if (e.hp <= 0) { e.lastHit = 'poison'; this.kill(e); continue; }
      }
      this.placeEnemy(e);
      if (e.dist >= L) {
        e.alive = false;
        e.escaped = true;
        this.hp = Math.max(0, this.hp - 1);
        this.stats.escaped++;
        this.emit('escape', { e });
        if (this.hp <= 0) this.lose();
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  updateTowers(dt) {
    for (const t of this.towers) {
      t.cd -= dt;
      if (t.cd > 0) continue;
      const target = this.findTarget(t);
      if (!target) { t.target = null; continue; }
      t.target = target;
      t.cd = t.def.cooldown / UPGRADE.rate[t.level - 1];
      this.fire(t, target);
    }
  }

  findTarget(t) {
    const r = t.range * this.wx.range;
    const r2 = r * r;
    const mode = t.priority || 'first';
    let best = null, bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.hp <= 0) continue;
      const dx = e.x - t.x;
      const dz = e.z - t.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      let score;
      if (mode === 'last') score = -e.dist;
      else if (mode === 'strong') score = e.hp * 1e4 + e.dist;
      else if (mode === 'close') score = -d2;
      else score = e.dist;
      // Hielo: prefiere enemigos aún sin congelar
      if (t.type === 'slow' && this.time >= e.slowUntil) score += 1e9;
      if (t.type === 'poison' && this.time >= e.poisonUntil) score += 1e9;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  setPriority(t, mode) {
    t.priority = mode;
    t.cd = Math.min(t.cd, 0.05);
  }

  fire(t, target) {
    const def = t.def;
    const sy = t.sy ?? (t.isHero ? 2.6 : 3.4 * this.towerScale);
    const dist = Math.hypot(target.x - t.x, target.z - t.z);
    const p = {
      uid: UID++,
      kind: def.projectile,
      tower: t,
      target,
      sx: t.x, sy, sz: t.z,
      tx: target.x, tz: target.z, ty: target.def.fly ? 2.2 : 1.2,
      x: t.x, y: sy, z: t.z,
      t: 0,
      dur: Math.max(0.08, dist / def.projSpeed),
      arc: def.projectile === 'rock' || def.projectile === 'shell' ? Math.min(9, 2 + dist * 0.18) : def.projectile === 'snow' || def.projectile === 'poison' ? 1.2 : 0.4,
      dmg: def.dmg * UPGRADE.dmg[t.level - 1] * (t.isHero || t.gadget ? this.heroPower() : 1),
      splash: def.splash || 0,
      splashRatio: def.splashRatio ?? 0.5,
      poisonDps: (def.poisonDps || 0) * UPGRADE.dmg[t.level - 1],
      poisonTime: def.poisonTime || 0,
      slow: def.slow || 0,
      slowTime: (def.slowTime || 0) * UPGRADE.slowTime[t.level - 1],
    };
    this.projectiles.push(p);
    this.emit('fire', { t, p });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.target && p.target.alive) {
        p.tx = p.target.x;
        p.tz = p.target.z;
      }
      p.t += dt / p.dur;
      const k = Math.min(1, p.t);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.z = p.sz + (p.tz - p.sz) * k;
      p.y = p.sy + (p.ty - p.sy) * k + p.arc * 4 * k * (1 - k);
      if (p.t >= 1) this.impact(p);
    }
    this.projectiles = this.projectiles.filter((p) => p.t < 1);
  }

  impact(p) {
    this.emit('hit', { p, x: p.tx, y: p.ty, z: p.tz, kind: p.kind });
    const target = p.target;
    if (target && target.alive) this.damage(target, p.dmg, p);
    if (p.splash) {
      const r2 = p.splash * p.splash;
      for (const e of this.enemies) {
        if (e === target || !e.alive) continue;
        const dx = e.x - p.tx;
        const dz = e.z - p.tz;
        if (dx * dx + dz * dz <= r2) this.damage(e, p.dmg * p.splashRatio, p);
      }
    }
  }

  damage(e, amount, p) {
    if (!e.alive) return;
    const before = e.hp;
    e.hp -= amount * (p ? damageMult(e, p.kind, e.hellMinion) : 1) * (p && p.kind === 'fire' ? this.wx.fire : 1);
    if (p && p.slow) {
      const f = e.def.frostImmune ? Math.max(p.slow, 0.75) : p.slow;
      e.slowFactor = Math.min(e.slowFactor, f);
      e.slowUntil = Math.max(e.slowUntil, this.time + p.slowTime * this.wx.freeze);
    }
    if (p && p.poisonDps) {
      e.poisonDps = Math.max(this.time < e.poisonUntil ? e.poisonDps : 0, p.poisonDps);
      e.poisonUntil = this.time + p.poisonTime;
    }
    this.stats.damage += before - Math.max(0, e.hp);
    this.emit('damage', { e, amount, kind: p ? p.kind : null });
    if (e.hp <= 0) { e.lastHit = p ? p.kind : null; e.killer = p && p.tower ? (p.tower.gadget || p.kind === 'trap' ? 'hero' : p.tower.type) : null; this.kill(e); }
  }

  kill(e, silent = false) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    const gold = e.gold ?? e.def.gold;
    this.addGold(gold);
    this.stats.kills++;
    // la definitiva del héroe se carga con las bajas (más si las hace él)
    const h = this.hero;
    if (h && h.alive && !silent) h.energy = Math.min(100, (h.energy || 0) + (e.killer === 'hero' ? HERO_RULES.energyOwn : HERO_RULES.energyAny));
    this.emit('death', { e, gold, silent });
  }

  addGold(n) {
    this.gold += n;
    this.stats.goldEarned += n;
    this.emit('gold', { gold: this.gold });
  }

  lose() {
    if (this.over) return;
    this.state = 'lost';
    this.emit('defeat');
  }

  win() {
    if (this.over) return;
    for (const e of this.enemies) this.kill(e, true);
    this.enemies = [];
    this.state = 'won';
    this.emit('victory');
  }

  // ── Construcción ────────────────────────────────────────
  isUnlocked(type) {
    return !TOWERS[type].locked || this.flameUnlocked;
  }

  checkPlacement(type, x, z) {
    const fp = this.footprint;
    if (Math.abs(x) > BUILD_BOUNDS.x || Math.abs(z) > BUILD_BOUNDS.z) return 'fuera';
    if (this.path.distanceTo(x, z) < PATH_HALF + fp * 0.85) return 'camino';
    for (const t of this.towers) {
      if (Math.hypot(t.x - x, t.z - z) < fp * 2) return 'torre';
    }
    for (const o of this.obstacles) {
      if (Math.hypot(o.x - x, o.z - z) < o.r + fp * 0.8) return 'obstaculo';
    }
    if (!this.isUnlocked(type)) return 'bloqueada';
    if (this.gold < TOWERS[type].cost) return 'oro';
    return null;
  }

  build(type, x, z) {
    const why = this.checkPlacement(type, x, z);
    if (why) {
      if (why === 'oro') this.emit('nogold');
      return null;
    }
    const def = TOWERS[type];
    this.gold -= def.cost;
    const t = {
      uid: UID++, type, def, x, z, level: 1, cd: 0.2, invested: def.cost,
      range: def.range, target: null, priority: 'first',
    };
    this.towers.push(t);
    this.stats.built++;
    this.emit('build', { t });
    this.emit('gold', { gold: this.gold });
    return t;
  }

  upgradeCost(t) {
    if (t.level >= MAX_LEVEL) return null;
    return Math.round(t.def.cost * UPGRADE.costMult[t.level]);
  }

  upgrade(t) {
    const cost = this.upgradeCost(t);
    if (cost == null) return false;
    if (this.gold < cost) { this.emit('nogold'); return false; }
    this.gold -= cost;
    t.invested += cost;
    t.level++;
    t.range = t.def.range * UPGRADE.range[t.level - 1];
    this.emit('upgrade', { t });
    this.emit('gold', { gold: this.gold });
    return true;
  }

  sellValue(t) { return Math.round(t.invested * SELL_RATIO); }

  sell(t) {
    const refund = this.sellValue(t);
    this.towers = this.towers.filter((o) => o !== t);
    this.gold += refund;
    this.emit('sell', { t, refund });
    this.emit('gold', { gold: this.gold });
  }

  // ── Habilidades activas ─────────────────────────────────
  // El daño crece con la oleada para que sigan siendo útiles al final
  abilityPower() { return 1 + Math.max(0, this.waveIndex) * 0.15; }

  // con héroe, sus habilidades solo se pueden usar mientras está vivo
  canUse(id) {
    const A = ABILITIES[id];
    if (A?.energy && (!this.hero || (this.hero.energy || 0) < A.energy)) return false;
    return !this.over && this.abilityCd[id] != null && this.abilityCd[id] <= 0 && this.waveIndex >= 0 && (!this.heroDef || (this.hero && this.hero.alive));
  }

  useMeteor(x, z) {
    const A = ABILITIES.meteor;
    if (!this.canUse('meteor')) return false;
    this.abilityCd.meteor = A.cooldown;
    const dmg = A.dmg * this.abilityPower();
    const drops = [];
    for (let i = 0; i < A.count; i++) {
      const a = this.rand() * Math.PI * 2, r = Math.sqrt(this.rand()) * A.radius;
      const d = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, delay: 0.25 + i * 0.18 };
      drops.push(d);
      this.scheduled.push({
        at: this.time + d.delay + 0.7,
        run: () => {
          this.emit('meteorHit', { x: d.x, z: d.z, r: A.splash });
          for (const e of this.enemies) {
            if (e.alive && Math.hypot(e.x - d.x, e.z - d.z) <= A.splash) this.damage(e, dmg, { kind: 'meteor' });
          }
        },
      });
    }
    this.emit('meteor', { x, z, drops, radius: A.radius });
    return true;
  }

  useBlizzard() {
    const A = ABILITIES.blizzard;
    if (!this.canUse('blizzard')) return false;
    this.abilityCd.blizzard = A.cooldown;
    const p = { kind: 'blizzard', slow: A.slow, slowTime: A.time };
    const dmg = A.dmg * this.abilityPower();
    for (const e of this.enemies) if (e.alive) this.damage(e, dmg, p);
    this.emit('blizzard');
    return true;
  }

  // ── Clima ───────────────────────────────────────────
  setWeather(id) {
    this.weather = id;
    this.wx = { speed: 1, range: 1, fire: 1, freeze: 1, burn: 0, bolts: false, ...(WEATHER_FX[id] || {}) };
  }

  // Un rayo cae sobre un enemigo al azar (solo con tormenta). Devuelve dónde cae.
  lightning() {
    if (!this.wx.bolts || this.over) return null;
    const list = this.enemies.filter((e) => e.alive && e.dist > 6 && e.dist < this.path.length - 4);
    if (!list.length) return null;
    const t = list[Math.floor(this.rand() * list.length)];
    const x = t.x, z = t.z;
    const dmg = WEATHER_BOLT.dmg * this.abilityPower();
    for (const e of this.enemies) {
      if (e.alive && Math.hypot(e.x - x, e.z - z) <= WEATHER_BOLT.splash) this.damage(e, e === t ? dmg : dmg * 0.5, { kind: 'lightning' });
    }
    return { x, z };
  }


  // ── Héroe ───────────────────────────────────────────────
  // Sitio válido para colocar el héroe o su ancla
  checkHeroSpot(x, z) {
    if (Math.abs(x) > BUILD_BOUNDS.x || Math.abs(z) > BUILD_BOUNDS.z) return 'fuera';
    for (const t of this.towers) if (Math.hypot(t.x - x, t.z - z) < this.footprint * 1.2) return 'torre';
    for (const o of this.obstacles) if (Math.hypot(o.x - x, o.z - z) < o.r + 0.8) return 'obstaculo';
    return null;
  }

  // Colocar (primera vez o, antes de la 1.ª oleada, recolocar gratis) o mandar mover.
  // Todos los héroes se mueven por todo el mapa. El punto donde lo colocas o lo mandas es su punto de guardia:
  // en modo auto va siempre a por algún enemigo y, si no queda ninguno, vuelve allí.
  placeHero(x, z) {
    const d = this.heroDef;
    if (!d || this.over) return false;
    const h = this.hero;
    if (h && this.waveIndex >= 0) {
      if (Math.abs(x) > BUILD_BOUNDS.x + 4 || Math.abs(z) > BUILD_BOUNDS.z + 4) return false;
      h.ax = x; h.az = z;
      h.moveTo = { x, z };
      this.emit('heroMove', { h, x, z });
      return true;
    }
    if (this.checkHeroSpot(x, z)) return false;
    if (!h) {
      this.hero = {
        uid: UID++, isHero: true, type: 'hero', id: d.id, def: d, level: 1, energy: 0, frenzyUntil: 0,
        x, z, ax: x, az: z, hp: d.hp, maxHp: d.hp, alive: true, cd: 0.4,
        target: null, moveTo: null, respawn: 0, lastHurt: -99, facing: 0, moving: false,
        heat: 0, jamUntil: 0, lastShot: -99,
      };
      this.emit('heroPlace', { h: this.hero, first: true });
    } else {
      Object.assign(h, { x, z, ax: x, az: z, moveTo: null });
      this.emit('heroPlace', { h, first: false });
    }
    return true;
  }

  // Modo auto (por defecto): el héroe va a por los enemigos por todo el mapa.
  // Manual: se queda quieto donde lo mandes y solo ataca lo que tenga a su alcance.
  setHeroAuto(on) { this.heroAuto = !!on; }

  updateHero(dt) {
    const h = this.hero;
    if (!h) return;
    for (const e of this.enemies) if (e.blockedBy === h) e.blockedBy = null;
    if (!h.alive) {
      h.respawn -= dt;
      if (h.respawn <= 0) {
        Object.assign(h, { alive: true, hp: h.maxHp, x: h.ax, z: h.az, moveTo: null, target: null, lastHurt: -99, retreat: false });
        this.emit('heroRespawn', { h });
      }
      return;
    }
    const d = h.def;
    const melee = d.type === 'melee';
    const reach = melee ? d.reach : d.range; // alcance de su arma
    const auto = this.heroAuto !== false;
    if (this.time - h.lastHurt > HERO_RULES.regenDelay) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * HERO_RULES.regen * dt);
    h.cd -= dt;
    h.moving = false;
    const dist = (e, x, z) => Math.hypot(e.x - x, e.z - z);
    const canHit = (e) => e.alive && e.hp > 0 && (!melee || !e.def.fly);
    let goal = null;

    if (h.moveTo) {
      // obedece primero la orden de moverse; por el camino el de distancia sigue disparando
      goal = { x: h.moveTo.x, z: h.moveTo.z, stop: 0.05 };
      h.target = null;
    } else if (auto && (h.retreat || h.hp < h.maxHp * HERO_RULES.retreatAt)) {
      // casi muerto: se retira un momento a su punto de guardia, donde se cura deprisa, y vuelve a la carga
      // (por el camino sigue atacando lo que tenga a tiro)
      if (!h.retreat) this.emit('heroRetreat', { h });
      h.retreat = h.hp < h.maxHp * HERO_RULES.retreatUntil;
      h.target = null;
      goal = { x: h.ax, z: h.az, stop: 0.05 };
      if (dist(h, h.ax, h.az) < 1) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * HERO_RULES.retreatHeal * dt);
    } else if (auto) {
      // siempre a por algún enemigo, esté donde esté. Cuerpo a cuerpo: el más cercano a él.
      // A distancia: si tiene alguno a tiro, el más avanzado; si no, el más cercano (con algo de preferencia
      // por los que van más adelantados). El objetivo actual tiene ventaja para no cambiar a cada momento.
      let best = null, bs = -Infinity;
      for (const e of this.enemies) {
        if (!canHit(e)) continue;
        const de = dist(e, h.x, h.z);
        let sc;
        if (melee) sc = -de;
        else sc = de <= reach ? 1000 + e.dist : -de + e.dist * 0.15;
        if (e === h.target) sc += melee ? 4 : (de <= reach ? 1000 : 4);
        if (sc > bs) { bs = sc; best = e; }
      }
      h.target = best;
      if (best) {
        const dd = dist(best, h.x, h.z);
        if (melee) { if (dd > reach * 0.85) goal = { x: best.x, z: best.z, stop: reach * 0.8 }; }
        else if (dd > reach * 0.92) {
          // se acerca lo justo: se queda a ~80 % de su alcance, por el lado desde el que llega
          const k = (reach * 0.8) / dd;
          goal = { x: best.x + (h.x - best.x) * k, z: best.z + (h.z - best.z) * k, stop: 0.2 };
        }
      } else goal = { x: h.ax, z: h.az, stop: 0.05 };
    } else {
      h.target = null;
      if (dist(h, h.ax, h.az) > 0.1) goal = { x: h.ax, z: h.az, stop: 0.05 };
    }
    // sin objetivo (o en manual): lo que tenga a su alcance
    if (!h.target || dist(h.target, h.x, h.z) > reach + 0.6) {
      let best = null, bs = -Infinity;
      for (const e of this.enemies) {
        if (!canHit(e) || dist(e, h.x, h.z) > reach + (melee ? 0.6 : 0)) continue;
        if (e.dist > bs) { bs = e.dist; best = e; }
      }
      if (best && (!h.target || !auto || h.moveTo)) h.target = best;
    }

    // movimiento (por todo el mapa, sin salirse de sus bordes)
    if (goal) {
      const dx = goal.x - h.x, dz = goal.z - h.z, L = Math.hypot(dx, dz);
      // margen de llegada: sin él se quedaba a una milésima del destino «andando en el sitio» para siempre
      // (y la orden de moverse no se borraba nunca, así que dejaba de hacer caso al modo auto)
      if (L > goal.stop + 0.02) {
        const step = Math.min(L - goal.stop, d.speed * dt);
        const ox = h.x, oz = h.z;
        h.x += (dx / L) * step;
        h.z += (dz / L) * step;
        h.x = Math.max(-BUILD_BOUNDS.x - 4, Math.min(BUILD_BOUNDS.x + 4, h.x));
        h.z = Math.max(-BUILD_BOUNDS.z - 4, Math.min(BUILD_BOUNDS.z + 4, h.z));
        h.facing = Math.atan2(dx, dz);
        // contra el borde del mapa no avanza: no lo animes andando
        h.moving = Math.hypot(h.x - ox, h.z - oz) > step * 0.3;
        if (h.moveTo && (!h.moving || L - step <= goal.stop + 0.02)) h.moveTo = null;
      } else if (h.moveTo) h.moveTo = null;
    }
    // bloqueo: el de cuerpo a cuerpo frena a los enemigos terrestres que tiene encima (máx. blockCap)
    if (melee) {
      const near = this.enemies.filter((e) => e.alive && !e.def.fly && dist(e, h.x, h.z) <= d.reach + 0.6)
        .sort((a, b) => dist(a, h.x, h.z) - dist(b, h.x, h.z));
      for (let i = 0; i < Math.min(d.blockCap, near.length); i++) near[i].blockedBy = h;
    }
    // ataque
    const t = h.target;
    if (t && t.alive && h.cd <= 0) {
      const dd = dist(t, h.x, h.z);
      const frenzy = this.time < (h.frenzyUntil || 0);
      if (melee && dd <= d.reach + 0.6) {
        h.cd = d.cooldown / (frenzy ? ABILITIES.frenzy.rate : 1);
        h.facing = Math.atan2(t.x - h.x, t.z - h.z);
        this.emit('heroAttack', { h, target: t });
        const dmg = d.dmg * this.heroPower();
        this.damage(t, dmg, { kind: 'claw', tower: h });
        if (frenzy) h.hp = Math.min(h.maxHp, h.hp + dmg * ABILITIES.frenzy.lifesteal);
        // barrido: los demás enemigos pegados a él reciben parte del zarpazo
        if (d.cleave) for (const e of this.enemies) if (e !== t && e.alive && !e.def.fly && dist(e, h.x, h.z) <= d.reach + 0.8) this.damage(e, dmg * d.cleave, { kind: 'claw', tower: h });
      } else if (!melee && dd <= d.range && !(d.overheat && this.time < h.jamUntil)) {
        h.cd = d.cooldown / (frenzy ? ABILITIES.frenzy.rate : 1);
        if (!h.moving) h.facing = Math.atan2(t.x - h.x, t.z - h.z);
        this.emit('heroAttack', { h, target: t });
        this.fire(h, t);
        // Tuerca: la metralleta se recalienta tras «overheat» disparos y a veces se encasquilla
        if (d.overheat) {
          h.heat++;
          h.lastShot = this.time;
          if (h.heat >= d.overheat) { h.heat = 0; h.jamUntil = this.time + d.jamTime; this.emit('heroJam', { h, kind: 'heat', time: d.jamTime }); }
          else if (this.rand() < d.jamChance) { h.heat = 0; h.jamUntil = this.time + d.jamTime; this.emit('heroJam', { h, kind: 'jam', time: d.jamTime }); }
        }
      }
    }
    // se enfría si deja de disparar un momento
    if (d.overheat && h.heat > 0 && this.time - h.lastShot > 0.4) h.heat = Math.max(0, h.heat - d.cool * dt);
    // los enemigos terrestres que lo tocan (o que tiene bloqueados) le pegan
    for (const e of this.enemies) {
      if (!e.alive || !e.atk || e.def.fly) continue;
      if (e.blockedBy === h || dist(e, h.x, h.z) < 1.7) {
        e.atkCd -= dt;
        if (e.atkCd <= 0) { e.atkCd = 1; this.hurtHero(e.atk, e); if (!h.alive) break; }
      }
    }
  }

  // Punto de guardia que cubre más camino a su alrededor
  bestHeroSpot() {
    const d = this.heroDef;
    if (!d) return null;
    const r = 13;
    const p = {};
    let best = null;
    for (let x = -56; x <= 56; x += 2) for (let z = -32; z <= 32; z += 2) {
      if (this.checkHeroSpot(x, z)) continue;
      let c = 0;
      for (let dd = 0; dd < this.path.length; dd += 1) {
        this.path.at(dd, p);
        if (Math.abs(p.x) > 62) continue;
        if ((p.x - x) ** 2 + (p.z - z) ** 2 <= r * r) c++;
      }
      // a igualdad, mejor cerca del centro (en la entrada de la cueva no llegan las torres)
      const sc = c * 1000 - Math.hypot(x, z);
      if (!best || sc > best.sc) best = { x, z, c, sc };
    }
    return best;
  }

  // El héroe sube su daño con las oleadas, como las habilidades
  heroPower() { return 1 + Math.max(0, this.waveIndex) * 0.08; }

  hurtHero(n, e) {
    const h = this.hero;
    if (!h || !h.alive) return;
    h.hp -= n * (1 - (h.def.armor || 0)); // la armadura reduce el daño recibido
    h.lastHurt = this.time;
    this.emit('heroHurt', { h, amount: n, e });
    if (h.hp <= 0) {
      h.hp = 0;
      h.alive = false;
      h.respawn = h.def.respawn;
      h.target = null;
      h.moveTo = null;
      for (const en of this.enemies) if (en.blockedBy === h) en.blockedBy = null;
      this.emit('heroDeath', { h });
    }
  }

  // Colmillo: salta sobre el enemigo con más vida que tenga cerca y daña a los de alrededor
  useLeap() {
    const A = ABILITIES.leap, h = this.hero;
    if (!this.canUse('leap') || !h) return false;
    const R = A.range;
    let best = null;
    for (const e of this.enemies) {
      if (!e.alive || e.def.fly) continue;
      if (Math.hypot(e.x - h.x, e.z - h.z) > R) continue;
      if (!best || e.hp > best.hp) best = e;
    }
    if (!best) return false;
    this.abilityCd.leap = A.cooldown;
    const from = { x: h.x, z: h.z };
    h.x = best.x; h.z = best.z;
    h.target = best;
    h.cd = 0.35;
    this.emit('heroLeap', { h, from, to: { x: best.x, z: best.z }, radius: A.radius });
    const dmg = A.dmg * this.abilityPower();
    for (const e of this.enemies) if (e.alive && Math.hypot(e.x - h.x, e.z - h.z) <= A.radius) this.damage(e, e === best ? dmg : dmg * 0.6, { kind: 'claw', tower: h });
    return true;
  }

  // Colmillo: aullido que aturde a los enemigos cercanos (los jefes, la mitad de tiempo)
  // ── Definitivas (E): se cargan con las bajas ──────────
  // Chamán: nova arcana que golpea y aturde a todo lo que hay a su alrededor
  useArcaneNova() {
    const A = ABILITIES.arcaneNova, h = this.hero;
    if (!this.canUse('arcaneNova') || !h) return false;
    h.energy = 0;
    const R = A.radius;
    const dmg = A.dmg * this.abilityPower();
    this.emit('heroUlt', { h, kind: 'arcaneNova', radius: R });
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.x - h.x, e.z - h.z) > R) continue;
      e.stunUntil = Math.max(e.stunUntil, this.time + A.stun * (e.def.boss ? 0.5 : 1));
      this.damage(e, dmg, { kind: 'arcane', tower: h });
    }
    return true;
  }
  // Colmillo: frenesí, ataca mucho más rápido y se cura con cada golpe
  useFrenzy() {
    const A = ABILITIES.frenzy, h = this.hero;
    if (!this.canUse('frenzy') || !h) return false;
    h.energy = 0;
    h.frenzyUntil = this.time + A.time;
    this.emit('heroUlt', { h, kind: 'frenzy', time: A.time });
    return true;
  }

  // ── Tuerca ─────────────────────────────────────────────
  // ¿Se puede poner un cepo aquí? (tiene que estar en el camino)
  checkTrapSpot(x, z) { return this.path.distanceTo(x, z) <= PATH_HALF + 1.5 ? null : 'camino'; }

  useTrap(x, z) {
    const A = ABILITIES.trap;
    if (!this.canUse('trap') || this.checkTrapSpot(x, z)) return false;
    this.abilityCd.trap = A.cooldown;
    // como mucho «max» cepos: el más antiguo desaparece
    while (this.traps.length >= A.max) { const old = this.traps.shift(); this.emit('gadgetEnd', { g: old }); }
    const g = { uid: UID++, kind: 'trap', x, z, until: this.time + A.life };
    this.traps.push(g);
    this.emit('gadget', { g });
    return true;
  }

  useTurret(x, z) {
    const A = ABILITIES.turret;
    if (!this.canUse('turret') || this.checkHeroSpot(x, z)) return false;
    this.abilityCd.turret = A.cooldown;
    for (const old of this.turrets) this.endTurret(old);
    const g = {
      uid: UID++, kind: 'turret', gadget: true, type: 'hero', level: 1, x, z, sy: 2.6, alive: true,
      def: { projectile: 'gatling', projSpeed: 80, dmg: A.dmg, cooldown: A.rate },
      range: A.range, priority: 'first', cd: 0.3, target: null, until: this.time + A.life,
    };
    // en el camino frena a los enemigos, pero le pegan y se rompe enseguida
    if (this.path.distanceTo(x, z) <= PATH_HALF + 1) { g.onPath = true; g.hp = g.maxHp = Math.round(A.hp * this.heroPower()); }
    this.turrets = [g];
    this.emit('gadget', { g });
    return true;
  }

  updateGadgets(dt) {
    if (!this.traps.length && !this.turrets.length) return;
    const A = ABILITIES.trap;
    for (const g of this.traps) {
      if (this.time > g.until) { g.done = true; this.emit('gadgetEnd', { g }); continue; }
      if (!this.enemies.some((e) => e.alive && !e.def.fly && Math.hypot(e.x - g.x, e.z - g.z) <= A.trigger)) continue;
      // ¡clac! daña y deja clavados a los de alrededor (los jefes, la mitad de tiempo)
      g.done = true;
      const dmg = A.dmg * this.abilityPower();
      this.emit('gadgetEnd', { g, boom: true, radius: A.radius });
      for (const e of this.enemies) {
        if (!e.alive || e.def.fly || Math.hypot(e.x - g.x, e.z - g.z) > A.radius) continue;
        e.stunUntil = Math.max(e.stunUntil, this.time + A.root * (e.def.boss ? 0.5 : 1));
        this.damage(e, dmg, { kind: 'trap', tower: g });
      }
    }
    this.traps = this.traps.filter((g) => !g.done);
    for (const g of this.turrets) {
      if (this.time > g.until) { this.endTurret(g); continue; }
      if (g.onPath) {
        // bloquea a los terrestres que tiene encima (máx. blockCap) y ellos le pegan
        for (const e of this.enemies) if (e.blockedBy === g) e.blockedBy = null;
        const near = this.enemies.filter((e) => e.alive && !e.def.fly && Math.hypot(e.x - g.x, e.z - g.z) <= 1.8)
          .sort((a, b) => Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z));
        for (let i = 0; i < Math.min(ABILITIES.turret.blockCap, near.length); i++) if (!near[i].blockedBy) near[i].blockedBy = g;
        for (const e of this.enemies) {
          if (!e.alive || !e.atk || e.def.fly || (e.blockedBy !== g && Math.hypot(e.x - g.x, e.z - g.z) > 1.6)) continue;
          e.atkCd -= dt;
          if (e.atkCd > 0) continue;
          e.atkCd = 1;
          g.hp -= e.atk;
          this.emit('gadgetHurt', { g });
          if (g.hp <= 0) { this.endTurret(g, true); break; }
        }
        if (g.done) continue;
      }
      g.cd -= dt;
      if (g.cd > 0) continue;
      const t = this.findTarget(g);
      g.target = t;
      if (!t) continue;
      g.cd = g.def.cooldown;
      this.fire(g, t);
    }
    this.turrets = this.turrets.filter((g) => !g.done);
  }

  endTurret(g, destroyed = false) {
    if (g.done) return;
    g.done = true;
    g.alive = false;
    for (const e of this.enemies) if (e.blockedBy === g) e.blockedBy = null;
    this.emit('gadgetEnd', { g, destroyed });
  }

  // Definitiva de Tuerca: cohetes contra los enemigos más peligrosos de todo el mapa (jefes primero)
  useRockets() {
    const A = ABILITIES.rockets, h = this.hero;
    if (!this.canUse('rockets') || !h) return false;
    const pick = () => this.enemies.filter((e) => e.alive).sort((a, b) => (b.def.boss ? 1e6 : 0) + b.hp * 0.01 + b.dist - ((a.def.boss ? 1e6 : 0) + a.hp * 0.01 + a.dist));
    const list = pick();
    if (!list.length) return false;
    h.energy = 0;
    this.emit('heroUlt', { h, kind: 'rockets' });
    const dmg = A.dmg * this.abilityPower();
    for (let i = 0; i < A.count; i++) {
      this.scheduled.push({
        at: this.time + 0.15 + i * 0.12,
        run: () => {
          let e = list[i % list.length];
          if (!e.alive) e = pick()[0];
          if (!e || this.over) return;
          const sx = h.x, sz = h.z, d = Math.hypot(e.x - sx, e.z - sz);
          const p = {
            uid: UID++, kind: 'rocket', tower: h, target: e,
            sx, sy: 3, sz, tx: e.x, tz: e.z, ty: e.def.fly ? 2.2 : 0.8, x: sx, y: 3, z: sz, t: 0,
            dur: Math.max(0.55, d / 32), arc: 5 + Math.min(10, d * 0.12),
            dmg, splash: A.splash, splashRatio: 0.6, poisonDps: 0, poisonTime: 0, slow: 0, slowTime: 0,
          };
          this.projectiles.push(p);
          this.emit('fire', { t: h, p });
        },
      });
    }
    return true;
  }

  useHowl() {
    const A = ABILITIES.howl, h = this.hero;
    if (!this.canUse('howl') || !h) return false;
    this.abilityCd.howl = A.cooldown;
    const dmg = A.dmg * this.abilityPower();
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.x - h.x, e.z - h.z) > A.radius) continue;
      e.stunUntil = Math.max(e.stunUntil, this.time + A.stun * (e.def.boss ? 0.5 : 1));
      this.damage(e, dmg, { kind: 'howl' });
    }
    this.emit('heroHowl', { h, radius: A.radius });
    return true;
  }

  // ── Trucos ──────────────────────────────────────────────
  cheat(code) {
    if (code !== 'ororo') this.cheated = true; // el clima no cambia la puntuación
    switch (code) {
      case 'greedisgood': this.addGold(200); break;
      case 'hollymolly': this.addGold(1000); break;
      case 'whosyourdaddy': this.flameUnlocked = true; this.emit('unlock', { type: 'flame' }); break;
      case 'ezwin': this.win(); break;
      case '4lose': this.hp = 0; this.emit('escape', { e: null }); this.lose(); break;
      case 'thanos': this.emit('thanos'); break;
      case 'ororo': this.emit('ororo'); break; // la vista decide el clima (no afecta a la lógica pura)
      default: return false;
    }
    this.emit('cheat', { code });
    return true;
  }

  snapAll() {
    for (const e of this.enemies) this.kill(e, true);
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  // ── Guardado de partida (solo entre oleadas) ───────────
  serialize() {
    if (this.over || (this.state !== 'prep' && this.state !== 'intermission')) return null;
    if (this.endless && this.waveIndex >= 0) return null; // el infinito no tiene pausas entre oleadas: no se guarda a medias
    return {
      v: 1, levelId: this.levelId, endless: this.endless, gold: this.gold, hp: this.hp, waveIndex: this.waveIndex, cheated: this.cheated,
      best: this.best, stats: { ...this.stats }, abilityCd: { ...this.abilityCd }, flameUnlocked: this.flameUnlocked,
      waves: this.endless ? this.waves.map((w) => w.join('')) : undefined,
      towers: this.towers.map((t) => ({ type: t.type, x: t.x, z: t.z, level: t.level, invested: t.invested, priority: t.priority })),
      hero: this.hero ? { id: this.hero.id, ax: this.hero.ax, az: this.hero.az, x: this.hero.x, z: this.hero.z, hp: this.hero.hp, alive: this.hero.alive, respawn: this.hero.respawn, energy: this.hero.energy || 0 } : this.heroDef ? { id: this.heroDef.id } : null,
      savedAt: Date.now(),
    };
  }

  restore(s) {
    this.gold = s.gold;
    this.hp = s.hp;
    this.waveIndex = s.waveIndex;
    this.best = s.best || 0;
    if (s.cheated) this.cheated = true;
    Object.assign(this.stats, s.stats || {});
    Object.assign(this.abilityCd, s.abilityCd || {});
    if (s.flameUnlocked) this.flameUnlocked = true;
    if (this.endless && s.waves) this.waves = s.waves.map((w) => w.split(''));
    if (this.endless && s.waveIndex >= 0) this.cheated = true; // partida infinita recuperada: no puntúa
    this.state = 'prep';
    this.timer = PREP_TIME;
    if (s.hero && s.hero.ax != null && this.heroDef) {
      this.placeHero(s.hero.ax, s.hero.az);
      if (this.hero) Object.assign(this.hero, { x: s.hero.x, z: s.hero.z, hp: Math.max(1, s.hero.hp), alive: s.hero.alive !== false, respawn: s.hero.respawn || 0, energy: s.hero.energy || 0 });
    }
    for (const o of s.towers || []) {
      const def = TOWERS[o.type];
      if (!def) continue;
      const level = Math.max(1, Math.min(MAX_LEVEL, o.level | 0));
      const t = {
        uid: UID++, type: o.type, def, x: o.x, z: o.z, level, cd: 0.2, invested: o.invested || def.cost,
        range: def.range * UPGRADE.range[level - 1], target: null, priority: o.priority || 'first',
      };
      this.towers.push(t);
      this.emit('build', { t, restored: true });
    }
    this.emit('gold', { gold: this.gold });
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
