// Mide la sonoridad (LUFS) de los sonidos sintetizados frente a la música.
// Uso: node tools/audiolevels.cjs  (con el servidor en marcha en el puerto 8765)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { writeFileSync } = require('fs');
const { execSync } = require('child_process');
const OUT = process.argv[2] || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.goto('http://127.0.0.1:8765/');
  const res = await p.evaluate(async () => {
    const A = await import('./js/audio.js');
    const SR = 44100;
    const render = async (secs, fn) => {
      const c = new OfflineAudioContext(1, SR * secs, SR);
      const noise = A.makeNoise(c);
      const bus = {};
      for (const [k, v] of Object.entries(A.BUS)) { const g = c.createGain(); g.gain.value = v; g.connect(c.destination); bus[k] = g; }
      fn(c, bus, noise);
      const buf = await c.startRendering();
      // WAV 16 bits
      const d = buf.getChannelData(0);
      const out = new DataView(new ArrayBuffer(44 + d.length * 2));
      const w = (o, s) => [...s].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
      w(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
      out.setUint32(24, SR, true); out.setUint32(28, SR * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, d.length * 2, true);
      for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      let bin = ''; const u = new Uint8Array(out.buffer); for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode(...u.subarray(i, i + 8192));
      return btoa(bin);
    };
    const R = {};
    // 2 torres de cada tipo disparando a su ritmo real durante 10 s, con impactos
    const rate = { sand: 0.33, rock: 0.55, snow: 0.3, bullet: 0.22, shell: 1.4, poison: 0.6, fire: 0.16 };
    R.towers = await render(10, (c, bus, n) => {
      for (const [k, cd] of Object.entries(rate)) for (let t = 0.1; t < 9.6; t += cd / 2) {
        A.SHOTS[k](c, bus.towers, t, n, 0.92 + Math.random() * 0.16);
        if (A.HITS[k]) A.HITS[k](c, bus.hits, t + 0.4, n, 1);
      }
    });
    R.thunder = await render(4, (c, bus, n) => A.thunderVoice(c, bus.thunder, 0.1, n, 1));
    R.meteor = await render(3, (c, bus, n) => { for (let i = 0; i < 6; i++) A.HITS.meteor(c, bus.hits, 0.2 + i * 0.18, n, 1); });
    const amb = (kind) => (c, bus, n) => {
      const s = c.createBufferSource(); s.buffer = n; s.loop = true;
      const f = c.createBiquadFilter();
      if (kind === 'rain') { f.type = 'highpass'; f.frequency.value = 900; } else { f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.6; }
      s.connect(f).connect(bus[kind]); s.start(0);
    };
    R.rain = await render(6, amb('rain'));
    R.wind = await render(6, amb('wind'));
    return R;
  });
  const lufs = (file) => {
    const o = execSync(`ffmpeg -hide_banner -nostats -i ${file} -af ebur128=peak=true -f null - 2>&1`).toString();
    const I = [...o.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()[1];
    const S = Math.max(...[...o.matchAll(/ S:\s*(-?[\d.]+)/g)].map((m) => +m[1]).filter((v) => v > -100));
    return { I: +I, Smax: S };
  };
  for (const [k, b64] of Object.entries(res)) {
    const f = `${OUT}/lvl_${k}.wav`; writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log(k.padEnd(8), JSON.stringify(lufs(f)));
  }
  // música a su volumen de juego (0.35 = −9.1 dB)
  for (const m of ['musicbg', 'twistedTreelineSong', 'powerofthehordeSong']) {
    const o = execSync(`ffmpeg -hide_banner -nostats -i www/assets/audio/${m}.mp3 -af volume=0.35,ebur128 -f null - 2>&1`).toString();
    const S = [...o.matchAll(/ S:\s*(-?[\d.]+)/g)].map((x) => +x[1]).filter((v) => v > -100).sort((a, b) => a - b);
    console.log(m.padEnd(22), 'I', [...o.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()[1], 'S p10', S[Math.floor(S.length * 0.1)]);
  }
  await browser.close();
})();
