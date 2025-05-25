
/**
 * Detector adaptativo multi-modal para detección de dedo
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 15;
  private readonly CONFIDENCE_THRESHOLD = 0.5; // Reducido para ser más sensible
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 60, max: 180 }; // Más permisivo
  
  /**
   * Detección multi-modal mejorada y más sensible
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
    
    // Establecer baseline dinámico más permisivo
    if (!this.baselineValues && redValue > 30) {
      this.baselineValues = {
        red: redValue,
        green: avgGreen,
        blue: avgBlue
      };
      
      // Ajustar umbrales adaptativos más permisivos
      this.adaptiveThresholds.min = Math.max(30, redValue * 0.5);
      this.adaptiveThresholds.max = Math.min(250, redValue * 2.2);
      
      console.log("AdaptiveDetector: Baseline establecido", {
        baseline: this.baselineValues,
        thresholds: this.adaptiveThresholds
      });
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Test de intensidad roja más permisivo
    if (redValue >= this.adaptiveThresholds.min && redValue <= this.adaptiveThresholds.max) {
      score += 0.3;
      reasons.push('red_intensity_ok');
      console.log("AdaptiveDetector: Intensidad roja OK", { redValue, thresholds: this.adaptiveThresholds });
    } else {
      console.log("AdaptiveDetector: Intensidad roja fuera de rango", { redValue, thresholds: this.adaptiveThresholds });
    }
    
    // 2. Test de ratios de color más permisivo
    if (rToGRatio >= 0.9 && rToGRatio <= 3.0 && rToBRatio >= 0.8 && rToBRatio <= 2.5) {
      score += 0.25;
      reasons.push('color_ratios_physiological');
      console.log("AdaptiveDetector: Ratios de color OK", { rToGRatio, rToBRatio });
    } else {
      console.log("AdaptiveDetector: Ratios de color fuera de rango", { rToGRatio, rToBRatio });
    }
    
    // 3. Test de presencia de señal (cualquier variación indica contacto)
    if (redValue > 25) {
      score += 0.2;
      reasons.push('signal_present');
      console.log("AdaptiveDetector: Señal presente");
    }
    
    // 4. Test de estabilidad más permisivo
    if (stability >= 0.1) {
      score += 0.15;
      reasons.push('stable_contact');
      console.log("AdaptiveDetector: Contacto estable", { stability });
    }
    
    // 5. Test de cambio relativo al baseline más permisivo
    if (this.baselineValues) {
      const redChange = Math.abs(redValue - this.baselineValues.red) / this.baselineValues.red;
      if (redChange >= 0.05 && redChange <= 1.5) {
        score += 0.1;
        reasons.push('appropriate_signal_change');
        console.log("AdaptiveDetector: Cambio de señal apropiado", { redChange });
      }
    }
    
    const confidence = Math.min(1.0, score);
    const detected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // Actualizar historial para suavizado temporal más agresivo
    this.detectionHistory.push(detected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Aplicar suavizado temporal más permisivo
    const recentDetections = this.detectionHistory.slice(-3); // Solo últimas 3 detecciones
    const recentConfidence = recentDetections.filter(d => d).length / recentDetections.length;
    
    const finalDetected = recentConfidence >= 0.33; // 33% de detecciones recientes
    
    console.log("AdaptiveDetector: Resultado final", {
      detected: finalDetected,
      confidence,
      reasons,
      recentConfidence,
      redValue,
      frameData
    });
    
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
