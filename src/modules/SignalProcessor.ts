
// PROCESADOR DE SEÑAL UNIFICADO Y SIMPLIFICADO
import { HumanFingerDetector, HumanFingerResult } from './signal-processing/HumanFingerDetector';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export class PPGSignalProcessor {
  private humanFingerDetector: HumanFingerDetector;
  private frameCount = 0;
  public onSignalReady?: (signal: ProcessedSignal) => void;
  public onError?: (error: ProcessingError) => void;
  
  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    console.log("PPGSignalProcessor UNIFICADO: Inicializando con detector humano especializado");
    
    this.humanFingerDetector = new HumanFingerDetector();
    this.onSignalReady = onSignalReady;
    this.onError = onError;
  }
  
  async initialize(): Promise<void> {
    console.log("PPGSignalProcessor UNIFICADO: Sistema inicializado correctamente");
    return Promise.resolve();
  }
  
  processFrame(imageData: ImageData): void {
    this.frameCount++;
    
    try {
      // Procesar con el detector humano unificado
      const result: HumanFingerResult = this.humanFingerDetector.detectHumanFinger(imageData);
      
      // Convertir a formato ProcessedSignal
      const processedSignal: ProcessedSignal = {
        timestamp: result.timestamp,
        rawValue: result.rawValue,
        filteredValue: result.filteredValue,
        quality: result.quality,
        fingerDetected: result.isHumanFinger,
        roi: {
          x: imageData.width / 2 - 80,
          y: imageData.height / 2 - 80,
          width: 160,
          height: 160
        },
        perfusionIndex: result.confidence
      };
      
      // Log cada 30 frames
      if (this.frameCount % 30 === 0) {
        console.log("PPGSignalProcessor UNIFICADO:", {
          detected: result.isHumanFinger,
          confidence: result.confidence.toFixed(3),
          quality: result.quality,
          rawValue: result.rawValue.toFixed(1),
          rejections: result.debugInfo.rejectionReasons.slice(0, 2)
        });
      }
      
      // Enviar señal procesada
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
    } catch (error) {
      console.error("PPGSignalProcessor UNIFICADO: Error procesando frame:", error);
      
      if (this.onError) {
        this.onError({
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: Date.now()
        });
      }
    }
  }
  
  start(): void {
    console.log("PPGSignalProcessor UNIFICADO: Iniciado");
  }
  
  stop(): void {
    console.log("PPGSignalProcessor UNIFICADO: Detenido");
    this.humanFingerDetector.reset();
    this.frameCount = 0;
  }
  
  reset(): void {
    console.log("PPGSignalProcessor UNIFICADO: Reset completo");
    this.humanFingerDetector.reset();
    this.frameCount = 0;
  }
  
  getStatus() {
    return {
      frameCount: this.frameCount,
      detector: this.humanFingerDetector.getStatus()
    };
  }
}

export * from './signal-processing/types';
