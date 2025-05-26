
/**
 * Sistema de validación binario robusto
 * Implementa validaciones pass/fail estrictas con sistema de veto
 */
export class RobustBinaryValidator {
  private readonly VALIDATION_RULES = {
    MIN_SIGNAL_STRENGTH: 60,
    MAX_SIGNAL_STRENGTH: 180,
    MIN_RED_DOMINANCE: 1.2,
    MAX_RED_DOMINANCE: 2.5,
    MIN_HEMOGLOBIN_RATIO: 1.1,
    MAX_HEMOGLOBIN_RATIO: 2.0,
    MIN_STABILITY_THRESHOLD: 0.4,
    MIN_TEXTURE_SCORE: 0.08,
    MAX_BRIGHTNESS_UNIFORMITY: 0.9,
    MIN_TEMPORAL_CONSISTENCY: 0.3
  };
  
  private validationHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 10;
  
  /**
   * Validación binaria estricta - todas deben pasar
   */
  public validateFingerPresence(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    textureScore: number;
    stability: number;
    isAboveNoise: boolean;
    hasValidHemoglobin: boolean;
    hasValidSkinTexture: boolean;
    isNotArtificial: boolean;
    temporalConsistency: number;
  }): { isValid: boolean; failedRules: string[] } {
    
    const { redValue, avgGreen, avgBlue, textureScore, stability, 
            isAboveNoise, hasValidHemoglobin, hasValidSkinTexture, 
            isNotArtificial, temporalConsistency } = frameData;
    
    const failedRules: string[] = [];
    
    // REGLA 1: Debe superar el ruido de fondo (VETO INMEDIATO)
    if (!isAboveNoise) {
      failedRules.push("VETO: Señal por debajo del ruido de fondo");
      return { isValid: false, failedRules };
    }
    
    // REGLA 2: Rango de intensidad biológica válida
    if (redValue < this.VALIDATION_RULES.MIN_SIGNAL_STRENGTH || 
        redValue > this.VALIDATION_RULES.MAX_SIGNAL_STRENGTH) {
      failedRules.push("Intensidad de señal fuera del rango biológico");
    }
    
    // REGLA 3: Dominancia roja característica de piel
    const redDominance = redValue / Math.max(avgGreen, avgBlue, 1);
    if (redDominance < this.VALIDATION_RULES.MIN_RED_DOMINANCE || 
        redDominance > this.VALIDATION_RULES.MAX_RED_DOMINANCE) {
      failedRules.push("Dominancia de canal rojo no característica de piel");
    }
    
    // REGLA 4: Ratio hemoglobina válido (CRÍTICO)
    const hemoglobinRatio = redValue / Math.max(avgGreen, 1);
    if (hemoglobinRatio < this.VALIDATION_RULES.MIN_HEMOGLOBIN_RATIO || 
        hemoglobinRatio > this.VALIDATION_RULES.MAX_HEMOGLOBIN_RATIO) {
      failedRules.push("CRÍTICO: Ratio hemoglobina inválido");
    }
    
    // REGLA 5: Firma espectral de hemoglobina (VETO)
    if (!hasValidHemoglobin) {
      failedRules.push("VETO: Firma espectral de hemoglobina inválida");
      return { isValid: false, failedRules };
    }
    
    // REGLA 6: Textura de piel humana (VETO)
    if (!hasValidSkinTexture) {
      failedRules.push("VETO: Textura no corresponde a piel humana");
      return { isValid: false, failedRules };
    }
    
    // REGLA 7: No debe ser fuente artificial (VETO)
    if (!isNotArtificial) {
      failedRules.push("VETO: Detectada fuente artificial");
      return { isValid: false, failedRules };
    }
    
    // REGLA 8: Estabilidad mínima requerida
    if (stability < this.VALIDATION_RULES.MIN_STABILITY_THRESHOLD) {
      failedRules.push("Estabilidad insuficiente para señal biológica");
    }
    
    // REGLA 9: Textura mínima requerida
    if (textureScore < this.VALIDATION_RULES.MIN_TEXTURE_SCORE) {
      failedRules.push("Textura insuficiente - superficie demasiado lisa");
    }
    
    // REGLA 10: No debe ser uniformemente brillante (artificial)
    const brightness = (redValue + avgGreen + avgBlue) / 3;
    const uniformity = 1 - (Math.abs(redValue - avgGreen) + Math.abs(avgGreen - avgBlue)) / (2 * brightness);
    if (uniformity > this.VALIDATION_RULES.MAX_BRIGHTNESS_UNIFORMITY) {
      failedRules.push("Uniformidad excesiva - posible fuente artificial");
    }
    
    // REGLA 11: Consistencia temporal
    if (temporalConsistency < this.VALIDATION_RULES.MIN_TEMPORAL_CONSISTENCY) {
      failedRules.push("Inconsistencia temporal - señal irregular");
    }
    
    const isValid = failedRules.length === 0;
    
    // Actualizar historial
    this.validationHistory.push(isValid);
    if (this.validationHistory.length > this.HISTORY_SIZE) {
      this.validationHistory.shift();
    }
    
    console.log("RobustBinaryValidator:", {
      isValid,
      failedRules,
      redValue,
      hemoglobinRatio: hemoglobinRatio.toFixed(2),
      redDominance: redDominance.toFixed(2),
      stability,
      textureScore,
      temporalConsistency
    });
    
    return { isValid, failedRules };
  }
  
  /**
   * Obtener tasa de éxito reciente
   */
  public getRecentSuccessRate(): number {
    if (this.validationHistory.length === 0) return 0;
    const successes = this.validationHistory.filter(v => v).length;
    return successes / this.validationHistory.length;
  }
  
  /**
   * Reset del validador
   */
  public reset(): void {
    this.validationHistory = [];
  }
}
