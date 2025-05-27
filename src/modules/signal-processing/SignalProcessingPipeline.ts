import { HumanFingerDetector, HumanFingerResult } from './HumanFingerDetector';
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
    this.humanFingerDetector = new HumanFingerDetector(); // Usará sus propios defaults o se pueden pasar configs
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
      // Forzar una actualización inicial para la UI
      const initialStatus = { phase: this.autoCalibrationSystem.getCurrentPhase ? this.autoCalibrationSystem.getCurrentPhase() : 'baseline', progress: 0, instructions: 'Iniciando calibración...', isComplete: false };
      this.onCalibrationUpdate(initialStatus);
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

  private applyCalibrationResults(results: any /* Debería ser un tipo más específico */): void {
    console.log("SignalProcessingPipeline: Aplicando resultados de calibración", results);
    if (results.success) {
      if (results.thresholds) {
        // TODO: HumanFingerDetector necesita métodos para setear umbrales o ser reinstanciado con nueva config.
        // Ejemplo conceptual:
        // this.humanFingerDetector.configure({ 
        //   RED_REFLECTANCE_MIN: results.thresholds.min, 
        //   RED_REFLECTANCE_MAX: results.thresholds.max 
        // });
        console.warn("SignalProcessingPipeline: Aplicación de `results.thresholds` a HumanFingerDetector pendiente.");
      }
      if (results.signalParams && results.signalParams.gain) {
        // Ejemplo conceptual:
        // this.config.minAmplificationFactor = Math.max(1, this.config.minAmplificationFactor * results.signalParams.gain * 0.8);
        // this.config.maxAmplificationFactor = Math.min(50, this.config.maxAmplificationFactor * results.signalParams.gain * 1.2);
        console.warn("SignalProcessingPipeline: Aplicación de `results.signalParams` a la configuración del pipeline pendiente.");
      }
       console.log("SignalProcessingPipeline: Resultados de calibración aplicados (conceptualmente).");
    } else {
      console.warn("SignalProcessingPipeline: Calibración no exitosa, no se aplicaron resultados.", results.recommendations);
    }
  }

  /**
   * Lógica de procesamiento de señal PPG inspirada en SignalProcessingCore.
   * Esta función se llamaría DESPUÉS de que HumanFingerDetector confirme un dedo.
   */
  private processPPGSignal(rawValue: number, currentQuality: number): { filteredValue: number, amplifiedValue: number } {
    // Establecer baseline inicial
    if (this.baselineValue === 0) {
      this.baselineValue = rawValue;
    } else {
      // Adaptación lenta del baseline
      this.baselineValue = this.baselineValue * 0.98 + rawValue * 0.01;
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
      return this.config.minAmplificationFactor; // Factor de amplificación inicial/por defecto
    }
    const recentProcessedSignal = this.signalHistoryForAmplification.slice(-20);
    const minVal = Math.min(...recentProcessedSignal);
    const maxVal = Math.max(...recentProcessedSignal);
    const currentAmplitude = maxVal - minVal;

    if (currentAmplitude < 1e-6) return this.config.maxAmplificationFactor;

    let factor = this.config.targetAmplitude / currentAmplitude;
    factor = Math.max(this.config.minAmplificationFactor, Math.min(this.config.maxAmplificationFactor, factor));
    return factor;
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;

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

      let finalFilteredValue = fingerDetectionResult.rawValue;
      let finalAmplifiedValue = fingerDetectionResult.rawValue; // Valor por defecto si no hay dedo
      let finalQuality = fingerDetectionResult.quality;

      if (fingerDetectionResult.isHumanFinger && fingerDetectionResult.quality > 20) { // Umbral de calidad para procesar
        const ppgResults = this.processPPGSignal(fingerDetectionResult.rawValue, fingerDetectionResult.quality);
        finalFilteredValue = ppgResults.filteredValue;
        finalAmplifiedValue = ppgResults.amplifiedValue;
      } else {
        // Si no hay dedo o la calidad es muy baja, reseteamos parcialmente los filtros para que se adapten rápido al reaparecer la señal
        this.kalmanFilter.reset(); // Resetea P y X, pero mantiene R y Q configurados
        this.sgFilter.reset();
        this.baselineValue = 0; // Permitir que el baseline se reestablezca rápidamente
        this.signalHistoryForAmplification = []; // Limpiar historial para recalculación de amplificación
      }
      
      const outputSignal: ProcessedSignal = {
        timestamp: fingerDetectionResult.timestamp,
        rawValue: fingerDetectionResult.rawValue,
        filteredValue: finalFilteredValue, 
        quality: finalQuality,
        fingerDetected: fingerDetectionResult.isHumanFinger,
        roi: { // ROI Fijo por ahora, se puede mejorar
          x: imageData.width / 4,
          y: imageData.height / 4,
          width: imageData.width / 2,
          height: imageData.height / 2,
        },
        perfusionIndex: fingerDetectionResult.confidence, // Usar confianza como un proxy de PI
      };
      
      this.lastProcessedSignal = outputSignal; // Guardar la última señal procesada

      if (this.onSignalReady) {
        this.onSignalReady(outputSignal as ExtendedProcessedSignal);
      }

    } catch (error) {
      console.error("SignalProcessingPipeline: Error procesando frame:", error);
      if (this.onError) {
        this.onError({
          code: 'PIPELINE_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Error desconocido en pipeline',
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