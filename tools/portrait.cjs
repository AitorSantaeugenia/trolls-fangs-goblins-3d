// Retratos del panel de los tres héroes
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const S = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  await p.goto('http://127.0.0.1:8765/');
  await p.waitForSelector('#screen-title.active', { timeout: 60000 });
  await p.evaluate(() => { window.__tfg.save.data.tutorialDone = true; window.__tfg.view.weather.enabled = false; window.__tfg.view.setQuality({ pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false, particles: 300, bloom: false, msaa: 0, rain: 100 }); });
  for (const id of ['shaman', 'fang', 'gunner']) {
    await p.evaluate((id) => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); const g = window.__tfg.game; if (g.sim) g.stop(); g.start('normal', { hero: id }); }, id);
    await p.waitForTimeout(1500);
    const b = await p.locator('#hero-panel').boundingBox();
    await p.screenshot({ path: `${S}/portrait_${id}.png`, clip: { x: b.x, y: b.y, width: 180, height: b.height } });
  }
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
