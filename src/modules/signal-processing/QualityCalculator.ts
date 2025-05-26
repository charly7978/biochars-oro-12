
/**
 * CALCULADOR DE CALIDAD MÉDICA MEJORADO - ELIMINA FALSOS POSITIVOS
 */

export class QualityCalculator {
  private qualityHistory: number[] = [];
  private stabilityBuffer: number[] = [];
  private detectionHistory: boolean[] = [];
  
  calculateQuality(
    redIntensity: number,
    pulsationStrength: number,
    isDetected: boolean
  ): number {
    // Almacenar historial de detección
    this.detectionHistory.push(isDetected);
    if (this.detectionHistory.length > 10) {
      this.detectionHistory.shift();
    }
    
    if (!isDetected) {
      // Calidad muy baja para no detección
      return Math.max(5, 10 + Math.random() * 5);
    }
    
    // Verificar consistencia de detección reciente
    const recentDetections = this.detectionHistory.slice(-5);
    const detectionRate = recentDetections.filter(d => d).length / recentDetections.length;
    
    // Si la detección no es consistente, reducir calidad drásticamente
    if (detectionRate < 0.6) {
      return Math.max(10, 15 + Math.random() * 10);
    }
    
    let quality = 15; // Base más baja para ser más estricto
    
    // 1. CALIDAD POR INTENSIDAD DE SEÑAL (35%)
    const optimalRed = 140;
    const redDeviation = Math.abs(redIntensity - optimalRed) / optimalRed;
    
    // Penalizar valores extremos más fuertemente
    let redScore = 0;
    if (redIntensity >= 70 && redIntensity <= 210) {
      redScore = Math.max(0, 25 * (1 - redDeviation * 1.5));
    } else {
      redScore = 5; // Muy bajo para valores extremos
    }
    quality += redScore;
    
    // 2. CALIDAD POR ESTABILIDAD (40%)
    this.stabilityBuffer.push(redIntensity);
    if (this.stabilityBuffer.length > 8) {
      this.stabilityBuffer.shift();
    }
    
    if (this.stabilityBuffer.length >= 5) {
      const mean = this.stabilityBuffer.reduce((a, b) => a + b, 0) / this.stabilityBuffer.length;
      const variance = this.stabilityBuffer.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.stabilityBuffer.length;
      const coeffVar = Math.sqrt(variance) / (mean + 1);
      
      // Penalizar fuertemente la inestabilidad
      const stability = Math.max(0, 30 * (1 - coeffVar * 3));
      quality += stability;
    } else {
      quality += 10; // Puntuación reducida durante la estabilización
    }
    
    // 3. CALIDAD POR PULSACIÓN (25%)
    const pulsationScore = Math.min(15, pulsationStrength * 300); // Reducido
    quality += pulsationScore;
    
    // 4. PENALIZACIONES ADICIONALES
    // Penalizar valores muy altos o muy bajos
    if (redIntensity < 60 || redIntensity > 220) {
      quality *= 0.4; // Penalización fuerte
    }
    
    // Penalizar pulsación muy débil
    if (pulsationStrength < 0.005) {
      quality *= 0.6;
    }
    
    // 5. FACTOR DE CONSISTENCIA TEMPORAL
    const consistencyFactor = this.calculateConsistencyFactor();
    quality *= consistencyFactor;
    
    // Suavizado temporal más conservador
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 3) {
      this.qualityHistory.shift();
    }
    
    const smoothedQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
    
    // Rango final más estricto: 10-80%
    return Math.max(10, Math.min(80, Math.round(smoothedQuality)));
  }
  
  private calculateConsistencyFactor(): number {
    if (this.qualityHistory.length < 3) return 0.7;
    
    // Verificar si las calidades recientes son consistentes
    const recent = this.qualityHistory.slice(-3);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const maxDiff = Math.max(...recent.map(q => Math.abs(q - mean)));
    
    // Si hay mucha variación en la calidad, penalizar
    if (maxDiff > 20) {
      return 0.5; // Penalización por inconsistencia
    } else if (maxDiff > 10) {
      return 0.7;
    } else {
      return 1.0; // Consistente
    }
  }
  
  reset(): void {
    this.qualityHistory = [];
    this.stabilityBuffer = [];
    this.detectionHistory = [];
  }
}
