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
    if (this.detectionHistory.length > 10) { // Aumentar ventana de historial
      this.detectionHistory.shift();
    }

    // Si no hay dedo detectado, la calidad es inherentemente baja
    if (!isDetected) {
      // Calidad base baja, suavizada con el historial para evitar saltos bruscos
      const currentAvgQuality = this.qualityHistory.length > 0 ? 
        this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length : 0;
      const newQuality = Math.max(10, currentAvgQuality * 0.7 + 20 * 0.3); // Suavizado y base baja
      this.qualityHistory.push(newQuality);
      return Math.round(newQuality);
    }

    let currentQuality = 0; // Puntuación inicial para este cálculo

    // Pesos para cada criterio de calidad
    const WEIGHT_RED_INTENSITY = 0.35;
    const WEIGHT_PULSATION_STRENGTH = 0.30;
    const WEIGHT_DETECTION_CONSISTENCY = 0.20;
    const WEIGHT_SIGNAL_STABILITY = 0.15; // Nuevo peso para estabilidad

    // 1. Calidad por intensidad roja (35% del peso)
    if (redIntensity >= 90 && redIntensity <= 180) {
      // Rango óptimo: máxima contribución
      currentQuality += WEIGHT_RED_INTENSITY;
    } else if (redIntensity >= 60 && redIntensity <= 220) {
      // Rango aceptable: contribución media
      currentQuality += WEIGHT_RED_INTENSITY * 0.6;
    } else {
      // Fuera de rango: contribución baja
      currentQuality += WEIGHT_RED_INTENSITY * 0.2; 
    }

    // 2. Calidad por pulsación (30% del peso)
    if (pulsationStrength > 0.05) {
      // Pulsación fuerte y clara
      const cappedPulsation = Math.min(0.2, pulsationStrength); // Limitar la pulsación para escala
      currentQuality += WEIGHT_PULSATION_STRENGTH * (cappedPulsation / 0.2); // Escalar al 100%
    } else if (pulsationStrength > 0.01) {
      // Pulsación débil pero detectable
      currentQuality += WEIGHT_PULSATION_STRENGTH * 0.3;
    } else {
      // Pulsación muy débil o ausente
      currentQuality += WEIGHT_PULSATION_STRENGTH * 0.1;
    }

    // 3. Calidad por consistencia de detección (20% del peso)
    if (this.detectionHistory.length >= 5) {
      const recentDetections = this.detectionHistory.slice(-5);
      const detectionRate = recentDetections.filter(d => d).length / recentDetections.length;
      currentQuality += WEIGHT_DETECTION_CONSISTENCY * detectionRate;
    } else {
      // Si no hay suficiente historial, asumir una consistencia neutral
      currentQuality += WEIGHT_DETECTION_CONSISTENCY * 0.5;
    }

    // 4. Calidad por estabilidad de la señal (15% del peso)
    this.consistencyBuffer.push(redIntensity);
    if (this.consistencyBuffer.length > 10) {
      this.consistencyBuffer.shift();
    }
    
    let signalStabilityScore = 0;
    if (this.consistencyBuffer.length >= 5) {
      const variance = this.calculateVariance(this.consistencyBuffer);
      // Una varianza baja indica alta estabilidad
      if (variance < 100) { // Umbral de varianza ajustado para alta estabilidad
        signalStabilityScore = 1.0;
      } else if (variance < 500) {
        signalStabilityScore = 0.6;
      } else if (variance < 1000) {
        signalStabilityScore = 0.3;
      } else {
        signalStabilityScore = 0.1;
      }
    }
    currentQuality += WEIGHT_SIGNAL_STABILITY * signalStabilityScore;

    // Escalar la calidad total a 0-100
    let finalQuality = currentQuality * 100; 

    // Suavizado más profesional: Media ponderada con historial
    const smoothedQuality = this.qualityHistory.length > 0 ? 
      this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length : 0;
    finalQuality = smoothedQuality * 0.5 + finalQuality * 0.5; // Ajustar peso de suavizado

    this.qualityHistory.push(finalQuality);
    if (this.qualityHistory.length > 15) { // Aumentar ventana de historial
      this.qualityHistory.shift();
    }
    
    // Asegurar que el valor esté dentro del rango 0-100
    return Math.max(0, Math.min(100, Math.round(finalQuality)));
  }
  
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
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
