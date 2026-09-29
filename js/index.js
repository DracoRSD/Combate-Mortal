import { FormatPicker } from './modules/FormatPicker.js';
import { FighterSelector } from './modules/FighterSelector.js';
import { Bracket } from './modules/Bracket.js';
import { BracketView } from './modules/BracketView.js';
import { TimerController } from './modules/TimerController.js';
import { BattleHUD } from './modules/BattleHUD.js';
import { DamageSystem } from './modules/DamageSystem.js';
import { WinnerScreen } from './modules/WinnerScreen.js';
import { createBoltRenderer } from './utils/lightning.js';
import { cleanupVideos } from './utils/performance.js';
import { enableGridKeyboardNav, focusFirstNavItem } from './utils/keyboardGrid.js';
import McData from '../data/mcs.js';
import Formats from '../data/formats.js';

// Banco de palabras para el formato temático — conceptos amplios que dan
// pie a barras (emociones, vida, calle, existencial), sin repetir tema.
const THEME_WORDS = [
  'Venganza', 'Envidia', 'Lealtad', 'Ego', 'Traición', 'Orgullo', 'Dominio',
  'Respeto', 'Libertad', 'Poder', 'Miedo', 'Muerte', 'Familia', 'Dinero',
  'Fama', 'Soledad', 'Guerra', 'Paz', 'Justicia', 'Mentira', 'Verdad',
  'Destino', 'Locura', 'Fe', 'Sangre', 'Raíces', 'Corona', 'Caos',
  'Redención', 'Espejo', 'Silencio', 'Sombra'
];

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === 'screen' + name);
  });
}

function initializeApp() {
  var chosenFormat = Formats[0];
  var torneoContext = null; // { stage, index } de la batalla en curso, o null en batalla suelta

  var formatGrid = document.getElementById('formatGrid');
  var fighterGrid = document.getElementById('fighterGrid');
  var bracketStages = document.getElementById('bracketStages');
  var controls = document.getElementById('controls');
  var duel = document.querySelector('.duel');

  // ---------- Torneo ----------
  var bracket = new Bracket(McData);
  var bracketView = new BracketView({
    stagesEl: bracketStages,
    picker: {
      overlay: document.getElementById('bracketPicker'),
      grid: document.getElementById('bracketPickerGrid'),
      closeButton: document.getElementById('bracketPickerClose')
    },
    bracket: bracket,
    formats: Formats,
    onStartBattle: function (stage, index, format, mcA, mcB) {
      startBattle(mcA, mcB, format, { stage: stage, index: index });
    }
  });

  document.getElementById('btnBatallaSuelta').addEventListener('click', function () {
    showScreen('Format');
    focusFirstNavItem(formatGrid);
  });
  document.getElementById('btnVolverTorneo').addEventListener('click', function () {
    showScreen('Torneo');
    focusFirstNavItem(bracketStages);
  });
  document.getElementById('btnReiniciarTorneo').addEventListener('click', function () {
    if (window.confirm('¿Reiniciar el torneo? Se perderá todo el progreso del bracket.')) {
      bracket.reset();
      bracketView.render();
    }
  });

  enableGridKeyboardNav(bracketStages, { layout: 'grid' });

  // ---------- Selección de formato ----------
  var formatPicker = new FormatPicker({
    cards: document.querySelectorAll('.mode-card'),
    formats: Formats,
    onSelect: function (format) {
      chosenFormat = format;
      document.getElementById('formatBadge').textContent = format.name + ' — ' + format.description.toUpperCase();
      fighterSelector.reset();
      showScreen('Select');
      focusFirstNavItem(fighterGrid);
    }
  });

  var fighterSelector = new FighterSelector({
    elements: {
      grid: fighterGrid,
      slotLeft: document.getElementById('slotLeft'),
      slotRight: document.getElementById('slotRight'),
      vsBadge: document.getElementById('vsBadge'),
      selectHint: document.getElementById('selectHint'),
      fightButton: document.getElementById('fightButton')
    },
    mcData: McData,
    onFight: function (choice) {
      startBattle(choice.left.nombreMC, choice.right.nombreMC, chosenFormat, null);
    }
  });

  document.getElementById('btnVolverFormato').addEventListener('click', function () {
    fighterSelector.reset();
    showScreen('Format');
    focusFirstNavItem(formatGrid);
  });

  var selectControls = document.getElementById('selectControls');

  enableGridKeyboardNav(formatGrid, { layout: 'linear' });
  enableGridKeyboardNav(fighterGrid, {
    layout: 'grid',
    onEdge: function (key) {
      if (key === 'ArrowDown') focusFirstNavItem(selectControls);
    }
  });
  enableGridKeyboardNav(selectControls, {
    layout: 'linear',
    onEdge: function (key) {
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        var fighterCards = fighterGrid.querySelectorAll('[data-nav-item]');
        if (fighterCards.length) fighterCards[fighterCards.length - 1].focus();
      }
    }
  });

  // ---------- Contador ----------
  var timerController = new TimerController({
    elements: {
      formatInfo: document.getElementById('formatInfo'),
      timeNumber: document.getElementById('countdown'),
      timeLabel: document.getElementById('timeLabel'),
      wordLabel: document.getElementById('word-label'),
      startButton: document.getElementById('btnIniciar'),
      resetButton: document.getElementById('btnReiniciar'),
      backButton: document.getElementById('btnVolver'),
      circleTimer: document.querySelector('.circle-timer'),
      progressRing: document.querySelector('.progress-ring'),
      progressCircle: document.querySelector('.progress-ring__circle')
    },
    themeWords: THEME_WORDS,
    onBack: goHome
  });

  var frameA = document.getElementById('mcAFrame');
  var frameB = document.getElementById('mcBFrame');

  var winnerScreen = new WinnerScreen({
    elements: {
      overlay: document.getElementById('winnerOverlay'),
      photo: document.getElementById('winnerPhoto'),
      fallback: document.getElementById('winnerFallback'),
      name: document.getElementById('winnerName'),
      closeButton: document.getElementById('btnCerrarGanador'),
      mcAPhoto: document.getElementById('mcAPhoto'),
      mcAFallback: document.getElementById('mcAFallback'),
      mcAName: document.getElementById('mcAName'),
      mcBPhoto: document.getElementById('mcBPhoto'),
      mcBFallback: document.getElementById('mcBFallback'),
      mcBName: document.getElementById('mcBName')
    }
  });

  // Punto único de declaración de ganador (clic manual en una foto, o KO
  // automático al llegar a 0 de vida): además de mostrar la pantalla de
  // ganador, si la batalla viene del torneo registra el resultado ahí para
  // que la siguiente ronda quede lista.
  function declareWinner(side) {
    winnerScreen.show(side);
    if (torneoContext) bracket.setWinner(torneoContext.stage, torneoContext.index, side);
  }
  frameA.addEventListener('click', function () { declareWinner('a'); });
  frameB.addEventListener('click', function () { declareWinner('b'); });

  var damageSystem = new DamageSystem({
    elements: {
      hpAFill: document.getElementById('hpAFill'),
      hpBFill: document.getElementById('hpBFill'),
      frameA: frameA,
      frameB: frameB
    },
    onDefeat: function (side) { declareWinner(side === 'a' ? 'b' : 'a'); }
  });

  var battleHUD = new BattleHUD({
    elements: {
      mcA: document.getElementById('mcA'),
      mcB: document.getElementById('mcB'),
      tagA: document.getElementById('tagA'),
      tagB: document.getElementById('tagB'),
      mcAName: document.getElementById('mcAName'),
      mcBName: document.getElementById('mcBName'),
      mcACountry: document.getElementById('mcACountry'),
      mcBCountry: document.getElementById('mcBCountry'),
      mcAPhoto: document.getElementById('mcAPhoto'),
      mcBPhoto: document.getElementById('mcBPhoto'),
      mcAFallback: document.getElementById('mcAFallback'),
      mcBFallback: document.getElementById('mcBFallback'),
      battleNum: document.getElementById('battleNum'),
      battleUp: document.getElementById('battleUp'),
      battleDown: document.getElementById('battleDown'),
      entradaField: document.getElementById('entradaField'),
      entradaNum: document.getElementById('entradaNum'),
      entradaTotal: document.getElementById('entradaTotal'),
      entradaUp: document.getElementById('entradaUp'),
      entradaDown: document.getElementById('entradaDown'),
      btnTurno: document.getElementById('btnTurno'),
      btnSiguienteBatalla: document.getElementById('btnSiguienteBatalla')
    },
    mcData: McData,
    onNextBattle: function () {
      timerController.resetTimer();
      damageSystem.reset();
      winnerScreen.hide();
    },
    onRoundReset: function () { timerController.resetTimer(); }
  });

  var golpeButton = document.getElementById('btnGolpe');
  function applyGolpe() {
    var target = battleHUD.activeSide === 'a' ? 'b' : 'a';
    damageSystem.hit(target);
  }
  golpeButton.addEventListener('click', applyGolpe);

  var screenContador = document.getElementById('screenContador');

  document.addEventListener('keydown', function (event) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (!screenContador.classList.contains('active')) return;
    if (event.key === 'g' || event.key === 'G') applyGolpe();
  });

  document.getElementById('btnReiniciar').addEventListener('click', function () {
    damageSystem.reset();
    winnerScreen.hide();
  });

  // "Réplica": el jurado pide repetir la batalla en curso, con el formato
  // estándar de réplica (4x4 libre, 120s), conservando el contexto del
  // torneo si la batalla venía de ahí.
  var revanchaFormat = Formats.find(function (f) { return f.key === 'cuatroXcuatro'; }) || chosenFormat;
  document.getElementById('btnRevancha').addEventListener('click', function () {
    var nameA = document.getElementById('mcAName').textContent;
    var nameB = document.getElementById('mcBName').textContent;
    startBattle(nameA, nameB, revanchaFormat, torneoContext);
  });

  document.addEventListener('keydown', function (event) {
    if (!screenContador.classList.contains('active')) return;
    if ((event.key === 'r' || event.key === 'R') && !document.getElementById('winnerOverlay').hidden) {
      document.getElementById('btnRevancha').click();
    }
  });

  enableGridKeyboardNav(document.getElementById('winnerOverlay'), { layout: 'linear' });
  enableGridKeyboardNav(controls, {
    layout: 'linear',
    onEdge: function (key) {
      if (key === 'ArrowUp' || key === 'ArrowLeft') focusFirstNavItem(duel);
    }
  });
  enableGridKeyboardNav(duel, {
    layout: 'linear',
    onEdge: function (key) {
      if (key === 'ArrowDown' || key === 'ArrowRight') focusFirstNavItem(controls);
    }
  });

  /**
   * Entrar al contador con una batalla nueva: coloca a los dos MC, aplica
   * el formato, reinicia vida/cronómetro/turno y muestra la pantalla.
   * @param {string} nameA
   * @param {string} nameB
   * @param {Object} format - Formato elegido (data/formats.js)
   * @param {{stage:string,index:number}|null} torneo - Contexto de torneo, o null en batalla suelta
   */
  function startBattle(nameA, nameB, format, torneo) {
    torneoContext = torneo || null;
    battleHUD.startBattle(nameA, nameB, format);
    damageSystem.reset();
    winnerScreen.hide();
    showScreen('Contador');
    // El círculo del tiempo necesita medir su ancho real en pantalla, así
    // que se recalcula recién ahora que la pantalla del contador es visible.
    timerController.updateCircleSVG();
    timerController.applyFormat(format);
    focusFirstNavItem(controls);
  }

  /** Volver del contador a donde corresponda: al torneo si la batalla venía
   * de ahí, o a la selección de formato en una batalla suelta. */
  function goHome() {
    if (torneoContext) {
      bracketView.render();
      showScreen('Torneo');
      focusFirstNavItem(bracketStages);
    } else {
      fighterSelector.reset();
      showScreen('Format');
      focusFirstNavItem(formatGrid);
    }
  }

  focusFirstNavItem(bracketStages);

  window.addEventListener('beforeunload', function () { cleanupVideos(); });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bg = document.getElementById('boltCanvas');
  if (bg) {
    createBoltRenderer(bg, {
      boltCount: 3,
      innerRatio: 0.55,
      intervalMs: 350,
      color: 'rgba(63,182,255,0.35)',
      reduceMotion: reduceMotion
    }).start();
  }

  document.querySelectorAll('.mc-frame__bolts').forEach(function (canvas) {
    createBoltRenderer(canvas, {
      boltCount: 4,
      innerRatio: 0.3,
      intervalMs: 200,
      color: 'rgba(159,228,255,0.6)',
      reduceMotion: reduceMotion
    }).start();
  });
}

document.addEventListener('DOMContentLoaded', initializeApp);
