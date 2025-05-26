
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
  
  // UMBRALES OPTIMIZADOS PARA REDUCIR FALSOS POSITIVOS
  private readonly REAL_THRESHOLDS = {
    MIN_RED: 80,          // Mayor para descartar objetos sin sangre
    MAX_RED: 230,         // Menor para evitar sobreexposición
    MIN_RG_RATIO: 1.15,   // Mayor para asegurar predominio del rojo
    MAX_RG_RATIO: 2.8,    // Menor para evitar extremos
    MIN_TEXTURE: 0.03,    // Ligeramente mayor
    MIN_STABILITY: 0.15,  // Mayor estabilidad requerida
    CALIBRATION_SAMPLES: 15,
    MIN_CONFIDENCE: 0.65  // Umbral mínimo de confianza
  };
  
  detectFinger(imageData: ImageData): FingerDetectionResult {
    // Extraer métricas básicas
    const metrics = this.extractBasicMetrics(imageData);
    
    // Auto-calibración simple
    if (!this.isCalibrated) {
      this.performSimpleCalibration(metrics.redIntensity);
    }
    
    // Validaciones mejoradas
    const validation = this.performEnhancedValidation(metrics);
    
    // Decisión con filtros anti-falsos positivos
    const isDetected = this.makeRobustDecision(validation, metrics);
    
    // Actualizar historial
    this.updateHistory(metrics.redIntensity, isDetected);
    
    // Calcular calidad ajustada
    const quality = this.calculateAdjustedQuality(metrics, isDetected, validation.confidence);
    
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
    
    // Área central más pequeña y centrada para mejor precisión
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.15; // Área más pequeña
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    // Muestreo más denso para mayor precisión
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
    
    // Textura más refinada
    let textureScore = 0;
    if (intensities.length > 20) {
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
      textureScore = Math.sqrt(variance) / 255; // Normalizado
    }
    
    return {
      redIntensity: avgRed,
      rgRatio: avgGreen > 10 ? avgRed / avgGreen : 1.0,
      textureScore: Math.min(1.0, textureScore)
    };
  }
  
  private performSimpleCalibration(redIntensity: number): void {
    this.calibrationSamples.push(redIntensity);
    
    if (this.calibrationSamples.length >= this.REAL_THRESHOLDS.CALIBRATION_SAMPLES) {
      this.baselineRed = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
      this.isCalibrated = true;
      
      console.log("RealFingerDetector: Calibración completada", {
        baseline: this.baselineRed.toFixed(1),
        samples: this.calibrationSamples.length
      });
    }
  }
  
  private performEnhancedValidation(metrics: any) {
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Validación de intensidad roja (peso: 35%)
    if (metrics.redIntensity >= this.REAL_THRESHOLDS.MIN_RED && 
        metrics.redIntensity <= this.REAL_THRESHOLDS.MAX_RED) {
      score += 0.35;
      reasons.push(`✓ Rojo válido: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`✗ Rojo inválido: ${metrics.redIntensity.toFixed(1)} (${this.REAL_THRESHOLDS.MIN_RED}-${this.REAL_THRESHOLDS.MAX_RED})`);
    }
    
    // 2. Validación del ratio R/G (peso: 30%)
    if (metrics.rgRatio >= this.REAL_THRESHOLDS.MIN_RG_RATIO && 
        metrics.rgRatio <= this.REAL_THRESHOLDS.MAX_RG_RATIO) {
      score += 0.30;
      reasons.push(`✓ Ratio R/G: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      reasons.push(`✗ Ratio R/G inválido: ${metrics.rgRatio.toFixed(2)} (${this.REAL_THRESHOLDS.MIN_RG_RATIO}-${this.REAL_THRESHOLDS.MAX_RG_RATIO})`);
    }
    
    // 3. Validación de textura (peso: 20%)
    if (metrics.textureScore >= this.REAL_THRESHOLDS.MIN_TEXTURE) {
      score += 0.20;
      reasons.push(`✓ Textura: ${(metrics.textureScore * 100).toFixed(1)}%`);
    } else {
      reasons.push(`✗ Textura baja: ${(metrics.textureScore * 100).toFixed(1)}%`);
    }
    
    // 4. Validación de estabilidad (peso: 15%)
    const stability = this.calculateStability();
    if (stability >= this.REAL_THRESHOLDS.MIN_STABILITY) {
      score += 0.15;
      reasons.push(`✓ Estabilidad: ${(stability * 100).toFixed(1)}%`);
    } else {
      reasons.push(`✗ Inestable: ${(stability * 100).toFixed(1)}%`);
    }
    
    // Bonus por calibración
    if (this.isCalibrated && this.baselineRed > 0) {
      const deviation = Math.abs(metrics.redIntensity - this.baselineRed) / this.baselineRed;
      if (deviation < 0.3) { // Dentro del 30% del baseline
        score += 0.05;
        reasons.push(`✓ Cerca del baseline calibrado`);
      }
    }
    
    return {
      score: Math.min(1.0, score),
      reasons,
      confidence: Math.min(1.0, score)
    };
  }
  
  private makeRobustDecision(validation: any, metrics: any): boolean {
    // Requiere alta confianza para detectar
    if (validation.confidence < this.REAL_THRESHOLDS.MIN_CONFIDENCE) {
      return false;
    }
    
    // Filtro temporal más estricto
    this.detectionHistory.push(validation.confidence >= this.REAL_THRESHOLDS.MIN_CONFIDENCE);
    if (this.detectionHistory.length > 5) {
      this.detectionHistory.shift();
    }
    
    // Requiere consistencia en las últimas detecciones
    if (this.detectionHistory.length >= 3) {
      const recentDetections = this.detectionHistory.slice(-3);
      const positiveCount = recentDetections.filter(d => d).length;
      
      // Al menos 2 de 3 detecciones positivas
      return positiveCount >= 2;
    }
    
    // Para las primeras muestras, ser más estricto
    return validation.confidence >= 0.8;
  }
  
  private calculateAdjustedQuality(metrics: any, isDetected: boolean, confidence: number): number {
    if (!isDetected) {
      return Math.max(5, Math.min(25, confidence * 30)); // Calidad baja para no detección
    }
    
    let quality = 20 + (confidence * 30); // Base según confianza
    
    // Bonus por métricas óptimas
    if (metrics.redIntensity >= 120 && metrics.redIntensity <= 180) {
      quality += 20; // Zona óptima de intensidad roja
    }
    
    if (metrics.rgRatio >= 1.4 && metrics.rgRatio <= 2.2) {
      quality += 15; // Ratio óptimo
    }
    
    // Bonus por textura y estabilidad
    quality += metrics.textureScore * 15;
    quality += this.calculateStability() * 10;
    
    // Penalización por valores extremos (anti-falsos positivos)
    if (metrics.redIntensity > 220 || metrics.rgRatio > 2.5) {
      quality -= 20;
    }
    
    return Math.min(95, Math.max(15, Math.round(quality)));
  }
  
  private updateHistory(redIntensity: number, detected: boolean): void {
    this.redHistory.push(redIntensity);
    if (this.redHistory.length > 8) { // Historial más corto
      this.redHistory.shift();
    }
  }
  
  private calculateStability(): number {
    if (this.redHistory.length < 3) return 0.2;
    
    const recent = this.redHistory.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (mean === 0) return 0.0;
    
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.0, Math.min(1.0, 1 - (cv * 2))); // Más sensible a variaciones
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
