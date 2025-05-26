/**
 * PROCESADOR DE FRAMES UNIFICADO
 * Corregido para extraer correctamente los valores RGB y detectar dedos reales
 */

export class UnifiedFrameProcessor {
  private frameCount: number = 0;
  
  /**
   * Procesamiento optimizado de frame completo
   */
  public processFrame(imageData: ImageData) {
    this.frameCount++;
    
    // ROI optimizado centrado
    const roi = this.detectOptimalROI(imageData);
    
    // Extracción CORREGIDA de datos
    const frameData = this.extractFrameData(imageData, roi);
    
    // Debug cada 30 frames
    if (this.frameCount % 30 === 0) {
      console.log("UnifiedFrameProcessor: Frame procesado", {
        frameCount: this.frameCount,
        redValue: frameData.redValue,
        avgGreen: frameData.avgGreen,
        avgBlue: frameData.avgBlue,
        textureScore: frameData.textureScore,
        roiSize: `${roi.width}x${roi.height}`
      });
    }
    
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
    
    // ROI centrado más grande para mejor captura
    const roiSize = Math.min(width, height) * 0.6; // Aumentado de 0.35 a 0.6
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    return {
      x: Math.max(0, Math.floor(centerX - roiSize / 2)),
      y: Math.max(0, Math.floor(centerY - roiSize / 2)),
      width: Math.min(Math.floor(roiSize), width),
      height: Math.min(Math.floor(roiSize), height)
    };
  }
  
  /**
   * Extracción CORREGIDA de datos del frame
   */
  private extractFrameData(imageData: ImageData, roi: any) {
    const { data, width } = imageData;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = [];
    
    // Procesamiento DIRECTO sin saltos para capturar más información
    for (let y = roi.y; y < roi.y + roi.height; y++) {
      for (let x = roi.x; x < roi.x + roi.width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Validación menos restrictiva para capturar más señal
        if (r > 20 && g > 15 && b > 10) { // Umbrales mucho más bajos
          redSum += r;
          greenSum += g;
          blueSum += b;
          intensities.push((r + g + b) / 3);
          validPixels++;
        }
      }
    }
    
    if (validPixels === 0) {
      // Si no hay píxeles válidos, usar promedio de toda la ROI
      for (let y = roi.y; y < roi.y + roi.height; y++) {
        for (let x = roi.x; x < roi.x + roi.width; x++) {
          const index = (y * width + x) * 4;
          redSum += data[index];
          greenSum += data[index + 1];
          blueSum += data[index + 2];
          validPixels++;
        }
      }
    }
    
    const avgRed = validPixels > 0 ? redSum / validPixels : 0;
    const avgGreen = validPixels > 0 ? greenSum / validPixels : 0;
    const avgBlue = validPixels > 0 ? blueSum / validPixels : 0;
    
    // Cálculo de textura simplificado pero efectivo
    const textureScore = intensities.length > 0 ? this.calculateTexture(intensities) : 0;
    
    // Estabilidad basada en varianza
    const stability = intensities.length > 0 ? this.calculateStability(intensities) : 0;
    
    return {
      redValue: avgRed,
      avgGreen,
      avgBlue,
      textureScore,
      stability
    };
  }
  
  /**
   * Cálculo eficiente de textura
   */
  private calculateTexture(intensities: number[]): number {
    if (intensities.length < 10) return 0;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    
    return Math.min(1.0, Math.sqrt(variance) / 50); // Ajustado para ser más sensible
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
    return Math.max(0, Math.min(1, 1 - (cv / 2))); // Más tolerante
  }
  
  /**
   * Reset del procesador
   */
  public reset(): void {
    this.frameCount = 0;
  }
}
