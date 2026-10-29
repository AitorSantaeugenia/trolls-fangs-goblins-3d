// Modo infinito + clasificación (servidor local en el puerto 8765). La administración ya no está en la web: admin-app/
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const S = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/');
  await p.waitForSelector('#screen-title.active', { timeout: 60000 });
  await p.evaluate(() => { window.__tfg.save.data.tutorialDone = true; window.__tfg.view.weather.enabled = false; window.__tfg.view.setQuality({ pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false, particles: 300, bloom: false, msaa: 0, rain: 100 }); });
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); window.__tfg.game.start('normal', { endless: true, hero: 'gunner' }); });
  await p.waitForTimeout(1500);
  const hud = () => p.evaluate(() => ({ call: document.getElementById('hud-call').classList.contains('hidden') ? '(oculto)' : document.getElementById('hud-call').textContent.trim(), wave: document.getElementById('hud-wave').textContent }));
  console.log('antes de empezar', JSON.stringify(await hud()));
  // simular deprisa: torres, empezar y avanzar unas oleadas
  await p.evaluate(() => {
    const g = window.__tfg.game, s = g.sim;
    s.gold = 2000; for (const [t, x, z] of [['double', -42, -5], ['heavy', -28, 4], ['poison', -12, -5], ['slow', 2, 6]]) s.build(t, x, z);
    s.callWave();
    for (let i = 0; i < 30 * 95; i++) { s.update(1 / 30); for (const ev of s.drainEvents()) g.onEvent(ev); }
  });
  await p.waitForTimeout(400);
  console.log('a los 95 s', JSON.stringify(await hud()), JSON.stringify(await p.evaluate(() => { const s = window.__tfg.game.sim; return { wave: s.waveIndex + 1, state: s.state, next: Math.round(s.nextWaveAt - s.time), kills: s.stats.kills, dmg: Math.round(s.stats.damage) }; })));
  await p.screenshot({ path: `${S}/r_hud.png`, clip: { x: 400, y: 0, width: 566, height: 80 } });
  // pausa: botón de rendirse
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('pausa: rendirse visible', await p.evaluate(() => !document.getElementById('btn-surrender').classList.contains('hidden')));
  await p.click('#btn-surrender'); await p.waitForTimeout(1500);
  await p.waitForSelector('#overlay-end:not(.hidden)', { timeout: 10000 });
  await p.screenshot({ path: `${S}/r_end_form.png` });
  await p.fill('#lb-name', 'Darkstein');
  await p.click('#lb-send'); await p.waitForTimeout(1200);
  console.log('tras enviar:', await p.evaluate(() => document.getElementById('end-rank').innerText.replace(/\s+/g, ' ').slice(0, 200)));
  await p.screenshot({ path: `${S}/r_end_sent.png` });
  // pantalla Clasificación
  await p.evaluate(() => { document.getElementById('overlay-end').classList.add('hidden'); window.__tfg.game.stop(); document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); document.getElementById('screen-title').classList.add('active'); });
  await p.click('[data-action=ranking]'); await p.waitForTimeout(1200);
  await p.click('[data-lb=hard]'); await p.waitForTimeout(900);
  await p.screenshot({ path: `${S}/r_ranking.png` });
  // con trucos no puntúa
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); const g = window.__tfg.game; g.start('normal', { endless: true, hero: null }); g.sim.callWave(); g.sim.cheat('greedisgood'); g.surrender(); });
  await p.waitForTimeout(1500);
  console.log('con trucos:', await p.evaluate(() => document.getElementById('end-rank').innerText.trim()));
  // el antiguo panel web de administración ya no existe
  const gone = await p.evaluate(async () => [(await fetch('/admin.html')).status, (await fetch('/api/admin/login', { method: 'POST', body: '{}' })).status]);
  console.log('admin web retirado (404 esperado):', gone.join(','));
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
