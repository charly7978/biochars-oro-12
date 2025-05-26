
/**
 * ADAPTADOR PARA COMPATIBILIDAD
 * Redirige al sistema unificado manteniendo la interfaz existente
 */
import { UnifiedPPGDetector } from './UnifiedPPGDetector';
import { UnifiedFrameProcessor } from './UnifiedFrameProcessor';

export class NewAdaptiveDetector {
  private unifiedDetector = new UnifiedPPGDetector();
  private frameProcessor = new UnifiedFrameProcessor();
  
  /**
   * Método principal que redirige al sistema unificado
   */
  public detectFingerRobust(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    textureScore: number;
    rToGRatio: number;
    rToBRatio: number;
    stability: number;
    roi: { x: number; y: number; width: number; height: number };
    imageData: ImageData;
  }) {
    
    // Procesar frame con sistema unificado
    const processedFrame = this.frameProcessor.processFrame(frameData.imageData);
    
    // Usar datos procesados o datos de entrada
    const unifiedFrameData = {
      redValue: processedFrame.redValue || frameData.redValue,
      avgGreen: processedFrame.avgGreen || frameData.avgGreen,
      avgBlue: processedFrame.avgBlue || frameData.avgBlue,
      textureScore: processedFrame.textureScore || frameData.textureScore,
      stability: processedFrame.stability || frameData.stability,
      roi: processedFrame.roi || frameData.roi,
      imageData: frameData.imageData
    };
    
    // Detectar con sistema unificado
    const result = this.unifiedDetector.detectFinger(unifiedFrameData);
    
    // Adaptar resultado al formato esperado
    return {
      detected: result.detected,
      quality: result.quality,
      confidence: result.confidence,
      reasons: result.reasons,
      diagnostics: {
        ...result.diagnostics,
        snr: result.snr,
        perfusionIndex: result.perfusionIndex
      }
    };
  }
  
  public reset(): void {
    this.unifiedDetector.reset();
    this.frameProcessor.reset();
  }
}
