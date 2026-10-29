// Tutorial interactivo del primer nivel (solo la primera vez, se puede saltar)
import { save } from './save.js';
import { PREP_TIME } from './sim.js';

const $ = (id) => document.getElementById(id);

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.step = -1;
    $('coach-skip').addEventListener('click', () => this.finish());
  }

  get active() { return this.step >= 0; }

  start() {
    this.step = 0;
    this.t = 0;
    this.pulseT = 0;
    this.spot = this.findSpot();
    setTimeout(() => this.show(), 1800); // después del cartel con el nombre del nivel
  }

  stop() {
    this.step = -1;
    this.highlight(null);
    $('coach').classList.add('hidden');
  }

  finish() {
    save.data.tutorialDone = true;
    save.write();
    if (this.active) this.game.toast('¡A defender el castillo!', 1800);
    this.stop();
  }

  // Un buen sitio junto al camino donde sugerir la primera torre
  findSpot() {
    const sim = this.game.sim;
    for (const [x, z] of [[-20, -7], [-28, -7], [-12, -7], [-20, 7], [-4, -7], [0, 7]]) {
      const why = sim.checkPlacement('sand', x, z);
      if (!why || why === 'oro') return { x, z };
    }
    return { x: -24, z: 7 };
  }

  text() {
    const touch = this.game.touch;
    return [
      'Elige la <b>Torre de Arena</b> en la barra de torres.',
      touch
        ? 'Toca el suelo <b>junto al camino</b> (donde late el anillo) y confirma con <b>✓</b>.'
        : 'Haz clic en el suelo <b>junto al camino</b>, donde late el anillo.',
      '¡Bien! Pon alguna torre más si quieres y pulsa <b>▶ Oleada 1</b> cuando estés listo.',
      `${touch ? 'Toca' : 'Haz clic en'} una torre construida para <b>mejorarla</b>, <b>venderla</b> o elegir <b>a quién ataca</b>.`,
    ][this.step];
  }

  show() {
    if (!this.active) return;
    const el = $('coach');
    el.classList.remove('hidden');
    $('coach-step').textContent = `Tutorial ${this.step + 1}/4`;
    $('coach-text').innerHTML = this.text();
    this.highlight([`.tcard[data-type="sand"]`, null, '#hud-call', null][this.step]);
  }

  highlight(sel) {
    document.querySelectorAll('.coach-pulse').forEach((e) => e.classList.remove('coach-pulse'));
    if (sel) document.querySelector(sel)?.classList.add('coach-pulse');
  }

  next() {
    this.step++;
    this.t = 0;
    if (this.step > 3) this.finish();
    else this.show();
  }

  onEvent(ev) {
    if (!this.active) return;
    if (this.step === 0 && ev.type === 'pick' && ev.tower === 'sand') this.next();
    else if (this.step === 1 && ev.type === 'build') this.next();
    else if (this.step === 2 && ev.type === 'wave') { this.step = 3; this.t = 0; $('coach').classList.add('hidden'); this.highlight(null); this.waiting = true; }
    else if (this.step === 3 && ev.type === 'select') this.next();
  }

  update(dt) {
    if (!this.active || !this.game.sim) return;
    const sim = this.game.sim;
    this.t += dt;
    // la cuenta atrás no corre hasta que el jugador llama la oleada
    if (this.step < 3 && sim.state === 'prep') sim.timer = PREP_TIME;
    // anillo que late donde sugerimos la torre
    if (this.step === 1) {
      this.pulseT -= dt;
      if (this.pulseT <= 0) {
        this.pulseT = 0.9;
        this.game.view.fx.shockwave(this.spot.x, this.spot.z, 0xffd36a, 4, 0.8, 0.3);
      }
    }
    // tras unos segundos de oleada, enseñamos el panel de la torre
    if (this.step === 3 && this.waiting && this.t > 5) { this.waiting = false; this.show(); }
    if (this.step === 3 && !this.waiting && this.t > 20) this.finish();
  }
}
