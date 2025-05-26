
/**
 * DETECTOR DE DEDOS HUMANOS REAL - UMBRALES ESTRICTOS
 * Calibrado para eliminar falsos positivos completamente
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
  
  // UMBRALES ESTRICTOS PARA ELIMINAR FALSOS POSITIVOS
  private readonly THRESHOLDS = {
    // Rango de rojo MUY específico para piel humana
    MIN_RED: 60,          // Mínimo estricto
    MAX_RED: 180,         // Máximo estricto
    
    // Ratio R/G muy específico para piel humana
    MIN_RG_RATIO: 1.2,    // Estricto para piel real
    MAX_RG_RATIO: 2.0,    // Estricto para piel real
    
    // Textura mínima para distinguir de superficies
    MIN_TEXTURE: 0.08,    // Más alto para requerir textura real
    
    // Estabilidad temporal requerida
    MIN_STABILITY: 0.6,   // Más estricto
    
    // Calidad mínima final MUY alta
    MIN_QUALITY: 70       // Alto para eliminar falsos positivos
  };
  
  detectFinger(imageData: ImageData): FingerDetectionResult {
    // 1. EXTRAER MÉTRICAS BÁSICAS
    const metrics = this.extractBasicMetrics(imageData);
    
    // 2. VALIDACIONES ESTRICTAS
    const validations = this.performStrictValidations(metrics);
    
    // 3. CALCULAR CALIDAD ESTRICTA
    const quality = this.calculateStrictQuality(metrics);
    
    // 4. CALCULAR CONFIANZA ESTRICTA
    const confidence = this.calculateStrictConfidence(validations, quality);
    
    // 5. DECISIÓN FINAL MUY ESTRICTA
    const isDetected = this.makeStrictDetectionDecision(confidence, quality, validations);
    
    // Actualizar historiales
    this.redHistory.push(metrics.redIntensity);
    if (this.redHistory.length > 10) {
      this.redHistory.shift();
    }
    
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
  
  private extractBasicMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // ROI central más pequeño y específico
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.15; // Más pequeño
    
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
    
    // Calcular textura más estricta
    let textureScore = 0;
    if (intensities.length > 20) {
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
      textureScore = Math.min(1.0, Math.sqrt(variance) / 30); // Más estricto
    }
    
    return {
      redIntensity: avgRed,
      rgRatio: avgGreen > 10 ? avgRed / avgGreen : 0.5, // Más estricto
      textureScore
    };
  }
  
  private performStrictValidations(metrics: any) {
    const reasons: string[] = [];
    let validationScore = 0;
    
    // Validación 1: Intensidad roja ESTRICTA
    if (metrics.redIntensity >= this.THRESHOLDS.MIN_RED && 
        metrics.redIntensity <= this.THRESHOLDS.MAX_RED) {
      validationScore += 0.4;
      reasons.push(`Rojo válido: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`Rojo inválido: ${metrics.redIntensity.toFixed(1)} (req: ${this.THRESHOLDS.MIN_RED}-${this.THRESHOLDS.MAX_RED})`);
    }
    
    // Validación 2: Ratio ESTRICTO para piel humana
    if (metrics.rgRatio >= this.THRESHOLDS.MIN_RG_RATIO && 
        metrics.rgRatio <= this.THRESHOLDS.MAX_RG_RATIO) {
      validationScore += 0.4;
      reasons.push(`Ratio piel válido: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      reasons.push(`Ratio inválido: ${metrics.rgRatio.toFixed(2)} (req: ${this.THRESHOLDS.MIN_RG_RATIO}-${this.THRESHOLDS.MAX_RG_RATIO})`);
    }
    
    // Validación 3: Textura ESTRICTA
    if (metrics.textureScore >= this.THRESHOLDS.MIN_TEXTURE) {
      validationScore += 0.2;
      reasons.push(`Textura válida: ${metrics.textureScore.toFixed(3)}`);
    } else {
      reasons.push(`Textura insuficiente: ${metrics.textureScore.toFixed(3)} (req: >${this.THRESHOLDS.MIN_TEXTURE})`);
    }
    
    return { score: validationScore, reasons };
  }
  
  private calculateStrictQuality(metrics: any): number {
    let quality = 0;
    
    // Solo otorgar puntos si cumple TODOS los criterios estrictos
    if (metrics.redIntensity >= this.THRESHOLDS.MIN_RED && 
        metrics.redIntensity <= this.THRESHOLDS.MAX_RED) {
      quality += 40;
    }
    
    if (metrics.rgRatio >= this.THRESHOLDS.MIN_RG_RATIO && 
        metrics.rgRatio <= this.THRESHOLDS.MAX_RG_RATIO) {
      quality += 40;
    }
    
    if (metrics.textureScore >= this.THRESHOLDS.MIN_TEXTURE) {
      quality += 20;
    }
    
    return quality;
  }
  
  private calculateStrictConfidence(validations: any, quality: number): number {
    // Confianza solo si TODAS las validaciones pasan
    if (validations.score < 1.0) return 0; // Fallo automático
    
    const qualityFactor = quality / 100;
    const stabilityFactor = this.calculateStability();
    
    return Math.min(1.0, qualityFactor * stabilityFactor);
  }
  
  private makeStrictDetectionDecision(confidence: number, quality: number, validations: any): boolean {
    // Decisión MUY estricta - TODOS los criterios deben cumplirse
    const passesValidations = validations.score >= 1.0;
    const passesQuality = quality >= this.THRESHOLDS.MIN_QUALITY;
    const passesConfidence = confidence >= 0.8;
    const passesStability = this.calculateStability() >= this.THRESHOLDS.MIN_STABILITY;
    
    const detected = passesValidations && passesQuality && passesConfidence && passesStability;
    
    // Agregar a historia para histéresis
    this.detectionHistory.push(detected);
    if (this.detectionHistory.length > 5) {
      this.detectionHistory.shift();
    }
    
    // Histéresis estricta: requiere detecciones consistentes
    if (this.detectionHistory.length >= 5) {
      const recentDetections = this.detectionHistory.filter(d => d).length;
      return recentDetections >= 4; // 4 de 5 deben ser positivas
    }
    
    return false; // No detectar hasta tener suficiente historia
  }
  
  private calculateStability(): number {
    if (this.redHistory.length < 5) return 0.0;
    
    const recent = this.redHistory.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    
    if (mean === 0) return 0.0;
    
    const cv = Math.sqrt(variance) / mean;
    return Math.max(0.0, Math.min(1.0, 1 - cv));
  }
  
  reset(): void {
    this.detectionHistory = [];
    this.qualityHistory = [];
    this.redHistory = [];
  }
}
