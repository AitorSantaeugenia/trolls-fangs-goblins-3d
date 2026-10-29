// Ajusta el proyecto Android generado por Capacitor:
//  - fuerza orientación horizontal
//  - pantalla completa (sin barra de estado)
// Se ejecuta automáticamente con `npm run android:init`.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const manifest = 'android/app/src/main/AndroidManifest.xml';
const styles = 'android/app/src/main/res/values/styles.xml';

if (!existsSync(manifest)) {
  console.error('No existe la carpeta android/. Ejecuta antes: npx cap add android');
  process.exit(1);
}

let m = await readFile(manifest, 'utf8');
if (!m.includes('android:screenOrientation')) {
  m = m.replace(/<activity(\s)/, '<activity android:screenOrientation="sensorLandscape"$1');
  await writeFile(manifest, m);
  console.log('✓ Orientación horizontal');
}

if (existsSync(styles)) {
  let s = await readFile(styles, 'utf8');
  if (!s.includes('android:windowFullscreen')) {
    s = s.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>');
    await writeFile(styles, s);
    console.log('✓ Pantalla completa');
  }
}
console.log('Proyecto Android listo. Ábrelo con: npm run android:open');
