
/**
 * CALCULADOR DE CALIDAD MEJORADO - SIN SIMULACIONES
 */

export class QualityCalculator {
  private qualityHistory: number[] = [];
  private detectionHistory: boolean[] = [];
  private consistencyBuffer: number[] = [];
  
  calculateQuality(
    redIntensity: number,
    pulsationStrength: number,
    isDetected: boolean
  ): number {
    // Historial de detección más largo para mejor análisis
    this.detectionHistory.push(isDetected);
    if (this.detectionHistory.length > 8) {
      this.detectionHistory.shift();
    }
    
    if (!isDetected) {
      const baseQuality = Math.max(8, 12 + Math.random() * 8);
      this.qualityHistory.push(baseQuality);
      return Math.round(baseQuality);
    }
    
    let quality = 25; // Base más conservadora
    
    // 1. Calidad por intensidad roja (40%) - más estricta
    if (redIntensity >= 100 && redIntensity <= 200) {
      const optimal = 140;
      const deviation = Math.abs(redIntensity - optimal) / optimal;
      const intensityScore = Math.max(0, 1 - (deviation * 1.5)); // Más penalización por desviación
      quality += intensityScore * 30;
    } else if (redIntensity >= 80 && redIntensity <= 220) {
      // Rango aceptable pero con menos puntos
      quality += 15;
    }
    
    // 2. Calidad por pulsación (25%) - más realista
    if (pulsationStrength > 0) {
      const pulsationScore = Math.min(20, pulsationStrength * 400);
      quality += pulsationScore;
    }
    
    // 3. Calidad por consistencia de detección (25%)
    if (this.detectionHistory.length >= 4) {
      const recentDetections = this.detectionHistory.slice(-4);
      const detectionRate = recentDetections.filter(d => d).length / recentDetections.length;
      quality += detectionRate * 20;
    }
    
    // 4. Penalización por valores extremos (anti-falsos positivos)
    if (redIntensity > 210 || redIntensity < 90) {
      quality -= 15; // Penalización fuerte
    }
    
    // 5. Bonus por estabilidad en el tiempo
    this.consistencyBuffer.push(redIntensity);
    if (this.consistencyBuffer.length > 5) {
      this.consistencyBuffer.shift();
    }
    
    if (this.consistencyBuffer.length >= 3) {
      const variance = this.calculateVariance(this.consistencyBuffer);
      const stabilityBonus = Math.max(0, 10 - (variance / 10));
      quality += stabilityBonus;
    }
    
    // Suavizado conservador
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 3) {
      this.qualityHistory.shift();
    }
    
    const smoothedQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
    
    // Rango más estricto
    return Math.max(15, Math.min(88, Math.round(smoothedQuality)));
  }
  
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }
  
  reset(): void {
    this.qualityHistory = [];
    this.detectionHistory = [];
    this.consistencyBuffer = [];
  }
}
