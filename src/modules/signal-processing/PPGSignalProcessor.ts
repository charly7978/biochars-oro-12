
import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { RealFingerDetector, FingerDetectionResult } from './RealFingerDetector';
import { QualityCalculator } from './QualityCalculator';

/**
 * PROCESADOR PPG SIMPLE - SIN SIMULACIONES
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  
  // Componentes simplificados
  private fingerDetector: RealFingerDetector;
  private qualityCalculator: QualityCalculator;
  
  // Estado simple
  private frameCount = 0;
  private detectionHistory: boolean[] = [];
  private signalBuffer: number[] = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("PPGSignalProcessor: Inicializando procesador real");
    
    this.fingerDetector = new RealFingerDetector();
    this.qualityCalculator = new QualityCalculator();
    
    console.log("PPGSignalProcessor: Componentes reales inicializados");
  }

  async initialize(): Promise<void> {
    console.log("PPGSignalProcessor: Inicializando sistema real");
    try {
      this.frameCount = 0;
      this.detectionHistory = [];
      this.signalBuffer = [];
      
      // Reset componentes
      this.fingerDetector.reset();
      this.qualityCalculator.reset();
      
      console.log("PPGSignalProcessor: Sistema real inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error en inicialización", error);
      this.handleError("INIT_ERROR", "Error inicializando procesador");
    }
  }

  start(): void {
    console.log("PPGSignalProcessor: Iniciando medición real");
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.initialize();
    
    console.log("PPGSignalProcessor: Sistema real activo");
  }

  stop(): void {
    console.log("PPGSignalProcessor: Deteniendo medición real");
    this.isProcessing = false;
    
    // Reset completo
    this.fingerDetector.reset();
    this.qualityCalculator.reset();
    
    this.frameCount = 0;
    this.detectionHistory = [];
    this.signalBuffer = [];
    
    console.log("PPGSignalProcessor: Sistema real detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración real");
      await this.initialize();
      
      // La calibración es automática en los primeros frames
      setTimeout(() => {
        console.log("PPGSignalProcessor: Calibración real completada");
      }, 2000);
      
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error en calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error en calibración");
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing || !this.onSignalReady) return;

    try {
      this.frameCount++;
      const shouldLog = this.frameCount % 60 === 0;

      // 1. DETECCIÓN REAL DE DEDO
      const detectionResult: FingerDetectionResult = this.fingerDetector.detectFinger(imageData);
      
      // 2. EXTRACCIÓN SIMPLE DE SEÑAL PPG
      const rawSignalValue = this.extractSimplePPGSignal(imageData);
      
      // Almacenar señal
      this.signalBuffer.push(rawSignalValue);
      if (this.signalBuffer.length > 50) {
        this.signalBuffer.shift();
      }
      
      // 3. FILTRADO SIMPLE
      const filteredValue = this.applySimpleFilter(rawSignalValue);

      // 4. CÁLCULO DE CALIDAD REAL
      const pulsationStrength = this.calculateSimplePulsation();
      const realQuality = this.qualityCalculator.calculateQuality(
        rawSignalValue,
        pulsationStrength,
        detectionResult.isFingerDetected
      );

      // 5. FILTRO TEMPORAL SIMPLE
      this.detectionHistory.push(detectionResult.isFingerDetected);
      if (this.detectionHistory.length > 3) {
        this.detectionHistory.shift();
      }
      
      const finalDetected = this.detectionHistory.length >= 2 ? 
        this.detectionHistory.slice(-2).filter(d => d).length >= 1 : 
        detectionResult.isFingerDetected;

      // 6. CREAR SEÑAL PROCESADA
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: rawSignalValue,
        filteredValue: filteredValue,
        quality: realQuality,
        fingerDetected: finalDetected,
        roi: { x: 0, y: 0, width: imageData.width, height: imageData.height },
        perfusionIndex: this.calculateSimplePerfusion()
      };

      // 7. LOGGING REAL
      if (shouldLog || finalDetected) {
        console.log("PPGSignalProcessor REAL: Estado", {
          frameCount: this.frameCount,
          fingerDetected: finalDetected,
          quality: realQuality,
          rawSignal: rawSignalValue.toFixed(1),
          confidence: detectionResult.confidence.toFixed(2),
          calibrationProgress: this.fingerDetector.getCalibrationStatus().progress
        });
      }

      // 8. ENVIAR SEÑAL
      this.onSignalReady(processedSignal);
      
    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame real", error);
      this.handleError("PROCESSING_ERROR", "Error en procesamiento real");
    }
  }

  /**
   * Extrae señal PPG simple del canal rojo
   */
  private extractSimplePPGSignal(imageData: ImageData): number {
    const { data, width, height } = imageData;
    
    // Área central simple
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    let redSum = 0;
    let pixelCount = 0;
    
    // Muestreo simple
    for (let y = centerY - radius; y < centerY + radius; y += 4) {
      for (let x = centerX - radius; x < centerX + radius; x += 4) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (distance <= radius) {
            const index = (Math.floor(y) * width + Math.floor(x)) * 4;
            redSum += data[index]; // Solo canal rojo
            pixelCount++;
          }
        }
      }
    }
    
    return pixelCount > 0 ? redSum / pixelCount : 0;
  }

  /**
   * Filtro simple de señal
   */
  private applySimpleFilter(currentValue: number): number {
    if (this.signalBuffer.length < 3) return currentValue;
    
    // Filtro promedio móvil simple
    const recent = this.signalBuffer.slice(-3);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  /**
   * Calcula pulsación simple
   */
  private calculateSimplePulsation(): number {
    if (this.signalBuffer.length < 5) return 0;
    
    const recent = this.signalBuffer.slice(-5);
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    return mean > 0 ? (max - min) / mean : 0;
  }

  /**
   * Calcula perfusión simple
   */
  private calculateSimplePerfusion(): number {
    if (this.signalBuffer.length < 10) return 1.0;
    
    const recent = this.signalBuffer.slice(-10);
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const dc = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (dc === 0) return 1.0;
    
    const ac = (max - min) / 2;
    const perfusion = (ac / dc) * 100;
    
    return Math.max(0.5, Math.min(10.0, perfusion));
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
      detectionRate: this.detectionHistory.filter(d => d).length / Math.max(1, this.detectionHistory.length),
      avgSignal: this.signalBuffer.length > 0 ? 
        this.signalBuffer.reduce((a, b) => a + b, 0) / this.signalBuffer.length : 0
    };
  }
  
  public getLastValidBPM(): number | null {
    return null;
  }
}
