import { HumanFingerDetector, HumanFingerResult } from './HumanFingerDetector';
import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
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
  minRedReflectance: 20,
  maxRedReflectance: 250,
  minRGRatio: 0.8,
  maxRGRatio: 3.0,
  kalmanR: 0.01,
  kalmanQ: 0.1,
  sgWindowSize: 9,
  historySize: 100,
  targetAmplitude: 50,
  minAmplificationFactor: 5,
  maxAmplificationFactor: 40,
};

export class SignalProcessingPipeline {
  private config: SignalPipelineConfig;
  private humanFingerDetector: HumanFingerDetector;
  private kalmanFilter: OptimizedKalmanFilter;
  private sgFilter: SavitzkyGolayFilter;

  private signalHistoryForAmplification: number[] = []; // Historial para amplificación dinámica
  private baselineValue: number = 0;
  private lastProcessedSignal: ProcessedSignal | null = null;

  public onSignalReady?: (signal: ProcessedSignal) => void;
  public onError?: (error: ProcessingError) => void;
  public isProcessing: boolean = false;


  constructor(
    config: Partial<SignalPipelineConfig> = {},
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
    ) {
    this.config = { ...defaultConfig, ...config };
    this.humanFingerDetector = new HumanFingerDetector(); // Usará sus propios defaults o se pueden pasar configs
    this.kalmanFilter = new OptimizedKalmanFilter(this.config.kalmanR, this.config.kalmanQ);
    this.sgFilter = new SavitzkyGolayFilter(this.config.sgWindowSize);
    this.onSignalReady = onSignalReady;
    this.onError = onError;

    console.log("SignalProcessingPipeline: Inicializado con configuración", this.config);
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
        this.onSignalReady(outputSignal);
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
    // No reseteamos aquí para permitir que los últimos valores puedan ser consultados si es necesario
    console.log("SignalProcessingPipeline: Detenido");
  }

  public reset(): void {
    this.humanFingerDetector.reset();
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.signalHistoryForAmplification = [];
    this.baselineValue = 0;
    this.lastProcessedSignal = null;
    console.log("SignalProcessingPipeline: Componentes internos reseteados");
  }

  // Podríamos añadir un método para obtener el último valor procesado si es necesario externamente
  public getLastProcessedSignal(): ProcessedSignal | null {
    return this.lastProcessedSignal;
  }
} 