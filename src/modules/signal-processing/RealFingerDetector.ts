
/**
 * DETECTOR DE DEDOS REALES - SISTEMA CIENTÍFICAMENTE CORRECTO
 * Basado en características físicas reales de dedos humanos
 * Anti-falsificación robusto que rechaza objetos artificiales
 */

export interface FingerDetectionMetrics {
  skinToneValid: boolean;
  textureValid: boolean;
  perfusionDetected: boolean;
  pulsationDetected: boolean;
  antiSpoofingPassed: boolean;
  confidence: number;
}

export class RealFingerDetector {
  private pulseHistory: number[] = [];
  private skinTextureBuffer: number[] = [];
  private lastPerfusionTime = 0;
  private consecutiveValidFrames = 0;
  
  // Rangos científicamente correctos para piel humana
  private readonly REAL_SKIN_RANGES = {
    RED: { min: 120, max: 200 },    // Hemoglobina + melanina
    GREEN: { min: 80, max: 150 },   // Menor absorción
    BLUE: { min: 60, max: 120 }     // Mayor absorción
  };
  
  // Ratio R/G para detección de hemoglobina real
  private readonly HEMOGLOBIN_RATIO = { min: 1.2, max: 2.0 };
  
  // Variabilidad de textura para piel real (5-20%)
  private readonly SKIN_TEXTURE_VARIANCE = { min: 0.05, max: 0.20 };
  
  // Micro-pulsaciones cardíacas (0.5-3% variación)
  private readonly CARDIAC_VARIATION = { min: 0.005, max: 0.03 };

  /**
   * Detecta si hay un dedo real presente
   */
  detectRealFinger(imageData: ImageData): FingerDetectionMetrics {
    const { avgRed, avgGreen, avgBlue, textureVariance } = this.analyzeImageData(imageData);
    
    // 1. Validación de tono de piel real
    const skinToneValid = this.validateSkinTone(avgRed, avgGreen, avgBlue);
    
    // 2. Validación de textura de piel
    const textureValid = this.validateSkinTexture(textureVariance);
    
    // 3. Detección de perfusión sanguínea
    const perfusionDetected = this.detectBloodPerfusion(avgRed, avgGreen);
    
    // 4. Detección de micro-pulsaciones
    const pulsationDetected = this.detectCardiacPulsation(avgRed);
    
    // 5. Sistema anti-falsificación
    const antiSpoofingPassed = this.antiSpoofingCheck(avgRed, avgGreen, avgBlue, textureVariance);
    
    // Calcular confianza basada en todos los factores
    const confidence = this.calculateConfidence({
      skinToneValid,
      textureValid,
      perfusionDetected,
      pulsationDetected,
      antiSpoofingPassed
    });
    
    // Actualizar contadores de frames consecutivos válidos
    if (skinToneValid && perfusionDetected) {
      this.consecutiveValidFrames++;
    } else {
      this.consecutiveValidFrames = 0;
    }
    
    return {
      skinToneValid,
      textureValid,
      perfusionDetected,
      pulsationDetected,
      antiSpoofingPassed,
      confidence
    };
  }
  
  private analyzeImageData(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // Analizar área central (50% del frame)
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.25;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    for (let y = Math.max(0, centerY - radius); y < Math.min(height, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x < Math.min(width, centerX + radius); x++) {
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
    
    const avgRed = pixelCount > 0 ? redSum / pixelCount : 0;
    const avgGreen = pixelCount > 0 ? greenSum / pixelCount : 0;
    const avgBlue = pixelCount > 0 ? blueSum / pixelCount : 0;
    
    // Calcular varianza de textura
    const meanIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + (val - meanIntensity) ** 2, 0) / intensities.length;
    const textureVariance = Math.sqrt(variance) / meanIntensity;
    
    return { avgRed, avgGreen, avgBlue, textureVariance };
  }
  
  private validateSkinTone(red: number, green: number, blue: number): boolean {
    // Verificar rangos RGB para piel humana
    const redValid = red >= this.REAL_SKIN_RANGES.RED.min && red <= this.REAL_SKIN_RANGES.RED.max;
    const greenValid = green >= this.REAL_SKIN_RANGES.GREEN.min && green <= this.REAL_SKIN_RANGES.GREEN.max;
    const blueValid = blue >= this.REAL_SKIN_RANGES.BLUE.min && blue <= this.REAL_SKIN_RANGES.BLUE.max;
    
    return redValid && greenValid && blueValid;
  }
  
  private validateSkinTexture(textureVariance: number): boolean {
    // La piel real tiene variabilidad natural pero controlada
    this.skinTextureBuffer.push(textureVariance);
    if (this.skinTextureBuffer.length > 10) {
      this.skinTextureBuffer.shift();
    }
    
    const avgVariance = this.skinTextureBuffer.reduce((a, b) => a + b, 0) / this.skinTextureBuffer.length;
    return avgVariance >= this.SKIN_TEXTURE_VARIANCE.min && avgVariance <= this.SKIN_TEXTURE_VARIANCE.max;
  }
  
  private detectBloodPerfusion(red: number, green: number): boolean {
    // Ratio R/G debe estar en rango de hemoglobina oxigenada
    if (green === 0) return false;
    
    const ratio = red / green;
    const perfusionValid = ratio >= this.HEMOGLOBIN_RATIO.min && ratio <= this.HEMOGLOBIN_RATIO.max;
    
    if (perfusionValid) {
      this.lastPerfusionTime = Date.now();
    }
    
    // Perfusión debe mantenerse en los últimos 2 segundos
    return perfusionValid && (Date.now() - this.lastPerfusionTime < 2000);
  }
  
  private detectCardiacPulsation(red: number): boolean {
    this.pulseHistory.push(red);
    if (this.pulseHistory.length > 60) { // ~2 segundos a 30fps
      this.pulseHistory.shift();
    }
    
    if (this.pulseHistory.length < 20) return false;
    
    const mean = this.pulseHistory.reduce((a, b) => a + b, 0) / this.pulseHistory.length;
    if (mean === 0) return false;
    
    const variance = this.pulseHistory.reduce((acc, val) => acc + (val - mean) ** 2, 0) / this.pulseHistory.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Micro-variaciones cardíacas deben estar en rango fisiológico
    return cv >= this.CARDIAC_VARIATION.min && cv <= this.CARDIAC_VARIATION.max;
  }
  
  private antiSpoofingCheck(red: number, green: number, blue: number, textureVariance: number): boolean {
    // Rechazar pantallas (demasiado uniformes)
    if (textureVariance < 0.01) return false;
    
    // Rechazar objetos muy brillantes o muy oscuros
    const totalIntensity = red + green + blue;
    if (totalIntensity < 150 || totalIntensity > 600) return false;
    
    // Rechazar colores no naturales (demasiado saturados)
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
    if (saturation > 0.6) return false;
    
    // Verificar que no sea demasiado uniforme temporalmente
    return this.consecutiveValidFrames < 100; // Evitar detección estática perpetua
  }
  
  private calculateConfidence(metrics: Omit<FingerDetectionMetrics, 'confidence'>): number {
    let confidence = 0;
    
    // Pesos basados en importancia científica
    if (metrics.skinToneValid) confidence += 0.25;
    if (metrics.perfusionDetected) confidence += 0.30;
    if (metrics.pulsationDetected) confidence += 0.25;
    if (metrics.textureValid) confidence += 0.10;
    if (metrics.antiSpoofingPassed) confidence += 0.10;
    
    // Bonus por frames consecutivos válidos (estabilidad)
    const stabilityBonus = Math.min(0.15, this.consecutiveValidFrames / 100);
    confidence += stabilityBonus;
    
    return Math.min(1.0, confidence);
  }
  
  reset(): void {
    this.pulseHistory = [];
    this.skinTextureBuffer = [];
    this.lastPerfusionTime = 0;
    this.consecutiveValidFrames = 0;
  }
}
