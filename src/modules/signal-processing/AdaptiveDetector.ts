import { DETECTOR_CONFIG } from './DetectorConfig';
import { ArtificialSourceDetector } from './ArtificialSourceDetector';
import { BiologicalValidator } from './BiologicalValidator';
import { SignalVariabilityAnalyzer } from './SignalVariabilityAnalyzer';

/**
 * Detector adaptativo con validación SENSIBLE para dedo humano real
 * Rechaza fuentes de luz, objetos y superficies artificiales
 */
export class AdaptiveDetector {
  private detectionHistory: boolean[] = [];
  private baselineValues: { red: number; green: number; blue: number } | null = null;
  private adaptiveThresholds: { min: number; max: number } = { ...DETECTOR_CONFIG.DEFAULT_ADAPTIVE_THRESHOLDS };
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private stabilityHistory: number[] = [];
  private lastValidSignal = 0;
  private framesSinceBaseline = 0;
  
  // Component instances
  private artificialSourceDetector = new ArtificialSourceDetector();
  private biologicalValidator = new BiologicalValidator();
  private signalVariabilityAnalyzer = new SignalVariabilityAnalyzer();
  
  /**
   * Detección SENSIBLE para dedo humano - más permisiva pero rechaza artificiales
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
    if (this.artificialSourceDetector.isArtificialSource(redValue, avgGreen, avgBlue, stability, rToGRatio)) {
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
    
    // 2. VALIDACIÓN BIOLÓGICA MÁS PERMISIVA PARA DEDO HUMANO
    
    // Test de rango rojo biológico
    if (this.biologicalValidator.isInBiologicalRedRange(redValue)) {
      score += 0.25;
      reasons.push('red_range_biological');
    } else {
      // Ser más permisivo - no rechazar inmediatamente
      score += 0.1;
      reasons.push('red_range_marginal');
    }
    
    // Test de ratio rojo/verde PERMISIVO (hemoglobina)
    if (this.biologicalValidator.hasValidHemoglobinRatio(rToGRatio)) {
      score += 0.25;
      reasons.push('hemoglobin_ratio_valid');
    } else if (rToGRatio >= 0.9 && rToGRatio <= 2.8) {
      // Rango ampliado para casos límite
      score += 0.15;
      reasons.push('hemoglobin_ratio_marginal');
    }
    
    // Test de textura biológica PERMISIVO
    if (this.biologicalValidator.hasBiologicalTexture(textureScore)) {
      score += 0.2;
      reasons.push('biological_texture');
    } else if (textureScore >= 0.05) {
      // Más permisivo para textura
      score += 0.12;
      reasons.push('texture_marginal');
    }
    
    // Test de estabilidad biológica
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 8) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (this.biologicalValidator.hasBiologicalStability(avgStability)) {
      score += 0.15;
      reasons.push('biological_stability');
    } else if (avgStability >= 0.2) {
      // Más permisivo para estabilidad
      score += 0.08;
      reasons.push('stability_marginal');
    }
    
    // Test de perfusión biológica
    if (this.biologicalValidator.hasBiologicalPerfusion(redValue, avgGreen, avgBlue)) {
      score += 0.15;
      reasons.push('biological_perfusion');
    } else {
      // Ser más permisivo - dar puntuación parcial
      score += 0.05;
      reasons.push('perfusion_marginal');
    }
    
    // Bonus por valores en rango óptimo para dedo
    if (redValue >= 80 && redValue <= 150 && rToGRatio >= 1.2 && rToGRatio <= 2.0) {
      score += 0.1;
      reasons.push('optimal_finger_values');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= DETECTOR_CONFIG.CONFIDENCE_THRESHOLD;
    
    // LÓGICA DE DETECCIONES CONSECUTIVAS MÁS PERMISIVA
    if (rawDetected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      this.lastValidSignal = redValue;
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
    }
    
    // DECISIÓN FINAL CON HISTERESIS PERMISIVA
    const finalDetected = this.consecutiveDetections >= DETECTOR_CONFIG.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > DETECTOR_CONFIG.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Detección SENSIBLE para dedo humano", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.7,
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: DETECTOR_CONFIG.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      rToGRatio,
      avgStability,
      textureScore,
      score,
      threshold: DETECTOR_CONFIG.CONFIDENCE_THRESHOLD
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.7,
      reasons
    };
  }
  
  /**
   * Adaptación conservadora de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 8) return;
    
    const validValues = recentValues.filter(v => 
      v >= DETECTOR_CONFIG.BIOLOGICAL_RED_MIN && v <= DETECTOR_CONFIG.BIOLOGICAL_RED_MAX
    );
    
    if (validValues.length < 6) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma conservadora
    this.adaptiveThresholds.min = Math.max(DETECTOR_CONFIG.BIOLOGICAL_RED_MIN, avg - stdDev * 0.6);
    this.adaptiveThresholds.max = Math.min(DETECTOR_CONFIG.BIOLOGICAL_RED_MAX, avg + stdDev * 0.6);
    
    console.log("AdaptiveDetector: Umbrales conservadores ajustados:", this.adaptiveThresholds);
  }
  
  public reset(): void {
    this.detectionHistory = [];
    this.baselineValues = null;
    this.adaptiveThresholds = { ...DETECTOR_CONFIG.DEFAULT_ADAPTIVE_THRESHOLDS };
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.stabilityHistory = [];
    this.lastValidSignal = 0;
    this.framesSinceBaseline = 0;
    this.signalVariabilityAnalyzer.reset();
  }
}
