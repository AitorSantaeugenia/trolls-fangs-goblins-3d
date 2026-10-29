// Logros: se guardan en el progreso y avisan con una tarjeta al desbloquearse.
// Las partidas con trucos no cuentan (salvo el logro secreto del guantelete).
import { save } from './save.js';
import { audio } from './audio.js';
import { LEVEL_ORDER, LEVELS } from './config.js';

export const ACHIEVEMENTS = [
  { id: 'first_blood', icon: '🗡️', name: 'Primera sangre', desc: 'Derrota a tu primer enemigo.' },
  { id: 'kills_500', icon: '⚔️', name: 'Cazador', desc: 'Derrota a 500 enemigos en total.', goal: 500, stat: 'kills' },
  { id: 'kills_5000', icon: '💀', name: 'Exterminador', desc: 'Derrota a 5.000 enemigos en total.', goal: 5000, stat: 'kills' },
  { id: 'boss_first', icon: '👹', name: 'Matagigantes', desc: 'Derrota a un jefe.' },
  { id: 'boss_50', icon: '🏆', name: 'Leyenda', desc: 'Derrota a 50 jefes en total.', goal: 50, stat: 'bosses' },
  { id: 'win_easy', icon: '🌿', name: 'La pradera respira', desc: `Gana en ${LEVELS.easy.name}.` },
  { id: 'win_normal', icon: '🪦', name: 'Descansen en paz', desc: `Gana en ${LEVELS.normal.name}.` },
  { id: 'win_desert', icon: '🦂', name: 'Rey de las dunas', desc: `Gana en ${LEVELS.desert.name}.` },
  { id: 'win_hard', icon: '🧊', name: 'Deshielo', desc: `Gana en ${LEVELS.hard.name}.` },
  { id: 'win_hell', icon: '🔥', name: 'Bajada a los infiernos', desc: `Gana en ${LEVELS.hell.name}.` },
  { id: 'perfect', icon: '🛡️', name: 'Intocable', desc: 'Gana un nivel sin perder ninguna vida.' },
  { id: 'all_stars', icon: '⭐', name: 'Perfeccionista', desc: 'Consigue 3 estrellas en los cinco niveles.' },
  { id: 'minimalist', icon: '🪶', name: 'Minimalista', desc: 'Gana un nivel con 5 torres o menos.' },
  { id: 'flame', icon: '🌋', name: 'Fuego eterno', desc: 'Desbloquea la Torre de Fuego.' },
  { id: 'max_tower', icon: '⬆️', name: 'A tope', desc: 'Mejora una torre hasta el nivel 3.' },
  { id: 'architect', icon: '🏰', name: 'Arquitecto', desc: 'Ten 12 torres a la vez en una partida.' },
  { id: 'rich', icon: '💰', name: 'Tesoro de goblin', desc: 'Acumula 3.000 de oro a la vez.' },
  { id: 'impatient', icon: '⏩', name: 'Impaciente', desc: 'Llama 15 oleadas antes de tiempo.', goal: 15, stat: 'early' },
  { id: 'meteor_5', icon: '☄️', name: 'Impacto profundo', desc: 'Derrota a 5 enemigos con una sola lluvia de meteoritos.' },
  { id: 'blizzard_10', icon: '❄️', name: 'Invierno eterno', desc: 'Usa la ventisca 10 veces.', goal: 10, stat: 'blizzards' },
  { id: 'poison_100', icon: '🧪', name: 'Veneno lento', desc: 'Remata a 100 enemigos con veneno.', goal: 100, stat: 'poisonKills' },
  { id: 'endless_10', icon: '♾️', name: 'Resistente', desc: 'Llega a la oleada 10 en modo infinito.' },
  { id: 'endless_25', icon: '👑', name: 'Inquebrantable', desc: 'Llega a la oleada 25 en modo infinito.' },
  { id: 'cartographer', icon: '🗺️', name: 'Cartógrafo', desc: 'Gana en un mapa creado con el editor.' },
  { id: 'inevitable', icon: '🫰', name: 'Inevitable', desc: 'Chasquea los dedos.', secret: true },
];

const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

function data() {
  if (!save.data.ach) save.data.ach = { unlocked: {}, stats: {} };
  return save.data.ach;
}

export function achievementCount() {
  return { have: Object.keys(data().unlocked).filter((id) => BY_ID[id]).length, total: ACHIEVEMENTS.length };
}

export class Achievements {
  constructor() {
    this.queue = [];
    this.showing = false;
    this.el = document.getElementById('ach-pop');
  }

  has(id) { return !!data().unlocked[id]; }

  unlock(id) {
    if (this.has(id) || !BY_ID[id]) return;
    data().unlocked[id] = Date.now();
    save.write();
    this.queue.push(BY_ID[id]);
    this.pump();
  }

  bump(stat, n = 1) {
    const s = data().stats;
    s[stat] = (s[stat] || 0) + n;
    for (const a of ACHIEVEMENTS) if (a.stat === stat && s[stat] >= a.goal) this.unlock(a.id);
  }

  // Tarjeta emergente, una detrás de otra
  pump() {
    if (this.showing || !this.queue.length || !this.el) return;
    const a = this.queue.shift();
    this.showing = true;
    this.el.innerHTML = `<span class="ach-icon">${a.icon}</span><div><small>Logro desbloqueado</small><b>${a.name}</b><span>${a.desc}</span></div>`;
    this.el.classList.remove('show');
    void this.el.offsetWidth;
    this.el.classList.add('show');
    audio.play('jobdone', 0.9);
    setTimeout(() => { this.el.classList.remove('show'); setTimeout(() => { this.showing = false; this.pump(); }, 450); }, 3200);
  }

  // ── Ganchos desde la partida ───────────────────────────
  startRun() {
    this.cheated = false;
    this.meteor = null;
  }

  onEvent(ev, game) {
    const sim = game.sim;
    if (ev.type === 'thanos') { this.unlock('inevitable'); return; }
    if (ev.type === 'cheat') { this.cheated = true; return; }
    if (this.cheated || !sim) return;
    switch (ev.type) {
      case 'death': {
        if (ev.silent) break;
        const e = ev.e;
        this.unlock('first_blood');
        this.bump('kills');
        if (e.def.boss) { this.unlock('boss_first'); this.bump('bosses'); }
        if (e.lastHit === 'poison') this.bump('poisonKills');
        if (e.lastHit === 'meteor' && this.meteor && sim.time < this.meteor.until && ++this.meteor.kills >= 5) this.unlock('meteor_5');
        break;
      }
      case 'gold': if (ev.gold >= 3000) this.unlock('rich'); break;
      case 'upgrade': if (ev.t.level >= 3) this.unlock('max_tower'); break;
      case 'build': if (!ev.restored && sim.towers.length >= 12) this.unlock('architect'); break;
      case 'bonus': this.bump('early'); break;
      case 'meteor': this.meteor = { kills: 0, until: sim.time + 5 }; break;
      case 'blizzard': this.bump('blizzards'); break;
      // infinito: las oleadas salen seguidas, así que cuenta llegar a ellas
      case 'wave':
        if (game.endless && ev.index + 1 >= 10) this.unlock('endless_10');
        if (game.endless && ev.index + 1 >= 25) this.unlock('endless_25');
        break;
      default: break;
    }
  }

  onFinish(game, won, stars, unlockedFlame) {
    if (this.cheated) return;
    const sim = game.sim;
    if (unlockedFlame || save.data.flameUnlocked) this.unlock('flame');
    if (!won || game.endless) return;
    const id = game.levelId;
    if (LEVEL_ORDER.includes(id)) this.unlock(`win_${id}`);
    if (LEVELS[id]?.custom) this.unlock('cartographer');
    if (sim.hp === sim.maxHp) this.unlock('perfect');
    if (sim.stats.built <= 5) this.unlock('minimalist');
    if (LEVEL_ORDER.every((l) => (save.data.stars[l] || 0) >= 3)) this.unlock('all_stars');
  }
}

// Pantalla de logros
export function renderAchievements(el) {
  const d = data();
  const { have, total } = achievementCount();
  el.innerHTML = `<p class="ach-sum">${have} / ${total} desbloqueados</p><div class="ach-grid">${ACHIEVEMENTS.map((a) => {
    const got = d.unlocked[a.id];
    const hidden = a.secret && !got;
    const prog = a.goal && !got ? `<div class="ach-bar"><i style="width:${Math.min(100, ((d.stats[a.stat] || 0) / a.goal) * 100)}%"></i></div><small>${Math.min(a.goal, d.stats[a.stat] || 0)} / ${a.goal}</small>` : '';
    const date = got ? `<small>${new Date(got).toLocaleDateString()}</small>` : '';
    return `<div class="ach-card ${got ? 'got' : ''}"><span class="ach-icon">${hidden ? '❔' : a.icon}</span><div><b>${hidden ? '???' : a.name}</b><p>${hidden ? 'Logro secreto. Quizás tenga algo que ver con un guantelete…' : a.desc}</p>${prog}${date}</div></div>`;
  }).join('')}</div>`;
}
