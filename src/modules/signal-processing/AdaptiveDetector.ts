
import { DETECTOR_CONFIG } from './DetectorConfig';
import { ArtificialSourceDetector } from './ArtificialSourceDetector';
import { BiologicalValidator } from './BiologicalValidator';
import { SignalVariabilityAnalyzer } from './SignalVariabilityAnalyzer';

/**
 * Detector adaptativo con validación ESTRICTA para dedo humano real
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
    
    // 2. VALIDACIÓN BIOLÓGICA ESTRICTA - TODOS LOS TESTS DEBEN PASAR
    
    // Test de rango rojo biológico
    if (this.biologicalValidator.isInBiologicalRedRange(redValue)) {
      score += 0.2;
      reasons.push('red_range_biological');
    } else {
      return { detected: false, confidence: 0, reasons: ['red_not_biological'] };
    }
    
    // Test de ratio rojo/verde ESTRICTO (hemoglobina)
    if (this.biologicalValidator.hasValidHemoglobinRatio(rToGRatio)) {
      score += 0.25;
      reasons.push('hemoglobin_ratio_valid');
    } else {
      return { detected: false, confidence: 0, reasons: ['hemoglobin_ratio_invalid'] };
    }
    
    // Test de textura biológica OBLIGATORIO
    if (this.biologicalValidator.hasBiologicalTexture(textureScore)) {
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
    if (this.biologicalValidator.hasBiologicalStability(avgStability)) {
      score += 0.15;
      reasons.push('biological_stability');
    } else {
      return { detected: false, confidence: 0, reasons: ['unstable_signal'] };
    }
    
    // Test de perfusión biológica
    if (this.biologicalValidator.hasBiologicalPerfusion(redValue, avgGreen, avgBlue)) {
      score += 0.15;
      reasons.push('biological_perfusion');
    } else {
      return { detected: false, confidence: 0, reasons: ['no_biological_perfusion'] };
    }
    
    // Test de variabilidad natural
    if (this.signalVariabilityAnalyzer.hasNaturalVariability(redValue)) {
      score += 0.05;
      reasons.push('natural_variability');
    }
    
    const confidence = Math.min(1.0, score);
    const rawDetected = confidence >= DETECTOR_CONFIG.CONFIDENCE_THRESHOLD;
    
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
    const finalDetected = this.consecutiveDetections >= DETECTOR_CONFIG.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > DETECTOR_CONFIG.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Detección SENSIBLE para dedo real", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.5,
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
      confidence: finalDetected ? confidence : confidence * 0.5,
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
