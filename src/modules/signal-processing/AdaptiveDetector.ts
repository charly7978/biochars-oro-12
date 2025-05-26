
/**
 * Detector adaptativo con validación ESTRICTA para dedo humano real
 * Rechaza fuentes de luz, objetos y superficies artificiales
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 10;
  private readonly CONFIDENCE_THRESHOLD = 0.65; // MÁS ESTRICTO
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 80, max: 160 }; // Rango más estricto
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 4; // Requiere más confirmaciones
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 3;
  private stabilityHistory: number[] = [];
  private signalConsistencyHistory: number[] = [];
  private lastValidSignal = 0;
  private readonly MIN_SIGNAL_STRENGTH = 70; // Más estricto
  private readonly MAX_SIGNAL_STRENGTH = 170; // Más estricto
  private framesSinceBaseline = 0;
  private readonly BASELINE_RECALIBRATION_FRAMES = 60;
  
  // Parámetros MUCHO MÁS ESTRICTOS para dedo humano real
  private readonly BIOLOGICAL_RED_MIN = 85; // Más estricto
  private readonly BIOLOGICAL_RED_MAX = 165; // Más estricto
  private readonly RED_TO_GREEN_RATIO_MIN = 1.2; // Más estricto
  private readonly RED_TO_GREEN_RATIO_MAX = 2.0; // Más estricto
  private readonly MIN_TEXTURE_FOR_BIOLOGICAL = 0.25; // Más estricto
  private readonly MIN_STABILITY_FOR_BIOLOGICAL = 0.4; // Más estricto
  private readonly MAX_BRIGHTNESS_VARIATION = 0.25; // Más estricto
  
  /**
   * Detección ULTRA ESTRICTA para dedo humano - rechaza todo lo demás
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
    
    // 1. RECHAZAR FUENTES DE LUZ Y OBJETOS ARTIFICIALES PRIMERO
    if (this.isArtificialSource(redValue, avgGreen, avgBlue, stability, rToGRatio)) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { 
        detected: false, 
        confidence: 0, 
        reasons: ['artificial_source_rejected'] 
      };
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 2. VALIDACIÓN BIOLÓGICA ESTRICTA - TODOS LOS TESTS DEBEN PASAR
    
    // Test de rango rojo biológico
    if (redValue >= this.BIOLOGICAL_RED_MIN && redValue <= this.BIOLOGICAL_RED_MAX) {
      score += 0.2;
      reasons.push('red_range_biological');
    } else {
      return { detected: false, confidence: 0, reasons: ['red_not_biological'] };
    }
    
    // Test de ratio rojo/verde ESTRICTO (hemoglobina)
    if (rToGRatio >= this.RED_TO_GREEN_RATIO_MIN && rToGRatio <= this.RED_TO_GREEN_RATIO_MAX) {
      score += 0.25;
      reasons.push('hemoglobin_ratio_valid');
    } else {
      return { detected: false, confidence: 0, reasons: ['hemoglobin_ratio_invalid'] };
    }
    
    // Test de textura biológica OBLIGATORIO
    if (textureScore >= this.MIN_TEXTURE_FOR_BIOLOGICAL) {
      score += 0.2;
      reasons.push('biological_texture');
    } else {
      return { detected: false, confidence: 0, reasons: ['no_biological_texture'] };
    }
    
    // Test de estabilidad biológica
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 8) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= this.MIN_STABILITY_FOR_BIOLOGICAL) {
      score += 0.15;
      reasons.push('biological_stability');
    } else {
      return { detected: false, confidence: 0, reasons: ['unstable_signal'] };
    }
    
    // Test de perfusión biológica
    if (this.hasBiologicalPerfusion(redValue, avgGreen, avgBlue)) {
      score += 0.15;
      reasons.push('biological_perfusion');
    } else {
      return { detected: false, confidence: 0, reasons: ['no_biological_perfusion'] };
    }
    
    // Test de variabilidad natural
    if (this.hasNaturalVariability(redValue)) {
      score += 0.05;
      reasons.push('natural_variability');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // LÓGICA DE DETECCIONES CONSECUTIVAS MÁS ESTRICTA
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      this.lastValidSignal = redValue;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // DECISIÓN FINAL CON HISTERESIS ESTRICTA
    const finalDetected = this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Detección ESTRICTA para dedo real", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.5,
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: this.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      rToGRatio,
      avgStability,
      textureScore,
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
   * Detectar fuentes artificiales (luz, objetos, superficies)
   */
  private isArtificialSource(red: number, green: number, blue: number, stability: number, rToGRatio: number): boolean {
    // Luz directa: muy brillante y balanceada
    const isDirectLight = red > 170 && green > 150 && blue > 130;
    
    // Superficie artificial: demasiado balanceada (no como piel)
    const tooBalanced = Math.abs(red - green) < 15 && Math.abs(green - blue) < 15;
    
    // Estabilidad artificial: demasiado estable para ser biológica
    const unnaturallyStable = stability > 0.85 && red > 140;
    
    // Ratio no biológico: muy bajo o muy alto
    const nonBiologicalRatio = rToGRatio < 1.1 || rToGRatio > 2.2;
    
    // Objeto brillante: muy intenso sin características biológicas
    const brightObject = red > 180 && (tooBalanced || nonBiologicalRatio);
    
    // Superficie reflectante
    const reflectiveSurface = red > 160 && green > 140 && blue > 120 && stability > 0.8;
    
    return isDirectLight || brightObject || reflectiveSurface || 
           (unnaturallyStable && tooBalanced) || 
           (red > 150 && nonBiologicalRatio);
  }
  
  /**
   * Verificar perfusión biológica específica
   */
  private hasBiologicalPerfusion(red: number, green: number, blue: number): boolean {
    // Patrón típico de piel humana con circulación
    const skinTone = red > green && red > blue; // Piel tiene dominancia roja
    const moderateIntensity = red >= 80 && red <= 160; // Intensidad biológica
    const greenBalance = green >= 40 && green <= 110; // Verde en rango biológico
    const blueBalance = blue >= 25 && blue <= 90; // Azul en rango biológico
    
    // Verificar que no sea demasiado brillante (artificial)
    const notToobrright = !(red > 170 && green > 140 && blue > 120);
    
    return skinTone && moderateIntensity && greenBalance && blueBalance && notToobrright;
  }
  
  /**
   * Verificar variabilidad natural del pulso sanguíneo
   */
  private hasNaturalVariability(redValue: number): boolean {
    this.signalConsistencyHistory.push(redValue);
    if (this.signalConsistencyHistory.length > 10) {
      this.signalConsistencyHistory.shift();
    }
    
    if (this.signalConsistencyHistory.length < 6) return false;
    
    const recent = this.signalConsistencyHistory.slice(-6);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variations = recent.map(v => Math.abs(v - avg));
    const avgVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
    
    // Variabilidad natural: ni demasiado estable ni demasiado caótica
    const variationRatio = avgVariation / avg;
    return variationRatio >= 0.03 && variationRatio <= 0.12;
  }
  
  /**
   * Adaptación conservadora de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 8) return;
    
    const validValues = recentValues.filter(v => 
      v >= this.BIOLOGICAL_RED_MIN && v <= this.BIOLOGICAL_RED_MAX
    );
    
    if (validValues.length < 6) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma conservadora
    this.adaptiveThresholds.min = Math.max(this.BIOLOGICAL_RED_MIN, avg - stdDev * 0.6);
    this.adaptiveThresholds.max = Math.min(this.BIOLOGICAL_RED_MAX, avg + stdDev * 0.6);
    
    console.log("AdaptiveDetector: Umbrales conservadores ajustados:", this.adaptiveThresholds);
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
