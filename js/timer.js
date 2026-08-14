import { TimerController } from './modules/TimerController.js';
import { BattleHUD } from './modules/BattleHUD.js';
import { DamageSystem } from './modules/DamageSystem.js';
import { WinnerScreen } from './modules/WinnerScreen.js';
import { createBoltRenderer } from './utils/lightning.js';
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

/**
 * Inicializar la aplicación de temporizador
 */
function initializeTimer() {
  // Recuperar parámetros de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const formatKey = urlParams.get('formato') || Formats[0].key;
  const format = Formats.find((f) => f.key === formatKey) || Formats[0];

  // Elementos del DOM
  const elements = {
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
  };

  // Inicializar el controlador del temporizador
  const timerController = new TimerController({
    elements,
    initialTime: format.time,
    formatName: format.name,
    mode: format.mode,
    themeWords: THEME_WORDS
  });

  const frameA = document.getElementById('mcAFrame');
  const frameB = document.getElementById('mcBFrame');

  // Inicializar la barra de vida y el efecto de golpe de cada MC
  const damageSystem = new DamageSystem({
    elements: {
      hpAFill: document.getElementById('hpAFill'),
      hpBFill: document.getElementById('hpBFill'),
      frameA,
      frameB
    }
  });

  // Inicializar el panel de batalla (nombres/fotos de MC, turno, batalla, entrada)
  const battleHUD = new BattleHUD({
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
    format,
    onNextBattle: () => {
      timerController.resetTimer();
      damageSystem.reset();
    },
    onRoundReset: () => timerController.resetTimer()
  });

  // Botón de golpe: le resta vida y aplica el efecto visual al MC que NO
  // tiene el turno (el que está recibiendo la barra del que rapea).
  const golpeButton = document.getElementById('btnGolpe');
  const applyGolpe = () => {
    const target = battleHUD.activeSide === 'a' ? 'b' : 'a';
    damageSystem.hit(target);
  };
  golpeButton.addEventListener('click', applyGolpe);

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.key === 'g' || event.key === 'G') applyGolpe();
  });

  // "Reiniciar" reinicia todo el estado de la batalla en curso: el
  // cronómetro y también la vida/efectos de daño de ambos MC.
  document.getElementById('btnReiniciar').addEventListener('click', () => {
    damageSystem.reset();
  });

  // Pantalla de ganador: Enter (o click) sobre la foto de un MC muestra
  // solo su retrato en grande.
  const winnerScreen = new WinnerScreen({
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
  frameA.addEventListener('click', () => winnerScreen.show('a'));
  frameB.addEventListener('click', () => winnerScreen.show('b'));

  const controls = document.getElementById('controls');
  const duel = document.querySelector('.duel');
  enableGridKeyboardNav(controls, {
    layout: 'linear',
    onEdge: (key) => {
      if (key === 'ArrowUp' || key === 'ArrowLeft') focusFirstNavItem(duel);
    }
  });
  enableGridKeyboardNav(duel, {
    layout: 'linear',
    onEdge: (key) => {
      if (key === 'ArrowDown' || key === 'ArrowRight') focusFirstNavItem(controls);
    }
  });
  focusFirstNavItem(controls);

  initLightning();
}

/**
 * Iniciar los rayos animados: uno de fondo y uno por cada marco de foto de MC
 */
function initLightning() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bgCanvas = document.getElementById('boltCanvas');
  if (bgCanvas) {
    createBoltRenderer(bgCanvas, {
      boltCount: 3,
      innerRatio: 0.55,
      intervalMs: 350,
      color: 'rgba(63,182,255,0.35)',
      reduceMotion
    }).start();
  }

  document.querySelectorAll('.mc-frame__bolts').forEach((canvas) => {
    createBoltRenderer(canvas, {
      boltCount: 4,
      innerRatio: 0.3,
      intervalMs: 200,
      color: 'rgba(159,228,255,0.6)',
      reduceMotion
    }).start();
  });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeTimer);
