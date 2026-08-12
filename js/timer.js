import { TimerController } from './modules/TimerController.js';
import { BattleHUD } from './modules/BattleHUD.js';
import { createBoltRenderer } from './utils/lightning.js';
import McData from '../data/mcs.js';

// Datos temáticos
const THEME_WORDS = [
  'Venganza', 'Envidia', 'Lealtad', 'Ego', 'Traicion',
  'Orgullo', 'Dominio', 'Respeto'
];

// Mapeo de formatos a nombres
const FORMAT_NAMES = {
  'minutoLibre': 'MINUTO LIBRE',
  'tematica': 'TEMÁTICA',
  'minutosLibre': 'MINUTOS LIBRE'
};

/**
 * Inicializar la aplicación de temporizador
 */
function initializeTimer() {
  // Recuperar parámetros de la URL
  const urlParams = new URLSearchParams(window.location.search);

  // Valores predeterminados
  let initialTime = 60;
  let currentFormat = "minutoLibre";
  let formatName = "MINUTO LIBRE";

  // Obtener valores de parámetros
  if (urlParams.has('formato')) currentFormat = urlParams.get('formato');
  if (urlParams.has('tiempo')) initialTime = parseInt(urlParams.get('tiempo'));

  // Obtener nombre de formato
  if (FORMAT_NAMES[currentFormat]) {
    formatName = FORMAT_NAMES[currentFormat];
  }

  // Elementos del DOM
  const elements = {
    formatInfo: document.getElementById('formatInfo'),
    timeNumber: document.getElementById('countdown'),
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
    initialTime,
    formatName,
    themeWords: THEME_WORDS
  });

  // Inicializar el panel de batalla (nombres/fotos de MC, turno, batalla)
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
      btnTurno: document.getElementById('btnTurno'),
      btnSiguienteBatalla: document.getElementById('btnSiguienteBatalla')
    },
    mcData: McData,
    onNextBattle: () => timerController.resetTimer()
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