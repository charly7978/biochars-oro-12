
import { HemoglobinValidator } from './HemoglobinValidator';
import { RealSignalQualityAnalyzer } from './RealSignalQualityAnalyzer';

/**
 * NÚCLEO DE DETECCIÓN DE DEDOS 100% REAL - VERSIÓN MEJORADA
 * Sistema ultra-preciso para detectar SOLO dedos humanos reales
 * Algoritmos mejorados basados en características fisiológicas
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
    perfusionIndex: number;
    skinConsistency: number;
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
  private perfusionHistory: number[] = [];
  private skinConsistencyBuffer: number[] = [];
  private spatialVarianceHistory: number[] = [];

  constructor() { 
    this.hemoglobinValidator = new HemoglobinValidator();
    this.realQualityAnalyzer = new RealSignalQualityAnalyzer();
  }

  /**
   * Detección principal MEJORADA para dedos humanos
   */
  detectFinger(imageData: ImageData): FingerDetectionResult {
    this.frameCount++;

    const { metrics, roi } = this.extractEnhancedMetrics(imageData);

    this.rawRedIntensityHistory.push(metrics.redIntensity);
    if (this.rawRedIntensityHistory.length > 45) {
        this.rawRedIntensityHistory.shift();
    }

    this.recentRedHistory.push({ value: metrics.redIntensity, timestamp: Date.now() });
    if (this.recentRedHistory.length > 150) { 
      this.recentRedHistory.shift();
    }

    const validation = this.validateRealFingerEnhanced(metrics);
    const pulsationStrength = this.detectEnhancedPulsation();
    const pulsationScore = pulsationStrength;

    // Validación estricta mejorada: DEBE tener pulsación para ser considerado dedo real
    if (validation.detected && pulsationStrength < 0.3) {
      validation.detected = false;
      validation.reasons.unshift('Pulsación cardíaca insuficiente detectada');
      validation.confidence *= 0.05;
    }

    if (validation.detected) {
      this.updateAdvancedCalibration(metrics.redIntensity, metrics.perfusionIndex);
    }
    
    // Estimación mejorada de ruido basada en análisis espectral
    let noiseEstimate = this.calculateAdvancedNoiseEstimate();
    
    const quality = this.realQualityAnalyzer.calculateQuality(
      metrics.redIntensity,
      noiseEstimate,
      metrics.hemoglobinScore,
      pulsationScore,
      validation.detected
    );
    
    if (this.frameCount % 20 === 0) {
      console.log("[FingerDetectionCore MEJORADO]", {
        detected: validation.detected,
        quality: quality.toFixed(1),
        confidence: validation.confidence.toFixed(3),
        reasons: validation.reasons.slice(0, 2).join(', '),
        metrics: {
          red: metrics.redIntensity.toFixed(1),
          rgRatio: metrics.redToGreenRatio.toFixed(3),
          hemo: metrics.hemoglobinScore.toFixed(3),
          pulsation: pulsationScore.toFixed(3),
          perfusion: metrics.perfusionIndex.toFixed(3),
          consistency: metrics.skinConsistency.toFixed(3)
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
  
  private extractEnhancedMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // ROI adaptativo basado en densidad de píxeles
    const roiSizeFactor = 0.32; // Ligeramente más pequeño para mayor precisión
    const roiWidth = Math.min(width, height) * roiSizeFactor;
    const roiHeight = roiWidth;
    const roiX = Math.floor(width / 2 - roiWidth / 2);
    const roiY = Math.floor(height / 2 - roiHeight / 2);
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixels = 0;
    const intensities: number[] = [];
    const spatialVariances: number[] = [];
    
    // Análisis mejorado con muestreo espacial
    for (let y = roiY; y < roiY + roiHeight; y += 2) {
      for (let x = roiX; x < roiX + roiWidth; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          redSum += r;
          greenSum += g;
          blueSum += b;
          intensities.push((r + g + b) / 3);
          
          // Calcular varianza espacial local (3x3)
          if (x > roiX + 2 && x < roiX + roiWidth - 2 && y > roiY + 2 && y < roiY + roiHeight - 2) {
            const localVariance = this.calculateLocalVariance(data, x, y, width);
            spatialVariances.push(localVariance);
          }
          
          validPixels++;
        }
      }
    }
    
    const avgRed = validPixels > 0 ? redSum / validPixels : 0;
    const avgGreen = validPixels > 0 ? greenSum / validPixels : 0;
    const avgBlue = validPixels > 0 ? blueSum / validPixels : 0;
    
    // Validaciones mejoradas
    const hemoglobinScore = this.hemoglobinValidator.validateHemoglobinSignature(avgRed, avgGreen, avgBlue);
    const perfusionIndex = this.calculatePerfusionIndex(avgRed, avgGreen, intensities);
    const skinConsistency = this.calculateSkinConsistency(spatialVariances);

    return {
      metrics: { 
        redIntensity: avgRed,
        greenIntensity: avgGreen,
        blueIntensity: avgBlue,
        redToGreenRatio: avgGreen > 3 ? avgRed / avgGreen : 0,
        textureScore: this.calculateEnhancedTexture(intensities),
        stability: this.calculateEnhancedStability(intensities),
        hemoglobinScore,
        perfusionIndex,
        skinConsistency,
        pulsationStrength: 0 // Se calculará después
      },
      roi: { x: roiX, y: roiY, width: roiWidth, height: roiHeight } 
    };
  }
  
  private calculateLocalVariance(data: Uint8ClampedArray, centerX: number, centerY: number, width: number): number {
    const values: number[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const index = (y * width + x) * 4;
        const intensity = (data[index] + data[index + 1] + data[index + 2]) / 3;
        values.push(intensity);
      }
    }
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  private calculatePerfusionIndex(red: number, green: number, intensities: number[]): number {
    if (intensities.length < 10) return 0;
    
    // Índice de perfusión basado en pulsatilidad de la señal
    const maxIntensity = Math.max(...intensities);
    const minIntensity = Math.min(...intensities);
    const meanIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    
    if (meanIntensity === 0) return 0;
    
    const pulsatilityIndex = (maxIntensity - minIntensity) / meanIntensity;
    
    // Combinar con ratio R/G para validación vascular
    const vascularComponent = green > 0 ? Math.min(2.5, red / green) / 2.5 : 0;
    
    this.perfusionHistory.push(pulsatilityIndex * vascularComponent);
    if (this.perfusionHistory.length > 20) {
      this.perfusionHistory.shift();
    }
    
    // Promedio temporal para estabilidad
    const avgPerfusion = this.perfusionHistory.reduce((a, b) => a + b, 0) / this.perfusionHistory.length;
    
    return Math.max(0, Math.min(1, avgPerfusion));
  }
  
  private calculateSkinConsistency(spatialVariances: number[]): number {
    if (spatialVariances.length < 5) return 0;
    
    const avgVariance = spatialVariances.reduce((a, b) => a + b, 0) / spatialVariances.length;
    const varianceOfVariances = spatialVariances.reduce((acc, val) => acc + Math.pow(val - avgVariance, 2), 0) / spatialVariances.length;
    
    // La piel real tiene varianza espacial consistente pero no uniforme
    const consistencyScore = avgVariance > 0 ? 1 / (1 + Math.sqrt(varianceOfVariances) / avgVariance) : 0;
    
    this.skinConsistencyBuffer.push(consistencyScore);
    if (this.skinConsistencyBuffer.length > 15) {
      this.skinConsistencyBuffer.shift();
    }
    
    return this.skinConsistencyBuffer.reduce((a, b) => a + b, 0) / this.skinConsistencyBuffer.length;
  }
  
  private validateRealFingerEnhanced(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0;
    
    // Umbrales MEJORADOS y más precisos
    const MIN_HEMOGLOBIN_SCORE = 0.42;
    const MIN_RED_INTENSITY = 75;
    const MAX_RED_INTENSITY = 185;
    const MIN_RG_RATIO = 1.25;
    const MAX_RG_RATIO = 1.95;
    const MIN_TEXTURE = 0.10;
    const MIN_STABILITY = 0.45;
    const MIN_PERFUSION = 0.15;
    const MIN_SKIN_CONSISTENCY = 0.25;

    // Validación de hemoglobina con mayor peso
    if (metrics.hemoglobinScore >= MIN_HEMOGLOBIN_SCORE) {
      const hemoBonus = (metrics.hemoglobinScore - MIN_HEMOGLOBIN_SCORE) / (1 - MIN_HEMOGLOBIN_SCORE);
      confidence += 0.35 + (hemoBonus * 0.15);
      reasons.push(`Hemoglobina: ${metrics.hemoglobinScore.toFixed(3)}`);
    } else {
      reasons.push(`Hemoglobina INSUF: ${metrics.hemoglobinScore.toFixed(3)}`);
      confidence += metrics.hemoglobinScore * 0.1;
    }

    // Validación de intensidad roja mejorada
    if (metrics.redIntensity >= MIN_RED_INTENSITY && metrics.redIntensity <= MAX_RED_INTENSITY) {
      confidence += 0.20;
      reasons.push(`Rojo: ${metrics.redIntensity.toFixed(1)}`);
      
      // Bonus para rango óptimo
      if (metrics.redIntensity >= 120 && metrics.redIntensity <= 170) {
        confidence += 0.08;
      }
    } else {
      reasons.push(`Rojo FUERA: ${metrics.redIntensity.toFixed(1)}`);
      confidence *= 0.4;
    }
    
    // Validación de ratio R/G mejorada
    if (metrics.redToGreenRatio >= MIN_RG_RATIO && metrics.redToGreenRatio <= MAX_RG_RATIO) {
      confidence += 0.15;
      reasons.push(`R/G: ${metrics.redToGreenRatio.toFixed(3)}`);
    } else {
      reasons.push(`R/G ANOM: ${metrics.redToGreenRatio.toFixed(3)}`);
      confidence *= 0.6;
    }

    // Validación de perfusión (NUEVO)
    if (metrics.perfusionIndex >= MIN_PERFUSION) {
      confidence += 0.12;
      reasons.push(`Perfusión: ${metrics.perfusionIndex.toFixed(3)}`);
    } else {
      reasons.push(`Perfusión BAJA: ${metrics.perfusionIndex.toFixed(3)}`);
      confidence *= 0.7;
    }

    // Validación de consistencia de piel (NUEVO)
    if (metrics.skinConsistency >= MIN_SKIN_CONSISTENCY) {
      confidence += 0.08;
      reasons.push(`Consistencia: ${metrics.skinConsistency.toFixed(3)}`);
    } else {
      reasons.push(`Consistencia BAJA: ${metrics.skinConsistency.toFixed(3)}`);
      confidence *= 0.8;
    }

    // Validaciones adicionales
    if (metrics.textureScore >= MIN_TEXTURE) {
      confidence += 0.05;
    } else {
      confidence *= 0.85;
    }

    if (metrics.stability >= MIN_STABILITY) {
      confidence += 0.05;
    } else {
      confidence *= 0.85;
    }

    const finalConfidence = Math.min(1.0, Math.max(0, confidence));

    // Umbral final más estricto y adaptativo
    const dynamicThreshold = 0.65 + (this.frameCount < 60 ? 0.05 : 0); // Más estricto después de calibración
    
    if (finalConfidence > dynamicThreshold) {
        reasons.push("Dedo validado (criterios mejorados)");
        return { detected: true, confidence: finalConfidence, reasons };
    } else {
        reasons.push(`Confianza INSUF: ${finalConfidence.toFixed(3)} (Umbral: ${dynamicThreshold.toFixed(2)})`);
        return { detected: false, confidence: finalConfidence, reasons };
    }
  }
  
  private detectEnhancedPulsation(): number {
    if (this.recentRedHistory.length < 30 || 
        (this.recentRedHistory[this.recentRedHistory.length - 1].timestamp - this.recentRedHistory[0].timestamp < 1200))
         return 0.0;
    
    const values = this.recentRedHistory.map(p => p.value);
    const timestamps = this.recentRedHistory.map(p => p.timestamp);
    
    // Análisis mejorado de pulsación con múltiples métricas
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean < 25) return 0.0;
    
    // 1. Análisis de variabilidad temporal
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    // 2. Análisis de periodicidad (detección de picos)
    const peaks = this.detectPeriodicPeaks(values, timestamps);
    const periodicityScore = this.calculatePeriodicityScore(peaks, timestamps);
    
    // 3. Análisis de coherencia espectral
    const spectralCoherence = this.calculateSpectralCoherence(values);
    
    // Combinar métricas para score final
    let pulsationScore = 0;
    
    // Variabilidad cardiovascular (50-120 BPM esperado)
    if (cv >= 0.012 && cv <= 0.035) {
        const optimalCV = 0.020;
        const cvScore = 1 - Math.abs(cv - optimalCV) / 0.015;
        pulsationScore += cvScore * 0.4;
    }
    
    // Periodicidad de picos
    pulsationScore += periodicityScore * 0.35;
    
    // Coherencia espectral
    pulsationScore += spectralCoherence * 0.25;
    
    return Math.max(0.0, Math.min(1.0, pulsationScore));
  }
  
  private detectPeriodicPeaks(values: number[], timestamps: number[]): number[] {
    const peaks: number[] = [];
    const threshold = values.reduce((a, b) => a + b, 0) / values.length * 1.02;
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > threshold &&
          values[i] > values[i-1] && values[i] > values[i-2] &&
          values[i] > values[i+1] && values[i] > values[i+2]) {
        
        // Evitar picos muy cercanos (min 400ms entre picos = max 150 BPM)
        if (peaks.length === 0 || timestamps[i] - peaks[peaks.length - 1] > 400) {
          peaks.push(timestamps[i]);
        }
      }
    }
    
    return peaks;
  }
  
  private calculatePeriodicityScore(peaks: number[], timestamps: number[]): number {
    if (peaks.length < 3) return 0;
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    if (intervals.length < 2) return 0;
    
    // Evaluar consistencia de intervalos (variabilidad normal del corazón: 5-15%)
    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalVariance = intervals.reduce((acc, val) => acc + Math.pow(val - meanInterval, 2), 0) / intervals.length;
    const intervalCV = Math.sqrt(intervalVariance) / meanInterval;
    
    // Score basado en periodicidad natural del corazón
    if (meanInterval >= 500 && meanInterval <= 1500 && intervalCV <= 0.25) {
      return Math.max(0, 1 - intervalCV / 0.15);
    }
    
    return 0;
  }
  
  private calculateSpectralCoherence(values: number[]): number {
    if (values.length < 20) return 0;
    
    // Análisis de coherencia espectral simplificado
    // Buscar componentes de frecuencia cardíaca (0.8-3.0 Hz)
    const n = values.length;
    const samplingRate = 30; // FPS aproximado
    
    // FFT simplificada para frecuencias cardíacas
    let heartRateEnergy = 0;
    let totalEnergy = 0;
    
    for (let k = 1; k < n / 2; k++) {
      const freq = (k * samplingRate) / n;
      
      // Calcular magnitud espectral (aproximación)
      let real = 0, imag = 0;
      for (let i = 0; i < n; i++) {
        const angle = -2 * Math.PI * k * i / n;
        real += values[i] * Math.cos(angle);
        imag += values[i] * Math.sin(angle);
      }
      
      const magnitude = Math.sqrt(real * real + imag * imag);
      totalEnergy += magnitude;
      
      // Frecuencias cardíacas típicas (0.8-3.0 Hz = 48-180 BPM)
      if (freq >= 0.8 && freq <= 3.0) {
        heartRateEnergy += magnitude;
      }
    }
    
    return totalEnergy > 0 ? heartRateEnergy / totalEnergy : 0;
  }
  
  private calculateEnhancedTexture(intensities: number[]): number {
    if (intensities.length < 15) return 0;

    // Análisis multi-escala de textura
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    
    // 1. Desviación absoluta media (robusta a outliers)
    const mad = intensities.map(val => Math.abs(val - mean)).reduce((a, b) => a + b, 0) / intensities.length;
    
    // 2. Análisis de gradientes locales
    const gradients = [];
    for (let i = 1; i < intensities.length; i++) {
      gradients.push(Math.abs(intensities[i] - intensities[i-1]));
    }
    const avgGradient = gradients.reduce((a, b) => a + b, 0) / gradients.length;
    
    // Combinar métricas
    const textureScore = (mad / 20.0) * 0.6 + (avgGradient / 15.0) * 0.4;
    
    return Math.min(1.0, textureScore);
  }
  
  private calculateEnhancedStability(intensities: number[]): number {
    this.recentReadings = intensities;
    
    if (this.recentReadings.length < 15) return 0.2;

    // Análisis multi-temporal de estabilidad
    const mean = this.recentReadings.reduce((a, b) => a + b, 0) / this.recentReadings.length;
    if (mean < 1e-6) return 0;
    
    // 1. Coeficiente de variación
    const variance = this.recentReadings.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.recentReadings.length;
    const cv = Math.sqrt(variance) / mean;
    
    // 2. Análisis de tendencia (drift)
    const firstHalf = this.recentReadings.slice(0, Math.floor(this.recentReadings.length / 2));
    const secondHalf = this.recentReadings.slice(Math.floor(this.recentReadings.length / 2));
    
    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const drift = Math.abs(secondMean - firstMean) / mean;
    
    // Score combinado
    const stabilityScore = Math.max(0, 1 - (cv / 0.25)) * (1 - Math.min(1, drift / 0.1));
    
    return Math.max(0, Math.min(1, stabilityScore));
  }
  
  private calculateAdvancedNoiseEstimate(): number {
    if (this.rawRedIntensityHistory.length < 15) return 8.0;
    
    const recent = this.rawRedIntensityHistory.slice(-15);
    
    // Estimación de ruido basada en análisis de alta frecuencia
    const differences = [];
    for (let i = 1; i < recent.length; i++) {
      differences.push(Math.abs(recent[i] - recent[i-1]));
    }
    
    // Usar mediana para robustez contra outliers
    differences.sort((a, b) => a - b);
    const medianDiff = differences[Math.floor(differences.length / 2)];
    
    // Escalado basado en características del ruido PPG
    const noiseEstimate = medianDiff * 2.5;
    
    return Math.max(1.0, Math.min(15.0, noiseEstimate));
  }
  
  private updateAdvancedCalibration(redValue: number, perfusionIndex: number): void {
    if (!this.calibrationData) {
      this.calibrationData = { 
        baseline: redValue, 
        variance: perfusionIndex * 10 
      };
    } else {
      // Calibración adaptativa con múltiples parámetros
      const alpha = 0.92; // Adaptación lenta para estabilidad
      this.calibrationData.baseline = this.calibrationData.baseline * alpha + redValue * (1 - alpha);
      this.calibrationData.variance = this.calibrationData.variance * alpha + (perfusionIndex * 10) * (1 - alpha);
    }
  }
  
  reset(): void {
    this.frameCount = 0;
    this.recentReadings = [];
    this.calibrationData = null;
    this.hemoglobinValidator.reset();
    this.recentRedHistory = [];
    this.rawRedIntensityHistory = [];
    this.perfusionHistory = [];
    this.skinConsistencyBuffer = [];
    this.spatialVarianceHistory = [];
    if (this.realQualityAnalyzer) {
      this.realQualityAnalyzer.reset();
    }
  }
}
