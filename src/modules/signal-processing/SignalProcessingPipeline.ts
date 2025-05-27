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

    // Si la calibración no fue exitosa, bloquear procesamiento
    if (!this.autoCalibrationSystem.getCalibrationResults().success) {
      if (this.onError) {
        this.onError({
          code: 'CALIBRATION_FAILED',
          message: 'La calibración no fue exitosa. No se puede procesar señal real.',
          timestamp: Date.now()
        });
      }
      return;
    }

    try {
      if (this.isCalibrating) {
        const frameDataForCalibration = {
          redValue: imageData.data[0], // Usar rawValue para calibración
          avgGreen: imageData.data[1],
          avgBlue: imageData.data[2],
          quality: 255, // Calidad estimada por el detector
          fingerDetected: false
        };
        const calibrationStatus = this.autoCalibrationSystem.processSample(frameDataForCalibration);
        
        if (this.onCalibrationUpdate) {
          this.onCalibrationUpdate(calibrationStatus);
        }

        if (calibrationStatus.isComplete) {
          const calResults = this.autoCalibrationSystem.getCalibrationResults();
          this.endCalibrationMode(calResults);
          // Después de calibrar, el siguiente frame se procesará normalmente
        }
        // Durante la calibración, podríamos no enviar señales PPG procesadas o enviar un estado especial
        if (this.onSignalReady) {
            const signalDuringCalibration: ExtendedProcessedSignal = {
                timestamp: Date.now(),
                rawValue: imageData.data[0],
                filteredValue: imageData.data[0], // O un valor indicando calibración
                quality: 255,
                fingerDetected: false,
                roi: { x: 0, y: 0, width: imageData.width, height: imageData.height }, // ROI temporal
                perfusionIndex: 0,
                calibrationPhase: calibrationStatus.phase,
                calibrationProgress: calibrationStatus.progress,
                calibrationInstructions: calibrationStatus.instructions
            };
            this.onSignalReady(signalDuringCalibration);
        }
        return; // No procesar señal PPG completa durante la calibración activa
      }

      const fingerDetectionResult = this.humanFingerDetector.detectHumanFinger(imageData);

      // Solo procesar si es dedo humano real y calidad suficiente
      if (fingerDetectionResult.isHumanFinger && fingerDetectionResult.quality > 30) {
        const ppgResults = this.processPPGSignal(fingerDetectionResult.rawValue, fingerDetectionResult.quality);
        const outputSignal: ProcessedSignal = {
          timestamp: fingerDetectionResult.timestamp,
          rawValue: fingerDetectionResult.rawValue,
          filteredValue: ppgResults.amplifiedValue,
          quality: fingerDetectionResult.quality,
          fingerDetected: true,
          roi: {
            x: imageData.width / 4,
            y: imageData.height / 4,
            width: imageData.width / 2,
            height: imageData.height / 2,
          },
          perfusionIndex: fingerDetectionResult.confidence,
        };
        this.lastProcessedSignal = outputSignal;
        if (this.onSignalReady) {
          this.onSignalReady(outputSignal as ExtendedProcessedSignal);
        }
      } else {
        // Si no hay dedo real o calidad insuficiente, reportar error y no emitir señal
        if (this.onError) {
          this.onError({
            code: 'NO_FINGER_OR_LOW_QUALITY',
            message: 'No se detectó dedo humano real o la calidad es insuficiente.',
            timestamp: Date.now()
          });
        }
        // Reset rápido de filtros para adaptarse a la reaparición de señal
        this.kalmanFilter.reset();
        this.sgFilter.reset();
        this.baselineValue = 0;
        this.signalHistoryForAmplification = [];
      }
    } catch (error) {
      if (this.onError) {
        this.onError({
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: Date.now()
        });
      }
    }
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