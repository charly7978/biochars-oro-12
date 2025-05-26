
/**
 * PROCESADOR DE FRAMES UNIFICADO
 * Reemplaza todos los procesadores anteriores con lógica optimizada
 */
import { UNIFIED_PPG_CONFIG } from './UnifiedConfig';

export class UnifiedFrameProcessor {
  private frameCount: number = 0;
  
  /**
   * Procesamiento optimizado de frame completo
   */
  public processFrame(imageData: ImageData) {
    this.frameCount++;
    
    // ROI optimizado centrado
    const roi = this.detectOptimalROI(imageData);
    
    // Extracción eficiente de datos
    const frameData = this.extractFrameData(imageData, roi);
    
    return {
      ...frameData,
      roi,
      frameCount: this.frameCount
    };
  }
  
  /**
   * Detección de ROI optimizada
   */
  private detectOptimalROI(imageData: ImageData) {
    const { width, height } = imageData;
    
    // ROI centrado optimizado
    const roiSize = Math.min(width, height) * UNIFIED_PPG_CONFIG.FRAME_PROCESSING.ROI_SIZE_FACTOR;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    return {
      x: Math.max(0, centerX - roiSize / 2),
      y: Math.max(0, centerY - roiSize / 2),
      width: Math.min(roiSize, width),
      height: Math.min(roiSize, height)
    };
  }
  
  /**
   * Extracción eficiente de datos del frame
   */
  private extractFrameData(imageData: ImageData, roi: any) {
    const { data, width } = imageData;
    const step = UNIFIED_PPG_CONFIG.FRAME_PROCESSING.SAMPLING_STEP;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = [];
    
    // Muestreo optimizado
    for (let y = roi.y; y < roi.y + roi.height; y += step) {
      for (let x = roi.x; x < roi.x + roi.width; x += step) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Solo píxeles con características mínimas de piel
        if (this.isValidSkinPixel(r, g, b)) {
          redSum += r;
          greenSum += g;
          blueSum += b;
          intensities.push((r + g + b) / 3);
          validPixels++;
        }
      }
    }
    
    if (validPixels === 0) {
      return {
        redValue: 0,
        avgGreen: 0,
        avgBlue: 0,
        textureScore: 0,
        stability: 0
      };
    }
    
    const avgRed = redSum / validPixels;
    const avgGreen = greenSum / validPixels;
    const avgBlue = blueSum / validPixels;
    
    // Cálculo de textura optimizado
    const textureScore = this.calculateTexture(intensities);
    
    // Estabilidad basada en varianza
    const stability = this.calculateStability(intensities);
    
    return {
      redValue: avgRed,
      avgGreen,
      avgBlue,
      textureScore,
      stability
    };
  }
  
  /**
   * Validación rápida de píxel de piel
   */
  private isValidSkinPixel(r: number, g: number, b: number): boolean {
    // Verificaciones básicas ultra-rápidas
    return (
      r >= 60 && r <= 180 &&
      g >= 40 && g <= 140 &&
      b >= 30 && b <= 120 &&
      r > g && r > b // Dominancia roja
    );
  }
  
  /**
   * Cálculo eficiente de textura
   */
  private calculateTexture(intensities: number[]): number {
    if (intensities.length < 10) return 0;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    
    return Math.min(1.0, Math.sqrt(variance) / 100);
  }
  
  /**
   * Cálculo de estabilidad optimizado
   */
  private calculateStability(intensities: number[]): number {
    if (intensities.length < 5) return 0;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const cv = Math.sqrt(intensities.reduce((acc, val) => 
      acc + Math.pow(val - mean, 2), 0) / intensities.length) / mean;
    
    // Estabilidad inversa al coeficiente de variación
    return Math.max(0, Math.min(1, 1 - cv));
  }
  
  /**
   * Reset del procesador
   */
  public reset(): void {
    this.frameCount = 0;
  }
}
