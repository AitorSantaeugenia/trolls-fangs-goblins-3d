// Capturas de Instrucciones (Enemigos y Héroes) y del elector de héroe, en ordenador y en móvil
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const S = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  for (const [w, h, tag] of [[1366, 768, 'desk'], [844, 390, 'mob']]) {
    const p = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: tag === 'mob' })).newPage();
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('requestfailed', (r) => errors.push('404 ' + r.url()));
    await p.goto('http://127.0.0.1:8765/');
    await p.waitForSelector('#screen-title.active', { timeout: 60000 });
    await p.click('[data-action=howto]'); await p.waitForTimeout(300);
    for (const tab of ['enemies', 'heroes']) {
      await p.click(`.tab[data-tab=${tab}]`); await p.waitForTimeout(700);
      await p.screenshot({ path: `${S}/howto_${tab}_${tag}.png` });
      if (tab === 'heroes' && tag === 'desk') {
        await p.evaluate(() => { const b = document.getElementById('tab-heroes'); const sc = b.closest('.panel') || b; (b.scrollHeight > b.clientHeight ? b : sc).scrollTop = 520; });
        await p.waitForTimeout(300);
        await p.screenshot({ path: `${S}/howto_heroes2_${tag}.png` });
      }
    }
    if (tag === 'desk') {
      await p.evaluate(() => window.__tfg.save.data.tutorialDone = true);
      await p.click('#screen-howto .btn-back, #screen-howto [data-action=back]').catch(() => {});
      await p.evaluate(() => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); document.getElementById('screen-title').classList.add('active'); });
      await p.click('[data-action=play]'); await p.waitForTimeout(300);
      await p.click('#level-grid .level-card >> nth=1'); await p.waitForTimeout(600);
      await p.screenshot({ path: `${S}/pick_${tag}.png` });
    }
    await p.close();
  }
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
