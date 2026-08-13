/**
 * Navegación por flechas para una grilla de botones (Enter/Espacio ya
 * activan el elemento enfocado de forma nativa por ser <button>, así que
 * este helper solo mueve el foco).
 */

/**
 * Cuántos elementos comparten la fila visual del primero (para saber
 * cuánto saltar con Arriba/Abajo en una grilla regular).
 * @param {HTMLElement[]} items
 */
function columnsInFirstRow(items) {
  if (items.length < 2) return items.length || 1;
  const firstTop = items[0].offsetTop;
  let count = 1;
  for (let i = 1; i < items.length; i++) {
    if (Math.abs(items[i].offsetTop - firstTop) < 1) count++;
    else break;
  }
  return count;
}

/**
 * Habilita navegación con flechas dentro de un contenedor.
 * @param {HTMLElement} container
 * @param {Object} [options]
 * @param {'grid'|'linear'} [options.layout] - 'grid' calcula columnas por
 *   posición real (para grillas regulares); 'linear' trata Arriba/Izquierda
 *   como "anterior" y Abajo/Derecha como "siguiente" (para grillas con
 *   tarjetas de distinto tamaño, donde la posición visual no es confiable).
 * @param {string} [options.itemSelector]
 * @param {Function} [options.onEdge] - Se invoca con (key) cuando el
 *   movimiento se saldría del contenedor, para saltar a otro grupo
 *   navegable (p.ej. de la grilla de MCs a los botones Volver/Fight).
 */
export function enableGridKeyboardNav(container, options = {}) {
  const layout = options.layout || 'grid';
  const itemSelector = options.itemSelector || '[data-nav-item]';
  const onEdge = options.onEdge;

  function getItems() {
    return Array.from(container.querySelectorAll(itemSelector));
  }

  container.addEventListener('keydown', (event) => {
    const items = getItems();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    if (current === -1) return;

    let next = null;
    if (layout === 'linear') {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = current + 1;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = current - 1;
    } else {
      const cols = columnsInFirstRow(items);
      if (event.key === 'ArrowRight') next = current + 1;
      else if (event.key === 'ArrowLeft') next = current - 1;
      else if (event.key === 'ArrowDown') next = current + cols;
      else if (event.key === 'ArrowUp') next = current - cols;
    }

    if (next === null) return;

    if (next < 0 || next >= items.length) {
      event.preventDefault();
      if (onEdge) onEdge(event.key);
      return;
    }

    event.preventDefault();
    items[next].focus();
  });
}

/**
 * Enfocar el primer elemento navegable de un contenedor.
 * @param {HTMLElement} container
 * @param {string} [itemSelector]
 */
export function focusFirstNavItem(container, itemSelector = '[data-nav-item]') {
  const item = container.querySelector(itemSelector);
  if (item) item.focus();
}
