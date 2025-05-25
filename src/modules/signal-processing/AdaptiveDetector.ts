
/**
 * Detector adaptativo ultra-conservador para eliminación de falsos positivos
 * Implementa múltiples capas de validación estricta
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 20; // Aumentado para más robustez
  private readonly CONFIDENCE_THRESHOLD = 0.8; // Mucho más estricto (era 0.5)
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 80, max: 180 }; // Rango más estricto
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 8; // Mucho más estricto (era 2)
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 3;
  private stabilityHistory: number[] = [];
  private signalConsistencyHistory: number[] = [];
  private lastValidSignal = 0;
  private signalVariationCount = 0;
  private readonly MIN_SIGNAL_STRENGTH = 50; // Mínimo absoluto de señal
  
  /**
   * Detección ultra-conservadora con múltiples validaciones estrictas
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
    
    // 1. Validación de entrada ultra-estricta
    if (redValue < this.MIN_SIGNAL_STRENGTH || redValue > 240 || 
        avgGreen < 15 || avgBlue < 15 ||
        rToGRatio < 0.7 || rToBRatio < 0.7 ||
        rToGRatio > 2.0 || rToBRatio > 2.0) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { detected: false, confidence: 0, reasons: ['strict_input_validation_failed'] };
    }
    
    // 2. Establecer baseline con criterios ultra-estrictos
    if (!this.baselineValues && this.isUltraStrictBaselineCandidate(redValue, avgGreen, avgBlue, stability)) {
      this.baselineValues = {
        red: redValue,
        green: avgGreen,
        blue: avgBlue
      };
      
      // Umbrales mucho más estrictos
      this.adaptiveThresholds.min = Math.max(70, redValue * 0.8);
      this.adaptiveThresholds.max = Math.min(200, redValue * 1.3);
      
      console.log("AdaptiveDetector: Baseline ultra-estricto establecido", {
        baseline: this.baselineValues,
        thresholds: this.adaptiveThresholds
      });
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 3. Test de intensidad roja ultra-estricto
    const redIntensityValid = redValue >= this.adaptiveThresholds.min && 
                             redValue <= this.adaptiveThresholds.max;
    if (redIntensityValid) {
      score += 0.2; // Reducido el peso
      reasons.push('red_intensity_strict_valid');
    } else {
      // Penalización por estar fuera del rango
      this.consecutiveNonDetections++;
      return { detected: false, confidence: 0, reasons: ['red_intensity_out_of_range'] };
    }
    
    // 4. Test de ratios de color ultra-estrictos
    const strictColorRatiosValid = rToGRatio >= 1.0 && rToGRatio <= 1.8 && 
                                  rToBRatio >= 1.0 && rToBRatio <= 1.8;
    if (strictColorRatiosValid) {
      score += 0.25;
      reasons.push('strict_color_ratios_valid');
    } else {
      // Sin ratios válidos, rechazar inmediatamente
      this.consecutiveNonDetections++;
      return { detected: false, confidence: 0, reasons: ['strict_color_ratios_failed'] };
    }
    
    // 5. Test de estabilidad temporal ultra-estricto
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 15) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= 0.4 && stability >= 0.3) { // Umbrales mucho más altos
      score += 0.2;
      reasons.push('ultra_strict_stability');
    } else {
      // Sin estabilidad suficiente, penalizar fuertemente
      this.consecutiveNonDetections++;
      return { detected: false, confidence: 0, reasons: ['insufficient_stability'] };
    }
    
    // 6. Test de consistencia de señal (nuevo)
    this.signalConsistencyHistory.push(redValue);
    if (this.signalConsistencyHistory.length > 10) {
      this.signalConsistencyHistory.shift();
    }
    
    if (this.signalConsistencyHistory.length >= 5) {
      const recentSignals = this.signalConsistencyHistory.slice(-5);
      const avgSignal = recentSignals.reduce((a, b) => a + b, 0) / recentSignals.length;
      const maxDeviation = Math.max(...recentSignals.map(s => Math.abs(s - avgSignal)));
      const consistencyRatio = maxDeviation / avgSignal;
      
      if (consistencyRatio < 0.15) { // Muy consistente
        score += 0.15;
        reasons.push('signal_consistency_excellent');
      } else if (consistencyRatio > 0.3) {
        // Señal muy inconsistente, rechazar
        this.consecutiveNonDetections++;
        return { detected: false, confidence: 0, reasons: ['signal_too_inconsistent'] };
      }
    }
    
    // 7. Test de cambio gradual vs baseline (nuevo)
    if (this.baselineValues && this.lastValidSignal > 0) {
      const baselineChange = Math.abs(redValue - this.baselineValues.red) / this.baselineValues.red;
      const gradualChange = Math.abs(redValue - this.lastValidSignal) / this.lastValidSignal;
      
      // Rechazar cambios demasiado bruscos
      if (gradualChange > 0.2) {
        this.consecutiveNonDetections++;
        return { detected: false, confidence: 0, reasons: ['signal_change_too_abrupt'] };
      }
      
      if (baselineChange >= 0.05 && baselineChange <= 0.25) {
        score += 0.1;
        reasons.push('gradual_baseline_change');
      }
    }
    
    // 8. Test de textura estricto
    if (textureScore >= 0.3) { // Mucho más estricto
      score += 0.1;
      reasons.push('sufficient_texture');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // 9. Aplicar filtro de detecciones consecutivas ultra-estricto
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      this.lastValidSignal = redValue;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // 10. Confirmar detección solo después de muchas validaciones consecutivas
    const finalDetected = this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Resultado ultra-conservador", {
      detected: finalDetected,
      confidence,
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: this.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      avgStability,
      score
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : Math.max(0.05, confidence * 0.3),
      reasons
    };
  }
  
  /**
   * Validación ultra-estricta para baseline
   */
  private isUltraStrictBaselineCandidate(red: number, green: number, blue: number, stability: number): boolean {
    return red > 60 && red < 200 &&
           green > 20 && green < 180 &&
           blue > 15 && blue < 160 &&
           stability > 0.3 && // Mucho más estricto
           Math.abs(red - green) < 40 && // Diferencias de color razonables
           Math.abs(red - blue) < 50;
  }
  
  /**
   * Adaptación conservadora de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 15) return; // Requiere más datos
    
    const validValues = recentValues.filter(v => v > 50 && v < 220);
    if (validValues.length < 12) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma muy conservadora
    this.adaptiveThresholds.min = Math.max(70, avg - stdDev * 1.0);
    this.adaptiveThresholds.max = Math.min(200, avg + stdDev * 1.0);
    
    console.log("AdaptiveDetector: Umbrales adaptados conservadoramente:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { min: 80, max: 180 };
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
    this.signalConsistencyHistory = [];
    this.lastValidSignal = 0;
    this.signalVariationCount = 0;
  }
}
