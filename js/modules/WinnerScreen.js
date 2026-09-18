/**
 * Pantalla de ganador: al declarar un MC como ganador (foto grande) se
 * muestra en pantalla completa, leyendo el estado ya pintado en el DOM
 * (nombre, foto o inicial de respaldo) para ese lado del duelo.
 */
export class WinnerScreen {
  /**
   * @param {Object} config
   * @param {Object} config.elements - Elementos del DOM (ver timer.js)
   */
  constructor({ elements }) {
    this.elements = elements;
    this.bindEvents();
  }

  /**
   * Mostrar la foto grande del MC del lado indicado.
   * @param {'a'|'b'} side
   */
  show(side) {
    const isA = side === 'a';
    const srcPhoto = isA ? this.elements.mcAPhoto : this.elements.mcBPhoto;
    const srcFallback = isA ? this.elements.mcAFallback : this.elements.mcBFallback;
    const srcName = isA ? this.elements.mcAName : this.elements.mcBName;

    this.elements.name.textContent = srcName.textContent;

    const hasPhoto = !srcFallback.classList.contains('is-visible');
    if (hasPhoto) {
      this.elements.photo.src = srcPhoto.src;
      this.elements.photo.style.display = 'block';
      this.elements.fallback.classList.remove('is-visible');
    } else {
      this.elements.photo.style.display = 'none';
      this.elements.fallback.textContent = srcFallback.textContent;
      this.elements.fallback.classList.add('is-visible');
    }

    this.elements.overlay.hidden = false;
    this.elements.closeButton.focus();
  }

  hide() {
    this.elements.overlay.hidden = true;
  }

  bindEvents() {
    this.elements.closeButton.addEventListener('click', () => this.hide());
  }
}
