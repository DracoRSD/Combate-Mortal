/**
 * Controlador para la página del temporizador
 */
export class TimerController {
  /**
   * @param {Object} config - Configuración del temporizador
   * @param {Object} config.elements - Elementos del DOM
   * @param {number|null} config.initialTime - Tiempo inicial en segundos (null en modo 'stopwatch')
   * @param {string} config.formatName - Nombre del formato
   * @param {'single'|'tematica'|'stopwatch'} [config.mode] - Comportamiento del cronómetro
   * @param {string[]} config.themeWords - Lista de palabras para formato temático (opcional)
   */
  constructor({ elements, initialTime, formatName, mode = 'single', themeWords = [] }) {
    this.elements = elements;
    this.initialTime = initialTime;
    this.mode = mode;
    this.timeLeft = mode === 'stopwatch' ? 0 : initialTime;
    this.formatName = formatName;
    this.themeWords = [...themeWords]; // Copia para no modificar el original

    // Solo inicializar palabras para formato temático
    if (mode === 'tematica') {
      // Cargar palabras usadas de localStorage o inicializar como array vacío
      this.usedWords = this.loadUsedWords();

      // Inicializar palabras disponibles (quitando las ya usadas)
      this.availableWords = this.initializeAvailableWords(themeWords);
    }

    this.interval = null;
    this.isRunning = false;
    this.currentThemeWord = null;

    // Configurar elementos iniciales
    this.elements.formatInfo.textContent = formatName;
    this.elements.timeNumber.textContent = mode === 'stopwatch' ? '0:00' : initialTime;
    if (mode === 'stopwatch' && this.elements.timeLabel) {
      this.elements.timeLabel.textContent = 'TRANSCURRIDO';
    }

    // Actualizar círculo SVG
    this.updateCircleSVG();

    // Si es formato temático, mostrar palabra temática
    if (mode === 'tematica') {
      this.showRandomThemeWord();
    } else {
      this.elements.wordLabel.style.display = 'none';
    }

    // Vincular eventos
    this.bindEvents();
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
   * Volver a la pantalla de selección
   */
  goBack() {
    // Guardar palabras usadas antes de navegar
    this.saveUsedWords();
    window.location.href = 'index.html';
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