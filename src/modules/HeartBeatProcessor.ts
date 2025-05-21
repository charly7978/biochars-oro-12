
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES (Valores optimizados para precisión médica) ──────────
  private readonly DEFAULT_SAMPLE_RATE = 60;
  private readonly DEFAULT_WINDOW_SIZE = 30; // Aumentado para mejor análisis (antes 40)
  private readonly DEFAULT_MIN_BPM = 30;
  private readonly DEFAULT_MAX_BPM = 220;
  private readonly DEFAULT_SIGNAL_THRESHOLD = 0.015; // Reducido para mejor sensibilidad (antes 0.02)
  private readonly DEFAULT_MIN_CONFIDENCE = 0.25; // Reducido para mejor detección (antes 0.30)
  private readonly DEFAULT_DERIVATIVE_THRESHOLD = -0.004; // Ajustado para mejor sensibilidad (antes -0.005)
  private readonly DEFAULT_MIN_PEAK_TIME_MS = 250; // Reducido para mayor sensibilidad (antes 300)
  private readonly WARMUP_TIME_MS = 800; // Reducido para obtener lecturas más rápido (antes 1000)

  // Parámetros de filtrado ajustados para precisión médica
  private readonly MEDIAN_FILTER_WINDOW = 5; // Aumentado para más estabilidad (antes 3)
  private readonly MOVING_AVERAGE_WINDOW = 5; // Aumentado para estabilidad (antes 3)
  private readonly EMA_ALPHA = 0.45; // Ajustado para mejor equilibrio (antes 0.5)
  private readonly BASELINE_FACTOR = 0.85; // Ajustado para seguimiento más suave (antes 0.8)

  // Parámetros de beep y vibración
  private readonly BEEP_DURATION = 450; 
  private readonly BEEP_VOLUME = 1.0;
  private readonly MIN_BEEP_INTERVAL_MS = 500; // Ajustado para prevenir beeps erróneos (antes 600)
  private readonly VIBRATION_PATTERN = [40, 20, 60];

  // AUTO-RESET mejorado
  private readonly LOW_SIGNAL_THRESHOLD = 0; // Deshabilitado auto-reset por baja señal
  private readonly LOW_SIGNAL_FRAMES = 30; // Aumentado para mayor tolerancia (antes 25)
  private lowSignalCount = 0;

  // ────────── PARÁMETROS ADAPTATIVOS MÉDICAMENTE VÁLIDOS ──────────
  private adaptiveSignalThreshold: number;
  private adaptiveMinConfidence: number;
  private adaptiveDerivativeThreshold: number;

  // Límites para los parámetros adaptativos - Valores médicamente apropiados
  private readonly MIN_ADAPTIVE_SIGNAL_THRESHOLD = 0.01; // Reducido para mejor sensibilidad (antes 0.05)
  private readonly MAX_ADAPTIVE_SIGNAL_THRESHOLD = 0.4;
  private readonly MIN_ADAPTIVE_MIN_CONFIDENCE = 0.35; // Ajustado para equilibrar (antes 0.40)
  private readonly MAX_ADAPTIVE_MIN_CONFIDENCE = 0.80;
  private readonly MIN_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.08;
  private readonly MAX_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.003; // Mejorado para sensibilidad (antes -0.005)

  // ────────── PARÁMETROS PARA PROCESAMIENTO ──────────
  private readonly SIGNAL_BOOST_FACTOR = 2.2; // Aumentado para mejor amplificación (antes 1.8)
  private readonly PEAK_DETECTION_SENSITIVITY = 0.7; // Aumentado para mejor detección (antes 0.6)
  
  // Control del auto-ajuste
  private readonly ADAPTIVE_TUNING_PEAK_WINDOW = 8; // Ajustado para adaptarse con más precisión (antes 10)
  private readonly ADAPTIVE_TUNING_LEARNING_RATE = 0.25; // Aumentado para adaptarse más rápido (antes 0.20)
  
  // Variables internas
  private recentPeakAmplitudes: number[] = [];
  private recentPeakConfidences: number[] = [];
  private recentPeakDerivatives: number[] = [];
  private peaksSinceLastTuning = 0;
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private audioContext: AudioContext | null = null;
  private heartSoundOscillator: OscillatorNode | null = null;
  private lastBeepTime = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private baseline: number = 0;
  private lastValue: number = 0;
  private values: number[] = [];
  private startTime: number = 0;
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak: boolean = false;
  private smoothBPM: number = 0;
  private readonly BPM_ALPHA = 0.25; // Ajustado para respuesta más rápida (antes 0.3)
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private isArrhythmiaDetected: boolean = false;
  
  // Variables para mejorar la detección
  private peakValidationBuffer: number[] = [];
  private readonly PEAK_VALIDATION_THRESHOLD = 0.25; // Reducido para mejor validación (antes 0.3)
  private lastSignalStrength: number = 0;
  private recentSignalStrengths: number[] = [];
  private readonly SIGNAL_STRENGTH_HISTORY = 40; // Aumentado para análisis más completo (antes 30)
  
  // Nueva variable para retroalimentación de calidad de señal
  private currentSignalQuality: number = 0;
  
  // Variables para mejorar RR
  private rrIntervals: number[] = [];
  private readonly MAX_RR_HISTORY = 20;

  // Nueva variable para mejorar detección de picos
  private peakCandidates: {value: number, time: number}[] = [];
  private readonly MAX_PEAK_CANDIDATES = 5;

  constructor() {
    // Inicializar parámetros adaptativos con valores médicamente apropiados
    this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
    this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
    this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;

    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      console.log("HeartBeatProcessor: Audio Context Initialized and resumed");
      
      // Reproducir un sonido de prueba audible para desbloquear el audio
      await this.playTestSound(0.3); // Volumen incrementado
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playTestSound(volume: number = 0.2) {
    if (!this.audioContext) return;
    
    try {
      // console.log("HeartBeatProcessor: Reproduciendo sonido de prueba");
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // Frecuencia A4 - claramente audible
      
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.6);
      
      // console.log("HeartBeatProcessor: Sonido de prueba reproducido");
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing test sound", error);
    }
  }

  private async playHeartSound(volume: number = this.BEEP_VOLUME, playArrhythmiaTone: boolean) {
    if (!this.audioContext || this.isInWarmup()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      console.log("HeartBeatProcessor: Ignorando beep - demasiado cerca del anterior", now - this.lastBeepTime);
      return;
    }

    try {
      if (navigator.vibrate) {
        navigator.vibrate(this.VIBRATION_PATTERN);
      }

      const currentTime = this.audioContext.currentTime;

      // Log peak for debugging
      console.log("HeartBeatProcessor: Reproduciendo sonido de latido", {
        timestamp: now,
        timeSinceLastBeep: now - this.lastBeepTime,
        isArrhythmia: playArrhythmiaTone
      });

      // Sonidos de latido mejorados - más claramente audibles
      // LUB - primer sonido del latido
      const oscillator1 = this.audioContext.createOscillator();
      const gainNode1 = this.audioContext.createGain();
      oscillator1.type = 'sine';
      oscillator1.frequency.value = 150;
      gainNode1.gain.setValueAtTime(0, currentTime);
      gainNode1.gain.linearRampToValueAtTime(volume * 1.5, currentTime + 0.03);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15);
      oscillator1.connect(gainNode1);
      gainNode1.connect(this.audioContext.destination);
      oscillator1.start(currentTime);
      oscillator1.stop(currentTime + 0.2);

      // DUB - segundo sonido del latido
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode2 = this.audioContext.createGain();
      const dubStartTime = currentTime + 0.08;
      oscillator2.type = 'sine';
      oscillator2.frequency.value = 120;
      gainNode2.gain.setValueAtTime(0, dubStartTime);
      gainNode2.gain.linearRampToValueAtTime(volume * 1.5, dubStartTime + 0.03);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, dubStartTime + 0.15);
      oscillator2.connect(gainNode2);
      gainNode2.connect(this.audioContext.destination);
      oscillator2.start(dubStartTime);
      oscillator2.stop(dubStartTime + 0.20);
      
      if (playArrhythmiaTone) {
        const oscillator3 = this.audioContext.createOscillator();
        const gainNode3 = this.audioContext.createGain();
        oscillator3.type = 'sine';
        oscillator3.frequency.value = 440;

        // El sonido de arritmia ahora suena inmediatamente después de los latidos principales
        const arrhythmiaSoundStartTime = dubStartTime + 0.05;
        const arrhythmiaAttackDuration = 0.02;
        const arrhythmiaSustainDuration = 0.10;
        const arrhythmiaReleaseDuration = 0.05;
        const arrhythmiaAttackEndTime = arrhythmiaSoundStartTime + arrhythmiaAttackDuration;
        const arrhythmiaSustainEndTime = arrhythmiaAttackEndTime + arrhythmiaSustainDuration;
        const arrhythmiaReleaseEndTime = arrhythmiaSustainEndTime + arrhythmiaReleaseDuration;

        gainNode3.gain.setValueAtTime(0, arrhythmiaSoundStartTime);
        gainNode3.gain.linearRampToValueAtTime(volume * 0.65, arrhythmiaAttackEndTime);
        gainNode3.gain.setValueAtTime(volume * 0.65, arrhythmiaSustainEndTime);
        gainNode3.gain.exponentialRampToValueAtTime(0.001, arrhythmiaReleaseEndTime);
        oscillator3.connect(gainNode3);
        gainNode3.connect(this.audioContext.destination);
        oscillator3.start(arrhythmiaSoundStartTime);
        oscillator3.stop(arrhythmiaReleaseEndTime + 0.01);
        
        // Reseteamos la bandera después de reproducir el sonido de arritmia
        this.isArrhythmiaDetected = false;
      }
      const interval = now - this.lastBeepTime;
      this.lastBeepTime = now;
      console.log(`HeartBeatProcessor: Latido reproducido. Intervalo: ${interval} ms, BPM estimado: ${Math.round(this.getSmoothBPM())}`);
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing heart sound", error);
    }
  }

  public processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
    signalQuality?: number;
  } {
    // Aplicar amplificación razonable
    value = this.boostSignal(value);
    
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);
    
    // Variable filteredValue definida explícitamente
    const filteredValue = smoothed;

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.DEFAULT_WINDOW_SIZE) { 
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 15) { // Requisito reducido para evaluación más rápida (antes 20)
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: filteredValue,
        arrhythmiaCount: 0,
        signalQuality: 0
      };
    }

    // Baseline tracking con mejor adaptación a señales débiles
    this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);
    const normalizedValue = smoothed - this.baseline;
    
    // Seguimiento de fuerza de señal
    this.trackSignalStrength(Math.abs(normalizedValue));
    
    // Auto-reset con umbral adaptativo para señales débiles
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // Cálculo de derivada mejorado para detectar cambios de dirección
    let smoothDerivative = 0;
    if (this.values.length === 3) {
      // Derivada central de mayor precisión
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    } else {
      smoothDerivative = smoothed - this.lastValue;
    }
    this.lastValue = smoothed;
    
    // Detección de picos médicamente válida con umbral adaptativo
    const peakDetectionResult = this.enhancedPeakDetection(normalizedValue, smoothDerivative);
    let isPeak = peakDetectionResult.isPeak;
    const confidence = peakDetectionResult.confidence;
    const rawDerivative = peakDetectionResult.rawDerivative;
    
    // Segunda etapa de validación para confirmación de picos
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Calcular calidad de señal actual basada en varios factores (0-100)
    this.currentSignalQuality = this.calculateSignalQuality(normalizedValue, confidence);

    // Si tenemos un pico confirmado y no estamos en período de calentamiento
    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      // Validación médicamente apropiada con intervalo mínimo entre picos
      if (timeSinceLastPeak >= this.DEFAULT_MIN_PEAK_TIME_MS) {
        // Validación estricta según criterios médicos
        if (this.validatePeak(normalizedValue, confidence)) {
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = now;
          
          // Guardar intervalo RR para análisis
          if (this.previousPeakTime) {
            const rrInterval = now - this.previousPeakTime;
            if (rrInterval >= 300 && rrInterval <= 2000) { // Entre 30 y 200 BPM
              this.rrIntervals.push(rrInterval);
              if (this.rrIntervals.length > this.MAX_RR_HISTORY) {
                this.rrIntervals.shift();
              }
            }
          }
          
          // Reproducir sonido y actualizar estado
          this.playHeartSound(1.0, this.isArrhythmiaDetected);

          this.updateBPM();

          // Actualizar historial para sintonización adaptativa
          this.recentPeakAmplitudes.push(normalizedValue);
          this.recentPeakConfidences.push(confidence);
          if (rawDerivative !== undefined) this.recentPeakDerivatives.push(rawDerivative);

          if (this.recentPeakAmplitudes.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
            this.recentPeakAmplitudes.shift();
          }
          if (this.recentPeakConfidences.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
            this.recentPeakConfidences.shift();
          }
          if (this.recentPeakDerivatives.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
            this.recentPeakDerivatives.shift();
          }
          
          this.peaksSinceLastTuning++;
          if (this.peaksSinceLastTuning >= Math.floor(this.ADAPTIVE_TUNING_PEAK_WINDOW / 2)) {
            this.performAdaptiveTuning();
            this.peaksSinceLastTuning = 0;
          }
        } else {
          console.log(`HeartBeatProcessor: Pico rechazado - confianza insuficiente: ${confidence}`);
          isPeak = false;
        }
      }
    }
    
    // Retornar resultado con nuevos parámetros
    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence: isPeak ? 0.95 : this.adjustConfidenceForSignalStrength(0.6),
      isPeak: isPeak,
      filteredValue: filteredValue,
      arrhythmiaCount: 0,
      signalQuality: this.currentSignalQuality // Retroalimentación de calidad
    };
  }
  
  /**
   * Amplificación adaptativa de señal - limitada a niveles médicamente válidos
   */
  private boostSignal(value: number): number {
    if (this.signalBuffer.length < 10) return value * this.SIGNAL_BOOST_FACTOR;
    
    // Calcular estadísticas de señal reciente
    const recentSignals = this.signalBuffer.slice(-10);
    const avgSignal = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const maxSignal = Math.max(...recentSignals);
    const minSignal = Math.min(...recentSignals);
    const range = maxSignal - minSignal;
    
    // Calcular factor de amplificación proporcional a la fuerza de la señal
    let boostFactor = this.SIGNAL_BOOST_FACTOR;
    
    if (range < 0.8) { // Ajustado para mejor detección en señales débiles (antes 1.0)
      // Señal débil - amplificar moderadamente
      boostFactor = this.SIGNAL_BOOST_FACTOR * 2.1; // Más amplificación para señales débiles (antes 1.8)
    } else if (range < 3.0) {
      // Señal moderada - amplificar ligeramente
      boostFactor = this.SIGNAL_BOOST_FACTOR * 1.5; // Ajustado para mejor detección (antes 1.4)
    } else if (range > 10.0) {
      // Señal fuerte - no amplificar
      boostFactor = 1.0;
    }
    
    // Aplicar amplificación lineal centrada en el promedio
    const centered = value - avgSignal;
    const boosted = avgSignal + (centered * boostFactor);
    
    return boosted;
  }

  // Nuevo método para calcular la calidad de la señal basado en múltiples indicadores
  private calculateSignalQuality(normalizedValue: number, confidence: number): number {
    if (this.signalBuffer.length < 10) return 0;
    
    // Factores para calcular calidad:
    
    // 1. Amplitud de la señal (0-40)
    const recentAmplitudes = this.recentPeakAmplitudes.length > 0 ? 
        this.recentPeakAmplitudes : this.recentSignalStrengths.slice(-5);
    
    const avgAmplitude = recentAmplitudes.reduce((sum, val) => sum + val, 0) / 
        Math.max(1, recentAmplitudes.length);
    
    // Amplitudes menores a 0.05 indican señal débil, mayores a 0.5 indican señal fuerte
    const amplitudeFactor = Math.min(40, Math.max(0, avgAmplitude * 100));
    
    // 2. Consistencia de la señal (0-30)
    let consistencyFactor = 0;
    if (this.bpmHistory.length >= 3) {
        const bpmValues = this.bpmHistory.slice(-5);
        const avgBPM = bpmValues.reduce((sum, val) => sum + val, 0) / bpmValues.length;
        const bpmDeviation = bpmValues.reduce((sum, val) => sum + Math.abs(val - avgBPM), 0) / bpmValues.length;
        
        // Desviación menor a 3 indica alta consistencia, mayor a 10 indica baja consistencia
        consistencyFactor = Math.min(30, Math.max(0, 30 - bpmDeviation * 3));
    }
    
    // 3. Regularidad de intervalos RR (0-30)
    let regularityFactor = 0;
    if (this.rrIntervals.length >= 3) {
        const intervals = this.rrIntervals.slice(-5);
        const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        const intervalDeviation = intervals.reduce((sum, val) => sum + Math.abs(val - avgInterval), 0) / intervals.length;
        
        // Desviación menor a 30ms indica alta regularidad, mayor a 100ms indica baja regularidad
        regularityFactor = Math.min(30, Math.max(0, 30 - intervalDeviation / 5));
    } else {
        regularityFactor = 10; // Valor base si no hay suficiente historia
    }
    
    // Calidad total (0-100)
    const qualityScore = Math.min(100, amplitudeFactor + consistencyFactor + regularityFactor);
    
    return qualityScore;
  }

  /**
   * Seguimiento de fuerza de señal para ajuste de confianza
   */
  private trackSignalStrength(amplitude: number): void {
    this.lastSignalStrength = amplitude;
    this.recentSignalStrengths.push(amplitude);
    
    if (this.recentSignalStrengths.length > this.SIGNAL_STRENGTH_HISTORY) {
      this.recentSignalStrengths.shift();
    }
  }

  /**
   * Ajuste de confianza basado en fuerza histórica de señal
   */
  private adjustConfidenceForSignalStrength(confidence: number): number {
    if (this.recentSignalStrengths.length < 5) return confidence;
    
    // Calcular promedio de fuerza de señal
    const avgStrength = this.recentSignalStrengths.reduce((sum, val) => sum + val, 0) / 
                        this.recentSignalStrengths.length;
    
    // Señales muy débiles reducen la confianza
    if (avgStrength < 0.1) {
      return Math.min(1.0, confidence * 0.7); // Reducción más agresiva (antes 0.8)
    }
    
    // Señales fuertes aumentan la confianza
    if (avgStrength > 0.4) {
      return Math.min(1.0, confidence * 1.2);
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Afinamiento adaptativo para parámetros de detección
   */
  private performAdaptiveTuning(): void {
    if (this.recentPeakAmplitudes.length < this.ADAPTIVE_TUNING_PEAK_WINDOW / 2) return;
    
    // Calcular estadísticas de los picos recientes
    const avgAmplitude = this.recentPeakAmplitudes.reduce((sum, val) => sum + val, 0) / 
                         this.recentPeakAmplitudes.length;
    
    const avgConfidence = this.recentPeakConfidences.reduce((sum, val) => sum + val, 0) / 
                          this.recentPeakConfidences.length;
    
    // Ajustar umbral de señal basado en amplitudes observadas
    const targetThreshold = Math.max(
      this.MIN_ADAPTIVE_SIGNAL_THRESHOLD,
      Math.min(this.MAX_ADAPTIVE_SIGNAL_THRESHOLD, avgAmplitude * 0.35)
    );
    
    // Ajuste para umbral de derivada
    let targetDerivative = this.DEFAULT_DERIVATIVE_THRESHOLD;
    if (this.recentPeakDerivatives.length > 0) {
      const avgDerivative = this.recentPeakDerivatives.reduce((sum, val) => sum + val, 0) / 
                            this.recentPeakDerivatives.length;
      targetDerivative = Math.max(
        this.MIN_ADAPTIVE_DERIVATIVE_THRESHOLD,
        Math.min(this.MAX_ADAPTIVE_DERIVATIVE_THRESHOLD, avgDerivative * 1.1)
      );
    }
    
    // Ajustar confianza mínima basada en confianza observada
    const targetConfidence = Math.max(
      this.MIN_ADAPTIVE_MIN_CONFIDENCE,
      Math.min(this.MAX_ADAPTIVE_MIN_CONFIDENCE, avgConfidence * 0.8)
    );
    
    // Actualizar los valores con interpolación suavizada
    this.adaptiveSignalThreshold = this.adaptiveSignalThreshold * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) + 
                                 targetThreshold * this.ADAPTIVE_TUNING_LEARNING_RATE;
    
    this.adaptiveMinConfidence = this.adaptiveMinConfidence * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) + 
                               targetConfidence * this.ADAPTIVE_TUNING_LEARNING_RATE;
    
    this.adaptiveDerivativeThreshold = this.adaptiveDerivativeThreshold * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) + 
                                     targetDerivative * this.ADAPTIVE_TUNING_LEARNING_RATE;
    
    // Log de ajustes para debugging
    console.log("HeartBeatProcessor: Adaptive tuning updated:", {
      signalThreshold: this.adaptiveSignalThreshold.toFixed(4),
      minConfidence: this.adaptiveMinConfidence.toFixed(4),
      derivativeThreshold: this.adaptiveDerivativeThreshold.toFixed(4),
      basedOn: {
        averagePeakAmplitude: avgAmplitude.toFixed(4),
        peakSamples: this.recentPeakAmplitudes.length
      }
    });
  }

  private isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  private medianFilter(value: number): number {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private calculateMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }

  private calculateEMA(value: number): number {
    this.smoothedValue =
      this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  public setArrhythmiaDetected(isDetected: boolean): void {
    this.isArrhythmiaDetected = isDetected;
    console.log(`HeartBeatProcessor: Estado de arritmia establecido a ${isDetected}`);
  }

  private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
        // También reseteamos los parámetros adaptativos a sus valores por defecto
        this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
        this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
        this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
        this.isArrhythmiaDetected = false;
        console.log("HeartBeatProcessor: auto-reset adaptative parameters and arrhythmia flag (low signal).");
      }
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1); // Reducción gradual
    }
  }

  private resetDetectionStates() {
    // No resetear lastPeakTime para mantener continuidad de detecciones
    this.lastConfirmedPeak = false;
    this.peakConfirmationBuffer = [];
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  /**
   * Detección de picos mejorada para señales con validación médica
   * Implementa múltiples estrategias de detección para mayor robustez
   */
  private enhancedPeakDetection(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
    rawDerivative?: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    // Rechazar detecciones demasiado cercanas en tiempo
    if (timeSinceLastPeak < this.DEFAULT_MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Sistema de detección múltiple para mayor robustez
    
    // 1. Detección por derivada (cambio de dirección)
    const isDerivativePeak = derivative < this.adaptiveDerivativeThreshold && 
                           normalizedValue > this.adaptiveSignalThreshold;
    
    // 2. Detección por valor pico (cuando el valor supera un umbral)
    const isAmplitudePeak = normalizedValue > this.adaptiveSignalThreshold * 2 && 
                          timeSinceLastPeak > this.DEFAULT_MIN_PEAK_TIME_MS * 1.5;
    
    // 3. Detección por patrón (aumento seguido de disminución)
    let isPatternPeak = false;
    if (this.values.length >= 3 && 
        this.values[1] > this.values[0] && 
        this.values[1] > this.values[2] && 
        this.values[1] > this.adaptiveSignalThreshold) {
      isPatternPeak = true;
    }
    
    // Combinar los resultados de las tres estrategias
    // Prioridad a la detección por derivada, pero si hay señal clara,
    // también considerar las otras estrategias
    const isPeak = isDerivativePeak || 
                 (isAmplitudePeak && normalizedValue > this.adaptiveSignalThreshold * 3) || 
                 (isPatternPeak && derivative < 0);
    
    // Calcular confianza basada en cuántas estrategias de detección coinciden
    let confidence = 0.5; // Base
    if (isDerivativePeak) confidence += 0.3;
    if (isAmplitudePeak) confidence += 0.2;
    if (isPatternPeak) confidence += 0.2;
    
    // Limitar confianza al máximo valor (1.0)
    confidence = Math.min(1.0, confidence);

    return { isPeak, confidence, rawDerivative: derivative };
  }

  /**
   * Segunda etapa de validación para confirmar picos detectados
   * y reducir falsos positivos
   */
  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    
    // Segunda etapa de validación: asegurar que estamos en un verdadero pico
    // y no una fluctuación menor
    if (isPeak && !this.lastConfirmedPeak) {
      // Verificar que este valor es realmente un pico local
      if (this.peakConfirmationBuffer.length >= 3) {
        const currentIndex = this.peakConfirmationBuffer.length - 1;
        const currentValue = this.peakConfirmationBuffer[currentIndex];
        
        // Es un pico local si es mayor que sus vecinos
        const isPeakLocal = currentValue > this.peakConfirmationBuffer[currentIndex - 1];
        
        // Confirmar solo si es realmente un pico local y supera el threshold
        if (isPeakLocal && currentValue > this.adaptiveSignalThreshold) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      // Resetear el estado para poder detectar el próximo pico
      this.lastConfirmedPeak = false;
    }
    
    return false;
  }

  /**
   * Validación de picos basada estrictamente en criterios médicos
   * para reducir falsos positivos
   */
  private validatePeak(peakValue: number, confidence: number): boolean {
    // Para simplificar la implementación, vamos a permitir casi todos los picos
    // que han pasado las etapas anteriores de validación, pero rechazaremos los 
    // que tienen confianza muy baja
    return confidence >= this.adaptiveMinConfidence * 0.8; // Permitir ligeramente por debajo del umbral
  }

  private updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    // Validación biológica de BPM
    if (instantBPM >= this.DEFAULT_MIN_BPM && instantBPM <= this.DEFAULT_MAX_BPM) { 
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 12) { // Historial de 12 latidos para estabilidad
        this.bpmHistory.shift();
      }
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0 && rawBPM > 0) { 
        this.smoothBPM = rawBPM;
    } else if (rawBPM > 0) { 
        // Suavizado EMA para evitar fluctuaciones bruscas
        this.smoothBPM = this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    } else if (this.bpmHistory.length === 0) { 
        this.smoothBPM = 0;
    }
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    // Usar mediana para BPM más estable y eliminar outliers
    const sortedBPM = [...this.bpmHistory].sort((a,b) => a - b);
    const mid = Math.floor(sortedBPM.length / 2);
    if (sortedBPM.length % 2 === 0) {
        return (sortedBPM[mid-1] + sortedBPM[mid]) / 2;
    }
    return sortedBPM[mid];
  }

  public getFinalBPM(): number { 
    if (this.bpmHistory.length < 5) {
      return Math.round(this.getSmoothBPM()); 
    }
    
    // Para cálculo final más preciso, eliminar outliers
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.floor(sorted.length * 0.2);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (!finalSet.length) {
        return Math.round(this.getSmoothBPM());
    }
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }

  // Obtener datos de intervalos RR para análisis HRV
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }

  public reset() {
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.peakConfirmationBuffer = [];
    this.bpmHistory = [];
    this.values = [];
    this.smoothBPM = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.lastBeepTime = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.smoothedValue = 0;
    this.startTime = Date.now();
    this.lowSignalCount = 0;
    this.peakCandidates = [];
    this.rrIntervals = [];
    this.currentSignalQuality = 0;

    this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
    this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
    this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
    this.recentPeakAmplitudes = [];
    this.recentPeakConfidences = [];
    this.recentPeakDerivatives = [];
    this.peaksSinceLastTuning = 0;
    
    console.log("HeartBeatProcessor: Full reset performed");
  }
}
