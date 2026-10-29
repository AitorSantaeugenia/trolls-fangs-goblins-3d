"""Compone el tema original del juego («Marcha del Goblin») sintetizando cada nota.
Al estar generado aquí, es música propia: se puede usar libremente (misma licencia que el remake).
Uso: python3 tools/compose_theme.py  →  www/assets/audio/goblinMarch.mp3
"""
import numpy as np, subprocess, wave, os

SR = 44100
BPM = 96
BEAT = 60 / BPM
BARS = 24                     # 24 compases de 4 tiempos ≈ 60 s
LEN = BARS * 4 * BEAT
rng = np.random.default_rng(7)
out = np.zeros((int((LEN + 4) * SR), 2))

def note(m):                   # nota MIDI → Hz
    return 440 * 2 ** ((m - 69) / 12)

def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    n = min(len(sig), len(out) - i)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:i + n, 0] += sig[:n] * gain * l
    out[i:i + n, 1] += sig[:n] * gain * r

def env(n, a, d):              # ataque y caída exponencial
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)

def lute(f, dur):              # cuerda pulsada (Karplus-Strong)
    n = int(dur * SR); p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p); y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return y * env(n, 0.002, dur * 0.6)

def flute(f, dur):             # flauta: seno + armónico suave, vibrato y soplo
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.3)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    s = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.03 * rng.normal(size=n)
    a = np.minimum(1, t / 0.06) * np.minimum(1, (dur - t) / 0.12)
    return s * np.clip(a, 0, 1)

def drone(f, dur):             # bordón grave (dos sierras ligeramente desafinadas, filtradas)
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(((t * f * k) % 1 - 0.5) for k in (1, 1.003, 0.5))
    k = np.exp(-np.arange(400) / 60); k /= k.sum()
    s = np.convolve(s, k, mode='same')
    a = np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 0.8)
    return s * np.clip(a, 0, 1)

def drum(low=True):            # tambor de marco: golpe grave + piel
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = (90 if low else 160) * np.exp(-t * 9) + (45 if low else 80)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (9 if low else 14))
    skin = rng.normal(size=n) * np.exp(-t * 40) * 0.25
    return body + skin

# Re dórico. Progresión de 4 compases: Dm – C – Dm – Am, repetida con variaciones
D = 50
chords = [[D, D + 7, D + 12], [D - 2, D + 5, D + 10], [D, D + 7, D + 12], [D - 5, D + 2, D + 7]]
scale = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17]
melA = [7, 9, 10, 9, 7, 5, 3, 5,  7, None, 3, 2, 0, None, 2, 3]   # semitonos sobre Re
melB = [10, 12, 14, 12, 10, 9, 7, 9,  10, 9, 7, 5, 7, None, None, None]

for bar in range(BARS):
    t0 = bar * 4 * BEAT
    ch = chords[bar % 4]
    sec = bar // 8                       # 3 secciones de 8 compases: A, B, A'
    if bar % 4 == 0:
        add(drone(note(ch[0] - 12), 4 * 4 * BEAT + 0.5), t0, 0, 0.016)
    # laúd: arpegio en corcheas
    for i in range(8):
        m = ch[[0, 1, 2, 1, 0, 2, 1, 2][i]] + (12 if i in (2, 5) else 0)
        add(lute(note(m), BEAT * 1.2), t0 + i * BEAT / 2 + rng.uniform(0, 0.008), -0.35, 0.22)
    # tambor: marcha (fuerte en 1 y 3, débiles en las corcheas finales)
    if sec > 0 or bar >= 4:
        for b, low, g in [(0, True, 0.5), (2, True, 0.42), (3.5, False, 0.22)] + ([(1.5, False, 0.16)] if sec == 1 else []):
            add(drum(low), t0 + b * BEAT, 0.15, g)
    # flauta: melodía en la sección A' y B
    if bar >= 4 and (bar % 8) < 8:
        mel = melB if sec == 1 else melA
        half = (bar % 2) * 8
        for i in range(8):
            g = mel[half + i]
            if g is None: continue
            m = D + 12 + g  # semitonos sobre Re (todos dentro del modo dórico)
            dur = BEAT / 2 * (2 if (i + 1 < 8 and mel[half + i + 1] is None) else 1)
            add(flute(note(m), dur * 0.95), t0 + i * BEAT / 2, 0.3, 0.16 if sec != 2 else 0.19)

# bucle sin corte: la cola de después del final se mezcla al principio
n = int(LEN * SR)
tail = out[n:]
out = out[:n].copy()
out[:len(tail)] += tail
# reverberación sencilla (ecos cruzados) y normalización suave
for d, g in [(0.083, 0.22), (0.131, 0.16), (0.197, 0.1)]:
    k = int(d * SR)
    out[k:, 0] += out[:-k, 1] * g
    out[k:, 1] += out[:-k, 0] * g
out /= np.max(np.abs(out)) * 1.12
pcm = (np.clip(out, -1, 1) * 32767).astype('<i2')
tmp = '/tmp/goblinMarch.wav'
with wave.open(tmp, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
dst = os.path.join(os.path.dirname(__file__), '..', 'www', 'assets', 'audio', 'goblinMarch.mp3')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', 'highpass=f=45,equalizer=f=90:t=q:w=1:g=-4,loudnorm=I=-17:TP=-1.5:LRA=9',
                '-ar', '44100', '-b:a', '128k', '-metadata', 'title=Marcha del Goblin',
                '-metadata', 'artist=Trolls, Fangs and Goblins 3D (tema original)', dst], check=True)
print('ok', dst)
