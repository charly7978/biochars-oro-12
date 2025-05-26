
/**
 * VALIDADOR DE DEDOS HUMANOS REALES - UMBRALES ESTRICTOS
 * Valida solo dedos humanos reales con criterios médicos estrictos
 */

import { ExtractedMetrics } from './MetricsExtractor';

export interface ValidationResult {
  detected: boolean;
  confidence: number;
  reasons: string[];
}

export class FingerValidator {
  private detectionHistory: boolean[] = [];
  private confidenceHistory: number[] = [];
  
  validateFinger(metrics: ExtractedMetrics, pulsationStrength: number, frameCount: number): ValidationResult {
    const reasons: string[] = [];
    let confidence = 0;
    
    // UMBRALES ESTRICTOS PARA DEDOS HUMANOS REALES
    const MIN_RED = 80;        // Mínimo rojo para hemoglobina
    const MAX_RED = 200;       // Máximo rojo sin saturación
    const MIN_RG_RATIO = 1.1;  // Ratio rojo/verde mínimo para piel
    const MAX_RG_RATIO = 2.2;  // Ratio rojo/verde máximo para piel
    const MIN_TEXTURE = 0.05;  // Textura mínima para piel real
    const MIN_GREEN = 50;      // Verde mínimo para balance de color
    const MAX_GREEN = 180;     // Verde máximo
    
    // 1. VALIDACIÓN ESTRICTA DE INTENSIDAD ROJA (hemoglobina)
    if (metrics.redIntensity >= MIN_RED && metrics.redIntensity <= MAX_RED) {
      confidence += 0.3;
      reasons.push(`Hemoglobina OK: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`Hemoglobina INVÁLIDA: ${metrics.redIntensity.toFixed(1)}`);
      return { detected: false, confidence: 0, reasons };
    }
    
    // 2. VALIDACIÓN ESTRICTA DE CANAL VERDE
    if (metrics.greenIntensity >= MIN_GREEN && metrics.greenIntensity <= MAX_GREEN) {
      confidence += 0.2;
      reasons.push(`Verde OK: ${metrics.greenIntensity.toFixed(1)}`);
    } else {
      reasons.push(`Verde INVÁLIDO: ${metrics.greenIntensity.toFixed(1)}`);
      return { detected: false, confidence: 0, reasons };
    }
    
    // 3. VALIDACIÓN ESTRICTA DE RATIO R/G (característica de piel humana)
    if (metrics.redToGreenRatio >= MIN_RG_RATIO && metrics.redToGreenRatio <= MAX_RG_RATIO) {
      confidence += 0.3;
      reasons.push(`Ratio piel OK: ${metrics.redToGreenRatio.toFixed(2)}`);
    } else {
      reasons.push(`Ratio piel INVÁLIDO: ${metrics.redToGreenRatio.toFixed(2)}`);
      return { detected: false, confidence: 0, reasons };
    }
    
    // 4. VALIDACIÓN DE TEXTURA DE PIEL REAL
    if (metrics.textureScore >= MIN_TEXTURE) {
      confidence += 0.1;
      reasons.push(`Textura piel OK: ${metrics.textureScore.toFixed(3)}`);
    } else {
      reasons.push(`Textura insuficiente: ${metrics.textureScore.toFixed(3)}`);
      confidence *= 0.5; // Penalizar pero no descartar completamente
    }
    
    // 5. VALIDACIÓN DE PULSACIÓN (solo después de estabilización)
    if (frameCount > 90) { // 3 segundos de estabilización
      if (pulsationStrength > 0.015) {
        confidence += 0.1;
        reasons.push(`Pulsación cardíaca: ${pulsationStrength.toFixed(3)}`);
      } else {
        reasons.push(`Sin pulsación cardíaca: ${pulsationStrength.toFixed(3)}`);
        confidence *= 0.7; // Penalizar falta de pulsación
      }
    }
    
    // 6. HISTÉRESIS TEMPORAL PARA ESTABILIDAD
    this.detectionHistory.push(confidence > 0.7);
    this.confidenceHistory.push(confidence);
    
    if (this.detectionHistory.length > 5) {
      this.detectionHistory.shift();
      this.confidenceHistory.shift();
    }
    
    // Requiere mayoría de detecciones positivas en ventana temporal
    const recentDetections = this.detectionHistory.filter(d => d).length;
    const avgConfidence = this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length;
    
    // UMBRAL FINAL MUY ESTRICTO
    const threshold = 0.75;
    const temporalStability = recentDetections >= Math.ceil(this.detectionHistory.length * 0.6);
    const detected = confidence > threshold && temporalStability;
    
    if (detected) {
      reasons.push("DEDO HUMANO DETECTADO");
    } else {
      reasons.push(`Criterios no cumplidos: conf=${confidence.toFixed(2)}, estab=${temporalStability}`);
    }
    
    return {
      detected,
      confidence: Math.min(1.0, avgConfidence),
      reasons
    };
  }
  
  reset(): void {
    this.detectionHistory = [];
    this.confidenceHistory = [];
  }
}
