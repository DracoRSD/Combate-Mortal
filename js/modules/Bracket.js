const STORAGE_KEY = 'cmTorneoBracket';

// Orden de aparición de las rondas y formato fijo de cada una. Las etapas
// posteriores a Octavos se llenan solas con los ganadores (o perdedores,
// para el Tercer y Cuarto Puesto) de la ronda anterior.
export const STAGE_META = [
  { key: 'octavos', label: 'Octavos de Final', size: 8, formatKey: 'doceXdoce' },
  { key: 'cuartos', label: 'Cuartos de Final', size: 4, formatKey: 'minutoIdaVuelta' },
  { key: 'semifinal', label: 'Semifinal', size: 2, formatKey: 'ochoXocho' },
  { key: 'tercerPuesto', label: 'Tercer y Cuarto Puesto', size: 1, formatKey: 'cuatroXcuatro' },
  { key: 'final', label: 'Final', size: 1, formatKey: 'fatality' }
];

function emptyMatch() {
  return { a: null, b: null, winner: null };
}

/**
 * Estado del torneo: 16 MC repartidos en Octavos, y el resto de las rondas
 * (Cuartos, Semifinal, Tercer y Cuarto Puesto, Final) que se completan solas
 * a medida que se deciden ganadores. Persiste en localStorage para que el
 * progreso sobreviva a la navegación entre el torneo y el contador.
 */
export class Bracket {
  constructor(mcData) {
    this.mcData = mcData;
    const loaded = this.load();
    this.state = loaded || this.buildDefault();
    this.recompute();
    this.save();
  }

  /**
   * Bracket vacío: los 8 cupos de Octavos empiezan sin MC asignado, para
   * que se vayan colocando a mano a medida que se van confirmando en el
   * evento (en vez de sembrar todo el roster automáticamente).
   */
  buildDefault() {
    const state = {};
    STAGE_META.forEach((stage) => {
      state[stage.key] = Array.from({ length: stage.size }, emptyMatch);
    });
    return state;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.octavos) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      // localStorage no disponible (modo privado, cuota llena, etc.) — el
      // torneo sigue funcionando en memoria durante la sesión actual.
    }
  }

  reset() {
    this.state = this.buildDefault();
    this.recompute();
    this.save();
  }

  match(stage, index) {
    return this.state[stage][index];
  }

  /** Asignar (o quitar, con name=null) un MC a un cupo de Octavos. */
  assign(stage, index, side, name) {
    if (stage !== 'octavos') return;
    this.state.octavos[index][side] = name || null;
    this.state.octavos[index].winner = null;
    this.recompute();
    this.save();
  }

  setWinner(stage, index, side) {
    const m = this.state[stage] && this.state[stage][index];
    if (!m || !m.a || !m.b) return;
    m.winner = side;
    this.recompute();
    this.save();
  }

  clearWinner(stage, index) {
    const m = this.state[stage] && this.state[stage][index];
    if (!m) return;
    m.winner = null;
    this.recompute();
    this.save();
  }

  /** Nombres ya usados en Octavos, para no repetir un MC en dos cupos. */
  usedNames(exceptIndex, exceptSide) {
    const used = new Set();
    this.state.octavos.forEach((m, i) => {
      ['a', 'b'].forEach((side) => {
        if (i === exceptIndex && side === exceptSide) return;
        if (m[side]) used.add(m[side]);
      });
    });
    return used;
  }

  mcByName(name) {
    return this.mcData.find((mc) => mc.nombreMC === name) || null;
  }

  /** Propaga ganadores/perdedores hacia las rondas siguientes, e invalida
   * (limpia) cualquier resultado ya decidido cuya pareja haya cambiado. */
  recompute() {
    const o = this.state.octavos;
    const c = this.state.cuartos;
    const s = this.state.semifinal;
    const f = this.state.final[0];
    const t = this.state.tercerPuesto[0];

    const winnerName = (m) => (m.winner ? m[m.winner] : null);
    const loserName = (m) => (m.winner ? (m.winner === 'a' ? m.b : m.a) : null);

    const propagate = (target, newA, newB) => {
      if (target.a !== newA || target.b !== newB) {
        target.a = newA;
        target.b = newB;
        target.winner = null;
      }
    };

    for (let i = 0; i < c.length; i++) {
      propagate(c[i], winnerName(o[i * 2]), winnerName(o[i * 2 + 1]));
    }
    for (let i = 0; i < s.length; i++) {
      propagate(s[i], winnerName(c[i * 2]), winnerName(c[i * 2 + 1]));
    }
    propagate(f, winnerName(s[0]), winnerName(s[1]));
    propagate(t, loserName(s[0]), loserName(s[1]));
  }
}
