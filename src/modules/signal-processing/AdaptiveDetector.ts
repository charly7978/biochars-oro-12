
/**
 * Detector adaptativo con lógica humana firme para eliminación de falsos positivos
 * Implementa detección precisa distinguiendo claramente entre "dedo presente" y "sin dedo"
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 15;
  private readonly CONFIDENCE_THRESHOLD = 0.75; // Más estricto pero alcanzable
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 90, max: 170 };
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 5; // Firme pero no excesivo
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 2; // Rápida pérdida si no hay dedo
  private stabilityHistory: number[] = [];
  private signalConsistencyHistory: number[] = [];
  private lastValidSignal = 0;
  private readonly MIN_SIGNAL_STRENGTH = 60; // Mínimo claro para señal válida
  private readonly MAX_SIGNAL_STRENGTH = 220; // Máximo para evitar saturación
  private framesSinceBaseline = 0;
  private readonly BASELINE_RECALIBRATION_FRAMES = 100;
  
  // Nuevos parámetros para lógica humana firme
  private readonly PHYSIOLOGICAL_RED_MIN = 80; // Rojo mínimo fisiológico real
  private readonly PHYSIOLOGICAL_RED_MAX = 190; // Rojo máximo fisiológico real
  private readonly MIN_RED_TO_GREEN_RATIO = 1.1; // Ratio mínimo realista
  private readonly MAX_RED_TO_GREEN_RATIO = 2.2; // Ratio máximo realista
  private readonly MIN_TEXTURE_FOR_FINGER = 0.25; // Textura mínima para dedo real
  private readonly MIN_STABILITY_FOR_FINGER = 0.35; // Estabilidad mínima para dedo real
  
  /**
   * Detección con lógica humana firme - distingue claramente dedo vs no-dedo
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
    this.framesSinceBaseline++;
    
    // 1. VALIDACIÓN FISIOLÓGICA ESTRICTA - Si no pasa, definitivamente no hay dedo
    if (!this.isPhysiologicallyValid(redValue, avgGreen, avgBlue, rToGRatio, rToBRatio)) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { detected: false, confidence: 0, reasons: ['physiological_validation_failed'] };
    }
    
    // 2. ESTABLECER BASELINE CON CRITERIOS HUMANOS FIRMES
    if (!this.baselineValues || this.framesSinceBaseline > this.BASELINE_RECALIBRATION_FRAMES) {
      if (this.isValidBaselineCandidate(redValue, avgGreen, avgBlue, stability, textureScore)) {
        this.establishBaseline(redValue, avgGreen, avgBlue);
        this.framesSinceBaseline = 0;
      }
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 3. TEST DE INTENSIDAD ROJA CON LÓGICA HUMANA
    const redIntensityScore = this.evaluateRedIntensity(redValue);
    if (redIntensityScore > 0) {
      score += redIntensityScore * 0.3;
      reasons.push('red_intensity_valid');
    } else {
      // Sin intensidad roja válida, muy improbable que sea un dedo
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { detected: false, confidence: 0, reasons: ['red_intensity_insufficient'] };
    }
    
    // 4. TEST DE RATIOS DE COLOR FISIOLÓGICOS
    const colorRatioScore = this.evaluateColorRatios(rToGRatio, rToBRatio);
    if (colorRatioScore > 0) {
      score += colorRatioScore * 0.25;
      reasons.push('color_ratios_physiological');
    } else {
      // Ratios no fisiológicos = definitivamente no es un dedo
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { detected: false, confidence: 0, reasons: ['color_ratios_non_physiological'] };
    }
    
    // 5. TEST DE TEXTURA - Un dedo real debe tener cierta textura
    if (textureScore >= this.MIN_TEXTURE_FOR_FINGER) {
      score += Math.min(0.2, textureScore * 0.8);
      reasons.push('texture_indicates_finger');
    } else {
      // Sin textura suficiente, probablemente no hay dedo
      score *= 0.3; // Penalización severa pero no eliminatoria
      reasons.push('texture_insufficient');
    }
    
    // 6. TEST DE ESTABILIDAD TEMPORAL
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 10) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= this.MIN_STABILITY_FOR_FINGER) {
      score += Math.min(0.15, avgStability * 0.4);
      reasons.push('stability_good');
    } else {
      score *= 0.5; // Penalización por inestabilidad
      reasons.push('stability_poor');
    }
    
    // 7. TEST DE CONSISTENCIA DE SEÑAL
    this.signalConsistencyHistory.push(redValue);
    if (this.signalConsistencyHistory.length > 8) {
      this.signalConsistencyHistory.shift();
    }
    
    if (this.signalConsistencyHistory.length >= 5) {
      const consistencyScore = this.evaluateSignalConsistency();
      if (consistencyScore > 0) {
        score += consistencyScore * 0.1;
        reasons.push('signal_consistent');
      } else {
        score *= 0.6; // Señal inconsistente reduce confianza
        reasons.push('signal_inconsistent');
      }
    }
    
    // 8. BONUS POR BASELINE VÁLIDO
    if (this.baselineValues && this.isSignalMatchingBaseline(redValue)) {
      score += 0.1;
      reasons.push('baseline_match');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // 9. APLICAR LÓGICA DE DETECCIONES CONSECUTIVAS FIRME
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      this.lastValidSignal = redValue;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // 10. DECISIÓN FINAL CON LÓGICA HUMANA
    const finalDetected = this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Resultado con lógica humana firme", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : Math.max(0.05, confidence * 0.4),
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: this.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      avgStability,
      score
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : Math.max(0.05, confidence * 0.4),
      reasons
    };
  }
  
  /**
   * Validación fisiológica estricta - debe pasar para considerar que hay dedo
   */
  private isPhysiologicallyValid(red: number, green: number, blue: number, rToG: number, rToB: number): boolean {
    return red >= this.PHYSIOLOGICAL_RED_MIN && 
           red <= this.PHYSIOLOGICAL_RED_MAX &&
           green >= 20 && green <= 160 &&
           blue >= 15 && blue <= 140 &&
           rToG >= this.MIN_RED_TO_GREEN_RATIO &&
           rToG <= this.MAX_RED_TO_GREEN_RATIO &&
           rToB >= 1.0 && rToB <= 2.5;
  }
  
  /**
   * Evaluación de intensidad roja con criterios humanos
   */
  private evaluateRedIntensity(redValue: number): number {
    if (redValue < this.MIN_SIGNAL_STRENGTH || redValue > this.MAX_SIGNAL_STRENGTH) {
      return 0;
    }
    
    // Puntuación basada en qué tan bien está en el rango fisiológico
    if (redValue >= this.PHYSIOLOGICAL_RED_MIN && redValue <= this.PHYSIOLOGICAL_RED_MAX) {
      // Curva de puntuación óptima en el centro del rango
      const center = (this.PHYSIOLOGICAL_RED_MIN + this.PHYSIOLOGICAL_RED_MAX) / 2;
      const distance = Math.abs(redValue - center);
      const maxDistance = (this.PHYSIOLOGICAL_RED_MAX - this.PHYSIOLOGICAL_RED_MIN) / 2;
      return 1.0 - (distance / maxDistance) * 0.3; // Mínimo 0.7 en el rango
    }
    
    return 0.3; // Puntuación baja si está fuera del rango óptimo
  }
  
  /**
   * Evaluación de ratios de color fisiológicos
   */
  private evaluateColorRatios(rToG: number, rToB: number): number {
    let score = 0;
    
    // Evaluar ratio rojo/verde
    if (rToG >= this.MIN_RED_TO_GREEN_RATIO && rToG <= this.MAX_RED_TO_GREEN_RATIO) {
      // Puntuación óptima alrededor de 1.4-1.6
      if (rToG >= 1.3 && rToG <= 1.7) {
        score += 0.6;
      } else {
        score += 0.4;
      }
    }
    
    // Evaluar ratio rojo/azul
    if (rToB >= 1.0 && rToB <= 2.5) {
      if (rToB >= 1.2 && rToB <= 2.0) {
        score += 0.4;
      } else {
        score += 0.2;
      }
    }
    
    return Math.min(1.0, score);
  }
  
  /**
   * Evaluación de consistencia de señal
   */
  private evaluateSignalConsistency(): number {
    if (this.signalConsistencyHistory.length < 5) return 0;
    
    const recent = this.signalConsistencyHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const maxDev = Math.max(...recent.map(s => Math.abs(s - avg)));
    const consistencyRatio = maxDev / avg;
    
    if (consistencyRatio < 0.12) return 1.0; // Muy consistente
    if (consistencyRatio < 0.20) return 0.7; // Moderadamente consistente
    if (consistencyRatio < 0.30) return 0.4; // Poco consistente
    return 0; // Muy inconsistente
  }
  
  /**
   * Verificar si la señal actual coincide con el baseline establecido
   */
  private isSignalMatchingBaseline(redValue: number): boolean {
    if (!this.baselineValues) return false;
    
    const deviation = Math.abs(redValue - this.baselineValues.red) / this.baselineValues.red;
    return deviation <= 0.25; // 25% de tolerancia
  }
  
  /**
   * Candidato válido para baseline con criterios firmes
   */
  private isValidBaselineCandidate(red: number, green: number, blue: number, stability: number, texture: number): boolean {
    return this.isPhysiologicallyValid(red, green, blue, red/green, red/blue) &&
           stability >= 0.4 &&
           texture >= 0.2 &&
           red >= this.PHYSIOLOGICAL_RED_MIN + 10 && // Un poco más estricto para baseline
           red <= this.PHYSIOLOGICAL_RED_MAX - 10;
  }
  
  /**
   * Establecer baseline con los valores actuales
   */
  private establishBaseline(red: number, green: number, blue: number): void {
    this.baselineValues = { red, green, blue };
    
    // Umbrales adaptativos basados en el baseline
    this.adaptiveThresholds.min = Math.max(this.PHYSIOLOGICAL_RED_MIN, red * 0.75);
    this.adaptiveThresholds.max = Math.min(this.PHYSIOLOGICAL_RED_MAX, red * 1.35);
    
    console.log("AdaptiveDetector: Baseline firme establecido", {
      baseline: this.baselineValues,
      thresholds: this.adaptiveThresholds
    });
  }
  
  /**
   * Adaptación conservadora de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 10) return;
    
    const validValues = recentValues.filter(v => 
      v >= this.PHYSIOLOGICAL_RED_MIN && v <= this.PHYSIOLOGICAL_RED_MAX
    );
    
    if (validValues.length < 8) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma conservadora
    this.adaptiveThresholds.min = Math.max(this.PHYSIOLOGICAL_RED_MIN, avg - stdDev * 0.8);
    this.adaptiveThresholds.max = Math.min(this.PHYSIOLOGICAL_RED_MAX, avg + stdDev * 0.8);
    
    console.log("AdaptiveDetector: Umbrales adaptados:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { min: 90, max: 170 };
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
    this.signalConsistencyHistory = [];
    this.lastValidSignal = 0;
    this.framesSinceBaseline = 0;
  }
}
