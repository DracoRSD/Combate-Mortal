import { CMFX } from '../vendor/cmfx.js';
import { CMFX_ASSETS } from '../vendor/cmfx-assets.js';

/**
 * Puente entre la pantalla de batalla y el kit de efectos CMFX
 * (js/vendor/cmfx.js, copiado tal cual). No toca la lógica: todo lo deduce
 * observando el DOM que ya actualizan TimerController / BattleHUD /
 * DamageSystem (atributo `disabled` de Iniciar, texto del contador, clases
 * `is-active` / `is-hit`, ancho y clases de la barra de vida) y llama a la
 * API del kit (fx.start / turn / hit / zero / reset / toggle, core.set).
 *
 * El kit se inicializa al entrar a la pantalla de batalla y se destruye al
 * salir. Tecla F: fx.toggle() (efectos de ambiente).
 */
const IDLE_MS = 3000;
const BOLTS = [
  { src: CMFX_ASSETS.fino, kind: 'near', top: [0.34, 0.05], tip: [0.551, 0.975] },
  { src: CMFX_ASSETS.ramificado, kind: 'sky', top: [0.717, 0], tip: [0.40, 0.916] },
  { src: CMFX_ASSETS.nube, kind: 'far', top: [0.577, 0.03], tip: [0.397, 0.88] }
];
const FLAG_RE = /[\u{1F1E6}-\u{1F1FF}]/gu;

function sideOf(id) {
  return id.indexOf('A') !== -1 ? 'left' : 'right';
}

function init() {
  const screen = document.getElementById('screenContador');
  if (!screen) return;

  const cards = { left: document.querySelector('#mcA .mc-card'), right: document.querySelector('#mcB .mc-card') };
  const coreEl = document.getElementById('battleCore');
  const startButton = document.getElementById('btnIniciar');
  const countdown = document.getElementById('countdown');
  const timeLabel = document.getElementById('timeLabel');
  const mcA = document.getElementById('mcA');

  let fx = null;
  let core = null;
  let pending = null;
  let active = screen.classList.contains('active');
  let running = startButton.disabled;
  let total = 0;
  let elapsed = 0;
  let zeroAt = -Infinity;
  let mountedAt = 0;

  const turnSide = () => (mcA.classList.contains('is-active') ? 'left' : 'right');

  function readTime() {
    const text = countdown.textContent.trim();
    if (/^\d+$/.test(text)) return { seconds: parseInt(text, 10), stopwatch: false };
    const m = text.match(/^(\d+):(\d\d)$/);
    if (m) return { seconds: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), stopwatch: true };
    return null;
  }

  /* Vuelca el tiempo del DOM al núcleo. En modo cronómetro (Fatality) el
     núcleo no tiene total: se muestra el tiempo transcurrido m:ss. */
  function pushTime() {
    if (!core) return;
    const t = readTime();
    if (!t) return;
    const num = coreEl.querySelector('.cmfx-core__num');
    const lab = coreEl.querySelector('.cmfx-core__lab');
    if (t.stopwatch) {
      elapsed = t.seconds;
      core.set(elapsed, 0, running);
      if (num) num.textContent = countdown.textContent.trim();
      if (lab) lab.textContent = 'transcurrido';
      return;
    }
    if (!running) total = Math.max(t.seconds, 1);
    core.set(t.seconds, total, running);
    if (lab) lab.textContent = (timeLabel && timeLabel.textContent.trim().toLowerCase()) || 'segundos';
  }

  function groundY() {
    const card = cards.left || cards.right;
    if (!card) return 0.8;
    const r = card.getBoundingClientRect();
    const b = screen.getBoundingClientRect();
    return Math.min(0.95, Math.max(0.4, (r.bottom - b.top) / (b.height || 1)));
  }

  async function mount() {
    if (fx || pending) return;
    pending = CMFX.init({
      root: screen,
      bg: CMFX_ASSETS.bg,
      groundY: groundY(),
      els: { left: cards.left, right: cards.right, timer: coreEl },
      bolts: BOLTS,
      turn: turnSide()
    });
    const api = await pending;
    pending = null;
    if (!screen.classList.contains('active')) { api.destroy(); return; }
    fx = api;
    core = fx.core(coreEl);
    fx.setTurn(turnSide());
    mountedAt = performance.now();
    pushTime();
  }

  function unmount() {
    if (fx) { fx.reset(); fx.destroy(); }
    fx = null;
    core = null;
    coreEl.classList.remove('cmfx-core');
    coreEl.innerHTML = '';
  }

  new MutationObserver(() => {
    const now = screen.classList.contains('active');
    if (now === active) return;
    active = now;
    if (active) { wake(); mount(); } else { unmount(); }
  }).observe(screen, { attributes: true, attributeFilter: ['class'] });

  // ---- Cronómetro: iniciar / reiniciar / llegar a 0 ----
  new MutationObserver(() => {
    const disabled = startButton.disabled;
    if (disabled === running) return;
    running = disabled;
    if (!fx) return;
    if (running) {
      fx.start();
    } else {
      // Un reinicio justo después del 0 (paso automático de entrada) deja
      // que termine la descarga en vez de cortarla.
      if (performance.now() - zeroAt > 400) fx.reset();
    }
    pushTime();
  }).observe(startButton, { attributes: true, attributeFilter: ['disabled'] });

  new MutationObserver(() => {
    if (!core) return;
    const t = readTime();
    if (!t) return;
    if (running && !t.stopwatch && t.seconds <= 0) {
      core.set(0, total, false);
      fx.zero();
      zeroAt = performance.now();
      return;
    }
    pushTime();
  }).observe(countdown, { childList: true, characterData: true, subtree: true });

  // ---- Turno: el lado que lo recibe ----
  let lastTurn = turnSide();
  new MutationObserver(() => {
    const side = turnSide();
    if (side === lastTurn) return;
    lastTurn = side;
    if (!fx) return;
    // El turno inicial de una batalla nueva llega junto con la activación
    // de la pantalla: se fija sin rayo.
    if (performance.now() - mountedAt < 150) fx.setTurn(side); else fx.turn(side);
  }).observe(mcA, { attributes: true, attributeFilter: ['class'] });

  // ---- Golpe: la tarjeta que lo recibe ----
  ['mcAFrame', 'mcBFrame'].forEach((id) => {
    const frame = document.getElementById(id);
    let wasHit = frame.classList.contains('is-hit');
    new MutationObserver(() => {
      const hit = frame.classList.contains('is-hit');
      if (hit === wasHit) return;
      wasHit = hit;
      if (hit && fx) fx.hit(sideOf(id));
    }).observe(frame, { attributes: true, attributeFilter: ['class'] });
  });

  // ---- Barras de vida: espejo de la barra que gestiona DamageSystem ----
  ['hpAFill', 'hpBFill'].forEach((id) => {
    const fill = document.getElementById(id);
    const bar = document.getElementById(id.replace('Fill', 'Cmfx'));
    const sync = () => {
      const pct = parseFloat(fill.style.width);
      if (isNaN(pct)) return;
      bar.style.setProperty('--hp', (pct / 100).toFixed(3));
      bar.classList.toggle('is-warn', pct <= 50 && pct > 25);
      bar.classList.toggle('is-crit', pct <= 25);
    };
    new MutationObserver(sync).observe(fill, { attributes: true, attributeFilter: ['style', 'class'] });
    sync();
  });

  // ---- "Desde ..." sin bandera (en algunas pantallas la bandera se ve
  // como las letras CL / DO) ----
  ['mcACountry', 'mcBCountry'].forEach((id) => {
    const el = document.getElementById(id);
    const clean = () => {
      const text = el.textContent;
      const next = text.replace(FLAG_RE, '').replace(/\s+/g, ' ').trim();
      if (next !== text) el.textContent = next;
    };
    new MutationObserver(clean).observe(el, { childList: true, characterData: true, subtree: true });
    clean();
  });

  // ---- Controles y leyenda: sólo al mover el ratón, 3 s ----
  let idleTimer = null;
  function wake() {
    screen.classList.remove('is-idle');
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => screen.classList.add('is-idle'), IDLE_MS);
  }
  screen.classList.add('is-idle');
  document.addEventListener('mousemove', wake, { passive: true });
  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (event.key.startsWith('Arrow')) { wake(); return; }
    if (event.key !== 'f' && event.key !== 'F') return;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (fx) fx.toggle();
  });

  if (active) { wake(); mount(); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
