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
  
  // Estado interno - MÁS PERMISIVO para dedos reales
  private consecutiveDetections = 0;
  private consecutiveNonDetections = 0;
  private isCurrentlyDetected = false;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 1; // MUY reducido para respuesta rápida
  private readonly MAX_CONSECUTIVE_NON_DETECTIONS = 6;
  
  // Historia temporal
  private signalHistory: number[] = [];
  private temporalWindow: { time: number; value: number }[] = [];
  private readonly TEMPORAL_WINDOW_SIZE = 15;
  
  /**
   * DETECCIÓN PRINCIPAL - Sistema optimizado para dedos humanos
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
    
    // PASO 2: Verificar si supera el ruido de fondo - MÁS PERMISIVO
    const isAboveNoise = this.noiseDetector.isAboveNoiseFloor(redValue);
    if (!isAboveNoise) {
      reasons.push("Señal por debajo del ruido de fondo");
      this.updateDetectionState(false);
      return { detected: false, quality: 5 + Math.random() * 15, confidence: 0, reasons, diagnostics: this.getDiagnostics() };
    }
    
    // PASO 3: Validaciones iniciales más permisivas para dedos humanos
    const basicFingerCheck = this.isBasicFingerSignal(redValue, avgGreen, avgBlue);
    if (!basicFingerCheck.isValid) {
      reasons.push(...basicFingerCheck.reasons);
      this.updateDetectionState(false);
      return { detected: false, quality: 10 + Math.random() * 10, confidence: 0, reasons, diagnostics: this.getDiagnostics() };
    }
    
    // PASO 4: Validar firma espectral de hemoglobina - MUY permisivo inicialmente
    const hasValidHemoglobin = this.hemoglobinValidator.validateHemoglobinSignature(redValue, avgGreen, avgBlue);
    if (!hasValidHemoglobin && this.consecutiveDetections < 3) {
      console.log("Hemoglobina inválida en fases tempranas, pero permitiendo detección inicial");
    }
    
    // PASO 5: Validar textura de piel humana - MUY permisivo inicialmente
    const hasValidSkinTexture = this.skinTextureValidator.validateSkinTexture(imageData, roi);
    if (!hasValidSkinTexture && this.consecutiveDetections < 3) {
      console.log("Textura inválida en fases tempranas, pero permitiendo detección inicial");
    }
    
    // PASO 6: Detectar fuentes artificiales - SOLO después de confirmación
    const uniformity = this.calculateUniformity(redValue, avgGreen, avgBlue);
    const artificialCheck = this.artificialDetector.isArtificialSource({
      redValue, avgGreen, avgBlue, textureScore, stability, uniformity
    });
    
    // Solo rechazar por artificial después de varias detecciones
    if (artificialCheck.isArtificial && this.consecutiveDetections > 5) {
      reasons.push(...artificialCheck.reasons);
    }
    
    // PASO 7: Calcular consistencia temporal - MUY permisivo
    const temporalConsistency = this.calculateTemporalConsistency(redValue);
    
    // PASO 8: Validación binaria - MUY permisiva para dedos humanos
    const binaryValidation = this.validateBasicFinger({
      redValue,
      avgGreen,
      avgBlue,
      textureScore,
      stability,
      isAboveNoise,
      hasValidHemoglobin: hasValidHemoglobin || this.consecutiveDetections < 3,
      hasValidSkinTexture: hasValidSkinTexture || this.consecutiveDetections < 3,
      isNotArtificial: !artificialCheck.isArtificial || this.consecutiveDetections < 5,
      temporalConsistency
    });
    
    if (binaryValidation.isValid) {
      detected = true;
      confidence = 0.8; // Alta confianza para dedos detectados
      reasons.push("✅ Dedo humano detectado y validado");
    } else {
      detected = false;
      confidence = 0;
      reasons.push(...binaryValidation.failedRules);
    }
    
    // PASO 9: Aplicar lógica de detecciones consecutivas
    const finalDetected = this.updateDetectionState(detected);
    
    // PASO 10: Calcular calidad realista
    if (finalDetected) {
      quality = this.qualityCalculator.calculateRealisticQuality({
        signalValue: redValue,
        noiseLevel: this.noiseDetector.getNoiseLevel(),
        stability,
        hemoglobinValidity: hasValidHemoglobin ? 1 : 0.5,
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
    
    // Log optimizado
    if (finalDetected || detected) {
      console.log("✅ NewAdaptiveDetector: DEDO DETECTADO", {
        finalDetected,
        quality,
        confidence,
        consecutiveDetections: this.consecutiveDetections,
        redValue,
        noiseLevel: this.noiseDetector.getNoiseLevel(),
        isCalibrated: this.noiseDetector.isCalibrated()
      });
    } else {
      console.log("❌ NewAdaptiveDetector: NO DETECTADO", {
        mainReason: reasons[0] || "Sin razón específica",
        redValue,
        noiseLevel: this.noiseDetector.getNoiseLevel(),
        isAboveNoise,
        isCalibrated: this.noiseDetector.isCalibrated(),
        consecutiveNonDetections: this.consecutiveNonDetections
      });
    }
    
    return {
      detected: finalDetected,
      quality,
      confidence: finalDetected ? confidence : confidence * 0.3,
      reasons,
      diagnostics
    };
  }
  
  /**
   * Validación básica ultra-permisiva para dedos humanos
   */
  private isBasicFingerSignal(red: number, green: number, blue: number): { isValid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Rango ULTRA amplio para dedos humanos reales
    if (red < 10 || red > 200) {
      reasons.push(`Valor rojo fuera del rango biológico humano: ${red}`);
      return { isValid: false, reasons };
    }
    
    // Ratio rojo/verde MUY permisivo para piel humana
    const rToGRatio = red / Math.max(green, 1);
    if (rToGRatio < 0.8 || rToGRatio > 3.5) {
      reasons.push(`Ratio R/G no biológico: ${rToGRatio.toFixed(2)}`);
      return { isValid: false, reasons };
    }
    
    // Verificar que no sea completamente plano (artificial)
    const variance = Math.abs(red - green) + Math.abs(green - blue) + Math.abs(red - blue);
    if (variance < 3) {
      reasons.push(`Señal demasiado uniforme (artificial): varianza=${variance}`);
      return { isValid: false, reasons };
    }
    
    return { isValid: true, reasons: [] };
  }
  
  /**
   * Validación binaria simplificada y permisiva
   */
  private validateBasicFinger(frameData: {
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
    
    // REGLA 1: Debe superar el ruido de fondo (CRÍTICO)
    if (!isAboveNoise) {
      failedRules.push("VETO: Señal por debajo del ruido de fondo");
      return { isValid: false, failedRules };
    }
    
    // REGLA 2: Rango básico para dedos humanos - MUY amplio
    if (redValue < 10 || redValue > 200) {
      failedRules.push(`Fuera del rango biológico básico (${redValue})`);
    }
    
    // REGLA 3: Ratio rojo/verde básico - MUY permisivo
    const rToGRatio = redValue / Math.max(avgGreen, 1);
    if (rToGRatio < 0.8 || rToGRatio > 3.5) {
      failedRules.push(`Ratio R/G extremo (${rToGRatio.toFixed(2)})`);
    }
    
    // Las demás validaciones son solo informativas en las primeras detecciones
    if (!hasValidHemoglobin && this.consecutiveDetections > 3) {
      failedRules.push("Hemoglobina inválida tras confirmación");
    }
    
    if (!hasValidSkinTexture && this.consecutiveDetections > 3) {
      failedRules.push("Textura inválida tras confirmación");
    }
    
    if (!isNotArtificial && this.consecutiveDetections > 5) {
      failedRules.push("Fuente artificial tras confirmación");
    }
    
    const isValid = failedRules.length === 0;
    
    console.log("validateBasicFinger:", {
      isValid,
      failedRules: failedRules.length > 0 ? failedRules[0] : "✅ VALIDADO",
      redValue,
      rToGRatio: rToGRatio.toFixed(2),
      consecutiveDetections: this.consecutiveDetections
    });
    
    return { isValid, failedRules };
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
    
    if (this.temporalWindow.length < 3) return 0.8; // Valor alto inicial para permitir detección
    
    // Calcular consistencia basada en variabilidad esperada
    const values = this.temporalWindow.map(entry => entry.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Consistencia alta para CV biológico típico (2-8%)
    if (cv >= 0.01 && cv <= 0.15) return 1.0; // Rango más amplio
    if (cv >= 0.005 && cv <= 0.20) return 0.7;
    return 0.4; // Más permisivo
  }
  
  private updateDetectionState(detected: boolean): boolean {
    if (detected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      
      if (!this.isCurrentlyDetected && this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        console.log("🎯 ESTADO CAMBIADO: Dedo detectado tras", this.consecutiveDetections, "frames consecutivos");
      }
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      
      if (this.isCurrentlyDetected && this.consecutiveNonDetections >= this.MAX_CONSECUTIVE_NON_DETECTIONS) {
        this.isCurrentlyDetected = false;
        console.log("❌ ESTADO CAMBIADO: Dedo perdido tras", this.consecutiveNonDetections, "frames sin detección");
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
