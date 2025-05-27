import { HumanFingerDetector, HumanFingerResult, HumanFingerDetectorConfig } from './HumanFingerDetector';
import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { AutoCalibrationSystem } from './AutoCalibrationSystem';
import { FrameData } from './types'; // Asumiendo que FrameData se define aquí o se importa
import { ProcessedSignal, ProcessingError } from '../../types/signal';

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

  private signalHistoryForAmplification: number[] = []; // Historial para amplificación dinámica
  private baselineValue: number = 0;
  private lastProcessedSignal: ProcessedSignal | null = null;

  public onSignalReady?: (signal: ExtendedProcessedSignal) => void;
  public onError?: (error: ProcessingError) => void;
  public onCalibrationUpdate?: (calibrationStatus: { phase: string; progress: number; instructions: string; isComplete: boolean;}) => void;
  public isProcessing: boolean = false;
  private isCalibrating: boolean = false;

  constructor(
    config: Partial<SignalPipelineConfig> = {},
    onSignalReady?: (signal: ExtendedProcessedSignal) => void,
    onError?: (error: ProcessingError) => void,
    onCalibrationUpdate?: (calibrationStatus: { phase: string; progress: number; instructions: string; isComplete: boolean;}) => void
  ) {
    this.config = { ...defaultConfig, ...config };
    this.humanFingerDetector = new HumanFingerDetector({
        MIN_RED_INTENSITY: this.config.minRedReflectance,
        MAX_RED_INTENSITY: this.config.maxRedReflectance,
        MIN_RG_RATIO: this.config.minRGRatio,
        PULSABILITY_THRESHOLD: this.config.pulsatilityThreshold,
        STABILITY_FRAME_DIFF_THRESHOLD: this.config.stabilityFrameDiffThreshold,
        STABILITY_THRESHOLD_WINDOW_STDDEV: this.config.stabilityWindowStdThreshold,
    });
    this.kalmanFilter = new OptimizedKalmanFilter(this.config.kalmanR, this.config.kalmanQ);
    this.sgFilter = new SavitzkyGolayFilter(this.config.sgWindowSize);
    this.autoCalibrationSystem = new AutoCalibrationSystem();
    this.onSignalReady = onSignalReady;
    this.onError = onError;
    this.onCalibrationUpdate = onCalibrationUpdate;

    console.log("SignalProcessingPipeline: Inicializado con configuración", this.config);
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
    if (this.onCalibrationUpdate) {
      const initialPhase = this.autoCalibrationSystem.getCurrentPhase ? this.autoCalibrationSystem.getCurrentPhase() : 'baseline';
      const initialProgress = this.autoCalibrationSystem.getCurrentProgress ? this.autoCalibrationSystem.getCurrentProgress() : 0;
      this.onCalibrationUpdate({ phase: initialPhase, progress: initialProgress, instructions: 'Iniciando calibración...', isComplete: false });
    }
  }

  public endCalibrationMode(calibrationResults?: any): void {
    console.log("SignalProcessingPipeline: Finalizando modo calibración.");
    this.isCalibrating = false;
    if (calibrationResults) {
      this.applyCalibrationResults(calibrationResults);
    }
    if (this.onCalibrationUpdate) {
      this.onCalibrationUpdate({ phase: 'complete', progress: 100, instructions: 'Calibración completada.', isComplete: true });
    }
  }

  private applyCalibrationResults(results: any): void {
    console.log("SignalProcessingPipeline: Aplicando resultados de calibración", results);
    if (results.success) {
      const newDetectorConfig: Partial<HumanFingerDetectorConfig> = {};
      let reconfigureDetector = false;

      if (results.thresholds && results.thresholds.min !== undefined && results.thresholds.max !== undefined) {
        newDetectorConfig.MIN_RED_INTENSITY = results.thresholds.min;
        newDetectorConfig.MAX_RED_INTENSITY = results.thresholds.max;
        reconfigureDetector = true;
        console.log("SignalProcessingPipeline: Nuevos umbrales de rojo para detector:", newDetectorConfig);
      }

      if (reconfigureDetector) {
        this.humanFingerDetector.configure(newDetectorConfig);
        console.log("HumanFingerDetector reconfigurado con resultados de calibración.");
      }

      if (results.signalParams) {
        if (results.signalParams.gain !== undefined) {
            this.config.minAmplificationFactor = Math.max(3, Math.min(20, defaultConfig.minAmplificationFactor * (results.signalParams.gain * 0.8 + 0.2)));
            this.config.maxAmplificationFactor = Math.max(20, Math.min(60, defaultConfig.maxAmplificationFactor * (results.signalParams.gain * 0.7 + 0.3)));
            this.config.targetAmplitude = defaultConfig.targetAmplitude * (results.signalParams.gain * 0.5 + 0.5);
            console.log("SignalProcessingPipeline: Factores de amplificación ajustados por calibración:", {
                min: this.config.minAmplificationFactor,
                max: this.config.maxAmplificationFactor,
                target: this.config.targetAmplitude
            });
        }
      }
       console.log("SignalProcessingPipeline: Resultados de calibración aplicados.");
    } else {
      console.warn("SignalProcessingPipeline: Calibración no exitosa, no se aplicaron resultados.", results.recommendations);
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

    let factor = this.config.targetAmplitude / currentAmplitude;
    factor = Math.max(this.config.minAmplificationFactor, Math.min(this.config.maxAmplificationFactor, factor));
    return factor;
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;

    try {
      const fingerDetectionResult = this.humanFingerDetector.detectHumanFinger(imageData);

      if (this.isCalibrating) {
        const frameDataForCalibration = {
          redValue: fingerDetectionResult.rawValue,
          avgGreen: fingerDetectionResult.debugInfo.avgGreen,
          avgBlue: fingerDetectionResult.debugInfo.avgBlue,
          quality: fingerDetectionResult.quality,
          fingerDetected: fingerDetectionResult.isHumanFinger
        };
        const calibrationStatus = this.autoCalibrationSystem.processSample(frameDataForCalibration);

        if (this.onCalibrationUpdate) {
          this.onCalibrationUpdate(calibrationStatus);
        }

        if (this.onSignalReady) {
          const signalDuringCalibration: ExtendedProcessedSignal = {
            timestamp: fingerDetectionResult.timestamp,
            rawValue: fingerDetectionResult.rawValue,
            filteredValue: fingerDetectionResult.filteredValue,
            quality: fingerDetectionResult.quality,
            fingerDetected: fingerDetectionResult.isHumanFinger,
            roi: { x: 0, y: 0, width: imageData.width, height: imageData.height }, // Placeholder, ajustar si se usa ROI específico aquí
            perfusionIndex: fingerDetectionResult.confidence,
            calibrationPhase: calibrationStatus.phase,
            calibrationProgress: calibrationStatus.progress,
            calibrationInstructions: calibrationStatus.instructions
          };
          this.onSignalReady(signalDuringCalibration);
        }

        if (calibrationStatus.isComplete) {
          const calResults = this.autoCalibrationSystem.getCalibrationResults();
          this.endCalibrationMode(calResults);
          // No retornar inmediatamente, la señal de este frame ya fue emitida.
          // La próxima llamada a processFrame no entrará en isCalibrating.
        } else {
          return; // Si la calibración está en curso y no completa, no hacer más procesamiento PPG.
        }
      }

      // Flujo normal: No se está calibrando activamente o la calibración acaba de completarse en este ciclo.
      const overallCalibrationResults = this.autoCalibrationSystem.getCalibrationResults();

      if (!overallCalibrationResults.success) {
        if (this.onError) {
          this.onError({
            code: 'CALIBRATION_FAILED_OVERALL',
            message: 'Calibración no exitosa. Cubra la cámara con el dedo para calibrar.',
            timestamp: Date.now()
          });
        }
        if (this.onSignalReady) {
          const signalNoPpg: ExtendedProcessedSignal = {
            timestamp: fingerDetectionResult.timestamp,
            rawValue: fingerDetectionResult.rawValue,
            filteredValue: fingerDetectionResult.filteredValue,
            quality: fingerDetectionResult.quality,
            fingerDetected: fingerDetectionResult.isHumanFinger,
            roi: { x: imageData.width / 4, y: imageData.height / 4, width: imageData.width / 2, height: imageData.height / 2 }, // ROI General
            perfusionIndex: fingerDetectionResult.confidence,
            calibrationPhase: 'pending_successful_calibration',
            calibrationProgress: 0,
            calibrationInstructions: 'Calibración requerida para medición.'
          };
          this.onSignalReady(signalNoPpg);
        }
        return; // No procesar PPG si la calibración general no es exitosa
      }

      // Calibración general exitosa, proceder a evaluar detección para procesar PPG.
      if (fingerDetectionResult.isHumanFinger && fingerDetectionResult.quality > 30) {
        const ppgResults = this.processPPGSignal(fingerDetectionResult.rawValue, fingerDetectionResult.quality);
        const outputSignal: ExtendedProcessedSignal = {
          timestamp: fingerDetectionResult.timestamp,
          rawValue: fingerDetectionResult.rawValue,
          filteredValue: ppgResults.amplifiedValue,
          quality: fingerDetectionResult.quality,
          fingerDetected: true,
          roi: { x: imageData.width / 4, y: imageData.height / 4, width: imageData.width / 2, height: imageData.height / 2 }, // ROI General
          perfusionIndex: fingerDetectionResult.confidence,
        };
        this.lastProcessedSignal = outputSignal;
        if (this.onSignalReady) {
          this.onSignalReady(outputSignal);
        }
      } else {
        // Calibración exitosa, pero no hay dedo o la calidad es baja en este frame.
        if (this.onError) {
          this.onError({
            code: 'NO_FINGER_OR_LOW_QUALITY_POST_CALIBRATION',
            message: 'No se detectó dedo o calidad insuficiente (post-calibración).',
            timestamp: Date.now()
          });
        }
        if (this.onSignalReady) {
          const signalNoPpg: ExtendedProcessedSignal = {
            timestamp: fingerDetectionResult.timestamp,
            rawValue: fingerDetectionResult.rawValue,
            filteredValue: fingerDetectionResult.filteredValue,
            quality: fingerDetectionResult.quality,
            fingerDetected: fingerDetectionResult.isHumanFinger,
            roi: { x: imageData.width / 4, y: imageData.height / 4, width: imageData.width / 2, height: imageData.height / 2 }, // ROI General
            perfusionIndex: fingerDetectionResult.confidence,
          };
          this.onSignalReady(signalNoPpg);
        }
        this.resetFiltersAndBaseline();
      }
    } catch (error) {
      console.error("SignalProcessingPipeline: Error en processFrame", error);
      if (this.onError) {
        this.onError({
          code: 'PROCESS_FRAME_ERROR',
          message: error instanceof Error ? error.message : 'Error desconocido en processFrame',
          timestamp: Date.now()
        });
      }
      // Emitir un estado de dedo desconocido en caso de error catastrófico en el try
      if (this.onSignalReady) {
        const errorSignal: ExtendedProcessedSignal = {
            timestamp: Date.now(),
            rawValue: 0,
            filteredValue: 0,
            quality: 0,
            fingerDetected: false, // No se puede determinar
            roi: { x: 0, y:0, width: imageData.width, height: imageData.height},
            perfusionIndex: 0,
            calibrationPhase: 'error',
            calibrationProgress: 0,
            calibrationInstructions: 'Error en procesamiento.'
        };
        this.onSignalReady(errorSignal);
      }
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
    this.humanFingerDetector.reset();
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.signalHistoryForAmplification = [];
    this.baselineValue = 0;
    this.lastProcessedSignal = null;
    this.isCalibrating = false;
    this.autoCalibrationSystem.startCalibration();
    console.log("SignalProcessingPipeline: Componentes internos reseteados, calibración reiniciada.");
  }

  // Podríamos añadir un método para obtener el último valor procesado si es necesario externamente
  public getLastProcessedSignal(): ProcessedSignal | null {
    return this.lastProcessedSignal;
  }
} 