// Clasificación online del modo infinito (v1.8).
// Habla con la API de la clasificación (server.mjs en local o un VPS, o la función de Vercel con MongoDB Atlas;
// la dirección está en apiconfig.js).
// Si el juego se abre sin ese servidor (un alojamiento solo estático, el archivo suelto…), la clasificación
// aparece como «no disponible» y el resto del juego funciona igual.
import { LEVELS, LEVEL_ORDER, HEROES } from './config.js';
import { save } from './save.js';
import { API_BASE } from './apiconfig.js';

const API = `${API_BASE}api/scores`;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const GAME_VERSION = '1.11.1';

const OFFLINE = 'La clasificación online no está disponible ahora mismo.';
async function call(url, opts = {}) {
  try {
    const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const data = await r.json().catch(() => null);
    // sin API detrás (p. ej. GitHub Pages sin configurar apiconfig.js) la respuesta no es JSON
    if (!data) return { ok: false, offline: true, error: OFFLINE };
    if (!r.ok) return { ok: false, error: data.error || `Error ${r.status}`, status: r.status };
    return { ok: true, ...data };
  } catch {
    return { ok: false, offline: true, error: OFFLINE };
  }
}

export const fetchScores = (level, limit = 50) => call(`${API}?level=${encodeURIComponent(level)}&limit=${limit}`);
export const submitScore = (entry) => call(API, { method: 'POST', body: JSON.stringify(entry) });

// Puntuación de una partida infinita terminada
export function scoreEntry(game) {
  const s = game.sim;
  return {
    name: (save.data.settings.playerName || '').trim(),
    level: game.levelId,
    hero: s.heroDef ? s.heroDef.id : null,
    wave: s.waveIndex + 1,
    kills: s.stats.kills,
    towers: s.stats.built,
    gold: s.stats.goldEarned,
    damage: Math.round(s.stats.damage),
    time: Math.round(s.time),
    version: GAME_VERSION,
  };
}

// Solo puntúan los mapas oficiales, sin trucos y sin partidas recuperadas
export function canRank(game) {
  if (!game.endless || !game.sim) return { ok: false };
  if (!LEVEL_ORDER.includes(game.levelId)) return { ok: false, why: 'Los mapas personalizados no entran en la clasificación.' };
  if (game.sim.cheated) return { ok: false, why: 'Con trucos (o en una partida recuperada) no se puede entrar en la clasificación.' };
  if (game.sim.waveIndex < 0) return { ok: false };
  return { ok: true };
}

const heroName = (id) => (id && HEROES[id] ? `${HEROES[id].icon} ${HEROES[id].short}` : '🏰 Sin héroe');
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-ES');

// Tabla de clasificación (pantalla «Clasificación» y fin de partida)
export function tableHtml(scores, { highlight, compact } = {}) {
  if (!scores.length) return '<p class="hint lb-empty">Todavía no hay nadie en este mapa. ¡Sé el primero!</p>';
  const head = compact
    ? '<tr><th>#</th><th>Nombre</th><th>Oleada</th><th>Bajas</th><th>Héroe</th></tr>'
    : '<tr><th>#</th><th>Nombre</th><th>Oleada</th><th>Bajas</th><th>Héroe</th><th>Torres</th><th>Oro</th><th>Daño</th><th>Tiempo</th><th>Fecha</th></tr>';
  const rows = scores.map((s, i) => {
    const cls = s.id === highlight ? ' class="me"' : '';
    const medal = ['🥇', '🥈', '🥉'][i] || i + 1;
    return compact
      ? `<tr${cls}><td>${medal}</td><td class="lb-name">${esc(s.name)}</td><td><b>${s.wave}</b></td><td>${fmtNum(s.kills)}</td><td>${heroName(s.hero)}</td></tr>`
      : `<tr${cls}><td>${medal}</td><td class="lb-name">${esc(s.name)}</td><td><b>${s.wave}</b></td><td>${fmtNum(s.kills)}</td><td>${heroName(s.hero)}</td>
        <td>${s.towers}</td><td>${fmtNum(s.gold)}</td><td>${fmtNum(s.damage)}</td><td>${fmtTime(s.time)}</td><td>${new Date(s.date).toLocaleDateString('es-ES')}</td></tr>`;
  }).join('');
  return `<div class="lb-scroll"><table class="lb-table">${head}${rows}</table></div>`;
}

// ── Pantalla «Clasificación» ─────────────────────────────
let curLevel = null;
export async function renderRanking(level) {
  curLevel = level || curLevel || LEVEL_ORDER[1] || LEVEL_ORDER[0];
  $('lb-tabs').innerHTML = LEVEL_ORDER.map((id) => `<button class="tab${id === curLevel ? ' active' : ''}" data-lb="${id}">${esc(LEVELS[id].name)}</button>`).join('');
  $('lb-tabs').querySelectorAll('[data-lb]').forEach((b) => b.addEventListener('click', () => renderRanking(b.dataset.lb)));
  const box = $('lb-body');
  box.innerHTML = '<p class="hint">Cargando…</p>';
  const want = curLevel;
  const r = await fetchScores(want, 100);
  if (want !== curLevel) return;
  const L = LEVELS[want];
  const mine = (save.data.endless || {})[want] || 0;
  box.innerHTML = `<p class="hint lb-sub">${esc(L.label || '')} · modo infinito${mine ? ` · tu récord en este dispositivo: oleada ${mine}` : ''}</p>`
    + (r.ok ? tableHtml(r.scores || [], { highlight: save.data.lastScoreId }) : `<p class="hint lb-off">${esc(r.error)}</p>`);
}

// ── Fin de una partida infinita: formulario para entrar en la clasificación ──
export function mountEndForm(game) {
  const box = $('end-rank');
  const chk = canRank(game);
  box.classList.toggle('hidden', !game.endless);
  if (!game.endless) return;
  if (!chk.ok) { box.innerHTML = chk.why ? `<p class="hint">${esc(chk.why)}</p>` : ''; return; }
  const entry = scoreEntry(game);
  box.innerHTML = `
    <form class="lb-form" id="lb-form" autocomplete="off">
      <label for="lb-name">Entra en la clasificación de <b>${esc(LEVELS[game.levelId].name)}</b></label>
      <div class="lb-row"><input id="lb-name" maxlength="20" placeholder="Tu nombre" value="${esc(entry.name)}" required>
      <button class="btn btn-gold" type="submit" id="lb-send">Guardar</button></div>
      <p class="lb-msg" id="lb-msg"></p>
    </form>
    <div id="lb-top"></div>`;
  const form = $('lb-form');
  const input = $('lb-name');
  // que las teclas del juego (Q, W, espacio…) no se disparen mientras se escribe
  input.addEventListener('keydown', (e) => e.stopPropagation());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { $('lb-msg').textContent = 'Escribe un nombre.'; return; }
    save.data.settings.playerName = name;
    save.write();
    $('lb-send').disabled = true;
    $('lb-msg').textContent = 'Enviando…';
    const r = await submitScore({ ...entry, name });
    if (!r.ok) { $('lb-send').disabled = false; $('lb-msg').textContent = r.error; return; }
    save.data.lastScoreId = r.id;
    save.write();
    form.innerHTML = `<p class="lb-done">¡Guardado! Puesto <b>${r.rank}</b> de ${r.total} en ${esc(LEVELS[game.levelId].name)}.</p>`;
    const top = await fetchScores(game.levelId, 10);
    if (top.ok) $('lb-top').innerHTML = tableHtml(top.scores, { highlight: r.id, compact: true });
  });
}
