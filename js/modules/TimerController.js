/**
 * Controlador para la página del temporizador
 */
export class TimerController {
  /**
   * @param {Object} config - Configuración del temporizador
   * @param {Object} config.elements - Elementos del DOM
   * @param {string[]} [config.themeWords] - Lista de palabras para formato temático
   * @param {Function} [config.onBack] - Se invoca al pedir "Volver" (Esc / botón)
   */
  constructor({ elements, themeWords = [], onBack }) {
    this.elements = elements;
    this.themeWords = [...themeWords]; // Copia para no modificar el original
    this.onBack = onBack;

    this.interval = null;
    this.isRunning = false;
    this.currentThemeWord = null;
    this.mode = 'single';
    this.initialTime = null;
    this.timeLeft = 0;
    this.formatName = '';

    // Actualizar círculo SVG
    this.updateCircleSVG();

    // Vincular eventos
    this.bindEvents();
  }

  /**
   * Configurar el cronómetro para una batalla nueva (nombre, modo y tiempo
   * del formato elegido), y reiniciarlo listo para arrancar. Se llama cada
   * vez que se entra al contador, no solo una vez al cargar la página.
   * @param {Object} format - Formato elegido (data/formats.js)
   */
  applyFormat(format) {
    this.mode = format.mode || 'single';
    this.initialTime = this.mode === 'stopwatch' ? null : format.time;
    this.formatName = format.name;

    if (this.mode === 'tematica' && !this.usedWords) {
      this.usedWords = this.loadUsedWords();
    }
    if (this.mode === 'tematica') {
      this.availableWords = this.initializeAvailableWords(this.themeWords);
    }

    this.elements.formatInfo.textContent = this.formatName;
    if (this.elements.timeLabel) {
      this.elements.timeLabel.textContent = this.mode === 'stopwatch' ? 'TRANSCURRIDO' : 'SEGUNDOS';
    }

    // resetTimer() ya elige una palabra nueva cuando el modo es 'tematica';
    // para el resto de los modos hay que ocultar la etiqueta explícitamente.
    if (this.mode !== 'tematica' && this.elements.wordLabel) {
      this.elements.wordLabel.style.display = 'none';
    }

    this.resetTimer();
  }
  
  /**
   * Cargar palabras usadas desde localStorage
   * @returns {Array} Array de palabras usadas
   */
  loadUsedWords() {
    try {
      const savedWords = localStorage.getItem('combateMortal_usedThemeWords');
      return savedWords ? JSON.parse(savedWords) : [];
    } catch (error) {
      console.error("Error al cargar palabras usadas:", error);
      return [];
    }
  }
  
  /**
   * Guardar palabras usadas en localStorage
   */
  saveUsedWords() {
    // Solo guardar si estamos en formato temático
    if (this.mode !== 'tematica') return;
    
    try {
      localStorage.setItem('combateMortal_usedThemeWords', JSON.stringify(this.usedWords));
      console.log('Palabras guardadas:', this.usedWords);
    } catch (error) {
      console.error("Error al guardar palabras usadas:", error);
    }
  }
  
  /**
   * Inicializar palabras disponibles, quitando las ya usadas
   * @param {Array} allWords - Todas las palabras posibles
   * @returns {Array} Palabras disponibles para usar
   */
  initializeAvailableWords(allWords) {
    // Si ya hemos usado todas las palabras, reiniciar
    if (this.usedWords.length >= allWords.length) {
      console.log('Reiniciando ciclo - todas las palabras fueron usadas');
      this.usedWords = [];
      this.saveUsedWords();
      return [...allWords];
    }
    
    // Filtrar palabras ya usadas
    return allWords.filter(word => !this.usedWords.includes(word));
  }
  
  /**
   * Verificar si una palabra ya ha sido usada
   * @param {string} word - Palabra a verificar
   * @returns {boolean} - true si ya ha sido usada, false en caso contrario
   */
  isWordUsed(word) {
    return this.usedWords.includes(word);
  }
  
  /**
   * Vincular eventos
   */
  bindEvents() {
    this.elements.startButton.addEventListener('click', () => this.startTimer());
    this.elements.resetButton.addEventListener('click', () => this.resetTimer());
    this.elements.backButton.addEventListener('click', () => this.goBack());
    
    // Escuchar teclas
    document.addEventListener('keydown', (event) => this.handleKeyDown(event));
    
    // Escuchar redimensión de ventana para actualizar círculo
    window.addEventListener('resize', () => this.updateCircleSVG());
  }
  
  /**
   * Actualizar el círculo SVG basado en el tamaño de pantalla
   */
  updateCircleSVG() {
    const circleTimerWidth = this.elements.circleTimer.offsetWidth;
    // Sin ancho real (p. ej. la pantalla del contador está oculta) no hay
    // nada que medir todavía; se recalcula en cuanto vuelva a ser visible.
    if (!circleTimerWidth) return;
    const svg = this.elements.progressRing;

    // Actualizar dimensiones del SVG
    svg.setAttribute('width', circleTimerWidth);
    svg.setAttribute('height', circleTimerWidth);
    
    // Actualizar posición y dimensiones del círculo
    const newRadius = circleTimerWidth / 2 - 15; // Ajustar radio para mantener margen
    const centerPoint = circleTimerWidth / 2;
    
    this.elements.progressCircle.setAttribute('r', newRadius);
    this.elements.progressCircle.setAttribute('cx', centerPoint);
    this.elements.progressCircle.setAttribute('cy', centerPoint);
    
    // Recalcular circunferencia para stroke-dasharray
    this.radius = newRadius;
    this.circumference = 2 * Math.PI * this.radius;

    this.elements.progressCircle.style.strokeDasharray = `${this.circumference} ${this.circumference}`;

    // Actualizar progreso con el valor actual (en modo 'stopwatch' el anillo
    // se mantiene siempre completo, ya que no hay un total contra el cual medir)
    this.setProgress(this.mode === 'stopwatch' ? 1 : this.timeLeft / this.initialTime);
  }
  
  /**
   * Establecer progreso del círculo
   * @param {number} percent - Porcentaje de progreso (0-1)
   */
  setProgress(percent) {
    const offset = this.circumference - percent * this.circumference;
    this.elements.progressCircle.style.strokeDashoffset = offset;
  }
  
  /**
   * Comenzar el temporizador
   */
  startTimer() {
    // Evitar múltiples intervalos
    if (this.isRunning) return;

    this.isRunning = true;
    const startHadFocus = document.activeElement === this.elements.startButton;
    this.elements.startButton.disabled = true;
    // El navegador quita el foco de un botón que se deshabilita; lo movemos
    // a Reiniciar para no perder la navegación por flechas mientras corre.
    if (startHadFocus) this.elements.resetButton.focus();

    // Detener el intervalo anterior si existe
    if (this.interval) {
      clearInterval(this.interval);
    }

    // Modo 'stopwatch' (Fatality): cuenta hacia arriba sin fin automático,
    // hasta que el jurado decida y el staff presione Reiniciar.
    if (this.mode === 'stopwatch') {
      this.interval = setInterval(() => {
        this.timeLeft++;
        this.elements.timeNumber.textContent = this.formatElapsed(this.timeLeft);
      }, 1000);
      return;
    }

    this.interval = setInterval(() => {
      this.timeLeft--;
      this.elements.timeNumber.textContent = this.timeLeft;
      this.setProgress(this.timeLeft / this.initialTime);

      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.playFinishSound();
      }
    }, 1000);
  }

  /**
   * Formatear segundos transcurridos como m:ss (modo 'stopwatch')
   * @param {number} totalSeconds
   * @returns {string}
   */
  formatElapsed(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
  
  /**
   * Detener el temporizador
   */
  stopTimer() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    this.isRunning = false;
  }
  
  /**
   * Reiniciar el temporizador
   */
  resetTimer() {
    this.stopTimer();

    this.timeLeft = this.mode === 'stopwatch' ? 0 : this.initialTime;
    this.elements.timeNumber.textContent = this.mode === 'stopwatch'
      ? this.formatElapsed(0)
      : this.timeLeft;
    this.setProgress(1);
    this.elements.startButton.disabled = false;

    // Si es formato temático, mostrar nueva palabra al reiniciar
    if (this.mode === 'tematica') {
      this.showRandomThemeWord();
    }
  }
  
  /**
   * Volver a la pantalla de selección (torneo o formato/MC, según de dónde
   * se haya entrado al contador).
   */
  goBack() {
    this.stopTimer();
    // Guardar palabras usadas antes de salir del contador
    this.saveUsedWords();
    if (typeof this.onBack === 'function') this.onBack();
  }
  
  /**
   * Reproducir sonido de finalización
   */
  playFinishSound() {
    try {
      const audio = new Audio("https://www.myinstants.com/media/sounds/mortal-kombat-finishhim.mp3");
      audio.play();
    } catch (error) {
      console.error("Error al reproducir sonido:", error);
    }
  }
  
  /**
   * Mostrar una palabra temática aleatoria sin repetición
   */
  showRandomThemeWord() {
    if (this.themeWords.length === 0 || this.mode !== 'tematica') return;
    
    // Si no quedan palabras disponibles, reiniciar todas las palabras
    if (this.availableWords.length === 0) {
      console.log('No quedan palabras disponibles, reiniciando lista completa');
      this.usedWords = [];
      this.saveUsedWords();
      this.availableWords = [...this.themeWords];
    }
    
    // Obtener un índice aleatorio de las palabras disponibles
    const randomIndex = Math.floor(Math.random() * this.availableWords.length);
    
    // Extraer la palabra seleccionada
    this.currentThemeWord = this.availableWords.splice(randomIndex, 1)[0];
    
    // Verificar por seguridad que la palabra no se repita
    if (this.isWordUsed(this.currentThemeWord)) {
      console.warn('Palabra repetida detectada, buscando otra palabra');
      // Si por alguna razón la palabra ya está en usadas, buscar otra
      return this.showRandomThemeWord();
    }
    
    // Añadir a palabras usadas
    this.usedWords.push(this.currentThemeWord);
    console.log('Palabra seleccionada:', this.currentThemeWord);
    console.log('Palabras restantes:', this.availableWords.length);
    
    // Guardar palabras usadas en localStorage
    this.saveUsedWords();
    
    // Mostrar la palabra
    this.elements.wordLabel.textContent = this.currentThemeWord;
    this.elements.wordLabel.style.display = 'block';
  }
  
  /**
   * Manejar eventos de teclado
   * @param {KeyboardEvent} event - Evento de teclado
   */
  handleKeyDown(event) {
    if (!this.elements.circleTimer.closest('.screen.active')) return;

    if (event.key === ' ' || event.key === 'Space') {
      // Si el foco está en un botón, Espacio ya lo activa de forma nativa
      // (dispara su propio listener de click); evita duplicar la acción.
      if (event.target && event.target.tagName === 'BUTTON') return;
      if (!this.elements.startButton.disabled) {
        this.startTimer();
      }
    } else if (event.key === 'Backspace') {
      this.resetTimer();
    } else if (event.key === 'Escape') {
      this.goBack();
    }
  }
} 