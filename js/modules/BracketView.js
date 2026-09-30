import { lazyLoadImage } from '../utils/image-utils.js';
import { STAGE_META } from './Bracket.js';
import { enableGridKeyboardNav, focusFirstNavItem } from '../utils/keyboardGrid.js';

function initialOf(name) {
  return name.trim().charAt(0).toUpperCase();
}

/**
 * Dibuja el bracket del torneo (Octavos → Cuartos → Semifinal → Tercer y
 * Cuarto Puesto → Final) a partir del estado de `Bracket`, y maneja la
 * asignación de MC en Octavos, el arranque de cada batalla y el "rehacer"
 * de un resultado ya decidido.
 */
export class BracketView {
  /**
   * @param {Object} config
   * @param {HTMLElement} config.stagesEl - Contenedor donde se pintan las rondas
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
    fragment.appendChild(this.buildTree());
    fragment.appendChild(this.buildStandaloneStage('tercerPuesto'));

    this.stagesEl.innerHTML = '';
    this.stagesEl.appendChild(fragment);
  }

  /**
   * Octavos → Cuartos → Semifinal → Final como dos mitades espejadas que
   * convergen al centro (una mitad de cada lado del cuadro), en vez de
   * apilar cada ronda completa en su propia fila. En mobile el CSS vuelve
   * a apilar todo (ver .bracket-tree en index.css).
   */
  buildTree() {
    const tree = document.createElement('div');
    tree.className = 'bracket-tree';

    const halves = [
      { stageKey: 'octavos', filter: (i) => i < 4, colClass: 'bracket-tree__col--octavos-left' },
      { stageKey: 'octavos', filter: (i) => i >= 4, colClass: 'bracket-tree__col--octavos-right', mirror: true },
      { stageKey: 'cuartos', filter: (i) => i < 2, colClass: 'bracket-tree__col--cuartos-left' },
      { stageKey: 'cuartos', filter: (i) => i >= 2, colClass: 'bracket-tree__col--cuartos-right', mirror: true },
      { stageKey: 'semifinal', filter: (i) => i === 0, colClass: 'bracket-tree__col--semifinal-left' },
      { stageKey: 'semifinal', filter: (i) => i === 1, colClass: 'bracket-tree__col--semifinal-right', mirror: true },
      { stageKey: 'final', filter: () => true, colClass: 'bracket-tree__col--final' }
    ];

    halves.forEach((half) => tree.appendChild(this.buildTreeColumn(half)));

    return tree;
  }

  buildTreeColumn({ stageKey, filter, colClass, mirror }) {
    const stage = STAGE_META.find((s) => s.key === stageKey);
    const format = this.formatOf(stageKey);

    const col = document.createElement('div');
    col.className = 'bracket-tree__col ' + colClass;
    col.appendChild(this.buildStageHeader(stage, format, mirror));

    this.bracket.state[stageKey].forEach((match, index) => {
      if (!filter(index)) return;
      col.appendChild(this.buildMatchCard(stage, index, match));
    });

    return col;
  }

  /** Ronda que se muestra aparte del bracket principal (no converge al
   * centro): hoy sólo Tercer y Cuarto Puesto. */
  buildStandaloneStage(stageKey) {
    const stage = STAGE_META.find((s) => s.key === stageKey);
    const format = this.formatOf(stageKey);

    const section = document.createElement('div');
    section.className = 'bracket-stage';
    section.appendChild(this.buildStageHeader(stage, format));

    const matchesEl = document.createElement('div');
    matchesEl.className = 'bracket-stage__matches';
    this.bracket.state[stageKey].forEach((match, index) => {
      matchesEl.appendChild(this.buildMatchCard(stage, index, match));
    });
    section.appendChild(matchesEl);

    return section;
  }

  buildStageHeader(stage, format, mirror) {
    const header = document.createElement('div');
    header.className = 'bracket-stage__header' + (mirror ? ' bracket-tree__header--mirror' : '');
    header.innerHTML =
      '<h3 class="bracket-stage__title">' + stage.label + '</h3>' +
      '<span class="bracket-stage__format">' + format.name + ' &middot; ' + format.description.toUpperCase() + '</span>';
    return header;
  }

  buildMatchCard(stage, index, match) {
    const card = document.createElement('div');
    card.className = 'bracket-match';
    card.dataset.stage = stage.key;
    card.dataset.index = String(index);

    const editable = stage.key === 'octavos';
    const decided = Boolean(match.winner);
    if (decided) card.classList.add('is-decided');

    card.appendChild(this.buildSlot(match, 'a', editable, decided));

    const vs = document.createElement('div');
    vs.className = 'bracket-match__vs';
    vs.textContent = 'VS';
    card.appendChild(vs);

    card.appendChild(this.buildSlot(match, 'b', editable, decided));

    if (decided) {
      const redo = document.createElement('button');
      redo.type = 'button';
      redo.className = 'bracket-match__redo';
      redo.dataset.action = 'redo';
      redo.dataset.navItem = '';
      redo.textContent = 'Rehacer';
      card.appendChild(redo);
    } else if (match.a && match.b) {
      const cta = document.createElement('div');
      cta.className = 'bracket-match__cta';
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'bracket-match__start';
      start.dataset.action = 'start';
      start.dataset.navItem = '';
      start.textContent = 'Iniciar batalla';
      cta.appendChild(start);
      card.appendChild(cta);
    }

    return card;
  }

  buildSlot(match, side, editable, decided) {
    const name = match[side];
    const mc = name ? this.bracket.mcByName(name) : null;

    const isWinner = decided && match.winner === side;
    const isLoser = decided && match.winner !== side;

    const canEdit = editable && !decided;
    const el = document.createElement(canEdit ? 'button' : 'div');
    el.className = 'bracket-slot';
    if (canEdit) {
      el.type = 'button';
      el.dataset.action = 'pick';
      el.dataset.side = side;
      el.dataset.navItem = '';
    }
    if (isWinner) el.classList.add('is-winner');
    if (isLoser) el.classList.add('is-loser');
    if (!name) el.classList.add('is-empty');

    if (!name) {
      el.innerHTML =
        '<span class="bracket-slot__icon">' + (editable ? '+' : '&hellip;') + '</span>' +
        '<span class="bracket-slot__name">' + (editable ? 'Elegir MC' : 'Pendiente') + '</span>';
      return el;
    }

    const img = document.createElement('img');
    img.className = 'bracket-slot__photo';
    img.alt = name;
    const fallback = document.createElement('div');
    fallback.className = 'bracket-slot__fallback';
    fallback.textContent = initialOf(name);
    const label = document.createElement('span');
    label.className = 'bracket-slot__name';
    label.textContent = name;

    el.append(img, fallback, label);

    if (mc && mc.urlFoto) {
      lazyLoadImage(img, mc.urlFoto).then((ok) => { if (!ok) el.classList.add('no-photo'); });
    } else {
      el.classList.add('no-photo');
    }

    return el;
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
      fallback.textContent = initialOf(mc.nombreMC);
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
