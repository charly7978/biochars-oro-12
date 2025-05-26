import { HemoglobinValidator } from './HemoglobinValidator';
import { RealSignalQualityAnalyzer } from './RealSignalQualityAnalyzer';

/**
 * NÚCLEO DE DETECCIÓN DE DEDOS 100% REAL
 * Sistema estricto para detectar SOLO dedos humanos reales
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
  private frameCount = 0;
  private recentReadings: number[] = [];
  private calibrationData: { baseline: number; variance: number } | null = null;
  private hemoglobinValidator: HemoglobinValidator;
  private realQualityAnalyzer: RealSignalQualityAnalyzer;
  private recentRedHistory: { value: number; timestamp: number }[] = [];
  private rawRedIntensityHistory: number[] = [];

  constructor() { 
    this.hemoglobinValidator = new HemoglobinValidator();
    this.realQualityAnalyzer = new RealSignalQualityAnalyzer();
  }

  /**
   * Detección principal 100% REAL para dedos humanos
   */
  detectFinger(imageData: ImageData): FingerDetectionResult {
    this.frameCount++;

    const { metrics, roi } = this.extractBasicMetrics(imageData);

    this.rawRedIntensityHistory.push(metrics.redIntensity);
    if (this.rawRedIntensityHistory.length > 30) {
        this.rawRedIntensityHistory.shift();
    }

    this.recentRedHistory.push({ value: metrics.redIntensity, timestamp: Date.now() });
    if (this.recentRedHistory.length > 120) { 
      this.recentRedHistory.shift();
    }

    const validation = this.validateRealFinger(metrics);
    const pulsationStrength = this.detectRealPulsation();
    const pulsationScore = pulsationStrength ? 1.0 : 0.1;

    // Validación estricta: DEBE tener pulsación para ser considerado dedo real
    if (validation.detected && !pulsationStrength) {
      validation.detected = false;
      validation.reasons.unshift('No se detectó pulsación cardíaca real');
      validation.confidence *= 0.1;
    }

    if (validation.detected) {
      this.updateCalibration(metrics.redIntensity);
    }
    
    let noiseEstimate = 5;
    if (this.rawRedIntensityHistory.length >= 10) {
      const recentRaw = this.rawRedIntensityHistory.slice(-10);
      const mean = recentRaw.reduce((a,b) => a+b,0) / recentRaw.length;
      const variance = recentRaw.reduce((acc, val) => acc + Math.pow(val - mean, 2),0) / recentRaw.length;
      const stdDev = Math.sqrt(variance);
      noiseEstimate = Math.max(0.5, stdDev * 0.35);
    }
    
    const quality = this.realQualityAnalyzer.calculateQuality(
      metrics.redIntensity,
      noiseEstimate,
      metrics.hemoglobinScore,
      pulsationScore,
      validation.detected
    );
    
    if (this.frameCount % 15 === 0) {
      console.log("[FingerDetectionCore REAL]", {
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
      });
    }
    
    return {
      detected: validation.detected,
      confidence: validation.confidence,
      quality,
      reasons: validation.reasons,
      metrics: {
        ...metrics,
        pulsationStrength: pulsationScore
      },
      roi
    };
  }
  
  private extractBasicMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
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
        redToGreenRatio: avgGreen > 2 ? avgRed / avgGreen : 0,
        textureScore: this.calculateTexture(intensities),
        stability: this.calculateStability(intensities),
        hemoglobinScore,
      },
      roi: { x: roiX, y: roiY, width: roiWidth, height: roiHeight } 
    };
  }
  
  private validateRealFinger(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0;
    
    // Umbrales MÁS ESTRICTOS para eliminar falsos positivos
    const MIN_HEMOGLOBIN_SCORE = 0.45; // INCREMENTADO de 0.35
    const MIN_RED_INTENSITY = 70; // INCREMENTADO de 60
    const MAX_RED_INTENSITY = 190; // REDUCIDO de 200
    const MIN_RG_RATIO = 1.2; // INCREMENTADO de 1.15
    const MAX_RG_RATIO = 2.0; // REDUCIDO de 2.2
    const MIN_TEXTURE = 0.08; // INCREMENTADO de 0.06
    const MIN_STABILITY = 0.4; // INCREMENTADO de 0.35

    // Validación de hemoglobina MÁS ESTRICTA
    if (metrics.hemoglobinScore >= MIN_HEMOGLOBIN_SCORE) {
      confidence += metrics.hemoglobinScore * 0.5; // REDUCIDO peso
      reasons.push(`Hemoglobina OK: ${metrics.hemoglobinScore.toFixed(2)}`);
    } else {
      reasons.push(`Hemoglobina INSUFICIENTE: ${metrics.hemoglobinScore.toFixed(2)} (Min: ${MIN_HEMOGLOBIN_SCORE})`);
      confidence += metrics.hemoglobinScore * 0.02; // Mayor penalización
    }

    // Validación de intensidad roja MÁS ESTRICTA
    if (metrics.redIntensity >= MIN_RED_INTENSITY && metrics.redIntensity <= MAX_RED_INTENSITY) {
      confidence += 0.2; // REDUCIDO de 0.25
      reasons.push(`Intensidad roja OK: ${metrics.redIntensity.toFixed(1)}`);
      
      // Bonus solo para rango óptimo MÁS ESTRECHO
      if (metrics.redIntensity >= 130 && metrics.redIntensity <= 180) {
        confidence += 0.05; // REDUCIDO de 0.1
      }
    } else {
      reasons.push(`Intensidad roja FUERA DE RANGO: ${metrics.redIntensity.toFixed(1)} (${MIN_RED_INTENSITY}-${MAX_RED_INTENSITY})`);
      confidence *= 0.3; // Mayor penalización
    }
    
    // Validación de ratio R/G MÁS ESTRICTA
    if (metrics.redToGreenRatio >= MIN_RG_RATIO && metrics.redToGreenRatio <= MAX_RG_RATIO) {
      confidence += 0.1; // REDUCIDO de 0.15
      reasons.push(`Ratio R/G OK: ${metrics.redToGreenRatio.toFixed(2)}`);
    } else {
      reasons.push(`Ratio R/G ANORMAL: ${metrics.redToGreenRatio.toFixed(2)} (${MIN_RG_RATIO}-${MAX_RG_RATIO})`);
      confidence *= 0.7; // Mayor penalización
    }

    // Validación de textura MÁS ESTRICTA
    if (metrics.textureScore >= MIN_TEXTURE) {
      confidence += 0.05;
      reasons.push(`Textura OK: ${metrics.textureScore.toFixed(2)}`);
    } else {
      reasons.push(`Textura INSUFICIENTE: ${metrics.textureScore.toFixed(2)}`);
      confidence *= 0.8;
    }

    // Validación de estabilidad MÁS ESTRICTA
    if (metrics.stability >= MIN_STABILITY) {
      confidence += 0.05;
      reasons.push(`Estabilidad OK: ${metrics.stability.toFixed(2)}`);
    } else {
      reasons.push(`Estabilidad INSUFICIENTE: ${metrics.stability.toFixed(2)}`);
      confidence *= 0.8;
    }

    const finalConfidence = Math.min(1.0, Math.max(0, confidence));

    // Umbral final MÁS ESTRICTO
    if (finalConfidence > 0.60) { // INCREMENTADO de 0.50
        reasons.push("Dedo humano validado (criterios estrictos)");
        return { detected: true, confidence: finalConfidence, reasons };
    } else {
        reasons.push(`Confianza INSUFICIENTE: ${finalConfidence.toFixed(2)} (Umbral: 0.60)`);
        return { detected: false, confidence: finalConfidence, reasons };
    }
  }
  
  private detectRealPulsation(): number {
    if (this.recentRedHistory.length < 25 || // INCREMENTADO de 20
        (this.recentRedHistory[this.recentRedHistory.length - 1].timestamp - this.recentRedHistory[0].timestamp < 1000)) // INCREMENTADO de 800ms
         return 0.0;
    
    const values = this.recentRedHistory.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean < 20) return 0.05; // INCREMENTADO de 15
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    if (variance === 0) return 0.0; 
    
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    // Rango MÁS ESTRICTO para pulsación cardíaca válida
    if (cv >= 0.008 && cv <= 0.025) { // Rango más estrecho
        const optimalCV = 0.015;
        return Math.max(0.5, 1 - Math.abs(cv - optimalCV) / 0.015); 
    }
    return 0.1;
  }
  
  private calculateTexture(intensities: number[]): number {
    if (intensities.length < 10) return 0;

    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const diffs = intensities.map(val => Math.abs(val - mean));
    const mad = diffs.reduce((a,b) => a + b, 0) / diffs.length;
    return Math.min(1.0, mad / 15.0);
  }
  
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
  
  private updateCalibration(redValue: number): void {
    if (!this.calibrationData) {
      this.calibrationData = { baseline: redValue, variance: 0 };
    } else {
      this.calibrationData.baseline = this.calibrationData.baseline * 0.90 + redValue * 0.10;
    }
  }
  
  reset(): void {
    this.frameCount = 0;
    this.recentReadings = [];
    this.calibrationData = null;
    this.hemoglobinValidator.reset();
    this.recentRedHistory = [];
    this.rawRedIntensityHistory = [];
    if (this.realQualityAnalyzer) {
      this.realQualityAnalyzer.reset();
    }
  }
}
