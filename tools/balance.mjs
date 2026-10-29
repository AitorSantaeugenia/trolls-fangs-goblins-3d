// Bot sencillo que juega cada nivel con la simulación real para comprobar el equilibrio.
// Uso: node tools/balance.mjs [nivel] [--flame]
import { Sim } from '../www/js/sim.js';
import { TOWERS, LEVEL_ORDER, HEROES } from '../www/js/config.js';
const HERO = (process.argv.find((a) => a.startsWith('--hero=')) || '--hero=').split('=')[1] || null;
const SKILL = parseFloat((process.argv.find((a) => a.startsWith('--skill=')) || '--skill=1').split('=')[1]);

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function coverage(sim, x, z, range) {
  let c = 0;
  const step = 1;
  const p = {};
  for (let d = 0; d < sim.path.length; d += step) {
    sim.path.at(d, p);
    if (Math.abs(p.x) > 62) continue;
    if ((p.x - x) ** 2 + (p.z - z) ** 2 <= range * range) c++;
  }
  return c;
}

function play(levelId, flame, seed = 1, verbose = false, planName = 'classic', endless = false) {
  const sim = new Sim(levelId, { flameUnlocked: flame, rand: seeded(seed), endless, hero: HERO });
  // héroe: en el punto que más camino cubre con su alcance (o zona de guardia)
  if (HERO) { const b = sim.bestHeroSpot(); sim.placeHero(b.x, b.z); }
  const spots = [];
  for (let x = -58; x <= 58; x += 2) for (let z = -33; z <= 33; z += 2) spots.push([x, z]);
  const cov = {};
  for (const type of Object.keys(TOWERS)) {
    cov[type] = spots.map(([x, z]) => ({ x, z, c: coverage(sim, x, z, TOWERS[type].range) })).sort((a, b) => b.c - a.c);
  }
  const PLANS = {
    classic: ['sand', 'sand', 'catapult', 'sand', 'slow', 'catapult', 'catapult', 'sand', 'catapult'],
    flame: ['sand', 'sand', 'flame', 'slow', 'flame', 'catapult', 'flame', 'flame'],
    new: ['sand', 'double', 'heavy', 'poison', 'slow', 'double', 'heavy', 'double'],
    double: ['sand', 'double', 'double', 'slow', 'double', 'double'],
    heavy: ['sand', 'sand', 'heavy', 'slow', 'heavy', 'heavy'],
    poison: ['sand', 'poison', 'poison', 'slow', 'poison', 'poison'],
  };
  const plan = PLANS[flame ? 'flame' : planName];
  let pi = 0;
  const rnd = seeded(seed * 7 + 3);
  const dt = 1 / 30;
  let thinking = 0;
  while (!sim.over && sim.time < (endless ? 20000 : 3000)) {
    thinking -= dt;
    if (thinking <= 0) {
      thinking = SKILL >= 1 ? 0.5 : 3;
      // construir
      const type = plan[pi % plan.length];
      if (sim.gold >= TOWERS[type].cost) {
        const ok = cov[type].filter((s) => !sim.checkPlacement(type, s.x, s.z));
        const spot = SKILL >= 1 ? ok[0] : ok[Math.floor(rnd() * ok.length * (1 - SKILL) * 0.6)];
        if (spot && spot.c > 6) { sim.build(type, spot.x, spot.z); pi++; }
        else {
          // mejorar la mejor torre
          const t = sim.towers.filter((t) => sim.upgradeCost(t) != null).sort((a, b) => sim.upgradeCost(a) - sim.upgradeCost(b))[0];
          if (t && sim.gold >= sim.upgradeCost(t)) sim.upgrade(t);
        }
      } else if (sim.towers.length >= 6) {
        const t = sim.towers.filter((t) => sim.upgradeCost(t) != null && t.type !== 'slow').sort((a, b) => sim.upgradeCost(a) - sim.upgradeCost(b))[0];
        if (t && sim.gold >= sim.upgradeCost(t) + 40) sim.upgrade(t);
      }
      if (sim.state === 'prep' && sim.towers.length >= 3) sim.callWave();
    }
    if (HERO && sim.enemies.length >= 3) for (const a of sim.abilities) {
      if (!sim.canUse(a)) continue;
      if (a === 'meteor') { const e = sim.enemies.reduce((m, e) => (e.dist > m.dist ? e : m)); sim.useMeteor(e.x, e.z); }
      else if (a === 'blizzard') sim.useBlizzard();
      else if (a === 'leap') sim.useLeap();
      else if (a === 'howl' && sim.enemies.some((e) => Math.hypot(e.x - sim.hero.x, e.z - sim.hero.z) < 8)) sim.useHowl();
      else if (a === 'arcaneNova' && sim.enemies.filter((e) => Math.hypot(e.x - sim.hero.x, e.z - sim.hero.z) < 14).length >= 4) sim.useArcaneNova();
      else if (a === 'frenzy' && sim.hero.target) sim.useFrenzy();
      else if (a === 'trap') {
        // el cepo, un poco por delante del enemigo más adelantado
        const e = sim.enemies.filter((e) => !e.def.fly).reduce((m, e) => (!m || e.dist > m.dist ? e : m), null);
        if (e) { const p = sim.path.at(Math.min(sim.path.length - 2, e.dist + 5), {}); sim.useTrap(p.x, p.z); }
      } else if (a === 'turret') {
        // la minitorreta, al lado del camino cerca del frente
        const e = sim.enemies.reduce((m, e) => (e.dist > m.dist ? e : m));
        const p = sim.path.at(Math.min(sim.path.length - 2, e.dist + 3), {});
        for (const [ox, oz] of [[3.5, 0], [-3.5, 0], [0, 3.5], [0, -3.5], [3, 3], [-3, -3]]) if (sim.useTurret(p.x + ox, p.z + oz)) break;
      } else if (a === 'rockets' && (sim.enemies.length >= 6 || sim.enemies.some((e) => e.def.boss))) sim.useRockets();
    }
    sim.update(dt);
    for (const ev of sim.drainEvents()) {
      if (ev.type === 'heroDeath') sim._deaths = (sim._deaths || 0) + 1;
      if (verbose && (ev.type === 'wave' || ev.type === 'escape')) console.log(sim.time.toFixed(1), ev.type, ev.index ?? '', 'hp', sim.hp, 'gold', sim.gold, 'towers', sim.towers.length);
    }
  }
  return { heroDeaths: sim._deaths || 0, level: levelId, plan: flame ? 'flame' : planName, best: sim.best, flame, result: sim.state, hp: `${sim.hp}/${sim.maxHp}`, wave: `${sim.waveIndex + 1}/${sim.totalWaves}`, towers: sim.towers.map((t) => t.type[0] + t.level).join(' '), time: Math.round(sim.time) };
}

const only = process.argv[2] && !process.argv[2].startsWith('--') ? [process.argv[2]] : LEVEL_ORDER;
const planArg = (process.argv.find((a) => a.startsWith('--plan=')) || '--plan=classic').split('=')[1];
const endless = process.argv.includes('--endless');
for (const id of only) {
  const runs = [1, 2, 3].map((s) => play(id, process.argv.includes('--flame'), s, process.argv.includes('-v'), planArg, endless));
  for (const r of runs) console.log(JSON.stringify({ hero: HERO || '-', level: r.level, result: r.result, hp: r.hp, wave: r.wave, towers: r.towers.split(' ').length, heroDeaths: r.heroDeaths }));
}
