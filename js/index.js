import { FormatPicker } from './modules/FormatPicker.js';
import { FighterSelector } from './modules/FighterSelector.js';
import { createBoltRenderer } from './utils/lightning.js';
import { cleanupVideos } from './utils/performance.js';
import McData from '../data/mcs.js';
import Formats from '../data/formats.js';

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === 'screen' + name);
  });
}

function initializeApp() {
  var chosenFormat = Formats[0];

  var formatPicker = new FormatPicker({
    cards: document.querySelectorAll('.mode-card'),
    formats: Formats,
    onSelect: function (format) {
      chosenFormat = format;
      document.getElementById('formatBadge').textContent = format.name + ' — ' + format.description.toUpperCase();
      fighterSelector.reset();
      showScreen('Select');
    }
  });

  var fighterSelector = new FighterSelector({
    elements: {
      grid: document.getElementById('fighterGrid'),
      slotLeft: document.getElementById('slotLeft'),
      slotRight: document.getElementById('slotRight'),
      vsBadge: document.getElementById('vsBadge'),
      selectHint: document.getElementById('selectHint'),
      fightButton: document.getElementById('fightButton')
    },
    mcData: McData,
    onFight: function (choice) {
      var params = new URLSearchParams({
        formato: chosenFormat.key,
        nombreA: choice.left.nombreMC,
        nombreB: choice.right.nombreMC
      });
      window.location.href = 'contador.html?' + params.toString();
    }
  });

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
}

document.addEventListener('DOMContentLoaded', initializeApp);
