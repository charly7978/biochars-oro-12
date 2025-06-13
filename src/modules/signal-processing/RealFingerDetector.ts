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
  roi?: { x: number; y: number; width: number; height: number; };
}

export class RealFingerDetector {
  private detectionHistory: boolean[] = [];
  private redHistory: number[] = [];
  private calibrationSamples: number[] = [];
  private isCalibrated = false;
  private baselineRed = 0;
  
  // UMBRALES AJUSTADOS PARA MAYOR SENSIBILIDAD
  private readonly REAL_THRESHOLDS = {
    MIN_RED: 40,          // Mucho más bajo para permitir detección con menos luz
    MAX_RED: 350,         // Más alto para permitir más variación
    MIN_RG_RATIO: 0.95,   // Más permisivo aún
    MAX_RG_RATIO: 3.0,    // Permitir más variación de color
    MIN_TEXTURE: 0.02,    // Permitir menos textura
    MIN_STABILITY: 0.04,  // Permitir más movimiento
    CALIBRATION_SAMPLES: 5, // Calibración más rápida
    MIN_CONFIDENCE: 0.15   // Permitir menor confianza
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
      },
      roi: metrics.roi
    };
  }
  
  private extractBasicMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // Calcular una ROI dinámica basada en la detección de piel
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let skinPixels = 0;
    
    // Paso 1: Detección inicial de píxeles de piel (simplificado para este ejemplo)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Una heurística simple para detectar color de piel:
      // R > G > B y diferencias no demasiado grandes, y R > 50
      if (r > g && g > b && (r - g) < 70 && (g - b) < 70 && r > 50) {
        skinPixels++;
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const intensities: number[] = [];

    // Si se detectaron píxeles de piel, usar esa ROI. De lo contrario, usar una ROI central por defecto.
    const effectiveMinX = skinPixels > 100 ? minX : width / 2;
    const effectiveMinY = skinPixels > 100 ? minY : height / 2;
    const effectiveMaxX = skinPixels > 100 ? maxX : width / 2;
    const effectiveMaxY = skinPixels > 100 ? maxY : height / 2;
    
    const roiWidth = effectiveMaxX - effectiveMinX;
    const roiHeight = effectiveMaxY - effectiveMinY;
    const finalRadius = Math.min(roiWidth, roiHeight) / 2;
    const finalCenterX = effectiveMinX + roiWidth / 2;
    const finalCenterY = effectiveMinY + roiHeight / 2;

    for (let y = finalCenterY - finalRadius; y < finalCenterY + finalRadius; y += 3) {
      for (let x = finalCenterX - finalRadius; x < finalCenterX + finalRadius; x += 3) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const distance = Math.sqrt((x - finalCenterX) ** 2 + (y - finalCenterY) ** 2);
          if (distance <= finalRadius) {
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
      textureScore: Math.min(1.0, textureScore),
      roi: {
        x: effectiveMinX,
        y: effectiveMinY,
        width: roiWidth,
        height: roiHeight
      }
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
    let confidenceScore = 0; // Utilizaremos confidenceScore en lugar de score
    const maxPossibleScore = 1.0; // Puntuación máxima para confianza normalizada

    // Pesos para cada criterio
    const WEIGHT_RED_INTENSITY = 0.35;
    const WEIGHT_RG_RATIO = 0.25;
    const WEIGHT_TEXTURE = 0.20; // Aumentado para mayor importancia de textura
    const WEIGHT_STABILITY = 0.20; // Aumentado para mayor importancia de estabilidad

    // 1. Validación de intensidad roja (35% del peso)
    if (metrics.redIntensity >= 80 && metrics.redIntensity <= 200) {
      // Rango óptimo para dedos humanos: alta confianza
      confidenceScore += WEIGHT_RED_INTENSITY;
      reasons.push(`✓ Intensidad Roja Óptima: ${metrics.redIntensity.toFixed(1)}`);
    } else if (metrics.redIntensity >= 60 && metrics.redIntensity <= 250) {
      // Rango aceptable: confianza media
      confidenceScore += WEIGHT_RED_INTENSITY * 0.6;
      reasons.push(`~ Intensidad Roja Aceptable: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      // Fuera de rango: baja o nula contribución
      reasons.push(`✗ Intensidad Roja Anómala: ${metrics.redIntensity.toFixed(1)}`);
    }

    // 2. Validación del ratio R/G (25% del peso)
    if (metrics.rgRatio >= 1.2 && metrics.rgRatio <= 2.5) {
      // Rango óptimo para piel humana
      confidenceScore += WEIGHT_RG_RATIO;
      reasons.push(`✓ Ratio R/G Óptimo: ${metrics.rgRatio.toFixed(2)}`);
    } else if (metrics.rgRatio >= 1.05 && metrics.rgRatio <= 3.5) {
      // Rango aceptable
      confidenceScore += WEIGHT_RG_RATIO * 0.6;
      reasons.push(`~ Ratio R/G Aceptable: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      // Fuera de rango
      reasons.push(`✗ Ratio R/G Anómalo: ${metrics.rgRatio.toFixed(2)}`);
    }

    // 3. Validación de textura (20% del peso)
    if (metrics.textureScore >= 0.04) {
      // Textura clara y suficiente
      confidenceScore += WEIGHT_TEXTURE;
      reasons.push(`✓ Textura Detectada: ${(metrics.textureScore * 100).toFixed(1)}%`);
    } else if (metrics.textureScore >= 0.02) {
      // Textura aceptable pero baja
      confidenceScore += WEIGHT_TEXTURE * 0.5;
      reasons.push(`~ Textura Baja: ${(metrics.textureScore * 100).toFixed(1)}%`);
    } else {
      // Textura insuficiente
      reasons.push(`✗ Textura Insuficiente: ${(metrics.textureScore * 100).toFixed(1)}%`);
    }

    // 4. Validación de estabilidad (20% del peso)
    const stability = this.calculateStability(); // Asumo que calculateStability() retorna 0-1
    if (stability >= 0.7) {
      // Muy estable
      confidenceScore += WEIGHT_STABILITY;
      reasons.push(`✓ Estabilidad Alta: ${(stability * 100).toFixed(1)}%`);
    } else if (stability >= 0.4) {
      // Estabilidad moderada
      confidenceScore += WEIGHT_STABILITY * 0.6;
      reasons.push(`~ Estabilidad Moderada: ${(stability * 100).toFixed(1)}%`);
    } else {
      // Baja estabilidad
      reasons.push(`✗ Estabilidad Baja: ${(stability * 100).toFixed(1)}%`);
    }

    // Bonus por calibración y consistencia (opcional, menor peso, sumativo)
    if (this.isCalibrated && this.baselineRed > 0) {
      const deviation = Math.abs(metrics.redIntensity - this.baselineRed) / this.baselineRed;
      if (deviation < 0.3) { // Menor desviación, mayor consistencia
        confidenceScore += 0.05; // Pequeño bonus
        reasons.push(`✓ Consistencia con Calibración`);
      }
    }

    // Asegurar que la puntuación no exceda el máximo
    const finalConfidence = Math.min(maxPossibleScore, confidenceScore);

    return {
      score: finalConfidence,
      reasons,
      confidence: finalConfidence
    };
  }
  
  private makeHumanFingerDecision(validation: any, metrics: any): boolean {
    // Filtro temporal para reducir falsos positivos: requerir 2 de 3 detecciones positivas
    this.detectionHistory.push(validation.confidence >= this.REAL_THRESHOLDS.MIN_CONFIDENCE);
    if (this.detectionHistory.length > 3) { // Mantener un historial de 3 detecciones
      this.detectionHistory.shift();
    }
    
    // Requiere al menos 2 de las últimas 3 detecciones para ser positivas
    if (this.detectionHistory.length >= 2) { // Asegurar que tenemos al menos 2 datos
      const recentDetections = this.detectionHistory.slice(-3); // Tomar las últimas 3 detecciones
      const positiveCount = recentDetections.filter(d => d).length;
      
      return positiveCount >= 2;
    }
    
    // Para las primeras muestras, ser más permisivo si la confianza es alta
    return validation.confidence >= 0.7; // Aumentar el umbral inicial levemente
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

// Eliminar este archivo si FingerDetectionCore.ts ya cubre la detección de dedo.
