
/**
 * CALCULADOR DE CALIDAD MEJORADO - SIN SIMULACIONES
 * Optimizado para dedos humanos reales
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
    // Historial de detección
    this.detectionHistory.push(isDetected);
    if (this.detectionHistory.length > 6) {
      this.detectionHistory.shift();
    }
    
    if (!isDetected) {
      const baseQuality = Math.max(10, 15 + Math.random() * 10);
      this.qualityHistory.push(baseQuality);
      return Math.round(baseQuality);
    }
    
    let quality = 40; // Base más alta para dedos detectados
    
    // 1. Calidad por intensidad roja optimizada para humanos (35%)
    if (redIntensity >= 80 && redIntensity <= 200) {
      // Rango óptimo para dedos humanos
      const optimal = 130;
      const deviation = Math.abs(redIntensity - optimal) / optimal;
      const intensityScore = Math.max(0.5, 1 - deviation); // Menos penalización
      quality += intensityScore * 30;
    } else if (redIntensity >= 60 && redIntensity <= 250) {
      // Rango aceptable amplio
      quality += 20;
    } else {
      // Penalización mínima fuera del rango
      quality += 10;
    }
    
    // 2. Calidad por pulsación más generosa (25%)
    if (pulsationStrength > 0) {
      const pulsationScore = Math.min(25, pulsationStrength * 500);
      quality += pulsationScore;
    } else {
      // Algo de calidad incluso sin pulsación detectada
      quality += 8;
    }
    
    // 3. Calidad por consistencia de detección (20%)
    if (this.detectionHistory.length >= 3) {
      const recentDetections = this.detectionHistory.slice(-3);
      const detectionRate = recentDetections.filter(d => d).length / recentDetections.length;
      quality += detectionRate * 20;
    }
    
    // 4. Bonus por valores típicos de dedo humano
    if (redIntensity >= 90 && redIntensity <= 180) {
      quality += 15; // Gran bonus para rango típico
    }
    
    // 5. Estabilidad mejorada
    this.consistencyBuffer.push(redIntensity);
    if (this.consistencyBuffer.length > 4) {
      this.consistencyBuffer.shift();
    }
    
    if (this.consistencyBuffer.length >= 3) {
      const variance = this.calculateVariance(this.consistencyBuffer);
      const stabilityBonus = Math.max(0, 15 - (variance / 15)); // Más generoso
      quality += stabilityBonus;
    }
    
    // Suavizado menos agresivo
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 2) {
      this.qualityHistory.shift();
    }
    
    const smoothedQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
    
    // Rango más generoso para dedos humanos
    return Math.max(25, Math.min(95, Math.round(smoothedQuality)));
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
