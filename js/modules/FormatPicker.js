/**
 * Selección del formato de batalla, a partir de data/formats.js.
 */
export class FormatPicker {
  /**
   * @param {Object} config
   * @param {NodeList|Element[]} config.cards - Tarjetas .mode-card con data-format="key"
   * @param {Array} config.formats - Catálogo de formatos (data/formats.js)
   * @param {Function} config.onSelect - Se invoca con el objeto de formato elegido
   */
  constructor({ cards, formats, onSelect }) {
    this.onSelect = onSelect;
    this.formats = formats;

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const format = this.formats.find((f) => f.key === card.dataset.format);
        if (format) this.onSelect(format);
      });
    });
  }
}
