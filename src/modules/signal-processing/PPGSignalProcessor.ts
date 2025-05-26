
import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { SignalTrendAnalyzer, TrendResult } from './SignalTrendAnalyzer';
import { BiophysicalValidator } from './BiophysicalValidator';
import { UnifiedFrameProcessor } from './UnifiedFrameProcessor';
import { UnifiedPPGDetector } from './UnifiedPPGDetector';
import { MedicalFFTAnalyzer } from './MedicalFFTAnalyzer';
import { PerformanceManager } from './PerformanceManager';
import { AutoCalibrationSystem } from './AutoCalibrationSystem';
import { CalibrationHandler } from './CalibrationHandler';
import { SignalAnalyzer } from './SignalAnalyzer';
import { SignalProcessorConfig } from './types';

/**
 * Procesador de señal PPG UNIFICADO - Sistema único y optimizado
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  public optimizedKalmanFilter: OptimizedKalmanFilter;
  public sgFilter: SavitzkyGolayFilter;
  public trendAnalyzer: SignalTrendAnalyzer;
  public biophysicalValidator: BiophysicalValidator;
  public unifiedFrameProcessor: UnifiedFrameProcessor;
  public unifiedDetector: UnifiedPPGDetector;
  public medicalFFTAnalyzer: MedicalFFTAnalyzer;
  public performanceManager: PerformanceManager;
  public autoCalibrationSystem: AutoCalibrationSystem;
  public calibrationHandler: CalibrationHandler;
  public signalAnalyzer: SignalAnalyzer;
  public lastValues: number[] = [];
  public isCalibrating: boolean = false;
  public frameProcessedCount = 0;
  
  // Configuración del procesador unificado
  public readonly CONFIG: SignalProcessorConfig = {
    BUFFER_SIZE: 12,
    MIN_RED_THRESHOLD: 80,
    MAX_RED_THRESHOLD: 170,
    STABILITY_WINDOW: 8,
    MIN_STABILITY_COUNT: 4,
    HYSTERESIS: 2.0,
    MIN_CONSECUTIVE_DETECTIONS: 3,
    MAX_CONSECUTIVE_NO_DETECTIONS: 6,
    QUALITY_LEVELS: 20,
    QUALITY_HISTORY_SIZE: 10,
    CALIBRATION_SAMPLES: 12,
    TEXTURE_GRID_SIZE: 8,
    ROI_SIZE_FACTOR: 0.4
  };
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("PPGSignalProcessor UNIFICADO: Constructor iniciado");
    
    // Inicializar SOLO los componentes necesarios
    this.optimizedKalmanFilter = new OptimizedKalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
    this.trendAnalyzer = new SignalTrendAnalyzer();
    this.biophysicalValidator = new BiophysicalValidator();
    this.unifiedFrameProcessor = new UnifiedFrameProcessor();
    this.unifiedDetector = new UnifiedPPGDetector();
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
    
    console.log("PPGSignalProcessor UNIFICADO: Instancia creada");
  }

  async initialize(): Promise<void> {
    console.log("PPGSignalProcessor UNIFICADO: initialize()");
    try {
      // Reset SOLO los componentes del sistema unificado
      this.lastValues = [];
      this.optimizedKalmanFilter.reset();
      this.sgFilter.reset();
      this.trendAnalyzer.reset();
      this.biophysicalValidator.reset();
      this.unifiedDetector.reset();
      this.unifiedFrameProcessor.reset();
      this.medicalFFTAnalyzer.reset();
      this.performanceManager.reset();
      this.signalAnalyzer.reset();
      this.frameProcessedCount = 0;
      
      console.log("PPGSignalProcessor UNIFICADO: Sistema inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor UNIFICADO: Error en inicialización", error);
      this.handleError("INIT_ERROR", "Error inicializando procesador unificado");
    }
  }

  start(): void {
    console.log("PPGSignalProcessor UNIFICADO: start()");
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor UNIFICADO: Sistema iniciado");
  }

  stop(): void {
    console.log("PPGSignalProcessor UNIFICADO: stop()");
    this.isProcessing = false;
    this.lastValues = [];
    this.optimizedKalmanFilter.reset();
    this.sgFilter.reset();
    this.trendAnalyzer.reset();
    this.biophysicalValidator.reset();
    this.unifiedDetector.reset();
    this.unifiedFrameProcessor.reset();
    this.medicalFFTAnalyzer.reset();
    this.performanceManager.reset();
    this.signalAnalyzer.reset();
    console.log("PPGSignalProcessor UNIFICADO: Sistema detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor UNIFICADO: Iniciando calibración");
      await this.initialize();
      
      this.isCalibrating = true;
      this.autoCalibrationSystem.startCalibration();
      
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor UNIFICADO: Error en calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error en calibración unificada");
      this.isCalibrating = false;
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing || !this.onSignalReady) return;

    try {
      this.performanceManager.startFrame();
      
      if (!this.performanceManager.shouldProcessFrame()) {
        this.performanceManager.endFrame();
        return;
      }

      this.frameProcessedCount++;
      const shouldLog = this.frameProcessedCount % 30 === 0;

      // 1. Procesamiento unificado de frame
      const frameData = this.unifiedFrameProcessor.processFrame(imageData);

      // 2. Calibración automática si está activa
      if (this.autoCalibrationSystem.isCalibrating()) {
        const calibrationResult = this.autoCalibrationSystem.processSample({
          redValue: frameData.redValue,
          avgGreen: frameData.avgGreen,
          avgBlue: frameData.avgBlue,
          quality: 0,
          fingerDetected: false
        });
        
        if (calibrationResult.isComplete) {
          this.isCalibrating = false;
          console.log("Calibración unificada completada:", calibrationResult.results);
        }
      }

      // 3. Detección unificada
      const detectionResult = this.unifiedDetector.detectFinger({
        ...frameData,
        imageData
      });

      if (shouldLog || detectionResult.detected) {
        console.log("PPGSignalProcessor UNIFICADO: Detección", {
          detected: detectionResult.detected,
          quality: detectionResult.quality,
          confidence: detectionResult.confidence,
          snr: detectionResult.snr,
          perfusion: detectionResult.perfusionIndex,
          redValue: frameData.redValue
        });
      }

      // 4. Procesamiento de señal optimizado
      const performanceConfig = this.performanceManager.getProcessingConfig();
      let filteredValue = frameData.redValue;
      
      if (performanceConfig.enabledFeatures.kalmanFilter) {
        filteredValue = this.optimizedKalmanFilter.filter(filteredValue);
      }
      
      if (performanceConfig.filterComplexity !== 'simple') {
        filteredValue = this.sgFilter.filter(filteredValue);
      }
      
      // Amplificación basada en calidad real
      const amplificationFactor = detectionResult.quality > 70 ? 8 : 
                                  detectionResult.quality > 50 ? 12 : 20;
      filteredValue = filteredValue * amplificationFactor;

      // 5. Análisis FFT médico
      if (performanceConfig.enabledFeatures.fftAnalysis) {
        this.medicalFFTAnalyzer.addSample(filteredValue);
      }
      
      // 6. Análisis de tendencia
      const trendResult = this.trendAnalyzer.analyzeTrend(filteredValue);

      // 7. Validación biofísica
      if (trendResult === "non_physiological" && !this.isCalibrating && this.frameProcessedCount > 60) {
        const rejectSignal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: frameData.redValue,
          filteredValue: filteredValue,
          quality: 0,
          fingerDetected: false,
          roi: frameData.roi,
          perfusionIndex: 0
        };
        this.onSignalReady(rejectSignal);
        this.performanceManager.endFrame();
        return;
      }

      // 8. Crear señal procesada con calidad REAL del detector unificado
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: frameData.redValue,
        filteredValue: filteredValue,
        quality: detectionResult.quality, // USAR CALIDAD REAL DEL DETECTOR UNIFICADO
        fingerDetected: detectionResult.detected,
        roi: frameData.roi,
        perfusionIndex: detectionResult.perfusionIndex
      };

      if (shouldLog || detectionResult.detected) {
        console.log("PPGSignalProcessor UNIFICADO: Señal final", {
          fingerDetected: detectionResult.detected,
          quality: detectionResult.quality,
          rawValue: frameData.redValue,
          filteredValue: filteredValue,
          perfusionIndex: detectionResult.perfusionIndex,
          snr: detectionResult.snr
        });
      }

      this.onSignalReady(processedSignal);
      this.performanceManager.endFrame();
      
    } catch (error) {
      console.error("PPGSignalProcessor UNIFICADO: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error en procesamiento unificado");
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
  
  public getPerformanceStats() {
    return this.performanceManager.getPerformanceStats();
  }
  
  public getLastValidBPM(): number | null {
    return this.medicalFFTAnalyzer.getLastValidBPM();
  }
}
