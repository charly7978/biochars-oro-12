
/**
 * Detector adaptativo multi-modal para detección de dedo
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 20;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 80, max: 200 };
  
  /**
   * Detección multi-modal mejorada
   */
  public detectFingerMultiModal(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    textureScore: number;
    rToGRatio: number;
    rToBRatio: number;
    stability: number;
  }): { detected: boolean; confidence: number; reasons: string[] } {
    
    const { redValue, avgGreen, avgBlue, textureScore, rToGRatio, rToBRatio, stability } = frameData;
    
    // Establecer baseline si no existe
    if (!this.baselineValues && redValue > 50) {
      this.baselineValues = {
        red: redValue,
        green: avgGreen,
        blue: avgBlue
      };
      
      // Ajustar umbrales adaptativos
      this.adaptiveThresholds.min = Math.max(50, redValue * 0.7);
      this.adaptiveThresholds.max = Math.min(220, redValue * 1.8);
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Test de intensidad roja adaptativa
    if (redValue >= this.adaptiveThresholds.min && redValue <= this.adaptiveThresholds.max) {
      score += 0.25;
      reasons.push('red_intensity_ok');
    }
    
    // 2. Test de ratios de color biofísicos
    if (rToGRatio >= 1.1 && rToGRatio <= 2.5 && rToBRatio >= 0.9 && rToBRatio <= 2.0) {
      score += 0.25;
      reasons.push('color_ratios_physiological');
    }
    
    // 3. Test de textura (indica contacto físico)
    if (textureScore >= 0.1 && textureScore <= 0.7) {
      score += 0.2;
      reasons.push('texture_indicates_contact');
    }
    
    // 4. Test de estabilidad (indica dedo estático)
    if (stability >= 0.3) {
      score += 0.15;
      reasons.push('stable_contact');
    }
    
    // 5. Test de cambio relativo al baseline
    if (this.baselineValues) {
      const redChange = Math.abs(redValue - this.baselineValues.red) / this.baselineValues.red;
      if (redChange >= 0.1 && redChange <= 0.8) {
        score += 0.15;
        reasons.push('appropriate_signal_change');
      }
    }
    
    const confidence = Math.min(1.0, score);
    const detected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // Actualizar historial para suavizado temporal
    this.detectionHistory.push(detected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Aplicar suavizado temporal
    const recentDetections = this.detectionHistory.slice(-5);
    const recentConfidence = recentDetections.filter(d => d).length / recentDetections.length;
    
    const finalDetected = recentConfidence >= 0.6; // 60% de detecciones recientes
    
    return {
      detected: finalDetected,
      confidence: confidence,
      reasons
    };
  }
  
  /**
   * Adaptación dinámica de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 10) return;
    
    const avg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
    // Ajustar umbrales basado en estadísticas recientes
    this.adaptiveThresholds.min = Math.max(30, avg - stdDev * 2);
    this.adaptiveThresholds.max = Math.min(240, avg + stdDev * 2);
    
    console.log("AdaptiveDetector: Umbrales adaptados:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { min: 80, max: 200 };
  }
}
