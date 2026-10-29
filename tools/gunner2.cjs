// Tuerca: vista previa verde/roja de la minitorreta y del cepo, minitorreta en el camino e iconos del panel
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const S = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/');
  await p.waitForSelector('#screen-title.active', { timeout: 60000 });
  await p.evaluate(() => { window.__tfg.save.data.tutorialDone = true; window.__tfg.view.weather.enabled = false; window.__tfg.view.setQuality({ pixelRatio: 1, shadows: true, shadowSize: 1024, antialias: false, particles: 600, bloom: true, msaa: 0, rain: 100 }); });
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); window.__tfg.game.start('normal', { hero: 'gunner' }); });
  await p.waitForTimeout(1500);
  const scr = (x, z) => p.evaluate(([x, z]) => { const v = window.__tfg.view; const q = v.project(x, v.heightAt(x, z), z); return [q.x, q.y]; }, [x, z]);
  let [sx, sy] = await scr(-30, 22);
  await p.mouse.click(sx, sy); await p.waitForTimeout(300);
  await p.evaluate(() => { const g = window.__tfg.game; g.sim.callWave(); for (let i = 0; i < 240; i++) { g.sim.update(1 / 30); for (const ev of g.sim.drainEvents()) g.onEvent(ev); } });
  const pt = await p.evaluate(() => { const q = window.__tfg.game.sim.path.at(70, {}); return [q.x, q.z]; });
  // W: fantasma fuera del camino (verde), sobre una torre/obstáculo imposible (rojo) y en el camino
  await p.keyboard.press('w'); await p.waitForTimeout(150);
  [sx, sy] = await scr(pt[0], pt[1] + 6);
  await p.mouse.move(sx, sy); await p.waitForTimeout(400);
  await p.screenshot({ path: `${S}/g2_ghost_ok.png`, clip: { x: sx - 150, y: sy - 170, width: 300, height: 240 } });
  // encima de una torre: rojo
  const tw = await p.evaluate(([x, z]) => { const g = window.__tfg.game; g.sim.gold += 500; for (const [ox, oz] of [[0, 9], [6, 9], [-6, 9], [0, -9]]) { const t = g.sim.build('double', x + ox, z + oz); if (t) { for (const ev of g.sim.drainEvents()) g.onEvent(ev); return [t.x, t.z]; } } return null; }, pt);
  [sx, sy] = await scr(tw[0], tw[1]);
  await p.mouse.move(sx, sy); await p.waitForTimeout(400);
  await p.screenshot({ path: `${S}/g2_ghost_bad.png`, clip: { x: sx - 150, y: sy - 170, width: 300, height: 240 } });
  const bad = await p.evaluate(() => { const gg = window.__tfg.view.heroes.ghostG.turret; return { visible: gg.obj.visible, ok: gg.ok }; });
  [sx, sy] = await scr(pt[0], pt[1]);
  await p.mouse.move(sx, sy); await p.waitForTimeout(400);
  await p.screenshot({ path: `${S}/g2_ghost_path.png` });
  await p.mouse.click(sx, sy); await p.waitForTimeout(300);
  const t = await p.evaluate(() => { const s = window.__tfg.game.sim; const g = s.turrets[0]; return g && { onPath: g.onPath, hp: g.hp, ghostHidden: !window.__tfg.view.heroes.ghostG.turret.obj.visible }; });
  console.log('fantasma sobre torre', JSON.stringify(bad), 'torreta', JSON.stringify(t), await p.evaluate(() => document.getElementById('toast')?.textContent));
  await p.evaluate(() => { const g = window.__tfg.game; for (let i = 0; i < 150; i++) { g.sim.update(1 / 30); for (const ev of g.sim.drainEvents()) g.onEvent(ev); } });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/g2_turret_path.png` });
  console.log('tras 5 s', JSON.stringify(await p.evaluate(() => { const g = window.__tfg.game.sim.turrets[0]; return g ? { hp: Math.round(g.hp) } : 'rota'; })));
  // Q: fantasma del cepo
  await p.evaluate(() => { window.__tfg.game.sim.abilityCd.trap = 0; });
  await p.keyboard.press('q'); await p.waitForTimeout(150);
  [sx, sy] = await scr(pt[0], pt[1]);
  await p.mouse.move(sx, sy); await p.waitForTimeout(400);
  await p.screenshot({ path: `${S}/g2_trap_ghost.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  console.log('Esc oculta el fantasma', await p.evaluate(() => !window.__tfg.view.heroes.ghostG.trap.obj.visible));
  await p.screenshot({ path: `${S}/g2_panel.png`, clip: { x: 0, y: 560, width: 700, height: 208 } });
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
