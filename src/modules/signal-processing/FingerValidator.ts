
/**
 * VALIDADOR DE DEDOS REAL - SIN SIMULACIONES
 * Valida si hay un dedo real presente usando umbrales básicos
 */

import { ExtractedMetrics } from './MetricsExtractor';

export interface ValidationResult {
  detected: boolean;
  confidence: number;
  reasons: string[];
}

export class FingerValidator {
  
  validateFinger(metrics: ExtractedMetrics, pulsationStrength: number, frameCount: number): ValidationResult {
    const reasons: string[] = [];
    let confidence = 0;
    
    // Umbrales MUY PERMISIVOS para detectar cualquier dedo
    const MIN_RED = 45;
    const MAX_RED = 220;
    const MIN_RG_RATIO = 0.8;
    const MAX_RG_RATIO = 2.8;
    const MIN_TEXTURE = 0.02;
    
    // Validación de intensidad roja
    if (metrics.redIntensity >= MIN_RED && metrics.redIntensity <= MAX_RED) {
      confidence += 0.4;
      reasons.push(`Rojo OK: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`Rojo FUERA: ${metrics.redIntensity.toFixed(1)}`);
      confidence += 0.1;
    }
    
    // Validación de ratio R/G
    if (metrics.redToGreenRatio >= MIN_RG_RATIO && metrics.redToGreenRatio <= MAX_RG_RATIO) {
      confidence += 0.3;
      reasons.push(`R/G OK: ${metrics.redToGreenRatio.toFixed(2)}`);
    } else {
      reasons.push(`R/G FUERA: ${metrics.redToGreenRatio.toFixed(2)}`);
      confidence += 0.1;
    }
    
    // Validación de textura
    if (metrics.textureScore >= MIN_TEXTURE) {
      confidence += 0.2;
      reasons.push(`Textura OK: ${metrics.textureScore.toFixed(3)}`);
    } else {
      reasons.push(`Textura BAJA: ${metrics.textureScore.toFixed(3)}`);
      confidence += 0.05;
    }
    
    // Pulsación (solo después de 2 segundos)
    if (frameCount > 60) {
      if (pulsationStrength > 0.01) {
        confidence += 0.1;
        reasons.push(`Pulsación: ${pulsationStrength.toFixed(3)}`);
      } else {
        reasons.push(`Sin pulsación: ${pulsationStrength.toFixed(3)}`);
        confidence *= 0.8;
      }
    }
    
    // Umbral final MUY BAJO para detectar dedos
    const threshold = 0.3;
    const detected = confidence > threshold;
    
    if (detected) {
      reasons.push("DEDO DETECTADO");
    } else {
      reasons.push(`Confianza insuficiente: ${confidence.toFixed(2)}`);
    }
    
    return {
      detected,
      confidence: Math.min(1.0, confidence),
      reasons
    };
  }
}
