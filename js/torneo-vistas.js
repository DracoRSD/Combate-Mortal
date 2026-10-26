/* =============================================================================
   COMBATE MORTAL FREESTYLE · VISTAS DEL TORNEO (bracket, historias, llave de ronda)
   -----------------------------------------------------------------------------
   Lo usan:
     - Combate_Mortal.html: pantalla Torneo del operador (y su espejo en la salida limpia).
     - torneo.html: cada vista en su propia ventana (#bracket, #historias, #llave).
   No guarda un estado propio: lee y escribe el MISMO bracket del proyecto
   (localStorage 'cmTorneoBracketDemo_v2'): { octavos[8], cuartos[4], semifinal[2],
   tercerPuesto[1], final[1] }, cada cruce { a, b, winner: 'a'|'b'|null, theme? }
   con los nombres de los MCs. Entre ventanas se sincroniza con BroadcastChannel
   ('cmf-torneo') y con el evento "storage".
   Teclado: un solo escuchador en window (fase de captura) y una selección propia
   (id del cruce + casilla), guardada en sessionStorage. No depende del foco del DOM.
   ============================================================================= */
(function () {
  'use strict';

  /* ---------- Archivos (todo local, sin internet) ---------- */
  const A = (p) => 'assets/' + p;
  const IMG = {
    fondoH: A('torneo/fondo-bracket.jpg'), fondoV: A('torneo/fondo-historias.jpg'), fondo45: A('torneo/fondo-llave.jpg'),
    logo: A('torneo/logo-cmf.png'), silueta: A('torneo/silueta.svg'),
    octavos: A('torneo/titulo-octavos.webp'), cuartos: A('torneo/titulo-cuartos.webp'), semi: A('torneo/titulo-semifinal.webp'),
    granfinal: A('torneo/titulo-gran-final.webp'), tercer: A('torneo/titulo-3er-lugar.webp'), campeon: A('torneo/titulo-campeon-internacional.webp')
  };
  const bandera = (iso) => A('torneo/banderas/' + iso + '.svg');
  const foto = (slug) => A('participantes/' + slug + '.jpg');

  /* slug: [nombre en pantalla, país, bandera] */
  const PARTICIPANTES = {
    'felpa-divo': ['Felpa Divo', 'Rep. Dom.', 'DO'], 'teorema': ['Teorema', 'Chile', 'CL'], 'larrix': ['Larrix', 'Argentina', 'AR'],
    'exodo': ['Exodo', 'Rep. Dom.', 'DO'], 'r16': ['R16', 'Rep. Dom.', 'DO'], 'fat-n': ['Fat N', 'Colombia', 'CO'],
    'ufo': ['UFO', 'Panamá', 'PA'], 'kenyari': ['Kenyari', 'Costa Rica', 'CR'], 'dinamita': ['Dinamita', 'Rep. Dom.', 'DO'],
    'nume': ['Nume', 'Rep. Dom.', 'DO'], 'pandora': ['Pandora', 'Colombia', 'CO'], 'sophia': ['Sophia', 'Argentina', 'AR'],
    'mecha': ['Mecha', 'Argentina', 'AR'], 'valles-t': ['Valles T', 'Colombia', 'CO'], 'd-kapo': ['D Kapo', 'Rep. Dom.', 'DO'],
    'el-menor': ['El Menor', 'Chile', 'CL']
  };
  const ENCUADRE = {};   // ajuste de foto por participante, ej. 'r16': '50% 40%'

  /* Enlaza un nombre del bracket con su slug, sin importar mayúsculas ni acentos. */
  function slug(nombre) {
    return String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function mc(nombre) {
    if (!nombre) return null;
    const s = slug(nombre), p = PARTICIPANTES[s];
    if (!p) return { slug: s, nombre: String(nombre), foto: IMG.silueta, bandera: null };
    return { slug: s, nombre: p[0], pais: p[1], foto: foto(s), bandera: bandera(p[2]) };
  }

  /* ---------- El bracket del proyecto ---------- */
  const CLAVE = 'cmTorneoBracketDemo_v2';
  const ETAPAS = [['octavos', 8], ['cuartos', 4], ['semifinal', 2], ['tercerPuesto', 1], ['final', 1]];
  const CRUCES = [];   // en el orden en que "toca" cada combate
  ETAPAS.forEach(([st, n]) => { for (let i = 0; i < n; i++) CRUCES.push({ id: st + '-' + i, st, i }); });
  const POR_ID = Object.fromEntries(CRUCES.map((c) => [c.id, c]));
  const RONDA = { octavos: 'OCTAVOS', cuartos: 'CUARTOS', semifinal: 'SEMIFINAL', tercerPuesto: '3ER PUESTO', final: 'FINAL' };
  const VACIO = { a: null, b: null, winner: null };

  const cruce = (b, c) => (b && b[c.st] && b[c.st][c.i]) || VACIO;
  const listo = (b, c) => { const m = cruce(b, c); return !!(m.a && m.b); };
  const actual = (b) => CRUCES.find((c) => listo(b, c) && !cruce(b, c).winner) || null;
  const ganadorDe = (m) => (m.winner ? m[m.winner] : null);
  const perdedorDe = (m) => (m.winner ? m[m.winner === 'a' ? 'b' : 'a'] : null);

  function vacio() {
    const b = {};
    ETAPAS.forEach(([st, n]) => { b[st] = []; for (let i = 0; i < n; i++) b[st].push({ a: null, b: null, winner: null }); });
    b.semifinal[0].theme = 'TORMENTA'; b.semifinal[1].theme = 'CORONA';
    return b;
  }
  function valido(b) {
    return !!b && ETAPAS.every(([st, n]) => Array.isArray(b[st]) && b[st].length === n && b[st].every((m) => m && typeof m === 'object'));
  }
  /* Igual que recomputeBracket() del operador: ganadores hacia adelante; si cambian los rivales de un cruce, se borra su ganador. */
  function recalcular(b) {
    const o = b.octavos, c = b.cuartos, s = b.semifinal, f = b.final[0], t = b.tercerPuesto[0];
    const poner = (m, a, bb) => { if (m.a !== a || m.b !== bb) { m.a = a; m.b = bb; m.winner = null; } };
    for (let i = 0; i < c.length; i++) poner(c[i], ganadorDe(o[i * 2]), ganadorDe(o[i * 2 + 1]));
    for (let i = 0; i < s.length; i++) poner(s[i], ganadorDe(c[i * 2]), ganadorDe(c[i * 2 + 1]));
    poner(f, ganadorDe(s[0]), ganadorDe(s[1]));
    poner(t, perdedorDe(s[0]), perdedorDe(s[1]));
    return b;
  }
  /* Firma de los resultados (sin temáticas): si cambia, historias y llave saltan a la ronda que toca. */
  const firma = (b) => CRUCES.map((c) => { const m = cruce(b, c); return (m.a || '') + '|' + (m.b || '') + '|' + (m.winner || ''); }).join(';');

  /* ---------- Sincronía entre ventanas ---------- */
  function canal(alRecibir) {
    let bc = null;
    try { bc = new BroadcastChannel('cmf-torneo'); bc.onmessage = (e) => { if (e.data && e.data.tipo === 'bracket' && valido(e.data.bracket)) alRecibir(e.data.bracket); }; } catch (e) { bc = null; }
    window.addEventListener('storage', (e) => {
      if (e.key !== CLAVE || !e.newValue) return;
      try { const b = JSON.parse(e.newValue); if (valido(b)) alRecibir(b); } catch (err) { /* valor roto: se ignora */ }
    });
    return { publicar: (b) => { try { if (bc) bc.postMessage({ tipo: 'bracket', bracket: JSON.parse(JSON.stringify(b)) }); } catch (e) { /* sin canal */ } } };
  }

  /* ---------- Utilidades de DOM ---------- */
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function caja(e, x, y, w, h) { e.style.left = x + 'px'; e.style.top = y + 'px'; if (w != null) e.style.width = w + 'px'; if (h != null) e.style.height = h + 'px'; return e; }
  /* Si el texto no cabe en su contenedor, la letra se achica sola. */
  function achicar(span, disponible) {
    span.style.fontSize = '';
    if (!span.textContent || disponible <= 0) return;
    if (span.offsetWidth > disponible) span.style.fontSize = (parseFloat(getComputedStyle(span).fontSize) * disponible / span.offsetWidth) + 'px';
  }
  const cargar = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function poly(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  const FUENTE = '"Bebas Neue", "CM Anton", Impact, "Arial Narrow", sans-serif';
  const LAPIZ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';

  /* ---------- Geometría del bracket (lienzo 1560 x 960, medidas del prototipo) ---------- */
  const W = 1560, H = 960, CW = 160, BH = 44, GAP = 24;
  const OCT_TOP = [172, 336, 500, 664], CUA_TOP = [254, 582], XL = [76, 284, 492], XR = [1324, 1116, 908];
  function posCruce(st, i) {
    if (st === 'octavos') return i < 4 ? [XL[0], OCT_TOP[i]] : [XR[0], OCT_TOP[i - 4]];
    if (st === 'cuartos') return i < 2 ? [XL[1], CUA_TOP[i]] : [XR[1], CUA_TOP[i - 2]];
    if (st === 'semifinal') return [i === 0 ? XL[2] : XR[2], 418];
    if (st === 'final') return [700, 418];
    return [700, 598];   // tercerPuesto
  }
  const CY = {};
  CRUCES.forEach((c) => { CY[c.id] = posCruce(c.st, c.i)[1] + BH + GAP / 2; });
  const PODIO = { oro: [695, 790, 865, 844, '1°'], plata: [535, 800, 689, 844, '2°'], bronce: [871, 804, 1025, 844, '3°'] };
  const TITULOS = [['octavos', 156, 126, 157], ['octavos', 1404, 126, 157], ['cuartos', 364, 204, 167], ['cuartos', 1196, 204, 167],
    ['semi', 572, 298, 163], ['semi', 988, 298, 163], ['granfinal', 780, 351, 222], ['tercer', 780, 553, 160], ['campeon', 780, 722, 185]];
  /* Columnas para moverse con las flechas (de izquierda a derecha; el centro es Gran Final y 3er Lugar). */
  const COLS = [
    ['octavos-0', 'octavos-1', 'octavos-2', 'octavos-3'], ['cuartos-0', 'cuartos-1'], ['semifinal-0'],
    ['final-0', 'tercerPuesto-0'],
    ['semifinal-1'], ['cuartos-2', 'cuartos-3'], ['octavos-4', 'octavos-5', 'octavos-6', 'octavos-7']
  ];
  const COL_DE = {};
  COLS.forEach((col, c) => col.forEach((id, r) => { COL_DE[id] = [c, r]; }));
  function lineasBracket() {
    let d = '';
    const enlace = (src, dst, lado) => {
      const ys = src[1] + BH + GAP / 2, yd = dst[1] + BH + GAP / 2;
      const xs = lado > 0 ? src[0] + CW : src[0], xd = lado > 0 ? dst[0] : dst[0] + CW, xm = (xs + xd) / 2;
      d += `M${xs} ${ys}H${xm}V${yd}H${xd}`;
    };
    for (let i = 0; i < 8; i++) enlace(posCruce('octavos', i), posCruce('cuartos', i >> 1), i < 4 ? 1 : -1);
    for (let i = 0; i < 4; i++) enlace(posCruce('cuartos', i), posCruce('semifinal', i >> 1), i < 2 ? 1 : -1);
    enlace(posCruce('semifinal', 0), posCruce('final', 0), 1);
    enlace(posCruce('semifinal', 1), posCruce('final', 0), -1);
    return d;
  }

  /* ---------- Historias (1080 x 1920) y llave de ronda (1080 x LLAVE_ALTO) ---------- */
  const CARTAS = [
    { titulo: 'octavos', ids: ['octavos-0', 'octavos-1', 'octavos-2', 'octavos-3'], nombre: 'Octavos 1/2', archivo: 'octavos-1' },
    { titulo: 'octavos', ids: ['octavos-4', 'octavos-5', 'octavos-6', 'octavos-7'], nombre: 'Octavos 2/2', archivo: 'octavos-2' },
    { titulo: 'cuartos', ids: ['cuartos-0', 'cuartos-1', 'cuartos-2', 'cuartos-3'], nombre: 'Cuartos', archivo: 'cuartos' },
    { titulo: 'semi', ids: ['semifinal-0', 'semifinal-1'], nombre: 'Semis', archivo: 'semis' },
    { titulo: 'tercer', ids: ['tercerPuesto-0'], nombre: '3er Puesto', archivo: '3er-puesto' },
    { titulo: 'granfinal', ids: ['final-0'], nombre: 'Final', archivo: 'final' }
  ];
  const LLAVE_ANCHO = 1080, LLAVE_ALTO = 1350;   // cambia LLAVE_ALTO a 1920 para formato historia
  const RONDAS = [
    { titulo: 'octavos', ids: CRUCES.filter((c) => c.st === 'octavos').map((c) => c.id), nombre: 'Octavos', archivo: 'octavos' },
    { titulo: 'cuartos', ids: ['cuartos-0', 'cuartos-1', 'cuartos-2', 'cuartos-3'], nombre: 'Cuartos', archivo: 'cuartos' },
    { titulo: 'semi', ids: ['semifinal-0', 'semifinal-1'], nombre: 'Semifinal', archivo: 'semifinal' },
    { titulo: 'tercer', ids: ['tercerPuesto-0'], nombre: '3er Puesto', archivo: '3er-puesto' },
    { titulo: 'granfinal', ids: ['final-0'], nombre: 'Final', archivo: 'final' }
  ];
  function geomHistoria(n) {
    const h = n === 4 ? 282 : n === 2 ? 340 : 420, gap = n === 4 ? 30 : 70;
    const total = n * h + (n - 1) * gap, y0 = 340 + (1218 - total) / 2;
    return Array.from({ length: n }, (_, i) => {
      const y = y0 + i * (h + gap), d = Math.round(h * 0.66);
      return { y, h, d, cy: y + h * 0.40, ax: 272, bx: 808, nameY: y + h * 0.915,
        fName: h >= 400 ? 56 : h > 300 ? 48 : 40, fVS: h >= 400 ? 200 : h > 300 ? 170 : 132 };
    });
  }
  const LX0 = 150, LX1 = 930;
  function geomLlave(n) {
    const top = 245, bottom = LLAVE_ALTO - 200, avail = bottom - top, gap = n >= 8 ? 14 : n >= 4 ? 30 : 46;
    const h = Math.min((avail - (n - 1) * gap) / n, n >= 4 ? 150 : n === 2 ? 190 : 230);
    const y0 = top + (avail - (n * h + (n - 1) * gap)) / 2;
    return Array.from({ length: n }, (_, i) => {
      const y = y0 + i * (h + gap), sh = h * 1.08, sw = sh * 0.84, vs = h * 0.78, bh = h * 0.62, f = Math.min(60, h * 0.36);
      return { y, h, cy: y + h / 2, sh, sw, vs, bh, f, d: bh * 0.45,
        aL: LX0 + sw * 0.55, aR: 540 - vs / 2 - 8, bL: 540 + vs / 2 + 8, bR: LX1 - sw * 0.55, pill: Math.max(13, h * 0.14) };
    });
  }
  const indiceCarta = (b) => { const c = actual(b); return c ? CARTAS.findIndex((k) => k.ids.includes(c.id)) : CARTAS.length - 1; };
  const indiceRonda = (b) => { const c = actual(b); return c ? RONDAS.findIndex((r) => r.ids.includes(c.id)) : RONDAS.length - 1; };

  /* =============================================================================
     crear(op): monta las tres vistas en op.raiz.
       op.modo      'operador' | 'pantalla' | 'salida' (la salida solo muestra, sin teclado ni clics)
       op.obtener() devuelve el bracket actual
       op.activo()  ¿la vista está en pantalla y debe atender el teclado?
       op.ensayo    con ?ensayo=1 se puede cambiar un ganador con clic normal y Enter rehace
       op.acciones  { ganador(st, i, lado|null), iniciar(st, i), asignar(st, i, lado), tematica(i, texto), rehacer(st, i), reiniciarResultados() }
       op.selector  { abierto(), grid, cancelar() }  selector de MCs del operador (opcional)
     ============================================================================= */
  function crear(op) {
    const modo = op.modo || 'pantalla';
    const salida = modo === 'salida', operador = modo === 'operador';
    const acc = op.acciones || {};
    const raiz = op.raiz;
    raiz.classList.add('cmft-raiz', 'cmft-modo-' + modo);
    raiz.innerHTML = '';

    /* ----- Vistas ----- */
    const vB = el('div', 'cmft-vista cmft-vista--bracket'), vH = el('div', 'cmft-vista cmft-vista--historias'), vL = el('div', 'cmft-vista cmft-vista--llave');
    raiz.append(vB, vH, vL);
    const hud = el('div', 'cmft-hud cmft-off');
    const inactivo = el('div', 'cmft-inactivo', 'TECLADO INACTIVO · clic para activar');
    const modal = el('div', 'cmft-modal', '<div class="cmft-modal__caja"><b class="cmft-modal__tit"></b><p class="cmft-modal__txt"></p>' +
      '<div class="cmft-modal__acc"><button type="button" class="cmft-btn" data-r="si"></button><button type="button" class="cmft-btn cmft-btn--sec" data-r="no">Cancelar · Esc</button></div></div>');
    modal.hidden = true;
    raiz.append(hud, inactivo, modal);

    /* ===================== BRACKET ===================== */
    const lienzo = el('div', 'cmft-lienzo cmft-bracket');
    lienzo.style.width = W + 'px'; lienzo.style.height = H + 'px'; lienzo.style.backgroundImage = `url("${IMG.fondoH}")`;
    vB.appendChild(lienzo);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'cmft-lineas');
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', lineasBracket()); svg.appendChild(path);
    lienzo.appendChild(svg);
    TITULOS.forEach(([k, cx, top, w]) => {
      const im = el('img', 'cmft-titulo'); im.src = IMG[k]; im.alt = ''; im.draggable = false;
      caja(im, cx - w / 2, top, w); lienzo.appendChild(im);
    });
    const marcoSel = el('div', 'cmft-sel'); lienzo.appendChild(marcoSel);
    const cajas = [];   // { e, nom, c, lado }
    CRUCES.forEach((c) => {
      const [x, top] = posCruce(c.st, c.i);
      const vs = caja(el('div', 'cmft-bvs', 'VS'), x + CW / 2 - 78, top + BH, 156, GAP);
      vs.dataset.id = c.id; lienzo.appendChild(vs);
      ['a', 'b'].forEach((lado) => {
        const e = caja(el('div', 'cmft-box'), x, lado === 'a' ? top : top + BH + GAP, CW, BH);
        const nom = el('span', 'cmft-nom'); e.appendChild(nom);
        e.dataset.id = c.id; e.dataset.lado = lado;
        if (operador && c.st === 'octavos') {
          e.classList.add('cmft-box--edit');
          const lap = el('button', 'cmft-lapiz', LAPIZ); lap.type = 'button'; lap.tabIndex = -1; lap.title = 'Cambiar MC'; lap.dataset.lapiz = '1';
          e.appendChild(lap);
        }
        lienzo.appendChild(e); cajas.push({ e, nom, c, lado });
      });
    });
    const podio = {};
    Object.entries(PODIO).forEach(([k, [x0, y0, x1, y1, rango]]) => {
      const e = caja(el('div', 'cmft-box cmft-pod cmft-pod--' + k), x0, y0, x1 - x0, y1 - y0);
      e.dataset.rango = rango; const nom = el('span', 'cmft-nom'); e.appendChild(nom);
      lienzo.appendChild(e); podio[k] = { e, nom };
    });
    const temas = [0, 1].map((i) => {
      const cx = i === 0 ? 572 : 988;
      const t = caja(el('div', 'cmft-tag'), cx - CW / 2, 350, CW);
      t.appendChild(el('small', null, 'TEMÁTICA'));
      let campo;
      if (operador) {
        campo = el('input', 'cmft-tag__in'); campo.type = 'text'; campo.maxLength = 24; campo.spellcheck = false; campo.autocomplete = 'off'; campo.tabIndex = -1;
        campo.addEventListener('input', () => { const v = campo.value.toUpperCase().slice(0, 24); if (acc.tematica) acc.tematica(i, v); });
        campo.addEventListener('focus', () => { seleccionar('semifinal-' + i, null); });
      } else campo = el('b', 'cmft-tag__txt');
      t.appendChild(campo); lienzo.appendChild(t);
      return campo;
    });
    const panel = el('div', 'cmft-panel',
      '<div class="cmft-panel__fila"><div class="cmft-panel__ronda"></div><div class="cmft-panel__riv"><b class="cmft-panel__a"></b><i>VS</i><b class="cmft-panel__b"></b></div></div>' +
      '<div class="cmft-panel__acc"><button type="button" class="cmft-btn" data-acc="iniciar">Iniciar batalla</button><span class="cmft-panel__tecla">ENTER</span>' +
      '<span class="cmft-panel__estado"></span><button type="button" class="cmft-btn cmft-btn--sec" data-acc="rehacer">Rehacer</button></div>');
    lienzo.appendChild(panel);
    const P = {
      ronda: panel.querySelector('.cmft-panel__ronda'), riv: panel.querySelector('.cmft-panel__riv'),
      a: panel.querySelector('.cmft-panel__a'), b: panel.querySelector('.cmft-panel__b'),
      iniciar: panel.querySelector('[data-acc="iniciar"]'), tecla: panel.querySelector('.cmft-panel__tecla'),
      estado: panel.querySelector('.cmft-panel__estado'), rehacer: panel.querySelector('[data-acc="rehacer"]')
    };
    P.iniciar.hidden = P.rehacer.hidden = true;
    if (!operador) panel.querySelector('.cmft-panel__acc').querySelectorAll('.cmft-btn').forEach((x) => x.remove());   // en pantallas y salida no hay acciones
    lienzo.appendChild(el('div', 'cmft-lema', 'SANGRE, SUDOR Y BARRAS'));

    /* ===================== HISTORIAS ===================== */
    const hWrap = el('div', 'cmft-lienzo cmft-hwrap'); hWrap.style.width = '1080px'; hWrap.style.height = '1920px'; vH.appendChild(hWrap);
    const hCartas = CARTAS.map((carta) => {
      const e = el('div', 'cmft-card'); e.style.backgroundImage = `url("${IMG.fondoV}")`;
      e.innerHTML = `<img class="cmft-logo" src="${IMG.logo}" alt="">`;
      const gs = geomHistoria(carta.ids.length), filas = [];
      carta.ids.forEach((id, k) => {
        const g = gs[k], c = POR_ID[id];
        const bar = el('div', 'cmft-bar'); bar.style.top = g.y + 'px'; bar.style.height = g.h + 'px'; e.appendChild(bar);
        const vs = el('div', 'cmft-cvs', 'VS'); vs.style.left = '540px'; vs.style.top = (g.cy + 6) + 'px'; vs.style.fontSize = g.fVS + 'px'; e.appendChild(vs);
        const lados = {};
        ['a', 'b'].forEach((l) => {
          const cx = l === 'a' ? g.ax : g.bx;
          const w = el('div', 'cmft-lado');
          w.innerHTML = `<div class="cmft-foto" style="left:${cx - g.d / 2}px;top:${g.cy - g.d / 2}px;width:${g.d}px;height:${g.d}px"><img alt=""></div>
            <div class="cmft-pill" style="left:${cx}px;top:${g.cy + g.d / 2 - 22}px">GANADOR</div>
            <div class="cmft-hnom" style="left:${cx}px;top:${g.nameY - g.fName * 0.62}px;font-size:${g.fName}px"><img alt=""><span></span></div>`;
          w.dataset.id = id; w.dataset.lado = l;
          e.appendChild(w);
          lados[l] = { w, img: w.querySelector('.cmft-foto img'), flag: w.querySelector('.cmft-hnom img'), txt: w.querySelector('.cmft-hnom span') };
        });
        filas.push({ c, bar, lados });
      });
      const plate = el('div', 'cmft-plate', `<img src="${IMG[carta.titulo]}" alt="">`); e.appendChild(plate);
      hWrap.appendChild(e);
      return { e, filas };
    });

    /* ===================== LLAVE DE RONDA ===================== */
    const lWrap = el('div', 'cmft-lienzo cmft-lwrap'); lWrap.style.width = LLAVE_ANCHO + 'px'; lWrap.style.height = LLAVE_ALTO + 'px'; vL.appendChild(lWrap);
    const lCartas = RONDAS.map((r) => {
      const e = el('div', 'cmft-lcard'); e.style.height = LLAVE_ALTO + 'px'; e.style.backgroundImage = `url("${IMG.fondo45}")`;
      e.innerHTML = `
        <div class="cmft-lvert" style="left:110px;top:${LLAVE_ALTO / 2}px;transform:translate(-50%,-50%) rotate(-90deg)">COMBATE MORTAL</div>
        <div class="cmft-lvert" style="left:970px;top:${LLAVE_ALTO / 2}px;transform:translate(-50%,-50%) rotate(90deg)">SANGRE, SUDOR Y BARRAS</div>
        <div class="cmft-ltitW"><div class="cmft-ltit"><img src="${IMG[r.titulo]}" alt=""></div></div>
        <img class="cmft-llogo" style="left:106px" src="${IMG.logo}" alt=""><img class="cmft-llogo" style="left:862px" src="${IMG.logo}" alt="">
        <img class="cmft-llogoB" style="top:${LLAVE_ALTO - 182}px" src="${IMG.logo}" alt="">`;
      const gs = geomLlave(r.ids.length), filas = [];
      r.ids.forEach((id, k) => {
        const g = gs[k], c = POR_ID[id];
        const fila = el('div', 'cmft-lfila'); fila.style.height = LLAVE_ALTO + 'px';
        const lados = {};
        ['a', 'b'].forEach((l) => {
          const izq = l === 'a';
          const left = izq ? g.aL : g.bL, width = izq ? g.aR - g.aL : g.bR - g.bL;
          const clip = izq ? `polygon(${g.d}px 0, 100% 0, 100% 100%, 0 100%)` : `polygon(0 0, calc(100% - ${g.d}px) 0, 100% 100%, 0 100%)`;
          const pad = g.sw * 0.45 + 12, fs = g.f, fl = Math.round(fs * 0.72);
          const sx = izq ? LX0 : LX1 - g.sw;
          const w = el('div', 'cmft-lado');
          w.innerHTML = `
            <div class="cmft-lbarW" style="left:${left}px;top:${g.cy - g.bh / 2}px;width:${width}px;height:${g.bh}px">
              <div class="cmft-lbar" style="clip-path:${clip};font-size:${fs}px;justify-content:${izq ? 'flex-end' : 'flex-start'};
                padding:0 ${izq ? 20 : pad}px 0 ${izq ? pad : 20}px;flex-direction:${izq ? 'row' : 'row-reverse'}">
                <img style="width:${fl}px;height:${fl}px" alt=""><span></span></div></div>
            <div class="cmft-lesc" style="left:${sx}px;top:${g.cy - g.sh / 2}px;width:${g.sw}px;height:${g.sh}px">
              <div class="cmft-lesc__borde"></div><div class="cmft-lesc__in"><img alt=""></div></div>
            <div class="cmft-lpill" style="left:${sx + g.sw / 2}px;top:${g.cy + g.sh / 2 - g.pill * 1.7}px;font-size:${g.pill}px">GANADOR</div>`;
          w.dataset.id = id; w.dataset.lado = l;
          fila.appendChild(w);
          lados[l] = { w, img: w.querySelector('.cmft-lesc img'), flag: w.querySelector('.cmft-lbar img'), txt: w.querySelector('.cmft-lbar span') };
        });
        const vs = el('div', 'cmft-lvs', `<b style="font-size:${g.vs * 0.62}px">VS</b>`);
        vs.style.cssText = `left:${540 - g.vs / 2}px;top:${g.cy - g.vs / 2}px;width:${g.vs}px;height:${g.vs}px`;
        fila.appendChild(vs);
        e.appendChild(fila); filas.push({ c, fila, lados });
      });
      lWrap.appendChild(e);
      return { e, filas };
    });

    /* ===================== ESTADO DE LA VISTA ===================== */
    const CLAVE_SEL = 'cmf-torneo-seleccion-v1';
    let vista = 'bracket', idxH = 0, idxL = 0, ultimaFirma = null;
    let sel = null;   // { id, lado } — la selección propia (no depende del foco del DOM)
    const recuerdo = {};   // último cruce visitado en cada columna (para empates al cambiar de columna)
    if (!salida) {
      try { const s = JSON.parse(sessionStorage.getItem(CLAVE_SEL) || 'null'); if (s && POR_ID[s.id]) sel = { id: s.id, lado: s.lado === 'a' || s.lado === 'b' ? s.lado : null }; } catch (e) { sel = null; }
    }
    function guardarSel() { try { sessionStorage.setItem(CLAVE_SEL, JSON.stringify(sel)); } catch (e) { /* sin sessionStorage */ } }
    const B = () => op.obtener() || vacio();
    /* La casilla (Tab) solo existe en octavos del operador, mientras el cruce no tenga ganador. */
    const casillaValida = (id, lado) => !!lado && operador && POR_ID[id].st === 'octavos' && !cruce(B(), POR_ID[id]).winner;

    function seleccionar(id, lado) {
      if (salida || !POR_ID[id]) return;
      const nuevo = { id, lado: casillaValida(id, lado) ? lado : null };
      if (sel && sel.id === nuevo.id && sel.lado === nuevo.lado) return;
      sel = nuevo; guardarSel(); pintarSel();
    }

    /* ===================== PINTAR ===================== */
    function pintarBracket(b) {
      const cur = actual(b);
      cajas.forEach(({ e, nom, c, lado }) => {
        const m = cruce(b, c), d = mc(m[lado]);
        nom.textContent = d ? d.nombre : '';
        e.classList.toggle('cmft-lleno', !!d);
        e.classList.toggle('cmft-gana', !!m.winner && m.winner === lado);
        e.classList.toggle('cmft-pierde', !!m.winner && m.winner !== lado);
        e.classList.toggle('cmft-toca', !!cur && cur.id === c.id);
        e.classList.toggle('cmft-clic', !salida && listo(b, c) && (!m.winner || op.ensayo));
        e.classList.toggle('cmft-box--vacia', operador && c.st === 'octavos' && !m.winner && !d);
        e.classList.toggle('cmft-box--fija', !!m.winner);
      });
      const fin = cruce(b, POR_ID['final-0']), ter = cruce(b, POR_ID['tercerPuesto-0']);
      [['oro', ganadorDe(fin)], ['plata', perdedorDe(fin)], ['bronce', ganadorDe(ter)]].forEach(([k, n]) => {
        const d = mc(n); podio[k].nom.textContent = d ? d.nombre : ''; podio[k].e.classList.toggle('cmft-lleno', !!d);
      });
      temas.forEach((t, i) => {
        const v = (b.semifinal && b.semifinal[i] && b.semifinal[i].theme) || '';
        if (operador) { if (document.activeElement !== t && t.value !== v) t.value = v; } else t.textContent = v;
      });
    }
    function pintarSel() {
      const b = B();
      cajas.forEach(({ e, c, lado }) => e.classList.toggle('cmft-casilla', !!sel && sel.id === c.id && sel.lado === lado));
      if (sel && !salida) {
        const [x, top] = posCruce(POR_ID[sel.id].st, POR_ID[sel.id].i);
        caja(marcoSel, x - 13, top - 13, CW + 26, 2 * BH + GAP + 26);
        marcoSel.classList.add('cmft-on');
      } else marcoSel.classList.remove('cmft-on');
      /* Panel: ronda y rivales del cruce SELECCIONADO (si no hay selección, del combate que toca). */
      const c = (sel && POR_ID[sel.id]) || actual(b) || (cruce(b, POR_ID['final-0']).winner ? POR_ID['final-0'] : null);   // torneo terminado: la final
      if (!c) { panel.classList.add('cmft-off'); P.iniciar.hidden = P.rehacer.hidden = true; return; }
      panel.classList.remove('cmft-off');
      const m = cruce(b, c), da = mc(m.a), db = mc(m.b);
      P.ronda.textContent = RONDA[c.st];
      P.a.textContent = da ? da.nombre : 'Por definir';
      P.b.textContent = db ? db.nombre : 'Por definir';
      P.a.classList.toggle('cmft-pierde', !!m.winner && m.winner !== 'a');
      P.b.classList.toggle('cmft-pierde', !!m.winner && m.winner !== 'b');
      const puede = operador && !!(m.a && m.b) && !m.winner;
      P.iniciar.hidden = !puede; P.tecla.hidden = !puede;
      P.rehacer.hidden = !(operador && op.ensayo && m.winner);
      P.estado.textContent = m.winner ? 'GANA ' + (mc(ganadorDe(m)) || { nombre: '' }).nombre : (!(m.a && m.b) ? 'ESPERANDO RIVALES' : (operador ? '' : 'POR JUGAR'));
      P.estado.hidden = !P.estado.textContent;
      if (operador && c.st === 'octavos' && !m.winner && sel && sel.id === c.id) {
        P.tecla.hidden = false;
        P.tecla.textContent = sel.lado ? 'ENTER · CAMBIAR MC' : (puede ? 'ENTER · TAB CASILLA' : 'ENTER · ELEGIR MC');
      } else P.tecla.textContent = 'ENTER';
      achicar(P.a, 170); achicar(P.b, 170);
    }
    function pintarLado(L, m, lado, ok) {
      const d = mc(m[lado]), src = d ? d.foto : IMG.silueta;
      if (L.img.getAttribute('src') !== src) L.img.src = src;
      L.img.style.objectPosition = (d && ENCUADRE[d.slug]) || '50% 50%';
      L.txt.textContent = d ? d.nombre.toUpperCase() : 'POR DEFINIR';
      L.flag.style.display = d && d.bandera ? '' : 'none';
      if (d && d.bandera && L.flag.getAttribute('src') !== d.bandera) L.flag.src = d.bandera;
      L.w.classList.toggle('cmft-clic', !salida && ok && (!m.winner || op.ensayo));
      L.w.classList.toggle('cmft-gana', !!m.winner && m.winner === lado);
      L.w.classList.toggle('cmft-pierde', !!m.winner && m.winner !== lado);
    }
    function pintarHistorias(b) {
      const cur = actual(b);
      hCartas.forEach((v) => v.filas.forEach(({ c, bar, lados }) => {
        bar.classList.toggle('cmft-toca', !!cur && cur.id === c.id);
        const m = cruce(b, c), ok = listo(b, c);
        pintarLado(lados.a, m, 'a', ok); pintarLado(lados.b, m, 'b', ok);
      }));
      hCartas.forEach((v, i) => v.e.classList.toggle('cmft-on', i === idxH));
    }
    function pintarLlave(b) {
      const cur = actual(b);
      lCartas.forEach((v) => v.filas.forEach(({ c, fila, lados }) => {
        fila.classList.toggle('cmft-toca', !!cur && cur.id === c.id);
        const m = cruce(b, c), ok = listo(b, c);
        pintarLado(lados.a, m, 'a', ok); pintarLado(lados.b, m, 'b', ok);
      }));
      lCartas.forEach((v, i) => v.e.classList.toggle('cmft-on', i === idxL));
    }
    function ajustarBracket() {
      cajas.concat(Object.values(podio)).forEach(({ e, nom }) => {
        if (!e.clientWidth) return;
        const cs = getComputedStyle(e);
        achicar(nom, (e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.96);
      });
    }
    function ajustarLlave() {
      const v = lCartas[idxL]; if (!v || vista !== 'llave') return;
      v.filas.forEach(({ lados }) => ['a', 'b'].forEach((l) => {
        const bar = lados[l].txt.parentElement, sp = lados[l].txt;
        const cs = getComputedStyle(bar), fl = lados[l].flag.style.display === 'none' ? 0 : lados[l].flag.offsetWidth + 10;
        achicar(sp, bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - fl - 4);
      }));
    }
    /* seguir: true = historias y llave saltan a la ronda que toca; sin valor, saltan solo si cambió algún resultado. */
    function pintar(seguir) {
      const b = B(), f = firma(b);
      if (seguir === undefined) seguir = f !== ultimaFirma;
      ultimaFirma = f;
      if (seguir) { idxH = indiceCarta(b); idxL = indiceRonda(b); }
      if (!salida && !sel) { const c = actual(b); sel = { id: c ? c.id : 'octavos-0', lado: null }; guardarSel(); }
      if (sel && sel.lado && !casillaValida(sel.id, sel.lado)) { sel.lado = null; guardarSel(); }
      pintarBracket(b); pintarHistorias(b); pintarLlave(b); pintarSel();
      if (vista === 'bracket') ajustarBracket(); else if (vista === 'llave') ajustarLlave();
    }

    /* ===================== ESCALA ===================== */
    function escalar() {
      const w = raiz.clientWidth, h = raiz.clientHeight;
      if (!w || !h) return;
      [[lienzo, W, H], [hWrap, 1080, 1920], [lWrap, LLAVE_ANCHO, LLAVE_ALTO]].forEach(([e, ew, eh]) => {
        const s = Math.min(w / ew, h / eh);
        e.style.transform = `translate(${(w - ew * s) / 2}px, ${(h - eh * s) / 2}px) scale(${s})`;
      });
    }
    /* Al mostrarse la pantalla (o cambiar la ventana) se reescala y se vuelven a medir los nombres. */
    function reajustar() { escalar(); if (vista === 'bracket') ajustarBracket(); else if (vista === 'llave') ajustarLlave(); pintarSel(); }
    if (window.ResizeObserver) new ResizeObserver(reajustar).observe(raiz);
    window.addEventListener('resize', reajustar);

    /* ===================== VISTAS ===================== */
    const ORDEN = ['bracket', 'historias', 'llave'];
    let hudT = null;
    function aviso(t) { hud.textContent = t; hud.classList.remove('cmft-off'); clearTimeout(hudT); hudT = setTimeout(() => hud.classList.add('cmft-off'), 4000); }
    function mostrar(v, conAviso) {
      vista = ORDEN.includes(v) ? v : 'bracket';
      vB.classList.toggle('cmft-on', vista === 'bracket');
      vH.classList.toggle('cmft-on', vista === 'historias');
      vL.classList.toggle('cmft-on', vista === 'llave');
      if (op.alCambiarVista) op.alCambiarVista(vista);
      escalar();
      if (vista !== 'bracket') { const b = B(); idxH = indiceCarta(b); idxL = indiceRonda(b); }
      pintar(false);
      if (conAviso === false || salida) return;
      aviso(vista === 'historias' ? `HISTORIAS · ${CARTAS[idxH].nombre} — siguen solas al torneo · ← → otra ronda · E = PNG · V = llave de ronda`
        : vista === 'llave' ? `LLAVE DE RONDA · ${RONDAS[idxL].nombre} — sigue sola al torneo · ← → otra ronda · E = PNG · V = bracket`
          : 'BRACKET · flechas = moverse · Enter = iniciar / elegir MC · V = historias · F = pantalla completa');
    }

    /* ===================== ACCIONES ===================== */
    /* Clic en un nombre o una foto: marca ganador solo si el cruce no tiene ganador; cambiarlo exige Shift+clic o ?ensayo=1. */
    function clicGanador(id, lado, shift) {
      const c = POR_ID[id], b = B(), m = cruce(b, c);
      if (!listo(b, c) || !acc.ganador) return;
      if (!m.winner) acc.ganador(c.st, c.i, lado);
      else if (shift || op.ensayo) acc.ganador(c.st, c.i, m.winner === lado ? null : lado);
      else aviso('Este cruce ya tiene ganador · para cambiarlo: Shift + clic');
    }
    function accionar() {
      if (!sel) return;
      const c = POR_ID[sel.id], b = B(), m = cruce(b, c);
      if (m.winner) { if (op.ensayo && acc.rehacer) acc.rehacer(c.st, c.i); return; }
      if (operador && c.st === 'octavos' && acc.asignar) {
        if (sel.lado) return acc.asignar(c.st, c.i, sel.lado);
        if (!m.a) return acc.asignar(c.st, c.i, 'a');
        if (!m.b) return acc.asignar(c.st, c.i, 'b');
      }
      if (m.a && m.b && acc.iniciar) acc.iniciar(c.st, c.i);
    }
    function mover(dir) {
      if (!sel) return;
      const [c, r] = COL_DE[sel.id];
      let nuevo = sel.id;
      if (dir === 'ArrowUp') nuevo = COLS[c][Math.max(0, r - 1)];
      else if (dir === 'ArrowDown') nuevo = COLS[c][Math.min(COLS[c].length - 1, r + 1)];
      else {
        const c2 = c + (dir === 'ArrowRight' ? 1 : -1);
        if (c2 < 0 || c2 >= COLS.length) return;   // en los bordes se queda
        let mejor = null, dmin = Infinity;
        COLS[c2].forEach((id) => {
          const d = Math.abs(CY[id] - CY[sel.id]);
          if (d < dmin - 0.5 || (Math.abs(d - dmin) <= 0.5 && id === recuerdo[c2])) { dmin = d; mejor = id; }
        });
        nuevo = mejor;
      }
      if (nuevo === sel.id) return;
      recuerdo[c] = sel.id;
      seleccionar(nuevo, null);
    }
    function casilla(atras) {
      if (!sel || !operador || POR_ID[sel.id].st !== 'octavos' || cruce(B(), POR_ID[sel.id]).winner) return;
      const orden = atras ? { null: 'b', b: 'a', a: 'b' } : { null: 'a', a: 'b', b: 'a' };
      seleccionar(sel.id, orden[sel.lado]);
    }
    function editarTematica() {
      if (!operador || !sel || POR_ID[sel.id].st !== 'semifinal') { aviso('E edita la temática: selecciona una semifinal'); return; }
      const t = temas[POR_ID[sel.id].i];
      t.focus(); t.select();   // lo que se escriba reemplaza la palabra; las flechas mueven el cursor dentro del campo
    }
    function pantallaCompleta() {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* no permitido */ }
    }
    let alConfirmar = null;
    function confirmar(tit, txt, si, fn) {
      modal.querySelector('.cmft-modal__tit').textContent = tit;
      modal.querySelector('.cmft-modal__txt').textContent = txt;
      modal.querySelector('[data-r="si"]').textContent = si;
      alConfirmar = fn; modal.hidden = false; enfocar();
    }
    function cerrarModal(ok) {
      const fn = alConfirmar; alConfirmar = null; modal.hidden = true; enfocar();
      if (ok && fn) fn();
    }
    function reiniciar() {
      if (!acc.reiniciarResultados) return;
      confirmar('¿Reiniciar los resultados del torneo?', 'Se borran todos los ganadores. El sorteo de octavos se mantiene.', 'Sí, reiniciar · Enter', () => { acc.reiniciarResultados(); aviso('Resultados reiniciados'); });
    }
    /* Exportar la pieza actual como PNG del tamaño del lienzo (dibujada con canvas). */
    async function exportar() {
      if (vista === 'bracket') return;
      try {
        await Promise.all([document.fonts.load('60px "Bebas Neue"'), document.fonts.ready]);
        const blob = vista === 'historias' ? await dibujarHistoria() : await dibujarLlave();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = vista === 'historias' ? `cmf-historia-${CARTAS[idxH].archivo}.png` : `cmf-llave-${RONDAS[idxL].archivo}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        aviso('PNG descargado · ' + a.download);
      } catch (e) { aviso('No se pudo exportar el PNG (abre la página desde el servidor, no como archivo)'); }
    }
    const perdedorCSS = () => getComputedStyle(document.documentElement).getPropertyValue('--cmft-perdedor').trim() || 'grayscale(1) brightness(.3)';
    async function dibujarHistoria() {
      const carta = CARTAS[idxH], gs = geomHistoria(carta.ids.length), b = B();
      const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
      const c = cv.getContext('2d');
      const fondo = await cargar(IMG.fondoV); if (fondo) c.drawImage(fondo, 0, 0, 1080, 1920);
      const lg = await cargar(IMG.logo); if (lg) c.drawImage(lg, 425, 96, 230, 230 * lg.height / lg.width);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let k = 0; k < carta.ids.length; k++) {
        const g = gs[k], m = cruce(b, POR_ID[carta.ids[k]]);
        const gr = c.createLinearGradient(0, g.y, 0, g.y + g.h); gr.addColorStop(0, 'rgba(10,26,74,.85)'); gr.addColorStop(1, 'rgba(3,8,26,.9)');
        c.save(); c.shadowColor = 'rgba(30,144,255,.6)'; c.shadowBlur = 28; rr(c, 110, g.y, 860, g.h, 10); c.fillStyle = gr; c.fill(); c.restore();
        rr(c, 110, g.y, 860, g.h, 10); c.strokeStyle = 'rgba(222,236,255,.85)'; c.lineWidth = 3; c.stroke();
        c.save(); c.font = `${g.fVS}px ${FUENTE}`; c.fillStyle = '#1552c9'; c.fillText('VS', 547, g.cy + 13);
        c.fillStyle = '#fff'; c.shadowColor = 'rgba(30,144,255,.8)'; c.shadowBlur = 30; c.fillText('VS', 540, g.cy + 6); c.restore();
        for (const l of ['a', 'b']) {
          const d = mc(m[l]), cx = l === 'a' ? g.ax : g.bx, r = g.d / 2, gana = m.winner === l, pierde = !!m.winner && m.winner !== l;
          const im = await cargar(d ? d.foto : IMG.silueta);
          c.save(); c.beginPath(); c.arc(cx, g.cy, r, 0, Math.PI * 2); c.clip();
          if (pierde) c.filter = perdedorCSS();
          if (im) c.drawImage(im, cx - r, g.cy - r, g.d, g.d);
          c.restore();
          c.save(); c.beginPath(); c.arc(cx, g.cy, r, 0, Math.PI * 2); c.lineWidth = gana ? 9 : 5;
          c.strokeStyle = gana ? '#bfe4ff' : 'rgba(200,222,255,.9)'; c.shadowColor = '#1e90ff'; c.shadowBlur = gana ? 45 : 18; c.stroke(); c.restore();
          c.save(); c.globalAlpha = pierde ? 0.4 : 1; c.font = `${g.fName}px ${FUENTE}`;
          const t = d ? d.nombre.toUpperCase() : 'POR DEFINIR', tw = c.measureText(t).width, fw = d && d.bandera ? 46 : 0;
          c.shadowColor = '#1e90ff'; c.shadowBlur = 12; c.fillStyle = '#fff'; c.fillText(t, cx + fw / 2, g.nameY);
          if (d && d.bandera) {
            const fl = await cargar(d.bandera); c.shadowBlur = 0; const fx = cx + fw / 2 - tw / 2 - 29;
            if (fl) { c.save(); c.beginPath(); c.arc(fx, g.nameY - 2, 17, 0, Math.PI * 2); c.clip(); c.drawImage(fl, fx - 17, g.nameY - 19, 34, 34); c.restore(); }
          }
          c.restore();
          if (gana) {
            c.save(); c.font = `30px ${FUENTE}`; const pw = c.measureText('GANADOR').width + 50, py = g.cy + r - 22;
            const pg = c.createLinearGradient(0, py, 0, py + 40); pg.addColorStop(0, '#fff'); pg.addColorStop(0.45, '#cfe6ff'); pg.addColorStop(0.55, '#7fb8ff'); pg.addColorStop(1, '#e8f3ff');
            c.shadowColor = '#1e90ff'; c.shadowBlur = 20; rr(c, cx - pw / 2, py, pw, 40, 20); c.fillStyle = pg; c.fill();
            c.shadowBlur = 0; c.fillStyle = '#04102e'; c.fillText('GANADOR', cx, py + 22); c.restore();
          }
        }
      }
      const pg = c.createLinearGradient(0, 1610, 0, 1770); pg.addColorStop(0, 'rgba(10,26,74,.85)'); pg.addColorStop(1, 'rgba(3,8,26,.92)');
      c.save(); c.shadowColor = 'rgba(30,144,255,.6)'; c.shadowBlur = 30; rr(c, 190, 1610, 700, 160, 12); c.fillStyle = pg; c.fill(); c.restore();
      rr(c, 190, 1610, 700, 160, 12); c.strokeStyle = 'rgba(222,236,255,.85)'; c.lineWidth = 3; c.stroke();
      const ti = await cargar(IMG[carta.titulo]); if (ti) { const tw = 104 * ti.width / ti.height; c.drawImage(ti, 540 - tw / 2, 1638, tw, 104); }
      return new Promise((res, rej) => cv.toBlob((bl) => (bl ? res(bl) : rej(new Error('png'))), 'image/png'));
    }
    const escudo = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h * 0.72], [x + w / 2, y + h], [x, y + h * 0.72]];
    async function dibujarLlave() {
      const r = RONDAS[idxL], gs = geomLlave(r.ids.length), b = B();
      const cv = document.createElement('canvas'); cv.width = LLAVE_ANCHO; cv.height = LLAVE_ALTO;
      const c = cv.getContext('2d');
      const fondo = await cargar(IMG.fondo45); if (fondo) c.drawImage(fondo, 0, 0, LLAVE_ANCHO, LLAVE_ALTO);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.save(); c.font = `42px ${FUENTE}`; c.fillStyle = 'rgba(143,208,255,.22)';
      c.translate(110, LLAVE_ALTO / 2); c.rotate(-Math.PI / 2); c.fillText('C O M B A T E   M O R T A L', 0, 0); c.restore();
      c.save(); c.font = `42px ${FUENTE}`; c.fillStyle = 'rgba(143,208,255,.22)';
      c.translate(970, LLAVE_ALTO / 2); c.rotate(Math.PI / 2); c.fillText('S A N G R E ,   S U D O R   Y   B A R R A S', 0, 0); c.restore();
      const tg = c.createLinearGradient(0, 106, 0, 204); tg.addColorStop(0, '#1f5fd6'); tg.addColorStop(0.55, '#0b2a7a'); tg.addColorStop(1, '#04123a');
      c.save(); c.shadowColor = 'rgba(30,144,255,.85)'; c.shadowBlur = 18;
      poly(c, [[260, 106], [850, 106], [820, 204], [230, 204]]); c.fillStyle = tg; c.fill(); c.restore();
      const ti = await cargar(IMG[r.titulo]); if (ti) { const tw = 74 * ti.width / ti.height; c.drawImage(ti, 540 - tw / 2, 118, tw, 74); }
      const lg = await cargar(IMG.logo);
      if (lg) { const lh = 112 * lg.height / lg.width; c.drawImage(lg, 106, 100, 112, lh); c.drawImage(lg, 862, 100, 112, lh); c.drawImage(lg, 500, LLAVE_ALTO - 182, 80, 80 * lg.height / lg.width); }
      for (let k = 0; k < r.ids.length; k++) {
        const g = gs[k], m = cruce(b, POR_ID[r.ids[k]]);
        for (const l of ['a', 'b']) {
          const izq = l === 'a', d = mc(m[l]), gana = m.winner === l, pierde = !!m.winner && m.winner !== l;
          const x0 = izq ? g.aL : g.bL, x1 = izq ? g.aR : g.bR, y0 = g.cy - g.bh / 2, y1 = g.cy + g.bh / 2;
          const pts = izq ? [[x0 + g.d, y0], [x1, y0], [x1, y1], [x0, y1]] : [[x0, y0], [x1 - g.d, y0], [x1, y1], [x0, y1]];
          const bg = c.createLinearGradient(0, y0, 0, y1);
          if (gana) { bg.addColorStop(0, '#8fd0ff'); bg.addColorStop(0.45, '#2f86ff'); bg.addColorStop(1, '#0d3faa'); }
          else if (pierde) { bg.addColorStop(0, '#2b3446'); bg.addColorStop(1, '#0d121e'); }
          else { bg.addColorStop(0, '#2a72f0'); bg.addColorStop(0.5, '#0d3796'); bg.addColorStop(1, '#061b55'); }
          c.save(); c.shadowColor = gana ? '#8fd0ff' : 'rgba(30,144,255,.7)'; c.shadowBlur = pierde ? 0 : gana ? 18 : 10; poly(c, pts); c.fillStyle = bg; c.fill(); c.restore();
          c.save(); poly(c, pts); c.clip(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x0, y0, x1 - x0, 3); c.restore();
          c.save(); c.globalAlpha = pierde ? 0.5 : 1; c.font = `${g.f}px ${FUENTE}`; c.textAlign = izq ? 'right' : 'left';
          const t = d ? d.nombre.toUpperCase() : 'POR DEFINIR', fl = Math.round(g.f * 0.72);
          const disp = (x1 - x0) - (g.sw * 0.45 + 12) - 20 - (d && d.bandera ? fl + 10 : 0) - 4;
          if (c.measureText(t).width > disp) c.font = `${g.f * disp / c.measureText(t).width}px ${FUENTE}`;
          const tw2 = c.measureText(t).width, tx = izq ? x1 - 20 : x0 + 20;
          c.shadowColor = '#1e90ff'; c.shadowBlur = 10; c.fillStyle = '#fff'; c.fillText(t, tx, g.cy + 2);
          if (d && d.bandera) {
            const fi = await cargar(d.bandera), fx = izq ? tx - tw2 - 10 - fl / 2 : tx + tw2 + 10 + fl / 2;
            c.shadowBlur = 0;
            if (fi) { c.save(); c.beginPath(); c.arc(fx, g.cy, fl / 2, 0, Math.PI * 2); c.clip(); c.drawImage(fi, fx - fl / 2, g.cy - fl / 2, fl, fl); c.restore(); }
          }
          c.restore();
          const sx = izq ? LX0 : LX1 - g.sw, sy = g.cy - g.sh / 2;
          c.save(); c.shadowColor = gana ? '#8fd0ff' : 'rgba(30,144,255,.85)'; c.shadowBlur = gana ? 20 : 10;
          poly(c, escudo(sx, sy, g.sw, g.sh)); c.fillStyle = pierde ? '#5b6b86' : '#dbe9ff'; c.fill(); c.restore();
          const im = await cargar(d ? d.foto : IMG.silueta);
          c.save(); poly(c, escudo(sx + 4, sy + 4, g.sw - 8, g.sh - 8)); c.clip();
          if (pierde) c.filter = perdedorCSS();
          const side = Math.max(g.sw, g.sh); if (im) c.drawImage(im, sx + g.sw / 2 - side / 2, sy + g.sh / 2 - side / 2, side, side); c.restore();
          if (gana) {
            c.save(); c.font = `${g.pill}px ${FUENTE}`; const pw = c.measureText('GANADOR').width + 34, ph = g.pill * 1.5, px = sx + g.sw / 2, py = g.cy + g.sh / 2 - g.pill * 1.7;
            const pg = c.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, '#fff'); pg.addColorStop(0.45, '#cfe6ff'); pg.addColorStop(0.55, '#7fb8ff'); pg.addColorStop(1, '#e8f3ff');
            c.shadowColor = '#1e90ff'; c.shadowBlur = 14; rr(c, px - pw / 2, py, pw, ph, ph / 2); c.fillStyle = pg; c.fill();
            c.shadowBlur = 0; c.fillStyle = '#04102e'; c.textAlign = 'center'; c.fillText('GANADOR', px, py + ph / 2 + 1); c.restore();
          }
        }
        c.save(); c.shadowColor = 'rgba(30,144,255,.8)'; c.shadowBlur = 14; c.fillStyle = '#040a1c';
        c.fillRect(540 - g.vs / 2, g.cy - g.vs / 2, g.vs, g.vs); c.restore();
        c.strokeStyle = 'rgba(222,236,255,.9)'; c.lineWidth = 3; c.strokeRect(540 - g.vs / 2, g.cy - g.vs / 2, g.vs, g.vs);
        c.save(); c.font = `${g.vs * 0.62}px ${FUENTE}`; c.textAlign = 'center';
        const vg = c.createLinearGradient(0, g.cy - g.vs * 0.3, 0, g.cy + g.vs * 0.3); vg.addColorStop(0, '#fff'); vg.addColorStop(0.45, '#cfd9e8'); vg.addColorStop(0.52, '#7d8da6'); vg.addColorStop(1, '#fff');
        c.fillStyle = '#0b2a7a'; c.fillText('VS', 540, g.cy + 5); c.fillStyle = vg; c.fillText('VS', 540, g.cy + 3); c.restore();
      }
      return new Promise((res, rej) => cv.toBlob((bl) => (bl ? res(bl) : rej(new Error('png'))), 'image/png'));
    }

    /* ===================== TECLADO (un solo escuchador, en captura) ===================== */
    /* Quita el foco de cualquier botón o campo: el teclado queda en la ventana y lo atiende este escuchador. */
    function enfocar() {
      const a = document.activeElement;
      if (a && a !== document.body && typeof a.blur === 'function') a.blur();
      pintarAviso();
    }
    const parar = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
    const esCampo = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

    function teclaSelector(e) {
      const k = e.key, grid = op.selector.grid;
      if (k === 'Escape') { parar(e); op.selector.cancelar(); enfocar(); return; }
      if (k === 'Tab') { parar(e); return; }
      const todas = Array.prototype.slice.call(grid.querySelectorAll('.fighter-card'));
      const libres = todas.filter((t) => !t.disabled);
      if (!libres.length) { if (/^(Arrow|Enter| )/.test(k)) parar(e); return; }
      let cur = grid.querySelector('.cmft-psel');
      if (!cur || cur.disabled) cur = libres[0];
      if (k === 'Enter' || k === ' ') { parar(e); if (!e.repeat) cur.click(); return; }
      if (!/^Arrow(Left|Right|Up|Down)$/.test(k)) return;
      parar(e);
      let sig = cur;
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        const i = libres.indexOf(cur), j = i + (k === 'ArrowRight' ? 1 : -1);
        if (j >= 0 && j < libres.length) sig = libres[j];
      } else {
        const rc = cur.getBoundingClientRect(), cx = rc.left + rc.width / 2, abajo = k === 'ArrowDown';
        const cand = libres.map((t) => ({ t, r: t.getBoundingClientRect() }))
          .filter(({ r }) => (abajo ? r.top > rc.top + 5 : r.top < rc.top - 5))
          .sort((p, q) => (abajo ? p.r.top - q.r.top : q.r.top - p.r.top) || Math.abs(p.r.left + p.r.width / 2 - cx) - Math.abs(q.r.left + q.r.width / 2 - cx));
        if (cand.length) sig = cand[0].t;
      }
      marcarSelector(sig);
    }
    function marcarSelector(t) {
      if (!op.selector) return;
      op.selector.grid.querySelectorAll('.cmft-psel').forEach((x) => x.classList.remove('cmft-psel'));
      if (t) { t.classList.add('cmft-psel'); try { t.scrollIntoView({ block: 'nearest' }); } catch (e) { /* sin scroll */ } }
    }
    function alAbrirSelector(nombre) {
      if (!op.selector) return;
      const todas = Array.prototype.slice.call(op.selector.grid.querySelectorAll('.fighter-card'));
      const libres = todas.filter((t) => !t.disabled);
      marcarSelector(libres.find((t) => t.dataset.name === nombre) || libres[0] || null);
      enfocar();
    }

    function tecla(e) {
      if (salida || !op.activo()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key, t = document.activeElement;
      /* 1. Campo de texto: las teclas son del campo; Enter confirma y Esc sale. La selección vuelve sola al bracket. */
      if (esCampo(t)) {
        if (k === 'Enter' || k === 'Escape') { parar(e); t.blur(); enfocar(); }
        return;
      }
      /* 2. Confirmación abierta: Enter = sí, Esc = no; nada más pasa. */
      if (!modal.hidden) {
        if (k === 'F11' || k === 'F5') return;
        parar(e);
        if (e.repeat) return;
        if (k === 'Enter') cerrarModal(true); else if (k === 'Escape') cerrarModal(false);
        return;
      }
      /* 3. Selector de MCs abierto. */
      if (op.selector && op.selector.abierto()) { teclaSelector(e); return; }
      /* 4. Las vistas. */
      const flecha = /^Arrow(Left|Right|Up|Down)$/.test(k);
      if (flecha && e.shiftKey) return;   // Shift + flechas es del operador (mover el bloque de la transmisión)
      const kl = k.length === 1 ? k.toLowerCase() : k;
      if (k === 'R' && e.shiftKey) { parar(e); if (!e.repeat) reiniciar(); return; }
      if (kl === 'v' && !e.shiftKey) { parar(e); if (!e.repeat) mostrar(ORDEN[(ORDEN.indexOf(vista) + 1) % ORDEN.length]); return; }
      if (kl === 'f' && !e.shiftKey) { parar(e); if (!e.repeat) pantallaCompleta(); return; }
      if (vista === 'bracket') {
        if (flecha) { parar(e); mover(k); return; }
        if (k === 'Enter' || k === ' ') { parar(e); if (!e.repeat) accionar(); return; }
        if (k === 'Tab') { parar(e); casilla(e.shiftKey); return; }
        if (k === 'Escape') { parar(e); if (sel && sel.lado) seleccionar(sel.id, null); return; }
        if (kl === 'e' && !e.shiftKey) { parar(e); if (!e.repeat) editarTematica(); return; }
        return;
      }
      /* historias y llave */
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        parar(e);
        const d = k === 'ArrowRight' ? 1 : -1;
        if (vista === 'historias') { idxH = Math.max(0, Math.min(CARTAS.length - 1, idxH + d)); pintar(false); aviso(CARTAS[idxH].nombre); }
        else { idxL = Math.max(0, Math.min(RONDAS.length - 1, idxL + d)); pintar(false); aviso(RONDAS[idxL].nombre); }
        return;
      }
      if (flecha || k === 'Enter' || k === ' ' || k === 'Tab' || k === 'Escape') { parar(e); return; }
      if (kl === 'e' && !e.shiftKey) { parar(e); if (!e.repeat) exportar(); }
    }
    /* El botón con foco se activaría al soltar Espacio o Enter: en el torneo, nunca. */
    function teclaArriba(e) {
      if (salida || !op.activo()) return;
      if ((e.key === ' ' || e.key === 'Enter') && !esCampo(document.activeElement)) e.preventDefault();
    }

    /* ===================== RATÓN ===================== */
    /* Si la ventana estaba sin foco, el clic que la activa no hace nada más. */
    let sinFoco = !document.hasFocus(), tragarHasta = 0, tragando = 0, ratonDentro = false;
    /* En el operador el aviso sale siempre que la ventana pierde el foco. En torneo.html (pantallas y redes) solo con el
       ratón encima, para que no aparezca en una pantalla que nadie está manejando. */
    function pintarAviso() { inactivo.classList.toggle('cmft-on', !salida && op.activo() && !document.hasFocus() && (operador || ratonDentro)); }
    function filtroClic(e) {
      if (salida || !op.activo()) return;
      if (e.type === 'pointerdown' || e.type === 'mousedown') {
        if (sinFoco || !document.hasFocus() || Date.now() < tragarHasta) tragando = Date.now() + 1000;
      }
      if (Date.now() < tragando) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === 'click') { tragando = 0; tragarHasta = 0; sinFoco = false; pintarAviso(); }
      }
    }
    function clic(e) {
      if (salida) return;
      const lap = e.target.closest('[data-lapiz]');
      const box = e.target.closest('.cmft-box[data-id]'), lado = e.target.closest('.cmft-lado[data-id]'), vs = e.target.closest('.cmft-bvs[data-id]');
      const btn = e.target.closest('.cmft-btn[data-acc]'), mod = e.target.closest('.cmft-modal [data-r]');
      if (mod) { cerrarModal(mod.dataset.r === 'si'); return; }
      if (btn) {
        btn.blur();
        if (btn.dataset.acc === 'iniciar') accionarPanel('iniciar'); else if (btn.dataset.acc === 'rehacer') accionarPanel('rehacer');
        return;
      }
      if (lap && box) {
        const c = POR_ID[box.dataset.id];
        seleccionar(c.id, box.dataset.lado);
        if (acc.asignar && !cruce(B(), c).winner) acc.asignar(c.st, c.i, box.dataset.lado);
        return;
      }
      if (box) {
        const c = POR_ID[box.dataset.id], l = box.dataset.lado, m = cruce(B(), c);
        seleccionar(c.id, null);
        if (operador && c.st === 'octavos' && !m.winner && !m[l] && acc.asignar) { acc.asignar(c.st, c.i, l); return; }   // casilla vacía: elegir MC
        clicGanador(c.id, l, e.shiftKey);
        return;
      }
      if (vs) { seleccionar(vs.dataset.id, null); return; }
      if (lado && (e.target.closest('.cmft-foto, .cmft-hnom, .cmft-lesc, .cmft-lbarW'))) clicGanador(lado.dataset.id, lado.dataset.lado, e.shiftKey);
    }
    function accionarPanel(que) {
      const c = (sel && POR_ID[sel.id]) || actual(B()); if (!c) return;
      const m = cruce(B(), c);
      if (que === 'iniciar' && m.a && m.b && !m.winner && acc.iniciar) acc.iniciar(c.st, c.i);
      if (que === 'rehacer' && m.winner && op.ensayo && acc.rehacer) acc.rehacer(c.st, c.i);
    }

    if (!salida) {
      window.addEventListener('keydown', tecla, true);
      window.addEventListener('keyup', teclaArriba, true);
      ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((t) => window.addEventListener(t, filtroClic, true));
      raiz.addEventListener('click', clic);
      window.addEventListener('blur', () => { sinFoco = true; pintarAviso(); });
      window.addEventListener('focus', () => { if (sinFoco) tragarHasta = Date.now() + 600; sinFoco = false; pintarAviso(); });
      document.addEventListener('mousemove', () => { if (!ratonDentro) { ratonDentro = true; pintarAviso(); } });
      document.documentElement.addEventListener('mouseleave', () => { ratonDentro = false; pintarAviso(); });
      setInterval(pintarAviso, 500);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (vista === 'bracket') ajustarBracket(); else ajustarLlave(); pintarSel(); });
    document.addEventListener('DOMContentLoaded', escalar);

    mostrar(op.vista || 'bracket', false);
    pintar(true);

    return {
      pintar,
      mostrar,
      vista: () => vista,
      enfocar,
      escalar,
      alAbrirSelector,
      seleccion: () => (sel ? { id: sel.id, lado: sel.lado } : null),
      seleccionar,
      aviso
    };
  }

  /* =============================================================================
     pantalla(raiz): torneo.html — las tres vistas en una ventana aparte, leyendo y
     escribiendo el mismo bracket del operador. Vista inicial: #bracket, #historias o #llave.
     ============================================================================= */
  function pantalla(raiz) {
    const leer = () => { try { const b = JSON.parse(localStorage.getItem(CLAVE) || 'null'); return valido(b) ? recalcular(b) : vacio(); } catch (e) { return vacio(); } };
    let b = leer();
    const ensayo = /[?&]ensayo=1(&|$)/.test(location.search);
    const sync = canal((nuevo) => { if (JSON.stringify(nuevo) === JSON.stringify(b)) return; b = nuevo; ui.pintar(); });
    function guardar() {
      try { localStorage.setItem(CLAVE, JSON.stringify(b)); } catch (e) { /* sin localStorage */ }
      sync.publicar(b);
      ui.pintar();
    }
    const h = (location.hash || '').toLowerCase();
    const ui = crear({
      raiz, modo: 'pantalla', ensayo,
      vista: /historias/.test(h) ? 'historias' : /llave/.test(h) ? 'llave' : 'bracket',
      obtener: () => b,
      activo: () => true,
      alCambiarVista: (v) => { try { history.replaceState(null, '', '#' + v); } catch (e) { /* vista previa sin historial */ } },
      acciones: {
        ganador: (st, i, lado) => { const m = b[st][i]; if (!m || !m.a || !m.b) return; m.winner = lado || null; recalcular(b); guardar(); },
        rehacer: (st, i) => { b[st][i].winner = null; recalcular(b); guardar(); },
        reiniciarResultados: () => { ETAPAS.forEach(([st]) => b[st].forEach((m) => { m.winner = null; })); recalcular(b); guardar(); }
      }
    });
    window.addEventListener('hashchange', () => { const x = (location.hash || '').toLowerCase(); ui.mostrar(/historias/.test(x) ? 'historias' : /llave/.test(x) ? 'llave' : 'bracket'); });
    return ui;
  }

  window.CMFTorneo = { crear, pantalla, canal, slug, mc, recalcular, valido, vacio, CLAVE, PARTICIPANTES };
})();
