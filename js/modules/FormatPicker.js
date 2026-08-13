/**
 * Selección del formato de batalla (minuto libre, temática, minutos libre).
 */
export class FormatPicker {
  /**
   * @param {Object} config
   * @param {NodeList|Element[]} config.cards - Tarjetas .format-card con data-format/data-time/data-name
   * @param {Function} config.onSelect - Se invoca con { format, time, name } al elegir una tarjeta
   */
  constructor({ cards, onSelect }) {
    this.onSelect = onSelect;
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        this.onSelect({
          format: card.dataset.format,
          time: parseInt(card.dataset.time, 10),
          name: card.dataset.name
        });
      });
    });
  }
}
