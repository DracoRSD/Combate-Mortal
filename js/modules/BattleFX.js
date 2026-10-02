/**
 * Capa de efectos cinematográficos de la pantalla de batalla. No toca la
 * lógica: todo lo que hace lo deduce observando el DOM que ya actualizan
 * TimerController / BattleHUD / DamageSystem (atributo `disabled` del botón
 * Iniciar, texto del contador, clases `is-active` / `is-hit`, ancho de la
 * barra de vida), y sólo añade elementos decorativos y clases de estado
 * visual (`is-running`, `is-critical`, `is-done`, `is-idle`, `fx-off`).
 *
 * Tecla F: activa/desactiva los efectos ambientales (rayos aleatorios,
 * partículas, niebla, zoom del fondo). Los efectos ligados a la batalla
 * (rayo al iniciar/cambiar turno/llegar a 0, chispas y estela del golpe)
 * siguen funcionando.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const AMBIENT_MIN_MS = 4000;
const AMBIENT_MAX_MS = 9000;
const PARTICLE_COUNT = 50;
const IDLE_MS = 5000;

function svgEl(name) {
  return document.createElementNS(SVG_NS, name);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/* ---------- Rayos ---------- */

/**
 * Imágenes de rayos sobre fondo negro (WebP ~1024 px de alto, como data
 * URI). Se dibujan con mix-blend-mode: screen, así que sólo se ve el rayo.
 * Mientras la lista esté vacía se generan rayos procedurales en SVG con el
 * mismo comportamiento (revelado, parpadeo, vibración, resplandor).
 */
const LIGHTNING_IMAGES = [];

const BOLT_REVEAL_MS = 75;
const BOLT_FLICKER_MS = 350;
const BOLT_AFTERGLOW_MS = 400;
const BOLT_TOTAL_MS = BOLT_REVEAL_MS + BOLT_FLICKER_MS + BOLT_AFTERGLOW_MS;

function displace(x0, y0, x1, y1, amount) {
  let pts = [[x0, y0], [x1, y1]];
  let disp = amount;
  for (let pass = 0; pass < 5; pass++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      next.push([(ax + bx) / 2 + (Math.random() - 0.5) * disp, (ay + by) / 2 + (Math.random() - 0.5) * disp * 0.5], [bx, by]);
    }
    pts = next;
    disp *= 0.55;
  }
  return pts;
}

function pathOf(pts) {
  return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
}

/** Rayo procedural en un lienzo de 400×1000 (misma caja que una imagen). */
function proceduralBolt(strong) {
  const x0 = 200 + rand(-60, 60);
  const main = displace(x0, 0, x0 + rand(-120, 120), 1000, 260);
  const paths = [pathOf(main)];
  const branches = 2 + Math.floor(Math.random() * 3);
  for (let b = 0; b < branches; b++) {
    const at = main[Math.floor(main.length * rand(0.15, 0.8))];
    const len = rand(150, 380);
    const dir = Math.random() < 0.5 ? -1 : 1;
    paths.push(pathOf(displace(at[0], at[1], at[0] + dir * len * rand(0.4, 1), at[1] + len * rand(0.5, 1), len * 0.4)));
  }
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', '0 0 400 1000');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'battle-bolt__shape');
  paths.forEach((d, i) => {
    const scale = i === 0 ? 1 : 0.6;
    [['battle-bolt__halo', 18], ['battle-bolt__glow', 7], ['battle-bolt__core', strong ? 3.2 : 2.2]].forEach(([cls, width]) => {
      const p = svgEl('path');
      p.setAttribute('d', d);
      p.setAttribute('class', cls);
      p.setAttribute('stroke-width', (width * scale).toFixed(1));
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(p);
    });
  });
  return svg;
}

function imageBolt(src) {
  const img = document.createElement('img');
  img.className = 'battle-bolt__shape battle-bolt__shape--img';
  img.src = src;
  img.alt = '';
  img.draggable = false;
  return img;
}

class Lightning {
  constructor(layer, flash, screen) {
    this.layer = layer;
    this.flash = flash;
    this.screen = screen;
    this.timer = null;
    this.lastStrong = 0;
  }

  shape(strong, avoid) {
    if (!LIGHTNING_IMAGES.length) return { el: proceduralBolt(strong), key: Math.random() };
    let key = Math.floor(Math.random() * LIGHTNING_IMAGES.length);
    if (LIGHTNING_IMAGES.length > 1 && key === avoid) key = (key + 1) % LIGHTNING_IMAGES.length;
    return { el: imageBolt(LIGHTNING_IMAGES[key]), key };
  }

  /**
   * Un rayo en la posición dada: se revela de arriba abajo con clip-path,
   * parpadea irregularmente (vibrando unos píxeles entre parpadeos), y deja
   * un resplandor residual que se apaga. `phase` 'a'/'b' alterna la
   * visibilidad entre dos formas en el mismo sitio (rayo fuerte).
   */
  spawn({ xPct, heightPct, flip, strong, phase, avoid }) {
    const { el, key } = this.shape(strong, avoid);
    const bolt = document.createElement('div');
    bolt.className = 'battle-bolt' + (strong ? ' battle-bolt--strong' : '') + (phase ? ' battle-bolt--' + phase : '');
    bolt.style.left = xPct + '%';
    bolt.style.height = heightPct + 'vh';
    bolt.style.setProperty('--flip', flip ? '-1' : '1');
    bolt.style.setProperty('--jx', (rand(2, 4) * (Math.random() < 0.5 ? -1 : 1)).toFixed(1) + 'px');
    bolt.style.setProperty('--jy', (rand(2, 4) * (Math.random() < 0.5 ? -1 : 1)).toFixed(1) + 'px');
    bolt.appendChild(el);
    this.layer.appendChild(bolt);
    setTimeout(() => bolt.remove(), BOLT_TOTAL_MS + 100);
    return key;
  }

  /** Luz breve sobre el borde de las tarjetas y el suelo. */
  light() {
    this.screen.classList.remove('is-lit');
    void this.screen.offsetWidth;
    this.screen.classList.add('is-lit');
  }

  /* Las tarjetas ocupan los laterales (≈0-28 % y 72-100 % del ancho) y los
     rayos van detrás de ellas, así que casi siempre caen por la columna
     central y, a veces, por los bordes exteriores. */
  ambientX() {
    const r = Math.random();
    if (r < 0.7) return rand(28, 60);
    return r < 0.85 ? rand(-2, 8) : rand(84, 94);
  }

  ambient() {
    this.spawn({ xPct: this.ambientX(), heightPct: rand(60, 100), flip: Math.random() < 0.5, strong: false });
    this.flash.fire('is-flash');
    this.light();
  }

  /**
   * Rayo fuerte: dos formas distintas en la misma posición alternando
   * durante el parpadeo (el rayo "cambia de forma"), y otro en el lado
   * opuesto, con destello de pantalla al 20 % (más al llegar a 0).
   */
  strong(level) {
    // Varios eventos pueden encadenarse en el mismo instante (fin de
    // entrada → cambio de turno → arranque); un solo rayo fuerte basta.
    const now = performance.now();
    if (level !== 'final' && now - this.lastStrong < 300) return;
    this.lastStrong = now;

    const x = Math.random() < 0.5 ? rand(30, 42) : rand(54, 66);
    const flip = Math.random() < 0.5;
    const first = this.spawn({ xPct: x, heightPct: rand(85, 100), flip, strong: true, phase: 'a' });
    this.spawn({ xPct: x, heightPct: rand(85, 100), flip, strong: true, phase: 'b', avoid: first });
    setTimeout(() => {
      this.spawn({ xPct: 96 - x, heightPct: rand(60, 90), flip: !flip, strong: true });
    }, 90);
    this.flash.fire(level === 'final' ? 'is-flash-final' : 'is-flash-strong');
    this.light();
  }

  startAmbient() {
    this.stopAmbient();
    const tick = () => {
      this.ambient();
      this.timer = setTimeout(tick, rand(AMBIENT_MIN_MS, AMBIENT_MAX_MS));
    };
    this.timer = setTimeout(tick, rand(1200, 3500));
  }

  stopAmbient() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  clear() {
    this.layer.innerHTML = '';
  }
}

class Flash {
  constructor(el) {
    this.el = el;
  }

  fire(cls) {
    this.el.classList.remove('is-flash', 'is-flash-strong', 'is-flash-final');
    void this.el.offsetWidth;
    this.el.classList.add(cls);
  }
}

/* ---------- Partículas y chispas (canvas) ---------- */

class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.ambient = [];
    this.sparks = [];
    this.ambientOn = false;
    this.raf = null;
    this.last = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  seed() {
    this.ambient = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) this.ambient.push(this.makeDot(true));
  }

  makeDot(anywhere) {
    const soft = Math.random() < 0.3;
    return {
      x: rand(0, this.w),
      y: anywhere ? rand(0, this.h) : this.h + 10,
      r: soft ? rand(4, 9) : rand(1, 3),
      soft,
      vy: rand(8, 26),
      drift: rand(0.4, 1.6),
      phase: rand(0, Math.PI * 2),
      alpha: soft ? rand(0.12, 0.3) : rand(0.45, 0.95),
      twinkle: rand(0.8, 2.4)
    };
  }

  setAmbient(on) {
    this.ambientOn = on;
    if (on && !this.ambient.length) this.seed();
    this.ensureLoop();
  }

  burst(x, y, dirX) {
    for (let i = 0; i < 28; i++) {
      const angle = rand(-1.3, 1.3) + (dirX > 0 ? 0 : Math.PI);
      const speed = rand(140, 520);
      this.sparks.push({
        x: x + rand(-8, 8),
        y: y + rand(-30, 30),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(60, 220),
        life: rand(0.35, 0.8),
        age: 0,
        r: rand(1, 2.6),
        white: Math.random() < 0.5
      });
    }
    this.ensureLoop();
  }

  ensureLoop() {
    if (this.raf || (!this.ambientOn && !this.sparks.length)) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    if (this.ambientOn) {
      const t = now / 1000;
      for (let i = 0; i < this.ambient.length; i++) {
        const p = this.ambient[i];
        p.y -= p.vy * dt;
        p.x += Math.sin(t * p.drift + p.phase) * 10 * dt;
        if (p.y < -12) this.ambient[i] = this.makeDot(false);
        const a = p.alpha * (0.7 + 0.3 * Math.sin(t * p.twinkle + p.phase));
        if (p.soft) {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(0, 'rgba(127,208,255,' + a.toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(30,144,255,0)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(234,246,255,' + a.toFixed(3) + ')';
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age >= s.life) { this.sparks.splice(i, 1); continue; }
      s.vy += 700 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = 1 - s.age / s.life;
      ctx.strokeStyle = s.white ? 'rgba(234,246,255,' + k.toFixed(3) + ')' : 'rgba(127,208,255,' + k.toFixed(3) + ')';
      ctx.lineWidth = s.r;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.stroke();
    }

    this.raf = null;
    this.ensureLoop();
  }
}

/* ---------- Extras del anillo del tiempo ---------- */

class TimerRing {
  constructor(circleTimer) {
    this.root = circleTimer;
    this.ring = circleTimer.querySelector('.progress-ring');
    this.circle = circleTimer.querySelector('.progress-ring__circle');

    const ticks = svgEl('svg');
    ticks.setAttribute('class', 'timer-ticks');
    ticks.setAttribute('viewBox', '0 0 200 200');
    for (let i = 0; i < 60; i++) {
      const line = svgEl('line');
      const major = i % 5 === 0;
      line.setAttribute('x1', '100'); line.setAttribute('y1', major ? '2' : '4');
      line.setAttribute('x2', '100'); line.setAttribute('y2', major ? '9' : '8');
      line.setAttribute('transform', 'rotate(' + i * 6 + ' 100 100)');
      if (major) line.setAttribute('class', 'is-major');
      ticks.appendChild(line);
    }
    circleTimer.insertBefore(ticks, this.ring);

    this.track = svgEl('circle');
    this.track.setAttribute('class', 'progress-ring__track');
    this.glow = svgEl('circle');
    this.glow.setAttribute('class', 'progress-ring__glow');
    this.ring.insertBefore(this.track, this.circle);
    this.ring.insertBefore(this.glow, this.circle);

    this.tip = document.createElement('div');
    this.tip.className = 'timer-tip';
    circleTimer.appendChild(this.tip);

    const arcs = document.createElement('div');
    arcs.className = 'timer-arcs';
    for (let i = 0; i < 3; i++) {
      const arc = document.createElement('span');
      arc.className = 'timer-arc';
      arc.style.setProperty('--i', String(i));
      arcs.appendChild(arc);
    }
    circleTimer.appendChild(arcs);

    new MutationObserver(() => this.sync()).observe(this.circle, { attributes: true, attributeFilter: ['r', 'cx', 'cy', 'style'] });
    this.sync();
  }

  sync() {
    ['r', 'cx', 'cy'].forEach((attr) => {
      const v = this.circle.getAttribute(attr);
      if (v == null) return;
      this.track.setAttribute(attr, v);
      this.glow.setAttribute(attr, v);
    });
    const dasharray = this.circle.style.strokeDasharray || this.circle.getAttribute('stroke-dasharray') || '';
    const dashoffset = this.circle.style.strokeDashoffset || this.circle.getAttribute('stroke-dashoffset') || '';
    this.glow.style.strokeDasharray = dasharray;
    this.glow.style.strokeDashoffset = dashoffset;

    // Si el SVG escala por viewBox (en vez de medirse en px), el radio del
    // círculo hay que pasarlo a px de pantalla para colocar la punta.
    const viewBox = this.ring.getAttribute('viewBox');
    const vbWidth = viewBox ? parseFloat(viewBox.split(/\s+/)[2]) : 0;
    const scale = vbWidth ? this.ring.clientWidth / vbWidth : 1;
    const r = (parseFloat(this.circle.getAttribute('r')) || 0) * scale;
    const circ = parseFloat(dasharray) || 0;
    const offset = parseFloat(dashoffset) || 0;
    const pct = circ ? Math.max(0, Math.min(1, 1 - offset / circ)) : 1;
    this.tip.style.transform = 'rotate(' + (pct * 360 - 90).toFixed(2) + 'deg) translateX(' + r.toFixed(1) + 'px)';
    this.tip.classList.toggle('is-hidden', pct <= 0.002);
  }
}

/* ---------- Orquestación ---------- */

function init() {
  const screen = document.getElementById('screenContador');
  if (!screen) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flash = new Flash(document.getElementById('battleFlash'));
  const lightning = new Lightning(document.getElementById('battleLightning'), flash, screen);
  const particles = new Particles(document.getElementById('battleParticles'));
  const circleTimer = screen.querySelector('.circle-timer');
  new TimerRing(circleTimer);

  let fxOff = false;
  let active = screen.classList.contains('active');

  function ambientShouldRun() {
    return active && !fxOff && !reduceMotion;
  }

  function syncAmbient() {
    document.body.classList.toggle('fx-off', fxOff);
    if (ambientShouldRun()) {
      lightning.startAmbient();
      particles.setAmbient(true);
    } else {
      lightning.stopAmbient();
      particles.setAmbient(false);
      if (!active) { particles.stop(); lightning.clear(); }
    }
  }

  let activatedAt = 0;
  new MutationObserver(() => {
    const now = screen.classList.contains('active');
    if (now === active) return;
    active = now;
    if (active) { activatedAt = performance.now(); wake(); }
    syncAmbient();
  }).observe(screen, { attributes: true, attributeFilter: ['class'] });

  // Las mutaciones de una misma acción (colocar a los MC y mostrar la
  // pantalla) llegan juntas; el turno inicial de una batalla nueva no es un
  // "cambio de turno" y no debe disparar rayo.
  function justActivated() {
    return performance.now() - activatedAt < 100;
  }

  // ---- Cronómetro: arranque, últimos 10 s, llegada a 0 ----
  const startButton = document.getElementById('btnIniciar');
  const countdown = document.getElementById('countdown');
  let running = false;

  function readSeconds() {
    const text = countdown.textContent.trim();
    return /^\d+$/.test(text) ? parseInt(text, 10) : null;
  }

  function onStart() {
    running = true;
    circleTimer.classList.add('is-running');
    circleTimer.classList.remove('is-done');
    const s = readSeconds();
    circleTimer.classList.toggle('is-critical', s !== null && s > 0 && s <= 10);
    if (active) lightning.strong('strong');
  }

  function onStop() {
    running = false;
    circleTimer.classList.remove('is-running', 'is-critical', 'is-done');
  }

  function onTimeUp() {
    running = false;
    circleTimer.classList.remove('is-running', 'is-critical');
    circleTimer.classList.add('is-done');
    if (active) lightning.strong('final');
  }

  let wasDisabled = startButton.disabled;
  new MutationObserver(() => {
    const disabled = startButton.disabled;
    if (disabled === wasDisabled) return;
    wasDisabled = disabled;
    if (disabled) onStart(); else onStop();
  }).observe(startButton, { attributes: true, attributeFilter: ['disabled'] });

  new MutationObserver(() => {
    if (!running) return;
    const s = readSeconds();
    if (s === null) return;
    if (s <= 0) onTimeUp();
    else circleTimer.classList.toggle('is-critical', s <= 10);
  }).observe(countdown, { childList: true, characterData: true, subtree: true });

  // ---- Cambio de turno ----
  const mcA = document.getElementById('mcA');
  let lastTurn = mcA.classList.contains('is-active');
  new MutationObserver(() => {
    const turn = mcA.classList.contains('is-active');
    if (turn === lastTurn) return;
    lastTurn = turn;
    if (active && !justActivated()) lightning.strong('strong');
  }).observe(mcA, { attributes: true, attributeFilter: ['class'] });

  // ---- Golpe: chispas al destellar la tarjeta ----
  ['mcAFrame', 'mcBFrame'].forEach((id, index) => {
    const frame = document.getElementById(id);
    let wasHit = frame.classList.contains('is-hit');
    new MutationObserver(() => {
      const hit = frame.classList.contains('is-hit');
      if (hit === wasHit) return;
      wasHit = hit;
      if (!hit || !active) return;
      const rect = frame.getBoundingClientRect();
      const towardCenter = index === 0 ? 1 : -1;
      const x = towardCenter > 0 ? rect.right : rect.left;
      particles.burst(x, rect.top + rect.height * 0.45, towardCenter);
    }).observe(frame, { attributes: true, attributeFilter: ['class'] });
  });

  // ---- Barra de vida: estela blanca al bajar ----
  ['hpAFill', 'hpBFill'].forEach((id) => {
    const fill = document.getElementById(id);
    const bar = fill.parentElement;
    let last = parseFloat(fill.style.width) || 100;
    new MutationObserver(() => {
      const next = parseFloat(fill.style.width);
      if (isNaN(next)) return;
      if (next < last) {
        const trail = document.createElement('div');
        trail.className = 'hp-bar__trail';
        trail.style.width = (last - next) + '%';
        trail.style[id === 'hpAFill' ? 'left' : 'right'] = next + '%';
        bar.appendChild(trail);
        setTimeout(() => trail.remove(), 700);
      }
      last = next;
    }).observe(fill, { attributes: true, attributeFilter: ['style'] });
  });

  // ---- Controles que se esconden sin actividad ----
  let idleTimer = null;
  function wake() {
    screen.classList.remove('is-idle');
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => screen.classList.add('is-idle'), IDLE_MS);
  }
  document.addEventListener('mousemove', wake, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'f' && event.key !== 'F') { wake(); return; }
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    fxOff = !fxOff;
    syncAmbient();
  });

  if (active) wake();
  syncAmbient();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
