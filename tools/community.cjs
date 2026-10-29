// Mapas de la comunidad: publicar desde «Mis mapas», lista, ficha, jugar y publicar pegando un código
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const S = process.argv[2];
const B = process.argv[3] || 'http://127.0.0.1:8765';
const code = (d) => 'TFG1:' + Buffer.from(JSON.stringify(d)).toString('base64');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(B);
  await p.waitForSelector('#screen-title.active', { timeout: 60000 });
  // un mapa propio guardado en «Mis mapas»
  await p.evaluate(async (c) => {
    const { importCode, upsertMap } = await import('./js/custom.js');
    const m = importCode(c); m.name = 'Serpiente de hielo'; upsertMap(m);
    window.__tfg.save.data.tutorialDone = true; window.__tfg.view.weather.enabled = false;
  }, code({ n: 'x', b: 'snow', h: 15, g: 700, w: 'hard', m: 'goblinMarch', p: [[0, 2], [8, 2], [8, 12], [16, 12], [16, 4], [24, 4]] }));
  await p.click('[data-action=play]'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/c_levels.png`, fullPage: false });
  await p.click('#custom-grid [data-tool=pub]'); await p.waitForTimeout(400);
  await p.fill('#pub-author', 'Darkstein');
  await p.fill('#pub-desc', 'Una serpiente larga sobre el glaciar.\nAprovecha la curva central para poner hielo y cañones pesados.');
  await p.screenshot({ path: `${S}/c_publish.png` });
  await p.click('#pub-send'); await p.waitForTimeout(600);
  console.log('mensaje al publicar:', await p.textContent('#pub-msg'));
  await p.waitForTimeout(1600);
  console.log('tras publicar, pantalla:', await p.evaluate(() => document.querySelector('.screen.active')?.id));
  // segundo mapa pegando el código
  await p.click('#cm-upload'); await p.waitForTimeout(300);
  await p.fill('#pub-code', code({ n: 'Infierno recto', b: 'hell', h: 8, g: 450, w: 'hell', m: 'none', p: [[0, 7], [24, 7]] }));
  await p.dispatchEvent('#pub-code', 'input');
  await p.fill('#pub-author', 'Ana'); await p.fill('#pub-desc', 'Sin curvas, solo potencia de fuego.');
  await p.click('#pub-send'); await p.waitForTimeout(2200);
  // código malo
  await p.click('#cm-upload'); await p.waitForTimeout(300);
  await p.fill('#pub-code', 'TFG1:basura'); await p.dispatchEvent('#pub-code', 'input');
  await p.fill('#pub-author', 'X'); await p.click('#pub-send'); await p.waitForTimeout(400);
  console.log('código malo:', await p.textContent('#pub-msg'));
  await p.click('#pub-cancel'); await p.waitForTimeout(200);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/c_list.png` });
  console.log('tarjetas:', await p.$$eval('.cm-card b', (b) => b.map((x) => x.textContent)));
  await p.click('.cm-card >> nth=1'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/c_detail.png` });
  await p.click('#cm-d-actions [data-a=save]'); await p.waitForTimeout(300);
  console.log('guardado en mis mapas:', await p.evaluate(() => window.__tfg.save.data.customMaps.map((m) => m.name)));
  await p.click('#cm-d-actions [data-a=play]'); await p.waitForTimeout(500);
  console.log('elector de héroe abierto:', await p.evaluate(() => !document.getElementById('overlay-hero').classList.contains('hidden')), await p.textContent('#hero-pick-map'));
  await p.click('.hero-card-pick[data-hero=gunner]'); await p.waitForTimeout(2500);
  console.log('partida:', JSON.stringify(await p.evaluate(() => { const g = window.__tfg.game; return { level: g.levelId, name: g.sim.level.name, label: g.sim.level.label }; })));
  await p.screenshot({ path: `${S}/c_game.png` });
  const plays = await p.evaluate(async (b) => (await (await fetch(b + '/api/maps?sort=popular')).json()).maps.map((m) => `${m.name}:${m.plays}`), B);
  console.log('partidas:', plays);
  // volver: salir de la partida y de la comunidad vuelve a elegir mapa
  await p.evaluate(() => { window.__tfg.game.stop(); document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); document.getElementById('screen-community').classList.add('active'); });
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
