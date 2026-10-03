/**
 * Navegación por flechas para una grilla de botones (Enter/Espacio ya
 * activan el elemento enfocado de forma nativa por ser <button>, así que
 * este helper solo mueve el foco).
 */

/**
 * Vecino más cercano en la dirección de una flecha, usando la posición
 * real de cada elemento (getBoundingClientRect) en vez de asumir una
 * grilla uniforme. Necesario porque layouts como el bracket del torneo
 * mezclan filas con distinta cantidad de columnas (Octavos, Cuartos,
 * Semifinal...) y elementos apilados dentro de una misma "celda" (los
 * cupos A/B de un cruce): un cálculo ingenuo de "columnas por fila" se
 * rompe ahí y deja Arriba/Abajo haciendo lo mismo que Izquierda/Derecha.
 * @param {HTMLElement[]} items
 * @param {HTMLElement} current
 * @param {string} key
 */
function findSpatialNeighbor(items, current, key) {
  const curRect = current.getBoundingClientRect();
  const curX = curRect.left + curRect.width / 2;
  const curY = curRect.top + curRect.height / 2;

  let best = null;
  let bestScore = Infinity;

  items.forEach((item) => {
    if (item === current) return;
    const rect = item.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - curX;
    const dy = y - curY;

    // Un umbral chico evita que dos elementos de la misma columna/fila (que
    // deberían compartir centro) cuenten como "vecino en esa dirección" por
    // un redondeo de subpíxel: un dx/dy de 0.01px igual pasa el filtro
    // "> 0" y, al ser ~0, gana cualquier score sin importar cuán lejos esté
    // en el eje perpendicular (p.ej. saltar dentro de la misma columna de
    // Octavos en vez de cruzar a Cuartos).
    const EPS = 4;
    let primary;
    let secondary;
    if (key === 'ArrowDown') {
      if (dy <= EPS) return;
      primary = dy;
      secondary = dx;
    } else if (key === 'ArrowUp') {
      if (dy >= -EPS) return;
      primary = -dy;
      secondary = dx;
    } else if (key === 'ArrowRight') {
      if (dx <= EPS) return;
      primary = dx;
      secondary = dy;
    } else if (key === 'ArrowLeft') {
      if (dx >= -EPS) return;
      primary = -dx;
      secondary = dy;
    } else {
      return;
    }

    // La distancia perpendicular pesa más para preferir el elemento
    // alineado con el actual antes que uno más cercano pero descentrado
    // (p.ej. en el bracket del torneo, Cuartos gana sobre un Octavos
    // "espejo" perfectamente alineado pero mucho más lejos).
    const score = primary + Math.abs(secondary) * 2;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  });

  return best;
}

/**
 * Habilita navegación con flechas dentro de un contenedor.
 * @param {HTMLElement} container
 * @param {Object} [options]
 * @param {'grid'|'linear'} [options.layout] - 'grid' busca el vecino más
 *   cercano en la dirección real de la flecha (para layouts irregulares
 *   como el bracket, o grillas regulares de tarjetas); 'linear' trata
 *   Arriba/Izquierda como "anterior" y Abajo/Derecha como "siguiente" en
 *   el orden del DOM (para una barra simple de pocos botones).
 * @param {string} [options.itemSelector]
 * @param {Function} [options.onEdge] - Se invoca con (key) cuando el
 *   movimiento se saldría del contenedor, para saltar a otro grupo
 *   navegable (p.ej. de la grilla de MCs a los botones Volver/Fight).
 */
export function enableGridKeyboardNav(container, options = {}) {
  const layout = options.layout || 'grid';
  const itemSelector = options.itemSelector || '[data-nav-item]';
  const onEdge = options.onEdge;
  const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  function getItems() {
    // Un MC ya usado en otro cupo queda deshabilitado (disabled) pero
    // sigue siendo [data-nav-item]; un <button disabled> nunca puede
    // recibir foco, así que dejarlo en la lista hace que la flecha que
    // "aterriza" ahí no mueva nada (o, si es el primero, que no se
    // enfoque nada al abrir el selector). Se descarta acá para que la
    // navegación salte directo al siguiente MC disponible.
    return Array.from(container.querySelectorAll(itemSelector)).filter((el) => !el.disabled);
  }

  container.addEventListener('keydown', (event) => {
    if (!arrowKeys.includes(event.key)) return;
    const items = getItems();
    if (!items.length) return;
    const current = document.activeElement;
    if (items.indexOf(current) === -1) return;

    if (layout === 'linear') {
      const index = items.indexOf(current);
      let next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;

      if (next < 0 || next >= items.length) {
        event.preventDefault();
        if (onEdge) onEdge(event.key);
        return;
      }
      event.preventDefault();
      items[next].focus();
      return;
    }

    const next = findSpatialNeighbor(items, current, event.key);
    if (!next) {
      event.preventDefault();
      if (onEdge) onEdge(event.key);
      return;
    }
    event.preventDefault();
    next.focus();
  });
}

/**
 * Enfocar el primer elemento navegable de un contenedor.
 * @param {HTMLElement} container
 * @param {string} [itemSelector]
 */
export function focusFirstNavItem(container, itemSelector = '[data-nav-item]') {
  const items = container.querySelectorAll(itemSelector);
  for (const item of items) {
    if (!item.disabled) {
      item.focus();
      return;
    }
  }
}
