import { Sim } from './sim.js';
import { TOWERS, TOWER_ORDER, LEVELS, LEVEL_ORDER, CHEATS, UPGRADE, MAX_LEVEL, PRIORITIES, ABILITIES, ABILITY_ICON, WEATHER_FX, HEROES, PATH_HALF } from './config.js';
import { Tutorial } from './tutorial.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { isTouch } from './util.js';
import { Achievements } from './achievements.js';
import { mountEndForm } from './leaderboard.js';
import { HeroPanel } from './heropanel.js';
import { showCoffin, hideCoffin } from './coffin.js';

const $ = (id) => document.getElementById(id);

const REASONS = {
  camino: 'No puedes construir sobre el camino',
  torre: 'Demasiado cerca de otra torre',
  obstaculo: 'Hay algo en medio',
  fuera: 'Fuera del campo de batalla',
  oro: 'Oro insuficiente',
  bloqueada: 'Hmmm… ¿cómo se desbloquea esta?',
};

export class Game {
  constructor(view, app) {
    this.view = view;
    this.app = app;
    this.sim = null;
    this.speed = 1;
    this.paused = false;
    this.buildType = null;
    this.pending = null;
    this.selected = null;
    this.pointers = new Map();
    this.session = 0;
    this.touch = isTouch();
    this.cache = {};
    this.bindInput();
    this.bindHud();
    this.tutorial = new Tutorial(this);
    this.ach = new Achievements();
    this.panel = new HeroPanel(this);
    // El clima cambia: efectos en la partida (si están activados) y aviso grande
    view.onWeather = (id, msg) => {
      if (!this.sim) return;
      const fx = save.data.settings.weatherFx !== false;
      this.sim.setWeather(fx ? id : 'calm');
      if (msg && !this.sim.over) this.weatherMsg(msg, fx ? (WEATHER_FX[id]?.desc || '') : '');
    };
    // Rayo de tormenta: golpea a un enemigo si el clima afecta a la partida
    view.onLightning = () => {
      if (!this.sim || this.paused || this.sim.over) return null;
      const at = this.sim.lightning();
      for (const ev of this.sim.drainEvents()) this.onEvent(ev);
      return at;
    };
  }

  // ── Ciclo de partida ───────────────────────────────────
  start(levelId, opts = {}) {
    this.session++;
    this.levelId = levelId;
    this.endless = !!opts.endless;
    audio.stopLong();
    audio.gameOn();
    this.timeScale = 1;
    this.slowmo = null;
    this.ach.startRun();
    const resumeHero = opts.resume ? opts.resume.hero?.id || null : undefined;
    this.heroId = resumeHero !== undefined ? resumeHero : opts.hero !== undefined ? opts.hero : this.heroId ?? null;
    this.sim = new Sim(levelId, { flameUnlocked: save.data.flameUnlocked, endless: this.endless, hero: this.heroId, heroAuto: save.data.settings.heroAuto !== false });
    this.heroSel = false;
    this.placingHero = false;
    this.view.loadLevel(this.sim);
    const resume = opts.resume;
    if (resume) {
      this.sim.restore(resume);
      for (const ev of this.sim.drainEvents()) this.onEvent(ev);
    }
    this.speed = 1;
    this.paused = false;
    this.ended = false;
    this.cancelBuild();
    this.deselect();
    this.cache = {};
    this.renderAbilities();
    this.renderHeroCard();
    $('hud-speed').textContent = 'x1';
    $('overlay-end').classList.add('hidden');
    $('overlay-pause').classList.add('hidden');
    hideCoffin();
    $('hud').classList.remove('hidden');
    this.renderDock();
    requestAnimationFrame(() => this.updateInsets());
    audio.playMusic(this.sim.level.music);
    audio.play('newgame', 0.8);
    const best = (save.data.endless || {})[levelId] || 0;
    if (resume) this.banner(this.sim.level.name, `Partida recuperada · oleada ${this.sim.waveIndex + 2}${this.endless ? '' : ` de ${this.sim.totalWaves}`}`);
    else this.banner(this.sim.level.name, this.endless ? `Modo infinito · récord: oleada ${best}` : `${this.sim.level.label} · ${this.sim.totalWaves} oleadas`);
    this._rankLost = !!this.sim.cheated; // partida recuperada: ya estaba fuera de la clasificación
    if (this.endless && !resume) setTimeout(() => this.toast('Modo infinito: las oleadas salen solas y cada vez más seguidas. Aguanta todo lo que puedas', 4200), 2600);
    const tutorial = levelId === 'easy' && !this.endless && !save.data.tutorialDone && !resume;
    if (tutorial) {
      // en el tutorial el héroe se coloca solo para no mezclar instrucciones
      if (this.sim.heroDef && !this.sim.hero) { const b = this.sim.bestHeroSpot(); this.sim.placeHero(b.x, b.z); for (const ev of this.sim.drainEvents()) this.onEvent(ev); }
      this.tutorial.start();
    } else {
      this.tutorial.stop();
      if (this.sim.heroDef && !this.sim.hero) {
        this.placingHero = true;
        setTimeout(() => { if (this.sim && this.placingHero) this.toast(`${this.touch ? 'Toca' : 'Haz clic en'} el mapa para colocar a tu héroe: ${this.sim.heroDef.short}`, 3500); }, 2200);
      } else setTimeout(() => { if (this.sim && this.sim.state === 'prep') this.toast('Coloca torres y pulsa ▶ para llamar la oleada', 3500); }, 2400);
    }
  }

  // Guarda la partida en curso (solo si ya ha empezado alguna oleada)
  saveRun() {
    if (!this.sim || this.ended || this.sim.waveIndex < 0) return;
    const snap = this.sim.serialize();
    if (!snap) return;
    save.data.run = snap;
    save.write();
  }
  clearRun() {
    if (save.data.run && save.data.run.levelId === this.levelId && !!save.data.run.endless === this.endless) {
      delete save.data.run;
      save.write();
    }
  }

  stop() {
    this.panel.unmount();
    this.saveRun();
    this.session++;
    audio.silenceGame();
    this.timeScale = 1;
    this.slowmo = null;
    this.tutorial.stop();
    this.sim = null;
    this.view.clearLevel();
    this.view.sim = null;
    $('hud').classList.add('hidden');
    $('overlay-end').classList.add('hidden');
    hideCoffin();
    $('overlay-pause').classList.add('hidden');
    this.cancelBuild();
    this.deselect();
  }

  get active() { return !!this.sim; }

  update(dt) {
    if (!this.sim) return;
    this.lastDt = dt;
    let simDt = 0;
    if (!this.paused) {
      // cámara lenta tras el chasquido de Thanos: arranca muy lenta y vuelve a 1 en «dur» s
      if (this.slowmo) {
        const m = this.slowmo;
        m.t += dt;
        const k = Math.max(0, Math.min(1, (m.t - (m.hold || 0)) / m.dur));
        this.timeScale = m.from + (1 - m.from) * k * k;
        if (k >= 1) { this.slowmo = null; this.timeScale = 1; }
      }
      const gdt = dt * (this.timeScale ?? 1);
      simDt = gdt * this.speed;
      for (let i = 0; i < this.speed; i++) this.sim.update(gdt);
      for (const ev of this.sim.drainEvents()) this.onEvent(ev);
      this.view.update(gdt, simDt);
    } else {
      this.view.controls.update();
    }
    this.view.updateDark(dt);
    this.tutorial.update(dt);
    this.updateHud();
    this.view.render();
  }

  // ── Eventos de la simulación → vista, sonido y HUD ─────
  onEvent(ev) {
    this.view.handle(ev);
    this.panel.onEvent(ev);
    this.tutorial.onEvent(ev);
    this.ach.onEvent(ev, this);
    switch (ev.type) {
      case 'escape':
        audio.play('liveless', 0.9, 0.12);
        this.hurtFlash();
        this.bump('hud-hp');
        break;
      case 'nogold': audio.play('moregold', 0.7, 0.4); this.toast(REASONS.oro); break;
      case 'build': if (!ev.restored) audio.play('jobdone', 0.7, 0.1); break;
      case 'upgrade': audio.play('jobdone', 0.8, 0.1); break;
      case 'fire': audio.shot(ev.p.kind); break;
      case 'hit': if (ev.kind === 'rock' || ev.kind === 'shell' || ev.kind === 'rocket') audio.impact(ev.kind); break;
      case 'gadgetEnd': if (ev.boom) audio.impact('trap'); else if (ev.destroyed) audio.impact('rock'); break;
      case 'meteorHit': audio.impact('meteor'); break;
      case 'sell': if (this.selected === ev.t) this.deselect(); break;
      case 'wave': {
        const w = this.sim.waves[ev.index];
        const boss = w.some((c) => 'LBKS'.includes(c));
        this.banner(`Oleada ${ev.index + 1}`, boss ? '¡Se acerca un jefe!' : `${ev.count} enemigos`);
        break;
      }
      case 'waveClear': this.banner('¡Oleada superada!', 'Prepárate para la siguiente'); this.saveRun(); break;
      case 'bonus': this.toast(`+${ev.amount} de oro por adelantarte`); this.bump('hud-gold'); break;
      case 'unlock': this.renderDock(); this.toast('🔥 ¡Torre de Fuego desbloqueada!', 2500); break;
      case 'cheat':
        if (this.endless && ev.code !== 'ororo' && LEVEL_ORDER.includes(this.levelId) && !this._rankLost) {
          this._rankLost = true;
          this.toast(`Truco: ${CHEATS[ev.code]} · esta partida ya no entra en la clasificación`, 3800);
        } else if (ev.code !== 'thanos' && ev.code !== 'ororo') this.toast(`Truco: ${CHEATS[ev.code]}`);
        if (ev.code.includes('gold') || ev.code === 'hollymolly' || ev.code === 'greedisgood') this.bump('hud-gold');
        break;
      case 'thanos': this.thanos(); break;
      case 'heroUlt': this.heroUlt(ev); break;
      // colocado (también cuando se coloca solo al llamar la oleada): se acaba el modo de colocarlo
      case 'heroPlace': if (ev.first && this.placingHero) { this.placingHero = false; this.view.heroes.hideGhost(); } break;
      case 'ororo': {
        const r = this.view.weather.forceRandom();
        if (r === 'busy') this.toast('Ya hay un fenómeno en curso: espera a que acabe');
        else if (r === 'off') this.toast('El clima dinámico está desactivado en Ajustes');
        break;
      }
      case 'victory': this.finish(true); break;
      case 'defeat': this.finish(false); break;
      default: break;
    }
  }

  thanos() {
    const s = this.session;
    // «I am inevitable»: el juego baja un poco mientras suena
    const ev = audio.play('inevitable', 1);
    if (ev) audio.duck(ev.buffer.duration, 0.4, 0.5);
    this.view.startSnap(() => {
      if (s !== this.session || !this.sim) return;
      const victims = this.sim.enemies.filter((e) => e.alive).length;
      for (const e of this.sim.enemies) this.view.dust(e);
      this.sim.snapAll();
      for (const ev of this.sim.drainEvents()) this.onEvent(ev);
      // efecto de muerte con el juego al mínimo y la pantalla oscura (el humo se ve por encima);
      // al acabar, un segundo de cámara lenta mientras se disipa la oscuridad
      if (victims > 0) this.thanosDeath(audio.thanosKill(1) || 3);
    }, () => { if (s === this.session) audio.play('thanosSnap', 1, 0); });
  }

  finish(won) {
    if (this.ended) return;
    this.ended = true;
    this.cancelBuild();
    this.deselect();
    const s = this.session;
    const sim = this.sim;
    const ratio = sim.hp / sim.maxHp;
    // estrellas del modo normal (con trucos no se ganan)
    const stars = won && !sim.cheated ? (ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1) : 0;
    let unlocked = false;
    let record = false;
    this.clearRun();
    // infinito: la oleada a la que se ha llegado (la que estaba en curso al caer)
    const reached = this.endless ? sim.waveIndex + 1 : Math.max(0, sim.waveIndex);
    if (this.endless) {
      save.data.endless = save.data.endless || {};
      if (reached > (save.data.endless[this.levelId] || 0)) { save.data.endless[this.levelId] = reached; record = true; }
      save.write();
    }
    if (won) {
      if (stars) save.data.stars[this.levelId] = Math.max(save.data.stars[this.levelId] || 0, stars);
      if (this.levelId === 'hard' && !save.data.flameUnlocked) { save.data.flameUnlocked = true; unlocked = true; }
      save.write();
    }
    this.ach.onFinish(this, won, stars, unlocked);
    setTimeout(() => {
      if (s !== this.session) return;
      // pantalla final: todo lo anterior se corta en seco (música, efectos, clima, truenos)
      // y solo suena la música de victoria o derrota
      audio.stopMusic();
      audio.silenceGame();
      this.view.weather.muted = true;
      audio.play(won ? 'victorySound' : 'deadSong', won ? 0.6 : 0.5);
      $('end-img').src = won ? 'assets/ui/victory.webp' : 'assets/ui/defeat.webp';
      const showStars = won && !this.endless;
      $('end-stars').innerHTML = showStars ? [1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('') : '';
      $('end-stars-note').classList.toggle('hidden', !showStars || stars === 3);
      $('end-stars-note').textContent = !showStars ? '' : sim.cheated ? 'Con trucos no se consiguen estrellas.'
        : stars === 2 ? '★★★ si ganas conservando el 90 % de las vidas.' : '★★ con la mitad de las vidas · ★★★ con el 90 %.';
      $('end-stats').innerHTML = (this.endless
        ? `<span>Oleada alcanzada</span><b>${reached}${record ? ' · ¡récord!' : ''}</b>
        <span>Récord en este mapa</span><b>${save.data.endless[this.levelId] || 0}</b>`
        : `<span>Oleadas superadas</span><b>${won ? sim.totalWaves : reached} / ${sim.totalWaves}</b>`) + `
        <span>Enemigos derrotados</span><b>${sim.stats.kills}</b>
        ${this.endless ? '' : `<span>Vidas restantes</span><b>${sim.hp} / ${sim.maxHp}</b>`}
        <span>Torres construidas</span><b>${sim.stats.built}</b>
        <span>Oro ganado</span><b>${sim.stats.goldEarned}</b>
        <span>Daño realizado</span><b>${Math.round(sim.stats.damage).toLocaleString('es-ES')}</b>
        ${this.endless ? `<span>Tiempo</span><b>${Math.floor(sim.time / 60)}:${String(Math.round(sim.time) % 60).padStart(2, '0')}</b>` : ''}`;
      mountEndForm(this);
      $('end-unlock').classList.toggle('hidden', !unlocked);
      const idx = LEVEL_ORDER.indexOf(this.levelId);
      $('end-next').classList.toggle('hidden', !won || this.endless || idx < 0 || idx >= LEVEL_ORDER.length - 1);
      if (won) hideCoffin(); else showCoffin($('coffin'));
      $('overlay-end').classList.remove('hidden');
    }, won ? 1200 : 700);
  }

  nextLevel() {
    const idx = LEVEL_ORDER.indexOf(this.levelId);
    if (idx < LEVEL_ORDER.length - 1) this.start(LEVEL_ORDER[idx + 1]);
  }

  // ── Pausa / velocidad ──────────────────────────────────
  setPaused(p) {
    if (!this.sim || this.ended) return;
    this.paused = p;
    $('overlay-pause').classList.toggle('hidden', !p);
    $('btn-surrender').classList.toggle('hidden', !this.endless || this.sim.waveIndex < 0);
    if (p) { audio.pauseMusic(); audio.setAmbience(null, 0); this.closeCheat(); } else { audio.gameOn(); audio.resumeMusic(); }
  }
  togglePause() { this.setPaused(!this.paused); }
  // Infinito: rendirse acaba la partida y permite guardar la puntuación
  surrender() {
    if (!this.endless || !this.sim || this.sim.over) return;
    this.setPaused(false);
    this.sim.lose();
    for (const ev of this.sim.drainEvents()) this.onEvent(ev);
  }
  cycleSpeed() {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    $('hud-speed').textContent = `x${this.speed}`;
  }

  // ── Construcción ───────────────────────────────────────
  selectBuild(type) {
    if (!this.sim || this.sim.over) return;
    if (this.heroSel) this.selectHero(false);
    if (this.placingHero) { this.placingHero = false; this.view.heroes.hideGhost(); }
    if (!this.sim.isUnlocked(type)) { this.toast(REASONS.bloqueada); return; }
    this.deselect();
    if (this.buildType === type) { this.cancelBuild(); return; }
    this.buildType = type;
    this.pending = null;
    $('build-confirm').classList.add('hidden');
    this.renderDockSel();
    this.tutorial.onEvent({ type: 'pick', tower: type });
    if (this.sim.gold < TOWERS[type].cost) this.toast(REASONS.oro);
    else if (this.touch) this.toast('Toca el mapa donde quieras la torre', 1800);
  }
  cancelBuild() {
    this.setAiming(false);
    this.buildType = null;
    this.pending = null;
    this.view.hideGhost();
    $('build-confirm').classList.add('hidden');
    this.renderDockSel();
  }
  tryBuild(x, z) {
    const why = this.sim.checkPlacement(this.buildType, x, z);
    if (why) {
      if (why === 'oro') audio.play('moregold', 0.7, 0.4);
      this.toast(REASONS[why]);
      return false;
    }
    this.sim.build(this.buildType, x, z);
    for (const ev of this.sim.drainEvents()) this.onEvent(ev);
    return true;
  }
  hover(x, z) {
    if (!this.buildType) return;
    const why = this.sim.checkPlacement(this.buildType, x, z);
    this.view.showGhost(this.buildType, x, z, !why);
  }

  // ── Habilidades ────────────────────────────────────────
  // aiming = id de la habilidad que se está apuntando (meteor, trap, turret) o false
  setAiming(id) {
    if (this.aiming) $(`ab-${this.aiming}`)?.classList.remove('aiming');
    this.aiming = id || false;
    if (this.aiming) $(`ab-${this.aiming}`)?.classList.add('aiming');
    if (!id) this.view.heroes?.hideGadgetGhost();
    if (!id && !this.buildType) this.view.hideGhost();
  }
  useAbility(id) {
    if (!this.sim || this.paused || this.sim.over) return;
    if (!this.sim.canUse(id)) {
      const h = this.sim.hero;
      if (ABILITIES[id].ult && h && h.alive && this.sim.waveIndex >= 0) { this.toast(`${ABILITIES[id].name}: falta energía (${Math.floor(h.energy || 0)} %). Se carga con las bajas`); return; }
      this.toast(this.sim.waveIndex < 0 ? 'Disponible cuando empiece la primera oleada'
        : this.sim.heroDef && (!h || !h.alive) ? 'Tu héroe está caído: espera a que reaparezca' : `${ABILITIES[id].name}: recargando`);
      return;
    }
    if (!ABILITIES[id].target) {
      const ok = id === 'blizzard' ? this.sim.useBlizzard() : id === 'leap' ? this.sim.useLeap() : id === 'howl' ? this.sim.useHowl()
        : id === 'arcaneNova' ? this.sim.useArcaneNova() : id === 'frenzy' ? this.sim.useFrenzy() : id === 'rockets' ? this.sim.useRockets() : false;
      for (const ev of this.sim.drainEvents()) this.onEvent(ev);
      if (ok) { audio.play('jobdone', 0.5); if (!ABILITIES[id].ult) this.panel.cast(id); }
      else if (id === 'leap') this.toast('No tiene enemigos cerca para saltar');
      else if (id === 'rockets') this.toast('No hay enemigos a los que disparar');
      return;
    }
    if (this.aiming === id) { this.setAiming(false); this.view.range.visible = false; return; }
    this.cancelBuild();
    this.deselect();
    if (this.heroSel) this.selectHero(false);
    this.setAiming(id);
    const verb = this.touch ? 'Toca' : 'Haz clic en';
    this.toast(id === 'trap' ? `${verb} el camino para poner el cepo` : id === 'turret' ? `${verb} el mapa para plantar la minitorreta`
      : this.touch ? 'Toca dónde caerán los meteoritos' : 'Haz clic donde caerán los meteoritos', 1800);
  }
  // Muestra dónde caerá la habilidad que se está apuntando (rojo si no se puede)
  aimPreview(x, z) {
    const id = this.aiming;
    const A = ABILITIES[id];
    const bad = id === 'trap' ? this.sim.checkTrapSpot(x, z) : id === 'turret' ? this.sim.checkHeroSpot(x, z) : null;
    // en el camino, la minitorreta se marca en naranja: frena a los enemigos pero le pegarán
    const onPath = id === 'turret' && !bad && this.sim.path.distanceTo(x, z) <= PATH_HALF + 1;
    this.view.range.show(x, this.view.heightAt(x, z), z, A.aimRadius || A.radius, bad ? 0xff5a4a : onPath ? 0xff8a3a : A.aimColor || 0xff8a3a);
    if (id === 'trap' || id === 'turret') this.view.heroes.showGadgetGhost(id, x, z, !bad);
  }
  castAim(x, z) {
    const id = this.aiming;
    const sim = this.sim;
    if (id === 'trap' && sim.checkTrapSpot(x, z)) { this.toast('El cepo tiene que ir en el camino'); return; }
    if (id === 'turret' && sim.checkHeroSpot(x, z)) { this.toast('Ahí no cabe la minitorreta'); return; }
    this.setAiming(false);
    this.view.range.visible = false;
    const ok = id === 'meteor' ? sim.useMeteor(x, z) : id === 'trap' ? sim.useTrap(x, z) : id === 'turret' ? sim.useTurret(x, z) : false;
    for (const ev of sim.drainEvents()) this.onEvent(ev);
    if (ok && id !== 'meteor') { audio.play('jobdone', 0.5); this.panel.cast(id); }
    if (ok && id === 'turret' && sim.turrets[0]?.onPath) this.toast('En el camino frena a los enemigos, pero le pegarán y se romperá pronto', 2600);
  }

  // Definitiva: instante congelado, zoom de cámara, separación de colores y velo de color (estilo Arcane)
  heroUlt(ev) {
    this.slowmo = { t: 0, hold: 0.28, dur: 0.7, from: 0.06 };
    const col = { frenzy: 0xff3a5a, rockets: 0xffb03a }[ev.kind] ?? 0x4af0ff;
    this.view.punch(1, col);
    audio.impact(ev.kind === 'arcaneNova' ? 'meteor' : 'shell');
    const o = $('ult-overlay');
    o.className = '';
    void o.offsetWidth;
    o.className = `on ${ev.kind}`;
    this.banner(ABILITIES[ev.kind].name, { frenzy: '¡Frenesí!', rockets: '¡Fuego a discreción!' }[ev.kind] || 'Definitiva');
  }

  // ── Héroe ──────────────────────────────────────────────
  placeHeroAt(x, z) {
    const sim = this.sim;
    const why = sim.checkHeroSpot(x, z);
    if (why) { this.toast(REASONS[why] || 'No puede ir ahí'); return; }
    const first = !sim.hero;
    sim.placeHero(x, z);
    for (const ev of sim.drainEvents()) this.onEvent(ev);
    this.placingHero = false;
    this.view.heroes.hideGhost();
    audio.play('jobdone', 0.6);
    if (first) this.toast(`${sim.heroDef.short} listo. ${this.touch ? 'Tócalo' : 'Haz clic en él o pulsa H'} para moverlo`, 3200);
    this.cache.hc = null;
  }
  // Botón del retrato / tecla H: colocar si aún no está, o seleccionar / deseleccionar
  heroButton() {
    const sim = this.sim;
    if (!sim || !sim.heroDef || sim.over || this.paused) return;
    if (!sim.hero) { this.cancelBuild(); this.deselect(); this.placingHero = true; this.toast('Elige dónde colocar a tu héroe', 1800); return; }
    this.selectHero(!this.heroSel);
  }
  selectHero(on) {
    if (on) { this.cancelBuild(); this.deselect(); this.setAiming(false); }
    this.heroSel = on;
    this.view.heroes.setSelected(on);
    $('hero-panel').classList.toggle('sel', on);
    if (on && this.sim.hero && !this.sim.hero.alive) this.toast('Está caído: reaparecerá en su sitio', 1600);
    else if (on) {
      const d = this.sim.heroDef;
      const prep = this.sim.waveIndex < 0;
      this.toast(prep ? `${this.touch ? 'Toca' : 'Haz clic en'} el mapa para recolocarlo (gratis antes de la 1.ª oleada)`
        : `${this.touch ? 'Toca' : 'Clic derecho o clic en'} el mapa para mandarlo allí (será su punto de guardia)`, 2200);
    }
  }
  commandHero(x, z) {
    const sim = this.sim;
    if (!sim.hero) return;
    if (!sim.hero.alive) { this.toast('Tu héroe está caído'); return; }
    if (!sim.placeHero(x, z)) { this.toast('No puede ir ahí'); return; }
    for (const ev of sim.drainEvents()) this.onEvent(ev);
  }
  // Modo auto: va a por los enemigos por todo el mapa; apagado, se queda quieto donde lo mandes
  toggleHeroAuto() {
    if (!this.sim?.heroDef) return;
    const on = !this.sim.heroAuto;
    this.sim.setHeroAuto(on);
    save.data.settings.heroAuto = on;
    save.write();
    $('hc-auto')?.classList.toggle('on', on);
    this.toast(on ? 'Auto: irá solo a por los enemigos por todo el mapa' : 'Manual: se quedará quieto donde lo mandes', 1800);
  }
  renderAbilities() {
    // modo clásico: botones redondos abajo a la izquierda; con héroe van en su panel
    $('abilities').innerHTML = this.sim.heroDef ? '' : this.sim.abilities.map((id) => `<button class="ability" id="ab-${id}" data-ab="${id}" title="${ABILITIES[id].name} (${ABILITIES[id].key})"><span class="ab-icon">${ABILITY_ICON[id] || '✦'}</span><span class="ab-key">${ABILITIES[id].key}</span></button>`).join('');
  }
  renderHeroCard() {
    this.panel.mount(this.sim);
    $('hc-auto').classList.toggle('on', !!this.sim?.heroAuto);
    requestAnimationFrame(() => this.updateInsets());
  }


  // ── Selección de torres ────────────────────────────────
  select(t) {
    this.selected = t;
    this.view.showRange(t);
    $('tower-panel').classList.remove('hidden');
    this.renderPanel();
    this.tutorial.onEvent({ type: 'select' });
  }
  deselect() {
    this.selected = null;
    this.view.showRange(null);
    $('tower-panel').classList.add('hidden');
  }
  renderPanel() {
    const t = this.selected;
    if (!t) return;
    const def = t.def;
    $('tp-icon').src = def.icon;
    $('tp-name').textContent = def.name;
    $('tp-level').innerHTML = [1, 2, 3].map((i) => `<span class="${i <= t.level ? 'on' : ''}">★</span>`).join('');
    const lv = t.level - 1;
    const next = t.level < MAX_LEVEL ? t.level : null;
    const fmt = (v) => (Math.round(v * 10) / 10).toString();
    const row = (label, cur, nxt) => `<span>${label}</span><span>${cur}${nxt != null ? ` <span class="up">→ ${nxt}</span>` : ''}</span>`;
    let html = '';
    if (t.type === 'slow') {
      html += row('Congelación', `${fmt(def.slowTime * UPGRADE.slowTime[lv])} s`, next != null ? `${fmt(def.slowTime * UPGRADE.slowTime[next])} s` : null);
    } else {
      html += row('Daño', fmt(def.dmg * UPGRADE.dmg[lv]), next != null ? fmt(def.dmg * UPGRADE.dmg[next]) : null);
    }
    html += row('Alcance', fmt(def.range * UPGRADE.range[lv]), next != null ? fmt(def.range * UPGRADE.range[next]) : null);
    html += row('Disparos/s', fmt(UPGRADE.rate[lv] / def.cooldown), next != null ? fmt(UPGRADE.rate[next] / def.cooldown) : null);
    if (def.poisonDps) html += row('Veneno/s', fmt(def.poisonDps * UPGRADE.dmg[lv]), next != null ? fmt(def.poisonDps * UPGRADE.dmg[next]) : null);
    if (def.splash) html += row('Área', `${Math.round((def.splashRatio ?? 0.5) * 100)} % del daño`, null);
    $('tp-stats').innerHTML = html;
    const pr = t.priority || 'first';
    $('tp-priority').innerHTML = PRIORITIES.map((p) => `<button data-prio="${p.id}" class="${p.id === pr ? 'on' : ''}" title="${p.hint}">${p.label}</button>`).join('');
    const cost = this.sim.upgradeCost(t);
    const up = $('tp-upgrade');
    if (cost == null) { up.textContent = 'Nivel máximo'; up.disabled = true; }
    else { up.innerHTML = `Mejorar · ${cost}`; up.disabled = this.sim.gold < cost; }
    $('tp-sell').innerHTML = `Vender · +${this.sim.sellValue(t)}`;
    this.cache.panelGold = this.sim.gold;
  }
  placePanel() {
    const t = this.selected;
    const el = $('tower-panel');
    if (!t) return;
    const p = this.view.project(t.x, this.view.heightAt(t.x, t.z) + 4.5 * this.sim.towerScale, t.z);
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = p.x + 30, y = p.y - h / 2;
    if (x + w > innerWidth - 8) x = p.x - w - 30;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    y = Math.max(60, Math.min(innerHeight - h - 8, y));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  // ── Entrada ────────────────────────────────────────────
  bindInput() {
    const canvas = this.view.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      audio.unlock();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
      if (this.pointers.size > 1) for (const p of this.pointers.values()) p.moved = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 9) p.moved = true;
      if (e.pointerType === 'mouse' && this.aiming && this.sim && e.buttons === 0) {
        const g = this.view.pickGround(e.clientX, e.clientY);
        if (g) this.aimPreview(g.x, g.z);
      }
      if (e.pointerType === 'mouse' && this.placingHero && this.sim && !this.paused && e.buttons === 0) {
        const g = this.view.pickGround(e.clientX, e.clientY);
        if (g) this.view.heroes.showGhost(this.sim.heroDef.id, g.x, g.z, !this.sim.checkHeroSpot(g.x, g.z));
      }
      if (e.pointerType === 'mouse' && this.buildType && this.sim && !this.paused && e.buttons === 0) {
        const g = this.view.pickGround(e.clientX, e.clientY);
        if (g) this.hover(g.x, g.z);
      }
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p || p.moved || performance.now() - p.t > 500) return;
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      this.tap(e.clientX, e.clientY, e.pointerType);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.buildType || this.aiming) { this.cancelBuild(); this.view.range.visible = false; return; }
      // clic derecho con el héroe seleccionado: moverlo (como en un RTS)
      if (this.heroSel && this.sim && !this.paused) { const g = this.view.pickGround(e.clientX, e.clientY); if (g) this.commandHero(g.x, g.z); }
    });
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && this.buildType) this.view.hideGhost(); });

    window.addEventListener('keydown', (e) => {
      if (!this.sim) return;
      const box = $('cheat-box');
      if (!box.classList.contains('hidden')) {
        if (e.key === 'Enter') this.submitCheat();
        else if (e.key === 'Escape') this.closeCheat();
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); this.openCheat(); return; }
      if (e.key === 'Escape') {
        if (this.aiming) { this.setAiming(false); this.view.range.visible = false; }
        else if (this.placingHero && this.sim.hero) { this.placingHero = false; this.view.heroes.hideGhost(); }
        else if (this.heroSel) this.selectHero(false);
        else if (this.buildType) this.cancelBuild();
        else if (this.selected) this.deselect();
        else this.togglePause();
        return;
      }
      if (this.paused || this.ended) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= TOWER_ORDER.length) this.selectBuild(TOWER_ORDER[n - 1]);
      else if (e.key === ' ') { e.preventDefault(); this.sim.callWave(); }
      else if (e.key === 'f' || e.key === 'F') this.cycleSpeed();
      else if (e.key === 'q' || e.key === 'Q') this.useAbility(this.sim.abilities[0]);
      else if (e.key === 'w' || e.key === 'W') this.useAbility(this.sim.abilities[1]);
      else if ((e.key === 'e' || e.key === 'E') && this.sim.abilities[2]) this.useAbility(this.sim.abilities[2]);
      else if (e.key === 'h' || e.key === 'H') this.heroButton();
      else if (e.key === 'a' || e.key === 'A') this.toggleHeroAuto();
      else if ((e.key === 'u' || e.key === 'U') && this.selected) this.sim.upgrade(this.selected);
    });
  }

  tap(cx, cy, type) {
    if (!this.sim || this.paused || this.sim.over) return;
    const g = this.view.pickGround(cx, cy);
    if (!g) return;
    if (this.aiming) { this.castAim(g.x, g.z); return; }
    if (this.placingHero) { this.placeHeroAt(g.x, g.z); return; }
    const hit = this.view.towerAt(g.x, g.z);
    if (this.heroSel && !this.buildType) {
      if (hit) { this.selectHero(false); this.select(hit); return; }
      if (this.view.heroes.at(g.x, g.z)) return;
      this.commandHero(g.x, g.z);
      return;
    }
    if (!this.buildType && this.view.heroes.at(g.x, g.z)) { this.deselect(); this.selectHero(true); return; }
    if (this.buildType && hit) { this.cancelBuild(); this.select(hit); return; }
    if (this.buildType) {
      if (type === 'mouse') {
        this.tryBuild(g.x, g.z);
        this.hover(g.x, g.z);
      } else {
        // táctil: primero se coloca el fantasma, luego se confirma
        if (this.pending && Math.hypot(this.pending.x - g.x, this.pending.z - g.z) < 1.5) {
          if (this.tryBuild(this.pending.x, this.pending.z)) this.cancelBuild();
          return;
        }
        this.pending = g;
        this.hover(g.x, g.z);
        $('build-confirm').classList.remove('hidden');
        this.placeConfirm();
      }
      return;
    }
    if (hit) this.select(hit);
    else this.deselect();
  }

  placeConfirm() {
    if (!this.pending) return;
    const p = this.view.project(this.pending.x, this.view.heightAt(this.pending.x, this.pending.z) + 5.5 * this.sim.towerScale, this.pending.z);
    const el = $('build-confirm');
    el.style.left = `${Math.max(60, Math.min(innerWidth - 60, p.x))}px`;
    el.style.top = `${Math.max(110, p.y)}px`;
    const why = this.sim.checkPlacement(this.buildType, this.pending.x, this.pending.z);
    $('bc-ok').disabled = !!why;
  }

  // ── HUD ────────────────────────────────────────────────
  bindHud() {
    $('hud-pause').addEventListener('click', () => this.togglePause());
    $('hud-speed').addEventListener('click', () => this.cycleSpeed());
    $('hud-cam').addEventListener('click', () => this.view.resetCamera());
    $('hud-call').addEventListener('click', () => this.sim?.callWave());
    $('tp-close').addEventListener('click', () => this.deselect());
    $('abilities').addEventListener('click', (e) => { const b = e.target.closest('.ability'); if (!b) return; audio.unlock(); this.useAbility(b.dataset.ab); });
    $('hpn-portrait').addEventListener('click', () => { audio.unlock(); this.heroButton(); });
    $('hpn-abil').addEventListener('click', (e) => { const b = e.target.closest('.ability'); if (!b) return; audio.unlock(); this.useAbility(b.dataset.ab); });
    $('hc-auto').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); this.toggleHeroAuto(); });
    $('tp-upgrade').addEventListener('click', () => { if (this.selected && this.sim.upgrade(this.selected)) { for (const ev of this.sim.drainEvents()) this.onEvent(ev); this.renderPanel(); } });
    $('tp-sell').addEventListener('click', () => { if (this.selected) { const t = this.selected; this.deselect(); this.sim.sell(t); for (const ev of this.sim.drainEvents()) this.onEvent(ev); } });
    $('bc-ok').addEventListener('click', () => {
      if (!this.pending) return;
      if (this.tryBuild(this.pending.x, this.pending.z)) this.cancelBuild();
    });
    $('bc-no').addEventListener('click', () => this.cancelBuild());
    $('tp-priority').addEventListener('click', (e) => {
      const b = e.target.closest('[data-prio]');
      if (!b || !this.selected) return;
      this.sim.setPriority(this.selected, b.dataset.prio);
      this.renderPanel();
    });
    $('cheat-input').addEventListener('keydown', (e) => e.stopPropagation());
    $('cheat-input').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.submitCheat();
      if (e.key === 'Escape') this.closeCheat();
    });
  }

  renderDock() {
    const dock = $('tower-dock');
    dock.innerHTML = '';
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const locked = this.sim && !this.sim.isUnlocked(type);
      const el = document.createElement('div');
      el.className = `tcard${locked ? ' locked' : ''}`;
      el.dataset.type = type;
      el.title = `${def.name} (${i + 1})`;
      el.innerHTML = `<span class="key">${i + 1}</span><img src="${locked ? def.lockedIcon : def.icon}" alt="${def.short}"><div class="cost"><img src="assets/ui/coin.webp" alt="">${locked ? '???' : def.cost}</div>`;
      el.addEventListener('click', () => { audio.unlock(); this.selectBuild(type); });
      dock.appendChild(el);
    });
    this.cache.dockGold = null;
    this.renderDockSel();
  }
  renderDockSel() {
    document.querySelectorAll('.tcard').forEach((c) => c.classList.toggle('sel', c.dataset.type === this.buildType));
  }

  updateHud() {
    const sim = this.sim;
    const c = this.cache;
    if (c.hp !== sim.hp) { $('hud-hp').textContent = sim.hp; c.hp = sim.hp; }
    if (c.gold !== sim.gold) { $('hud-gold').textContent = sim.gold; c.gold = sim.gold; }
    const total = this.endless ? '∞' : sim.totalWaves;
    const waveTxt = sim.waveIndex < 0
      ? (this.endless ? 'Modo infinito' : `Oleadas: ${total}`)
      : `Oleada ${sim.waveIndex + 1}${this.endless ? '' : `/${total}`} · ${sim.enemies.length + sim.spawnQueue.length} 👹`;
    if (c.wave !== waveTxt) { $('hud-wave').textContent = waveTxt; c.wave = waveTxt; }
    // infinito: sin cuenta atrás a la vista. Antes de empezar, «Empezar»; luego, cuando ya han salido todos
    // los de la oleada, se puede adelantar la siguiente (da algo de oro)
    const endlessOn = this.endless && sim.waveIndex >= 0;
    const waiting = endlessOn ? sim.state === 'clearing' && !sim.over : sim.state === 'prep' || sim.state === 'intermission';
    const call = $('hud-call');
    if (c.waiting !== waiting) { call.classList.toggle('hidden', !waiting); c.waiting = waiting; }
    if (waiting) {
      const secs = this.endless ? '' : `${Math.ceil(sim.timer)}s`;
      const label = !this.endless ? `▶ Oleada ${sim.waveIndex + 2}` : endlessOn ? '⏩ Adelantar oleada' : '▶ Empezar';
      if (c.callLabel !== label) { call.firstChild.textContent = `${label} `; c.callLabel = label; }
      if (c.secs !== secs) { $('hud-call-t').textContent = secs; c.secs = secs; }
    }
    if (c.dockGold !== sim.gold) {
      c.dockGold = sim.gold;
      document.querySelectorAll('.tcard').forEach((el) => el.classList.toggle('poor', sim.gold < TOWERS[el.dataset.type].cost));
    }
    const heroDown = sim.heroDef && (!sim.hero || !sim.hero.alive);
    for (const id of sim.abilities) {
      const el = $(`ab-${id}`);
      if (!el) continue;
      const p = sim.waveIndex < 0 || heroDown ? 1 : ABILITIES[id].ult ? 1 - Math.min(100, sim.hero?.energy || 0) / 100 : sim.abilityCd[id] / ABILITIES[id].cooldown;
      const q = Math.round(p * 100) / 100;
      if (c[`ab_${id}`] !== q) { el.style.setProperty('--p', q); el.classList.toggle('ready', q === 0); c[`ab_${id}`] = q; }
    }
    this.panel.update(this.lastDt || 0.016);
    if (this.selected) {
      if (c.panelGold !== sim.gold) this.renderPanel();
      this.placePanel();
    }
    if (this.pending) this.placeConfirm();
  }

  updateInsets() {
    const top = document.querySelector('.hud-top').getBoundingClientRect();
    const dock = $('tower-dock').getBoundingClientRect();
    const vertical = dock.height > dock.width;
    this.view.setInsets({
      top: Math.min(top.bottom, innerHeight * 0.22),
      bottom: vertical ? 0 : innerHeight - dock.top,
      left: 0,
      right: vertical ? innerWidth - dock.left : 0,
    });
  }

  // ── Trucos ─────────────────────────────────────────────
  openCheat() {
    if (!this.sim || this.ended) return;
    const box = $('cheat-box');
    box.classList.remove('hidden');
    // en el infinito oficial, recordar que un truco saca la partida de la clasificación
    $('cheat-warn').classList.toggle('hidden', !(this.endless && LEVEL_ORDER.includes(this.levelId) && !this.sim.cheated));
    const input = $('cheat-input');
    input.value = '';
    setTimeout(() => input.focus(), 30);
  }
  closeCheat() {
    $('cheat-box').classList.add('hidden');
    $('cheat-input').blur();
  }
  submitCheat() {
    const code = $('cheat-input').value.trim().toLowerCase();
    this.closeCheat();
    if (!code || !this.sim) return;
    if (!this.sim.cheat(code)) this.toast('Nada ocurre…');
    for (const ev of this.sim.drainEvents()) this.onEvent(ev);
  }

  // ── Mensajes ───────────────────────────────────────────
  toast(msg, ms = 1600) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('show'), ms);
  }
  banner(title, sub = '') {
    const el = $('banner');
    el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  // Muerte por Thanos: oscuridad mientras suena el efecto y luego cámara lenta 1 s
  thanosDeath(secs) {
    const s = this.session;
    this.view.setDark(1, 0.45);
    clearTimeout(this._fogT);
    this._fogT = setTimeout(() => {
      if (s !== this.session || !this.sim) return;
      this.slowmo = { t: 0, dur: 1, from: 0.15 };
      this.view.setDark(0, 1);
    }, secs * 1000);
  }

  // Aviso grande en el centro cuando cambia el clima
  weatherMsg(msg, sub = '') {
    const el = $('weather-msg');
    el.textContent = msg;
    if (sub) { const sm = document.createElement('small'); sm.textContent = sub; el.appendChild(sm); }
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  bump(id) {
    const el = $(id).parentElement;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  hurtFlash() {
    const el = $('hurt-flash');
    el.classList.add('on');
    clearTimeout(this._hurtT);
    this._hurtT = setTimeout(() => el.classList.remove('on'), 60);
  }
}

export { LEVELS };
