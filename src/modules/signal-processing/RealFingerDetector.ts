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
  
  // UMBRALES AJUSTADOS PARA DEDOS HUMANOS REALES
  private readonly REAL_THRESHOLDS = {
    MIN_RED: 10,          // Más bajo para dedos reales
    MAX_RED: 210,         // Más alto para permitir variación natural
    MIN_RG_RATIO: 1.05,   // Más permisivo para dedos reales
    MAX_RG_RATIO: 3.5,    // Mayor rango para condiciones variables
    MIN_TEXTURE: 0.01,    // Más bajo para detectar piel suave
    MIN_STABILITY: 0.08,  // Más permisivo para movimiento natural
    CALIBRATION_SAMPLES: 18,
    MIN_CONFIDENCE: 1.4   // Umbral más bajo para dedos reales
  };
  
  detectFinger(imageData: ImageData): FingerDetectionResult {
    // Extraer métricas básicas
    const metrics = this.extractBasicMetrics(imageData);
    
    // Auto-calibración simple
    if (!this.isCalibrated) {
      this.performSimpleCalibration(metrics.redIntensity);
    }
    
    // Validaciones mejoradas para dedos humanos
    const validation = this.performHumanFingerValidation(metrics);
    
    // Decisión optimizada para dedos reales
    const isDetected = this.makeHumanFingerDecision(validation, metrics);
    
    // Actualizar historial
    this.updateHistory(metrics.redIntensity, isDetected);
    
    // Calcular calidad optimizada para humanos
    const quality = this.calculateHumanFingerQuality(metrics, isDetected, validation.confidence);
    
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
    
    // Área central más grande para capturar mejor el dedo
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.14; // Área más grande
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
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
    
    // Textura más permisiva para piel humana
    let textureScore = 0;
    if (intensities.length > 10) {
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
      textureScore = Math.sqrt(variance) / 255;
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
      this.baselineRed = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
      this.isCalibrated = true;
      
      console.log("RealFingerDetector: Calibración completada para dedos humanos", {
        baseline: this.baselineRed.toFixed(1),
        samples: this.calibrationSamples.length
      });
    }
  }
  
  private performHumanFingerValidation(metrics: any) {
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Validación de intensidad roja más permisiva (30%)
    if (metrics.redIntensity >= this.REAL_THRESHOLDS.MIN_RED && 
        metrics.redIntensity <= this.REAL_THRESHOLDS.MAX_RED) {
      score += 0.20;
      reasons.push(`✓ Rojo válido: ${metrics.redIntensity.toFixed(1)}`);
      
      // Bonus para rangos típicos de dedo humano
      if (metrics.redIntensity >= 80 && metrics.redIntensity <= 200) {
        score += 0.50;
        reasons.push(`✓ Rango óptimo para dedo humano`);
      }
    } else {
      reasons.push(`✗ Rojo fuera de rango: ${metrics.redIntensity.toFixed(1)}`);
    }
    
    // 2. Validación del ratio R/G más permisiva (25%)
    if (metrics.rgRatio >= this.REAL_THRESHOLDS.MIN_RG_RATIO && 
        metrics.rgRatio <= this.REAL_THRESHOLDS.MAX_RG_RATIO) {
      score += 0.15;
      reasons.push(`✓ Ratio R/G: ${metrics.rgRatio.toFixed(2)}`);
      
      // Bonus para ratios típicos de piel
      if (metrics.rgRatio >= 1.2 && metrics.rgRatio <= 2.0) {
        score += 0.20;
        reasons.push(`✓ Ratio típico de piel humana`);
      }
    } else {
      reasons.push(`✗ Ratio R/G anómalo: ${metrics.rgRatio.toFixed(2)}`);
    }
    
    // 3. Validación de textura permisiva (15%)
    if (metrics.textureScore >= this.REAL_THRESHOLDS.MIN_TEXTURE) {
      score += 0.15;
      reasons.push(`✓ Textura: ${(metrics.textureScore * 100).toFixed(1)}%`);
    } else {
      // No penalizar mucho la textura baja en dedos
      score += 0.6;
      reasons.push(`~ Textura baja pero aceptable: ${(metrics.textureScore * 100).toFixed(1)}%`);
    }
    
    // 4. Validación de estabilidad permisiva (15%)
    const stability = this.calculateStability();
    if (stability >= this.REAL_THRESHOLDS.MIN_STABILITY) {
      score += 0.15;
      reasons.push(`✓ Estabilidad: ${(stability * 100).toFixed(1)}%`);
    } else {
      // Algo de puntaje incluso con baja estabilidad
      score += 0.05;
      reasons.push(`~ Estabilidad baja: ${(stability * 100).toFixed(1)}%`);
    }
    
    // Bonus por calibración y consistencia
    if (this.isCalibrated && this.baselineRed > 0) {
      const deviation = Math.abs(metrics.redIntensity - this.baselineRed) / this.baselineRed;
      if (deviation < 0.5) { // Más permisivo
        score += 0.10;
        reasons.push(`✓ Consistente con calibración`);
      }
    }
    
    return {
      score: Math.min(1.0, score),
      reasons,
      confidence: Math.min(1.0, score)
    };
  }
  
  private makeHumanFingerDecision(validation: any, metrics: any): boolean {
    // Nueva lógica: si la textura no corresponde a un patrón de huella dactilar, anular detección.
    // Esto es determinante para descartar superficies planas o ruidosas sin huella.
    const optimalMinTexture = 0.015; // Umbral inferior para textura de huella (más bajo que MIN_TEXTURE general)
    const optimalMaxTexture = 0.1;   // Umbral superior para textura de huella (para evitar ruido)

    if (metrics.textureScore < optimalMinTexture || metrics.textureScore > optimalMaxTexture) {
        console.log("RealFingerDetector: Dedo no detectado (patrón de huella no válido)", { textureScore: metrics.textureScore.toFixed(3) });
        return false;
    }

    // Nueva lógica: si la intensidad roja es extremadamente baja o alta, el dedo no está presente.
    // Esto actúa como una anulación clara para cuando se retira el dedo o hay condiciones de luz extremas.
    const isTooDark = metrics.redIntensity < 5; // Muy baja intensidad roja (cerca de negro)
    const isTooBright = metrics.redIntensity > 280; // Muy alta intensidad roja (sobreexposición o blanco)

    if (isTooDark || isTooBright) {
        console.log("RealFingerDetector: Dedo no detectado (intensidad roja fuera de rango óptimo)", {
            redIntensity: metrics.redIntensity.toFixed(1),
            isTooDark,
            isTooBright
        });
        return false;
    }

    // Umbral más bajo para dedos humanos
    if (validation.confidence < this.REAL_THRESHOLDS.MIN_CONFIDENCE) {
      return false;
    }
    
    // Filtro temporal más permisivo
    this.detectionHistory.push(validation.confidence >= this.REAL_THRESHOLDS.MIN_CONFIDENCE);
    if (this.detectionHistory.length > 4) {
      this.detectionHistory.shift();
    }
    
    // Permitir detección más rápida
    if (this.detectionHistory.length >= 2) {
      const recentDetections = this.detectionHistory.slice(-2);
      const positiveCount = recentDetections.filter(d => d).length;
      
      // Solo necesita 1 de 2 detecciones positivas
      return positiveCount >= 1;
    }
    
    // Para las primeras muestras, ser menos estricto
    return validation.confidence >= 0.4;
  }
  
  private calculateHumanFingerQuality(metrics: any, isDetected: boolean, confidence: number): number {
    if (!isDetected) {
      return Math.max(8, Math.min(25, confidence * 25));
    }
    
    let quality = 30 + (confidence * 40); // Base más alta para dedos detectados
    
    // Bonus por métricas típicas de dedo humano
    if (metrics.redIntensity >= 80 && metrics.redIntensity <= 200) {
      quality += 25; // Gran bonus para rango humano típico
    }
    
    if (metrics.rgRatio >= 1.2 && metrics.rgRatio <= 2.5) {
      quality += 20; // Bonus para ratio típico de piel
    }
    
    // Bonus moderado por textura y estabilidad
    quality += metrics.textureScore * 10;
    quality += this.calculateStability() * 8;
    
    // Penalización reducida para valores extremos
    if (metrics.redIntensity > 240 || metrics.redIntensity < 50) {
      quality -= 10; // Penalización menor
    }
    
    return Math.min(95, Math.max(20, Math.round(quality)));
  }
  
  private updateHistory(redIntensity: number, detected: boolean): void {
    this.redHistory.push(redIntensity);
    if (this.redHistory.length > 6) {
      this.redHistory.shift();
    }
  }
  
  private calculateStability(): number {
    if (this.redHistory.length < 2) return 0.5; // Valor neutral inicial
    
    const recent = this.redHistory.slice(-4);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (mean === 0) return 0.0;
    
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.0, Math.min(1.0, 1 - (cv * 1.5))); // Menos sensible a variaciones
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

export function detectFinger(sensorData: {
  pressure: number;
  fingerprintPattern: boolean;
  brightness: number; // valor de 0 (oscuro) a 1 (muy brillante)
}): "FINGER_ON" | "FINGER_OFF" {
  const PRESSURE_THRESHOLD = 0.8;
  const HIGH_BRIGHTNESS_THRESHOLD = 0.4; // Si el brillo supera este valor, se considera dedo fuera

  // Regla inapelable: si hay brillo alto, el dedo no está presente.
  if (sensorData.brightness > HIGH_BRIGHTNESS_THRESHOLD) {
    return "FINGER_OFF";
  }

  // De lo contrario, si se cumplen las condiciones del dedo, se retorna FINGER_ON
  if (sensorData.pressure >= PRESSURE_THRESHOLD && sensorData.fingerprintPattern) {
    return "FINGER_ON";
  }
  return "FINGER_OFF";
}
