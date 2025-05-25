
/**
 * Detector adaptativo multi-modal para detección de dedo
 * Versión optimizada para mayor sensibilidad
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 15; // Reducido para respuesta más rápida
  private readonly CONFIDENCE_THRESHOLD = 0.5; // Reducido de 0.7 a 0.5 para mayor sensibilidad
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 60, max: 200 }; // Rango más amplio
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 2; // Reducido de 5 a 2
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 5;
  private stabilityHistory: number[] = [];
  
  /**
   * Detección multi-modal mejorada con mayor sensibilidad
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
    
    // Validación de entrada más permisiva
    if (redValue < 5 || redValue > 255 || 
        avgGreen < 2 || avgBlue < 2 ||
        rToGRatio < 0.05 || rToBRatio < 0.05) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { detected: false, confidence: 0, reasons: ['invalid_input_values'] };
    }
    
    // Establecer baseline con criterios más flexibles
    if (!this.baselineValues && this.isValidBaselineCandidate(redValue, avgGreen, avgBlue, stability)) {
      this.baselineValues = {
        red: redValue,
        green: avgGreen,
        blue: avgBlue
      };
      
      // Ajustar umbrales adaptativos de forma más flexible
      this.adaptiveThresholds.min = Math.max(30, redValue * 0.5); // Más permisivo
      this.adaptiveThresholds.max = Math.min(240, redValue * 2.2); // Rango más amplio
      
      console.log("AdaptiveDetector: Baseline establecido con criterios flexibles", {
        baseline: this.baselineValues,
        thresholds: this.adaptiveThresholds
      });
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Test de intensidad roja más permisivo
    const redIntensityValid = redValue >= this.adaptiveThresholds.min && 
                             redValue <= this.adaptiveThresholds.max;
    if (redIntensityValid) {
      score += 0.3; // Incrementado de 0.25 a 0.3
      reasons.push('red_intensity_valid');
    }
    
    // Test adicional: detección básica de cambio de intensidad
    if (redValue > 25) { // Umbral muy bajo para detectar cualquier presencia
      score += 0.2;
      reasons.push('basic_intensity_detected');
    }
    
    // 2. Test de ratios de color con rangos más amplios
    const colorRatiosValid = rToGRatio >= 0.8 && rToGRatio <= 3.0 && // Más permisivo
                            rToBRatio >= 0.7 && rToBRatio <= 2.8;
    if (colorRatiosValid) {
      score += 0.25;
      reasons.push('color_ratios_physiological');
    }
    
    // 3. Test de estabilidad temporal más flexible
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 8) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= 0.15 || stability >= 0.1) { // Umbrales más bajos
      score += 0.15;
      reasons.push('minimal_temporal_stability');
    }
    
    // 4. Test de cambio relativo al baseline más permisivo
    if (this.baselineValues) {
      const redChange = Math.abs(redValue - this.baselineValues.red) / this.baselineValues.red;
      const greenChange = Math.abs(avgGreen - this.baselineValues.green) / this.baselineValues.green;
      
      // Cualquier cambio significativo es válido
      if (redChange >= 0.05 || greenChange >= 0.03) { // Umbrales muy bajos
        score += 0.1;
        reasons.push('baseline_change_detected');
      }
    }
    
    // 5. Test de textura más permisivo
    if (textureScore >= 0.1) { // Reducido de 0.2 a 0.1
      score += 0.1;
      reasons.push('texture_detected');
    }
    
    // 6. Bonus por valores altos de rojo (probable dedo)
    if (redValue > 50) {
      score += 0.15;
      reasons.push('strong_red_signal');
    }
    
    // 7. Detección de patrón de contacto (cualquier variación)
    const signalVariation = this.evaluateSignalVariation(redValue);
    if (signalVariation >= 0.3) {
      score += 0.1;
      reasons.push('signal_variation_detected');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // Aplicar filtro de detecciones consecutivas más permisivo
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // Confirmar detección con menos requisitos
    const finalDetected = this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Resultado de detección mejorado", {
      detected: finalDetected,
      confidence,
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: this.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      score
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : Math.max(0.1, confidence * 0.5), // Mantener algo de confianza
      reasons
    };
  }
  
  /**
   * Validar si los valores pueden servir como baseline - más permisivo
   */
  private isValidBaselineCandidate(red: number, green: number, blue: number, stability: number): boolean {
    return red > 15 && red < 240 && // Rango más amplio
           green > 10 && green < 220 &&
           blue > 8 && blue < 200 &&
           stability > 0.05; // Mucho más permisivo
  }
  
  /**
   * Evaluar variación de la señal para detectar contacto
   */
  private evaluateSignalVariation(currentValue: number): number {
    if (!this.baselineValues) return 0.5; // Asumir variación si no hay baseline
    
    const deviation = Math.abs(currentValue - this.baselineValues.red);
    
    // Cualquier variación es buena señal de contacto
    if (deviation > 5) return 1.0;
    if (deviation > 2) return 0.7;
    if (deviation > 1) return 0.5;
    
    return 0.3;
  }
  
  /**
   * Adaptación dinámica de umbrales más agresiva
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 8) return; // Requiere menos datos
    
    const validValues = recentValues.filter(v => v > 10 && v < 250); // Rango más amplio
    if (validValues.length < 5) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma más agresiva para detectar
    this.adaptiveThresholds.min = Math.max(20, avg - stdDev * 2.0); // Más amplio
    this.adaptiveThresholds.max = Math.min(240, avg + stdDev * 2.0);
    
    console.log("AdaptiveDetector: Umbrales adaptados agresivamente:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { min: 60, max: 200 };
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
  }
}
