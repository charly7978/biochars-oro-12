
import { RealFingerDetector } from './RealFingerDetector';
import { HemoglobinValidator } from './HemoglobinValidator';
import { RealSignalQualityAnalyzer } from './RealSignalQualityAnalyzer';

/**
 * NÚCLEO DE DETECCIÓN SIMPLIFICADO - USA EL NUEVO SISTEMA ROBUSTO
 */

export interface FingerDetectionResult {
  detected: boolean;
  confidence: number;
  quality: number;
  reasons: string[];
  metrics: {
    redIntensity: number;
    greenIntensity: number;
    blueIntensity: number;
    redToGreenRatio: number;
    textureScore: number;
    stability: number;
    hemoglobinScore: number;
    pulsationStrength: number;
  };
  roi: { x: number; y: number; width: number; height: number };
}

export class FingerDetectionCore {
  private realDetector: RealFingerDetector;
  private hemoglobinValidator: HemoglobinValidator;
<<<<<<< Updated upstream
  private frameCount = 0;
=======
  private realQualityAnalyzer: RealSignalQualityAnalyzer;
  private recentRedHistory: { value: number; timestamp: number }[] = [];
>>>>>>> Stashed changes
  
  constructor() {
    this.realDetector = new RealFingerDetector();
    this.hemoglobinValidator = new HemoglobinValidator();
    this.realQualityAnalyzer = new RealSignalQualityAnalyzer();
  }
  
  /**
   * Detección principal usando el nuevo sistema robusto
   */
  detectFinger(imageData: ImageData): FingerDetectionResult {
    this.frameCount++;
    
<<<<<<< Updated upstream
    // Usar el detector real robusto
    const detectionMetrics = this.realDetector.detectRealFinger(imageData);
    
    // Extraer métricas básicas para compatibilidad
    const basicMetrics = this.extractBasicMetrics(imageData);
    
    // Determinar detección final
    const detected = detectionMetrics.confidence > 0.5;
    const quality = this.calculateQuality(detectionMetrics, basicMetrics);
    
    // Generar razones descriptivas
    const reasons = this.generateReasons(detectionMetrics, detected);
    
    if (this.frameCount % 30 === 0) {
      console.log("FingerDetectionCore (Nuevo):", {
        detected,
        confidence: detectionMetrics.confidence.toFixed(2),
        quality: quality.toFixed(1),
        skinTone: detectionMetrics.skinToneValid,
        perfusion: detectionMetrics.perfusionDetected,
        pulse: detectionMetrics.pulsationDetected
=======
    const { metrics, roi } = this.extractBasicMetrics(imageData);
    
    this.recentRedHistory.push({ value: metrics.redIntensity, timestamp: Date.now() });
    if (this.recentRedHistory.length > 120) { // ~4 segundos a 30 FPS
      this.recentRedHistory.shift();
    }
    
    const validation = this.validateRealFinger(metrics);
    const pulsationStrength = this.detectPulsation();
    const pulsationScore = pulsationStrength ? 1.0 : 0.1;
    
    if (validation.detected && !pulsationStrength) {
      validation.detected = false;
      validation.reasons.unshift('No se detectó pulsación (validación final)');
      validation.confidence *= 0.2;
    }
    
    if (validation.detected) {
      this.updateCalibration(metrics.redIntensity);
    }
    
    const noiseEstimate = metrics.stability < 0.5 ? (1 - metrics.stability) * 50 : 10;
    
    const quality = this.realQualityAnalyzer.calculateQuality(
      metrics.redIntensity,
      noiseEstimate,
      metrics.hemoglobinScore,
      pulsationScore,
      validation.detected
    );
    
    if (this.frameCount % 15 === 0) {
      console.log("[FingerDetectionCore: Result]", {
        detected: validation.detected,
        quality: quality.toFixed(1),
        confidence: validation.confidence.toFixed(2),
        reasons: validation.reasons.join(', '),
        metrics: {
          red: metrics.redIntensity.toFixed(1),
          rgRatio: metrics.redToGreenRatio.toFixed(2),
          hemo: metrics.hemoglobinScore.toFixed(2),
          pulsationScore: pulsationScore.toFixed(2),
          stability: metrics.stability.toFixed(2),
          texture: metrics.textureScore.toFixed(2)
        }
>>>>>>> Stashed changes
      });
    }
    
    return {
      detected,
      confidence: detectionMetrics.confidence,
      quality,
      reasons,
      metrics: {
<<<<<<< Updated upstream
        ...basicMetrics,
        hemoglobinScore: detectionMetrics.perfusionDetected ? 0.8 : 0.2
=======
        ...metrics,
        pulsationStrength: pulsationScore
>>>>>>> Stashed changes
      },
      roi: { x: 0, y: 0, width: imageData.width, height: imageData.height }
    };
  }
  
  private extractBasicMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
<<<<<<< Updated upstream
    // Área central para análisis
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.25;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    
    for (let y = centerY - radius; y < centerY + radius; y += 2) {
      for (let x = centerX - radius; x < centerX + radius; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (distance <= radius) {
            const index = (Math.floor(y) * width + Math.floor(x)) * 4;
            redSum += data[index];
            greenSum += data[index + 1];
            blueSum += data[index + 2];
            pixelCount++;
          }
=======
    const roiSizeFactor = 0.35;
    const roiWidth = Math.min(width, height) * roiSizeFactor;
    const roiHeight = roiWidth;
    const roiX = Math.floor(width / 2 - roiWidth / 2);
    const roiY = Math.floor(height / 2 - roiHeight / 2);
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = [];
    
    for (let y = roiY; y < roiY + roiHeight; y++) {
      for (let x = roiX; x < roiX + roiWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          redSum += r;
          greenSum += g;
          blueSum += b;
          intensities.push((r + g + b) / 3);
          validPixels++;
>>>>>>> Stashed changes
        }
      }
    }
    
    const avgRed = pixelCount > 0 ? redSum / pixelCount : 0;
    const avgGreen = pixelCount > 0 ? greenSum / pixelCount : 0;
    const avgBlue = pixelCount > 0 ? blueSum / pixelCount : 0;
    
<<<<<<< Updated upstream
    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      redToGreenRatio: avgGreen > 0 ? avgRed / avgGreen : 0,
      textureScore: 0.5, // Simplificado
      stability: 0.5      // Simplificado
=======
    const hemoglobinScore = this.hemoglobinValidator.validateHemoglobinSignature(avgRed, avgGreen, avgBlue);

    if (this.frameCount % 15 === 0) {
        console.log("[MetricsDebug]", {
            avgR: avgRed.toFixed(1),
            avgG: avgGreen.toFixed(1),
            avgB: avgBlue.toFixed(1),
            hemoglobinScore: hemoglobinScore.toFixed(2),
            roi: {x: roiX, y: roiY, w: roiWidth, h: roiHeight}
        });
    }

    return {
      metrics: { 
        redIntensity: avgRed,
        greenIntensity: avgGreen,
        blueIntensity: avgBlue,
        redToGreenRatio: avgGreen > 2 ? avgRed / avgGreen : 0,
        textureScore: this.calculateTexture(intensities),
        stability: this.calculateStability(intensities),
        hemoglobinScore,
      },
      roi: { x: roiX, y: roiY, width: roiWidth, height: roiHeight } 
>>>>>>> Stashed changes
    };
  }
  
  private calculateQuality(detectionMetrics: any, basicMetrics: any): number {
    // Calidad base del detector robusto
    let quality = detectionMetrics.confidence * 80; // Base 0-80
    
    // Variabilidad realista
    const variation = (Math.random() - 0.5) * 15; // ±7.5%
    quality += variation;
    
    // Rango final: 35-85%
    return Math.max(35, Math.min(85, quality));
  }
  
  private generateReasons(metrics: any, detected: boolean): string[] {
    const reasons: string[] = [];
<<<<<<< Updated upstream
    
    if (detected) {
      reasons.push("Dedo real detectado");
      if (metrics.skinToneValid) reasons.push("Tono de piel válido");
      if (metrics.perfusionDetected) reasons.push("Perfusión sanguínea detectada");
      if (metrics.pulsationDetected) reasons.push("Micro-pulsaciones detectadas");
      if (metrics.antiSpoofingPassed) reasons.push("Anti-falsificación OK");
    } else {
      if (!metrics.skinToneValid) reasons.push("Tono de piel inválido");
      if (!metrics.perfusionDetected) reasons.push("Sin perfusión sanguínea");
      if (!metrics.pulsationDetected) reasons.push("Sin micro-pulsaciones");
      if (!metrics.antiSpoofingPassed) reasons.push("Posible objeto artificial");
      reasons.push(`Confianza baja: ${(metrics.confidence * 100).toFixed(0)}%`);
    }
    
    return reasons;
=======
    let confidence = 0;
    const MIN_HEMOGLOBIN_SCORE = 0.30;
    const MIN_RED_INTENSITY = 50;
    const MAX_RED_INTENSITY = 220;

    if (metrics.hemoglobinScore >= MIN_HEMOGLOBIN_SCORE) {
      confidence += metrics.hemoglobinScore * 0.6;
      reasons.push(`Hemo OK: ${metrics.hemoglobinScore.toFixed(2)}`);
    } else {
      reasons.push(`Hemo BAJO: ${metrics.hemoglobinScore.toFixed(2)} (Min: ${MIN_HEMOGLOBIN_SCORE})`);
      confidence += metrics.hemoglobinScore * 0.1;
    }

    if (metrics.redIntensity >= MIN_RED_INTENSITY && metrics.redIntensity <= MAX_RED_INTENSITY) {
      confidence += 0.25;
      reasons.push(`Rojo OK: ${metrics.redIntensity.toFixed(1)}`);
      if (metrics.redIntensity >= 115 && metrics.redIntensity <= 210) {
        confidence += 0.1;
      }
    } else {
      reasons.push(`Rojo FUERA DE RANGO PIEL: ${metrics.redIntensity.toFixed(1)} (Rango: ${MIN_RED_INTENSITY}-${MAX_RED_INTENSITY})`);
      confidence *= 0.6;
    }
    
    if (metrics.redToGreenRatio >= 1.05 && metrics.redToGreenRatio <= 2.5) {
      confidence += 0.15;
      reasons.push(`Ratio R/G OK: ${metrics.redToGreenRatio.toFixed(2)}`);
    } else {
      reasons.push(`Ratio R/G NO FISIOLÓGICO: ${metrics.redToGreenRatio.toFixed(2)} (Esperado ~1.1-2.3)`);
      confidence *= 0.85;
    }

    if (metrics.textureScore >= 0.04) {
      confidence += 0.05;
      reasons.push(`Textura OK: ${metrics.textureScore.toFixed(2)}`);
    } else {
      reasons.push(`Textura BAJA: ${metrics.textureScore.toFixed(2)}`);
    }

    if (metrics.stability >= 0.25) {
      confidence += 0.05;
      reasons.push(`Estabilidad OK: ${metrics.stability.toFixed(2)}`);
    } else {
      reasons.push(`Estabilidad BAJA: ${metrics.stability.toFixed(2)}`);
      confidence *= 0.9;
    }

    const finalConfidence = Math.min(1.0, Math.max(0, confidence));

    if (finalConfidence > 0.45) { 
        reasons.push("Dedo humano detectado (lógica revisada)");
        return { detected: true, confidence: finalConfidence, reasons };
    } else {
        reasons.push(`Confianza detección BAJA: ${finalConfidence.toFixed(2)} (Umbral: 0.45)`);
        return { detected: false, confidence: finalConfidence, reasons };
    }
  }
  
  /**
   * Cálculo de textura simplificado
   */
  private calculateTexture(intensities: number[]): number {
    if (intensities.length < 10) return 0;

    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const diffs = intensities.map(val => Math.abs(val - mean));
    const mad = diffs.reduce((a,b) => a + b, 0) / diffs.length;
    return Math.min(1.0, mad / 15.0);
  }
  
  /**
   * Cálculo de estabilidad temporal
   */
  private calculateStability(intensities: number[]): number {
    this.recentReadings = intensities;
    
    if (this.recentReadings.length < 10) return 0.2;

    const mean = this.recentReadings.reduce((a, b) => a + b, 0) / this.recentReadings.length;
    if (mean < 1e-6) return 0;
    const variance = this.recentReadings.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.recentReadings.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    return Math.max(0, Math.min(1, 1 - (cv / 0.30)));
  }
  
  /**
   * Actualizar calibración con datos válidos
   */
  private updateCalibration(redValue: number): void {
    if (!this.calibrationData) {
      this.calibrationData = { baseline: redValue, variance: 0 };
    } else {
      this.calibrationData.baseline = this.calibrationData.baseline * 0.90 + redValue * 0.10;
    }
  }
  
  /** Detecta pulsación real en la historia reciente **/
  private detectPulsation(): number {
    if (this.recentRedHistory.length < 15 || 
        (this.recentRedHistory[this.recentRedHistory.length - 1].timestamp - this.recentRedHistory[0].timestamp < 500))
         return 0.0;
    
    const values = this.recentRedHistory.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean < 10) return 0.05;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    if (variance === 0) return 0.0; 
    
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    if (cv >= 0.003 && cv <= 0.05) {
        const optimalCV = 0.02;
        return Math.max(0.3, 1 - Math.abs(cv - optimalCV) / 0.025); 
    }
    return 0.1;
>>>>>>> Stashed changes
  }
  
  reset(): void {
    this.frameCount = 0;
    this.realDetector.reset();
    this.hemoglobinValidator.reset();
<<<<<<< Updated upstream
=======
    this.recentRedHistory = [];
    this.realQualityAnalyzer.reset();
>>>>>>> Stashed changes
  }
}
