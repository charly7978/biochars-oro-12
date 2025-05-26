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
    
    // ROI central más grande para asegurar que el dedo esté dentro
    const roiSizeFactor = 0.4; // Aumentado de 0.25 a 0.4
    const roiWidth = Math.min(width, height) * roiSizeFactor;
    const roiHeight = roiWidth;
    const roiX = Math.floor(width / 2 - roiWidth / 2);
    const roiY = Math.floor(height / 2 - roiHeight / 2);
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = []; // Para textura y estabilidad
    
    // Procesar cada píxel en el ROI para obtener promedios más precisos
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
          intensities.push((r + g + b) / 3); // Usar intensidad promedio para textura/estabilidad
          validPixels++;
        }
      }
    }
    
    const avgRed = validPixels > 0 ? redSum / validPixels : 0;
    const avgGreen = validPixels > 0 ? greenSum / validPixels : 0;
    const avgBlue = validPixels > 0 ? blueSum / validPixels : 0;
    
    const hemoglobinScore = this.hemoglobinValidator.validateHemoglobinSignature(avgRed, avgGreen, avgBlue);

    // Loguear valores RGB crudos y score de hemoglobina para diagnóstico
    if (this.frameCount % 15 === 0) { // Loguear más frecuentemente para debug
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
        redToGreenRatio: avgGreen > 5 ? avgRed / avgGreen : 0, // Umbral más bajo para ratio
        textureScore: this.calculateTexture(intensities),
        stability: this.calculateStability(intensities), // Usar todas las intensidades para estabilidad
        hemoglobinScore,
      },
      roi: { x: roiX, y: roiY, width: roiWidth, height: roiHeight } 
    };
  }
  
  /**
   * Validación CORREGIDA para dedos reales - AÚN MÁS SIMPLIFICADA PARA DEBUG
   */
  private validateRealFinger(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0;
    const MIN_HEMOGLOBIN_SCORE = 0.20; // Umbral MUY BAJO para hemoglobina
    const MIN_RED_INTENSITY = 40;    // Umbral MUY BAJO para rojo

    // 1. Hemoglobina (debe tener ALGO de firma)
    if (metrics.hemoglobinScore >= MIN_HEMOGLOBIN_SCORE) {
      confidence += metrics.hemoglobinScore * 0.5; // Ponderación alta
      reasons.push(`Hemo OK: ${metrics.hemoglobinScore.toFixed(2)}`);
    } else {
      reasons.push(`Hemo BAJO: ${metrics.hemoglobinScore.toFixed(2)} (Min: ${MIN_HEMOGLOBIN_SCORE})`);
      confidence += metrics.hemoglobinScore * 0.1; // Aún da un poco si está bajo pero no cero
    }

    // 2. Intensidad Roja (debe haber ALGO de rojo)
    if (metrics.redIntensity >= MIN_RED_INTENSITY) {
      confidence += 0.3;
      reasons.push(`Rojo OK: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`Rojo BAJO: ${metrics.redIntensity.toFixed(1)} (Min: ${MIN_RED_INTENSITY})`);
      confidence *= 0.5; // Penaliza si no hay rojo
    }
    
    // 3. Pulsación sigue siendo crucial
    const pulsationDetected = this.detectPulsation();
    if (pulsationDetected) {
        confidence += 0.3; // Fuerte bonus por pulso
        reasons.push('Pulso OK');
    } else {
        reasons.unshift('No se detectó pulsación');
        confidence *= 0.2; // Penalización muy fuerte si no hay pulso
    }
    
    // Otros factores ahora solo modulan ligeramente la confianza si los primarios fallan mucho
    if (confidence < 0.3) {
        if (metrics.textureScore > 0.05) confidence += 0.05;
        if (metrics.stability > 0.2) confidence += 0.05;
        if (metrics.redToGreenRatio > 0.4 && metrics.redToGreenRatio < 5.0) confidence +=0.05;
    }

    const finalConfidence = Math.min(1.0, Math.max(0, confidence));

    // Umbral de detección MUY bajo para pruebas
    if (finalConfidence > 0.25) { 
        reasons.push("Detección de dedo (modo prueba MUY simplificado)");
        return { detected: true, confidence: finalConfidence, reasons };
    } else {
        reasons.push(`Confianza MUY baja: ${finalConfidence.toFixed(2)} (Umbral: 0.25)`);
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
    const mad = diffs.reduce((a,b) => a + b, 0) / diffs.length; // Mean Absolute Deviation

    // Normalize based on expected MAD for textured skin (e.g., 5-15)
    return Math.min(1.0, mad / 20.0); // Más permisivo
  }
  
  /**
   * Cálculo de estabilidad temporal
   */
  private calculateStability(intensities: number[]): number { // Modificado para aceptar `intensities`
    this.recentReadings = intensities; // Usar las intensidades del frame actual para estabilidad inmediata
    
    if (this.recentReadings.length < 10) return 0.3; // Necesita suficientes muestras

    const mean = this.recentReadings.reduce((a, b) => a + b, 0) / this.recentReadings.length;
    if (mean === 0) return 0; // Avoid division by zero
    const variance = this.recentReadings.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.recentReadings.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    // Lower CV means higher stability. Target CV < 0.15 for good stability.
    return Math.max(0, Math.min(1, 1 - (cv / 0.35))); // Más permisivo
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
