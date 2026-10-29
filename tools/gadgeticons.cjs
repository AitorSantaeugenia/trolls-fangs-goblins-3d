// Genera los iconos de las habilidades de Tuerca (cepo y minitorreta) a partir de sus modelos 3D
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await browser.newContext({ viewport: { width: 256, height: 256 } })).newPage();
  for (const k of ['trap', 'turret']) {
    await p.goto(`http://127.0.0.1:8765/dev/gadgets.html?k=${k}`);
    await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
    await p.screenshot({ path: path.join(__dirname, `../www/assets/ui/ab_${k}.png`), omitBackground: true });
  }
  await browser.close();
  console.log('ok');
})();
