
import { NewAdaptiveDetector } from './NewAdaptiveDetector';

/**
 * Wrapper para mantener compatibilidad con la interfaz existente
 */
export class AdaptiveDetector {
  private newDetector = new NewAdaptiveDetector();
  
  /**
   * Método principal de detección (interfaz de compatibilidad)
   */
  public detectFingerMultiModal(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    textureScore: number;
    rToGRatio: number;
    rToBRatio: number;
    stability: number;
  }): { detected: boolean; confidence: number; reasons: string[] } {
    
    // Crear un ROI por defecto ya que el nuevo sistema lo requiere
    const defaultROI = {
      x: 100,
      y: 100,
      width: 200,
      height: 200
    };
    
    // Crear imageData dummy para compatibilidad (el sistema robusto calculará su propio ROI)
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
    // Método legacy - el nuevo sistema se auto-calibra
    console.log("AdaptiveDetector: adaptThresholds llamado (legacy) - el nuevo sistema se auto-calibra");
  }
  
  public reset(): void {
    this.newDetector.reset();
  }
}
