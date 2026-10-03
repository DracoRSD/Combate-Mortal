/**
 * Carga diferida de imágenes para mejor rendimiento
 * @param {HTMLImageElement} img - Elemento de imagen a cargar
 * @param {string} src - URL de la imagen
 * @returns {Promise<boolean>} Promesa que resuelve en true si la imagen cargó, false si falló
 */
export function lazyLoadImage(img, src) {
  return new Promise((resolve) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      resolve(true);
    };
    tempImg.onerror = () => {
      img.classList.add('loaded');
      resolve(false);
    };
    tempImg.src = src;
  });
} 