/**
 * Utilidad de rayos animados sobre <canvas>, usada tanto para el fondo
 * ambiental como para el marco de las fotos de los MC.
 */
function drawBolt(ctx, cx, cy, angle, len, innerRatio) {
  const segs = 6;
  const perp = angle + Math.PI / 2;
  let x = cx + Math.cos(angle) * (len * innerRatio);
  let y = cy + Math.sin(angle) * (len * innerRatio);

  ctx.beginPath();
  ctx.moveTo(x, y);

  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const dist = len * (innerRatio + t * (1 - innerRatio));
    const jitter = (1 - t) * 14 + 4;
    const wobble = (Math.random() - 0.5) * jitter;
    x = cx + Math.cos(angle) * dist + Math.cos(perp) * wobble;
    y = cy + Math.sin(angle) * dist + Math.sin(perp) * wobble;
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

/**
 * Crea un renderizador de rayos sobre un canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options
 * @param {number} [options.boltCount=4] - Cantidad de rayos por fotograma
 * @param {number} [options.innerRatio=0.35] - Distancia mínima al centro (0-1)
 * @param {number} [options.intervalMs=220] - Frecuencia del parpadeo
 * @param {string} [options.color='rgba(159,228,255,0.55)']
 * @param {boolean} [options.reduceMotion=false]
 */
export function createBoltRenderer(canvas, options = {}) {
  const {
    boltCount = 4,
    innerRatio = 0.35,
    intervalMs = 220,
    color = 'rgba(159,228,255,0.55)',
    reduceMotion = false
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let intervalId = null;

  function size() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
  }

  function render() {
    size();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) * 0.42;
    const count = boltCount + Math.floor(Math.random() * 3);

    ctx.lineWidth = 1.6 * dpr;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const len = baseR * (0.55 + Math.random() * 0.55);
      drawBolt(ctx, cx, cy, angle, len, innerRatio);
    }
  }

  function start() {
    if (reduceMotion) {
      render();
      return;
    }
    render();
    intervalId = setInterval(render, intervalMs);
  }

  function stop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  return { start, stop, render };
}
