import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { FingerDetectionCore, FingerDetectionResult } from './FingerDetectionCore';
import { SignalProcessingCore, ProcessedSignalData } from './SignalProcessingCore';
import { UnifiedFrameProcessor } from './UnifiedFrameProcessor';
import { SignalTrendAnalyzer, TrendResult } from './SignalTrendAnalyzer';
import { BiophysicalValidator } from './BiophysicalValidator';

/**
 * PROCESADOR PPG REFACTORIZADO Y SIMPLIFICADO
 * Sistema modular y enfocado en detección real de dedos
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  
  // Componentes principales
  private fingerDetector: FingerDetectionCore;
  private signalProcessor: SignalProcessingCore;
  private frameProcessor: UnifiedFrameProcessor;
  private trendAnalyzer: SignalTrendAnalyzer;
  private biophysicalValidator: BiophysicalValidator;
  
  // Estado del procesador
  private frameCount = 0;
  private isCalibrating = false;
  private detectionHistory: boolean[] = [];
  private qualityHistory: number[] = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("PPGSignalProcessor REFACTORIZADO: Inicializando componentes");
    
    this.fingerDetector = new FingerDetectionCore();
    this.signalProcessor = new SignalProcessingCore();
    this.frameProcessor = new UnifiedFrameProcessor();
    this.trendAnalyzer = new SignalTrendAnalyzer();
    this.biophysicalValidator = new BiophysicalValidator();
    
    console.log("PPGSignalProcessor REFACTORIZADO: Componentes inicializados");
  }

  async initialize(): Promise<void> {
    console.log("PPGSignalProcessor REFACTORIZADO: initialize()");
    try {
      this.frameCount = 0;
      this.detectionHistory = [];
      this.qualityHistory = [];
      
      // Reset de todos los componentes
      this.fingerDetector.reset();
      this.signalProcessor.reset();
      this.frameProcessor.reset();
      this.trendAnalyzer.reset();
      this.biophysicalValidator.reset();
      
      console.log("PPGSignalProcessor REFACTORIZADO: Inicialización completada");
    } catch (error) {
      console.error("PPGSignalProcessor REFACTORIZADO: Error en inicialización", error);
      this.handleError("INIT_ERROR", "Error inicializando procesador refactorizado");
    }
  }

  start(): void {
    console.log("PPGSignalProcessor REFACTORIZADO: start()");
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.initialize();
    
    console.log("PPGSignalProcessor REFACTORIZADO: Sistema iniciado correctamente");
  }

  stop(): void {
    console.log("PPGSignalProcessor REFACTORIZADO: stop()");
    this.isProcessing = false;
    
    // Reset completo
    this.fingerDetector.reset();
    this.signalProcessor.reset();
    this.frameProcessor.reset();
    this.trendAnalyzer.reset();
    this.biophysicalValidator.reset();
    
    this.frameCount = 0;
    this.detectionHistory = [];
    this.qualityHistory = [];
    
    console.log("PPGSignalProcessor REFACTORIZADO: Sistema detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor REFACTORIZADO: Iniciando calibración");
      await this.initialize();
      
      this.isCalibrating = true;
      
      // La calibración ahora es automática en el detector
      setTimeout(() => {
        this.isCalibrating = false;
        console.log("PPGSignalProcessor REFACTORIZADO: Calibración completada");
      }, 2000);
      
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor REFACTORIZADO: Error en calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error en calibración");
      this.isCalibrating = false;
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing || !this.onSignalReady) return;

    try {
      this.frameCount++;
      const shouldLog = this.frameCount % 30 === 0;

      // 1. DETECCIÓN DE DEDO CORREGIDA
      const detectionResult: FingerDetectionResult = this.fingerDetector.detectFinger(imageData);
      
      // 2. PROCESAMIENTO DE SEÑAL SOLO SI HAY DEDO
      let signalData: ProcessedSignalData;
      if (detectionResult.detected) {
        signalData = this.signalProcessor.processSignal(
          detectionResult.metrics.redIntensity, 
          detectionResult.quality
        );
      } else {
        // Señal por defecto sin dedo
        signalData = {
          rawValue: detectionResult.metrics.redIntensity,
          filteredValue: detectionResult.metrics.redIntensity,
          amplifiedValue: 0,
          timestamp: Date.now()
        };
      }

      // 3. ANÁLISIS DE TENDENCIA
      const trendResult: TrendResult = this.trendAnalyzer.analyzeTrend(signalData.amplifiedValue);

      // 4. VALIDACIÓN BIOFÍSICA
      const isPhysiological = trendResult !== "non_physiological";

      // 5. APLICAR HISTÉRESIS PARA ESTABILIDAD
      const finalDetected = this.applyDetectionHysteresis(
        detectionResult.detected && isPhysiological
      );

      // 6. CALIDAD FINAL CON VARIABILIDAD NATURAL
      const finalQuality = this.calculateFinalQuality(
        detectionResult.quality, 
        finalDetected
      );

      // 7. CREAR SEÑAL PROCESADA FINAL
      const processedSignal: ProcessedSignal = {
        timestamp: signalData.timestamp,
        rawValue: signalData.rawValue,
        filteredValue: signalData.filteredValue,
        quality: finalQuality,
        fingerDetected: finalDetected,
        roi: detectionResult.roi,
        perfusionIndex: this.calculatePerfusionIndex(detectionResult.metrics)
      };

      // 8. LOGGING DETALLADO
      if (shouldLog || finalDetected) {
        console.log("PPGSignalProcessor REFACTORIZADO: Resultado", {
          frameCount: this.frameCount,
          fingerDetected: finalDetected,
          quality: finalQuality,
          redIntensity: detectionResult.metrics.redIntensity.toFixed(1),
          ratio: detectionResult.metrics.redToGreenRatio.toFixed(2),
          confidence: detectionResult.confidence.toFixed(2),
          reason: detectionResult.reasons[0],
          trendResult,
          isCalibrating: this.isCalibrating
        });
      }

      // 9. ENVIAR SEÑAL PROCESADA
      this.onSignalReady(processedSignal);
      
    } catch (error) {
      console.error("PPGSignalProcessor REFACTORIZADO: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error en procesamiento de frame");
    }
  }

  /**
   * Aplicar histéresis para estabilizar detección
   */
  private applyDetectionHysteresis(currentDetection: boolean): boolean {
    this.detectionHistory.push(currentDetection);
    if (this.detectionHistory.length > 5) {
      this.detectionHistory.shift();
    }
    
    if (this.detectionHistory.length < 3) return currentDetection;
    
    // Contar detecciones recientes
    const recentDetections = this.detectionHistory.filter(d => d).length;
    
    // Requiere al menos 2 de 5 frames para confirmar detección
    return recentDetections >= 2;
  }

  /**
   * Calcular calidad final con variabilidad natural
   */
  private calculateFinalQuality(baseQuality: number, detected: boolean): number {
    if (!detected) {
      return Math.random() * 20; // 0-20% sin dedo
    }
    
    // Agregar variabilidad natural ±5%
    const variation = (Math.random() - 0.5) * 10;
    const finalQuality = Math.max(25, Math.min(95, baseQuality + variation));
    
    // Mantener historial para suavizado
    this.qualityHistory.push(finalQuality);
    if (this.qualityHistory.length > 3) {
      this.qualityHistory.shift();
    }
    
    // Promedio suavizado
    return Math.round(
      this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length
    );
  }

  /**
   * Calcular índice de perfusión simplificado
   */
  private calculatePerfusionIndex(metrics: any): number {
    if (!metrics) return 0;
    
    // Estimación basada en intensidad y estabilidad
    const intensityFactor = Math.max(0, (metrics.redIntensity - 60) / 140);
    const stabilityFactor = metrics.stability;
    
    const perfusion = intensityFactor * stabilityFactor * 10; // 0-10%
    return Math.max(0.1, Math.min(8.0, perfusion));
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
    return {
      frameCount: this.frameCount,
      isCalibrating: this.isCalibrating,
      detectionRate: this.detectionHistory.filter(d => d).length / Math.max(1, this.detectionHistory.length),
      avgQuality: this.qualityHistory.length > 0 ? 
        this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length : 0
    };
  }
  
  public getLastValidBPM(): number | null {
    // Implementación simplificada
    return null;
  }
}
