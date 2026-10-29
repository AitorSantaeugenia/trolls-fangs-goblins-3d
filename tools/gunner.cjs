// Prueba de Tuerca: elegirla, colocarla, cepo (Q), minitorreta (W), cohetes (E) y recalentado
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const S = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/');
  await p.waitForSelector('#screen-title.active', { timeout: 60000 });
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload(); await p.waitForSelector('#screen-title.active', { timeout: 60000 });
  await p.evaluate(() => { window.__tfg.view.setQuality({ pixelRatio: 1, shadows: true, shadowSize: 1024, antialias: false, particles: 900, bloom: true, msaa: 0, rain: 200 }); window.__tfg.save.data.tutorialDone = true; window.__tfg.save.data.settings.weather = false; window.__tfg.view.weather.enabled = false; });
  await p.click('[data-action=play]'); await p.waitForTimeout(300);
  await p.click('#level-grid .level-card >> nth=1'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${S}/g_pick.png` });
  await p.click('.hero-card-pick[data-hero=gunner]'); await p.waitForTimeout(2500);
  const scr = (x, z) => p.evaluate(([x, z]) => { const v = window.__tfg.view; const q = v.project(x, v.heightAt(x, z), z); return [q.x, q.y]; }, [x, z]);
  const st = () => p.evaluate(() => { const g = window.__tfg.game, s = g.sim; const h = s.hero; return { aiming: g.aiming, hero: h && { x: +h.x.toFixed(1), z: +h.z.toFixed(1), heat: Math.round(h.heat), jam: +(Math.max(0, h.jamUntil - s.time)).toFixed(1), energy: Math.round(h.energy) }, traps: s.traps.length, turrets: s.turrets.length, cds: s.abilityCd }; });
  let [sx, sy] = await scr(-30, -6);
  await p.mouse.click(sx, sy); await p.waitForTimeout(500);
  await p.evaluate(() => { const g = window.__tfg.game; g.sim.gold = 3000; [['double', -42, -5], ['heavy', -28, 4]].forEach(([t, x, z]) => g.sim.build(t, x, z)); for (const ev of g.sim.drainEvents()) g.onEvent(ev); g.sim.callWave(); for (let i = 0; i < 200; i++) { g.sim.update(1 / 30); for (const ev of g.sim.drainEvents()) g.onEvent(ev); } });
  console.log('en combate', JSON.stringify(await st()));
  // Q: cepo en el camino (punto del camino por delante del primer enemigo)
  const pt = await p.evaluate(() => { const s = window.__tfg.game.sim; const e = s.enemies.sort((a, b) => b.dist - a.dist)[0]; const q = s.path.at(e.dist + 6, {}); return [q.x, q.z]; });
  await p.keyboard.press('q'); await p.waitForTimeout(200);
  [sx, sy] = await scr(pt[0], pt[1]);
  await p.mouse.move(sx, sy); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/g_aim_trap.png` });
  await p.mouse.click(sx, sy); await p.waitForTimeout(300);
  console.log('tras Q', JSON.stringify(await st()));
  // Q fuera del camino: debe rechazarlo
  await p.evaluate(() => { window.__tfg.game.sim.abilityCd.trap = 0; });
  await p.keyboard.press('q'); await p.waitForTimeout(100);
  [sx, sy] = await scr(-30, 20);
  await p.mouse.click(sx, sy); await p.waitForTimeout(300);
  console.log('Q fuera del camino', JSON.stringify(await st()), await p.evaluate(() => document.getElementById('toast')?.textContent));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  // W: minitorreta junto al camino
  await p.keyboard.press('w'); await p.waitForTimeout(200);
  [sx, sy] = await scr(pt[0] + 4, pt[1] + 3);
  await p.mouse.move(sx, sy); await p.waitForTimeout(200);
  await p.mouse.click(sx, sy); await p.waitForTimeout(1500);
  console.log('tras W', JSON.stringify(await st()));
  await p.screenshot({ path: `${S}/g_turret.png` });
  // E: cohetes
  await p.evaluate(() => { window.__tfg.game.sim.hero.energy = 100; });
  await p.keyboard.press('e'); await p.waitForTimeout(1600);
  await p.screenshot({ path: `${S}/g_rockets.png` });
  console.log('tras E', JSON.stringify(await st()));
  // forzar recalentado
  await p.evaluate(() => { const s = window.__tfg.game.sim; s.hero.heat = 24; });
  await p.waitForTimeout(2500);
  console.log('recalentado', JSON.stringify(await st()), await p.evaluate(() => document.getElementById('hpn-stats').textContent));
  await p.screenshot({ path: `${S}/g_jam.png` });
  // retrato
  await p.screenshot({ path: `${S}/g_panel.png`, clip: { x: 0, y: 560, width: 700, height: 208 } });
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
