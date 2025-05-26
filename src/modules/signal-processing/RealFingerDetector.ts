
/**
 * DETECTOR DE DEDOS HUMANOS CON ALGORITMOS MÉDICOS VALIDADOS
 * Basado en estándares PPG médicos y calibración automática
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
  private qualityHistory: number[] = [];
  private isCalibrated = false;
  private calibrationBaseline = 0;
  private adaptiveThresholds = {
    minRed: 80,
    maxRed: 220,
    minRgRatio: 1.1,
    maxRgRatio: 2.5
  };
  
  // UMBRALES MÉDICOS ESTRICTOS PARA ELIMINAR FALSOS POSITIVOS
  private readonly BASE_THRESHOLDS = {
    // Rango de intensidad roja más estricto
    MIN_RED: 90,          // Más estricto
    MAX_RED: 200,         // Más estricto
    
    // Ratio R/G más estricto para piel humana real
    MIN_RG_RATIO: 1.3,    // Más estricto
    MAX_RG_RATIO: 2.2,    // Más estricto
    
    // Textura mínima más exigente
    MIN_TEXTURE: 0.08,    // Más exigente
    
    // Calidad mínima más alta
    MIN_QUALITY: 40,      // Más exigente
    
    // NUEVO: Estabilidad mínima requerida
    MIN_STABILITY: 0.3
  };
  
  detectFinger(imageData: ImageData): FingerDetectionResult {
    // Auto-calibración más estricta
    if (!this.isCalibrated && this.redHistory.length < 30) {
      this.performAutoCalibration(imageData);
    }
    
    // Extraer métricas
    const metrics = this.extractMetrics(imageData);
    
    // Validaciones más estrictas
    const validations = this.performStrictValidations(metrics);
    
    // Calcular calidad más precisa
    const quality = this.calculatePreciseQuality(metrics, validations.score);
    
    // Calcular confianza con múltiples factores
    const confidence = this.calculateStrictConfidence(validations, quality, metrics);
    
    // Decisión final con múltiples criterios
    const isDetected = this.makeStrictDetectionDecision(confidence, quality, validations, metrics);
    
    // Actualizar historiales
    this.updateHistory(metrics.redIntensity, isDetected, quality);
    
    return {
      isFingerDetected: isDetected,
      confidence,
      quality,
      reasons: validations.reasons,
      metrics: {
        redIntensity: metrics.redIntensity,
        rgRatio: metrics.rgRatio,
        textureScore: metrics.textureScore,
        stability: this.calculateStability()
      }
    };
  }
  
  private performAutoCalibration(imageData: ImageData): void {
    const metrics = this.extractMetrics(imageData);
    this.redHistory.push(metrics.redIntensity);
    
    if (this.redHistory.length === 30) {
      // Calcular baseline más conservador
      const sortedValues = [...this.redHistory].sort((a, b) => a - b);
      const q25 = sortedValues[Math.floor(sortedValues.length * 0.25)];
      const q75 = sortedValues[Math.floor(sortedValues.length * 0.75)];
      this.calibrationBaseline = (q25 + q75) / 2;
      
      const variance = this.redHistory.reduce((acc, val) => acc + Math.pow(val - this.calibrationBaseline, 2), 0) / 30;
      const stdDev = Math.sqrt(variance);
      
      // Umbrales más conservadores
      this.adaptiveThresholds = {
        minRed: Math.max(85, this.calibrationBaseline - stdDev * 1.5),
        maxRed: Math.min(210, this.calibrationBaseline + stdDev * 2),
        minRgRatio: 1.2,
        maxRgRatio: 2.3
      };
      
      this.isCalibrated = true;
      console.log("RealFingerDetector: Calibración estricta completada", {
        baseline: this.calibrationBaseline,
        thresholds: this.adaptiveThresholds,
        stdDev
      });
    }
  }
  
  private extractMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // ROI más pequeño para mayor precisión
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.15; // Reducido de 0.2 a 0.15
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    // Muestreo más denso para mejor precisión
    for (let y = centerY - radius; y < centerY + radius; y += 2) {
      for (let x = centerX - radius; x < centerX + radius; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (distance <= radius) {
            const index = (Math.floor(y) * width + Math.floor(x)) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            
            // Filtrar píxeles extremos que pueden ser ruido
            if (r > 10 && r < 250 && g > 10 && g < 250) {
              redSum += r;
              greenSum += g;
              blueSum += b;
              intensities.push((r + g + b) / 3);
              pixelCount++;
            }
          }
        }
      }
    }
    
    if (pixelCount === 0) {
      return { redIntensity: 0, rgRatio: 1, textureScore: 0 };
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    
    // Calcular textura más precisa
    let textureScore = 0;
    if (intensities.length > 20) {
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
      textureScore = Math.min(1.0, Math.sqrt(variance) / 30); // Ajustado
    }
    
    return {
      redIntensity: avgRed,
      rgRatio: avgGreen > 10 ? avgRed / avgGreen : 1.0, // Umbral más alto
      textureScore
    };
  }
  
  private performStrictValidations(metrics: any) {
    const reasons: string[] = [];
    let score = 0;
    
    // Obtener umbrales con validación adicional
    let minRed: number, maxRed: number, minRgRatio: number, maxRgRatio: number;
    
    if (this.isCalibrated) {
      minRed = this.adaptiveThresholds.minRed;
      maxRed = this.adaptiveThresholds.maxRed;
      minRgRatio = this.adaptiveThresholds.minRgRatio;
      maxRgRatio = this.adaptiveThresholds.maxRgRatio;
    } else {
      minRed = this.BASE_THRESHOLDS.MIN_RED;
      maxRed = this.BASE_THRESHOLDS.MAX_RED;
      minRgRatio = this.BASE_THRESHOLDS.MIN_RG_RATIO;
      maxRgRatio = this.BASE_THRESHOLDS.MAX_RG_RATIO;
    }
    
    // Validación 1: Intensidad roja (peso reducido)
    if (metrics.redIntensity >= minRed && metrics.redIntensity <= maxRed) {
      score += 0.25;
      reasons.push(`✓ Rojo válido: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`✗ Rojo fuera de rango: ${metrics.redIntensity.toFixed(1)} (${minRed}-${maxRed})`);
    }
    
    // Validación 2: Ratio R/G (peso aumentado)
    if (metrics.rgRatio >= minRgRatio && metrics.rgRatio <= maxRgRatio) {
      score += 0.35;
      reasons.push(`✓ Ratio válido: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      reasons.push(`✗ Ratio inválido: ${metrics.rgRatio.toFixed(2)} (${minRgRatio}-${maxRgRatio})`);
    }
    
    // Validación 3: Textura (peso aumentado)
    if (metrics.textureScore >= this.BASE_THRESHOLDS.MIN_TEXTURE) {
      score += 0.25;
      reasons.push(`✓ Textura: ${metrics.textureScore.toFixed(3)}`);
    } else {
      reasons.push(`✗ Poca textura: ${metrics.textureScore.toFixed(3)}`);
    }
    
    // Validación 4: Estabilidad (NUEVA)
    const stability = this.calculateStability();
    if (stability >= this.BASE_THRESHOLDS.MIN_STABILITY) {
      score += 0.15;
      reasons.push(`✓ Estabilidad: ${stability.toFixed(2)}`);
    } else {
      reasons.push(`✗ Inestable: ${stability.toFixed(2)}`);
    }
    
    return { score, reasons };
  }
  
  private calculatePreciseQuality(metrics: any, validationScore: number): number {
    // Si no pasa las validaciones básicas, calidad muy baja
    if (validationScore < 0.6) {
      return Math.max(5, Math.min(25, validationScore * 40));
    }
    
    let quality = 20; // Base más baja
    
    // Factor 1: Calidad basada en intensidad roja (20%)
    const optimalRed = this.isCalibrated ? this.calibrationBaseline : 130;
    const redDistance = Math.abs(metrics.redIntensity - optimalRed);
    const redQuality = Math.max(0, 20 - (redDistance / 3));
    quality += redQuality;
    
    // Factor 2: Calidad basada en ratio R/G (30%)
    const optimalRatio = 1.6;
    const ratioDistance = Math.abs(metrics.rgRatio - optimalRatio);
    const ratioQuality = Math.max(0, 30 - (ratioDistance * 15));
    quality += ratioQuality;
    
    // Factor 3: Calidad basada en textura (25%)
    const textureQuality = metrics.textureScore * 25;
    quality += textureQuality;
    
    // Factor 4: Calidad basada en estabilidad (25%)
    const stability = this.calculateStability();
    const stabilityQuality = stability * 25;
    quality += stabilityQuality;
    
    // Penalizar fuertemente valores extremos
    if (metrics.redIntensity < 60 || metrics.redIntensity > 240) {
      quality *= 0.3;
    }
    if (metrics.rgRatio < 1.0 || metrics.rgRatio > 3.0) {
      quality *= 0.4;
    }
    
    return Math.max(5, Math.min(85, Math.round(quality)));
  }
  
  private calculateStrictConfidence(validations: any, quality: number, metrics: any): number {
    const validationFactor = validations.score;
    const qualityFactor = quality / 100;
    const stabilityFactor = this.calculateStability();
    
    // Factor adicional: consistencia histórica
    const historyFactor = this.calculateHistoryConsistency();
    
    // Penalizar valores extremos
    let extremePenalty = 1.0;
    if (metrics.redIntensity > 240 || metrics.redIntensity < 50) {
      extremePenalty *= 0.5;
    }
    if (metrics.rgRatio > 2.8 || metrics.rgRatio < 1.1) {
      extremePenalty *= 0.6;
    }
    
    const confidence = validationFactor * qualityFactor * stabilityFactor * historyFactor * extremePenalty;
    return Math.min(1.0, confidence);
  }
  
  private makeStrictDetectionDecision(confidence: number, quality: number, validations: any, metrics: any): boolean {
    // Criterios MÁS estrictos
    const passesValidations = validations.score >= 0.75; // Aumentado de 0.6
    const passesQuality = quality >= this.BASE_THRESHOLDS.MIN_QUALITY;
    const passesConfidence = confidence >= 0.5; // Aumentado de 0.3
    const passesStability = this.calculateStability() >= this.BASE_THRESHOLDS.MIN_STABILITY;
    
    // TODOS los criterios deben cumplirse
    const detected = passesValidations && passesQuality && passesConfidence && passesStability;
    
    // Log para debugging cada 30 detecciones
    if (this.detectionHistory.length % 30 === 0) {
      console.log("Detección estricta:", {
        detected,
        validations: validations.score.toFixed(2),
        quality: quality.toFixed(1),
        confidence: confidence.toFixed(2),
        stability: this.calculateStability().toFixed(2),
        redIntensity: metrics.redIntensity.toFixed(1),
        rgRatio: metrics.rgRatio.toFixed(2)
      });
    }
    
    return detected;
  }
  
  private updateHistory(redIntensity: number, detected: boolean, quality: number): void {
    this.redHistory.push(redIntensity);
    if (this.redHistory.length > 20) {
      this.redHistory.shift();
    }
    
    this.detectionHistory.push(detected);
    if (this.detectionHistory.length > 8) {
      this.detectionHistory.shift();
    }
    
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 10) {
      this.qualityHistory.shift();
    }
  }
  
  private calculateStability(): number {
    if (this.redHistory.length < 5) return 0.2;
    
    const recent = this.redHistory.slice(-8);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (mean === 0) return 0.0;
    
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.0, Math.min(1.0, 1 - cv * 2)); // Penalizar más la variabilidad
  }
  
  private calculateHistoryConsistency(): number {
    if (this.detectionHistory.length < 5) return 0.5;
    
    const recentDetections = this.detectionHistory.slice(-5);
    const detectionRate = recentDetections.filter(d => d).length / recentDetections.length;
    
    // Favorecer consistencia (todo detectado o nada detectado)
    if (detectionRate === 0 || detectionRate === 1) {
      return 1.0;
    } else if (detectionRate >= 0.8 || detectionRate <= 0.2) {
      return 0.8;
    } else {
      return 0.4; // Penalizar inconsistencia
    }
  }
  
  reset(): void {
    this.detectionHistory = [];
    this.redHistory = [];
    this.qualityHistory = [];
    this.isCalibrated = false;
    this.calibrationBaseline = 0;
    this.adaptiveThresholds = {
      minRed: this.BASE_THRESHOLDS.MIN_RED,
      maxRed: this.BASE_THRESHOLDS.MAX_RED,
      minRgRatio: this.BASE_THRESHOLDS.MIN_RG_RATIO,
      maxRgRatio: this.BASE_THRESHOLDS.MAX_RG_RATIO
    };
  }
  
  getCalibrationStatus(): {
    isCalibrated: boolean;
    progress: number;
    baseline: number;
    thresholds: any;
  } {
    return {
      isCalibrated: this.isCalibrated,
      progress: Math.min(100, (this.redHistory.length / 30) * 100),
      baseline: this.calibrationBaseline,
      thresholds: this.adaptiveThresholds
    };
  }
}
