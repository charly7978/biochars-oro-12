
/**
 * EXTRACTOR DE MÉTRICAS REAL - ANÁLISIS PRECISO DE IMAGEN
 * Extrae métricas físicas reales para detección de dedo humano
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
    
    // ROI optimizado para dedos - área central más pequeña y precisa
    const roiSize = Math.min(width, height) * 0.3;
    const roiX = Math.floor(width / 2 - roiSize / 2);
    const roiY = Math.floor(height / 2 - roiSize / 2);
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = [];
    const edges: number[] = [];
    
    // Análisis pixel por pixel más denso para mayor precisión
    for (let y = roiY; y < roiY + roiSize; y += 2) {
      for (let x = roiX; x < roiX + roiSize; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          // Filtrar píxeles demasiado oscuros o claros (no son piel)
          const brightness = (r + g + b) / 3;
          if (brightness > 40 && brightness < 240) {
            redSum += r;
            greenSum += g;
            blueSum += b;
            intensities.push(brightness);
            validPixels++;
            
            // Calcular gradiente para textura
            if (x > roiX && y > roiY) {
              const prevIndex = (y * width + (x - 2)) * 4;
              const prevBrightness = (data[prevIndex] + data[prevIndex + 1] + data[prevIndex + 2]) / 3;
              edges.push(Math.abs(brightness - prevBrightness));
            }
          }
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
      textureScore: this.calculateEnhancedTextureScore(intensities, edges),
      roi: { x: roiX, y: roiY, width: roiSize, height: roiSize }
    };
  }
  
  private calculateEnhancedTextureScore(intensities: number[], edges: number[]): number {
    if (intensities.length < 20) return 0;
    
    // Análisis de varianza para textura de piel
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    const textureVariance = Math.sqrt(variance) / 30.0;
    
    // Análisis de bordes para detectar estructura de piel
    let edgeScore = 0;
    if (edges.length > 0) {
      const avgEdge = edges.reduce((a, b) => a + b, 0) / edges.length;
      edgeScore = Math.min(1.0, avgEdge / 15.0);
    }
    
    // Combinar ambas métricas
    return Math.min(1.0, (textureVariance * 0.7) + (edgeScore * 0.3));
  }
}
