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

    // TEMPORALMENTE DESACTIVAR AUTOCALIBRACION PARA DIAGNOSTICO
    this.isCalibrating = false;
    this.autoCalibrationSystem = new AutoCalibrationSystem(); // Mantener la instancia pero no iniciarla activamente al principio
    this.isProcessing = false; // Asegurarse de que no inicie procesamiento de frames hasta start() se llame explícitamente

    console.log("SignalProcessingPipeline: Inicializado. AUTOCALIBRACION TEMPORALMENTE DESACTIVADA.", this.config);
  }

  public startCalibrationMode(): void {
    // TEMPORALMENTE DESACTIVAR startCalibrationMode REAL
    console.log("SignalProcessingPipeline: startCalibrationMode TEMPORALMENTE DESACTIVADO.");
    this.isCalibrating = false; // Asegurar que no entre en modo calibración
    this.isProcessing = true; // Simular que estamos listos para procesar frames (medición)
    this.reset(); // Resetear procesadores pero no iniciar calibración
    if (this.onCalibrationUpdate) {
       this.onCalibrationUpdate({ phase: 'skipped', progress: 100, instructions: 'Calibración saltada por diagnostico.', isComplete: true });
    }
  }

  public endCalibrationMode(calibrationResults?: any): void {
    // TEMPORALMENTE DESACTIVAR endCalibrationMode REAL
    console.log("SignalProcessingPipeline: endCalibrationMode TEMPORALMENTE DESACTIVADO.");
    this.isCalibrating = false; // Asegurar que no entre en modo calibración
  }

  public applyCalibrationResults(results: any): void {
    // TEMPORALMENTE DESACTIVAR applyCalibrationResults REAL
    console.log("SignalProcessingPipeline: applyCalibrationResults TEMPORALMENTE DESACTIVADO.");
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
      // Ahora, en este modo temporal, siempre procesamos como si no estuviéramos calibrando
      {
        // 1. Detección de dedo humano
        const fingerDetectionResult = this.humanFingerDetector.detectHumanFinger(imageData);

        // 2. Extraer datos de color promediados (para SpO2, Hemoglobina, etc.)
        let avgColorData = { red: 0, green: 0, blue: 0 };
        let rawRedValue = imageData.data[0]; // Default a primer pixel si no hay ROI

        if (fingerDetectionResult.isHumanFinger && fingerDetectionResult.roi) {
            const roi = fingerDetectionResult.roi;
            let sumRed = 0;
            let sumGreen = 0;
            let sumBlue = 0;
            let pixelCount = 0;

            // Iterar sobre los píxeles dentro de la ROI
            // Asumimos que imageData.data es un Uint8ClampedArray en formato RGBA
            for (let y = roi.y; y < roi.y + roi.height; y++) {
                for (let x = roi.x; x < roi.x + roi.width; x++) {
                    const index = (y * imageData.width + x) * 4;
                    sumRed += imageData.data[index];
                    sumGreen += imageData.data[index + 1];
                    sumBlue += imageData.data[index + 2];
                    pixelCount++;
                }
            }

            if (pixelCount > 0) {
                avgColorData = {
                    red: sumRed / pixelCount,
                    green: sumGreen / pixelCount,
                    blue: sumBlue / pixelCount,
                };
                rawRedValue = avgColorData.red; // Usar promedio de rojo de la ROI
            }
        }

        // 3. Si se detecta un dedo y la calidad es aceptable, procesar la señal PPG
        // Usar la calidad reportada por HumanFingerDetector
        const signalQuality = fingerDetectionResult.quality;
        const isFingerDetected = fingerDetectionResult.isHumanFinger && signalQuality > 0; // Considerar calidad para 'detectado'

        let processedSignal: ProcessedSignal | null = null;

        if (isFingerDetected) {
            // Usar rawRedValue (promedio de la ROI) como la señal principal para el pipeline
            const ppgProcessingResult = this.processPPGSignal(rawRedValue, signalQuality); // Pasar calidad aquí si es útil

            processedSignal = {
                timestamp: Date.now(),
                rawValue: rawRedValue, // Valor rojo promedio de la ROI
                filteredValue: ppgProcessingResult.filteredValue,
                quality: signalQuality, // Calidad del detector de dedo
                fingerDetected: true,
                roi: fingerDetectionResult.roi || { x: 0, y: 0, width: 0, height: 0 }, // Asegurar que siempre hay un objeto ROI
                perfusionIndex: fingerDetectionResult.debugInfo?.redDominanceScore, // Usar una métrica de perfusión del detector
                colorData: avgColorData, // Incluir los datos de color promediados
            };

            // Opcional: Incluir información de calibración si está disponible (aunque se finaliza antes)
            // if (this.autoCalibrationSystem.isCalibrating()) {
            //     const calStatus = this.autoCalibrationSystem.getCurrentStatus(); // Asumiendo que existe un método getStatus
            //     (processedSignal as ExtendedProcessedSignal).calibrationPhase = calStatus.phase;
            //     (processedSignal as ExtendedProcessedSignal).calibrationProgress = calStatus.progress;
            //     (processedSignal as ExtendedProcessedSignal).calibrationInstructions = calStatus.instructions;
            // }

        } else {
             // Si no se detecta un dedo o la calidad es muy baja, emitir señal con calidad 0
             // Esto es importante para resetear o indicar al siguiente paso que no hay datos fiables
             processedSignal = {
                timestamp: Date.now(),
                rawValue: rawRedValue, // Último valor rojo, aunque no haya dedo
                filteredValue: 0, // O el último valor filtrado si se quiere mantener continuidad visual
                quality: 0, // Calidad cero
                fingerDetected: false,
                roi: { x: 0, y: 0, width: 0, height: 0 },
                perfusionIndex: 0,
                colorData: avgColorData, // Incluir los últimos datos de color si están disponibles
             };
             this.processPPGSignal(rawRedValue, signalQuality); // Procesar de todas formas para mantener buffers actualizados si es necesario
        }

        // 4. Emitir la señal procesada
        if (this.onSignalReady && processedSignal) {
          this.onSignalReady(processedSignal as ExtendedProcessedSignal); // Castear para incluir campos extendidos si se añaden
        }

        // 5. Manejar errores si es necesario (ej: si fingerDetectionResult indica un error crítico)
        if (fingerDetectionResult.debugInfo?.rejectionReasons && fingerDetectionResult.debugInfo.rejectionReasons.length > 0) {
            console.warn("SignalProcessingPipeline: Dedo no detectado o rechazado. Razones:", fingerDetectionResult.debugInfo.rejectionReasons);
            // Opcional: Emitir un error si la detección falla consistentemente por mucho tiempo
            // if (this.onError) {
            //     this.onError({ code: 'FINGER_NOT_DETECTED', message: 'Dedo no detectado o calidad insuficiente', timestamp: Date.now() });
            // }
        }
      }
    } catch (error: any) {
      console.error("SignalProcessingPipeline: Error procesando frame:", error);
      if (this.onError) {
        this.onError({ code: 'PROCESSING_ERROR', message: error.message || 'Unknown processing error', timestamp: Date.now() });
      }
      // Continuar procesando si es un error recuperable, detener si es crítico.
      // this.stop(); // Descomentar si el error debe detener el pipeline
    }
  }
  
  public start(): void {
    this.isProcessing = true;
    this.reset(); // Asegurar estado limpio al iniciar
    // Con calibracion desactivada, reset no inicia calibracion
    console.log("SignalProcessingPipeline: Iniciado y reseteado (Autocalibracion desactivada)");
  }

  public stop(): void {
    this.isProcessing = false;
    // this.isCalibrating = false; // No modificar estado de calibración temporal
    console.log("SignalProcessingPipeline: Detenido");
  }

  public reset(): void {
    this.humanFingerDetector.reset();
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.signalHistoryForAmplification = [];
    this.baselineValue = 0;
    this.lastProcessedSignal = null;
    // TEMPORALMENTE: No resetear estado de calibración aquí ni iniciarla
    // this.isCalibrating = false;
    // this.autoCalibrationSystem.startCalibration();
    console.log("SignalProcessingPipeline: Componentes internos reseteados (Autocalibracion desactivada)");
  }

  // Podríamos añadir un método para obtener el último valor procesado si es necesario externamente
  public getLastProcessedSignal(): ProcessedSignal | null {
    return this.lastProcessedSignal;
  }
} 