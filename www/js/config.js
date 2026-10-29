// ─────────────────────────────────────────────────────────────
//  Datos del juego. Valores tomados del original (Canvas 2D):
//  1 unidad 3D = 10 px del canvas original de 1200×700.
//  Velocidades originales en px/frame a 60 fps → u/s = v * 6.
// ─────────────────────────────────────────────────────────────

export const PX = 10;
export const MAP_W = 120; // 1200 px
export const MAP_H = 70; // 700 px
export const PATH_HALF = 2; // camino de 40 px de ancho
export const BUILD_BOUNDS = { x: 58.5, z: 33.5 };
export const SPAWN_INTERVAL = 50 / 60; // 1 enemigo cada 50 frames
export const WAVE_HP_GROWTH = 0.07; // +7 % de vida por oleada

export const toWorld = ([x, y]) => [(x - 600) / PX, (y - 350) / PX];

// ── Torres ───────────────────────────────────────────────────
// dmg / cost / range (px) del original. cooldown ≈ cadencia efectiva
// que tenía el original (dispara cuando el proyectil anterior impacta).
export const TOWERS = {
  sand: {
    id: 'sand',
    name: 'Torre de Arena',
    short: 'Arena',
    icon: 'assets/towers/sandTurret.webp',
    cost: 70,
    dmg: 5,
    range: 255 / PX,
    cooldown: 0.33,
    projectile: 'sand',
    projSpeed: 42,
    desc: 'Barata y rápida. Ideal para empezar.',
  },
  catapult: {
    id: 'catapult',
    name: 'Catapulta de Piedra',
    short: 'Catapulta',
    icon: 'assets/towers/stoneTurret.webp',
    cost: 150,
    dmg: 20,
    range: 450 / PX,
    cooldown: 0.55,
    projectile: 'rock',
    projSpeed: 34,
    splash: 3.2, // mejora: daño en área (50 %)
    splashRatio: 0.5,
    desc: 'Largo alcance. Las rocas dañan en área.',
  },
  slow: {
    id: 'slow',
    name: 'Torre de Hielo',
    short: 'Hielo',
    icon: 'assets/towers/freezeTurret.webp',
    cost: 200,
    dmg: 0.5,
    range: 255 / PX,
    cooldown: 0.3,
    projectile: 'snow',
    projSpeed: 48,
    slow: 0.3, // velocidad × 0.3 durante 1 s (original)
    slowTime: 1,
    desc: 'Congela: ralentiza muchísimo a los enemigos.',
  },
  double: {
    id: 'double',
    name: 'Doble Cañón',
    short: 'Doble',
    icon: 'assets/towers/doubleBarrel.webp',
    cost: 180,
    dmg: 12,
    range: 280 / PX,
    cooldown: 0.22,
    projectile: 'bullet',
    projSpeed: 60,
    desc: 'Dos cañones que alternan: mucho daño a un solo objetivo.',
  },
  heavy: {
    id: 'heavy',
    name: 'Cañón Pesado',
    short: 'Pesado',
    icon: 'assets/towers/heavyTurret.webp',
    cost: 250,
    dmg: 60,
    range: 330 / PX,
    cooldown: 1.4,
    projectile: 'shell',
    projSpeed: 30,
    splash: 4,
    splashRatio: 0.6,
    desc: 'Lento pero devastador: obuses con gran daño en área.',
  },
  poison: {
    id: 'poison',
    name: 'Torre de Veneno',
    short: 'Veneno',
    icon: 'assets/towers/poisonTurret.webp',
    cost: 160,
    dmg: 3,
    range: 250 / PX,
    cooldown: 0.6,
    projectile: 'poison',
    projSpeed: 38,
    poisonDps: 22,
    poisonTime: 4,
    desc: 'Envenena: daño continuo durante 4 s. Ignora resistencias.',
  },
  flame: {
    id: 'flame',
    name: 'Torre de Fuego',
    short: 'Fuego',
    icon: 'assets/towers/flameTurret.webp',
    lockedIcon: 'assets/towers/flameTurret_unk.webp',
    cost: 300,
    dmg: 35,
    range: 450 / PX,
    cooldown: 0.12,
    projectile: 'fire',
    projSpeed: 90,
    locked: true,
    desc: 'La B.F.T. Bloqueada… ¿cómo se desbloqueará?',
  },
};
export const TOWER_ORDER = ['sand', 'catapult', 'slow', 'double', 'heavy', 'poison', 'flame'];

// Mejoras (novedad respecto al original)
export const MAX_LEVEL = 3;
export const UPGRADE = {
  costMult: [0, 0.75, 1.25], // coste para pasar a nivel 2 y 3 (× coste base)
  dmg: [1, 1.6, 2.4],
  range: [1, 1.1, 1.2],
  rate: [1, 1.12, 1.25],
  slowTime: [1, 1.5, 2],
};
export const SELL_RATIO = 0.7;

// Prioridad de objetivo (novedad)
export const PRIORITIES = [
  { id: 'first', label: 'Primero', hint: 'El más avanzado' },
  { id: 'last', label: 'Último', hint: 'El más rezagado' },
  { id: 'strong', label: 'Fuerte', hint: 'El de más vida' },
  { id: 'close', label: 'Cerca', hint: 'El más cercano' },
];

// ── Enemigos ─────────────────────────────────────────────────
export const ENEMIES = {
  m: { id: 'minion', name: 'Esbirro', hp: 300, speed: 1.4 * 6, gold: 15, size: 3.6, sheet: null, atk: 14 },
  d: { id: 'dragon', name: 'Dragón', hp: 500, speed: 1.4 * 6, gold: 50, size: 7, sheet: 'dragon_boss', fly: true },
  D: { id: 'dragonBoss', name: 'Dragón Mayor', hp: 1000, speed: 1 * 6, gold: 80, size: 7, sheet: 'dragon_boss_2', fly: true },
  L: { id: 'dragonLord', name: 'Señor Dragón', hp: 20000, speed: 1.2 * 6, gold: 500, size: 9, sheet: 'dragon_boss_lord', fly: true, boss: true },
  l: { id: 'lord', name: 'Lord', hp: 2000, speed: 1.8 * 6, gold: 100, size: 4.6, sheet: 'lord_2', atk: 40 },
  B: { id: 'lordBoss', name: 'Gran Lord', hp: 5000, speed: 1 * 6, gold: 150, size: 5.4, sheet: 'lord', boss: true, atk: 80 },
  K: { id: 'king', name: 'Rey', hp: 10000, speed: 1 * 6, gold: 250, size: 7, sheet: 'king', boss: true, atk: 110 },
  q: { id: 'queen', name: 'Reina', hp: 800, speed: 1.4 * 6, gold: 70, size: 5.2, sheet: 'queen_boss', atk: 30 },
  S: { id: 'snowLord', name: 'Señor de las Nieves', hp: 25000, speed: 1 * 6, gold: 500, size: 9, sheet: 'snow_lord_boss', boss: true, frostImmune: true, fireWeak: true, atk: 130 },
};

// ── Oleadas (extraídas ejecutando el wave.js original) ───────
// m=esbirro d=dragón D=dragón mayor L=señor dragón l=lord
// B=gran lord K=rey q=reina S=señor de las nieves
export const WAVES = {
  easy: ['mmmmmmmmmmd', 'mmmmmmmmmmd', 'mmmmmmmmmmd', 'mmdmmdmmdmmdmmd'],
  normal: ['mmmmmmmmmmD', 'mmmmmDmmmmmD', 'mmmmmDmmmmmD', 'mmmDmmlmDmmmDml', 'mBmDmmDmBmDmmDmmB'],
  desert: [
    'mmmmqmmmmqmm',
    'mmdmmqmmdmmqmm',
    'mmqmmdmmqmmqmmd',
    'mmDmmqmmlmmDmmq',
    'mBmmdmmqmmlmmDmm',
    'mmlqmmDmmlqmmDmmB',
    'mKmmlqmmDmmlqmmDmm',
    'mKmlqmDmlqmDmBmlqmS',
  ],
  hard: [
    'mmmDmdmmDmmdmDm',
    'mmmDmmdmDmmmDmd',
    'mmqmDmqmlmDmmqmDml',
    'mmqmDlmqmmDlmmqmDlmq',
    'mBmmdDmmlmdDmmmdDml',
    'mSmmdDmmlmdDmmmdDml',
    'mSmqmdDmqmlmdDmmqmdDmSB',
  ],
  hell: [
    'mmmmdmqmmmdmmq',
    'mmqmmqmmqmmqmmq',
    'mBmmqmmmqmmmqm',
    'mBmmdDmmlmdDmmmdDml',
    'mBmqmDmqmlmDmmqmDml',
    'mBmqmlmqmmqmmqmlmB',
    'mKmmlqmmmlqmmmlqmB',
    'mKmmlqmmmlqmmmlqmB',
    'mKmqmlmqmSmqmmqmlmB',
    'mLmqmlmqmLmSmmqmlmB',
  ],
};

// ── Niveles ──────────────────────────────────────────────────
export const LEVELS = {
  easy: {
    id: 'easy',
    endlessGrowth: 1.05,
    hpMult: 0.8, // dificultad añadida (vida de enemigos)
    hpGrowth: 0,
    label: 'Fácil',
    name: 'Pradera de los Huesos',
    hp: 30,
    gold: 800,
    path: [[0, 350], [1200, 350]],
    tile: 'grass',
    music: 'musicbg',
    biome: 'meadow',
    campfire: [480, 500],
    minions: 'minions',
    thumb: 'assets/maps/mapOne.webp',
    towerScale: 1.7,
    unitScale: 1.3,
  },
  normal: {
    id: 'normal',
    endlessGrowth: 1.1,
    hpMult: 1.4, // dificultad añadida (vida de enemigos)
    hpGrowth: 0.04,
    label: 'Normal',
    name: 'Cementerio Sombrío',
    hp: 20,
    gold: 600,
    path: [[0, 255.5], [120, 255.5], [120, 120], [1080, 120], [1080, 400], [120, 400], [120, 255.5], [1200, 255.5]],
    tile: 'stone',
    music: 'twistedTreelineSong',
    biome: 'spooky',
    campfire: [765, 500],
    minions: 'minions',
    thumb: 'assets/maps/mapTwoSpooky.webp',
    towerScale: 1.35,
    unitScale: 1.15,
  },
  desert: {
    id: 'desert',
    endlessGrowth: 1.1,
    hpMult: 1.35, // dificultad añadida (vida de enemigos)
    hpGrowth: 0.05,
    label: 'Medio',
    name: 'Dunas del Escorpión',
    hp: 20,
    gold: 550,
    // un camino que se cruza consigo mismo en el centro
    path: [[0, 350], [200, 350], [200, 100], [1000, 100], [1000, 600], [400, 600], [400, 350], [1200, 350]],
    tile: 'stone',
    music: 'powerofthehordeSong',
    biome: 'desert',
    campfire: [700, 470],
    minions: 'minions',
    thumb: 'assets/maps/mapDesert.webp',
    towerScale: 1.3,
    unitScale: 1.15,
  },
  hard: {
    id: 'hard',
    endlessGrowth: 1.1,
    hpMult: 1.45, // dificultad añadida (vida de enemigos)
    label: 'Difícil',
    name: 'Glaciar Eterno',
    hp: 20,
    gold: 500,
    path: [
      [0, 100], [100, 100], [100, 500], [250, 500], [250, 100], [400, 100], [400, 500], [550, 500],
      [550, 100], [700, 100], [700, 500], [850, 500], [850, 100], [1000, 100], [1000, 470], [1150, 470],
      [1150, 250], [1200, 250],
    ],
    tile: 'iceBox',
    music: 'musicbg',
    biome: 'snow',
    campfire: [1100, 180],
    minions: 'minions',
    thumb: 'assets/maps/mapThreeSnowBiome.webp',
    towerScale: 1.3,
    unitScale: 1.15,
  },
  hell: {
    id: 'hell',
    endlessGrowth: 1.13,
    hpMult: 2.8, // dificultad añadida (vida de enemigos)
    label: 'Infierno',
    name: 'Abismo de Lava',
    hp: 10,
    gold: 500,
    path: [
      [0, 100], [100, 100], [1120, 100], [1120, 200], [80, 200], [80, 500], [1000, 500], [1000, 300],
      [200, 300], [200, 400], [1200, 400],
    ],
    tile: 'lava',
    music: 'powerofthehordeSong',
    biome: 'hell',
    campfire: [1100, 470],
    minions: 'hell',
    thumb: 'assets/maps/mapFourHell.webp',
    towerScale: 1.05,
    unitScale: 1,
  },
};
export const LEVEL_ORDER = ['easy', 'normal', 'desert', 'hard', 'hell'];

// Resistencias (novedad). Multiplicador de daño según proyectil y enemigo.
//  - Voladores: las piedras y obuses aciertan peor (×0.7)
//  - Esbirros del Infierno: resisten el fuego (×0.6)
//  - Señor de las Nieves: inmune a la congelación fuerte, débil al fuego (×1.5)
export function damageMult(e, kind, hellMinion) {
  if ((kind === 'rock' || kind === 'shell') && e.def.fly) return 0.7;
  if (kind === 'fire') {
    if (e.def.fireWeak) return 1.5;
    if (hellMinion) return 0.6;
  }
  return 1;
}

// Habilidades activas (fase 4)
export const ABILITIES = {
  meteor: { id: 'meteor', name: 'Lluvia de meteoritos', key: 'Q', cooldown: 45, count: 6, radius: 7, dmg: 220, splash: 3.2, target: true },
  blizzard: { id: 'blizzard', name: 'Ventisca', key: 'W', cooldown: 60, slow: 0.15, time: 4, dmg: 25 },
  // Colmillo
  leap: { id: 'leap', name: 'Salto del cazador', key: 'Q', cooldown: 14, radius: 3.2, dmg: 180, range: 16 },
  howl: { id: 'howl', name: 'Aullido', key: 'W', cooldown: 24, radius: 9, dmg: 40, stun: 2.5 },
  // Tuerca (se eligen con el ratón, como los meteoritos)
  trap: { id: 'trap', name: 'Cepo explosivo', key: 'Q', cooldown: 8, max: 3, life: 60, trigger: 1.5, radius: 2.6, dmg: 150, root: 2.5, target: true, onPath: true, aimRadius: 2.6, aimColor: 0xffb03a },
  turret: { id: 'turret', name: 'Minitorreta', key: 'W', cooldown: 24, life: 20, dmg: 9, rate: 0.18, range: 9, hp: 220, blockCap: 3, target: true, aimRadius: 9, aimColor: 0xffe14a },
  // Definitivas (E): sin recarga, gastan toda la energía (se carga con las bajas)
  arcaneNova: { id: 'arcaneNova', name: 'Nova arcana', key: 'E', cooldown: 0, energy: 100, dmg: 260, stun: 1.5, radius: 14, ult: true,
    desc: 'Estalla en energía arcana: daña y aturde a todos los enemigos a su alrededor.' },
  frenzy: { id: 'frenzy', name: 'Frenesí', key: 'E', cooldown: 0, energy: 100, time: 8, rate: 1.7, lifesteal: 0.35, ult: true,
    desc: 'Durante 8 s ataca un 70 % más rápido y se cura con cada zarpazo.' },
  rockets: { id: 'rockets', name: 'Lluvia de cohetes', key: 'E', cooldown: 0, energy: 100, count: 10, dmg: 180, splash: 2.6, ult: true,
    desc: 'Lanza diez cohetes contra los enemigos más peligrosos del mapa (primero los jefes).' },
};
// Descripción corta de cada habilidad (tarjetas del panel del héroe)
export const ABILITY_DESC = {
  meteor: 'Elige dónde caen seis meteoritos con daño en área.',
  blizzard: 'Congela y daña a todos los enemigos del mapa.',
  leap: 'Salta sobre el enemigo con más vida que tenga cerca y daña a los de alrededor.',
  howl: 'Aturde a los enemigos cercanos (los jefes, la mitad de tiempo).',
  trap: 'Pon un cepo en el camino: al pisarlo estalla, daña y deja clavados a los enemigos. Hasta 3 a la vez.',
  turret: 'Planta una minitorreta que dispara sola durante 20 s (a tierra y aire). En el camino frena a los enemigos, pero le pegan y se rompe enseguida.',
};
export const ABILITY_ICON = { meteor: '☄', blizzard: '❄', leap: '🐺', howl: '🌕', arcaneNova: '✴', frenzy: '🩸', trap: '🪤', turret: '🔩', rockets: '🚀' };
// Habilidades con imagen propia (dibujada a partir de su modelo 3D con tools/gadgeticons.cjs)
export const ABILITY_IMG = { trap: 'assets/ui/ab_trap.png', turret: 'assets/ui/ab_turret.png' };
// Icono de una habilidad en HTML: su imagen si la tiene, si no el emoji
export function abilityIcon(id, cls = 'ab-img') {
  return ABILITY_IMG[id] ? `<img class="${cls}" src="${ABILITY_IMG[id]}" alt="" draggable="false">` : (ABILITY_ICON[id] || '✦');
}

// ── Héroes (fase 6) ─────────────────────────────────────────
// Todos se mueven por todo el mapa: en modo auto van siempre a por algún enemigo; sin enemigos vuelven a su punto de guardia
// (donde los colocaste o los mandaste por última vez). En manual se quedan donde los mandes.
// ranged: dispara a distancia (range). melee: pega a corta distancia (reach), bloquea (blockCap) y tiene armadura.
export const HEROES = {
  // A distancia: más alcance y menos daño. Desde fuera del camino casi no le pegan.
  shaman: {
    id: 'shaman', name: 'Chamán troll', short: 'Chamán', icon: '🔮', type: 'ranged',
    desc: 'A distancia: lanza orbes arcanos con daño en área. Menos daño, pero dispara desde fuera del camino y casi nunca le alcanzan.',
    hp: 480, armor: 0.05, dmg: 22, cooldown: 0.7, range: 11, speed: 10, projectile: 'arcane', projSpeed: 40,
    splash: 1.8, splashRatio: 0.5, respawn: 15, abilities: ['meteor', 'blizzard'], ult: 'arcaneNova', color: 0x4ad8ff, size: 9,
    passive: { name: 'Orbes inestables', icon: '🔮', desc: 'Sus orbes estallan y dañan también a los enemigos de alrededor.' },
    minionMult: 2,
  },
  // Cuerpo a cuerpo: mucho más daño y frena a los enemigos, pero pelea en el camino y le pegan todos.
  fang: {
    id: 'fang', name: 'Colmillo, el cazador', short: 'Colmillo', icon: '🐺', type: 'melee',
    desc: 'Cuerpo a cuerpo: el que más daño hace (sus zarpazos alcanzan a los que tiene alrededor) y frena a los enemigos, pero pelea en mitad del camino y los esbirros le pegan. Salta sobre ellos y aúlla para aturdirlos.',
    hp: 1500, armor: 0.3, dmg: 50, cleave: 0.5, cooldown: 0.7, reach: 2.4, speed: 12, blockCap: 2, respawn: 14,
    abilities: ['leap', 'howl'], ult: 'frenzy', color: 0xb48cff, size: 7.6,
    passive: { name: 'Piel de lobo', icon: '🛡', desc: '30 % de armadura y zarpazos que alcanzan a los que tiene alrededor.' },
    minionMult: 1.5, // no puede atacar a los voladores: se le suman menos esbirros
  },
  // A distancia, de control: metralleta muy rápida pero floja que se recalienta y a veces se encasquilla.
  // Lo compensa con cepos en el camino y una minitorreta.
  gunner: {
    id: 'gunner', name: 'Tuerca, la artillera goblin', short: 'Tuerca', icon: '🔧', type: 'ranged',
    desc: 'A distancia: una metralleta rapidísima pero floja que se recalienta tras 25 disparos y a veces se encasquilla (3 s sin disparar). Pone cepos explosivos en el camino y planta minitorretas.',
    hp: 650, armor: 0.12, dmg: 7, cooldown: 0.1, range: 9, speed: 11, projectile: 'gatling', projSpeed: 80,
    overheat: 25, jamChance: 0.012, jamTime: 3, cool: 10,
    respawn: 14, abilities: ['trap', 'turret'], ult: 'rockets', color: 0xffb03a, size: 6.4, portrait: { y: 0.08, dist: 1.2 },
    passive: { name: 'Gatillo fácil', icon: '🔥', desc: 'Dispara 10 veces por segundo, pero tras 25 disparos se recalienta y a veces se encasquilla: 3 s sin disparar.' },
    minionMult: 1.75,
  },
};
export const HERO_ORDER = ['shaman', 'fang', 'gunner'];
// Con héroe salen más esbirros (decisión 15-10-2026); se ajusta con el bot de equilibrio
export const HERO_RULES = { minionMult: 2, minionGoldTotal: 1.1, regenDelay: 4, regen: 0.03, energyOwn: 6, energyAny: 2, retreatAt: 0.2, retreatUntil: 0.55, retreatHeal: 0.12 };

// Efectos del clima en la partida (se pueden apagar en Ajustes: «clima solo visual»)
export const WEATHER_FX = {
  blizzard: { speed: 0.9, desc: 'Enemigos un 10 % más lentos' },
  sandstorm: { range: 0.9, desc: 'Torres con un 10 % menos de alcance' },
  rain: { fire: 0.8, desc: 'El fuego hace un 20 % menos de daño' },
  storm: { fire: 0.8, bolts: true, desc: 'Fuego −20 % · los rayos golpean a los enemigos' },
  mist: { freeze: 1.25, desc: 'El hielo congela un 25 % más de tiempo' },
  firestorm: { burn: 8, desc: 'Las brasas queman a todos los enemigos' },
};
export const WEATHER_BOLT = { dmg: 150, splash: 2.5 };

// Modo infinito (v1.8): las oleadas salen solas cada «gap» segundos (sin cuenta atrás visible), cada vez más
// seguidas, más grandes y con más jefes. La vida crece con LEVELS[id].endlessGrowth (o hpGrowth) por oleada.
export const ENDLESS = {
  hpGrowth: 1.085, baseCount: 12, countStep: 2, maxCount: 70,
  gap: 40, gapMin: 20, gapStep: 1, // segundos entre una oleada y la siguiente (40 al principio, 20 a partir de la 21)
  spawnDecay: 0.975, spawnMin: 0.3, // los enemigos de cada oleada salen cada vez más juntos
  earlyBonus: 2, // oro por segundo adelantado al llamar la siguiente antes de tiempo
};

export const CHEATS = {
  greedisgood: '+200 de oro',
  hollymolly: '+1000 de oro',
  whosyourdaddy: 'Torre de Fuego desbloqueada',
  ezwin: 'Victoria instantánea',
  '4lose': 'Derrota instantánea',
  thanos: '…',
  ororo: 'Evento meteorológico aleatorio',
};
