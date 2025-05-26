
import { NewAdaptiveDetector } from './NewAdaptiveDetector';

/**
 * Wrapper de compatibilidad para el sistema unificado
 */
export class AdaptiveDetector {
  private newDetector = new NewAdaptiveDetector();
  
  public detectFingerMultiModal(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    textureScore: number;
    rToGRatio: number;
    rToBRatio: number;
    stability: number;
  }): { detected: boolean; confidence: number; reasons: string[] } {
    
    // ROI por defecto para compatibilidad
    const defaultROI = {
      x: 100,
      y: 100,
      width: 200,
      height: 200
    };
    
    // ImageData dummy para compatibilidad
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const imageData = ctx?.createImageData(400, 400) || new ImageData(400, 400);
    
    const result = this.newDetector.detectFingerRobust({
      ...frameData,
      roi: defaultROI,
      imageData
    });
    
    return {
      detected: result.detected,
      confidence: result.confidence,
      reasons: result.reasons
    };
  }
  
  public adaptThresholds(recentValues: number[]): void {
    // Método legacy - el sistema unificado se auto-calibra
    console.log("AdaptiveDetector: adaptThresholds (legacy) - sistema unificado se auto-calibra");
  }
  
  public reset(): void {
    this.newDetector.reset();
  }
}
