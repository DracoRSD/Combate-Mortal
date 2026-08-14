const MAX_HP = 100;
const DAMAGE_PER_HIT = 12;

/**
 * Barra de vida y efecto de golpe estilo juego de lucha: cada "Golpe" resta
 * vida al MC que no tiene el turno (el que está recibiendo la barra) y
 * dispara un flash rojo + sacudida momentánea sobre su foto.
 */
export class DamageSystem {
  /**
   * @param {Object} config
   * @param {Object} config.elements - { hpAFill, hpBFill, frameA, frameB }
   */
  constructor({ elements }) {
    this.elements = elements;
    this.hp = { a: MAX_HP, b: MAX_HP };
    this.updateBar('a');
    this.updateBar('b');
  }

  updateBar(side) {
    const fill = side === 'a' ? this.elements.hpAFill : this.elements.hpBFill;
    const pct = Math.max(0, Math.min(MAX_HP, this.hp[side]));
    fill.style.width = pct + '%';
    fill.classList.toggle('is-warn', pct <= 50 && pct > 20);
    fill.classList.toggle('is-critical', pct <= 20);
  }

  /**
   * Aplicar un golpe al MC del lado indicado: baja su vida y dispara el
   * efecto visual de daño sobre su retrato.
   * @param {'a'|'b'} side
   */
  hit(side) {
    if (this.hp[side] <= 0) return;
    this.hp[side] = Math.max(0, this.hp[side] - DAMAGE_PER_HIT);
    this.updateBar(side);
    this.triggerHitEffect(side);
    if (this.hp[side] <= 0) this.setDefeated(side, true);
  }

  triggerHitEffect(side) {
    const frame = side === 'a' ? this.elements.frameA : this.elements.frameB;
    frame.classList.remove('is-hit');
    void frame.offsetWidth; // Forzar reflow para poder reiniciar la animación en golpes seguidos
    frame.classList.add('is-hit');
  }

  /**
   * Oscurecer (o restaurar) el retrato de un MC cuando se queda sin vida,
   * como el "K.O." de un juego de lucha.
   * @param {'a'|'b'} side
   * @param {boolean} isDefeated
   */
  setDefeated(side, isDefeated) {
    const frame = side === 'a' ? this.elements.frameA : this.elements.frameB;
    const mc = frame.closest('.mc');
    if (mc) mc.classList.toggle('is-defeated', isDefeated);
  }

  reset() {
    this.hp.a = MAX_HP;
    this.hp.b = MAX_HP;
    this.updateBar('a');
    this.updateBar('b');
    this.setDefeated('a', false);
    this.setDefeated('b', false);
  }
}
