// Mapas de la comunidad (v1.9): la gente publica el código TFG1 de sus mapas del editor con un nombre,
// su nick y una descripción; los demás los ven con vista previa y los juegan o se los guardan.
// Se guardan en la base de datos de la clasificación (MongoDB Atlas en la web publicada; data/scores.json en local).
import { LEVELS } from './config.js';
import { BIOME_INFO, importCode, exportCode, registerMap, upsertMap } from './custom.js';
import { save } from './save.js';
import { API_BASE } from './apiconfig.js';
import { mapThumb, paintMap } from './mapdraw.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OFFLINE = 'Los mapas de la comunidad no están disponibles ahora mismo.';
const DIFF = { easy: 'Fácil', normal: 'Normal', desert: 'Medio', hard: 'Difícil', hell: 'Infierno' };

async function call(path, opts = {}) {
  try {
    const r = await fetch(`${API_BASE}api/${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const data = await r.json().catch(() => null);
    if (!data) return { ok: false, error: OFFLINE };
    return r.ok ? { ok: true, ...data } : { ok: false, error: data.error || `Error ${r.status}`, status: r.status };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

// código → mapa del editor (con el camino en píxeles); null si no vale
function decode(code) { try { return importCode(code); } catch { return null; } }
const thumbs = new Map();
function thumbOf(m) {
  if (!thumbs.has(m.id)) { const d = decode(m.code); thumbs.set(m.id, d ? mapThumb(d, 360) : ''); }
  return thumbs.get(m.id);
}
const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Pantalla «Mapas de la comunidad» ─────────────────────
let hooks = { play: () => {}, toast: () => {}, refreshMine: () => {} };
let sort = 'new';
let list = [];
export function initCommunity(h) {
  hooks = { ...hooks, ...h };
  $('cm-sort').addEventListener('click', (e) => { const b = e.target.closest('[data-sort]'); if (!b) return; sort = b.dataset.sort; renderCommunity(); });
  $('cm-upload').addEventListener('click', () => openPublish(null));
  $('cm-search').addEventListener('input', () => drawList());
  $('cm-search').addEventListener('keydown', (e) => e.stopPropagation());
  $('cm-detail-close').addEventListener('click', () => $('overlay-map').classList.add('hidden'));
  $('overlay-map').addEventListener('click', (e) => { if (e.target.id === 'overlay-map') $('overlay-map').classList.add('hidden'); });
  bindPublish();
}

export async function renderCommunity() {
  document.querySelectorAll('#cm-sort [data-sort]').forEach((b) => b.classList.toggle('active', b.dataset.sort === sort));
  $('cm-list').innerHTML = '<p class="hint">Cargando mapas…</p>';
  const r = await call(`maps?sort=${sort}&limit=120`);
  if (!r.ok) { $('cm-list').innerHTML = `<p class="hint cm-off">${esc(r.error)}</p>`; return; }
  list = r.maps;
  drawList();
}

function drawList() {
  const q = $('cm-search').value.trim().toLowerCase();
  const shown = q ? list.filter((m) => `${m.name} ${m.author} ${m.desc}`.toLowerCase().includes(q)) : list;
  if (!list.length) { $('cm-list').innerHTML = '<p class="hint cm-off">Todavía nadie ha publicado un mapa. ¡Crea uno en el editor y publícalo!</p>'; return; }
  if (!shown.length) { $('cm-list').innerHTML = '<p class="hint cm-off">Ningún mapa coincide con la búsqueda.</p>'; return; }
  $('cm-list').innerHTML = shown.map((m) => `
    <button class="cm-card" data-id="${m.id}">
      <div class="cm-thumb" style="background-image:url(${thumbOf(m)})"><span class="cm-biome">${esc(BIOME_INFO[m.biome]?.label || '')}</span></div>
      <div class="cm-info"><b>${esc(m.name)}</b><small>de <span>${esc(m.author)}</span> · ${fmtDate(m.date)}</small>
      <div class="cm-meta">❤ ${m.hp} · 🪙 ${m.gold} · ${DIFF[m.preset] || 'Normal'} · ▶ ${m.plays}</div></div>
    </button>`).join('');
  $('cm-list').querySelectorAll('.cm-card').forEach((el) => el.addEventListener('click', () => openDetail(list.find((m) => m.id === el.dataset.id))));
}

// Ficha de un mapa: vista previa grande, autor, descripción y qué se puede hacer con él
function openDetail(m) {
  const d = decode(m.code);
  if (!d) { hooks.toast('Este mapa tiene un código dañado'); return; }
  const c = $('cm-preview');
  const w = c.clientWidth || 640;
  c.width = Math.round(w * Math.min(2, window.devicePixelRatio || 1));
  c.height = Math.round(c.width * 700 / 1200);
  paintMap(c.getContext('2d'), d, c.width / 1200);
  $('cm-d-name').textContent = m.name;
  $('cm-d-by').innerHTML = `de <b>${esc(m.author)}</b> · ${fmtDate(m.date)} · ▶ ${m.plays} ${m.plays === 1 ? 'partida' : 'partidas'}`;
  $('cm-d-desc').textContent = m.desc || 'Sin descripción.';
  $('cm-d-desc').classList.toggle('empty', !m.desc);
  $('cm-d-stats').innerHTML = `<span>🗺 ${esc(BIOME_INFO[m.biome]?.label || '')}</span><span>❤ ${m.hp} vidas</span><span>🪙 ${m.gold} de oro</span><span>⚔ Oleadas: ${DIFF[m.preset] || 'Normal'}</span><span>↪ ${m.turns} ${m.turns === 1 ? 'curva' : 'curvas'}</span>`;
  const act = $('cm-d-actions');
  act.onclick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'play' || b.dataset.a === 'endless') {
      const id = `community_${m.id}`;
      registerMap({ ...d, id, name: m.name, thumb: thumbOf(m) });
      LEVELS[id].label = 'Comunidad';
      LEVELS[id].communityId = m.id;
      call(`maps/${m.id}/play`, { method: 'POST' });
      $('overlay-map').classList.add('hidden');
      hooks.play(id, b.dataset.a === 'endless');
    } else if (b.dataset.a === 'save') {
      upsertMap({ ...d, id: `custom_${Date.now().toString(36)}`, name: m.name, thumb: thumbOf(m) });
      hooks.refreshMine();
      hooks.toast(`«${m.name}» guardado en Mis mapas`);
    } else if (b.dataset.a === 'copy') {
      try { await navigator.clipboard.writeText(m.code); hooks.toast('Código copiado'); } catch {
        const t = $('cm-d-code'); t.classList.remove('hidden'); t.value = m.code; t.select(); hooks.toast('Selecciona y copia el código');
      }
    }
  };
  $('cm-d-code').classList.add('hidden');
  $('overlay-map').classList.remove('hidden');
}

// ── Publicar un mapa ─────────────────────────────────────
// mine = un mapa de «Mis mapas» (o null para pegar un código)
export function openPublish(mine) {
  const code = mine ? exportCode(mine) : '';
  $('pub-code').value = code;
  $('pub-code').readOnly = !!mine;
  $('pub-code-row').classList.toggle('hidden', !!mine);
  $('pub-name').value = mine ? mine.name : '';
  $('pub-author').value = save.data.settings.playerName || '';
  $('pub-desc').value = '';
  $('pub-msg').textContent = '';
  $('pub-msg').className = 'lb-msg';
  $('pub-send').disabled = false;
  $('pub-title').textContent = mine ? `Publicar «${mine.name}»` : 'Publicar un mapa con su código';
  previewCode();
  $('overlay-publish').classList.remove('hidden');
  (mine ? $('pub-desc') : $('pub-code')).focus();
}
function previewCode() {
  const d = decode($('pub-code').value);
  const c = $('pub-preview');
  c.width = 480; c.height = 280;
  const g = c.getContext('2d');
  if (d) {
    paintMap(g, d, c.width / 1200);
    if (!$('pub-name').value) $('pub-name').value = d.name;
  } else {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#1a120c'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#8a7a62'; g.font = '16px Georgia'; g.textAlign = 'center';
    g.fillText($('pub-code').value.trim() ? 'Código no válido' : 'Pega aquí el código TFG1:… de tu mapa', c.width / 2, c.height / 2);
  }
}
function bindPublish() {
  const stop = (e) => e.stopPropagation(); // que las teclas del juego no se disparen al escribir
  ['pub-code', 'pub-name', 'pub-author', 'pub-desc'].forEach((id) => $(id).addEventListener('keydown', stop));
  $('pub-code').addEventListener('input', previewCode);
  $('pub-desc').addEventListener('input', () => { $('pub-count').textContent = `${$('pub-desc').value.length} / 400`; });
  $('pub-cancel').addEventListener('click', () => $('overlay-publish').classList.add('hidden'));
  $('pub-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('pub-msg');
    const author = $('pub-author').value.trim();
    if (!decode($('pub-code').value)) { msg.textContent = 'El código del mapa no es válido.'; return; }
    if (!author) { msg.textContent = 'Escribe tu nick.'; return; }
    save.data.settings.playerName = author;
    save.write();
    $('pub-send').disabled = true;
    msg.className = 'lb-msg';
    msg.textContent = 'Publicando…';
    const r = await call('maps', { method: 'POST', body: JSON.stringify({ code: $('pub-code').value.trim(), name: $('pub-name').value.trim(), author, desc: $('pub-desc').value.trim() }) });
    if (!r.ok) { $('pub-send').disabled = false; msg.textContent = r.error; return; }
    msg.className = 'lb-msg ok';
    msg.textContent = '¡Publicado! Ya lo puede jugar todo el mundo.';
    setTimeout(() => {
      $('overlay-publish').classList.add('hidden');
      sort = 'new';
      hooks.openCommunity?.();
    }, 1100);
  });
}
