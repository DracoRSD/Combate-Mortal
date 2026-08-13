import { lazyLoadImage } from '../utils/image-utils.js';

/**
 * Grilla de selección de MC estilo fighter-select: 16 tarjetas, selección
 * alternada izquierda/derecha, vista previa grande con foto o video, y
 * botón de pelea. Muestra la inicial del nombre cuando falta la foto.
 */
export class FighterSelector {
  /**
   * @param {Object} config
   * @param {Object} config.elements - Elementos del DOM (ver index.js)
   * @param {Array} config.mcData - Catálogo de MCs (data/mcs.js)
   * @param {Function} config.onFight - Se invoca con { left, right } al presionar ¡Fight!
   */
  constructor({ elements, mcData, onFight }) {
    this.elements = elements;
    this.mcData = mcData;
    this.onFight = onFight;
    this.left = null;
    this.right = null;
    this.mode = 'left';
    this.cards = [];

    this.buildGrid();
    this.bindEvents();
    this.updateUI();
  }

  initialOf(name) {
    return name.trim().charAt(0).toUpperCase();
  }

  buildGrid() {
    const fragment = document.createDocumentFragment();

    this.mcData.forEach((mc, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'fighter-card';
      card.dataset.index = index;
      card.dataset.navItem = '';

      const img = document.createElement('img');
      img.alt = mc.nombreMC;

      const fallback = document.createElement('div');
      fallback.className = 'fighter-card__fallback';
      fallback.textContent = this.initialOf(mc.nombreMC);

      const label = document.createElement('div');
      label.className = 'fighter-card__label';
      label.textContent = mc.nombreMC;
      if (mc.bandera) {
        const flag = document.createElement('span');
        flag.textContent = mc.bandera;
        label.appendChild(flag);
      }

      card.append(img, fallback, label);
      fragment.appendChild(card);
      this.cards.push(card);

      if (mc.urlFoto) {
        lazyLoadImage(img, mc.urlFoto).then((ok) => {
          if (!ok) card.classList.add('no-photo');
        });
      } else {
        card.classList.add('no-photo');
      }
    });

    this.elements.grid.appendChild(fragment);
  }

  bindEvents() {
    this.elements.grid.addEventListener('click', (event) => {
      const card = event.target.closest('.fighter-card');
      if (!card) return;
      this.select(parseInt(card.dataset.index, 10));
    });

    this.elements.fightButton.addEventListener('click', () => {
      if (this.left === null || this.right === null) return;
      if (typeof this.onFight === 'function') {
        this.onFight({ left: this.mcData[this.left], right: this.mcData[this.right] });
      }
    });

    this.elements.slotLeft.addEventListener('click', () => { this.mode = 'left'; this.updateUI(); });
    this.elements.slotRight.addEventListener('click', () => { this.mode = 'right'; this.updateUI(); });
  }

  select(index) {
    if (this.mode === 'left') {
      this.left = index;
      this.mode = 'right';
    } else {
      this.right = index;
      this.mode = 'left';
    }
    this.updateUI();
  }

  reset() {
    this.left = null;
    this.right = null;
    this.mode = 'left';
    this.updateUI();
  }

  fillSlot(side, mc) {
    const slot = this.elements['slot' + side];
    const img = slot.querySelector('img');
    const video = slot.querySelector('video');
    const fallback = slot.querySelector('.fighter-slot__fallback');
    const nameEl = slot.querySelector('.fighter-slot__name');

    if (!mc) {
      slot.classList.remove('filled', 'has-media');
      img.removeAttribute('src');
      video.removeAttribute('src');
      video.pause();
      nameEl.textContent = '';
      return;
    }

    slot.classList.add('filled');
    fallback.textContent = this.initialOf(mc.nombreMC);
    nameEl.textContent = mc.nombreMC;

    const hasRealVideo = mc.urlVideo && mc.urlVideo.trim() && mc.urlVideo !== 'assets/videos/mcs/';

    const showFallback = () => {
      slot.classList.remove('has-media');
      img.style.display = 'none';
      video.style.display = 'none';
    };

    if (hasRealVideo) {
      video.src = mc.urlVideo;
      video.onerror = () => {
        if (mc.urlFoto) {
          img.onerror = showFallback;
          img.src = mc.urlFoto;
          slot.classList.add('has-media');
        } else {
          showFallback();
        }
      };
      video.load();
      video.play().then(() => {
        slot.classList.add('has-media');
        video.style.display = 'block';
        img.style.display = 'none';
      }).catch(() => video.onerror());
    } else if (mc.urlFoto) {
      img.onerror = showFallback;
      img.onload = () => { slot.classList.add('has-media'); img.style.display = 'block'; };
      img.src = mc.urlFoto;
      video.style.display = 'none';
    } else {
      showFallback();
    }
  }

  updateUI() {
    this.cards.forEach((card, index) => {
      card.classList.remove('side-left', 'side-right', 'side-both');
      if (index === this.left && index === this.right) card.classList.add('side-both');
      else if (index === this.left) card.classList.add('side-left');
      else if (index === this.right) card.classList.add('side-right');
    });

    const hint = this.elements.selectHint;
    hint.className = 'select-hint ' + (this.mode === 'left' ? 'side-left' : 'side-right');
    hint.textContent = this.mode === 'left' ? 'Selecciona el primer luchador' : 'Selecciona el segundo luchador';

    this.fillSlot('Left', this.left !== null ? this.mcData[this.left] : null);
    this.fillSlot('Right', this.right !== null ? this.mcData[this.right] : null);

    const bothChosen = this.left !== null && this.right !== null;
    this.elements.vsBadge.classList.toggle('visible', bothChosen);
    this.elements.fightButton.classList.toggle('visible', bothChosen);
  }
}
