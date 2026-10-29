// Genera las imágenes 3D de enemigos y héroes (Instrucciones y elector de héroe) a partir de sus modelos
// Uso: node server.mjs (puerto 8765) y luego node tools/portraits.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../www/assets/ui/portraits');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await browser.newContext({ viewport: { width: 320, height: 320 } })).newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  // nombres por id (Windows no distingue mayúsculas: «d» y «D» chocarían)
  const ENEMY_IDS = { m: 'minion', d: 'dragon', D: 'dragonBoss', L: 'dragonLord', l: 'lord', B: 'lordBoss', K: 'king', q: 'queen', S: 'snowLord' };
  // luz de contorno del color de cada enemigo; el Rey es muy oscuro y lleva más luz
  const RIM = { m: '0xc83030', d: '0x7ac04a', D: '0x8a3ad0', L: '0xff7a2a', l: '0x8a3aa0', B: '0xe0b040', K: '0x6a8aff&bright=2.4', q: '0xc8302a', S: '0x9feaff' };
  const jobs = Object.entries(ENEMY_IDS).map(([c, id]) => [`e=${c}&rim=${RIM[c]}`, `enemy_${id}`])
    .concat([['h=shaman&rim=0x4ad8ff', 'hero_shaman'], ['h=fang&rim=0xb48cff', 'hero_fang'], ['h=gunner&rim=0xffb03a', 'hero_gunner']]);
  for (const [qs, name] of jobs) {
    await p.goto(`http://127.0.0.1:8765/dev/portraits.html?${qs}`);
    await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
    await p.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: true });
    console.log(name);
  }
  await browser.close();
  // recorte cuadrado centrado en el modelo y a 192 px (con Python + Pillow)
  require('child_process').execFileSync('python3', ['-c', `
import glob
from PIL import Image
for f in glob.glob('${OUT}/*.png'):
    im = Image.open(f); l, t, r, b = im.getbbox()
    cx, cy = (l + r) / 2, (t + b) / 2; s = max(r - l, b - t) * 1.08
    big = Image.new('RGBA', (im.width * 2, im.height * 2)); big.paste(im, (im.width // 2, im.height // 2))
    o = im.width // 2
    big.crop((int(cx - s / 2) + o, int(cy - s / 2) + o, int(cx + s / 2) + o, int(cy + s / 2) + o)).resize((192, 192), Image.LANCZOS).save(f, optimize=True)
`]);
})();
