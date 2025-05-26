/**
 * Detector adaptativo con lógica específica para dedo humano
 * Enfocado en características biológicas reales del dedo
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 8;
  private readonly CONFIDENCE_THRESHOLD = 0.70; // Más estricto para evitar falsos positivos
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 80, max: 160 }; // Rango específico para dedo
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 4; // Más conservador
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 3;
  private stabilityHistory: number[] = [];
  private signalConsistencyHistory: number[] = [];
  private lastValidSignal = 0;
  private readonly MIN_SIGNAL_STRENGTH = 70; // Más específico para dedo
  private readonly MAX_SIGNAL_STRENGTH = 180; // Evitar luz directa
  private framesSinceBaseline = 0;
  private readonly BASELINE_RECALIBRATION_FRAMES = 60;
  
  // Parámetros específicos para características biológicas del dedo
  private readonly BIOLOGICAL_RED_MIN = 85; // Hemoglobina mínima visible
  private readonly BIOLOGICAL_RED_MAX = 165; // Evitar saturación por luz directa
  private readonly RED_TO_GREEN_RATIO_MIN = 1.15; // Dedo tiene más rojo que verde
  private readonly RED_TO_GREEN_RATIO_MAX = 2.0; // Pero no demasiado
  private readonly MIN_TEXTURE_FOR_BIOLOGICAL = 0.20; // Textura mínima para tejido
  private readonly MIN_STABILITY_FOR_BIOLOGICAL = 0.35; // Estabilidad mínima
  private readonly MAX_BRIGHTNESS_VARIATION = 0.25; // Evitar luz directa variable
  
  /**
   * Detección específica para dedo humano con validación biológica estricta
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
    
    // 1. VALIDACIÓN BIOLÓGICA ESTRICTA PRIMERA
    if (!this.isBiologicallyValidFinger(redValue, avgGreen, avgBlue, rToGRatio, rToBRatio)) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { 
        detected: false, 
        confidence: 0, 
        reasons: ['not_biological_finger'] 
      };
    }
    
    // 2. RECHAZAR LUZ DIRECTA O FUENTES BRILLANTES
    if (this.isDirectLightSource(redValue, avgGreen, avgBlue, stability)) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { 
        detected: false, 
        confidence: 0, 
        reasons: ['direct_light_source_detected'] 
      };
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 3. TEST DE HEMOGLOBINA (canal rojo específico para sangre)
    const hemoglobinScore = this.evaluateHemoglobinSignature(redValue, avgGreen);
    if (hemoglobinScore > 0.6) {
      score += hemoglobinScore * 0.35;
      reasons.push('hemoglobin_signature_detected');
    } else {
      return { detected: false, confidence: 0, reasons: ['insufficient_hemoglobin'] };
    }
    
    // 4. TEST DE TEXTURA BIOLÓGICA OBLIGATORIO
    if (textureScore >= this.MIN_TEXTURE_FOR_BIOLOGICAL) {
      score += Math.min(0.25, textureScore * 1.2);
      reasons.push('biological_texture_present');
    } else {
      // Sin textura biológica = no es dedo
      return { detected: false, confidence: 0, reasons: ['no_biological_texture'] };
    }
    
    // 5. TEST DE ESTABILIDAD TEMPORAL OBLIGATORIO
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 6) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= this.MIN_STABILITY_FOR_BIOLOGICAL) {
      score += Math.min(0.2, avgStability * 0.6);
      reasons.push('stable_biological_signal');
    } else {
      return { detected: false, confidence: 0, reasons: ['unstable_signal'] };
    }
    
    // 6. TEST DE PERFUSIÓN (variación controlada típica del flujo sanguíneo)
    this.signalConsistencyHistory.push(redValue);
    if (this.signalConsistencyHistory.length > 8) {
      this.signalConsistencyHistory.shift();
    }
    
    if (this.signalConsistencyHistory.length >= 6) {
      const perfusionScore = this.evaluatePerfusionPattern();
      if (perfusionScore > 0.3) {
        score += perfusionScore * 0.2;
        reasons.push('perfusion_pattern_detected');
      }
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // 7. APLICAR LÓGICA DE DETECCIONES CONSECUTIVAS ESTRICTA
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      this.lastValidSignal = redValue;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // 8. DECISIÓN FINAL CON HISTERESIS ESTRICTA
    const finalDetected = this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Detección específica para dedo humano", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.5,
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: this.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      avgStability,
      hemoglobinScore,
      score,
      threshold: this.CONFIDENCE_THRESHOLD
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.5,
      reasons
    };
  }
  
  /**
   * Validación biológica estricta para dedo humano
   */
  private isBiologicallyValidFinger(red: number, green: number, blue: number, rToG: number, rToB: number): boolean {
    // Rango específico para hemoglobina en dedo
    const redInRange = red >= this.BIOLOGICAL_RED_MIN && red <= this.BIOLOGICAL_RED_MAX;
    
    // Verde debe estar presente pero menor que rojo (característica de hemoglobina)
    const greenInRange = green >= 25 && green <= 140;
    
    // Azul debe estar presente pero menor (característica de tejido vascularizado)
    const blueInRange = blue >= 15 && blue <= 120;
    
    // Ratio específico para hemoglobina
    const validRedGreenRatio = rToG >= this.RED_TO_GREEN_RATIO_MIN && rToG <= this.RED_TO_GREEN_RATIO_MAX;
    
    // Ratio rojo/azul para tejido
    const validRedBlueRatio = rToB >= 1.2 && rToB <= 2.5;
    
    return redInRange && greenInRange && blueInRange && validRedGreenRatio && validRedBlueRatio;
  }
  
  /**
   * Detectar fuentes de luz directa (no dedo)
   */
  private isDirectLightSource(red: number, green: number, blue: number, stability: number): boolean {
    // Luz directa tiende a ser muy brillante y balanceada
    const toobrRight = red > 200 || green > 180 || blue > 160;
    
    // Luz directa tiende a tener ratios balanceados (no como hemoglobina)
    const tooBalanced = Math.abs(red - green) < 15 && Math.abs(red - blue) < 25;
    
    // Luz directa es muy estable (demasiado para ser biológica)
    const tooStable = stability > 0.95;
    
    // Variación de brillo típica de luz artificial
    const artificialPattern = red > 180 && green > 150 && blue > 130 && stability > 0.8;
    
    return toobrRight || (tooBalanced && tooStable) || artificialPattern;
  }
  
  /**
   * Evaluar firma específica de hemoglobina
   */
  private evaluateHemoglobinSignature(redValue: number, greenValue: number): number {
    // La hemoglobina absorbe más verde que rojo, creando un patrón específico
    if (redValue < this.BIOLOGICAL_RED_MIN || redValue > this.BIOLOGICAL_RED_MAX) {
      return 0;
    }
    
    // Ratio típico de hemoglobina oxigenada
    const redGreenRatio = greenValue > 0 ? redValue / greenValue : 0;
    
    if (redGreenRatio >= 1.2 && redGreenRatio <= 1.8) {
      // Ratio óptimo para hemoglobina
      const centerRatio = 1.5;
      const distance = Math.abs(redGreenRatio - centerRatio);
      return Math.max(0, 1.0 - (distance / 0.3));
    }
    
    return 0;
  }
  
  /**
   * Evaluar patrón de perfusión típico del flujo sanguíneo
   */
  private evaluatePerfusionPattern(): number {
    if (this.signalConsistencyHistory.length < 6) return 0;
    
    const recent = this.signalConsistencyHistory.slice(-6);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variations = recent.map(v => Math.abs(v - avg));
    const maxVariation = Math.max(...variations);
    const avgVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
    
    // Perfusión tiene variación controlada (no demasiado estable, no demasiado caótica)
    const variationRatio = avgVariation / avg;
    
    if (variationRatio >= 0.02 && variationRatio <= 0.15) {
      // Variación típica de perfusión
      if (maxVariation / avg <= this.MAX_BRIGHTNESS_VARIATION) {
        return Math.min(1.0, 1.0 - Math.abs(variationRatio - 0.08) / 0.07);
      }
    }
    
    return 0;
  }
  
  /**
   * Adaptación más estricta de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 6) return;
    
    const validValues = recentValues.filter(v => 
      v >= this.BIOLOGICAL_RED_MIN && v <= this.BIOLOGICAL_RED_MAX
    );
    
    if (validValues.length < 4) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales manteniendo rango biológico
    this.adaptiveThresholds.min = Math.max(this.BIOLOGICAL_RED_MIN, avg - stdDev * 0.8);
    this.adaptiveThresholds.max = Math.min(this.BIOLOGICAL_RED_MAX, avg + stdDev * 0.8);
    
    console.log("AdaptiveDetector: Umbrales biológicos ajustados:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { min: 80, max: 160 };
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
    this.signalConsistencyHistory = [];
    this.lastValidSignal = 0;
    this.framesSinceBaseline = 0;
  }
}
