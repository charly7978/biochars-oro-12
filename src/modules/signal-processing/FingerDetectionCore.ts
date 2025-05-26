import { HemoglobinValidator } from './HemoglobinValidator';

/**
 * NÚCLEO DE DETECCIÓN DE DEDOS CORREGIDO
 * Sistema simplificado y efectivo para detectar SOLO dedos reales
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
  };
  roi: { x: number; y: number; width: number; height: number };
}

export class FingerDetectionCore {
  private frameCount = 0;
  private recentReadings: number[] = [];
  private calibrationData: { baseline: number; variance: number } | null = null;
  private hemoglobinValidator: HemoglobinValidator;
  private recentRedHistory: { value: number; timestamp: number }[] = []; // Almacena valores y marcas de tiempo
  
  constructor() {
    this.hemoglobinValidator = new HemoglobinValidator();
  }
  
  /**
   * Detección principal CORREGIDA para dedos reales
   */
  detectFinger(imageData: ImageData): FingerDetectionResult {
    this.frameCount++;
    
    // Extraer datos básicos del frame
    const { metrics, roi } = this.extractBasicMetrics(imageData);
    
    // Almacenar historial de intensidad roja para detección de pulsaciones
    this.recentRedHistory.push({ value: metrics.redIntensity, timestamp: Date.now() });
    if (this.recentRedHistory.length > 120) { // ~4 segundos a 30 FPS
      this.recentRedHistory.shift();
    }
    
    // Validación por pasos para dedos reales
    const validation = this.validateRealFinger(metrics);
    
    // Nueva verificación: presencia de pulsación
    const pulsationDetected = this.detectPulsation();
    if (validation.detected && !pulsationDetected) {
      validation.detected = false;
      validation.reasons.unshift('No se detectó pulsación');
      validation.confidence *= 0.6;
    }
    
    // Actualizar calibración con datos válidos
    if (validation.detected) {
      this.updateCalibration(metrics.redIntensity);
    }
    
    // Calcular calidad realista
    const quality = this.calculateRealisticQuality(metrics, validation.detected, validation.confidence);
    
    if (this.frameCount % 30 === 0) {
      console.log("FingerDetectionCore:", {
        detected: validation.detected,
        quality: quality.toFixed(1),
        redIntensity: metrics.redIntensity.toFixed(1),
        ratio: metrics.redToGreenRatio.toFixed(2),
        hemoglobin: metrics.hemoglobinScore.toFixed(2),
        reason: validation.reasons[0]
      });
    }
    
    return {
      detected: validation.detected,
      confidence: validation.confidence,
      quality,
      reasons: validation.reasons,
      metrics: {
        ...metrics,
        hemoglobinScore: metrics.hemoglobinScore
      },
      roi
    };
  }
  
  /**
   * Extracción básica y directa de métricas
   */
  private extractBasicMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // ROI central para capturar el dedo
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const roiSize = Math.min(width, height) * 0.25;
    const roiX = centerX - roiSize / 2;
    const roiY = centerY - roiSize / 2;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = [];
    
    // Muestreo en el centro de la imagen
    const step = 2;
    for (let y = centerY - roiSize/2; y < centerY + roiSize/2; y += step) {
      for (let x = centerX - roiSize/2; x < centerX + roiSize/2; x += step) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (Math.floor(y) * width + Math.floor(x)) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          redSum += r;
          greenSum += g;
          blueSum += b;
          intensities.push((r + g + b) / 3);
          validPixels++;
        }
      }
    }
    
    const avgRed = validPixels > 0 ? redSum / validPixels : 0;
    const avgGreen = validPixels > 0 ? greenSum / validPixels : 0;
    const avgBlue = validPixels > 0 ? blueSum / validPixels : 0;
    
    const hemoglobinScore = this.hemoglobinValidator.validateHemoglobinSignature(avgRed, avgGreen, avgBlue);

    return {
      metrics: {
        redIntensity: avgRed,
        greenIntensity: avgGreen,
        blueIntensity: avgBlue,
        redToGreenRatio: avgGreen > 10 ? avgRed / avgGreen : 0,
        textureScore: this.calculateTexture(intensities),
        stability: this.calculateStability(avgRed),
        hemoglobinScore,
      },
      roi: { x: roiX, y: roiY, width: roiSize, height: roiSize }
    };
  }
  
  /**
   * Validación CORREGIDA para dedos reales
   */
  private validateRealFinger(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0;
    const MIN_HEMOGLOBIN_SCORE = 0.45;

    // 0. Hemoglobin signature (most important for human finger)
    if (metrics.hemoglobinScore < MIN_HEMOGLOBIN_SCORE) {
      reasons.push(`Firma de hemoglobina baja: ${metrics.hemoglobinScore.toFixed(2)} (Min: ${MIN_HEMOGLOBIN_SCORE})`);
      return { detected: false, confidence: metrics.hemoglobinScore * 0.5, reasons };
    }
    confidence += metrics.hemoglobinScore * 0.5;

    // 1. Intensidad roja debe estar en rango fisiológico
    if (metrics.redIntensity < 50 || metrics.redIntensity > 220) {
      reasons.push(`Intensidad roja fuera de rango: ${metrics.redIntensity.toFixed(1)}`);
      return { detected: false, confidence: confidence * 0.7, reasons };
    }
    const redOptimalRange = [100, 180];
    if (metrics.redIntensity >= redOptimalRange[0] && metrics.redIntensity <= redOptimalRange[1]) {
        confidence += 0.2;
    } else {
        confidence += 0.1;
    }

    // 2. Ratio rojo/verde debe indicar presencia de sangre
    if (metrics.redToGreenRatio < 0.5 || metrics.redToGreenRatio > 4.0) {
      reasons.push(`Ratio R/G no fisiológico: ${metrics.redToGreenRatio.toFixed(2)}`);
      return { detected: false, confidence: confidence * 0.8, reasons };
    }
    confidence += 0.15;

    // 3. Debe haber algo de textura (no superficie lisa)
    if (metrics.textureScore < 0.08) {
      reasons.push(`Textura de piel baja: ${metrics.textureScore.toFixed(2)}`);
      return { detected: false, confidence: confidence * 0.9, reasons };
    }
    confidence += 0.1;

    // 4. Estabilidad moderada (no demasiado estable ni inestable)
    if (metrics.stability < 0.2 || metrics.stability > 0.95) {
      reasons.push(`Estabilidad fuera de rango: ${metrics.stability.toFixed(2)}`);
      confidence *= 0.9; 
    } else {
      confidence += 0.05;
    }
    
    const finalConfidence = Math.min(1.0, confidence);

    if (finalConfidence > 0.65) {
        reasons.push("Dedo humano detectado correctamente");
        return { detected: true, confidence: finalConfidence, reasons };
    } else {
        reasons.push("Confianza de detección baja");
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
  private calculateStability(redValue: number): number {
    this.recentReadings.push(redValue);
    if (this.recentReadings.length > 15) {
      this.recentReadings.shift();
    }
    
    if (this.recentReadings.length < 7) return 0.5;
    
    const mean = this.recentReadings.reduce((a, b) => a + b, 0) / this.recentReadings.length;
    if (mean === 0) return 0;
    const variance = this.recentReadings.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.recentReadings.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    return Math.max(0, Math.min(1, 1 - (cv / 0.25)));
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
  
  /**
   * Calcular calidad realista basada en métricas
   */
  private calculateRealisticQuality(metrics: any, detected: boolean, detectionConfidence: number): number {
    if (!detected) {
      return Math.min(30, detectionConfidence * 40 + Math.random() * 5); 
    }
    
    let quality = 0;

    quality += Math.min(35, metrics.hemoglobinScore * 35);
    
    const redIntensityScore = Math.max(0, 25 - (Math.abs(metrics.redIntensity - 140) / 60) * 25);
    quality += redIntensityScore;
    
    const ratioOptimal = 1.3;
    const ratioDeviation = Math.abs(metrics.redToGreenRatio - ratioOptimal);
    const ratioScore = Math.max(0, 15 - (ratioDeviation / 0.5) * 15);
    quality += ratioScore;

    const textureContribution = Math.min(10, metrics.textureScore * 15);
    quality += textureContribution;

    const stabilityContribution = Math.min(15, metrics.stability * 15);
    quality += stabilityContribution;
    
    quality = Math.min(100, quality);

    const variabilityMagnitude = (1 - detectionConfidence) * 10;
    const variation = (Math.random() - 0.5) * variabilityMagnitude;
    
    let finalQuality = Math.max(35, Math.min(98, quality + variation));
    
    if (metrics.hemoglobinScore < 0.5) {
        finalQuality = Math.min(finalQuality, 50);
    }

    return finalQuality;
  }
  
  /** Detecta pulsación real en la historia reciente **/
  private detectPulsation(): boolean {
    if (this.recentRedHistory.length < 25) return false; // Necesitamos al menos ~1 s de datos
    const timespan = this.recentRedHistory[this.recentRedHistory.length - 1].timestamp - this.recentRedHistory[0].timestamp;
    if (timespan < 1000) return false;

    const values = this.recentRedHistory.map(p => p.value);
    return this.hemoglobinValidator.detectPulsation(values, timespan);
  }
  
  reset(): void {
    this.frameCount = 0;
    this.recentReadings = [];
    this.calibrationData = null;
    this.hemoglobinValidator.reset();
    this.recentRedHistory = [];
  }
}
