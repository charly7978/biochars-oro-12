
/**
 * DETECTOR DE DEDOS REAL - OPTIMIZADO PARA HUMANOS
 * Agresivo con dedos reales, estricto con falsos positivos
 */

export interface FingerDetectionResult {
  isFingerDetected: boolean;
  confidence: number;
  quality: number;
  reasons: string[];
  metrics: {
    redIntensity: number;
    rgRatio: number;
    textureScore: number;
    stability: number;
  };
}

export class RealFingerDetector {
  private detectionHistory: boolean[] = [];
  private redHistory: number[] = [];
  private intensityHistory: number[] = [];
  private calibrationSamples: number[] = [];
  private isCalibrated = false;
  private baselineRed = 0;
  private consecutiveFalsePositives = 0;
  
  // UMBRALES OPTIMIZADOS PARA DEDOS HUMANOS VS FALSOS POSITIVOS
  private readonly DETECTION_THRESHOLDS = {
    // Rangos más específicos para dedos humanos
    HUMAN_RED_MIN: 85,        // Mínimo para piel humana
    HUMAN_RED_MAX: 180,       // Máximo típico para dedos
    HUMAN_RED_OPTIMAL: 120,   // Valor óptimo
    
    // Ratios más estrictos
    MIN_RG_RATIO: 1.15,       // Más estricto para piel
    MAX_RG_RATIO: 2.2,        // Menos permisivo
    OPTIMAL_RG_RATIO: 1.6,    // Ratio típico de piel
    
    // Textura y estabilidad
    MIN_TEXTURE: 0.025,       // Ligeramente más alta
    MAX_TEXTURE: 0.15,        // Límite superior para evitar objetos rugosos
    MIN_STABILITY: 0.12,      // Más estricto
    
    // Control temporal
    MIN_DETECTION_FRAMES: 3,  // Requiere más frames consecutivos
    MAX_FALSE_POSITIVE_STREAK: 2,
    
    CALIBRATION_SAMPLES: 8,
    BASE_CONFIDENCE: 0.5
  };
  
  detectFinger(imageData: ImageData): FingerDetectionResult {
    // Extraer métricas con ROI optimizado
    const metrics = this.extractOptimizedMetrics(imageData);
    
    // Calibración rápida
    if (!this.isCalibrated) {
      this.performQuickCalibration(metrics.redIntensity);
    }
    
    // Validación estricta multi-criterio
    const validation = this.performStrictValidation(metrics);
    
    // Decisión temporal mejorada
    const isDetected = this.makeTemporalDecision(validation, metrics);
    
    // Actualizar historiales
    this.updateHistories(metrics, isDetected);
    
    // Calcular calidad optimizada
    const quality = this.calculateOptimizedQuality(metrics, isDetected, validation.confidence);
    
    return {
      isFingerDetected: isDetected,
      confidence: validation.confidence,
      quality,
      reasons: validation.reasons,
      metrics: {
        redIntensity: metrics.redIntensity,
        rgRatio: metrics.rgRatio,
        textureScore: metrics.textureScore,
        stability: this.calculateStability()
      }
    };
  }
  
  private extractOptimizedMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // ROI más pequeño y centrado para mejor precisión
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.18; // ROI más pequeño
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    const redValues: number[] = [];
    
    // Muestreo más denso en área central
    for (let y = centerY - radius; y < centerY + radius; y += 2) {
      for (let x = centerX - radius; x < centerX + radius; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (distance <= radius) {
            const index = (Math.floor(y) * width + Math.floor(x)) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            
            redSum += r;
            greenSum += g;
            blueSum += b;
            intensities.push((r + g + b) / 3);
            redValues.push(r);
            pixelCount++;
          }
        }
      }
    }
    
    if (pixelCount === 0) {
      return { redIntensity: 0, rgRatio: 1, textureScore: 0, redVariance: 0 };
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    
    // Calcular varianza del rojo (importante para detectar piel vs objetos)
    const redMean = redValues.reduce((a, b) => a + b, 0) / redValues.length;
    const redVariance = redValues.reduce((acc, val) => acc + Math.pow(val - redMean, 2), 0) / redValues.length;
    
    // Textura mejorada
    let textureScore = 0;
    if (intensities.length > 15) {
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
      textureScore = Math.sqrt(variance) / 255;
    }
    
    return {
      redIntensity: avgRed,
      rgRatio: avgGreen > 8 ? avgRed / avgGreen : 1.0,
      textureScore: Math.min(1.0, textureScore),
      redVariance: Math.sqrt(redVariance)
    };
  }
  
  private performQuickCalibration(redIntensity: number): void {
    this.calibrationSamples.push(redIntensity);
    
    if (this.calibrationSamples.length >= this.DETECTION_THRESHOLDS.CALIBRATION_SAMPLES) {
      this.baselineRed = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
      this.isCalibrated = true;
      
      console.log("RealFingerDetector: Calibración completada", {
        baseline: this.baselineRed.toFixed(1),
        samples: this.calibrationSamples.length
      });
    }
  }
  
  private performStrictValidation(metrics: any) {
    const reasons: string[] = [];
    let score = 0;
    
    // 1. VALIDACIÓN ESTRICTA DE INTENSIDAD ROJA (40%)
    if (metrics.redIntensity >= this.DETECTION_THRESHOLDS.HUMAN_RED_MIN && 
        metrics.redIntensity <= this.DETECTION_THRESHOLDS.HUMAN_RED_MAX) {
      
      // Puntuación basada en proximidad al valor óptimo
      const deviation = Math.abs(metrics.redIntensity - this.DETECTION_THRESHOLDS.HUMAN_RED_OPTIMAL);
      const normalizedDeviation = deviation / this.DETECTION_THRESHOLDS.HUMAN_RED_OPTIMAL;
      const redScore = Math.max(0, 1 - (normalizedDeviation * 2));
      
      score += redScore * 0.40;
      reasons.push(`✓ Rojo humano: ${metrics.redIntensity.toFixed(1)} (${(redScore*100).toFixed(0)}%)`);
      
      // Bonus extra para rango perfecto
      if (metrics.redIntensity >= 100 && metrics.redIntensity <= 150) {
        score += 0.15;
        reasons.push(`✓ Rango perfecto de piel humana`);
      }
    } else {
      reasons.push(`✗ Rojo fuera de rango humano: ${metrics.redIntensity.toFixed(1)}`);
      // Penalización severa para valores extremos (probables falsos positivos)
      if (metrics.redIntensity > 200 || metrics.redIntensity < 60) {
        score -= 0.2;
        reasons.push(`✗ Valor extremo - probable falso positivo`);
      }
    }
    
    // 2. VALIDACIÓN ESTRICTA DEL RATIO R/G (30%)
    if (metrics.rgRatio >= this.DETECTION_THRESHOLDS.MIN_RG_RATIO && 
        metrics.rgRatio <= this.DETECTION_THRESHOLDS.MAX_RG_RATIO) {
      
      const ratioDeviation = Math.abs(metrics.rgRatio - this.DETECTION_THRESHOLDS.OPTIMAL_RG_RATIO);
      const ratioScore = Math.max(0, 1 - (ratioDeviation / this.DETECTION_THRESHOLDS.OPTIMAL_RG_RATIO));
      
      score += ratioScore * 0.30;
      reasons.push(`✓ Ratio R/G piel: ${metrics.rgRatio.toFixed(2)} (${(ratioScore*100).toFixed(0)}%)`);
    } else {
      reasons.push(`✗ Ratio R/G anómalo: ${metrics.rgRatio.toFixed(2)}`);
      // Penalizar ratios muy altos (objetos rojos no-piel)
      if (metrics.rgRatio > 3.0) {
        score -= 0.15;
        reasons.push(`✗ Ratio muy alto - objeto no-piel`);
      }
    }
    
    // 3. VALIDACIÓN DE TEXTURA BALANCEADA (15%)
    if (metrics.textureScore >= this.DETECTION_THRESHOLDS.MIN_TEXTURE && 
        metrics.textureScore <= this.DETECTION_THRESHOLDS.MAX_TEXTURE) {
      score += 0.15;
      reasons.push(`✓ Textura piel: ${(metrics.textureScore * 100).toFixed(1)}%`);
    } else if (metrics.textureScore > this.DETECTION_THRESHOLDS.MAX_TEXTURE) {
      // Penalizar texturas muy rugosas (objetos)
      score -= 0.1;
      reasons.push(`✗ Textura muy rugosa - objeto no-piel`);
    } else {
      reasons.push(`~ Textura baja: ${(metrics.textureScore * 100).toFixed(1)}%`);
    }
    
    // 4. VALIDACIÓN DE ESTABILIDAD (15%)
    const stability = this.calculateStability();
    if (stability >= this.DETECTION_THRESHOLDS.MIN_STABILITY) {
      score += 0.15;
      reasons.push(`✓ Estabilidad: ${(stability * 100).toFixed(1)}%`);
    } else {
      reasons.push(`~ Estabilidad baja: ${(stability * 100).toFixed(1)}%`);
    }
    
    // 5. BONUS POR CONSISTENCIA CON CALIBRACIÓN
    if (this.isCalibrated && this.baselineRed > 0) {
      const deviation = Math.abs(metrics.redIntensity - this.baselineRed) / this.baselineRed;
      if (deviation < 0.3) {
        score += 0.10;
        reasons.push(`✓ Consistente con baseline`);
      } else if (deviation > 0.8) {
        score -= 0.1;
        reasons.push(`✗ Muy diferente a baseline`);
      }
    }
    
    return {
      score: Math.max(0, Math.min(1.0, score)),
      reasons,
      confidence: Math.max(0, Math.min(1.0, score))
    };
  }
  
  private makeTemporalDecision(validation: any, metrics: any): boolean {
    const baseDecision = validation.confidence >= this.DETECTION_THRESHOLDS.BASE_CONFIDENCE;
    
    // Actualizar historial de decisiones
    this.detectionHistory.push(baseDecision);
    if (this.detectionHistory.length > 5) {
      this.detectionHistory.shift();
    }
    
    // Control de falsos positivos consecutivos
    if (!baseDecision) {
      this.consecutiveFalsePositives++;
    } else {
      this.consecutiveFalsePositives = 0;
    }
    
    // Si hay muchos falsos positivos, ser más estricto
    if (this.consecutiveFalsePositives > this.DETECTION_THRESHOLDS.MAX_FALSE_POSITIVE_STREAK) {
      return false;
    }
    
    // Requerir frames consecutivos para confirmación
    if (this.detectionHistory.length >= this.DETECTION_THRESHOLDS.MIN_DETECTION_FRAMES) {
      const recentFrames = this.detectionHistory.slice(-this.DETECTION_THRESHOLDS.MIN_DETECTION_FRAMES);
      const positiveCount = recentFrames.filter(d => d).length;
      
      // Necesita al menos 2 de 3 frames positivos
      return positiveCount >= Math.ceil(this.DETECTION_THRESHOLDS.MIN_DETECTION_FRAMES * 0.67);
    }
    
    // Para frames iniciales, ser conservador
    return validation.confidence >= 0.7;
  }
  
  private calculateOptimizedQuality(metrics: any, isDetected: boolean, confidence: number): number {
    if (!isDetected) {
      return Math.max(5, Math.min(20, confidence * 20));
    }
    
    let quality = 40 + (confidence * 35);
    
    // Bonus por métricas óptimas
    if (metrics.redIntensity >= 100 && metrics.redIntensity <= 150) {
      quality += 20;
    }
    
    if (metrics.rgRatio >= 1.3 && metrics.rgRatio <= 1.9) {
      quality += 15;
    }
    
    // Bonus por estabilidad
    const stability = this.calculateStability();
    quality += stability * 15;
    
    // Bonus por textura apropiada
    if (metrics.textureScore >= 0.03 && metrics.textureScore <= 0.1) {
      quality += 10;
    }
    
    // Penalización por valores extremos
    if (metrics.redIntensity > 180 || metrics.redIntensity < 80) {
      quality -= 15;
    }
    
    if (metrics.rgRatio > 2.5 || metrics.rgRatio < 1.1) {
      quality -= 10;
    }
    
    return Math.min(95, Math.max(15, Math.round(quality)));
  }
  
  private updateHistories(metrics: any, detected: boolean): void {
    this.redHistory.push(metrics.redIntensity);
    this.intensityHistory.push(metrics.redIntensity);
    
    if (this.redHistory.length > 8) {
      this.redHistory.shift();
    }
    if (this.intensityHistory.length > 12) {
      this.intensityHistory.shift();
    }
  }
  
  private calculateStability(): number {
    if (this.redHistory.length < 3) return 0.3;
    
    const recent = this.redHistory.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (mean === 0) return 0.0;
    
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.0, Math.min(1.0, 1 - (cv * 2.0)));
  }
  
  reset(): void {
    this.detectionHistory = [];
    this.redHistory = [];
    this.intensityHistory = [];
    this.calibrationSamples = [];
    this.isCalibrated = false;
    this.baselineRed = 0;
    this.consecutiveFalsePositives = 0;
  }
  
  getCalibrationStatus(): {
    isCalibrated: boolean;
    progress: number;
    baseline: number;
  } {
    return {
      isCalibrated: this.isCalibrated,
      progress: Math.min(100, (this.calibrationSamples.length / this.DETECTION_THRESHOLDS.CALIBRATION_SAMPLES) * 100),
      baseline: this.baselineRed
    };
  }
}
