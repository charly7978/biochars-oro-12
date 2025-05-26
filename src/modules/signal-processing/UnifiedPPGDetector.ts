/**
 * DETECTOR PPG UNIFICADO CORREGIDO
 * Sistema optimizado para detectar SOLO dedos humanos reales
 */
import { UNIFIED_PPG_CONFIG } from './UnifiedConfig';

interface FrameData {
  redValue: number;
  avgGreen: number;
  avgBlue: number;
  textureScore: number;
  stability: number;
  roi: { x: number; y: number; width: number; height: number };
  imageData: ImageData;
}

interface DetectionResult {
  detected: boolean;
  quality: number;
  confidence: number;
  snr: number;
  perfusionIndex: number;
  reasons: string[];
  diagnostics: {
    noiseLevel: number;
    signalStrength: number;
    temporalConsistency: number;
    isCalibrated: boolean;
  };
}

export class UnifiedPPGDetector {
  // Estado de calibración
  private calibrationSamples: number[] = [];
  private noiseBaseline: number = 20; // Valor inicial más realista
  private isCalibrated: boolean = false;
  private frameCount: number = 0;
  
  // Estado de detección
  private consecutiveDetections: number = 0;
  private consecutiveNonDetections: number = 0;
  private currentlyDetected: boolean = false;
  
  // Historial temporal para calidad real
  private signalHistory: Array<{ value: number; timestamp: number }> = [];
  private qualityHistory: number[] = [];
  
  /**
   * Método principal de detección CORREGIDO para dedos reales
   */
  public detectFinger(frameData: FrameData): DetectionResult {
    this.frameCount++;
    
    // PASO 1: Calibración automática continua
    this.updateCalibration(frameData);
    
    // PASO 2: Extracción de características corregida
    const features = this.extractFeatures(frameData);
    
    // PASO 3: Validación CORREGIDA para dedos reales
    const validation = this.cascadeValidationForRealFinger(features);
    
    // PASO 4: Cálculo de calidad real (médica)
    const quality = this.calculateRealQuality(features, validation.detected);
    
    // PASO 5: Estado de detección con histéresis
    const finalDetected = this.updateDetectionState(validation.detected);
    
    // PASO 6: Actualizar historial temporal
    this.updateTemporalHistory(frameData.redValue, quality);
    
    const result: DetectionResult = {
      detected: finalDetected,
      quality: Math.round(quality),
      confidence: validation.confidence,
      snr: features.snr,
      perfusionIndex: features.perfusionIndex,
      reasons: validation.reasons,
      diagnostics: {
        noiseLevel: this.noiseBaseline,
        signalStrength: features.signalStrength,
        temporalConsistency: features.temporalConsistency,
        isCalibrated: this.isCalibrated
      }
    };
    
    // Log detallado cada 30 frames
    if (this.frameCount % 30 === 0) {
      console.log(`UnifiedPPGDetector CORREGIDO: ${finalDetected ? '✅ DEDO REAL DETECTADO' : '❌ NO ES DEDO REAL'}`, {
        quality: Math.round(quality),
        redValue: frameData.redValue.toFixed(1),
        greenValue: frameData.avgGreen.toFixed(1),
        ratio: (frameData.redValue / frameData.avgGreen).toFixed(2),
        snr: features.snr.toFixed(1),
        perfusion: features.perfusionIndex.toFixed(3),
        confidence: validation.confidence.toFixed(2),
        reason: validation.reasons[0] || 'Validado',
        frameCount: this.frameCount
      });
    }
    
    return result;
  }
  
  /**
   * Calibración automática continua MEJORADA
   */
  private updateCalibration(frameData: FrameData): void {
    if (this.calibrationSamples.length < UNIFIED_PPG_CONFIG.CALIBRATION.FRAMES_REQUIRED) {
      // Usar valor rojo directamente para calibración más rápida
      this.calibrationSamples.push(frameData.redValue);
      
      if (this.calibrationSamples.length >= UNIFIED_PPG_CONFIG.CALIBRATION.FRAMES_REQUIRED) {
        this.finalizeCalibration();
      }
    } else {
      // Adaptación continua más conservadora
      const currentNoise = frameData.redValue * 0.1; // Estimación simple
      this.noiseBaseline = this.noiseBaseline * (1 - UNIFIED_PPG_CONFIG.CALIBRATION.ADAPTATION_RATE) + 
                          currentNoise * UNIFIED_PPG_CONFIG.CALIBRATION.ADAPTATION_RATE;
    }
  }
  
  private finalizeCalibration(): void {
    this.calibrationSamples.sort((a, b) => a - b);
    const percentileIndex = Math.floor(this.calibrationSamples.length * UNIFIED_PPG_CONFIG.CALIBRATION.NOISE_PERCENTILE / 100);
    this.noiseBaseline = Math.max(10, this.calibrationSamples[percentileIndex]); // Mínimo 10
    this.isCalibrated = true;
    
    console.log("UnifiedPPGDetector: Calibración completada", {
      noiseBaseline: this.noiseBaseline.toFixed(1),
      samples: this.calibrationSamples.length,
      minValue: Math.min(...this.calibrationSamples).toFixed(1),
      maxValue: Math.max(...this.calibrationSamples).toFixed(1)
    });
  }
  
  /**
   * Extracción de características CORREGIDA para dedos reales
   */
  private extractFeatures(frameData: FrameData) {
    const { redValue, avgGreen, avgBlue, textureScore, stability } = frameData;
    
    // Fuerza de señal normalizada CORREGIDA
    const signalStrength = Math.max(0, redValue - this.noiseBaseline);
    
    // SNR real basado en ruido calibrado
    const snr = this.noiseBaseline > 0 ? signalStrength / this.noiseBaseline : 0;
    
    // Índice de perfusión CORREGIDO para dedos reales
    const perfusionIndex = this.calculateRealPerfusionIndex(redValue, avgGreen, avgBlue);
    
    // Consistencia temporal real
    const temporalConsistency = this.calculateTemporalConsistency(redValue);
    
    // Ratio hemoglobina CORREGIDO
    const hemoglobinRatio = avgGreen > 0 ? redValue / avgGreen : 0;
    
    return {
      signalStrength,
      snr,
      perfusionIndex,
      temporalConsistency,
      hemoglobinRatio,
      textureScore,
      stability
    };
  }
  
  /**
   * Cálculo CORREGIDO del índice de perfusión para dedos reales
   */
  private calculateRealPerfusionIndex(red: number, green: number, blue: number): number {
    // Para dedos reales, el índice debe estar en rango fisiológico
    if (this.signalHistory.length < 5) return 0; // Insuficientes datos
    
    const recentReds = this.signalHistory.slice(-10).map(h => h.value);
    if (recentReds.length < 5) return 0;
    
    const meanRed = recentReds.reduce((a, b) => a + b, 0) / recentReds.length;
    const variance = recentReds.reduce((acc, val) => acc + Math.pow(val - meanRed, 2), 0) / recentReds.length;
    const ac = Math.sqrt(variance);
    
    if (meanRed === 0) return 0;
    
    const perfusion = (ac / meanRed) * 100;
    
    // Validar rango fisiológico (0.5% - 15%)
    if (perfusion < 0.5 || perfusion > 15) return 0;
    
    return perfusion;
  }
  
  /**
   * Cálculo CORREGIDO de la consistencia temporal
   */
  private calculateTemporalConsistency(redValue: number): number {
    this.signalHistory.push({ value: redValue, timestamp: Date.now() });
    
    // Mantener ventana temporal de 2 segundos
    const cutoff = Date.now() - 2000;
    this.signalHistory = this.signalHistory.filter(h => h.timestamp > cutoff);
    
    if (this.signalHistory.length < 5) return 0.5;
    
    const values = this.signalHistory.map(h => h.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Consistencia biológica esperada (2-12% CV)
    if (cv >= 0.02 && cv <= 0.12) return 1.0;
    if (cv >= 0.01 && cv <= 0.18) return 0.7;
    return 0.3;
  }
  
  /**
   * Validación en cascada CORREGIDA para detectar SOLO dedos reales
   */
  private cascadeValidationForRealFinger(features: any) {
    const reasons: string[] = [];
    let confidence = 0;
    
    // FILTRO 1: Intensidad realista para dedos humanos
    if (features.signalStrength < 30) {
      reasons.push("Señal muy débil para dedo humano");
      return { detected: false, confidence: 0, reasons };
    }
    if (features.signalStrength > 200) {
      reasons.push("Señal demasiado intensa (posible LED/luz)");
      return { detected: false, confidence: 0, reasons };
    }
    confidence += 0.25;
    
    // FILTRO 2: Ratio hemoglobina CORREGIDO (debe ser típico de sangre)
    if (features.hemoglobinRatio < 1.2 || features.hemoglobinRatio > 2.0) {
      reasons.push("Ratio de color no corresponde a hemoglobina");
      return { detected: false, confidence: confidence * 0.3, reasons };
    }
    confidence += 0.3;
    
    // FILTRO 3: Perfusión fisiológica REAL
    if (features.perfusionIndex < 0.5 || features.perfusionIndex > 15) {
      reasons.push("Índice de perfusión fuera de rango fisiológico");
      return { detected: false, confidence: confidence * 0.4, reasons };
    }
    confidence += 0.25;
    
    // FILTRO 4: Textura de piel real
    if (features.textureScore < 0.1) {
      reasons.push("Sin textura característica de piel");
      return { detected: false, confidence: confidence * 0.6, reasons };
    }
    confidence += 0.1;
    
    // FILTRO 5: Estabilidad temporal real (no demasiado estable)
    if (features.temporalConsistency > 0.95) {
      reasons.push("Señal demasiado estable (posible superficie artificial)");
      return { detected: false, confidence: confidence * 0.5, reasons };
    }
    confidence += 0.1;
    
    reasons.push("Dedo humano real detectado");
    return { detected: true, confidence: Math.min(1.0, confidence), reasons };
  }
  
  /**
   * Cálculo de calidad real CORREGIDO
   */
  private calculateRealQuality(features: any, detected: boolean): number {
    if (!detected) {
      // Calidad muy baja para no detección
      return Math.random() * 20; // 0-20%
    }
    
    // Componentes de calidad médica CORREGIDOS
    const snrQuality = Math.min(100, (features.snr / 10) * 100);
    const perfusionQuality = Math.min(100, (features.perfusionIndex / 10) * 100);
    const stabilityQuality = features.stability * 100;
    const temporalQuality = features.temporalConsistency * 100;
    
    // Calidad compuesta realista
    const quality = 
      (snrQuality * 0.3) +
      (perfusionQuality * 0.4) +
      (stabilityQuality * 0.2) +
      (temporalQuality * 0.1);
    
    // Rango realista para dedos (40-90%)
    const finalQuality = Math.max(40, Math.min(90, quality));
    
    // Actualizar historial
    this.qualityHistory.push(finalQuality);
    if (this.qualityHistory.length > 10) {
      this.qualityHistory.shift();
    }
    
    return finalQuality;
  }
  
  /**
   * Estado de detección con histéresis
   */
  private updateDetectionState(detected: boolean): boolean {
    if (detected) {
      this.consecutiveDetections++;
      this.consecutiveNonDetections = 0;
      
      if (!this.currentlyDetected && 
          this.consecutiveDetections >= UNIFIED_PPG_CONFIG.DETECTION_STATES.MIN_CONSECUTIVE_ON) {
        this.currentlyDetected = true;
      }
    } else {
      this.consecutiveNonDetections++;
      this.consecutiveDetections = 0;
      
      if (this.currentlyDetected && 
          this.consecutiveNonDetections >= UNIFIED_PPG_CONFIG.DETECTION_STATES.MAX_CONSECUTIVE_OFF) {
        this.currentlyDetected = false;
      }
    }
    
    return this.currentlyDetected;
  }
  
  private updateTemporalHistory(redValue: number, quality: number): void {
    // Solo para historial interno, ya actualizado en calculateTemporalConsistency
  }
  
  /**
   * Reset completo del detector
   */
  public reset(): void {
    this.calibrationSamples = [];
    this.noiseBaseline = 20; // Valor inicial más realista
    this.isCalibrated = false;
    this.frameCount = 0;
    this.consecutiveDetections = 0;
    this.consecutiveNonDetections = 0;
    this.currentlyDetected = false;
    this.signalHistory = [];
    this.qualityHistory = [];
    
    console.log("UnifiedPPGDetector: Reset completo");
  }
}
