/**
 * Detector adaptativo con lógica específica para dedo humano
 * Enfocado en características biológicas reales del dedo
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 8;
  private readonly CONFIDENCE_THRESHOLD = 0.45; // Más permisivo para dedos reales
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { min: 60, max: 180 }; // Rango ampliado
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 2; // Más rápido
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 4;
  private stabilityHistory: number[] = [];
  private signalConsistencyHistory: number[] = [];
  private lastValidSignal = 0;
  private readonly MIN_SIGNAL_STRENGTH = 50; // Más permisivo para dedos débiles
  private readonly MAX_SIGNAL_STRENGTH = 200; // Más permisivo
  private framesSinceBaseline = 0;
  private readonly BASELINE_RECALIBRATION_FRAMES = 60;
  
  // Parámetros ajustados para mejor detección de dedos reales
  private readonly BIOLOGICAL_RED_MIN = 70; // Más permisivo
  private readonly BIOLOGICAL_RED_MAX = 190; // Más permisivo
  private readonly RED_TO_GREEN_RATIO_MIN = 1.05; // Más permisivo
  private readonly RED_TO_GREEN_RATIO_MAX = 2.5; // Más permisivo
  private readonly MIN_TEXTURE_FOR_BIOLOGICAL = 0.15; // Más permisivo
  private readonly MIN_STABILITY_FOR_BIOLOGICAL = 0.25; // Más permisivo
  private readonly MAX_BRIGHTNESS_VARIATION = 0.35; // Más tolerante
  
  /**
   * Detección específica para dedo humano con validación biológica ajustada
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
    
    // 1. RECHAZAR LUZ DIRECTA PRIMERO (más estricto)
    if (this.isDirectLightSource(redValue, avgGreen, avgBlue, stability)) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { 
        detected: false, 
        confidence: 0, 
        reasons: ['direct_light_rejected'] 
      };
    }
    
    const reasons: string[] = [];
    let score = 0;
    
    // 2. VALIDACIÓN BÁSICA DE RANGO (más permisiva)
    if (redValue >= this.BIOLOGICAL_RED_MIN && redValue <= this.BIOLOGICAL_RED_MAX) {
      score += 0.3;
      reasons.push('red_range_valid');
    } else {
      return { detected: false, confidence: 0, reasons: ['red_out_of_range'] };
    }
    
    // 3. VALIDACIÓN DE RATIOS (más permisiva)
    if (rToGRatio >= this.RED_TO_GREEN_RATIO_MIN && rToGRatio <= this.RED_TO_GREEN_RATIO_MAX) {
      score += 0.25;
      reasons.push('ratio_valid');
    }
    
    // 4. TEST DE TEXTURA (más permisivo)
    if (textureScore >= this.MIN_TEXTURE_FOR_BIOLOGICAL) {
      score += 0.2;
      reasons.push('texture_present');
    }
    
    // 5. TEST DE ESTABILIDAD (más permisivo)
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 6) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (avgStability >= this.MIN_STABILITY_FOR_BIOLOGICAL) {
      score += 0.15;
      reasons.push('stable_signal');
    }
    
    // 6. BONUS POR CARACTERÍSTICAS BIOLÓGICAS
    if (this.hasBiologicalCharacteristics(redValue, avgGreen, avgBlue)) {
      score += 0.1;
      reasons.push('biological_characteristics');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= this.CONFIDENCE_THRESHOLD;
    
    // 7. APLICAR LÓGICA DE DETECCIONES CONSECUTIVAS
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      this.lastValidSignal = redValue;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // 8. DECISIÓN FINAL CON HISTERESIS
    const finalDetected = this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Detección ajustada para dedos reales", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.7,
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
      confidence: finalDetected ? confidence : confidence * 0.7,
      reasons
    };
  }
  
  /**
   * Detectar fuentes de luz directa (MÁS ESTRICTO)
   */
  private isDirectLightSource(red: number, green: number, blue: number, stability: number): boolean {
    // Luz directa: muy brillante y balanceada
    const veryBright = red > 180 && green > 160 && blue > 140;
    
    // Luz artificial: ratios muy balanceados (no como hemoglobina)
    const tooBalanced = Math.abs(red - green) < 20 && Math.abs(green - blue) < 20;
    
    // Luz directa: demasiado estable para ser biológica
    const unnaturallyStable = stability > 0.9 && red > 150;
    
    // Patrón de luz blanca/artificial
    const whiteLight = red > 170 && green > 150 && blue > 130 && tooBalanced;
    
    return veryBright || whiteLight || (unnaturallyStable && tooBalanced);
  }
  
  /**
   * Verificar características biológicas típicas
   */
  private hasBiologicalCharacteristics(red: number, green: number, blue: number): boolean {
    // Características típicas de piel humana
    const skinTone = red > green && red > blue; // La piel tiene más rojo
    const moderateIntensity = red >= 70 && red <= 160; // Intensidad moderada
    const greenPresence = green >= 30 && green <= 120; // Verde presente pero menor
    const bluePresence = blue >= 20 && blue <= 100; // Azul presente pero menor
    
    return skinTone && moderateIntensity && greenPresence && bluePresence;
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
    this.adaptiveThresholds = { min: 60, max: 180 };
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
    this.signalConsistencyHistory = [];
    this.lastValidSignal = 0;
    this.framesSinceBaseline = 0;
  }
}
