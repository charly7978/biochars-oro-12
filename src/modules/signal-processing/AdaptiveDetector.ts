
import { DETECTOR_CONFIG } from './DetectorConfig';
import { ArtificialSourceDetector } from './ArtificialSourceDetector';
import { BiologicalValidator } from './BiologicalValidator';
import { SignalVariabilityAnalyzer } from './SignalVariabilityAnalyzer';

/**
 * Detector adaptativo EQUILIBRADO para dedo humano real
 * Rechaza fuentes de luz, objetos y ruido de fondo
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
  private backgroundNoise = 0;
  private noiseHistory: number[] = [];
  
  // Component instances
  private artificialSourceDetector = new ArtificialSourceDetector();
  private biologicalValidator = new BiologicalValidator();
  private signalVariabilityAnalyzer = new SignalVariabilityAnalyzer();
  
  /**
   * Detección EQUILIBRADA para dedo humano - rechaza ruido y artificiales
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
    
    // Actualizar estimación de ruido de fondo
    this.updateBackgroundNoise(redValue);
    
    // 1. RECHAZAR RUIDO DE FONDO PRIMERO
    if (redValue <= this.backgroundNoise * 1.5 || redValue < 40) {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      return { 
        detected: false, 
        confidence: 0, 
        reasons: ['background_noise_detected'] 
      };
    }
    
    // 2. RECHAZAR FUENTES DE LUZ Y OBJETOS ARTIFICIALES
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
    
    // 3. VALIDACIÓN BIOLÓGICA EQUILIBRADA
    
    // Usar validación comprehensiva
    const isValidFinger = this.biologicalValidator.validateFingerPresence(
      redValue, avgGreen, avgBlue, textureScore, stability
    );
    
    if (isValidFinger) {
      score += 0.4; // Base score alta solo si pasa todas las validaciones
      reasons.push('comprehensive_finger_validation_passed');
    } else {
      // Si no pasa la validación comprehensiva, verificar componentes individuales
      if (this.biologicalValidator.isInBiologicalRedRange(redValue)) {
        score += 0.1;
        reasons.push('red_range_ok');
      }
      
      if (this.biologicalValidator.hasValidHemoglobinRatio(rToGRatio)) {
        score += 0.1;
        reasons.push('ratio_ok');
      }
      
      if (this.biologicalValidator.hasBiologicalTexture(textureScore)) {
        score += 0.1;
        reasons.push('texture_ok');
      }
      
      // Si no pasa validaciones básicas, score muy bajo
      if (score < 0.25) {
        this.consecutiveNonDetections++;
        this.consecutiveDetections = 0;
        return { 
          detected: false, 
          confidence: score, 
          reasons: ['insufficient_biological_markers'] 
        };
      }
    }
    
    // 4. Test de estabilidad con historia
    this.stabilityHistory.push(stability);
    if (this.stabilityHistory.length > 8) {
      this.stabilityHistory.shift();
    }
    
    const avgStability = this.stabilityHistory.reduce((a, b) => a + b, 0) / this.stabilityHistory.length;
    if (this.biologicalValidator.hasBiologicalStability(avgStability)) {
      score += 0.15;
      reasons.push('stable_signal');
    }
    
    // 5. Bonus por valores óptimos
    if (redValue >= 90 && redValue <= 140 && rToGRatio >= 1.3 && rToGRatio <= 1.8) {
      score += 0.15;
      reasons.push('optimal_finger_values');
    }
    
    // 6. Penalización por señales inconsistentes
    if (Math.abs(redValue - this.lastValidSignal) > 50 && this.lastValidSignal > 0) {
      score *= 0.7; // Penalización por cambios abruptos
      reasons.push('signal_inconsistency_penalty');
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
    
    // DECISIÓN FINAL CON HISTERESIS EQUILIBRADA
    const finalDetected = this.consecutiveDetections >= DETECTOR_CONFIG.MIN_CONSECUTIVE_DETECTIONS;
    
    // Actualizar historial
    this.detectionHistory.push(finalDetected);
    if (this.detectionHistory.length > DETECTOR_CONFIG.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    console.log("AdaptiveDetector: Detección EQUILIBRADA", {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.6,
      consecutiveDetections: this.consecutiveDetections,
      requiredConsecutive: DETECTOR_CONFIG.MIN_CONSECUTIVE_DETECTIONS,
      reasons,
      redValue,
      rToGRatio,
      avgStability,
      textureScore,
      score,
      backgroundNoise: this.backgroundNoise,
      threshold: DETECTOR_CONFIG.CONFIDENCE_THRESHOLD
    });
    
    return {
      detected: finalDetected,
      confidence: finalDetected ? confidence : confidence * 0.6,
      reasons
    };
  }
  
  /**
   * Actualizar estimación de ruido de fondo
   */
  private updateBackgroundNoise(currentValue: number): void {
    this.noiseHistory.push(currentValue);
    if (this.noiseHistory.length > 30) {
      this.noiseHistory.shift();
    }
    
    // Calcular ruido como el percentil 25 de los últimos valores
    if (this.noiseHistory.length >= 10) {
      const sorted = [...this.noiseHistory].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.25);
      this.backgroundNoise = sorted[index];
    }
  }
  
  /**
   * Adaptación conservadora de umbrales
   */
  public adaptThresholds(recentValues: number[]): void {
    if (recentValues.length < 10) return;
    
    const validValues = recentValues.filter(v => 
      v >= DETECTOR_CONFIG.BIOLOGICAL_RED_MIN && v <= DETECTOR_CONFIG.BIOLOGICAL_RED_MAX
    );
    
    if (validValues.length < 8) return;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / validValues.length
    );
    
    // Ajustar umbrales de forma muy conservadora
    this.adaptiveThresholds.min = Math.max(DETECTOR_CONFIG.BIOLOGICAL_RED_MIN, avg - stdDev * 0.5);
    this.adaptiveThresholds.max = Math.min(DETECTOR_CONFIG.BIOLOGICAL_RED_MAX, avg + stdDev * 0.5);
    
    console.log("AdaptiveDetector: Umbrales ajustados:", this.adaptiveThresholds);
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
    this.backgroundNoise = 0;
    this.noiseHistory = [];
    this.signalVariabilityAnalyzer.reset();
  }
}
