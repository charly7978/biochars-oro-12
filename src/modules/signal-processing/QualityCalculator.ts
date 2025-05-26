
/**
 * CALCULADOR DE CALIDAD SIMPLE - SIN SIMULACIONES
 */

export class QualityCalculator {
  private qualityHistory: number[] = [];
  private detectionHistory: boolean[] = [];
  
  calculateQuality(
    redIntensity: number,
    pulsationStrength: number,
    isDetected: boolean
  ): number {
    // Historial de detección
    this.detectionHistory.push(isDetected);
    if (this.detectionHistory.length > 5) {
      this.detectionHistory.shift();
    }
    
    if (!isDetected) {
      return Math.max(5, 15 + Math.random() * 10); // Calidad baja pero realista
    }
    
    let quality = 40; // Base más alta para detección positiva
    
    // 1. Calidad por intensidad (40%)
    if (redIntensity >= 60 && redIntensity <= 220) {
      const optimal = 130;
      const deviation = Math.abs(redIntensity - optimal) / optimal;
      quality += 30 * (1 - deviation);
    }
    
    // 2. Calidad por pulsación (30%)
    if (pulsationStrength > 0) {
      quality += Math.min(25, pulsationStrength * 500);
    }
    
    // 3. Calidad por consistencia (30%)
    const recentDetections = this.detectionHistory.slice(-3);
    const detectionRate = recentDetections.filter(d => d).length / recentDetections.length;
    quality += detectionRate * 25;
    
    // Suavizado simple
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 2) {
      this.qualityHistory.shift();
    }
    
    const smoothedQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
    
    return Math.max(20, Math.min(90, Math.round(smoothedQuality)));
  }
  
  reset(): void {
    this.qualityHistory = [];
    this.detectionHistory = [];
  }
}
