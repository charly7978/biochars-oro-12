
/**
 * EXTRACTOR DE MÉTRICAS REAL - SIN SIMULACIONES
 * Extrae métricas básicas de la imagen para detección de dedo
 */

export interface ExtractedMetrics {
  redIntensity: number;
  greenIntensity: number;
  blueIntensity: number;
  redToGreenRatio: number;
  textureScore: number;
  roi: { x: number; y: number; width: number; height: number };
}

export class MetricsExtractor {
  
  extractMetrics(imageData: ImageData): ExtractedMetrics {
    const { data, width, height } = imageData;
    
    // ROI simple y efectivo
    const roiSize = Math.min(width, height) * 0.4;
    const roiX = Math.floor(width / 2 - roiSize / 2);
    const roiY = Math.floor(height / 2 - roiSize / 2);
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = [];
    
    // Muestreo simple de la ROI
    for (let y = roiY; y < roiY + roiSize; y += 3) {
      for (let x = roiX; x < roiX + roiSize; x += 3) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          redSum += r;
          greenSum += g;
          blueSum += b;
          intensities.push((r + g + b) / 3);
          validPixels++;
        }
      }
    }
    
    const avgRed = validPixels > 0 ? redSum / validPixels : 0;
    const avgGreen = validPixels > 0 ? greenSum / validPixels : 0;
    const avgBlue = validPixels > 0 ? blueSum / validPixels : 0;
    
    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      redToGreenRatio: avgGreen > 1 ? avgRed / avgGreen : 0,
      textureScore: this.calculateTextureScore(intensities),
      roi: { x: roiX, y: roiY, width: roiSize, height: roiSize }
    };
  }
  
  private calculateTextureScore(intensities: number[]): number {
    if (intensities.length < 10) return 0;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    
    return Math.min(1.0, Math.sqrt(variance) / 20.0);
  }
}
