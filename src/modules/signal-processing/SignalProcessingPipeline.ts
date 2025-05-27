import { HumanFingerDetector, HumanFingerResult, HumanFingerDetectorConfig } from './HumanFingerDetector';
import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { AutoCalibrationSystem, CalibrationResult } from './AutoCalibrationSystem';
import { FrameData } from './types'; // Asumiendo que FrameData se define aquí o se importa
import { ProcessedSignal, ProcessingError } from '../../types/signal';
import { VitalSignsReferenceData } from '../vital-signs/VitalSignsProcessor'; // Importar el nuevo tipo

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
    this.onSignalReady = onSignalReady;
    this.onError = onError;
    this.onCalibrationUpdate = onCalibrationUpdate;

    console.log("SignalProcessingPipeline: Inicializado con configuración", this.config);
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

    let factor = this.config.targetAmplitude / currentAmplitude;
    factor = Math.max(this.config.minAmplificationFactor, Math.min(this.config.maxAmplificationFactor, factor));
    return factor;
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // fingerDetectionResult se define una vez al principio del try
      const fingerDetectionResult = this.humanFingerDetector.detectHumanFinger(imageData);

      if (this.isCalibrating) {
        // Lógica cuando SÍ está calibrando
        const frameDataForCalibration = {
          redValue: fingerDetectionResult.rawValue,
          avgGreen: fingerDetectionResult.debugInfo.avgGreen,
          avgBlue: fingerDetectionResult.debugInfo.avgBlue,
          quality: fingerDetectionResult.quality,
          fingerDetected: fingerDetectionResult.isHumanFinger
        };
        const currentAutoCalStatus = this.autoCalibrationSystem.processSample(frameDataForCalibration);

        if (this.onCalibrationUpdate) {
          this.onCalibrationUpdate({ ...currentAutoCalStatus, results: this.autoCalibrationSystem.getCalibrationResults() });
        }

        if (this.onSignalReady) {
          const signalDuringCalibration: ExtendedProcessedSignal = {
            timestamp: fingerDetectionResult.timestamp,
            rawValue: fingerDetectionResult.rawValue,
            filteredValue: fingerDetectionResult.filteredValue,
            quality: fingerDetectionResult.quality,
            fingerDetected: fingerDetectionResult.isHumanFinger,
            roi: { x: 0, y: 0, width: imageData.width, height: imageData.height },
            perfusionIndex: fingerDetectionResult.confidence,
            calibrationPhase: currentAutoCalStatus.phase,
            calibrationProgress: currentAutoCalStatus.progress,
            calibrationInstructions: currentAutoCalStatus.instructions,
            debugInfo: { ...fingerDetectionResult.debugInfo }
          };
          this.onSignalReady(signalDuringCalibration);
        }

        if (currentAutoCalStatus.isComplete) {
          console.log("SignalProcessingPipeline: AutoCalibrationSystem ha completado su proceso.");
          this.endCalibrationMode(); // Asumiendo que esto puede tomar referenceData si es necesario
        }
        
        return; // Salir después de procesar el frame de calibración

      } else {
        // Lógica cuando NO está calibrando
        if (fingerDetectionResult.isHumanFinger && fingerDetectionResult.quality > 30) {
          const { filteredValue, amplifiedValue } = this.processPPGSignal(fingerDetectionResult.rawValue, fingerDetectionResult.quality);
          const ppgSignal: ProcessedSignal = {
            timestamp: fingerDetectionResult.timestamp,
            rawValue: fingerDetectionResult.rawValue,
            filteredValue: amplifiedValue,
            quality: fingerDetectionResult.quality,
            fingerDetected: true,
            roi: { x: 0, y: 0, width: imageData.width, height: imageData.height },
            perfusionIndex: fingerDetectionResult.confidence,
            debugInfo: fingerDetectionResult.debugInfo
          };
          this.lastProcessedSignal = ppgSignal;
          if (this.onSignalReady) {
            this.onSignalReady(ppgSignal);
          }
        } else {
          // Dedo no detectado o calidad insuficiente (no calibrando)
          const noFingerSignal: ExtendedProcessedSignal = {
            timestamp: Date.now(),
            rawValue: fingerDetectionResult.rawValue,
            filteredValue: fingerDetectionResult.rawValue,
            quality: fingerDetectionResult.quality,
            fingerDetected: fingerDetectionResult.isHumanFinger,
            roi: { x: 0, y: 0, width: imageData.width, height: imageData.height },
            debugInfo: fingerDetectionResult.debugInfo
          };
          if (this.onSignalReady) {
            this.onSignalReady(noFingerSignal);
          }
          if (this.onError) {
            if (!fingerDetectionResult.isHumanFinger) {
              this.onError({
                code: "NO_FINGER_DETECTED_NORMAL_MODE",
                message: "No se detecta el dedo.",
                timestamp: Date.now(),
              });
            } else if (fingerDetectionResult.quality <= 30) {
              this.onError({
                code: "POOR_SIGNAL_QUALITY_NORMAL_MODE",
                message: "Calidad de señal insuficiente.",
                timestamp: Date.now(),
              });
            }
          }
        }
      }
    } catch (error: any) {
      console.error("SignalProcessingPipeline: Error en processFrame:", error);
      if (this.onError) {
        this.onError({
          code: "PROCESS_FRAME_ERROR",
          message: error.message || "Error desconocido en procesamiento de frame.",
          timestamp: Date.now(),
        });
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