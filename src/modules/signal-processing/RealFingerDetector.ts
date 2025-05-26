
/**
 * DETECTOR DE DEDOS HUMANOS REAL - VERSIÓN DEFINITIVA
 * Umbrales calibrados para cámaras reales, no condiciones de laboratorio
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
  private qualityHistory: number[] = [];
  private redHistory: number[] = [];
  
  // UMBRALES REALISTAS PARA CÁMARAS DE TELÉFONOS
  private readonly THRESHOLDS = {
    // Rango de rojo muy amplio para diferentes tipos de piel y condiciones
    MIN_RED: 25,          // Muy permisivo (antes 80)
    MAX_RED: 220,         // Evitar saturación
    
    // Ratio R/G realista para piel humana en cámaras
    MIN_RG_RATIO: 0.8,    // Muy permisivo (antes 1.1)
    MAX_RG_RATIO: 2.8,    // Amplio rango (antes 2.2)
    
    // Textura mínima para distinguir de superficies planas
    MIN_TEXTURE: 0.02,    // Muy bajo (antes 0.05)
    
    // Estabilidad temporal
    MIN_STABILITY: 0.3,   // Permisivo para dedos con micro-movimientos
    
    // Calidad mínima final
    MIN_QUALITY: 35       // Bajo para permitir detección (antes 75)
  };
  
  detectFinger(imageData: ImageData): FingerDetectionResult {
    // 1. EXTRAER MÉTRICAS BÁSICAS
    const metrics = this.extractBasicMetrics(imageData);
    
    // 2. CALCULAR CALIDAD BASE
    let baseQuality = this.calculateBaseQuality(metrics);
    
    // 3. APLICAR VALIDACIONES SIMPLES Y PERMISIVAS
    const validations = this.performValidations(metrics);
    
    // 4. CALCULAR CONFIANZA FINAL
    const confidence = this.calculateConfidence(validations, baseQuality);
    
    // 5. DECISIÓN FINAL CON HISTÉRESIS SIMPLE
    const isDetected = this.makeDetectionDecision(confidence, baseQuality);
    
    return {
      isFingerDetected: isDetected,
      confidence,
      quality: baseQuality,
      reasons: validations.reasons,
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
    
    // ROI central simple
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.25;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    // Muestreo simple y eficiente
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
    
    // Calcular textura simple
    let textureScore = 0;
    if (intensities.length > 10) {
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
      textureScore = Math.min(1.0, Math.sqrt(variance) / 50);
    }
    
    return {
      redIntensity: avgRed,
      rgRatio: avgGreen > 5 ? avgRed / avgGreen : 1.0,
      textureScore
    };
  }
  
  private calculateBaseQuality(metrics: any): number {
    let quality = 0;
    
    // Calidad por intensidad roja (40 puntos)
    if (metrics.redIntensity >= this.THRESHOLDS.MIN_RED && 
        metrics.redIntensity <= this.THRESHOLDS.MAX_RED) {
      quality += 40;
    } else {
      // Penalización gradual en lugar de rechazo total
      const deviation = Math.min(
        Math.abs(metrics.redIntensity - this.THRESHOLDS.MIN_RED),
        Math.abs(metrics.redIntensity - this.THRESHOLDS.MAX_RED)
      );
      quality += Math.max(10, 40 - deviation / 2);
    }
    
    // Calidad por ratio R/G (35 puntos)
    if (metrics.rgRatio >= this.THRESHOLDS.MIN_RG_RATIO && 
        metrics.rgRatio <= this.THRESHOLDS.MAX_RG_RATIO) {
      quality += 35;
    } else {
      // Penalización gradual
      quality += Math.max(5, 35 - Math.abs(metrics.rgRatio - 1.5) * 10);
    }
    
    // Calidad por textura (25 puntos)
    if (metrics.textureScore >= this.THRESHOLDS.MIN_TEXTURE) {
      quality += 25;
    } else {
      quality += Math.max(5, metrics.textureScore * 500); // Muy permisivo
    }
    
    return Math.min(90, quality);
  }
  
  private performValidations(metrics: any) {
    const reasons: string[] = [];
    let validationScore = 0;
    
    // Validación 1: Intensidad roja básica
    if (metrics.redIntensity >= this.THRESHOLDS.MIN_RED) {
      validationScore += 0.4;
      reasons.push(`Rojo OK: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`Rojo bajo: ${metrics.redIntensity.toFixed(1)}`);
    }
    
    // Validación 2: Ratio de piel humana
    if (metrics.rgRatio >= this.THRESHOLDS.MIN_RG_RATIO) {
      validationScore += 0.4;
      reasons.push(`Ratio piel OK: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      reasons.push(`Ratio bajo: ${metrics.rgRatio.toFixed(2)}`);
    }
    
    // Validación 3: Textura básica
    if (metrics.textureScore >= this.THRESHOLDS.MIN_TEXTURE) {
      validationScore += 0.2;
      reasons.push(`Textura OK: ${metrics.textureScore.toFixed(3)}`);
    } else {
      reasons.push(`Textura baja: ${metrics.textureScore.toFixed(3)}`);
    }
    
    return { score: validationScore, reasons };
  }
  
  private calculateConfidence(validations: any, quality: number): number {
    // Confianza basada en validaciones y calidad
    const baseConfidence = validations.score;
    const qualityBonus = (quality - 30) / 60; // Normalizar calidad
    
    return Math.max(0, Math.min(1, baseConfidence + qualityBonus * 0.3));
  }
  
  private makeDetectionDecision(confidence: number, quality: number): boolean {
    // Agregar a historia
    const detected = confidence > 0.4 && quality > this.THRESHOLDS.MIN_QUALITY;
    this.detectionHistory.push(detected);
    this.qualityHistory.push(quality);
    
    // Mantener ventana pequeña
    if (this.detectionHistory.length > 5) {
      this.detectionHistory.shift();
      this.qualityHistory.shift();
    }
    
    // Histéresis simple: mayoría en ventana
    if (this.detectionHistory.length >= 3) {
      const recentDetections = this.detectionHistory.filter(d => d).length;
      return recentDetections >= Math.ceil(this.detectionHistory.length / 2);
    }
    
    return detected;
  }
  
  private calculateStability(): number {
    if (this.redHistory.length < 5) return 0.5;
    
    const recent = this.redHistory.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    
    return Math.max(0.2, Math.min(1.0, 1 - Math.sqrt(variance) / mean));
  }
  
  reset(): void {
    this.detectionHistory = [];
    this.qualityHistory = [];
    this.redHistory = [];
  }
}
