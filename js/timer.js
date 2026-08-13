import { TimerController } from './modules/TimerController.js';
import { BattleHUD } from './modules/BattleHUD.js';
import { createBoltRenderer } from './utils/lightning.js';
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
    onNextBattle: () => timerController.resetTimer(),
    onRoundReset: () => timerController.resetTimer()
  });

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
