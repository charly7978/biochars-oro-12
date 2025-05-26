/**
 * Detector adaptativo con lógica humana firme para eliminación de falsos positivos
 * Implementa detección precisa distinguiendo claramente entre "dedo presente" y "sin dedo"
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 10;
  private readonly CONFIDENCE_THRESHOLD = 0.55; // Reducido para ser más sensible (era 0.75)
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 70, max: 180 }; // Rango más amplio
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 3; // Reducido (era 5)
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 4; // Aumentado para mantener detección
  private stabilityHistory: number[] = [];
  private signalConsistencyHistory: number[] = [];
  private lastValidSignal = 0;
  private readonly MIN_SIGNAL_STRENGTH = 45; // Reducido para mayor sensibilidad (era 60)
  private readonly MAX_SIGNAL_STRENGTH = 230; // Aumentado para mayor rango
  private framesSinceBaseline = 0;
  private readonly BASELINE_RECALIBRATION_FRAMES = 80; // Más frecuente
  
  // Parámetros más permisivos para lógica humana
  private readonly PHYSIOLOGICAL_RED_MIN = 60; // Reducido (era 80)
  private readonly PHYSIOLOGICAL_RED_MAX = 200; // Aumentado (era 190)
  private readonly MIN_RED_TO_GREEN_RATIO = 0.9; // Más permisivo (era 1.1)
  private readonly MAX_RED_TO_GREEN_RATIO = 2.5; // Más amplio (era 2.2)
  private readonly MIN_TEXTURE_FOR_FINGER = 0.15; // Más permisivo (era 0.25)
  private readonly MIN_STABILITY_FOR_FINGER = 0.25; // Más permisivo (era 0.35)
  
  /**
   * Detección con lógica humana firme pero más sensible
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
    
    // 1. VALIDACIÓN FISIOLÓGICA MÁS PERMISIVA
    if (!this.isPhysiologicallyValid(redValue, avgGreen, avgBlue, rToGRatio, rToBRatio)) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { detected: false, confidence: 0, reasons: ['physiological_validation_failed'] };
    }
    
    // 2. ESTABLECER BASELINE CON CRITERIOS MÁS AMPLIOS
    if (!this.baselineValues || this.framesSinceBaseline > this.BASELINE_RECALIBRATION_FRAMES) {
      if (this.isValidBaselineCandidate(redValue, avgGreen, avgBlue, stability, textureScore)) {
        this.establishBaseline(redValue, avgGreen, avgBlue);
        this.framesSinceBaseline = 0;
      }
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 3. TEST DE INTENSIDAD ROJA MÁS GENEROSO
    const redIntensityScore = this.evaluateRedIntensity(redValue);
    if (redIntensityScore > 0) {
      score += redIntensityScore * 0.35; // Incrementado peso
      reasons.push('red_intensity_valid');
    } else {
      // Dar una segunda oportunidad si está cerca del rango
      if (redValue >= 40 && redValue <= 240) {
        score += 0.15; // Puntuación parcial
        reasons.push('red_intensity_marginal');
      } else {
        this.consecutiveNonDetections++;
        this.consecutiveDetections = 0;
        return { detected: false, confidence: 0, reasons: ['red_intensity_insufficient'] };
      }
    }
    
    // 4. TEST DE RATIOS DE COLOR MÁS FLEXIBLE
    const colorRatioScore = this.evaluateColorRatios(rToGRatio, rToBRatio);
    if (colorRatioScore > 0) {
      score += colorRatioScore * 0.25;
      reasons.push('color_ratios_physiological');
    } else {
      // Más tolerante con ratios de color
      if (rToGRatio >= 0.7 && rToGRatio <= 3.0) {
        score += 0.1; // Puntuación parcial
        reasons.push('color_ratios_marginal');
      } else {
        score *= 0.7; // Penalización menor
        reasons.push('color_ratios_poor');
      }
    }
    
    // 5. TEST DE TEXTURA MÁS FLEXIBLE
    if (textureScore >= this.MIN_TEXTURE_FOR_FINGER) {
      score += Math.min(0.2, textureScore * 0.9);
      reasons.push('texture_indicates_finger');
    } else if (textureScore >= 0.08) {
      score += textureScore * 0.5; // Puntuación parcial para texturas bajas
      reasons.push('texture_low_but_acceptable');
    } else {
      score *= 0.6; // Penalización menor
      reasons.push('texture_insufficient');
    }
    
    // 6. TEST DE ESTABILIDAD TEMPORAL MÁS PERMISIVO
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 8) { // Ventana más pequeña
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= this.MIN_STABILITY_FOR_FINGER) {
      score += Math.min(0.15, avgStability * 0.5);
      reasons.push('stability_good');
    } else if (avgStability >= 0.15) {
      score += avgStability * 0.3; // Puntuación parcial
      reasons.push('stability_marginal');
    } else {
      score *= 0.7; // Penalización menor
      reasons.push('stability_poor');
    }
    
    // 7. TEST DE CONSISTENCIA DE SEÑAL MÁS GENEROSO
    this.signalConsistencyHistory.push(redValue);
    if (this.signalConsistencyHistory.length > 6) { // Ventana más pequeña
      this.signalConsistencyHistory.shift();
    }
    
    if (this.signalConsistencyHistory.length >= 4) {
      const consistencyScore = this.evaluateSignalConsistency();
      if (consistencyScore > 0) {
        score += consistencyScore * 0.15; // Incrementado peso
        reasons.push('signal_consistent');
      } else {
        score *= 0.8; // Penalización menor
        reasons.push('signal_inconsistent');
      }
    }
    
    // 8. BONUS POR BASELINE VÁLIDO MÁS GENEROSO
    if (this.baselineValues && this.isSignalMatchingBaseline(redValue)) {
      score += 0.15; // Incrementado bonus
      reasons.push('baseline_match');
    }
    
    // 9. BONUS POR VALORES EN RANGO ESPERADO
    if (redValue >= 70 && redValue <= 180) {
      score += 0.1;
      reasons.push('value_in_expected_range');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // 10. APLICAR LÓGICA DE DETECCIONES CONSECUTIVAS MÁS SENSIBLE
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      this.lastValidSignal = redValue;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // 11. DECISIÓN FINAL CON LÓGICA HUMANA MÁS SENSIBLE
    const finalDetected = this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Detección mejorada con mayor sensibilidad", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : Math.max(0.1, confidence * 0.6),
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: this.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      avgStability,
      score,
      threshold: this.CONFIDENCE_THRESHOLD
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : Math.max(0.1, confidence * 0.6),
      reasons
    };
  }
  
  /**
   * Validación fisiológica más permisiva
   */
  private isPhysiologicallyValid(red: number, green: number, blue: number, rToG: number, rToB: number): boolean {
    return red >= this.PHYSIOLOGICAL_RED_MIN && 
           red <= this.PHYSIOLOGICAL_RED_MAX &&
           green >= 15 && green <= 180 && // Más amplio
           blue >= 10 && blue <= 160 && // Más amplio
           rToG >= this.MIN_RED_TO_GREEN_RATIO &&
           rToG <= this.MAX_RED_TO_GREEN_RATIO &&
           rToB >= 0.8 && rToB <= 3.0; // Más amplio
  }
  
  /**
   * Evaluación de intensidad roja más generosa
   */
  private evaluateRedIntensity(redValue: number): number {
    if (redValue < this.MIN_SIGNAL_STRENGTH || redValue > this.MAX_SIGNAL_STRENGTH) {
      return 0;
    }
    
    // Puntuación más generosa
    if (redValue >= this.PHYSIOLOGICAL_RED_MIN && redValue <= this.PHYSIOLOGICAL_RED_MAX) {
      const center = (this.PHYSIOLOGICAL_RED_MIN + this.PHYSIOLOGICAL_RED_MAX) / 2;
      const distance = Math.abs(redValue - center);
      const maxDistance = (this.PHYSIOLOGICAL_RED_MAX - this.PHYSIOLOGICAL_RED_MIN) / 2;
      return 1.0 - (distance / maxDistance) * 0.2; // Mínimo 0.8 en el rango
    }
    
    return 0.5; // Puntuación media si está cerca del rango
  }
  
  /**
   * Evaluación de ratios de color más flexible
   */
  private evaluateColorRatios(rToG: number, rToB: number): number {
    let score = 0;
    
    // Evaluar ratio rojo/verde más permisivo
    if (rToG >= this.MIN_RED_TO_GREEN_RATIO && rToG <= this.MAX_RED_TO_GREEN_RATIO) {
      if (rToG >= 1.1 && rToG <= 2.0) {
        score += 0.6;
      } else {
        score += 0.4;
      }
    } else if (rToG >= 0.7 && rToG <= 3.0) {
      score += 0.2; // Puntuación parcial para ratios marginales
    }
    
    // Evaluar ratio rojo/azul más permisivo
    if (rToB >= 0.8 && rToB <= 3.0) {
      if (rToB >= 1.0 && rToB <= 2.5) {
        score += 0.4;
      } else {
        score += 0.2;
      }
    }
    
    return Math.min(1.0, score);
  }
  
  /**
   * Evaluación de consistencia de señal más permisiva
   */
  private evaluateSignalConsistency(): number {
    if (this.signalConsistencyHistory.length < 4) return 0; // Reducido
    
    const recent = this.signalConsistencyHistory.slice(-4);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const maxDev = Math.max(...recent.map(s => Math.abs(s - avg)));
    const consistencyRatio = maxDev / avg;
    
    if (consistencyRatio < 0.15) return 1.0; // Muy consistente
    if (consistencyRatio < 0.25) return 0.8; // Moderadamente consistente
    if (consistencyRatio < 0.35) return 0.5; // Poco consistente
    if (consistencyRatio < 0.45) return 0.2; // Muy inconsistente pero algo
    return 0; // Completamente inconsistente
  }
  
  /**
   * Verificar si la señal actual coincide con el baseline establecido
   */
  private isSignalMatchingBaseline(redValue: number): boolean {
    if (!this.baselineValues) return false;
    
    const deviation = Math.abs(redValue - this.baselineValues.red) / this.baselineValues.red;
    return deviation <= 0.35; // 35% de tolerancia (era 25%)
  }
  
  /**
   * Candidato válido para baseline con criterios más permisivos
   */
  private isValidBaselineCandidate(red: number, green: number, blue: number, stability: number, texture: number): boolean {
    return this.isPhysiologicallyValid(red, green, blue, red/green, red/blue) &&
           stability >= 0.25 && // Más permisivo (era 0.4)
           texture >= 0.12 && // Más permisivo (era 0.2)
           red >= this.PHYSIOLOGICAL_RED_MIN + 5 && // Menos estricto
           red <= this.PHYSIOLOGICAL_RED_MAX - 5;
  }
  
  /**
   * Establecer baseline con los valores actuales
   */
  private establishBaseline(red: number, green: number, blue: number): void {
    this.baselineValues = { red, green, blue };
    
    // Umbrales adaptativos basados en el baseline más amplios
    this.adaptiveThresholds.min = Math.max(this.PHYSIOLOGICAL_RED_MIN, red * 0.65); // Más amplio
    this.adaptiveThresholds.max = Math.min(this.PHYSIOLOGICAL_RED_MAX, red * 1.45); // Más amplio
    
    console.log("AdaptiveDetector: Baseline más permisivo establecido", {
      baseline: this.baselineValues,
      thresholds: this.adaptiveThresholds
    });
  }
  
  /**
   * Adaptación más permisiva de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 8) return; // Menos muestras requeridas
    
    const validValues = recentValues.filter(v => 
      v >= this.PHYSIOLOGICAL_RED_MIN && v <= this.PHYSIOLOGICAL_RED_MAX
    );
    
    if (validValues.length < 6) return; // Menos validaciones requeridas
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma más permisiva
    this.adaptiveThresholds.min = Math.max(this.PHYSIOLOGICAL_RED_MIN, avg - stdDev * 1.0); // Más amplio
    this.adaptiveThresholds.max = Math.min(this.PHYSIOLOGICAL_RED_MAX, avg + stdDev * 1.0); // Más amplio
    
    console.log("AdaptiveDetector: Umbrales adaptados más permisivos:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { min: 70, max: 180 }; // Rango más amplio
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
    this.signalConsistencyHistory = [];
    this.lastValidSignal = 0;
    this.framesSinceBaseline = 0;
  }
}
