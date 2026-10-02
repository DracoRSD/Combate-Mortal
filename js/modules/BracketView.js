import { lazyLoadImage } from '../utils/image-utils.js';
import { STAGE_META } from './Bracket.js';
import { enableGridKeyboardNav, focusFirstNavItem } from '../utils/keyboardGrid.js';

/**
 * Geometría del póster (assets/images/llaves-poster.jpg), medida sobre la
 * imagen y expresada en % de su ancho/alto, borde blanco incluido. Cada
 * casilla interactiva se coloca con estas medidas para tapar exactamente la
 * casilla dibujada y escalar junto con el fondo. Los cruces 0-3 de Octavos
 * van en la columna izquierda y los 4-7 en la derecha, de arriba abajo;
 * las rondas siguientes siguen el mismo reparto por mitades que usa
 * Bracket.recompute().
 */
const SLOT = { w: 11.11, h: 3.7 };
const LAYOUT = {
  octavos: { lefts: [5.49, 83.46], perSide: 4, tops: [[23.45, 28.65], [39.75, 44.95], [55.95, 61.15], [72.3, 77.5]] },
  cuartos: { lefts: [17.92, 71.1], perSide: 2, tops: [[31.6, 36.8], [64.1, 69.3]] },
  semifinal: { lefts: [30.34, 58.68], perSide: 1, tops: [[47.9, 53.1]] },
  final: { lefts: [42.7], perSide: 1, tops: [[46.25, 53.35]], size: { w: 14.61, h: 5 } },
  tercerPuesto: { lefts: [42.7], perSide: 1, tops: [[62.6, 67.6]], size: { w: 14.61, h: 3.7 } }
};
const PODIO = { left: 31.59, w: 36.83, h: 3.35, tops: [77.35, 81.5, 85.65] };
const ACTIONS_GAP = 0.45;

function slotBox(stageKey, index) {
  const layout = LAYOUT[stageKey];
  const side = Math.floor(index / layout.perSide);
  const row = index % layout.perSide;
  const size = layout.size || SLOT;
  return { left: layout.lefts[side], w: size.w, h: size.h, topA: layout.tops[row][0], topB: layout.tops[row][1] };
}

function place(el, left, top, width, height) {
  el.style.left = left + '%';
  el.style.top = top + '%';
  el.style.width = width + '%';
  if (height != null) el.style.height = height + '%';
}

/**
 * Pinta el bracket del torneo sobre el póster de llaves a partir del estado
 * de `Bracket`, y maneja la asignación de MC en Octavos, el arranque de cada
 * batalla y el "rehacer" de un resultado ya decidido.
 */
export class BracketView {
  /**
   * @param {Object} config
   * @param {HTMLElement} config.stagesEl - Capa donde se pintan las casillas
   * @param {Object} config.picker - { overlay, grid, closeButton }
   * @param {import('./Bracket.js').Bracket} config.bracket
   * @param {Array} config.formats - Catálogo de formatos (data/formats.js)
   * @param {Function} config.onStartBattle - (stage, index, format, mcA, mcB) => void
   */
  constructor({ stagesEl, picker, bracket, formats, onStartBattle }) {
    this.stagesEl = stagesEl;
    this.picker = picker;
    this.bracket = bracket;
    this.formats = formats;
    this.onStartBattle = onStartBattle;
    this.pickerTarget = null;

    this.bindEvents();
    this.render();
  }

  formatOf(stageKey) {
    const meta = STAGE_META.find((s) => s.key === stageKey);
    return this.formats.find((f) => f.key === meta.formatKey);
  }

  render() {
    const fragment = document.createDocumentFragment();
    STAGE_META.forEach((stage) => {
      this.bracket.state[stage.key].forEach((match, index) => {
        fragment.appendChild(this.buildMatchCard(stage, index, match));
      });
    });
    this.buildPodio().forEach((bar) => fragment.appendChild(bar));

    this.stagesEl.innerHTML = '';
    this.stagesEl.appendChild(fragment);
  }

  buildMatchCard(stage, index, match) {
    const card = document.createElement('div');
    card.className = 'bracket-match';
    card.dataset.stage = stage.key;
    card.dataset.index = String(index);

    const box = slotBox(stage.key, index);
    const editable = stage.key === 'octavos';
    const decided = Boolean(match.winner);
    if (decided) card.classList.add('is-decided');

    const slotA = this.buildSlot(stage, match, 'a', editable, decided);
    place(slotA, box.left, box.topA, box.w, box.h);
    card.appendChild(slotA);

    if (stage.key === 'tercerPuesto') {
      const label = document.createElement('div');
      label.className = 'llaves__tercer-label';
      label.textContent = '3er y 4to puesto';
      place(label, box.left, box.topA + box.h, box.w, box.topB - (box.topA + box.h));
      card.appendChild(label);
    }

    const slotB = this.buildSlot(stage, match, 'b', editable, decided);
    place(slotB, box.left, box.topB, box.w, box.h);
    card.appendChild(slotB);

    if (decided || (match.a && match.b)) {
      const actions = document.createElement('div');
      actions.className = 'bracket-match__actions';
      place(actions, box.left, box.topB + box.h + ACTIONS_GAP, box.w);

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.navItem = '';
      if (decided) {
        button.className = 'bracket-match__redo';
        button.dataset.action = 'redo';
        button.textContent = 'Rehacer';
      } else {
        button.className = 'bracket-match__start';
        button.dataset.action = 'start';
        button.textContent = 'Iniciar batalla';
      }
      actions.appendChild(button);
      card.appendChild(actions);
    }

    return card;
  }

  buildSlot(stage, match, side, editable, decided) {
    const name = match[side];
    const isWinner = decided && match.winner === side;
    const isLoser = decided && match.winner !== side;

    const canEdit = editable && !decided;
    const el = document.createElement(canEdit ? 'button' : 'div');
    el.className = 'bracket-slot';
    if (stage.key === 'final') el.classList.add('bracket-slot--final');
    if (canEdit) {
      el.type = 'button';
      el.dataset.action = 'pick';
      el.dataset.side = side;
      el.dataset.navItem = '';
      el.setAttribute('aria-label', name ? 'Cambiar a ' + name : 'Elegir MC');
    }
    if (isWinner) el.classList.add('is-winner');
    if (isLoser) el.classList.add('is-loser');
    if (!name) {
      el.classList.add('is-empty');
      return el;
    }

    const label = document.createElement('span');
    label.className = 'bracket-slot__name';
    label.textContent = name;
    el.appendChild(label);
    return el;
  }

  /** Oro = ganador de la Final, plata = perdedor de la Final, bronce =
   * ganador del Tercer y Cuarto Puesto. */
  buildPodio() {
    const final = this.bracket.match('final', 0);
    const tercero = this.bracket.match('tercerPuesto', 0);
    const winnerOf = (m) => (m.winner ? m[m.winner] : null);
    const loserOf = (m) => (m.winner ? (m.winner === 'a' ? m.b : m.a) : null);

    return [winnerOf(final), loserOf(final), winnerOf(tercero)].map((name, i) => {
      const bar = document.createElement('div');
      bar.className = 'llaves__podio';
      bar.textContent = name || '';
      place(bar, PODIO.left, PODIO.tops[i], PODIO.w, PODIO.h);
      return bar;
    });
  }

  bindEvents() {
    this.stagesEl.addEventListener('click', (event) => {
      const pickBtn = event.target.closest('[data-action="pick"]');
      const startBtn = event.target.closest('[data-action="start"]');
      const redoBtn = event.target.closest('[data-action="redo"]');

      if (pickBtn) {
        const card = pickBtn.closest('.bracket-match');
        this.openPicker(card.dataset.stage, parseInt(card.dataset.index, 10), pickBtn.dataset.side);
        return;
      }

      if (startBtn) {
        const card = startBtn.closest('.bracket-match');
        const stageKey = card.dataset.stage;
        const index = parseInt(card.dataset.index, 10);
        const match = this.bracket.match(stageKey, index);
        const format = this.formatOf(stageKey);
        if (typeof this.onStartBattle === 'function') {
          this.onStartBattle(stageKey, index, format, match.a, match.b);
        }
        return;
      }

      if (redoBtn) {
        const card = redoBtn.closest('.bracket-match');
        const stage = card.dataset.stage;
        const index = parseInt(card.dataset.index, 10);
        this.bracket.clearWinner(stage, index);
        this.render();
        this.focusMatch(stage, index);
      }
    });

    this.picker.grid.addEventListener('click', (event) => {
      const card = event.target.closest('.fighter-card');
      if (!card || !this.pickerTarget) return;
      const { stage, index, side } = this.pickerTarget;
      const name = card.dataset.name;
      this.bracket.assign(stage, index, side, name);
      this.closePicker();
      this.render();
      this.focusMatch(stage, index);
    });

    this.picker.closeButton.addEventListener('click', () => this.cancelPicker());
    this.picker.overlay.addEventListener('click', (event) => {
      if (event.target === this.picker.overlay) this.cancelPicker();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.picker.overlay.hidden) this.cancelPicker();
    });

    enableGridKeyboardNav(this.picker.closeButton.parentElement, {
      layout: 'linear',
      onEdge: (key) => {
        if (key === 'ArrowDown' || key === 'ArrowRight') focusFirstNavItem(this.picker.grid);
      }
    });
    enableGridKeyboardNav(this.picker.grid, {
      layout: 'grid',
      onEdge: (key) => {
        if (key === 'ArrowUp') this.picker.closeButton.focus();
      }
    });
  }

  /**
   * Foco de vuelta al cruce recién tocado tras cerrar/recalcular el
   * bracket (asignar un MC, rehacer un resultado): sin esto el elemento
   * enfocado queda destruido por el render() y el navegador manda el
   * foco a <body>, dejando las flechas sin nada que mover.
   */
  focusMatch(stage, index) {
    const card = this.stagesEl.querySelector(
      '.bracket-match[data-stage="' + stage + '"][data-index="' + index + '"]'
    );
    const navItem = card && card.querySelector('[data-nav-item]');
    if (navItem) navItem.focus();
    else focusFirstNavItem(this.stagesEl);
  }

  openPicker(stage, index, side) {
    this.pickerTarget = { stage, index, side };
    const used = this.bracket.usedNames(index, side);

    this.picker.grid.innerHTML = '';
    this.bracket.mcData.forEach((mc) => {
      const isUsed = used.has(mc.nombreMC);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'fighter-card' + (isUsed ? ' is-disabled' : '');
      card.dataset.name = mc.nombreMC;
      card.dataset.navItem = '';
      if (isUsed) card.disabled = true;

      const img = document.createElement('img');
      img.alt = mc.nombreMC;
      const fallback = document.createElement('div');
      fallback.className = 'fighter-card__fallback';
      fallback.textContent = mc.nombreMC.trim().charAt(0).toUpperCase();
      const label = document.createElement('div');
      label.className = 'fighter-card__label';
      label.textContent = mc.nombreMC;

      card.append(img, fallback, label);
      this.picker.grid.appendChild(card);

      if (mc.urlFoto) {
        lazyLoadImage(img, mc.urlFoto).then((ok) => { if (!ok) card.classList.add('no-photo'); });
      } else {
        card.classList.add('no-photo');
      }
    });

    this.picker.overlay.hidden = false;
    focusFirstNavItem(this.picker.grid);
  }

  closePicker() {
    this.picker.overlay.hidden = true;
    this.pickerTarget = null;
  }

  /** Cerrar el selector sin elegir MC (Cerrar/Escape/click afuera): vuelve
   * el foco al cruce que lo abrió en vez de dejarlo caer a <body>. */
  cancelPicker() {
    const target = this.pickerTarget;
    this.closePicker();
    if (target) this.focusMatch(target.stage, target.index);
  }
}
