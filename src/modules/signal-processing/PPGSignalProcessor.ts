import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { SignalTrendAnalyzer, TrendResult } from './SignalTrendAnalyzer';
import { BiophysicalValidator } from './BiophysicalValidator';
import { EnhancedFrameProcessor } from './EnhancedFrameProcessor';
import { AdaptiveDetector } from './AdaptiveDetector';
import { MedicalFFTAnalyzer } from './MedicalFFTAnalyzer';
import { PerformanceManager } from './PerformanceManager';
import { AutoCalibrationSystem } from './AutoCalibrationSystem';
import { CalibrationHandler } from './CalibrationHandler';
import { SignalAnalyzer } from './SignalAnalyzer';
import { SignalProcessorConfig } from './types';

/**
 * Procesador de señal PPG con mejoras médicas y optimización de rendimiento
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  public optimizedKalmanFilter: OptimizedKalmanFilter;
  public sgFilter: SavitzkyGolayFilter;
  public trendAnalyzer: SignalTrendAnalyzer;
  public biophysicalValidator: BiophysicalValidator;
  public enhancedFrameProcessor: EnhancedFrameProcessor;
  public adaptiveDetector: AdaptiveDetector;
  public medicalFFTAnalyzer: MedicalFFTAnalyzer;
  public performanceManager: PerformanceManager;
  public autoCalibrationSystem: AutoCalibrationSystem;
  public calibrationHandler: CalibrationHandler;
  public signalAnalyzer: SignalAnalyzer;
  public lastValues: number[] = [];
  public isCalibrating: boolean = false;
  public frameProcessedCount = 0;
  
  // Configuración optimizada para rendimiento médico
  public readonly CONFIG: SignalProcessorConfig = {
    BUFFER_SIZE: 10, // Reducido para respuesta más rápida
    MIN_RED_THRESHOLD: 20, // Más sensible
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 2,
    HYSTERESIS: 1.5,
    MIN_CONSECUTIVE_DETECTIONS: 1, // Detección inmediata
    MAX_CONSECUTIVE_NO_DETECTIONS: 8,
    QUALITY_LEVELS: 25,
    QUALITY_HISTORY_SIZE: 8,
    CALIBRATION_SAMPLES: 8,
    TEXTURE_GRID_SIZE: 8,
    ROI_SIZE_FACTOR: 0.6
  };
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("[DIAG] PPGSignalProcessor: Constructor médico mejorado", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
    });
    
    // Inicializar componentes médicos mejorados
    this.optimizedKalmanFilter = new OptimizedKalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
    this.trendAnalyzer = new SignalTrendAnalyzer();
    this.biophysicalValidator = new BiophysicalValidator();
    this.enhancedFrameProcessor = new EnhancedFrameProcessor();
    this.adaptiveDetector = new AdaptiveDetector();
    this.medicalFFTAnalyzer = new MedicalFFTAnalyzer();
    this.performanceManager = new PerformanceManager();
    this.autoCalibrationSystem = new AutoCalibrationSystem();
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
    
    console.log("PPGSignalProcessor: Instancia médica creada con optimizaciones de rendimiento");
  }

  async initialize(): Promise<void> {
    console.log("[DIAG] PPGSignalProcessor médico: initialize()");
    try {
      // Reset todos los componentes
      this.lastValues = [];
      this.optimizedKalmanFilter.reset();
      this.sgFilter.reset();
      this.trendAnalyzer.reset();
      this.biophysicalValidator.reset();
      this.adaptiveDetector.reset();
      this.medicalFFTAnalyzer.reset();
      this.performanceManager.reset();
      this.signalAnalyzer.reset();
      this.frameProcessedCount = 0;
      
      console.log("PPGSignalProcessor médico: Sistema inicializado con algoritmos médicos");
    } catch (error) {
      console.error("PPGSignalProcessor médico: Error en inicialización", error);
      this.handleError("INIT_ERROR", "Error inicializando procesador médico");
    }
  }

  start(): void {
    console.log("[DIAG] PPGSignalProcessor médico: start()");
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor médico: Sistema iniciado con optimizaciones médicas");
  }

  stop(): void {
    console.log("[DIAG] PPGSignalProcessor médico: stop()");
    this.isProcessing = false;
    this.lastValues = [];
    this.optimizedKalmanFilter.reset();
    this.sgFilter.reset();
    this.trendAnalyzer.reset();
    this.biophysicalValidator.reset();
    this.adaptiveDetector.reset();
    this.medicalFFTAnalyzer.reset();
    this.performanceManager.reset();
    this.signalAnalyzer.reset();
    console.log("PPGSignalProcessor médico: Sistema detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor médico: Iniciando calibración automática médica");
      await this.initialize();
      
      this.isCalibrating = true;
      this.autoCalibrationSystem.startCalibration();
      
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor médico: Error en calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error en calibración automática médica");
      this.isCalibrating = false;
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;

    try {
      // Gestión de rendimiento
      this.performanceManager.startFrame();
      
      // Verificar si debe procesar este frame
      if (!this.performanceManager.shouldProcessFrame()) {
        this.performanceManager.endFrame();
        return;
      }

      this.frameProcessedCount++;
      const shouldLog = this.frameProcessedCount % 30 === 0; // Log cada segundo aprox

      if (!this.onSignalReady) {
        console.error("PPGSignalProcessor médico: onSignalReady callback no disponible");
        return;
      }

      // 1. Extracción mejorada de datos del frame
      const extractionResult = this.enhancedFrameProcessor.extractEnhancedFrameData(imageData);
      const { redValue, textureScore, rToGRatio, rToBRatio, roi, stability } = extractionResult;

      // 2. Calibración automática si está activa
      if (this.autoCalibrationSystem.isCalibrating()) {
        const calibrationResult = this.autoCalibrationSystem.processSample({
          redValue,
          avgGreen: extractionResult.avgGreen,
          avgBlue: extractionResult.avgBlue,
          quality: 0, // Se calculará después
          fingerDetected: false // Se determinará después
        });
        
        if (calibrationResult.isComplete) {
          this.isCalibrating = false;
          console.log("Calibración automática completada:", calibrationResult.results);
        }
      }

      // 3. Detección adaptativa multi-modal con umbrales más sensibles
      const detectionResult = this.adaptiveDetector.detectFingerMultiModal({
        redValue,
        avgGreen: extractionResult.avgGreen,
        avgBlue: extractionResult.avgBlue,
        textureScore,
        rToGRatio,
        rToBRatio,
        stability
      });

      if (shouldLog || detectionResult.detected) {
        console.log("PPGSignalProcessor médico: Resultado de detección", {
          detected: detectionResult.detected,
          confidence: detectionResult.confidence,
          reasons: detectionResult.reasons,
          redValue
        });
      }

      // 4. Procesamiento de señal con filtros optimizados
      const performanceConfig = this.performanceManager.getProcessingConfig();
      let filteredValue = redValue;
      
      if (performanceConfig.enabledFeatures.kalmanFilter) {
        filteredValue = this.optimizedKalmanFilter.filter(filteredValue);
      }
      
      if (performanceConfig.filterComplexity !== 'simple') {
        filteredValue = this.sgFilter.filter(filteredValue);
      }
      
      // Amplificación adaptativa
      const amplificationFactor = detectionResult.confidence > 0.7 ? 15 : 25;
      filteredValue = filteredValue * amplificationFactor;

      // 5. Análisis FFT médico (solo si el rendimiento lo permite)
      if (performanceConfig.enabledFeatures.fftAnalysis) {
        this.medicalFFTAnalyzer.addSample(filteredValue);
      }
      
      // 6. Análisis de tendencia
      const trendResult = this.trendAnalyzer.analyzeTrend(filteredValue);

      // 7. Validación biofísica más permisiva durante calibración
      if (trendResult === "non_physiological" && !this.isCalibrating && this.frameProcessedCount > 50) {
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
        this.performanceManager.endFrame();
        return;
      }

      // 8. Cálculo de calidad médico mejorado
      let quality = 0;
      if (detectionResult.detected) {
        quality = Math.round(detectionResult.confidence * 85); // Base médica más alta
        
        // Bonus por estabilidad
        quality += Math.round(stability * 12);
        
        // Bonus por señal fuerte
        if (redValue > 40) {
          quality += 8;
        }
        
        // Bonus por análisis FFT médico
        if (performanceConfig.enabledFeatures.fftAnalysis) {
          const fftResult = this.medicalFFTAnalyzer.analyzeBPM();
          if (fftResult && fftResult.isValid && fftResult.confidence > 0.4) {
            quality += Math.round(fftResult.confidence * 12);
          }
        }
        
        quality = Math.min(100, Math.max(30, quality)); // Mínimo médico 30 si hay detección
      }

      // 9. Adaptación de umbrales
      if (detectionResult.detected) {
        this.lastValues.push(redValue);
        if (this.lastValues.length > 12) { // Buffer médico optimizado
          this.lastValues.shift();
          this.adaptiveDetector.adaptThresholds(this.lastValues);
        }
      }

      // 10. Crear señal procesada médica
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filteredValue,
        quality: quality,
        fingerDetected: detectionResult.detected,
        roi: roi,
        perfusionIndex: detectionResult.detected && quality > 35 ? 
                       Math.max(0, (Math.log(redValue + 1) * 0.65 - 1.1)) : 0
      };

      if (shouldLog || detectionResult.detected) {
        console.log("PPGSignalProcessor médico: Señal final", {
          fingerDetected: detectionResult.detected,
          confidence: detectionResult.confidence,
          quality,
          rawValue: redValue,
          filteredValue: filteredValue,
          perfusionIndex: processedSignal.perfusionIndex,
          performanceLevel: this.performanceManager.getPerformanceStats().performanceLevel
        });
      }

      this.onSignalReady(processedSignal);
      
      // Finalizar medición de rendimiento
      this.performanceManager.endFrame();
      
    } catch (error) {
      console.error("PPGSignalProcessor médico: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error en procesamiento médico");
      this.performanceManager.endFrame();
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
  
  /**
   * Obtener estadísticas de rendimiento
   */
  public getPerformanceStats() {
    return this.performanceManager.getPerformanceStats();
  }
  
  /**
   * Obtener último BPM válido del análisis FFT médico
   */
  public getLastValidBPM(): number | null {
    return this.medicalFFTAnalyzer.getLastValidBPM();
  }
}
