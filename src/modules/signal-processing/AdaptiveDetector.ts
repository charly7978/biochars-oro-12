
/**
 * Detector adaptativo multi-modal para detección de dedo
 * Versión mejorada con reducción de falsos positivos
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 20; // Aumentado para mayor estabilidad
  private readonly CONFIDENCE_THRESHOLD = 0.7; // Aumentado para ser más estricto
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 80, max: 180 };
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 5; // Requiere 5 detecciones consecutivas
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 3;
  private stabilityHistory: number[] = [];
  
  /**
   * Detección multi-modal mejorada con validación estricta
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
    
    // Validación de entrada más estricta
    if (redValue < 10 || redValue > 255 || 
        avgGreen < 5 || avgBlue < 5 ||
        rToGRatio < 0.1 || rToBRatio < 0.1) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { detected: false, confidence: 0, reasons: ['invalid_input_values'] };
    }
    
    // Establecer baseline con validación más estricta
    if (!this.baselineValues && this.isValidBaselineCandidate(redValue, avgGreen, avgBlue, stability)) {
      this.baselineValues = {
        red: redValue,
        green: avgGreen,
        blue: avgBlue
      };
      
      // Ajustar umbrales adaptativos de forma más conservadora
      this.adaptiveThresholds.min = Math.max(60, redValue * 0.7);
      this.adaptiveThresholds.max = Math.min(200, redValue * 1.8);
      
      console.log("AdaptiveDetector: Baseline establecido con validación estricta", {
        baseline: this.baselineValues,
        thresholds: this.adaptiveThresholds
      });
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Test de intensidad roja con validación estricta
    const redIntensityValid = redValue >= this.adaptiveThresholds.min && 
                             redValue <= this.adaptiveThresholds.max;
    if (redIntensityValid) {
      score += 0.25;
      reasons.push('red_intensity_valid');
    }
    
    // 2. Test de ratios de color con rangos fisiológicos estrictos
    const colorRatiosValid = rToGRatio >= 1.1 && rToGRatio <= 2.5 && 
                            rToBRatio >= 1.0 && rToBRatio <= 2.2;
    if (colorRatiosValid) {
      score += 0.25;
      reasons.push('color_ratios_physiological');
    }
    
    // 3. Test de estabilidad temporal más estricto
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 10) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= 0.3 && stability >= 0.2) {
      score += 0.2;
      reasons.push('stable_temporal_contact');
    }
    
    // 4. Test de cambio relativo al baseline más estricto
    if (this.baselineValues) {
      const redChange = Math.abs(redValue - this.baselineValues.red) / this.baselineValues.red;
      const greenChange = Math.abs(avgGreen - this.baselineValues.green) / this.baselineValues.green;
      
      // Debe haber cambio significativo pero no extremo
      if (redChange >= 0.1 && redChange <= 0.8 && 
          greenChange >= 0.05 && greenChange <= 0.6) {
        score += 0.15;
        reasons.push('appropriate_baseline_change');
      }
    }
    
    // 5. Test de textura (presencia de estructura biológica)
    if (textureScore >= 0.2) {
      score += 0.1;
      reasons.push('biological_texture_detected');
    }
    
    // 6. Test de consistencia de señal (no debe fluctuar demasiado)
    const signalConsistency = this.evaluateSignalConsistency(redValue);
    if (signalConsistency >= 0.7) {
      score += 0.05;
      reasons.push('consistent_signal_pattern');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // Aplicar filtro de detecciones consecutivas para reducir falsos positivos
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // Solo confirmar detección después de suficientes detecciones consecutivas
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
      stability: avgStability
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : 0,
      reasons
    };
  }
  
  /**
   * Validar si los valores pueden servir como baseline
   */
  private isValidBaselineCandidate(red: number, green: number, blue: number, stability: number): boolean {
    return red > 40 && red < 220 &&
           green > 20 && green < 200 &&
           blue > 15 && blue < 180 &&
           stability > 0.3;
  }
  
  /**
   * Evaluar consistencia de la señal
   */
  private evaluateSignalConsistency(currentValue: number): number {
    if (!this.baselineValues) return 0;
    
    const deviation = Math.abs(currentValue - this.baselineValues.red) / this.baselineValues.red;
    
    // Penalizar desviaciones extremas
    if (deviation > 1.0) return 0;
    if (deviation > 0.5) return 0.3;
    if (deviation > 0.3) return 0.6;
    
    return 1.0; // Señal muy consistente
  }
  
  /**
   * Adaptación dinámica de umbrales con validación
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 15) return; // Requiere más datos
    
    const validValues = recentValues.filter(v => v > 30 && v < 240);
    if (validValues.length < 10) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma más conservadora
    this.adaptiveThresholds.min = Math.max(50, avg - stdDev * 1.5);
    this.adaptiveThresholds.max = Math.min(220, avg + stdDev * 1.5);
    
    console.log("AdaptiveDetector: Umbrales adaptados conservadoramente:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { min: 80, max: 180 };
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
  }
}
