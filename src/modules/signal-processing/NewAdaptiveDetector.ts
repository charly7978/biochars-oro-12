
/**
 * NUEVO DETECTOR ADAPTATIVO ROBUSTO
 * Implementa el plan completo para detección SOLO de dedos humanos reales
 */
import { NoiseDetector } from './NoiseDetector';
import { HemoglobinValidator } from './HemoglobinValidator';
import { SkinTextureValidator } from './SkinTextureValidator';
import { RobustBinaryValidator } from './RobustBinaryValidator';
import { EnhancedArtificialDetector } from './EnhancedArtificialDetector';
import { RealisticQualityCalculator } from './RealisticQualityCalculator';

export class NewAdaptiveDetector {
  // Componentes especializados
  private noiseDetector = new NoiseDetector();
  private hemoglobinValidator = new HemoglobinValidator();
  private skinTextureValidator = new SkinTextureValidator();
  private binaryValidator = new RobustBinaryValidator();
  private artificialDetector = new EnhancedArtificialDetector();
  private qualityCalculator = new RealisticQualityCalculator();
  
  // Estado interno
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private isCurrentlyDetected = false;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 5; // Más estricto
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 3;
  
  // Historia temporal
  private signalHistory: number[] = [];
  private temporalWindow: { time: number; value: number }[] = [];
  private readonly TEMPORAL_WINDOW_SIZE = 15;
  
  /**
   * DETECCIÓN PRINCIPAL - Sistema robusto completo
   */
  public detectFingerRobust(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    textureScore: number;
    rToGRatio: number;
    rToBRatio: number;
    stability: number;
    roi: { x: number; y: number; width: number; height: number };
    imageData: ImageData;
  }): { 
    detected: boolean; 
    quality: number; 
    confidence: number; 
    reasons: string[];
    diagnostics: any;
  } {
    
    const { redValue, avgGreen, avgBlue, textureScore, rToGRatio, 
            rToBRatio, stability, roi, imageData } = frameData;
    
    const reasons: string[] = [];
    let detected = false;
    let quality = 0;
    let confidence = 0;
    
    // PASO 1: Actualizar detector de ruido de fondo
    this.noiseDetector.updateBackground(imageData);
    
    // PASO 2: Verificar si supera el ruido de fondo (CRÍTICO)
    const isAboveNoise = this.noiseDetector.isAboveNoiseFloor(redValue);
    if (!isAboveNoise) {
      reasons.push("Señal por debajo del ruido de fondo");
      this.updateDetectionState(false);
      return { detected: false, quality: 5 + Math.random() * 10, confidence: 0, reasons, diagnostics: this.getDiagnostics() };
    }
    
    // PASO 3: Validar firma espectral de hemoglobina
    const hasValidHemoglobin = this.hemoglobinValidator.validateHemoglobinSignature(redValue, avgGreen, avgBlue);
    if (!hasValidHemoglobin) {
      reasons.push("Firma espectral de hemoglobina inválida");
    }
    
    // PASO 4: Validar textura de piel humana
    const hasValidSkinTexture = this.skinTextureValidator.validateSkinTexture(imageData, roi);
    if (!hasValidSkinTexture) {
      reasons.push("Textura no corresponde a piel humana");
    }
    
    // PASO 5: Detectar fuentes artificiales
    const uniformity = this.calculateUniformity(redValue, avgGreen, avgBlue);
    const artificialCheck = this.artificialDetector.isArtificialSource({
      redValue, avgGreen, avgBlue, textureScore, stability, uniformity
    });
    
    if (artificialCheck.isArtificial) {
      reasons.push(...artificialCheck.reasons);
    }
    
    // PASO 6: Calcular consistencia temporal
    const temporalConsistency = this.calculateTemporalConsistency(redValue);
    
    // PASO 7: Validación binaria robusta (TODAS deben pasar)
    const binaryValidation = this.binaryValidator.validateFingerPresence({
      redValue,
      avgGreen,
      avgBlue,
      textureScore,
      stability,
      isAboveNoise,
      hasValidHemoglobin,
      hasValidSkinTexture,
      isNotArtificial: !artificialCheck.isArtificial,
      temporalConsistency
    });
    
    if (binaryValidation.isValid) {
      detected = true;
      confidence = 0.9; // Alta confianza solo si pasa todas las validaciones
      reasons.push("Dedo humano validado correctamente");
    } else {
      detected = false;
      confidence = 0;
      reasons.push(...binaryValidation.failedRules);
    }
    
    // PASO 8: Aplicar lógica de detecciones consecutivas
    const finalDetected = this.updateDetectionState(detected);
    
    // PASO 9: Calcular calidad realista
    if (finalDetected) {
      quality = this.qualityCalculator.calculateRealisticQuality({
        signalValue: redValue,
        noiseLevel: this.noiseDetector.getNoiseLevel(),
        stability,
        hemoglobinValidity: hasValidHemoglobin ? 1 : 0,
        textureScore,
        temporalConsistency,
        isFingerDetected: true
      });
    } else {
      quality = this.qualityCalculator.calculateRealisticQuality({
        signalValue: redValue,
        noiseLevel: this.noiseDetector.getNoiseLevel(),
        stability,
        hemoglobinValidity: 0,
        textureScore,
        temporalConsistency,
        isFingerDetected: false
      });
    }
    
    const diagnostics = this.getDiagnostics();
    
    console.log("NewAdaptiveDetector: Detección robusta completada", {
      finalDetected,
      quality,
      confidence,
      consecutiveDetections: this.consecutiveDetections,
      consecutiveNonDetections: this.consecutiveNonDetections,
      reasons: reasons.slice(0, 3), // Limitar para logging
      redValue,
      noiseLevel: this.noiseDetector.getNoiseLevel(),
      isAboveNoise,
      hasValidHemoglobin,
      hasValidSkinTexture,
      isArtificial: artificialCheck.isArtificial
    });
    
    return {
      detected: finalDetected,
      quality,
      confidence: finalDetected ? confidence : confidence * 0.3,
      reasons,
      diagnostics
    };
  }
  
  private calculateUniformity(red: number, green: number, blue: number): number {
    const avg = (red + green + blue) / 3;
    if (avg === 0) return 1;
    
    const variance = (Math.pow(red - avg, 2) + Math.pow(green - avg, 2) + Math.pow(blue - avg, 2)) / 3;
    return 1 - (Math.sqrt(variance) / avg);
  }
  
  private calculateTemporalConsistency(redValue: number): number {
    const now = Date.now();
    
    // Añadir valor actual al historial temporal
    this.temporalWindow.push({ time: now, value: redValue });
    
    // Mantener ventana temporal de últimos 2 segundos
    this.temporalWindow = this.temporalWindow.filter(entry => now - entry.time < 2000);
    
    if (this.temporalWindow.length < 5) return 0.5; // Valor neutral inicial
    
    // Calcular consistencia basada en variabilidad esperada
    const values = this.temporalWindow.map(entry => entry.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Consistencia alta para CV biológico típico (2-8%)
    if (cv >= 0.02 && cv <= 0.08) return 1.0;
    if (cv >= 0.01 && cv <= 0.12) return 0.7;
    if (cv >= 0.005 && cv <= 0.15) return 0.4;
    return 0.1; // Muy inconsistente
  }
  
  private updateDetectionState(detected: boolean): boolean {
    if (detected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      
      if (!this.isCurrentlyDetected && this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
      }
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      
      if (this.isCurrentlyDetected && this.consecutiveNonDetections >= this.MAX_CONSECUTIVE_NON_DETECTIONS) {
        this.isCurrentlyDetected = false;
      }
    }
    
    return this.isCurrentlyDetected;
  }
  
  private getDiagnostics(): any {
    return {
      noiseLevel: this.noiseDetector.getNoiseLevel(),
      isNoiseCalibrated: this.noiseDetector.isCalibrated(),
      consecutiveDetections: this.consecutiveDetections,
      consecutiveNonDetections: this.consecutiveNonDetections,
      isCurrentlyDetected: this.isCurrentlyDetected,
      temporalWindowSize: this.temporalWindow.length,
      recentSuccessRate: this.binaryValidator.getRecentSuccessRate()
    };
  }
  
  public reset(): void {
    this.noiseDetector.reset();
    this.binaryValidator.reset();
    this.artificialDetector.reset();
    this.qualityCalculator.reset();
    
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.isCurrentlyDetected = false;
    this.signalHistory = [];
    this.temporalWindow = [];
    
    console.log("NewAdaptiveDetector: Reset completo realizado");
  }
}
