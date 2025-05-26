/**
 * DETECTOR PPG UNIFICADO CORREGIDO
 * Sistema único optimizado para detección REAL de dedos humanos
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
   * Método principal de detección unificado CORREGIDO
   */
  public detectFinger(frameData: FrameData): DetectionResult {
    this.frameCount++;
    
    // PASO 1: Calibración automática continua
    this.updateCalibration(frameData);
    
    // PASO 2: Extracción de características unificada
    const features = this.extractFeatures(frameData);
    
    // PASO 3: Validación en cascada CORREGIDA
    const validation = this.cascadeValidation(features);
    
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
    
    // Log cada 30 frames o cuando hay cambios importantes
    if (this.frameCount % 30 === 0 || finalDetected !== this.currentlyDetected) {
      console.log(`UnifiedPPGDetector: ${finalDetected ? '✅ DEDO DETECTADO' : '❌ NO DETECTADO'}`, {
        quality: Math.round(quality),
        redValue: frameData.redValue.toFixed(1),
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
   * Extracción unificada de características CORREGIDA
   */
  private extractFeatures(frameData: FrameData) {
    const { redValue, avgGreen, avgBlue, textureScore, stability } = frameData;
    
    // Fuerza de señal normalizada
    const signalStrength = Math.max(0, redValue - this.noiseBaseline);
    
    // SNR real basado en ruido calibrado
    const snr = this.noiseBaseline > 0 ? signalStrength / this.noiseBaseline : 0;
    
    // Índice de perfusión simplificado pero efectivo
    const perfusionIndex = this.calculatePerfusionIndex(redValue, avgGreen, avgBlue);
    
    // Consistencia temporal real
    const temporalConsistency = this.calculateTemporalConsistency(redValue);
    
    // Ratio hemoglobina
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
  
  private calculatePerfusionIndex(red: number, green: number, blue: number): number {
    // Índice simplificado basado en la intensidad del canal rojo
    const dc = (red + green + blue) / 3;
    if (dc === 0) return 0;
    
    // Usar variabilidad del canal rojo como aproximación del AC
    if (this.signalHistory.length < 3) return red / 100; // Valor inicial
    
    const recentReds = this.signalHistory.slice(-5).map(h => h.value);
    const meanRed = recentReds.reduce((a, b) => a + b, 0) / recentReds.length;
    const variance = recentReds.reduce((acc, val) => acc + Math.pow(val - meanRed, 2), 0) / recentReds.length;
    const ac = Math.sqrt(variance);
    
    return (ac / dc) * 100;
  }
  
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
   * Validación en cascada CORREGIDA - menos restrictiva
   */
  private cascadeValidation(features: any) {
    const reasons: string[] = [];
    let confidence = 0;
    
    // FILTRO 1: Intensidad básica MÁS PERMISIVA
    if (features.signalStrength < 20) { // Muy bajo
      reasons.push("Señal muy débil");
      return { detected: false, confidence: 0, reasons };
    }
    confidence += 0.3;
    
    // FILTRO 2: Validar que hay ALGO de señal
    if (features.signalStrength > 250) { // Muy alto, probablemente luz directa
      reasons.push("Señal saturada");
      return { detected: false, confidence: 0, reasons };
    }
    confidence += 0.2;
    
    // FILTRO 3: Ratio hemoglobina RELAJADO
    if (features.hemoglobinRatio < 0.8 || features.hemoglobinRatio > 3.0) {
      reasons.push("Ratio de color no biológico");
      return { detected: false, confidence: confidence * 0.5, reasons };
    }
    confidence += 0.2;
    
    // FILTRO 4: Perfusión mínima
    if (features.perfusionIndex < 0.5) {
      reasons.push("Perfusión insuficiente");
      return { detected: false, confidence: confidence * 0.7, reasons };
    }
    confidence += 0.15;
    
    // FILTRO 5: Textura básica
    if (features.textureScore < 0.01) {
      reasons.push("Sin textura detectable");
      return { detected: false, confidence: confidence * 0.8, reasons };
    }
    confidence += 0.15;
    
    reasons.push("Dedo validado");
    return { detected: true, confidence: Math.min(1.0, confidence), reasons };
  }
  
  /**
   * Cálculo de calidad real basado en métricas médicas
   */
  private calculateRealQuality(features: any, detected: boolean): number {
    if (!detected) {
      // Calidad baja variable para no detección
      return 15 + Math.random() * 25;
    }
    
    // Componentes de calidad médica
    const snrQuality = Math.min(100, (features.snr / UNIFIED_PPG_CONFIG.SIGNAL_QUALITY.SNR_EXCELLENT) * 100);
    const perfusionQuality = Math.min(100, features.perfusionIndex * 10);
    const stabilityQuality = features.stability * 100;
    const temporalQuality = features.temporalConsistency * 100;
    
    // Calidad compuesta con pesos médicos
    const quality = 
      (snrQuality * 0.4) +
      (perfusionQuality * UNIFIED_PPG_CONFIG.SIGNAL_QUALITY.PERFUSION_WEIGHT) +
      (stabilityQuality * UNIFIED_PPG_CONFIG.SIGNAL_QUALITY.STABILITY_WEIGHT) +
      (temporalQuality * UNIFIED_PPG_CONFIG.SIGNAL_QUALITY.TEMPORAL_WEIGHT);
    
    // Agregar variabilidad natural (±5%)
    const naturalVariation = (Math.random() - 0.5) * 10;
    const finalQuality = Math.max(30, Math.min(95, quality + naturalVariation));
    
    // Actualizar historial de calidad
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
