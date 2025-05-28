import { HumanFingerDetector, HumanFingerResult, HumanFingerDetectorConfig } from './HumanFingerDetector';
import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { AutoCalibrationSystem, CalibrationResult } from './AutoCalibrationSystem';
import { FrameData } from './types'; // Asumiendo que FrameData se define aquí o se importa
import { ProcessedSignal, ProcessingError } from '../../types/signal';
import { VitalSignsReferenceData } from '../vital-signs/VitalSignsProcessor'; // Importar el nuevo tipo
import { FrameProcessor } from './FrameProcessor'; // Importar FrameProcessor

export interface SignalPipelineConfig {
  // Configuraciones para HumanFingerDetector
  minRedReflectance: number;
  maxRedReflectance: number;
  minRGRatio: number;
  maxRGRatio: number;
  // ... otras configuraciones del detector

  // Configuraciones para filtros
  kalmanR: number;
  kalmanQ: number;
  sgWindowSize: number;

  // Otros parámetros del pipeline
  historySize: number;

  // Parámetros para la amplificación dinámica y otros procesamientos internos
  targetAmplitude: number;
  minAmplificationFactor: number;
  maxAmplificationFactor: number;

  // Nuevos campos para la configuración del detector de dedo que podrían ser calibrados
  pulsatilityThreshold?: number;
  stabilityFrameDiffThreshold?: number;
  stabilityWindowStdThreshold?: number;

  // Configuración para detección de picos y RR
  PEAK_VALIDATION_THRESHOLD?: number;
  RR_INTERVAL_MIN_MS?: number;
  RR_INTERVAL_MAX_MS?: number;
  TEXTURE_GRID_SIZE?: number; // Añadir configuración para FrameProcessor
  ROI_SIZE_FACTOR?: number;   // Añadir configuración para FrameProcessor
}

const defaultConfig: SignalPipelineConfig = {
  minRedReflectance: 40,
  maxRedReflectance: 230,
  minRGRatio: 0.9,
  maxRGRatio: 2.5,
  kalmanR: 0.01,
  kalmanQ: 0.1,
  sgWindowSize: 9,
  historySize: 100,
  targetAmplitude: 50,
  minAmplificationFactor: 5,
  maxAmplificationFactor: 40,
  pulsatilityThreshold: undefined,
  stabilityFrameDiffThreshold: undefined,
  stabilityWindowStdThreshold: undefined,
  PEAK_VALIDATION_THRESHOLD: 0.3, // Umbral por defecto para validación de picos
  RR_INTERVAL_MIN_MS: 300, // 300ms (200 BPM)
  RR_INTERVAL_MAX_MS: 2000, // 2000ms (30 BPM)
  TEXTURE_GRID_SIZE: 10, // Valor por defecto
  ROI_SIZE_FACTOR: 0.3, // Valor por defecto
};

// Interfaz para los datos que el pipeline necesita del AutoCalibrationSystem
interface EffectiveCalibrationResults {
  fingerThresholds?: { min: number; max: number } | null;
  signalParams?: { gain: number; offset: number } | null;
  // Otros parámetros relevantes que pueda devolver AutoCalibrationSystem
}

interface ExtendedProcessedSignal extends ProcessedSignal {
  calibrationPhase?: string;
  calibrationProgress?: number;
  calibrationInstructions?: string;
}

export class SignalProcessingPipeline {
  private config: SignalPipelineConfig;
  private humanFingerDetector: HumanFingerDetector;
  private kalmanFilter: OptimizedKalmanFilter;
  private sgFilter: SavitzkyGolayFilter;
  private autoCalibrationSystem: AutoCalibrationSystem;
  private frameProcessor: FrameProcessor; // Añadir FrameProcessor

  private signalHistoryForAmplification: number[] = []; // Historial para amplificación dinámica
  private baselineValue: number = 0;
  private lastProcessedSignal: ProcessedSignal | null = null;

  // Propiedades para detección de picos y RR (portado de VitalSignsProcessor)
  private lastValue: number = 0; // Para cálculo de derivada
  private peakValidationBuffer: number[] = []; // Buffer para validar picos
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private peakConfirmationBuffer: Array<{ isCandidate: boolean; value: number; confidence: number; }> = []; // Buffer para confirmar picos (ahora guarda objetos)
  private lastConfirmedPeak: boolean = false;
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;

  public onSignalReady?: (signal: ExtendedProcessedSignal) => void;
  public onError?: (error: ProcessingError) => void;
  public onCalibrationUpdate?: (calibrationStatus: { phase: string; progress: number; instructions: string; isComplete: boolean; results?: CalibrationResult }) => void;
  public isProcessing: boolean = false;
  private isCalibrating: boolean = false;

  // Callback para actualizar VitalSignsProcessor con el resultado de la calibración
  private vitalSignsUpdateCallback?: (isSuccess: boolean, referenceData?: VitalSignsReferenceData) => void;

  constructor(
    config: Partial<SignalPipelineConfig> = {},
    onSignalReady?: (signal: ExtendedProcessedSignal) => void,
    onError?: (error: ProcessingError) => void,
    onCalibrationUpdate?: (calibrationStatus: { phase: string; progress: number; instructions: string; isComplete: boolean; results?: CalibrationResult }) => void
  ) {
    this.config = { ...defaultConfig, ...config };
    this.humanFingerDetector = new HumanFingerDetector({
        MIN_RED_INTENSITY: this.config.minRedReflectance,
        MAX_RED_INTENSITY: this.config.maxRedReflectance,
        MIN_RG_RATIO: this.config.minRGRatio,
        PULSABILITY_STD_THRESHOLD: this.config.pulsatilityThreshold,
        STABILITY_FRAME_DIFF_THRESHOLD: this.config.stabilityFrameDiffThreshold,
        STABILITY_WINDOW_STD_THRESHOLD: this.config.stabilityWindowStdThreshold,
    });
    this.kalmanFilter = new OptimizedKalmanFilter(this.config.kalmanR, this.config.kalmanQ);
    this.sgFilter = new SavitzkyGolayFilter(this.config.sgWindowSize);
    this.autoCalibrationSystem = new AutoCalibrationSystem();
    this.frameProcessor = new FrameProcessor({
        TEXTURE_GRID_SIZE: this.config.TEXTURE_GRID_SIZE || 10, // Usar valor por defecto si no está en config
        ROI_SIZE_FACTOR: this.config.ROI_SIZE_FACTOR || 0.3 // Usar valor por defecto si no está en config
    });
    this.onSignalReady = onSignalReady;
    this.onError = onError;
    this.onCalibrationUpdate = onCalibrationUpdate;

    console.log("SignalProcessingPipeline: Inicializado con configuración", this.config);
    this.resetPeakDetectionStates(); // Inicializar estados de detección de picos
    this.reset(); // Usar el método reset público para inicializar estados
  }

  // Método para registrar el actualizador de VitalSignsProcessor
  public registerVitalSignsUpdater(updater: (isSuccess: boolean, referenceData?: VitalSignsReferenceData) => void): void {
    this.vitalSignsUpdateCallback = updater;
    console.log("SignalProcessingPipeline: VitalSignsUpdater registrado.");
  }

  public startCalibrationMode(): void {
    console.log("SignalProcessingPipeline: Iniciando modo calibración.");
    this.isCalibrating = true;
    this.autoCalibrationSystem.startCalibration();
    this.humanFingerDetector.reset();
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.baselineValue = 0;
    this.signalHistoryForAmplification = [];
    this.resetPeakDetectionStates(); // Resetear al iniciar calibración
    this.autoCalibrationSystem.reset(); // Usar método reset público
    if (this.onCalibrationUpdate) {
      const initialPhase = this.autoCalibrationSystem.getCurrentPhase ? this.autoCalibrationSystem.getCurrentPhase() : 'baseline';
      const initialProgress = this.autoCalibrationSystem.getCurrentProgress ? this.autoCalibrationSystem.getCurrentProgress() : 0;
      this.onCalibrationUpdate({ phase: initialPhase, progress: initialProgress, instructions: 'Iniciando calibración...', isComplete: false });
    }
  }

  public endCalibrationMode(referenceDataForVitalSigns?: VitalSignsReferenceData): void {
    console.log("SignalProcessingPipeline: Finalizando modo calibración.");
    this.isCalibrating = false;
    
    const finalCalibrationResults = this.autoCalibrationSystem.getCalibrationResults();
    this.applyCalibrationResults(finalCalibrationResults, referenceDataForVitalSigns);

    if (this.onCalibrationUpdate) {
      this.onCalibrationUpdate({ 
        phase: 'complete', 
        progress: 100, 
        instructions: 'Calibración completada.', 
        isComplete: true,
        results: finalCalibrationResults
      });
    }
  }

  private applyCalibrationResults(calibrationResults: CalibrationResult, referenceData?: VitalSignsReferenceData): void {
    console.log("SignalProcessingPipeline: Aplicando resultados de calibración", calibrationResults);
    if (calibrationResults.success) {
      const newDetectorConfig: Partial<HumanFingerDetectorConfig> = {};
      let reconfigureDetector = false;

      if (calibrationResults.thresholds && calibrationResults.thresholds.min !== undefined && calibrationResults.thresholds.max !== undefined) {
        newDetectorConfig.MIN_RED_INTENSITY = calibrationResults.thresholds.min;
        newDetectorConfig.MAX_RED_INTENSITY = calibrationResults.thresholds.max;
        reconfigureDetector = true;
        console.log("SignalProcessingPipeline: Nuevos umbrales de rojo para detector:", newDetectorConfig);
      }

      if (reconfigureDetector) {
        this.humanFingerDetector.configure(newDetectorConfig);
        console.log("HumanFingerDetector reconfigurado con resultados de calibración.");
      }

      if (calibrationResults.signalParams) {
        if (calibrationResults.signalParams.gain !== undefined) {
            this.config.minAmplificationFactor = Math.max(3, Math.min(20, defaultConfig.minAmplificationFactor * (calibrationResults.signalParams.gain * 0.8 + 0.2)));
            this.config.maxAmplificationFactor = Math.max(20, Math.min(60, defaultConfig.maxAmplificationFactor * (calibrationResults.signalParams.gain * 0.7 + 0.3)));
            this.config.targetAmplitude = defaultConfig.targetAmplitude * (calibrationResults.signalParams.gain * 0.5 + 0.5);
            console.log("SignalProcessingPipeline: Factores de amplificación ajustados por calibración:", {
                min: this.config.minAmplificationFactor,
                max: this.config.maxAmplificationFactor,
                target: this.config.targetAmplitude
            });
        }
      }
       console.log("SignalProcessingPipeline: Resultados de calibración de AutoCalSys aplicados al pipeline.");

      // Notificar a VitalSignsProcessor sobre el éxito de la calibración y pasar datos de referencia si existen
      if (this.vitalSignsUpdateCallback) {
        console.log("SignalProcessingPipeline: Llamando a vitalSignsUpdateCallback.");
        this.vitalSignsUpdateCallback(true, referenceData); 
      } else {
        console.warn("SignalProcessingPipeline: vitalSignsUpdateCallback no está registrado. VitalSignsProcessor no será notificado del estado de calibración.");
      }

    } else {
      console.warn("SignalProcessingPipeline: Calibración no exitosa, no se aplicaron resultados.", calibrationResults.recommendations);
      // Notificar a VitalSignsProcessor sobre el fallo de la calibración
      if (this.vitalSignsUpdateCallback) {
        this.vitalSignsUpdateCallback(false, referenceData); // referenceData podría ser útil incluso en fallo para logging o reintento
      }
    }
  }

  /**
   * Lógica de procesamiento de señal PPG inspirada en SignalProcessingCore.
   * Esta función se llamaría DESPUÉS de que HumanFingerDetector confirme un dedo.
   */
  private processPPGSignal(rawValue: number, currentQuality: number): { filteredValue: number, amplifiedValue: number } {
    if (this.baselineValue === 0 && this.signalHistoryForAmplification.length < 5) {
      this.baselineValue = rawValue;
    } else {
      const sortedHistory = [...this.signalHistoryForAmplification.slice(-10), rawValue].sort((a,b)=>a-b);
      const medianBaseline = sortedHistory[Math.floor(sortedHistory.length/2)] || rawValue;
      this.baselineValue = this.baselineValue * 0.95 + medianBaseline * 0.05; 
    }

    const normalizedForKalman = rawValue - this.baselineValue;
    const kalmanFiltered = this.kalmanFilter.filter(normalizedForKalman);
    const sgFiltered = this.sgFilter.filter(kalmanFiltered); // Savitzky-Golay sobre la señal ya normalizada y filtrada por Kalman
    
    const filteredValueRebased = sgFiltered + this.baselineValue; // Re-añadir baseline para tener valor absoluto

    // Normalización respecto al baseline para amplificación
    const normalizedForAmplification = sgFiltered; // Usamos la señal ya filtrada y normalizada (sin baseline)
    
    // Amplificación dinámica basada en la varianza de la señal reciente
    const amplificationFactor = this.calculateDynamicAmplification();
    const amplifiedValue = normalizedForAmplification * amplificationFactor; // Este valor es AC

    // Actualizar historial de señal *amplificada y AC* para el cálculo de la amplificación dinámica
    this.signalHistoryForAmplification.push(amplifiedValue);
    if (this.signalHistoryForAmplification.length > this.config.historySize) { // Usa historySize de config
      this.signalHistoryForAmplification.shift();
    }
    
    return {
      filteredValue: filteredValueRebased, // Este es el valor filtrado pero en escala original
      amplifiedValue: amplifiedValue + this.baselineValue, // Este es el valor AC amplificado, re-baseado para la salida
    };
  }

  /**
   * Calcular factor de amplificación dinámico (de SignalProcessingCore)
   */
  private calculateDynamicAmplification(): number {
    if (this.signalHistoryForAmplification.length < 20) {
      return (this.config.minAmplificationFactor + this.config.maxAmplificationFactor) / 2;
    }
    const recentProcessedSignal = this.signalHistoryForAmplification.slice(-20);
    const minVal = Math.min(...recentProcessedSignal);
    const maxVal = Math.max(...recentProcessedSignal);
    const currentAmplitude = maxVal - minVal;

    if (currentAmplitude < 0.1) return this.config.maxAmplificationFactor;
    if (currentAmplitude > this.config.targetAmplitude * 2) return this.config.minAmplificationFactor;

    const targetAmp = this.config.targetAmplitude;
    const minAmp = this.config.minAmplificationFactor;
    const maxAmp = this.config.maxAmplificationFactor;

    // Lógica de ajuste: si la amplitud es menor que el objetivo, aumentar ganancia;
    // si es mayor, disminuir. Clamp entre minAmp y maxAmp.
    let factor = targetAmp / currentAmplitude; // Factor ideal para alcanzar el objetivo
    factor = Math.max(minAmp / factor, Math.min(maxAmp / factor, 1)); // Ajustar factor basándose en el valor actual
    factor = Math.max(minAmp, Math.min(maxAmp, factor)); // Clamp final

    return factor;
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return; // Solo procesar si el pipeline está activo
    
    // 1. Extraer datos básicos del frame
    const currentFrameData = this.frameProcessor.extractFrameData(imageData); // Renombrar para evitar conflictos si es necesario
    
    // 2. Detectar dedo humano y obtener calidad inicial
    const fingerDetectionResult = this.humanFingerDetector.detectHumanFinger(imageData);

    // Si estamos calibrando, pasar los datos al sistema de calibración
    if (this.isCalibrating) {
        // Combinar datos del frame y del detector para pasar a processSample
        const dataForCalibration = {
            redValue: currentFrameData.redValue, // Del FrameData
            avgGreen: currentFrameData.avgGreen || 0, // Del FrameData (usar 0 si undefined)
            avgBlue: currentFrameData.avgBlue || 0,   // Del FrameData (usar 0 si undefined)
            quality: fingerDetectionResult.quality, // Usar calidad del detector
            fingerDetected: fingerDetectionResult.isHumanFinger // Usar resultado del detector
        };
        const calibrationUpdate = this.autoCalibrationSystem.processSample(dataForCalibration);

        if (this.onCalibrationUpdate) {
          const fullResults = this.autoCalibrationSystem.getCalibrationResults();
          this.onCalibrationUpdate({ ...calibrationUpdate, results: fullResults });
        }

        if (calibrationUpdate.isComplete) {
          console.log("SignalProcessingPipeline: AutoCalibrationSystem ha completado su proceso.");
          // endCalibrationMode podría requerir referenceData, manejar esto en la UI o en otro lugar si es necesario
          this.endCalibrationMode(); 
        }

        // No procesar señal ni signos vitales durante la calibración activa, solo emitir estado de calibración
        const signalDuringCalibration: ExtendedProcessedSignal = {
             timestamp: Date.now(),
             rawValue: currentFrameData.redValue, // Raw del frame
             filteredValue: 0, // Resetear valores procesados
             amplifiedValue: 0,
             quality: fingerDetectionResult.quality, // Calidad del detector
             fingerDetected: fingerDetectionResult.isHumanFinger,
             roi: currentFrameData.roi || { x: 0, y: 0, width: 0, height: 0 }, // ROI del frame data (con fallback)
             perfusionIndex: currentFrameData.perfusionIndex, // PI del frame data
             rrData: { intervals: [], lastPeakTime: null }, // No hay RR data durante calibración
             calibrationPhase: calibrationUpdate.phase,
             calibrationProgress: calibrationUpdate.progress,
             calibrationInstructions: calibrationUpdate.instructions,
             debugInfo: { ...fingerDetectionResult.debugInfo } // Pasar info de debug del detector
        };
         if (this.onSignalReady) {
            this.onSignalReady(signalDuringCalibration);
        }
        return; // Detener procesamiento de señal si está calibrando
    }

    // Solo continuar si el dedo es detectado y la calidad es razonable (ej. > 20)
    if (!fingerDetectionResult.isHumanFinger || fingerDetectionResult.quality < 20) {
        // Si se pierde el dedo o la calidad cae, emitir una señal con detección = false
        const noFingerSignal: ExtendedProcessedSignal = {
             timestamp: Date.now(),
             rawValue: currentFrameData.redValue, // Raw del frame
             filteredValue: 0, // Resetear valores procesados
             amplifiedValue: 0,
             quality: fingerDetectionResult.quality, // Calidad del detector
             fingerDetected: false,
             roi: currentFrameData.roi || { x: 0, y: 0, width: 0, height: 0 }, // ROI del frame data (con fallback)
             perfusionIndex: currentFrameData.perfusionIndex, // PI del frame data
             debugInfo: fingerDetectionResult.debugInfo, // Pasar info de debug del detector
             rrData: { intervals: [], lastPeakTime: null }, // Resetear RR Data
             calibrationPhase: this.autoCalibrationSystem.getCurrentPhase ? this.autoCalibrationSystem.getCurrentPhase() : undefined,
             calibrationProgress: this.autoCalibrationSystem.getCurrentProgress ? this.autoCalibrationSystem.getCurrentProgress() : undefined,
             calibrationInstructions: this.autoCalibrationSystem.getCurrentPhase ? this.autoCalibrationSystem.getCurrentPhase() : "Finger not detected or quality too low.", // Mostrar fase de calibración si está en ella, sino mensaje fijo
        };
         if (this.onSignalReady) {
            this.onSignalReady(noFingerSignal);
        }
        // Resetear estados de detección de picos cuando se pierde el dedo
        this.resetPeakDetectionStates();
        return; // Detener procesamiento si no hay dedo o calidad baja
    }

    // 3. Procesar la señal PPG (filtrado, amplificación, etc.)
    // Usar el rawValue (promedio rojo) del FrameProcessor para el procesamiento de señal
    const processedSignalValues = this.processPPGSignal(currentFrameData.redValue, fingerDetectionResult.quality); // Pasar quality

    // 4. Detección de picos y cálculo de intervalos RR (NUEVO: Centralizado en Pipeline)
    const peakDetectionResult = this.enhancedPeakDetectionInternal(processedSignalValues.filteredValue, processedSignalValues.filteredValue - this.lastValue);
    this.lastValue = processedSignalValues.filteredValue;

    if (peakDetectionResult.isPeak) {
        this.peakCandidateIndex = this.peakValidationBuffer.length;
        this.peakCandidateValue = processedSignalValues.filteredValue;
        this.peakConfirmationBuffer.push({ isCandidate: true, value: processedSignalValues.filteredValue, confidence: peakDetectionResult.confidence });
    } else {
        this.peakConfirmationBuffer.push({ isCandidate: false, value: processedSignalValues.filteredValue, confidence: 0 });
    }

    if (this.peakCandidateIndex !== null && this.peakConfirmationBuffer[this.peakCandidateIndex].isCandidate) {
        const confirmedPeak = this.confirmPeakInternal(this.peakCandidateIndex !== null, this.peakCandidateValue, this.peakConfirmationBuffer[this.peakCandidateIndex].confidence);
        if (confirmedPeak) {
            const peakRRInterval = this.calculateRRInterval(this.lastPeakTime, fingerDetectionResult.timestamp);
            this.rrIntervals.push(peakRRInterval);
            this.lastPeakTime = fingerDetectionResult.timestamp;
            this.previousPeakTime = this.lastPeakTime;
        }
    }

    // 5. Construir señal procesada
    const now = Date.now();
    const currentRRData = {
        intervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime
    };
    this.lastProcessedSignal = {
        timestamp: now,
        rawValue: currentFrameData.redValue,
        filteredValue: processedSignalValues.filteredValue,
        amplifiedValue: processedSignalValues.amplifiedValue,
        quality: fingerDetectionResult.quality, // Usar calidad del detector
        fingerDetected: fingerDetectionResult.isHumanFinger,
        roi: currentFrameData.roi || { x: 0, y: 0, width: 0, height: 0 }, // Usar ROI del FrameProcessor si existe, sino default
        perfusionIndex: currentFrameData.perfusionIndex, // Pasar PI si está disponible
        debugInfo: fingerDetectionResult.debugInfo,
        rrData: currentRRData, // Incluir RR Data
        calibrationPhase: this.isCalibrating ? this.autoCalibrationSystem.getCurrentPhase() : undefined, // Estado de calibración
        calibrationProgress: this.isCalibrating ? this.autoCalibrationSystem.getCurrentProgress() : undefined, // Progreso
        calibrationInstructions: this.isCalibrating && this.autoCalibrationSystem.getCurrentPhase() ? this.autoCalibrationSystem.getCurrentPhase() : undefined // Simplificar a solo mostrar la fase durante calibración
    };

    if (this.onSignalReady) {
        this.onSignalReady(this.lastProcessedSignal as ExtendedProcessedSignal);
    }
  }

  private resetFiltersAndBaseline(): void {
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.baselineValue = 0;
    this.signalHistoryForAmplification = [];
  }

  public start(): void {
    this.isProcessing = true;
    this.reset(); // Asegurar estado limpio al iniciar
    console.log("SignalProcessingPipeline: Iniciado y reseteado");
  }

  public stop(): void {
    this.isProcessing = false;
    this.isCalibrating = false;
    console.log("SignalProcessingPipeline: Detenido");
  }

  public reset(): void {
    console.log("SignalProcessingPipeline: Reseteando completamente.");
    this.isProcessing = false;
    this.humanFingerDetector.reset();
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.autoCalibrationSystem.reset(); // Usar método reset público de AutoCalibrationSystem
    this.baselineValue = 0;
    this.signalHistoryForAmplification = [];
    this.lastProcessedSignal = null;
    this.resetPeakDetectionStates(); // Resetear también estados de detección de picos
    console.log("SignalProcessingPipeline: Componentes internos reseteados, calibración reiniciada.");
  }

  // Podríamos añadir un método para obtener el último valor procesado si es necesario externamente
  public getLastProcessedSignal(): ProcessedSignal | null {
    return this.lastProcessedSignal;
  }

  // --- Lógica de detección de picos y RR (Portado de VitalSignsProcessor) ---

  private enhancedPeakDetectionInternal(normalizedValue: number, derivative: number): {
      isPeak: boolean;
      confidence: number;
      rawDerivative?: number;
  } {
      // Lógica de detección de picos portada de VitalSignsProcessor (simplificada o adaptada)
      let isPeakCandidate = false;
      let confidence = 0;

      // Criterio 1: Derivada cruza de positivo a negativo (punto de inflexión/máximo)
      if (derivative < 0 && (normalizedValue - (this.lastValue + derivative)) > 0) { // Derivada negativa actual, derivada anterior positiva
           isPeakCandidate = true;
           confidence += 0.4;
      }

      // Criterio 2: Valor actual es un máximo local en un pequeño buffer
      this.peakValidationBuffer.push(normalizedValue);
      if (this.peakValidationBuffer.length > 5) { // Buffer de 5 muestras (ajustable)
          this.peakValidationBuffer.shift();
      }
      if (this.peakValidationBuffer.length === 5) {
          const middleIndex = Math.floor(this.peakValidationBuffer.length / 2);
          if (this.peakValidationBuffer[middleIndex] > Math.max(...this.peakValidationBuffer.slice(0, middleIndex), ...this.peakValidationBuffer.slice(middleIndex + 1))) {
              // Es un máximo local
              isPeakCandidate = true;
              confidence += 0.3;
              // Calcular confianza basada en la prominencia del pico
              const prominence = this.peakValidationBuffer[middleIndex] - Math.min(...this.peakValidationBuffer.slice(0, middleIndex), ...this.peakValidationBuffer.slice(middleIndex + 1));
              confidence += Math.min(0.3, prominence / this.config.PEAK_VALIDATION_THRESHOLD); // Ajustar umbral de confianza
          }
      }

      // Criterio 3: Combinación de forma de onda y velocidad de cambio (ej. upstroke rápido)
      // Esto es más avanzado y podría requerir un análisis morfológico más profundo. 
      // Por ahora, nos basaremos en los primeros dos criterios principalmente.
      // Si se implementara, añadiría más confianza.

      confidence = Math.min(1, confidence); // Clamp confianza a 1

      // Lógica de histéresis o confirmación adicional si es necesario

      return {
          isPeak: isPeakCandidate && confidence > 0.5, // Solo considerar pico si hay confianza mínima
          confidence: confidence,
          rawDerivative: derivative
      };
  }

  private confirmPeakInternal(
      isPeakCandidate: boolean,
      normalizedValue: number,
      confidence: number
  ): boolean {
      // Lógica de confirmación de pico portada de VitalSignsProcessor (simplificada o adaptada)
      // Usar un buffer para confirmar que el pico es persistente o cumple criterios adicionales.
      this.peakConfirmationBuffer.push({ isCandidate: isPeakCandidate, value: normalizedValue, confidence: confidence });
      if (this.peakConfirmationBuffer.length > 3) { // Buffer de 3 muestras (ajustable)
          this.peakConfirmationBuffer.shift();
      }

      if (this.peakConfirmationBuffer.length < 3) return false; // No hay suficientes datos para confirmar

      // Criterio de confirmación: Al menos 2 de las últimas 3 muestras son candidatos con confianza razonable
      const confirmedCount = this.peakConfirmationBuffer.filter(p => p.isCandidate && p.confidence > 0.4).length;

      // Criterio adicional: El pico actual (si es candidato) es el valor más alto en el buffer de confirmación
      const currentCandidate = this.peakConfirmationBuffer[this.peakConfirmationBuffer.length - 1];
      const isHighestInBuffer = currentCandidate.isCandidate && currentCandidate.value >= Math.max(...this.peakConfirmationBuffer.map(p => p.value));

      return confirmedCount >= 2 || isHighestInBuffer; // Confirmar si cumple el criterio de conteo o es el más alto
  }

  private resetPeakDetectionStates(){
      this.lastValue = 0;
      this.peakValidationBuffer = [];
      this.peakCandidateIndex = null;
      this.peakCandidateValue = 0;
      this.peakConfirmationBuffer = []; // Resetear como array de objetos
      this.lastConfirmedPeak = false;
      this.rrIntervals = []; // Resetear también intervalos RR
      this.lastPeakTime = null;
      this.previousPeakTime = null;
      console.log("Pipeline: Estados de detección de picos reseteados.");
  }

  private calculateRRInterval(lastPeakTime: number | null, currentPeakTime: number): number {
    if (lastPeakTime === null || currentPeakTime === null) {
        return 0; // Si no hay información suficiente, devolver 0
    }
    const interval = currentPeakTime - lastPeakTime;
    return Math.max(this.config.RR_INTERVAL_MIN_MS, Math.min(this.config.RR_INTERVAL_MAX_MS, interval));
  }

  // --- Fin Lógica de detección de picos y RR ---
} 