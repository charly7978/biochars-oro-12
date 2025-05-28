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
    const currentFrameData = this.frameProcessor.extractFrameData(imageData);

    // Create a cropped ImageData based on the dynamically detected ROI
    const roi = currentFrameData.roi;
    const croppedImageData = new ImageData(
        new Uint8ClampedArray(imageData.data.buffer,
                              (roi.y * imageData.width + roi.x) * 4,
                              roi.width * roi.height * 4),
        roi.width, roi.height
    );

    // 2. Detectar dedo humano y obtener calidad inicial using the cropped image data
    const fingerDetectionResult = this.humanFingerDetector.detectHumanFinger(croppedImageData);

    // Si estamos calibrando, pasar los datos al sistema de calibración
    if (this.isCalibrating) {
      // Combinar datos del frame y del detector para pasar a processSample
      const dataForCalibration = {
        redValue: currentFrameData.redValue,
        avgGreen: currentFrameData.avgGreen || 0,
        avgBlue: currentFrameData.avgBlue || 0,
        quality: fingerDetectionResult.quality,
        fingerDetected: fingerDetectionResult.isHumanFinger,
      };
      const calibrationUpdate = this.autoCalibrationSystem.processSample(dataForCalibration);

      if (this.onCalibrationUpdate) {
        const fullResults = this.autoCalibrationSystem.getCalibrationResults();
        this.onCalibrationUpdate({ ...calibrationUpdate, results: fullResults });
      }

      if (calibrationUpdate.isComplete) {
        console.log("SignalProcessingPipeline: AutoCalibrationSystem ha completado su proceso.");
        this.endCalibrationMode();
      }

      // No procesar señal ni signos vitales durante la calibración activa, solo emitir estado de calibración
      const signalDuringCalibration: ExtendedProcessedSignal = {
        timestamp: Date.now(),
        rawValue: currentFrameData.redValue,
        filteredValue: 0,
        amplifiedValue: 0,
        quality: fingerDetectionResult.quality,
        fingerDetected: fingerDetectionResult.isHumanFinger,
        roi: currentFrameData.roi || { x: 0, y: 0, width: 0, height: 0 },
        perfusionIndex: currentFrameData.perfusionIndex,
        rrData: { intervals: [], lastPeakTime: null },
        calibrationPhase: calibrationUpdate.phase,
        calibrationProgress: calibrationUpdate.progress,
        calibrationInstructions: calibrationUpdate.instructions,
        debugInfo: { ...fingerDetectionResult.debugInfo },
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
        rawValue: currentFrameData.redValue,
        filteredValue: 0,
        amplifiedValue: 0,
        quality: fingerDetectionResult.quality,
        fingerDetected: false,
        roi: currentFrameData.roi || { x: 0, y: 0, width: 0, height: 0 },
        perfusionIndex: currentFrameData.perfusionIndex,
        debugInfo: fingerDetectionResult.debugInfo,
        rrData: { intervals: [], lastPeakTime: null },
        calibrationPhase: this.autoCalibrationSystem.getCurrentPhase ? this.autoCalibrationSystem.getCurrentPhase() : undefined,
        calibrationProgress: this.autoCalibrationSystem.getCurrentProgress ? this.autoCalibrationSystem.getCurrentProgress() : undefined,
        calibrationInstructions: this.autoCalibrationSystem.getCurrentPhase ? this.autoCalibrationSystem.getCurrentPhase() : "Finger not detected or quality too low.",
      };
      if (this.onSignalReady) {
        this.onSignalReady(noFingerSignal);
      }
      // Resetear estados de detección de picos cuando se pierde el dedo
      this.resetPeakDetectionStates();
      return; // Detener procesamiento si no hay dedo o calidad baja
    }

    // 3. Procesar la señal PPG (filtrado, amplificación, etc.)
    const processedSignalValues = this.processPPGSignal(currentFrameData.redValue, fingerDetectionResult.quality);

    // 4. Detección de picos y cálculo de intervalos RR (NUEVO: Centralizado en Pipeline)
    const now = Date.now();
    const signalForPeakDetection = processedSignalValues.amplifiedValue;
    const derivativeForPeakDetection = signalForPeakDetection - this.lastValue;
    this.lastValue = signalForPeakDetection;

    const peakDetectionResult = this.enhancedPeakDetectionInternal(signalForPeakDetection, derivativeForPeakDetection);
    let isPeak = peakDetectionResult.isPeak;
    const peakConfidence = peakDetectionResult.confidence;

    isPeak = this.confirmPeakInternal(isPeak, signalForPeakDetection, peakConfidence);

    let currentRRData: { intervals: number[]; lastPeakTime: number | null } = { intervals: [], lastPeakTime: null };
    if (isPeak && this.lastConfirmedPeak) {
      const peakTime = now;
      if (this.lastPeakTime !== null) {
        const rrInterval = peakTime - this.lastPeakTime;
        if (rrInterval >= (this.config.RR_INTERVAL_MIN_MS || 300) && rrInterval <= (this.config.RR_INTERVAL_MAX_MS || 2000)) {
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > 120) {
            this.rrIntervals.shift();
          }
          console.log("Pipeline: RR Interval detectado", rrInterval);
        } else {
          console.warn("Pipeline: RR Interval fuera de rango plausible", rrInterval);
        }
      } else {
        console.log("Pipeline: Primer pico detectado.");
      }
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = peakTime;
      currentRRData = { intervals: [...this.rrIntervals], lastPeakTime: this.lastPeakTime };
    }
    this.lastConfirmedPeak = isPeak;

    // 5. Construir y emitir la señal procesada completa
    this.lastProcessedSignal = {
      timestamp: now,
      rawValue: currentFrameData.redValue,
      filteredValue: processedSignalValues.filteredValue,
      amplifiedValue: processedSignalValues.amplifiedValue,
      quality: fingerDetectionResult.quality,
      fingerDetected: fingerDetectionResult.isHumanFinger,
      roi: currentFrameData.roi || { x: 0, y: 0, width: 0, height: 0 },
      perfusionIndex: currentFrameData.perfusionIndex,
      debugInfo: fingerDetectionResult.debugInfo,
      rrData: currentRRData,
      calibrationPhase: this.isCalibrating ? this.autoCalibrationSystem.getCurrentPhase() : undefined,
      calibrationProgress: this.isCalibrating ? this.autoCalibrationSystem.getCurrentProgress() : undefined,
      calibrationInstructions: this.isCalibrating && this.autoCalibrationSystem.getCurrentPhase() ? this.autoCalibrationSystem.getCurrentPhase() : undefined,
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
      // Lógica de detección de picos portada de VitalSignsProcessor
      const SIGNAL_THRESHOLD = 0.02; // Umbral base para la señal (ajustable)
      const DERIVATIVE_THRESHOLD = -0.005; // Umbral base para la derivada (ajustable)
      const MIN_CONFIDENCE = 0.30; // Confianza mínima para considerar un pico (ajustable)
      const PEAK_DETECTION_SENSITIVITY = 0.6; // Sensibilidad para refinar detección (ajustable)

      let isPeak = false;
      let confidence = 0;
      const rawDerivative = derivative;

      // Condición principal para un pico: valor sobre umbral y derivada negativa (punto de inflexión después de subir)
      if (normalizedValue > SIGNAL_THRESHOLD && derivative < DERIVATIVE_THRESHOLD) {
          isPeak = true;
          // Calcular confianza basada en qué tan por encima del umbral está y la magnitud de la derivada negativa
          const signalConfidence = Math.min(1, (normalizedValue - SIGNAL_THRESHOLD) / SIGNAL_THRESHOLD);
          const derivativeConfidence = Math.min(1, Math.abs(derivative) / Math.abs(DERIVATIVE_THRESHOLD));
          confidence = (signalConfidence * 0.6 + derivativeConfidence * 0.4) * PEAK_DETECTION_SENSITIVITY; // Ajustar peso y sensibilidad
          confidence = Math.max(MIN_CONFIDENCE, Math.min(1, confidence)); // Asegurar mínimo y máximo
      }

      return {
          isPeak,
          confidence: confidence,
          rawDerivative: rawDerivative
      };
  }

  private confirmPeakInternal(
      isPeakCandidate: boolean,
      normalizedValue: number,
      confidence: number
  ): boolean {
      // Lógica de confirmación de pico portada de VitalSignsProcessor
      const CONFIRMATION_WINDOW_SIZE = 5; // Tamaño del buffer para confirmar (ajustable)
      const CONFIDENCE_THRESHOLD = 0.5; // Umbral de confianza para considerar en buffer (ajustable)

      this.peakConfirmationBuffer.push({ value: normalizedValue, confidence: confidence, isCandidate: isPeakCandidate });
      if (this.peakConfirmationBuffer.length > CONFIRMATION_WINDOW_SIZE) {
          this.peakConfirmationBuffer.shift();
      }

      if (this.peakConfirmationBuffer.length < CONFIRMATION_WINDOW_SIZE) {
          return false; // No hay suficientes datos para confirmar
      }

      // Criterios de confirmación:
      // 1. El último punto debe ser un candidato a pico.
      // 2. Al menos N puntos en el buffer deben tener una confianza razonable.
      // 3. El punto candidato debe ser el valor más alto (o cercano al más alto) en el buffer.

      const lastPoint = this.peakConfirmationBuffer[this.peakConfirmationBuffer.length - 1];
      if (!lastPoint.isCandidate) return false;

      const highConfidenceCount = this.peakConfirmationBuffer.filter(p => p.confidence >= CONFIDENCE_THRESHOLD).length;
      if (highConfidenceCount < Math.ceil(CONFIRMATION_WINDOW_SIZE / 2)) { // Requerir al menos la mitad con alta confianza
          return false;
      }

      // Verificar si el último punto es el máximo o muy cercano en el buffer
      const maxBufferValue = Math.max(...this.peakConfirmationBuffer.map(p => p.value));
      const isNearMax = lastPoint.value >= maxBufferValue * 0.95; // Dentro del 5% del máximo (ajustable)

      return isNearMax; // Confirmar si pasa todos los criterios
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
    // Validar contra los umbrales de la configuración del pipeline
    const minRR = this.config.RR_INTERVAL_MIN_MS || 300;
    const maxRR = this.config.RR_INTERVAL_MAX_MS || 2000;
    return Math.max(minRR, Math.min(maxRR, interval));
  }

  // --- Fin Lógica de detección de picos y RR ---
} 