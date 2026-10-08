/* ============================================================================
   KIT CMFX · MOTOR  (copiar tal cual a la app)
   API:
     const fx = await CMFX.init({ root, bg, bolts, els:{left,right,timer}, groundY, turn });
        root      contenedor de la pantalla de batalla (el kit inserta dentro su lienzo de fondo, detrás de todo)
        bg        URL o data URI del fondo (sin rayos pintados)
        bolts     [{src, kind:'near'|'sky'|'far', top:[u,v], tip:[u,v]}]  imágenes de rayos sobre negro puro
        els       left/right = elemento de cada tarjeta; timer = elemento donde va el contador
        groundY   altura del suelo, 0..1 del alto del contenedor (donde "pisan" las tarjetas)
     const core = fx.core(elementoDelContador);   // construye el núcleo de energía dentro de ese elemento
     core.set(segundosRestantes, segundosTotales, corriendo);   // llamar cada vez que cambie el tiempo (o en cada cuadro)
     fx.start();                // al iniciar o reanudar   -> rayo que cae sobre el anillo y lo enciende
     fx.turn('left'|'right');   // al cambiar el turno     -> marca la tarjeta y le cae un rayo encima
     fx.setTurn('left'|'right');// igual, pero sin rayo (estado inicial o al restaurar)
     fx.hit('left'|'right');    // tarjeta que RECIBE el golpe -> chispas, destello y vibración
     fx.zero();                 // cuando el tiempo llega a 0 -> tres rayos, onda de choque y sacudida
     fx.reset();                // al reiniciar
     fx.strike();               // rayo cercano manual
     fx.toggle();               // tecla F: apaga/enciende los efectos de ambiente
   ============================================================================ */
const CMFX = (() => {
  "use strict";
  const TAU = Math.PI * 2;
  const R = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const outCubic = t => 1 - Math.pow(1 - t, 3);
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

  function glowSprite(s, rgb) {
    const c = mk(s, s), g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.22, `rgba(${rgb},.55)`);
    gr.addColorStop(.58, `rgba(${rgb},.13)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, s, s); return c;
  }
  const SPR = { blue: glowSprite(160, '64,156,255'), white: glowSprite(96, '226,243,255'), red: glowSprite(160, '255,92,36'), dust: glowSprite(48, '150,205,255') };

  /* --- rayo fractal: desplazamiento del punto medio --- */
  function fract(pts, levels, off) {
    for (let l = 0; l < levels; l++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, o = (Math.random() * 2 - 1) * off;
        out.push([(p[0] + q[0]) / 2 - dy / len * o, (p[1] + q[1]) / 2 + dx / len * o], q);
      }
      pts = out; off *= .52;
    }
    return pts;
  }
  function pathPart(g, pts, a, b) {           // traza el tramo [a,b] (0..1) de una polilínea
    const n = pts.length - 1, fa = a * n, fb = b * n; if (fb - fa < 1e-4) return false;
    const i0 = Math.min(n - 1, Math.floor(fa)), i1 = Math.min(n, Math.max(i0 + 1, Math.ceil(fb)));
    let p = pts[i0], q = pts[i0 + 1], f = fa - i0;
    g.beginPath(); g.moveTo(lerp(p[0], q[0], f), lerp(p[1], q[1], f));
    for (let i = i0 + 1; i < i1; i++) g.lineTo(pts[i][0], pts[i][1]);
    p = pts[i1 - 1]; q = pts[i1]; f = clamp(fb - (i1 - 1));
    g.lineTo(lerp(p[0], q[0], f), lerp(p[1], q[1], f)); return true;
  }
  /* cuatro pasadas aditivas: resplandor ancho, cuerpo, borde claro y núcleo blanco */
  const PASS = [[46, '24,96,255', .085], [22, '36,124,255', .16], [10, '70,160,255', .30], [5.2, '150,212,255', .62], [2.3, '244,251,255', 1]];
  function strokeBolt(g, w, I) {
    for (const [lw, rgb, a] of PASS) { g.lineWidth = lw * w; g.strokeStyle = `rgba(${rgb},${a})`; g.globalAlpha = clamp(I); g.stroke(); }
  }
  /* brillo de un rayo fotográfico: guía tenue -> descarga -> dos o tres redescargas -> resplandor residual */
  const ENV = [[0, 0], [70, .5], [82, 1], [122, 1], [150, .3], [192, .3], [202, .92], [236, .92], [268, .2], [330, .2], [340, .62], [372, .62], [400, .16], [760, 0]];
  function envAt(t) {
    if (t <= 0) return 0;
    for (let i = 1; i < ENV.length; i++) if (t < ENV[i][0]) { const a = ENV[i - 1], b = ENV[i]; return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
    return 0;
  }

  async function init(o) {
    const root = o.root, els = o.els || {}, groundY = o.groundY ?? .8;
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    root.style.isolation = 'isolate';                 // el mundo (z-index negativo) queda encima del fondo del contenedor y debajo de todo su contenido
    for (const k of ['left', 'right']) els[k] && els[k].classList.add('cmfx-card');
    const world = document.createElement('div'); world.className = 'cmfx-world';
    const cBg = mk(1, 1), cFx = mk(1, 1); world.append(cFx);       // cBg queda fuera de pantalla: el fondo se copia al lienzo de efectos en cada cuadro
    const vig = document.createElement('div'); vig.className = 'cmfx-vignette';
    const flash = document.createElement('div'); flash.className = 'cmfx-flash';
    const cTop = mk(1, 1); cTop.className = 'cmfx-top';            // chispas: por delante del contenido
    root.prepend(world); world.after(vig); root.append(cTop, flash);
    const gB = cBg.getContext('2d'), g = cFx.getContext('2d'), gT = cTop.getContext('2d');

    const bgImg = o.bg ? await loadImg(o.bg) : null;
    const assets = [];
    for (const b of (o.bolts || [])) {
      const img = await loadImg(b.src);
      const gl = mk(img.naturalWidth / 10, img.naturalHeight / 10), q = gl.getContext('2d');
      q.imageSmoothingQuality = 'high'; q.drawImage(img, 0, 0, gl.width, gl.height);      // halo: la misma imagen muy reducida
      assets.push({ ...b, img, glow: gl });
    }
    const byKind = k => assets.filter(a => a.kind === k);

    let W = 0, H = 0, K = 1, lit = null, fog = null;
    const S = { t: 0, on: true, strikes: [], sparks: [], parts: [], zoom: 1, shake: 0,
      boost: 0, rimB: { left: 0, right: 0 }, turn: 'left', beam: { left: .3, right: .1 }, next: { far: 1.2, mid: 3, near: 6 }, cores: [], flip: false, topDirty: false,
      q: 1, ema: 1 / 60, qNext: 4 };

    function paintBg() {
      gB.fillStyle = '#020611'; gB.fillRect(0, 0, W, H);
      if (bgImg) {
        const s = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight), w = bgImg.naturalWidth * s, h = bgImg.naturalHeight * s;
        gB.drawImage(bgImg, (W - w) / 2, (H - h) * (o.bgFocusY ?? .6), w, h);
      }
      lit = mk(W / 2, H / 2); lit.getContext('2d').drawImage(cBg, 0, 0, lit.width, lit.height);   // copia sin oscurecer: sirve para "encender" las nubes
      gB.fillStyle = `rgba(2,6,17,${o.darken ?? .42})`; gB.fillRect(0, 0, W, H);
      const gr = gB.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(2,6,17,.86)'); gr.addColorStop(.2, 'rgba(2,6,17,0)'); gr.addColorStop(.82, 'rgba(2,6,17,0)'); gr.addColorStop(1, 'rgba(2,6,17,.9)');
      gB.fillStyle = gr; gB.fillRect(0, 0, W, H);
    }
    function buildFog() {
      fog = mk(1024, 320); const q = fog.getContext('2d');
      for (let i = 0; i < 46; i++) {
        const x = R(1024), y = R(90, 250), rx = R(110, 260), ry = R(26, 70);
        for (const dx of [-1024, 0, 1024]) {
          q.save(); q.translate(x + dx, y); q.scale(1, ry / rx);
          const gr = q.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, 'rgba(118,170,238,.115)'); gr.addColorStop(1, 'rgba(118,170,238,0)');
          q.fillStyle = gr; q.beginPath(); q.arc(0, 0, rx, 0, TAU); q.fill(); q.restore();
        }
      }
    }
    function seedParts() {
      S.parts = Array.from({ length: Math.round(70 * S.q) }, () => ({ x: R(W), y: R(H), z: R(.25, 1), r: Math.random() < .14 ? R(9, 20) : R(1.6, 4.4), p: R(TAU), s: R(.4, 1.3) }));
    }
    function resize() {
      const cw = root.clientWidth || 1, ch = root.clientHeight || 1;
      W = Math.round(Math.min(1920, cw * Math.min(devicePixelRatio || 1, 1.5)) * S.q); H = Math.round(W * ch / cw); K = W / 1920;
      for (const c of [cBg, cFx, cTop]) { c.width = W; c.height = H; }
      paintBg(); if (!fog) buildFog(); seedParts();
    }
    new ResizeObserver(resize).observe(root); resize();

    /* rect de un elemento de la app en coordenadas del lienzo (deshace el zoom lento del mundo) */
    function rectOf(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect(), b = root.getBoundingClientRect(), f = W / (b.width || 1), z = S.zoom;
      const x = (r.left - b.left) * f, y = (r.top - b.top) * f;
      const X = W / 2 + (x - W / 2) / z, Y = H / 2 + (y - H / 2) / z, w = r.width * f / z, h = r.height * f / z;
      return { x: X, y: Y, w, h, cx: X + w / 2, cy: Y + h / 2 };
    }
    let rc = { left: null, right: null, timer: null };
    function gapX() {                                   // un punto x en los huecos entre tarjetas y contador
      const zs = [], L = rc.left, T = rc.timer, Rr = rc.right;
      const add = (a, b) => { if (b - a > 50 * K) zs.push([a + (b - a) * .15, b - (b - a) * .15]); };
      if (L && T && Rr) { add(0, L.x); add(L.x + L.w, T.x); add(T.x + T.w, Rr.x); add(Rr.x + Rr.w, W); } else add(0, W);
      const tot = zs.reduce((s, z) => s + z[1] - z[0], 0); let r = R(tot);
      for (const z of zs) { if (r < z[1] - z[0]) return z[0] + r; r -= z[1] - z[0]; }
      return R(W);
    }

    function litPatch(x, y, r) {                        // trozo del fondo recortado en círculo suave: al sumarlo, las nubes reales se iluminan
      if (!lit) return null;
      const d = Math.ceil(r), c = mk(d, d), q = c.getContext('2d');
      q.drawImage(lit, (x - r) / 2, (y - r) / 2, d, d, 0, 0, d, d);
      q.globalCompositeOperation = 'destination-in';
      const gr = q.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.45, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = gr; q.fillRect(0, 0, d, d);
      return { c, x: x - r, y: y - r, d: r * 2 };
    }
    function burst(x, y, n, spd = 520, spread = 1.15) {
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + R(-spread, spread), v = R(.25, 1) * spd * K; S.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: R(.35, .85) }); }
    }

    /* --- rayo "vivo" (procedural, estilo del video): crece hacia abajo, vibra y se borra desde arriba --- */
    function liveBolt(ax, ay, bx, by, p = {}) {
      const len = Math.hypot(bx - ax, by - ay), skel = fract([[ax, ay], [bx, by]], 3, len * .17), br = [];
      const n = p.branches ?? (2 + (Math.random() * 3 | 0)), dir = Math.atan2(by - ay, bx - ax);
      for (let i = 0; i < n; i++) {
        const idx = 1 + (Math.random() * (skel.length - 3) | 0), s = skel[idx], ang = dir + (Math.random() < .5 ? -1 : 1) * R(.35, .9);
        const l = len * R(.12, .30) * (1 - idx / skel.length * .45);
        br.push({ at: idx / (skel.length - 1), skel: fract([s, [s[0] + Math.cos(ang) * l, s[1] + Math.sin(ang) * l]], 2, l * .2), len: l });
      }
      const s = { type: 'live', skel, br, len, born: S.t, grow: p.grow ?? .23, hold: p.hold ?? .14, fade: p.fade ?? .15, power: p.power ?? 1, w: (p.w ?? 1) * K,
        far: !!p.far, ox: ax, oy: ay, tx: bx, ty: by, ground: !!p.ground, onHit: p.onHit, hit: false, nextW: 0, env: 0 };
      s.lit = litPatch(ax, Math.max(ay, H * .06), W * (p.far ? .16 : .26));
      S.strikes.push(s); return s;
    }
    /* --- rayo fotográfico: imagen sobre negro sumada en modo aditivo --- */
    function photoBolt(a, p) {
      const h = p.h, w = a.img.naturalWidth * h / a.img.naturalHeight, fl = !!p.flip;
      const u = (pt) => fl ? 1 - pt[0] : pt[0];
      const anc = p.anchor === 'top' ? a.top : a.tip;
      const x = p.x - u(anc) * w, y = p.y - anc[1] * h;
      const s = { type: 'photo', a, x, y, w, h, flip: fl, born: S.t, power: p.power ?? 1, dim: p.dim ?? 1, far: !!p.far,
        ox: x + u(a.top) * w, oy: Math.max(H * .05, y + a.top[1] * h), tx: x + u(a.tip) * w, ty: y + a.tip[1] * h,
        ground: !!p.ground, hit: false, env: 0, jit: Array.from({ length: 12 }, () => [R(-2.5, 2.5) * K, R(-2, 2) * K]) };
      s.lit = litPatch(s.ox, s.oy, W * (p.far ? .16 : .32));
      S.strikes.push(s); return s;
    }
    function strikeNear(x, power = 1, forceSky) {
      const sky = byKind('sky'), near = byKind('near'); S.flip = !S.flip;
      const useSky = forceSky ?? (sky.length && (!near.length || Math.random() < .45));
      if (useSky && sky.length) return photoBolt(sky[Math.random() * sky.length | 0], { x: x ?? R(W * .2, W * .8), y: -H * .03, h: H * R(.80, .96), anchor: 'top', flip: S.flip, power });
      if (near.length) { const ty = H * (groundY + R(-.03, .05)); const a = near[Math.random() * near.length | 0];
        return photoBolt(a, { x: x ?? gapX(), y: ty, h: (ty + H * .06) / a.tip[1], flip: S.flip, power, ground: true }); }
      const xx = x ?? gapX(); return liveBolt(xx + R(-140, 140) * K, -30, xx, H * (groundY + R(-.03, .05)), { power, w: 1.15, ground: true });
    }
    function strikeMid() { const x = gapX(); liveBolt(x + R(-130, 130) * K, -30, x, H * (groundY - R(.03, .11)), { power: .65, w: .8, ground: true }); }
    function strikeFar() {
      const far = byKind('far');
      if (far.length && Math.random() < .4) photoBolt(far[Math.random() * far.length | 0], { x: R(W * .08, W * .92), y: H * R(.50, .60), h: H * R(.32, .44), flip: Math.random() < .5, power: .35, dim: .55, far: true });
      else { const x = R(W * .05, W * .95); liveBolt(x + R(-50, 50) * K, H * R(.06, .2), x, H * R(.46, .60), { power: .32, w: .42, far: true, branches: 1 + (Math.random() * 2 | 0), grow: .18, hold: .08, fade: .12 }); }
    }

    function drawStrike(s, far) {
      if (s.far !== far) return;
      const age = S.t - s.born; let e = 0;
      g.globalCompositeOperation = 'lighter';
      if (s.type === 'photo') {
        e = envAt(age * 1000); const rv = clamp(age / .07), j = s.jit[Math.min(11, (age / .045) | 0)], iw = s.a.img.naturalWidth, ih = s.a.img.naturalHeight;
        if (rv > .01) { g.save(); g.translate(s.x + j[0] + (s.flip ? s.w : 0), s.y + j[1]); if (s.flip) g.scale(-1, 1);
        g.globalAlpha = clamp(e * s.dim * 1.15); g.drawImage(s.a.glow, 0, 0, s.a.glow.width, s.a.glow.height * rv, 0, 0, s.w, s.h * rv);
        g.globalAlpha = clamp(e * s.dim); g.drawImage(s.a.img, 0, 0, iw, ih * rv, 0, 0, s.w, s.h * rv);
        if (e > .8) g.drawImage(s.a.img, 0, 0, iw, ih * rv, 0, 0, s.w, s.h * rv);          // el pico se suma dos veces: núcleo quemado en blanco
        g.restore(); }
        if (!s.hit && age >= .082) { s.hit = true; if (s.ground) burst(s.tx, s.ty, 20, 560); }
        if (age > .76) s.dead = true;
      } else {
        const p = outCubic(clamp(age / s.grow)), er = clamp((age - s.grow - s.hold) / s.fade);
        e = (age < s.grow ? .5 + .5 * p : 1) * (1 - er * .35) * (er >= 1 ? 0 : 1);
        if (S.t >= s.nextW) {                               // vibra: se rehace el detalle fino cada ~45 ms, la forma grande se mantiene
          s.nextW = S.t + .045; s.main = fract(s.skel, 3, s.len * .034);
          for (const b of s.br) b.pts = fract(b.skel, 3, b.len * .05);
        }
        g.lineJoin = g.lineCap = 'round';
        if (pathPart(g, s.main, er, p)) strokeBolt(g, s.w, e);
        for (const b of s.br) { const bp = clamp((p - b.at) / .22); if (bp > 0 && er < b.at + .1 && pathPart(g, b.pts, 0, bp)) strokeBolt(g, s.w * .55, e * .62); }
        if (!s.hit && p >= 1) { s.hit = true; if (s.ground) burst(s.tx, s.ty, s.far ? 0 : 14, 460); s.onHit && s.onHit(); }
        if (age > s.grow + s.hold + s.fade) s.dead = true;
      }
      s.env = e;
      /* nube encendida en el origen + resplandor */
      const pw = e * s.power * (s.dim ?? 1);
      if (s.lit) { g.globalAlpha = clamp(pw * 1.25); g.drawImage(s.lit.c, s.lit.x, s.lit.y, s.lit.d, s.lit.d); g.drawImage(s.lit.c, s.lit.x, s.lit.y, s.lit.d, s.lit.d); }
      const gr = (s.far ? 260 : 520) * K; g.globalAlpha = clamp(pw * .55); g.drawImage(SPR.blue, s.ox - gr, s.oy - gr, gr * 2, gr * 2);
      /* fogonazo en el suelo */
      if (s.ground && s.hit) {
        g.globalAlpha = clamp(pw); g.drawImage(SPR.white, s.tx - 130 * K, s.ty - 26 * K, 260 * K, 52 * K);
        g.globalAlpha = clamp(pw * .8); g.drawImage(SPR.blue, s.tx - 330 * K, s.ty - 62 * K, 660 * K, 124 * K);
      }
    }

    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now; S.t += dt; const t = S.t;
      rc = { left: rectOf(els.left), right: rectOf(els.right), timer: rectOf(els.timer) };
      /* calidad adaptativa: si el equipo no llega a ~35 fps, baja la resolución interna de los lienzos (1 -> .7 -> .5) */
      S.ema = lerp(S.ema, dt, .04);
      if (t > S.qNext) { S.qNext = t + 3; if (S.ema > 1 / 35 && S.q > .5 && !o.fixedQuality) { S.q = S.q === 1 ? .7 : .5; resize(); S.cores.forEach(c => c.fit()); } }

      if (S.on) {
        S.zoom = 1.03 + .03 * Math.sin(t * TAU / 40); cFx.style.transform = `scale(${S.zoom.toFixed(4)})`;
        if (t > S.next.far) { strikeFar(); S.next.far = t + R(2.2, 5); }
        if (t > S.next.mid) { strikeMid(); S.next.mid = t + R(4.5, 8); }
        if (t > S.next.near) { strikeNear(); S.next.near = t + R(10, 17); }
      }

      /* el fondo se pinta dentro del mismo lienzo: así todo lo que se dibuja después en modo 'lighter' SUMA luz sobre el fondo real */
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(cBg, 0, 0);
      let F = 0, fxX = .5; const rim = { left: 0, right: 0 };

      /* haces de luz detrás de cada tarjeta y charco de luz bajo el contador */
      g.globalCompositeOperation = 'lighter';
      for (const side of ['left', 'right']) {
        const c = rc[side]; if (!c) continue;
        S.beam[side] = lerp(S.beam[side], S.turn === side ? .34 : .10, clamp(dt * 5));
        g.globalAlpha = S.beam[side]; g.drawImage(SPR.blue, c.cx - c.w * .95, c.y - c.h * .28, c.w * 1.9, c.h * 1.55);
      }
      for (const s of S.strikes) drawStrike(s, true);                 // rayos lejanos: detrás de la niebla

      if (S.on && fog) {                                              // niebla: dos capas que se cruzan; se enciende con cada rayo
        g.globalCompositeOperation = 'lighter';
        const fh = H * .36, fw = fh * 1024 / 320, fy = H * groundY - fh * .62;
        const glowUp = 1 + S.strikes.reduce((m, s) => Math.max(m, s.env * s.power), 0) * 1.6;
        for (const [spd, al, dy] of [[9, .50, 0], [-15, .36, fh * .16]]) {
          let x = -(((t * spd * K) % fw) + fw) % fw; g.globalAlpha = clamp(al * glowUp);
          for (; x < W; x += fw) g.drawImage(fog, x, fy + dy, fw, fh);
        }
      }
      const T = rc.timer;
      if (T) {                                                        // charco de luz del contador sobre el suelo
        const c0 = S.cores[0], m = c0 ? c0.mix : 0, run = c0 && c0.running ? 1 : 0, dead = c0 && c0.dead ? .25 : 1;
        const a = (.20 + .16 * run + .05 * Math.sin(t * 3.1)) * dead, pw = T.w * 2.1, ph = T.w * .40, py = H * groundY + T.w * .08;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a * (1 - m); g.drawImage(SPR.blue, T.cx - pw / 2, py - ph / 2, pw, ph);
        if (m > 0) { g.globalAlpha = a * m * 1.2; g.drawImage(SPR.red, T.cx - pw / 2, py - ph / 2, pw, ph); }
      }
      for (const s of S.strikes) {
        drawStrike(s, false);
        const pw = s.env * s.power * (s.far ? .5 : 1); if (pw > F) { F = pw; fxX = s.ox / W; }
        for (const side of ['left', 'right']) { const c = rc[side]; if (c) rim[side] = Math.max(rim[side], pw * clamp(1 - Math.abs(s.ox - c.cx) / (W * .5)) * (s.far ? .4 : 1)); }
      }
      S.strikes = S.strikes.filter(s => !s.dead);

      /* chispas: en el lienzo superior, para que salten por delante de las tarjetas */
      if (S.sparks.length || S.topDirty) {
        gT.clearRect(0, 0, W, H); S.topDirty = S.sparks.length > 0; gT.globalCompositeOperation = 'lighter'; gT.lineCap = 'round';
        const z = S.zoom, sx = x => W / 2 + (x - W / 2) * z, sy = y => H / 2 + (y - H / 2) * z;
        for (const p of S.sparks) {
          p.life += dt; p.vy += 980 * K * dt; p.x += p.vx * dt; p.y += p.vy * dt; const k = 1 - p.life / p.max; if (k <= 0) { p.dead = true; continue; }
          gT.globalAlpha = k; gT.lineWidth = 2 * K; gT.strokeStyle = k > .55 ? 'rgb(240,249,255)' : 'rgb(110,190,255)';
          gT.beginPath(); gT.moveTo(sx(p.x), sy(p.y)); gT.lineTo(sx(p.x - p.vx * .035), sy(p.y - p.vy * .035)); gT.stroke();
        }
        S.sparks = S.sparks.filter(p => !p.dead);
      }

      /* partículas en suspensión */
      if (S.on) for (const p of S.parts) {
        p.y -= (6 + 18 * p.z) * K * dt; p.x += Math.sin(t * .25 + p.p) * 4 * K * dt; if (p.y < -30) { p.y = H + 20; p.x = R(W); }
        const r = p.r * K; g.globalAlpha = (p.r > 8 ? .075 : .5 * p.z) * (.55 + .45 * Math.sin(t * p.s + p.p));
        g.drawImage(SPR.dust, p.x - r, p.y - r, r * 2, r * 2);
      }

      /* destello general, luz de borde en tarjetas y sacudida */
      S.boost = Math.max(0, S.boost - dt * 3.2);
      const fo = clamp(F * .11 + S.boost, 0, .34);
      if (Math.abs(fo - (flash._o || 0)) > .004) { flash._o = fo; flash.style.opacity = fo.toFixed(3); flash.style.setProperty('--cmfx-fx', (fxX * 100).toFixed(0) + '%'); }
      for (const side of ['left', 'right']) {
        S.rimB[side] = Math.max(0, S.rimB[side] - dt * 4.5); const el = els[side]; if (!el) continue;
        const v = clamp(Math.max(rim[side] * .9, S.rimB[side])); if (Math.abs(v - (el._r || 0)) > .01) { el._r = v; el.style.setProperty('--cmfx-rim', v.toFixed(2)); }
      }
      if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt / .26); root.style.translate = S.shake ? `${(R(-1, 1) * 11 * S.shake).toFixed(1)}px ${(R(-1, 1) * 7 * S.shake).toFixed(1)}px` : ''; }

      for (const c of S.cores) c.draw(t, dt);
    }
    raf = requestAnimationFrame(frame);

    /* ------------------------------ NÚCLEO DE ENERGÍA ------------------------------ */
    function core(el) {
      el.classList.add('cmfx-core');
      el.innerHTML = `<svg class="cmfx-core__ring cmfx-core__ring--b" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="96" fill="none" stroke-dasharray="46 20 6 20"/></svg>
        <svg class="cmfx-core__ring" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="89" fill="none" stroke-dasharray="1.3 5.2"/></svg>
        <div class="cmfx-core__bezel"></div><div class="cmfx-core__edge"></div><div class="cmfx-core__glass"></div>
        <svg class="cmfx-core__ticks" viewBox="-100 -100 200 200" aria-hidden="true"></svg><canvas></canvas>
        <div class="cmfx-core__read"><b class="cmfx-core__num"></b><span class="cmfx-core__lab">segundos</span></div>`;
      const svgT = el.querySelector('.cmfx-core__ticks'), cv = el.querySelector('canvas'), q = cv.getContext('2d'), num = el.querySelector('.cmfx-core__num');
      let ticks = '';
      for (let i = 0; i < 60; i++) { const a = i / 60 * TAU - Math.PI / 2, r1 = i % 5 ? 70.5 : 68, r2 = 76;
        ticks += `<line x1="${(Math.cos(a) * r1).toFixed(2)}" y1="${(Math.sin(a) * r1).toFixed(2)}" x2="${(Math.cos(a) * r2).toFixed(2)}" y2="${(Math.sin(a) * r2).toFixed(2)}"${i % 5 ? '' : ' class="maj"'}/>`; }
      svgT.innerHTML = ticks; const tk = [...svgT.children];
      const blobs = Array.from({ length: 9 }, (_, i) => ({ a: i / 9 * TAU + R(.5), w: R(.12, .42) * (i % 2 ? 1 : -1), f: R(.7, 1.9), p: R(TAU), al: R(.17, .30) }));
      const orbs = [{ a: R(TAU), w: .55, r: 1.045, len: 1.5 }, { a: R(TAU), w: -.38, r: 1.085, len: 1.1 }, { a: R(TAU), w: .27, r: 1.045, len: .8 }];
      const C = { frac: 1, left: -1, total: 0, running: false, setAt: 0, dead: false, mix: 0, ign: 0, sw: -1, arcs: [], sp: [], nextArc: 0, sec: -1, off: -1, acc: 0 };
      const GL = [[30, 144, 255], [255, 74, 22]], MD = [[112, 192, 255], [255, 150, 72]], HT = [[236, 247, 255], [255, 238, 214]];
      const col = (P, a) => `rgba(${Math.round(lerp(P[0][0], P[1][0], C.mix))},${Math.round(lerp(P[0][1], P[1][1], C.mix))},${Math.round(lerp(P[0][2], P[1][2], C.mix))},${a})`;
      let size = 0;
      function fit() { const d = el.clientWidth || 450; el.style.setProperty('--u', d / 100 + 'px'); size = Math.round(Math.min(1100, d * 2.2 * Math.min(devicePixelRatio || 1, 1.5)) * S.q); cv.width = cv.height = size; }
      C.fit = fit; new ResizeObserver(fit).observe(el); fit();

      C.set = (left, total, running) => {
        if (left !== C.left || !!running !== C.running) C.setAt = S.t;
        C.left = left; C.total = total; C.running = !!running;
        const sec = Math.ceil(left - 1e-6);
        if (sec !== C.sec) { C.sec = sec; num.textContent = sec;
          if (running && S.on) { num.animate([{ transform: 'scale(1.07)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
            if (sec <= 10 && sec > 0) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' }); } }
        const danger = left <= 10 && left > 0 && left < total;
        if (danger !== C.danger) { C.danger = danger; el.classList.toggle('is-danger', danger); el.querySelectorAll('.cmfx-core__ring').forEach(r => r.getAnimations().forEach(a => a.playbackRate = danger ? 3.2 : 1)); }
        if (left > 0 && C.dead) { C.dead = false; el.classList.remove('is-dead'); }
      };
      C.ignite = () => { C.ign = 1; };
      C.zero = () => { C.dead = true; C.sw = 0; C.danger = false; el.classList.remove('is-danger'); el.classList.add('is-dead'); };
      C.draw = (t, dt) => {
        const c = size / 2, u = size / 4.4;                      // u = radio exterior del aro, en px del lienzo
        /* si la app solo avisa una vez por segundo, se interpola entre avisos para que el arco avance suave */
        const vis = C.running ? Math.max(0, C.left - Math.min(1.05, S.t - (C.setAt || S.t))) : C.left;
        C.frac = C.total > 0 ? clamp(vis / C.total) : 0;
        const off = Math.round((1 - C.frac) * 60); if (off !== C.off) { C.off = off; tk.forEach((l, i) => l.classList.toggle('off', i < off)); }
        C.mix = lerp(C.mix, C.danger ? 1 : 0, clamp(dt * 5)); C.ign = Math.max(0, C.ign - dt / .55);
        q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; q.clearRect(0, 0, size, size);
        q.globalCompositeOperation = 'lighter';
        const live = S.on ? 1 : 0, hA = (C.dead ? .16 : C.running ? 1 : .62) * (1 + C.ign * 1.1);
        /* (a) halo de plasma: manchas de luz que giran y respiran, nunca un resplandor uniforme */
        for (const b of blobs) {
          const ang = b.a + t * b.w * (1 + C.mix * 1.6) * live, rr = u * (1 + .06 * Math.sin(t * b.f + b.p));
          const s = u * (1.45 + .45 * Math.sin(t * b.f * .7 + b.p * 2) * live) * (1 + C.ign * .5), x = c + Math.cos(ang) * rr, y = c + Math.sin(ang) * rr;
          q.globalAlpha = clamp(b.al * hA * (1 - C.mix)); q.drawImage(SPR.blue, x - s / 2, y - s / 2, s, s);
          if (C.mix > .01) { q.globalAlpha = clamp(b.al * hA * C.mix * 1.2); q.drawImage(SPR.red, x - s / 2, y - s / 2, s, s); }
        }
        q.globalAlpha = clamp(hA); q.beginPath(); q.arc(c, c, u * 1.02, 0, TAU);
        q.lineWidth = u * .52; q.strokeStyle = col(GL, .06); q.stroke(); q.lineWidth = u * .2; q.strokeStyle = col(GL, .13); q.stroke();
        q.beginPath(); q.arc(c, c, u * 1.03, 0, TAU); q.lineWidth = u * .07; q.strokeStyle = col(MD, .20); q.stroke();
        /* arcos de energía que barren el borde del aro, con las puntas desvanecidas */
        if (!C.dead) for (const e of orbs) {
          const a0 = e.a + t * e.w * (1 + C.mix * 1.8) * live, dir = e.w > 0 ? 1 : -1;
          let st = col(MD, .5);
          if (q.createConicGradient) { const cg = q.createConicGradient(dir > 0 ? a0 : a0 - e.len, c, c), f = e.len / TAU;
            cg.addColorStop(0, col(MD, dir > 0 ? 0 : .95)); cg.addColorStop(f * .5, col(MD, .5)); cg.addColorStop(f, col(HT, dir > 0 ? .95 : 0)); cg.addColorStop(Math.min(1, f + .001), col(HT, 0)); cg.addColorStop(1, col(HT, 0)); st = cg; }
          q.beginPath(); q.arc(c, c, u * e.r, dir > 0 ? a0 : a0 - e.len, dir > 0 ? a0 + e.len : a0);
          q.globalAlpha = clamp(hA); q.lineCap = 'round'; q.lineWidth = u * .05; q.strokeStyle = col(GL, .16); q.stroke(); q.lineWidth = u * .014; q.strokeStyle = st; q.stroke();
        }
        /* vaciar el interior para no lavar el cristal */
        q.globalCompositeOperation = 'destination-out'; q.globalAlpha = 1;
        const hole = q.createRadialGradient(c, c, u * .80, c, c, u * .915); hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(1, 'rgba(0,0,0,0)');
        q.fillStyle = hole; q.beginPath(); q.arc(c, c, u * .92, 0, TAU); q.fill();
        q.globalCompositeOperation = 'lighter'; q.lineCap = 'round';
        /* (d) pista y arco de progreso con punta de cometa */
        const rp = u * .83, head = -Math.PI / 2 + TAU * (1 - C.frac), end = Math.PI * 1.5;
        q.globalAlpha = 1; q.beginPath(); q.arc(c, c, rp, 0, TAU); q.lineWidth = u * .062; q.strokeStyle = col(MD, .13); q.stroke();
        if (C.frac > .0005 && !C.dead) {
          q.beginPath(); q.arc(c, c, rp, head, end);
          q.lineWidth = u * .21; q.strokeStyle = col(GL, .10); q.stroke();
          q.lineWidth = u * .115; q.strokeStyle = col(GL, .24); q.stroke();
          let st = col(MD, .96);
          if (q.createConicGradient) { const cg = q.createConicGradient(head, c, c); cg.addColorStop(0, col(HT, 1)); cg.addColorStop(.05, col(MD, 1)); cg.addColorStop(.55, col(GL, .95)); cg.addColorStop(1, col(GL, .55)); st = cg; }
          q.lineWidth = u * .062; q.strokeStyle = st; q.stroke();
          q.lineWidth = u * .016; q.strokeStyle = col(HT, .85); q.stroke();
          const hx = c + Math.cos(head) * rp, hy = c + Math.sin(head) * rp, s1 = u * .40, s2 = u * .85;
          q.globalAlpha = .75; q.drawImage(C.mix > .5 ? SPR.red : SPR.blue, hx - s2 / 2, hy - s2 / 2, s2, s2);
          q.globalAlpha = 1; q.drawImage(SPR.white, hx - s1 / 2, hy - s1 / 2, s1, s1);
          if (C.running && live) {                              // chispas que suelta la punta
            C.acc += dt * 55; while (C.acc > 1) { C.acc--; const tg = head - Math.PI / 2 + R(-.7, .7), v = R(.12, .5) * u;
              C.sp.push({ x: hx, y: hy, vx: Math.cos(tg) * v + R(-.08, .08) * u, vy: Math.sin(tg) * v + R(-.08, .08) * u, l: 0, m: R(.25, .6) }); }
          }
        }
        for (const p of C.sp) { p.l += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += u * .5 * dt; const k = 1 - p.l / p.m; if (k <= 0) { p.dead = true; continue; }
          const r = u * .03 * (.5 + k); q.globalAlpha = k; q.drawImage(SPR.white, p.x - r, p.y - r, r * 2, r * 2); }
        C.sp = C.sp.filter(p => !p.dead);
        /* arcos eléctricos recorriendo el aro */
        if (live && !C.dead && t > C.nextArc) {
          C.nextArc = t + (C.danger ? R(.045, .12) : C.running ? R(.09, .26) : R(1.2, 2.6));
          const a0 = R(TAU), span = R(.35, .95), n = 16, pts = [];
          for (let i = 0; i <= n; i++) { const a = a0 + span * i / n, rr = u * (.955 + (Math.random() - .5) * .085 * Math.sin(Math.PI * i / n)); pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]); }
          C.arcs.push({ pts, born: t, life: R(.09, .17) });
        }
        q.lineJoin = 'round';
        for (const a of C.arcs) { const k = 1 - (t - a.born) / a.life; if (k <= 0) { a.dead = true; continue; }
          q.beginPath(); a.pts.forEach((p, i) => i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]));
          q.globalAlpha = k > .5 ? 1 : .45; q.lineWidth = u * .034; q.strokeStyle = col(MD, .34); q.stroke(); q.lineWidth = u * .0095; q.strokeStyle = col(HT, 1); q.stroke(); }
        C.arcs = C.arcs.filter(a => !a.dead);
        /* encendido (rayo al iniciar) y onda de choque (tiempo en 0) */
        if (C.ign > 0) { q.globalAlpha = C.ign * .85; q.beginPath(); q.arc(c, c, u * .95, 0, TAU); q.lineWidth = u * .07 * (1 + C.ign); q.strokeStyle = col(HT, 1); q.stroke(); }
        if (C.sw >= 0) { C.sw += dt / .65; if (C.sw >= 1) C.sw = -1; else { q.globalAlpha = (1 - C.sw) * .9; q.beginPath(); q.arc(c, c, u * (1 + C.sw * 1.08), 0, TAU); q.lineWidth = u * .13 * (1 - C.sw) + 1; q.strokeStyle = 'rgba(255,240,222,1)'; q.stroke(); } }
      };
      S.cores.push(C); return C;
    }

    /* ------------------------------ EVENTOS ------------------------------ */
    const api = {
      core,
      start() {
        const T = rc.timer; if (!T) return;
        liveBolt(T.cx + R(-190, 190) * K, -30, T.cx, T.y + T.h * .02, { power: 1.3, w: 1.3, grow: .2, branches: 4,
          onHit: () => { S.cores.forEach(c => c.ignite()); burst(T.cx, T.y + T.h * .02, 16, 420, 1.5); S.boost = Math.max(S.boost, .16); } });
        if (S.on) setTimeout(() => strikeNear(undefined, .9, true), 70);
      },
      setTurn(side) { S.turn = side; for (const k of ['left', 'right']) els[k] && els[k].classList.toggle('is-turn', k === side); },
      turn(side) {
        api.setTurn(side); const c = rc[side]; if (!c) return;
        liveBolt(c.cx + R(-160, 160) * K, -30, c.cx + R(-.2, .2) * c.w, c.y + 4 * K, { power: 1.05, w: 1.05, grow: .19,
          onHit: () => { S.rimB[side] = 1; burst(c.cx, c.y + 4 * K, 14, 430, 1.4); S.boost = Math.max(S.boost, .08); } });
      },
      hit(side) {
        const c = rc[side], el = els[side]; if (!c) return;
        burst(c.cx + R(-.2, .2) * c.w, c.y + c.h * R(.25, .5), 36, 760, 2.6); S.rimB[side] = 1; S.boost = Math.max(S.boost, .05);
        if (el) { el.classList.remove('cmfx-hit'); void el.offsetWidth; el.classList.add('cmfx-hit'); }
      },
      zero() {
        S.cores.forEach(c => c.zero()); S.shake = 1; S.boost = .30;
        const L = rc.left, T = rc.timer, Rr = rc.right, xl = L && T ? (L.x + L.w + T.x) / 2 : W * .33, xr = T && Rr ? (T.x + T.w + Rr.x) / 2 : W * .67;
        const near = byKind('near'), ty = H * (groundY + .02);
        const fino = (x, fl) => near.length ? photoBolt(near[0], { x, y: ty, h: (ty + H * .06) / near[0].tip[1], flip: fl, power: 1.6, ground: true }) : liveBolt(x, -30, x, ty, { power: 1.5, w: 1.3, ground: true });
        fino(xl, false); setTimeout(() => fino(xr, true), 140); setTimeout(() => strikeNear(W * R(.4, .6), 1.6, true), 300);
      },
      reset() { S.strikes.length = 0; S.sparks.length = 0; S.boost = 0; S.shake = 0; root.style.translate = ''; },
      strike(x) { return strikeNear(x, 1.1); },
      setEnabled(v) { S.on = !!v; root.classList.toggle('cmfx-off', !S.on); if (!S.on) { S.zoom = 1; cFx.style.transform = ''; S.strikes.length = 0; } },
      toggle() { api.setEnabled(!S.on); return S.on; },
      get enabled() { return S.on; }, get time() { return S.t; }, get quality() { return S.q; },
      destroy() { cancelAnimationFrame(raf); world.remove(); vig.remove(); cTop.remove(); flash.remove(); }
    };
    api.setEnabled(S.on); api.setTurn(o.turn || 'left');
    return api;
  }
  return { init };
})();

export { CMFX };
