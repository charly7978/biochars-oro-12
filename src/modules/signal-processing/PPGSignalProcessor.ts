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
 * Procesador de señal PPG con validación ESTRICTA de calidad
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
  
  // Configuración ESTRICTA para calidad real
  public readonly CONFIG: SignalProcessorConfig = {
    BUFFER_SIZE: 12,
    MIN_RED_THRESHOLD: 80, // Más estricto
    MAX_RED_THRESHOLD: 170, // Más estricto
    STABILITY_WINDOW: 8,
    MIN_STABILITY_COUNT: 4, // Más estricto
    HYSTERESIS: 2.0,
    MIN_CONSECUTIVE_DETECTIONS: 3, // Más estricto
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
    console.log("[DIAG] PPGSignalProcessor: Constructor con validación ESTRICTA de calidad");
    
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
    
    console.log("PPGSignalProcessor: Instancia con validación ESTRICTA de calidad creada");
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
      this.performanceManager.startFrame();
      
      if (!this.performanceManager.shouldProcessFrame()) {
        this.performanceManager.endFrame();
        return;
      }

      this.frameProcessedCount++;
      const shouldLog = this.frameProcessedCount % 30 === 0;

      if (!this.onSignalReady) {
        console.error("PPGSignalProcessor: onSignalReady callback no disponible");
        return;
      }

      // 1. Extracción ESTRICTA de datos del frame
      const extractionResult = this.enhancedFrameProcessor.extractEnhancedFrameData(imageData);
      const { redValue, textureScore, rToGRatio, rToBRatio, roi, stability } = extractionResult;

      // 2. Calibración automática si está activa
      if (this.autoCalibrationSystem.isCalibrating()) {
        const calibrationResult = this.autoCalibrationSystem.processSample({
          redValue,
          avgGreen: extractionResult.avgGreen,
          avgBlue: extractionResult.avgBlue,
          quality: 0,
          fingerDetected: false
        });
        
        if (calibrationResult.isComplete) {
          this.isCalibrating = false;
          console.log("Calibración automática completada:", calibrationResult.results);
        }
      }

      // 3. Detección ESTRICTA multi-modal
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
        console.log("PPGSignalProcessor: Resultado de detección ESTRICTA", {
          detected: detectionResult.detected,
          confidence: detectionResult.confidence,
          reasons: detectionResult.reasons,
          redValue
        });
      }

      // 4. Procesamiento de señal
      const performanceConfig = this.performanceManager.getProcessingConfig();
      let filteredValue = redValue;
      
      if (performanceConfig.enabledFeatures.kalmanFilter) {
        filteredValue = this.optimizedKalmanFilter.filter(filteredValue);
      }
      
      if (performanceConfig.filterComplexity !== 'simple') {
        filteredValue = this.sgFilter.filter(filteredValue);
      }
      
      // Amplificación conservadora
      const amplificationFactor = detectionResult.confidence > 0.8 ? 12 : 20;
      filteredValue = filteredValue * amplificationFactor;

      // 5. Análisis FFT médico
      if (performanceConfig.enabledFeatures.fftAnalysis) {
        this.medicalFFTAnalyzer.addSample(filteredValue);
      }
      
      // 6. Análisis de tendencia
      const trendResult = this.trendAnalyzer.analyzeTrend(filteredValue);

      // 7. Validación biofísica ESTRICTA
      if (trendResult === "non_physiological" && !this.isCalibrating && this.frameProcessedCount > 60) {
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

      // 8. Cálculo de calidad REALISTA Y ESTRICTO
      let quality = 0;
      if (detectionResult.detected) {
        // Base de calidad realista (no inflada)
        quality = Math.round(detectionResult.confidence * 60); // Base más baja y realista
        
        // Evaluación estricta de estabilidad
        if (stability > 0.7) {
          quality += 15;
        } else if (stability > 0.5) {
          quality += 8;
        } else if (stability > 0.3) {
          quality += 3;
        }
        
        // Evaluación estricta de señal
        if (redValue > 120 && redValue < 150) {
          quality += 12; // Rango óptimo
        } else if (redValue > 100 && redValue < 160) {
          quality += 6; // Rango bueno
        } else if (redValue > 80 && redValue < 170) {
          quality += 2; // Rango aceptable
        }
        
        // Evaluación estricta de ratio biológico
        if (rToGRatio >= 1.3 && rToGRatio <= 1.8) {
          quality += 8; // Ratio óptimo
        } else if (rToGRatio >= 1.2 && rToGRatio <= 2.0) {
          quality += 3; // Ratio aceptable
        }
        
        // Evaluación estricta de textura
        if (textureScore > 0.4) {
          quality += 5;
        } else if (textureScore > 0.25) {
          quality += 2;
        }
        
        // Penalización por valores extremos o artificiales
        if (redValue > 160 || redValue < 90) {
          quality = Math.max(0, quality - 20);
        }
        
        // Análisis FFT para calidad adicional
        if (performanceConfig.enabledFeatures.fftAnalysis) {
          const fftResult = this.medicalFFTAnalyzer.analyzeBPM();
          if (fftResult && fftResult.isValid && fftResult.confidence > 0.5) {
            quality += Math.round(fftResult.confidence * 8);
          }
        }
        
        // Limitar calidad a rangos realistas
        quality = Math.min(95, Math.max(10, quality)); // Máximo 95, mínimo 10 si hay detección
      }

      // 9. Adaptación de umbrales conservadora
      if (detectionResult.detected && quality > 30) {
        this.lastValues.push(redValue);
        if (this.lastValues.length > 15) {
          this.lastValues.shift();
          this.adaptiveDetector.adaptThresholds(this.lastValues);
        }
      }

      // 10. Crear señal procesada con calidad realista
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filteredValue,
        quality: quality,
        fingerDetected: detectionResult.detected,
        roi: roi,
        perfusionIndex: detectionResult.detected && quality > 40 ? 
                       Math.max(0, (Math.log(redValue + 1) * 0.5 - 1.5)) : 0
      };

      if (shouldLog || detectionResult.detected) {
        console.log("PPGSignalProcessor: Señal final con calidad REALISTA", {
          fingerDetected: detectionResult.detected,
          confidence: detectionResult.confidence,
          quality,
          rawValue: redValue,
          filteredValue: filteredValue,
          perfusionIndex: processedSignal.perfusionIndex,
          stability,
          rToGRatio,
          textureScore
        });
      }

      this.onSignalReady(processedSignal);
      this.performanceManager.endFrame();
      
    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error en procesamiento ESTRICTO");
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
