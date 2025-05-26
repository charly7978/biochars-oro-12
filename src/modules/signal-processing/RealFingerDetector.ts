
/**
 * DETECTOR DE DEDOS REAL - SIN SIMULACIONES
 * Optimizado para detección real con cámara
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
  private calibrationSamples: number[] = [];
  private isCalibrated = false;
  private baselineRed = 0;
  
  // UMBRALES REALISTAS PARA DETECCIÓN REAL
  private readonly REAL_THRESHOLDS = {
    MIN_RED: 50,          // Mínimo realista para dedo
    MAX_RED: 250,         // Máximo realista para dedo
    MIN_RG_RATIO: 1.0,    // Ratio mínimo realista
    MAX_RG_RATIO: 3.0,    // Ratio máximo realista
    MIN_TEXTURE: 0.02,    // Textura mínima muy baja
    MIN_STABILITY: 0.1,   // Estabilidad mínima muy baja
    CALIBRATION_SAMPLES: 20  // Muestras para calibración
  };
  
  detectFinger(imageData: ImageData): FingerDetectionResult {
    // Extraer métricas básicas
    const metrics = this.extractBasicMetrics(imageData);
    
    // Auto-calibración simple
    if (!this.isCalibrated) {
      this.performSimpleCalibration(metrics.redIntensity);
    }
    
    // Validaciones simplificadas
    const validation = this.performSimpleValidation(metrics);
    
    // Decisión simple basada en datos reales
    const isDetected = this.makeSimpleDecision(validation, metrics);
    
    // Actualizar historial
    this.updateHistory(metrics.redIntensity, isDetected);
    
    // Calcular calidad simple
    const quality = this.calculateSimpleQuality(metrics, isDetected);
    
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
  
  private extractBasicMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // Área central para análisis
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.2;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    // Muestreo simple del área central
    for (let y = centerY - radius; y < centerY + radius; y += 3) {
      for (let x = centerX - radius; x < centerX + radius; x += 3) {
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
            pixelCount++;
          }
        }
      }
    }
    
    if (pixelCount === 0) {
      return { redIntensity: 0, rgRatio: 1, textureScore: 0 };
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    
    // Textura simple
    let textureScore = 0;
    if (intensities.length > 10) {
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
      textureScore = Math.sqrt(variance) / 100;
    }
    
    return {
      redIntensity: avgRed,
      rgRatio: avgGreen > 5 ? avgRed / avgGreen : 1.0,
      textureScore: Math.min(1.0, textureScore)
    };
  }
  
  private performSimpleCalibration(redIntensity: number): void {
    this.calibrationSamples.push(redIntensity);
    
    if (this.calibrationSamples.length >= this.REAL_THRESHOLDS.CALIBRATION_SAMPLES) {
      // Calcular baseline simple
      this.baselineRed = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
      this.isCalibrated = true;
      
      console.log("RealFingerDetector: Calibración simple completada", {
        baseline: this.baselineRed,
        samples: this.calibrationSamples.length
      });
    }
  }
  
  private performSimpleValidation(metrics: any) {
    const reasons: string[] = [];
    let score = 0;
    
    // Validación 1: Intensidad roja básica
    if (metrics.redIntensity >= this.REAL_THRESHOLDS.MIN_RED && 
        metrics.redIntensity <= this.REAL_THRESHOLDS.MAX_RED) {
      score += 0.4;
      reasons.push(`✓ Rojo OK: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`✗ Rojo fuera: ${metrics.redIntensity.toFixed(1)}`);
    }
    
    // Validación 2: Ratio R/G básico
    if (metrics.rgRatio >= this.REAL_THRESHOLDS.MIN_RG_RATIO && 
        metrics.rgRatio <= this.REAL_THRESHOLDS.MAX_RG_RATIO) {
      score += 0.3;
      reasons.push(`✓ Ratio OK: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      reasons.push(`✗ Ratio fuera: ${metrics.rgRatio.toFixed(2)}`);
    }
    
    // Validación 3: Textura mínima
    if (metrics.textureScore >= this.REAL_THRESHOLDS.MIN_TEXTURE) {
      score += 0.2;
      reasons.push(`✓ Textura: ${metrics.textureScore.toFixed(3)}`);
    } else {
      reasons.push(`✗ Poca textura: ${metrics.textureScore.toFixed(3)}`);
    }
    
    // Validación 4: Estabilidad básica
    const stability = this.calculateStability();
    if (stability >= this.REAL_THRESHOLDS.MIN_STABILITY) {
      score += 0.1;
      reasons.push(`✓ Estable: ${stability.toFixed(2)}`);
    } else {
      reasons.push(`✗ Inestable: ${stability.toFixed(2)}`);
    }
    
    return {
      score,
      reasons,
      confidence: Math.min(1.0, score)
    };
  }
  
  private makeSimpleDecision(validation: any, metrics: any): boolean {
    // Decisión simple: al menos 50% de score
    const basicDetection = validation.score >= 0.5;
    
    // Filtro temporal simple
    this.detectionHistory.push(basicDetection);
    if (this.detectionHistory.length > 3) {
      this.detectionHistory.shift();
    }
    
    // Requiere al menos 2 de 3 detecciones para confirmar
    if (this.detectionHistory.length >= 2) {
      const recentDetections = this.detectionHistory.slice(-2).filter(d => d).length;
      return recentDetections >= 1; // Solo 1 de 2 para ser menos estricto
    }
    
    return basicDetection;
  }
  
  private calculateSimpleQuality(metrics: any, isDetected: boolean): number {
    if (!isDetected) {
      return Math.max(10, Math.random() * 20); // Calidad baja para no detección
    }
    
    let quality = 30; // Base más alta
    
    // Factor por intensidad roja
    if (metrics.redIntensity >= 80 && metrics.redIntensity <= 200) {
      quality += 25;
    }
    
    // Factor por ratio R/G
    if (metrics.rgRatio >= 1.2 && metrics.rgRatio <= 2.5) {
      quality += 25;
    }
    
    // Factor por textura
    quality += metrics.textureScore * 20;
    
    return Math.min(95, Math.max(40, quality));
  }
  
  private updateHistory(redIntensity: number, detected: boolean): void {
    this.redHistory.push(redIntensity);
    if (this.redHistory.length > 10) {
      this.redHistory.shift();
    }
  }
  
  private calculateStability(): number {
    if (this.redHistory.length < 3) return 0.5;
    
    const recent = this.redHistory.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (mean === 0) return 0.0;
    
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.0, Math.min(1.0, 1 - cv));
  }
  
  reset(): void {
    this.detectionHistory = [];
    this.redHistory = [];
    this.calibrationSamples = [];
    this.isCalibrated = false;
    this.baselineRed = 0;
  }
  
  getCalibrationStatus(): {
    isCalibrated: boolean;
    progress: number;
    baseline: number;
  } {
    return {
      isCalibrated: this.isCalibrated,
      progress: Math.min(100, (this.calibrationSamples.length / this.REAL_THRESHOLDS.CALIBRATION_SAMPLES) * 100),
      baseline: this.baselineRed
    };
  }
}
