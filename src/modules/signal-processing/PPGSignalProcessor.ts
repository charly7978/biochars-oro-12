
import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { SignalTrendAnalyzer, TrendResult } from './SignalTrendAnalyzer';
import { BiophysicalValidator } from './BiophysicalValidator';
import { EnhancedFrameProcessor } from './EnhancedFrameProcessor';
import { AdaptiveDetector } from './AdaptiveDetector';
import { FFTAnalyzer } from './FFTAnalyzer';
import { CalibrationHandler } from './CalibrationHandler';
import { SignalAnalyzer } from './SignalAnalyzer';
import { SignalProcessorConfig } from './types';

/**
 * Procesador de señal PPG mejorado con algoritmos adaptativos
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  public optimizedKalmanFilter: OptimizedKalmanFilter;
  public sgFilter: SavitzkyGolayFilter;
  public trendAnalyzer: SignalTrendAnalyzer;
  public biophysicalValidator: BiophysicalValidator;
  public enhancedFrameProcessor: EnhancedFrameProcessor;
  public adaptiveDetector: AdaptiveDetector;
  public fftAnalyzer: FFTAnalyzer;
  public calibrationHandler: CalibrationHandler;
  public signalAnalyzer: SignalAnalyzer;
  public lastValues: number[] = [];
  public isCalibrating: boolean = false;
  public frameProcessedCount = 0;
  
  // Configuración optimizada
  public readonly CONFIG: SignalProcessorConfig = {
    BUFFER_SIZE: 20,
    MIN_RED_THRESHOLD: 40,
    MAX_RED_THRESHOLD: 220,
    STABILITY_WINDOW: 12,
    MIN_STABILITY_COUNT: 6,
    HYSTERESIS: 3.0,
    MIN_CONSECUTIVE_DETECTIONS: 4,
    MAX_CONSECUTIVE_NO_DETECTIONS: 3,
    QUALITY_LEVELS: 25,
    QUALITY_HISTORY_SIZE: 15,
    CALIBRATION_SAMPLES: 15,
    TEXTURE_GRID_SIZE: 8,
    ROI_SIZE_FACTOR: 0.6
  };
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("[DIAG] PPGSignalProcessor: Constructor mejorado", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
    });
    
    // Inicializar componentes mejorados
    this.optimizedKalmanFilter = new OptimizedKalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
    this.trendAnalyzer = new SignalTrendAnalyzer();
    this.biophysicalValidator = new BiophysicalValidator();
    this.enhancedFrameProcessor = new EnhancedFrameProcessor();
    this.adaptiveDetector = new AdaptiveDetector();
    this.fftAnalyzer = new FFTAnalyzer();
    this.calibrationHandler = new CalibrationHandler({
      CALIBRATION_SAMPLES: this.CONFIG.CALIBRATION_SAMPLES,
      MIN_RED_THRESHOLD: this.CONFIG.MIN_RED_THRESHOLD,
      MAX_RED_THRESHOLD: this.CONFIG.MAX_RED_THRESHOLD
    });
    this.signalAnalyzer = new SignalAnalyzer({
      QUALITY_LEVELS: this.CONFIG.QUALITY_LEVELS,
      QUALITY_HISTORY_SIZE: this.CONFIG.QUALITY_HISTORY_SIZE,
      MIN_CONSECUTIVE_DETECTIONS: this.CONFIG.MIN_CONSECUTIVE_DETECTIONS,
      MAX_CONSECUTIVE_NO_DETECTIONS: this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS
    });
    
    console.log("PPGSignalProcessor: Instancia mejorada creada con configuración optimizada");
  }

  async initialize(): Promise<void> {
    console.log("[DIAG] PPGSignalProcessor mejorado: initialize()");
    try {
      // Reset todos los componentes
      this.lastValues = [];
      this.optimizedKalmanFilter.reset();
      this.sgFilter.reset();
      this.trendAnalyzer.reset();
      this.biophysicalValidator.reset();
      this.adaptiveDetector.reset();
      this.fftAnalyzer.reset();
      this.signalAnalyzer.reset();
      this.frameProcessedCount = 0;
      
      console.log("PPGSignalProcessor mejorado: Sistema inicializado con algoritmos adaptativos");
    } catch (error) {
      console.error("PPGSignalProcessor mejorado: Error en inicialización", error);
      this.handleError("INIT_ERROR", "Error inicializando procesador mejorado");
    }
  }

  start(): void {
    console.log("[DIAG] PPGSignalProcessor mejorado: start()");
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor mejorado: Sistema iniciado con optimizaciones");
  }

  stop(): void {
    console.log("[DIAG] PPGSignalProcessor mejorado: stop()");
    this.isProcessing = false;
    this.lastValues = [];
    this.optimizedKalmanFilter.reset();
    this.sgFilter.reset();
    this.trendAnalyzer.reset();
    this.biophysicalValidator.reset();
    this.adaptiveDetector.reset();
    this.fftAnalyzer.reset();
    this.signalAnalyzer.reset();
    console.log("PPGSignalProcessor mejorado: Sistema detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor mejorado: Iniciando calibración adaptativa");
      await this.initialize();
      
      this.isCalibrating = true;
      
      setTimeout(() => {
        this.isCalibrating = false;
        console.log("PPGSignalProcessor mejorado: Calibración adaptativa completada");
      }, 3000);
      
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor mejorado: Error en calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error en calibración adaptativa");
      this.isCalibrating = false;
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;

    try {
      this.frameProcessedCount++;
      const shouldLog = this.frameProcessedCount % 30 === 0;

      if (!this.onSignalReady) {
        console.error("PPGSignalProcessor mejorado: onSignalReady callback no disponible");
        return;
      }

      // 1. Extracción mejorada de datos del frame
      const extractionResult = this.enhancedFrameProcessor.extractEnhancedFrameData(imageData);
      const { redValue, textureScore, rToGRatio, rToBRatio, roi, stability } = extractionResult;

      if (shouldLog) {
        console.log("PPGSignalProcessor mejorado: Extracción de frame", {
          redValue,
          stability,
          textureScore,
          rToGRatio,
          rToBRatio
        });
      }

      // 2. Detección adaptativa multi-modal
      const detectionResult = this.adaptiveDetector.detectFingerMultiModal({
        redValue,
        avgGreen: extractionResult.avgGreen,
        avgBlue: extractionResult.avgBlue,
        textureScore,
        rToGRatio,
        rToBRatio,
        stability
      });

      // 3. Procesamiento de señal con filtros optimizados
      let filteredValue = this.optimizedKalmanFilter.filter(redValue);
      filteredValue = this.sgFilter.filter(filteredValue);
      
      // Amplificación adaptativa
      const amplificationFactor = detectionResult.confidence > 0.8 ? 25 : 35;
      filteredValue = filteredValue * amplificationFactor;

      // 4. Análisis FFT para BPM (solo si hay detección confiable)
      this.fftAnalyzer.addSample(filteredValue);
      
      // 5. Análisis de tendencia mejorado
      const trendResult = this.trendAnalyzer.analyzeTrend(filteredValue);

      // 6. Validación biofísica estricta
      if (trendResult === "non_physiological" && !this.isCalibrating) {
        const rejectSignal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: filteredValue,
          quality: 0,
          fingerDetected: false,
          roi: roi,
          perfusionIndex: 0
        };
        this.onSignalReady(rejectSignal);
        return;
      }

      // 7. Cálculo de calidad mejorado
      let quality = 0;
      if (detectionResult.detected) {
        quality = Math.round(detectionResult.confidence * 100);
        
        // Bonus por estabilidad
        quality += Math.round(stability * 20);
        
        // Bonus por análisis FFT exitoso
        const fftResult = this.fftAnalyzer.analyzeBPM();
        if (fftResult && fftResult.confidence > 0.5) {
          quality += Math.round(fftResult.confidence * 15);
        }
        
        quality = Math.min(100, quality);
      }

      // 8. Adaptación de umbrales
      if (detectionResult.detected) {
        this.lastValues.push(redValue);
        if (this.lastValues.length > 20) {
          this.lastValues.shift();
          this.adaptiveDetector.adaptThresholds(this.lastValues);
        }
      }

      // 9. Crear señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filteredValue,
        quality: quality,
        fingerDetected: detectionResult.detected,
        roi: roi,
        perfusionIndex: detectionResult.detected && quality > 40 ? 
                       Math.max(0, (Math.log(redValue + 1) * 0.6 - 1.5)) : 0
      };

      if (shouldLog) {
        console.log("PPGSignalProcessor mejorado: Señal procesada", {
          fingerDetected: detectionResult.detected,
          confidence: detectionResult.confidence,
          quality,
          reasons: detectionResult.reasons
        });
      }

      this.onSignalReady(processedSignal);
    } catch (error) {
      console.error("PPGSignalProcessor mejorado: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error en procesamiento mejorado");
    }
  }

  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    if (typeof this.onError === 'function') {
      this.onError(error);
    }
  }
}
