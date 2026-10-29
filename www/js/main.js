import { loadAssets } from './assets.js';
import { audio } from './audio.js';
import { GameView } from './view.js';
import { Game } from './game.js';
import { save, QUALITY } from './save.js';
import { renderRanking } from './leaderboard.js';
import { API_BASE } from './apiconfig.js';
import { initCommunity, renderCommunity, openPublish } from './community.js';
import { TOWERS, TOWER_ORDER, ENEMIES, LEVELS, LEVEL_ORDER, WAVES, WEATHER_FX, WEATHER_BOLT, HEROES, HERO_ORDER, ABILITIES, ABILITY_ICON, ABILITY_DESC, abilityIcon } from './config.js';
import { isTouch } from './util.js';
import { Editor } from './editor.js';
import { registerAll, customMaps, deleteMap } from './custom.js';
import { renderAchievements, achievementCount } from './achievements.js';

const $ = (id) => document.getElementById(id);
let view, game, editor;
let returnTo = 'screen-title';
let current = 'screen-loading';

function showScreen(id) {
  if (id === 'screen-title') renderTitle();
  // En los menús no suena nada: ni música ni efectos (salvo los ajustes abiertos desde la pausa)
  if (id && game && !game.active) { audio.silenceGame(); audio.stopMusic(); }
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  current = id;
}

// Botón «Continuar» si hay una partida guardada a medias
function renderTitle() {
  const run = save.data.run;
  const ok = run && LEVELS[run.levelId];
  $('btn-continue').classList.toggle('hidden', !ok);
  if (ok) {
    const L = LEVELS[run.levelId];
    $('continue-info').textContent = `${L.name}${run.endless ? ' · ∞' : ''} · oleada ${run.waveIndex + 2}`;
  }
  renderAchCount();
}

function renderAchCount() {
  const { have, total } = achievementCount();
  $('ach-count').textContent = `${have}/${total}`;
}

// ── Pantallas de menú ───────────────────────────────────
// Estrellas del modo normal: se ganan al ganar el mapa, según las vidas que queden
const STARS_RULE = '★ ganar · ★★ ganar con la mitad de las vidas · ★★★ ganar con el 90 % de las vidas (sin trucos)';
const starsTitle = (n) => `${n ? `${n} de 3 estrellas` : 'Sin estrellas todavía'}. ${STARS_RULE}`;
function renderLevels() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (const id of LEVEL_ORDER) {
    const L = LEVELS[id];
    const stars = save.data.stars[id] || 0;
    const best = (save.data.endless || {})[id] || 0;
    const card = document.createElement('button');
    card.className = 'panel level-card';
    card.innerHTML = `
      <div class="thumb" style="background-image:url(${L.thumb})"><span class="badge ${id}">${L.label}</span></div>
      <div class="info">
        <h3>${L.name}</h3>
        <div class="meta">❤ ${L.hp} · 🪙 ${L.gold} · ${WAVES[id].length} oleadas</div>
        <div class="card-foot"><div class="stars" title="${starsTitle(stars)}">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('')}</div>
        <span class="endless-btn" role="button" tabindex="0" title="Modo infinito: aguanta todo lo que puedas (récord: la oleada más alta a la que has llegado)">∞ ${best ? `Récord ${best}` : 'Infinito'}</span></div>
      </div>`;
    card.addEventListener('click', (e) => {
      audio.unlock();
      openHeroPick(id, !!e.target.closest('.endless-btn'));
    });
    grid.appendChild(card);
  }
  renderCustom();
}

// ── Elegir héroe (después de elegir mapa) ──────────────
function lastHero() {
  const h = save.data.settings.hero;
  return h === 'none' ? null : HEROES[h] ? h : 'shaman';
}
function openHeroPick(levelId, endless) {
  const L = LEVELS[levelId];
  $('hero-pick-map').textContent = `${L.name}${endless ? ' · modo infinito' : ''}`;
  // modo infinito: dejar claro qué entra en la clasificación
  const note = $('hero-pick-note');
  note.classList.toggle('hidden', !endless);
  if (endless) {
    note.innerHTML = LEVEL_ORDER.includes(levelId)
      ? '🏆 <b>Partida para la clasificación online.</b> Si usas algún truco (o la recuperas con «Continuar»), esta partida ya no podrá entrar en la clasificación.'
      : '🗺️ Los mapas personalizados no entran en la clasificación online: aquí solo cuenta tu récord.';
  }
  const cur = save.data.settings.hero || 'shaman';
  const card = (id, icon, name, kind, desc, abil, extra = '') => `
    <button class="hero-card-pick ${id === cur ? 'on' : ''} ${extra}" data-hero="${id}">
      <span class="hp-face">${HEROES[id] ? `<img src="assets/ui/portraits/hero_${id}.png" alt="" draggable="false">` : icon}</span>
      <b>${name}</b><span class="hp-kind">${kind}</span>
      <p>${desc}</p>
      <div class="hp-abil">${abil}</div>
    </button>`;
  const abil = (d) => [...d.abilities, d.ult].filter(Boolean).map((a) => `<span title="${ABILITIES[a].name}">${abilityIcon(a, 'ab-inl')} ${ABILITIES[a].name}</span>`).join('');
  $('hero-grid').innerHTML = HERO_ORDER.map((id) => {
    const d = HEROES[id];
    return card(id, d.icon, d.name, d.type === 'melee' ? 'Cuerpo a cuerpo' : 'A distancia', d.desc, abil(d));
  }).join('')
    + card('queen', '👑', 'Reina goblin', 'A distancia · apoyo', 'Más oro por cada baja cercana y refuerzos que cortan el camino.', 'Próximamente', 'soon')
    + card('none', '🏰', 'Sin héroe', 'Modo clásico', 'Como el juego original: sin héroe, con las oleadas originales y la lluvia de meteoritos y la ventisca.', `${ABILITY_ICON.meteor} ${ABILITIES.meteor.name} · ${ABILITY_ICON.blizzard} ${ABILITIES.blizzard.name}`);
  $('hero-grid').querySelectorAll('.hero-card-pick').forEach((el) => el.addEventListener('click', () => {
    if (el.classList.contains('soon')) return;
    audio.unlock();
    const id = el.dataset.hero;
    save.data.settings.hero = id;
    save.write();
    $('overlay-hero').classList.add('hidden');
    showScreen(null);
    game.start(levelId, { endless, hero: id === 'none' ? null : id });
  }));
  $('overlay-hero').classList.remove('hidden');
}

// Mapas creados con el editor
function renderCustom() {
  const grid = $('custom-grid');
  grid.innerHTML = '';
  for (const m of customMaps()) {
    const L = LEVELS[m.id];
    if (!L) continue;
    const stars = save.data.stars[m.id] || 0;
    const best = (save.data.endless || {})[m.id] || 0;
    const card = document.createElement('button');
    card.className = 'panel level-card';
    card.innerHTML = `
      <div class="thumb" style="background-image:url(${m.thumb || ''})"><span class="badge custom">Mío</span></div>
      <div class="info">
        <h3></h3>
        <div class="meta">❤ ${m.hp} · 🪙 ${m.gold} · oleadas de ${LEVELS[m.preset]?.label || 'Normal'}</div>
        <div class="card-foot"><div class="stars" title="${starsTitle(stars)}">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('')}</div>
        <span class="endless-btn" role="button" tabindex="0">∞ ${best ? `Récord ${best}` : 'Infinito'}</span></div>
        <div class="card-tools"><span class="tool-btn" data-tool="edit" role="button" tabindex="0">✎ Editar</span><span class="tool-btn" data-tool="pub" role="button" tabindex="0">🌍 Publicar</span><span class="tool-btn" data-tool="del" role="button" tabindex="0">Borrar</span></div>
      </div>`;
    card.querySelector('h3').textContent = m.name;
    card.addEventListener('click', (e) => {
      audio.unlock();
      const tool = e.target.closest('[data-tool]');
      if (tool?.dataset.tool === 'edit') { openEditor(m); return; }
      if (tool?.dataset.tool === 'pub') { openPublish(m); return; }
      if (tool?.dataset.tool === 'del') {
        if (tool.dataset.armed !== '1') { tool.dataset.armed = '1'; tool.textContent = '¿Seguro?'; return; }
        deleteMap(m.id);
        renderCustom();
        return;
      }
      openHeroPick(m.id, !!e.target.closest('.endless-btn'));
    });
    grid.appendChild(card);
  }
  const add = document.createElement('button');
  add.className = 'panel level-card new-map';
  add.innerHTML = '<span>＋</span>Crear mapa';
  add.addEventListener('click', () => openEditor(null));
  grid.appendChild(add);
}

// El editor va en silencio
function openEditor(map) {
  audio.stopMusic();
  showScreen('screen-editor');
  requestAnimationFrame(() => editor.open(map));
}

function renderHowto() {
  renderWeatherHelp();
  renderHeroHelp();
  const tw = $('tab-towers');
  tw.innerHTML = `<div class="card-grid">${TOWER_ORDER.map((t) => {
    const d = TOWERS[t];
    const hidden = d.locked && !save.data.flameUnlocked;
    return `<div class="info-card"><img src="${hidden ? d.lockedIcon : d.icon}" alt="">
      <div><h4>${hidden ? '???' : d.name}</h4><p>${hidden ? 'Hmmm… ¿cómo se desbloqueará esta torre? Quizás superando el Glaciar Eterno… o con algún truco.' : d.desc}</p>
      <div class="kv">${hidden ? '' : `Coste ${d.cost} · Daño ${d.dmg} · Alcance ${Math.round(d.range)}`}</div></div></div>`;
  }).join('')}</div>
  <p class="hint">Toca una torre construida para <b>mejorarla</b> (hasta nivel 3), <b>venderla</b> (recuperas el 70 %) o elegir <b>a quién ataca</b>: el primero, el último, el más fuerte o el más cercano.</p>`;
  renderBestiary();
}

// Pestaña «Enemigos»: bestiario con el modelo 3D de cada uno (imágenes de tools/portraits.cjs)
const SPEED_TXT = (v) => (v >= 10 ? 'Muy rápido' : v >= 8 ? 'Rápido' : v >= 7 ? 'Normal' : 'Lento');
function renderBestiary() {
  const order = ['m', 'q', 'l', 'd', 'D', 'B', 'K', 'L', 'S'];
  const notes = (e) => [
    e.sheet ? '' : '15 aspectos distintos (los del Infierno resisten el fuego: −40 %).',
    e.fly ? 'Vuela: piedras y obuses le hacen un 30 % menos y los héroes cuerpo a cuerpo no le alcanzan.' : '',
    e.frostImmune ? 'El hielo apenas lo frena; el fuego le hace +50 %.' : '',
    e.atk ? 'Se pelea con los héroes que se le cruzan.' : '',
  ].filter(Boolean).join(' ');
  $('tab-enemies').innerHTML = `<div class="bestiary">${order.map((c) => {
    const e = ENEMIES[c];
    return `<div class="beast${e.boss ? ' boss' : ''}">
      <div class="beast-img"><img src="assets/ui/portraits/enemy_${e.id}.png" alt="" loading="lazy" draggable="false"></div>
      <div class="beast-body">
        <h4>${e.name}${e.boss ? '<span class="tag boss">Jefe</span>' : ''}${e.fly ? '<span class="tag fly">Vuela</span>' : ''}</h4>
        <p>${notes(e)}</p>
        <div class="chips"><span title="Vida">❤ ${e.hp.toLocaleString('es-ES')}</span><span title="Oro">🪙 ${e.gold}</span><span title="Velocidad">👟 ${SPEED_TXT(e.speed)}</span>${e.atk ? `<span title="Golpe a los héroes">⚔ ${e.atk}</span>` : ''}</div>
      </div></div>`;
  }).join('')}</div>
  <p class="hint">En Normal, Difícil e Infierno los enemigos ganan vida a medida que avanzan las oleadas. El veneno ignora todas las resistencias. ⚔ es lo que quitan por golpe a un héroe (sube con las oleadas).</p>`;
}

// Pestaña «Clima»: qué tiempo hace en cada bioma y qué cambia en la partida
const WEATHER_INFO = [
  { id: 'rain', icon: '🌧', name: 'Lluvia', where: 'Pradera' },
  { id: 'storm', icon: '⛈', name: 'Tormenta', where: 'Pradera y Cementerio' },
  { id: 'mist', icon: '🌫', name: 'Niebla', where: 'Cementerio' },
  { id: 'blizzard', icon: '❄', name: 'Ventisca', where: 'Glaciar' },
  { id: 'sandstorm', icon: '🌪', name: 'Tormenta de arena', where: 'Desierto' },
  { id: 'firestorm', icon: '🔥', name: 'Lluvia de fuego', where: 'Infierno' },
];
// Pestaña «Héroes»: ficha de cada héroe con su modelo 3D, estadísticas, habilidades y pasiva
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
function heroSheet(id) {
  const d = HEROES[id];
  const melee = d.type === 'melee';
  const rate = 1 / d.cooldown;
  const ab = (a) => {
    const A = ABILITIES[a];
    const meta = A.ult ? 'Definitiva · se carga con las bajas' : `Recarga ${A.cooldown} s${A.target ? ' · se apunta con el ratón' : ''}`;
    return `<div class="hs-ab${A.ult ? ' ult' : ''}"><span class="hs-ic">${abilityIcon(a)}</span>
      <div><div class="hs-ab-h"><kbd>${A.key}</kbd><b>${A.name}</b></div><small>${meta}</small><p>${A.desc || ABILITY_DESC[a] || ''}</p></div></div>`;
  };
  return `<div class="hero-sheet" style="--hc:${hex(d.color)}">
    <div class="hs-portrait"><img src="assets/ui/portraits/hero_${id}.png" alt="" loading="lazy" draggable="false"></div>
    <div class="hs-main">
      <h4>${d.name}</h4>
      <div class="hs-type">${melee ? 'Cuerpo a cuerpo' : 'A distancia'}${id === 'gunner' ? ' · control' : ''}</div>
      <p class="hs-desc">${d.desc}</p>
      <div class="chips">
        <span title="Vida">❤ ${d.hp}</span><span title="Armadura">🛡 ${Math.round((d.armor || 0) * 100)} %</span>
        <span title="Daño por ataque (sube con las oleadas)">⚔ ${d.dmg}${d.cleave ? ` + barrido ${Math.round(d.cleave * 100)} %` : d.splash ? ' en área' : ''}</span>
        <span title="Ataques por segundo">⚡ ${rate % 1 ? rate.toFixed(1) : rate}/s</span>
        <span title="Alcance de su arma">🎯 ${melee ? d.reach : d.range}</span>
        <span title="Esbirros extra que salen con este héroe">👥 ×${String(d.minionMult).replace('.', ',')} esbirros</span>
      </div>
      <div class="hs-abil">${[...d.abilities, d.ult].map(ab).join('')}
        ${d.passive ? `<div class="hs-ab passive"><span class="hs-ic">${d.passive.icon}</span><div><div class="hs-ab-h"><kbd class="pas">✦</kbd><b>${d.passive.name}</b></div><small>Pasiva · siempre activa</small><p>${d.passive.desc}</p></div></div>` : ''}
      </div>
    </div></div>`;
}
function renderHeroHelp() {
  $('tab-heroes').innerHTML = `
    <p class="hint">Después de elegir mapa eliges héroe (o <b>Sin héroe</b>, el juego original). Antes de la primera oleada, <b>colócalo</b> como una torre (no cuesta oro); hasta que empiece puedes recolocarlo gratis. Si llamas la oleada sin colocarlo, se coloca solo en el mejor sitio.</p>
    <div class="hero-sheets">${HERO_ORDER.map(heroSheet).join('')}</div>
    <div class="hero-rules">
      <p><b>Moverlo:</b> selecciónalo (clic en él, en su retrato o tecla <kbd>H</kbd>) y haz clic derecho o clic en cualquier punto del mapa: camina hasta allí y ese punto pasa a ser su <b>punto de guardia</b>.</p>
      <p><b>Modo AUTO</b> (botón junto a su retrato o tecla <kbd>A</kbd>): va siempre a por algún enemigo, esté donde esté (cuerpo a cuerpo, el más cercano; a distancia, el más avanzado que tenga a tiro o el más cercano). Si no queda ninguno vuelve a su punto de guardia, y si está casi muerto se retira un momento a curarse. Sin AUTO se queda quieto y solo ataca lo que tenga a su alcance.</p>
      <p><b>Habilidades:</b> <kbd>Q</kbd> y <kbd>W</kbd> tienen recarga; la definitiva <kbd>E</kbd> gasta la <b>energía</b> (barra azul de su panel), que se llena con las bajas, más si las hace él. Los meteoritos, el cepo y la minitorreta se apuntan con el ratón: verde si se puede, rojo si no.</p>
      <p><b>Cuidado:</b> los enemigos que caminan le pegan si se los cruza. Si cae, reaparece en su punto de guardia unos segundos después y, mientras tanto, no puedes usar sus habilidades. Con héroe salen <b>más esbirros</b> (👥 en cada ficha), pero el oro total es parecido.</p>
    </div>`;
}

function renderWeatherHelp() {
  const on = save.data.settings.weatherFx !== false && save.data.settings.weather !== false;
  $('tab-weather').innerHTML = `
    <p class="hint">Durante la partida el tiempo cambia solo: después de un rato de calma llega un fenómeno según el bioma, dura entre 30 y 55 segundos y vuelve la calma. Cuando empieza, aparece un aviso grande en el centro con su efecto.</p>
    <div class="card-grid">${WEATHER_INFO.map((w) => `<div class="info-card weather-card"><span class="w-icon">${w.icon}</span>
      <div><h4>${w.name}</h4><p>${WEATHER_FX[w.id].desc}.</p><div class="kv">${w.where}</div></div></div>`).join('')}</div>
    <p class="hint">Los rayos de la tormenta hacen ${WEATHER_BOLT.dmg} de daño (más en oleadas avanzadas) al enemigo que golpean y la mitad a los que tiene cerca. Aprovecha el clima: con ventisca los enemigos pasan más tiempo a tiro de tus torres; con lluvia, mejor no depender del fuego; con niebla, el hielo dura más.</p>
    <p class="hint">En <b>Ajustes</b>: «El clima afecta a la partida» lo deja solo como efecto visual, y «Clima dinámico» lo quita del todo.${on ? '' : ' <b>Ahora mismo los efectos del clima están desactivados.</b>'}</p>`;
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-body').forEach((b) => b.classList.toggle('active', b.id === `tab-${tab.dataset.tab}`));
  }));
}

function renderSettings() {
  const s = save.data.settings;
  $('set-tutorial').textContent = 'Repetir en Fácil';
  $('set-reset').textContent = 'Borrar progreso';
  $('set-reset').dataset.armed = '';
  $('set-music').checked = s.music;
  $('set-sfx').checked = s.sfx;
  $('set-boss3d').checked = s.boss3d !== false;
  $('set-minion3d').checked = s.minion3d !== false;
  $('set-weather').checked = s.weather !== false;
  $('set-weatherfx').checked = s.weatherFx !== false;
  document.querySelectorAll('#set-quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === s.quality));
}

function bindSettings() {
  $('set-music').addEventListener('change', (e) => { save.data.settings.music = e.target.checked; audio.setMusic(e.target.checked); save.write(); });
  $('set-sfx').addEventListener('change', (e) => { save.data.settings.sfx = e.target.checked; audio.setSfx(e.target.checked); save.write(); });
  $('set-boss3d').addEventListener('change', (e) => { save.data.settings.boss3d = e.target.checked; view.boss3d = e.target.checked; save.write(); });
  $('set-weatherfx').addEventListener('change', (e) => {
    save.data.settings.weatherFx = e.target.checked;
    save.write();
    if (game.sim) game.sim.setWeather(e.target.checked ? view.weather.state : 'calm');
  });
  $('set-weather').addEventListener('change', (e) => { save.data.settings.weather = e.target.checked; view.weather.setEnabled(e.target.checked); save.write(); });
  $('set-minion3d').addEventListener('change', (e) => { save.data.settings.minion3d = e.target.checked; view.minion3d = e.target.checked; save.write(); });
  document.querySelectorAll('#set-quality button').forEach((b) => b.addEventListener('click', () => {
    save.data.settings.quality = b.dataset.q;
    save.write();
    renderSettings();
    view.setQuality(QUALITY[b.dataset.q]);
    view.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  }));
  $('set-tutorial').addEventListener('click', (e) => {
    save.data.tutorialDone = false;
    save.write();
    e.target.textContent = 'Se repetirá ✓';
  });
  $('set-reset').addEventListener('click', (e) => {
    // confirmación en dos toques (confirm() no funciona en todos los visores)
    if (e.target.dataset.armed !== '1') { e.target.dataset.armed = '1'; e.target.textContent = '¿Seguro? Toca otra vez'; return; }
    e.target.dataset.armed = '';
    e.target.textContent = 'Progreso borrado ✓';
    save.reset();
    renderLevels();
    renderHowto();
  });
}

function goBack() {
  if (returnTo === 'pause') {
    showScreen(null);
    $('overlay-pause').classList.remove('hidden');
    $('hud').classList.remove('hidden');
    returnTo = 'screen-title';
    return;
  }
  if (current === 'screen-community') { renderLevels(); showScreen('screen-levels'); return; }
  if (['screen-levels', 'screen-howto', 'screen-settings', 'screen-achievements', 'screen-ranking'].includes(current)) showScreen('screen-title');
}

function bindHeroPick() {
  $('hero-cancel').addEventListener('click', () => $('overlay-hero').classList.add('hidden'));
}

function bindActions() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    audio.unlock();
    switch (btn.dataset.action) {
      case 'play': renderLevels(); showScreen('screen-levels'); break;
      case 'continue': {
        const run = save.data.run;
        if (!run || !LEVELS[run.levelId]) break;
        showScreen(null);
        game.start(run.levelId, { endless: !!run.endless, resume: run });
        break;
      }
      case 'achievements': renderAchievements($('ach-list')); returnTo = 'screen-title'; showScreen('screen-achievements'); break;
      case 'ranking': returnTo = 'screen-title'; showScreen('screen-ranking'); renderRanking(); break;
      case 'community': showScreen('screen-community'); renderCommunity(); break;
      case 'surrender': game.surrender(); break;
      case 'howto': renderHowto(); returnTo = 'screen-title'; showScreen('screen-howto'); break;
      case 'editor': openEditor(null); break;
      case 'settings': renderSettings(); returnTo = 'screen-title'; showScreen('screen-settings'); break;
      case 'back': goBack(); break;
      case 'resume': game.setPaused(false); break;
      case 'restart': game.start(game.levelId, { endless: game.endless }); break;
      case 'next': game.nextLevel(); break;
      case 'pause-howto': renderHowto(); returnTo = 'pause'; $('overlay-pause').classList.add('hidden'); showScreen('screen-howto'); break;
      case 'pause-settings': renderSettings(); returnTo = 'pause'; $('overlay-pause').classList.add('hidden'); showScreen('screen-settings'); break;
      case 'cheats': $('overlay-pause').classList.add('hidden'); game.paused = false; audio.resumeMusic(); game.openCheat(); break;
      case 'quit':
        game.stop();
        renderLevels();
        showScreen('screen-levels');
        break;
      default: break;
    }
  });
}

// ── Arranque ────────────────────────────────────────────
async function boot() {
  const touch = isTouch();
  document.body.classList.toggle('touch', touch);
  audio.setMusic(save.data.settings.music);
  audio.setSfx(save.data.settings.sfx);
  const tips = ['Afilando colmillos…', 'Despertando a los trolls…', 'Contando monedas de goblin…', 'Encendiendo la hoguera…'];
  let tip = 0;
  const tipT = setInterval(() => { $('loading-text').textContent = tips[++tip % tips.length]; }, 900);
  const [assets] = await Promise.all([
    loadAssets((p) => { $('loading-fill').style.width = `${Math.round(p * 100)}%`; }),
    audio.init(),
  ]);
  clearInterval(tipT);
  view = new GameView($('game-canvas'), assets, QUALITY[save.data.settings.quality] || QUALITY.medium);
  registerAll();
  editor = new Editor({
    onPlay: (id) => { showScreen(null); game.start(id, { hero: lastHero() }); },
    onClose: () => { renderLevels(); showScreen('screen-levels'); },
  });
  view.boss3d = save.data.settings.boss3d !== false;
  view.minion3d = save.data.settings.minion3d !== false;
  view.weather.enabled = save.data.settings.weather !== false;
  game = new Game(view, { showScreen });
  view.resize();
  bindActions();
  bindHeroPick();
  initCommunity({
    play: (id, endless) => openHeroPick(id, endless),
    toast: (t) => game.toast(t, 2200),
    refreshMine: () => renderCustom(),
    openCommunity: () => { showScreen('screen-community'); renderCommunity(); },
  });
  bindTabs();
  bindSettings();
  showScreen('screen-title');
  // visita anónima (para las estadísticas de la app de administración); si no hay API, no pasa nada
  fetch(`${API_BASE}api/visit`, { method: 'POST' }).catch(() => {});

  window.addEventListener('resize', () => {
    view.resize();
    if (current === 'screen-editor') editor.draw();
    if (game.active) requestAnimationFrame(() => game.updateInsets());
    checkOrientation();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.saveRun();
      if (game.active && !game.paused && !game.ended) game.setPaused(true);
      audio.pauseMusic();
    } else if (!game.active) audio.resumeMusic();
  });
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('pagehide', () => game.saveRun());

  const checkOrientation = () => {
    $('rotate-hint').classList.toggle('hidden', !(touch && innerHeight > innerWidth * 1.1));
  };
  checkOrientation();

  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.active) game.update(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Para pruebas automáticas / consola
  window.__tfg = { game, view, save };
}

boot().catch((e) => {
  console.error(e);
  $('loading-text').textContent = `Error al cargar: ${e.message}`;
});
