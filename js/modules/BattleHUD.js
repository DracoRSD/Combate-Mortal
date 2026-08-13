/**
 * Controlador del panel de batalla: nombres/fotos de los MC, turno activo,
 * contador de etapa/batalla y, para formatos "ida y vuelta", el contador de
 * entrada. No conoce nada del temporizador salvo los callbacks opcionales
 * que se disparan al avanzar de batalla o de entrada.
 */
export class BattleHUD {
  /**
   * @param {Object} config
   * @param {Object} config.elements - Elementos del DOM
   * @param {Array} config.mcData - Catálogo de MCs (data/mcs.js)
   * @param {Object} [config.format] - Formato elegido (data/formats.js)
   * @param {Function} [config.onNextBattle] - Se invoca al pasar de batalla
   * @param {Function} [config.onRoundReset] - Se invoca al avanzar de entrada
   */
  constructor({ elements, mcData, format, onNextBattle, onRoundReset }) {
    this.elements = elements;
    this.mcData = mcData || [];
    this.format = format || null;
    this.onNextBattle = onNextBattle;
    this.onRoundReset = onRoundReset;
    this.activeSide = 'a';
    this.battle = 1;
    this.entrada = 1;

    this.setupFightersFromURL();
    this.updateTurnUI();
    this.setupEntradas();
    this.bindEvents();
  }

  /**
   * Mostrar/ocultar y preparar el contador de entrada para formatos
   * "ida y vuelta" (mode: 'turns').
   */
  setupEntradas() {
    const isTurns = this.format && this.format.mode === 'turns';
    this.elements.entradaField.hidden = !isTurns;
    if (!isTurns) return;

    this.entradaTotal = this.format.entradas || 1;
    this.elements.entradaTotal.textContent = this.entradaTotal;
    this.setEntrada(1);
  }

  /**
   * Buscar un MC por nombre (insensible a mayúsculas/acentos simples)
   * @param {string} name
   */
  findMC(name) {
    if (!name) return null;
    const target = name.trim().toLowerCase();
    return this.mcData.find(mc => mc.nombreMC.trim().toLowerCase() === target) || null;
  }

  setupFightersFromURL() {
    const params = new URLSearchParams(window.location.search);
    const nameA = params.get('nombreA') || 'MC 1';
    const nameB = params.get('nombreB') || 'MC 2';

    this.setFighter('a', this.findMC(nameA) || { nombreMC: nameA });
    this.setFighter('b', this.findMC(nameB) || { nombreMC: nameB });
  }

  /**
   * @param {'a'|'b'} side
   * @param {Object} data - { nombreMC, urlFoto, pais, bandera }
   */
  setFighter(side, data) {
    const isA = side === 'a';
    const nameEl = isA ? this.elements.mcAName : this.elements.mcBName;
    const countryEl = isA ? this.elements.mcACountry : this.elements.mcBCountry;
    const img = isA ? this.elements.mcAPhoto : this.elements.mcBPhoto;
    const fallback = isA ? this.elements.mcAFallback : this.elements.mcBFallback;

    nameEl.textContent = data.nombreMC;
    countryEl.textContent = data.pais
      ? `${data.bandera ? data.bandera + ' ' : ''}Desde ${data.pais}`
      : '';
    fallback.textContent = data.nombreMC.trim().charAt(0).toUpperCase();

    if (data.urlFoto) {
      img.onerror = () => {
        img.style.display = 'none';
        fallback.classList.add('is-visible');
      };
      img.onload = () => {
        img.style.display = 'block';
        fallback.classList.remove('is-visible');
      };
      img.alt = data.nombreMC;
      img.src = data.urlFoto;
    } else {
      img.style.display = 'none';
      fallback.classList.add('is-visible');
    }
  }

  updateTurnUI() {
    const { mcA, mcB, tagA, tagB } = this.elements;
    const aActive = this.activeSide === 'a';
    mcA.classList.toggle('is-active', aActive);
    mcB.classList.toggle('is-active', !aActive);
    tagA.textContent = aActive ? 'TURNO' : '';
    tagB.textContent = !aActive ? 'TURNO' : '';
  }

  swapTurn() {
    this.activeSide = this.activeSide === 'a' ? 'b' : 'a';
    this.updateTurnUI();
  }

  setBattle(n) {
    this.battle = Math.max(1, n);
    this.elements.battleNum.textContent = this.battle;
  }

  nextBattle() {
    this.setBattle(this.battle + 1);
    this.activeSide = 'a';
    this.updateTurnUI();
    if (this.format && this.format.mode === 'turns') this.setEntrada(1);
    if (typeof this.onNextBattle === 'function') {
      this.onNextBattle();
    }
  }

  /**
   * Fijar el número de entrada actual (sin disparar efectos secundarios).
   * @param {number} n
   */
  setEntrada(n) {
    this.entrada = Math.min(this.entradaTotal, Math.max(1, n));
    this.elements.entradaNum.textContent = this.entrada;
  }

  /**
   * Avanzar a la siguiente entrada: cambia el turno y pide reiniciar el
   * cronómetro para la nueva entrada (mismo patrón que "Siguiente batalla",
   * pero sin incrementar el número de batalla).
   */
  nextEntrada() {
    if (this.entrada >= this.entradaTotal) return;
    this.setEntrada(this.entrada + 1);
    this.swapTurn();
    if (typeof this.onRoundReset === 'function') {
      this.onRoundReset();
    }
  }

  bindEvents() {
    const {
      mcA, mcB, btnTurno, btnSiguienteBatalla, battleUp, battleDown,
      entradaUp, entradaDown
    } = this.elements;

    mcA.addEventListener('click', () => {
      this.activeSide = 'a';
      this.updateTurnUI();
    });
    mcB.addEventListener('click', () => {
      this.activeSide = 'b';
      this.updateTurnUI();
    });

    btnTurno.addEventListener('click', () => this.swapTurn());
    btnSiguienteBatalla.addEventListener('click', () => this.nextBattle());

    battleUp.addEventListener('click', () => this.setBattle(this.battle + 1));
    battleDown.addEventListener('click', () => this.setBattle(this.battle - 1));

    entradaUp.addEventListener('click', () => this.nextEntrada());
    entradaDown.addEventListener('click', () => this.setEntrada(this.entrada - 1));

    document.addEventListener('keydown', (event) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (event.key === 't' || event.key === 'T') this.swapTurn();
      else if (event.key === 'n' || event.key === 'N') this.nextBattle();
    });
  }
}
