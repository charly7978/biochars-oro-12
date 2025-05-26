
/**
 * CALCULADOR DE CALIDAD OPTIMIZADO
 * Agresivo con dedos reales, conservador con falsos positivos
 */

export class QualityCalculator {
  private qualityHistory: number[] = [];
  private detectionHistory: boolean[] = [];
  private consistencyBuffer: number[] = [];
  private falsePositiveCounter = 0;
  private humanFingerBonus = 0;
  
  calculateQuality(
    redIntensity: number,
    pulsationStrength: number,
    isDetected: boolean
  ): number {
    // Actualizar historial de detección
    this.detectionHistory.push(isDetected);
    if (this.detectionHistory.length > 8) {
      this.detectionHistory.shift();
    }
    
    if (!isDetected) {
      this.falsePositiveCounter++;
      const baseQuality = Math.max(8, 12 + Math.random() * 8);
      this.qualityHistory.push(baseQuality);
      return Math.round(baseQuality);
    }
    
    // Reset contador de falsos positivos al detectar
    this.falsePositiveCounter = 0;
    
    let quality = 45; // Base más alta para detecciones válidas
    
    // 1. CALIDAD POR INTENSIDAD OPTIMIZADA PARA HUMANOS (35%)
    if (redIntensity >= 85 && redIntensity <= 180) {
      const optimal = 125; // Valor óptimo para dedos humanos
      const deviation = Math.abs(redIntensity - optimal) / optimal;
      
      if (deviation <= 0.2) {
        // Rango perfecto para dedos humanos
        quality += 35;
        this.humanFingerBonus += 2;
      } else if (deviation <= 0.4) {
        // Rango bueno
        quality += 25;
        this.humanFingerBonus += 1;
      } else {
        // Rango aceptable
        quality += 15;
      }
    } else if (redIntensity >= 70 && redIntensity <= 200) {
      // Rango ampliado pero con menos puntos
      quality += 10;
    } else {
      // Penalización por valores fuera de rango humano
      quality -= 5;
    }
    
    // 2. CALIDAD POR PULSACIÓN MEJORADA (25%)
    if (pulsationStrength > 0) {
      const pulsationScore = Math.min(25, pulsationStrength * 600);
      quality += pulsationScore;
      
      // Bonus extra por pulsación fuerte (indica dedo real)
      if (pulsationStrength > 0.05) {
        quality += 10;
        this.humanFingerBonus += 1;
      }
    } else {
      // Penalización menor por falta de pulsación
      quality += 5;
    }
    
    // 3. CALIDAD POR CONSISTENCIA TEMPORAL (20%)
    if (this.detectionHistory.length >= 4) {
      const recentDetections = this.detectionHistory.slice(-4);
      const detectionRate = recentDetections.filter(d => d).length / recentDetections.length;
      
      if (detectionRate >= 0.75) {
        quality += 20;
        this.humanFingerBonus += 1;
      } else if (detectionRate >= 0.5) {
        quality += 12;
      } else {
        quality += 5;
      }
    }
    
    // 4. BONUS ACUMULATIVO POR DEDO HUMANO CONSISTENTE
    const maxBonus = Math.min(15, this.humanFingerBonus * 0.5);
    quality += maxBonus;
    
    // 5. ESTABILIDAD MEJORADA (15%)
    this.consistencyBuffer.push(redIntensity);
    if (this.consistencyBuffer.length > 6) {
      this.consistencyBuffer.shift();
    }
    
    if (this.consistencyBuffer.length >= 4) {
      const variance = this.calculateVariance(this.consistencyBuffer);
      
      if (variance < 200) {
        // Muy estable - típico de dedo humano
        quality += 15;
        this.humanFingerBonus += 1;
      } else if (variance < 500) {
        // Moderadamente estable
        quality += 10;
      } else {
        // Inestable - posible falso positivo
        quality += 2;
      }
    }
    
    // 6. PENALIZACIONES POR FALSOS POSITIVOS
    if (this.falsePositiveCounter > 5) {
      quality -= 10; // Penalización por muchos falsos positivos recientes
    }
    
    // Penalización por valores extremos (típicos de objetos no-dedo)
    if (redIntensity > 200 || redIntensity < 60) {
      quality -= 20;
    }
    
    // 7. SUAVIZADO TEMPORAL CONSERVADOR
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 3) {
      this.qualityHistory.shift();
    }
    
    let smoothedQuality;
    if (this.qualityHistory.length >= 2) {
      // Peso mayor a valores recientes
      const weights = [0.6, 0.4];
      smoothedQuality = this.qualityHistory.slice(-2).reduce((acc, val, idx) => 
        acc + (val * weights[idx]), 0);
    } else {
      smoothedQuality = quality;
    }
    
    // Decay del bonus humano para evitar acumulación infinita
    if (this.humanFingerBonus > 0 && Math.random() < 0.1) {
      this.humanFingerBonus = Math.max(0, this.humanFingerBonus - 1);
    }
    
    // Rango final optimizado
    return Math.max(20, Math.min(95, Math.round(smoothedQuality)));
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
    this.falsePositiveCounter = 0;
    this.humanFingerBonus = 0;
  }
}
