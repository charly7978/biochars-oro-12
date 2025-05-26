/**
 * Sistema de validación binario robusto
 * Implementa validaciones pass/fail estrictas con sistema de veto
 */
export class RobustBinaryValidator {
  private readonly VALIDATION_RULES = {
    MIN_SIGNAL_STRENGTH: 45, // Reducido de 60 para permitir dedos más pálidos
    MAX_SIGNAL_STRENGTH: 180,
    MIN_RED_DOMINANCE: 1.1, // Reducido de 1.2
    MAX_RED_DOMINANCE: 2.5,
    MIN_HEMOGLOBIN_RATIO: 1.05, // Reducido de 1.1
    MAX_HEMOGLOBIN_RATIO: 2.0,
    MIN_STABILITY_THRESHOLD: 0.3, // Reducido de 0.4
    MIN_TEXTURE_SCORE: 0.05, // Reducido de 0.08
    MAX_BRIGHTNESS_UNIFORMITY: 0.9,
    MIN_TEMPORAL_CONSISTENCY: 0.2 // Reducido de 0.3
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
      failedRules.push(`Intensidad de señal fuera del rango biológico (${redValue})`);
    }
    
    // REGLA 3: Dominancia roja característica de piel
    const redDominance = redValue / Math.max(avgGreen, avgBlue, 1);
    if (redDominance < this.VALIDATION_RULES.MIN_RED_DOMINANCE || 
        redDominance > this.VALIDATION_RULES.MAX_RED_DOMINANCE) {
      failedRules.push(`Dominancia de canal rojo no característica (${redDominance.toFixed(2)})`);
    }
    
    // REGLA 4: Ratio hemoglobina válido (CRÍTICO)
    const hemoglobinRatio = redValue / Math.max(avgGreen, 1);
    if (hemoglobinRatio < this.VALIDATION_RULES.MIN_HEMOGLOBIN_RATIO || 
        hemoglobinRatio > this.VALIDATION_RULES.MAX_HEMOGLOBIN_RATIO) {
      failedRules.push(`CRÍTICO: Ratio hemoglobina inválido (${hemoglobinRatio.toFixed(2)})`);
    }
    
    // REGLA 5: Firma espectral de hemoglobina (VETO) - Más permisivo durante primeros frames
    if (!hasValidHemoglobin && this.validationHistory.length > 5) {
      failedRules.push("VETO: Firma espectral de hemoglobina inválida");
      return { isValid: false, failedRules };
    }
    
    // REGLA 6: Textura de piel humana (VETO) - Más permisivo durante primeros frames
    if (!hasValidSkinTexture && this.validationHistory.length > 5) {
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
      failedRules.push(`Estabilidad insuficiente (${stability.toFixed(2)})`);
    }
    
    // REGLA 9: Textura mínima requerida
    if (textureScore < this.VALIDATION_RULES.MIN_TEXTURE_SCORE) {
      failedRules.push(`Textura insuficiente (${textureScore.toFixed(3)})`);
    }
    
    // REGLA 10: No debe ser uniformemente brillante (artificial)
    const brightness = (redValue + avgGreen + avgBlue) / 3;
    const uniformity = 1 - (Math.abs(redValue - avgGreen) + Math.abs(avgGreen - avgBlue)) / (2 * brightness);
    if (uniformity > this.VALIDATION_RULES.MAX_BRIGHTNESS_UNIFORMITY) {
      failedRules.push(`Uniformidad excesiva (${uniformity.toFixed(2)})`);
    }
    
    // REGLA 11: Consistencia temporal
    if (temporalConsistency < this.VALIDATION_RULES.MIN_TEMPORAL_CONSISTENCY) {
      failedRules.push(`Inconsistencia temporal (${temporalConsistency.toFixed(2)})`);
    }
    
    const isValid = failedRules.length === 0;
    
    // Actualizar historial
    this.validationHistory.push(isValid);
    if (this.validationHistory.length > this.HISTORY_SIZE) {
      this.validationHistory.shift();
    }
    
    console.log("RobustBinaryValidator:", {
      isValid,
      failedRules: failedRules.length > 0 ? failedRules[0] : "TODAS LAS VALIDACIONES PASARON",
      redValue,
      hemoglobinRatio: hemoglobinRatio.toFixed(2),
      redDominance: redDominance.toFixed(2),
      stability: stability.toFixed(2),
      textureScore: textureScore.toFixed(3),
      temporalConsistency: temporalConsistency.toFixed(2)
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
