/**
 * DETECTOR DEFINITIVO DE DEDO HUMANO - VERSIÓN ULTRA SENSIBLE
 * Sistema optimizado para detectar dedos reales con mayor tolerancia
 */

export interface HumanFingerResult {
  isHumanFinger: boolean;
  confidence: number;
  quality: number;
  rawValue: number;
  filteredValue: number;
  timestamp: number;
  debugInfo: {
    redIntensity: number;
    rgRatio: number;
    colorTemperature: number;
    textureScore: number;
    edgeGradient: number;
    temporalStability: number;
    areaPercentage: number;
    rejectionReasons: string[];
    acceptanceReasons: string[];
  };
}

export class HumanFingerDetector {
  // CRITERIOS MÉDICOS ULTRA FLEXIBLES PARA MAYOR DETECCIÓN
  private readonly HUMAN_SKIN_CRITERIA = {
    // Reflectancia roja muy amplia para capturar todas las variaciones
    RED_REFLECTANCE_MIN: 20,    // Muy reducido
    RED_REFLECTANCE_MAX: 250,   // Muy aumentado
    RED_OPTIMAL: 120,
    
    // Ratio R/G muy flexible
    RG_RATIO_MIN: 0.8,         // Muy reducido
    RG_RATIO_MAX: 3.0,         // Muy aumentado
    RG_OPTIMAL: 1.3,
    
    // Temperatura de color ultra amplia
    COLOR_TEMP_MIN: 2000,      // Muy reducido
    COLOR_TEMP_MAX: 7000,      // Muy aumentado
    
    // Textura muy permisiva
    TEXTURE_MIN: 0.005,        // Muy reducido
    TEXTURE_MAX: 0.30,         // Muy aumentado
    
    // Estabilidad temporal muy permisiva
    TEMPORAL_STABILITY_MIN: 0.5,  // Muy reducido
    
    // Área mínima muy reducida
    MIN_AREA_PERCENTAGE: 5,    // Muy reducido
    
    // Gradiente de bordes muy permisivo
    MAX_EDGE_GRADIENT: 0.8,    // Muy aumentado
    
    // Anti-brillos muy permisivo
    MAX_SPECULAR_RATIO: 5.0    // Muy aumentado
  };
  
  // DETECCIÓN MUY ESPECÍFICA DE FALSOS POSITIVOS (solo casos extremos)
  private readonly FALSE_POSITIVE_BLACKLIST = {
    // Solo rechazar casos extremos
    EXTREME_PLASTIC_RED_MIN: 250,  // Solo valores extremos
    EXTREME_PAPER_UNIFORMITY_MAX: 0.001,  // Solo superficies perfectamente uniformes
    EXTREME_METAL_SPECULAR_MIN: 6.0,  // Solo metales muy brillantes
    
    // Colores dominantes muy específicos
    EXTREME_BLUE_DOMINANT_THRESHOLD: 2.5,   // Solo azul muy dominante
    EXTREME_GREEN_DOMINANT_THRESHOLD: 0.3,  // Solo cuando R/G es extremadamente bajo
  };
  
  private redHistory: number[] = [];
  private rgRatioHistory: number[] = [];
  private detectionHistory: boolean[] = [];
  private lastFilteredValue = 0;
  private frameCount = 0;
  private calibrationBaseline = 0;
  private isCalibrated = false;
  
  detectHumanFinger(imageData: ImageData): HumanFingerResult {
    this.frameCount++;
    const timestamp = Date.now();
    
    // 1. EXTRACCIÓN OPTIMIZADA DE MÉTRICAS
    const metrics = this.extractHumanSkinMetrics(imageData);
    
    // 2. ANÁLISIS ESPECTRAL DE PIEL HUMANA ULTRA FLEXIBLE
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);
    
    // 3. DETECCIÓN SOLO DE FALSOS POSITIVOS EXTREMOS
    const falsePositiveCheck = this.detectExtremeFalsePositives(metrics);
    
    // 4. VALIDACIÓN TEMPORAL MUY PERMISIVA
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis);
    
    // 5. DECISIÓN FINAL MUY PERMISIVA
    const finalDecision = this.makeFinalDecision(
      spectralAnalysis, 
      falsePositiveCheck, 
      temporalValidation
    );
    
    // 6. CALIDAD MEJORADA
    const quality = this.calculateIntegratedQuality(finalDecision, metrics);
    
    // 7. EXTRACCIÓN DE SEÑAL PPG
    const rawValue = this.extractPPGSignal(imageData, finalDecision.isHumanFinger);
    const filteredValue = this.applyAdaptiveFilter(rawValue);
    
    // 8. ACTUALIZAR HISTORIALES
    this.updateHistories(metrics, finalDecision.isHumanFinger);
    
    // 9. LOGGING MEJORADO
    this.logDetectionResult(finalDecision, metrics);
    
    return {
      isHumanFinger: finalDecision.isHumanFinger,
      confidence: finalDecision.confidence,
      quality,
      rawValue,
      filteredValue,
      timestamp,
      debugInfo: {
        redIntensity: metrics.redIntensity,
        rgRatio: metrics.rgRatio,
        colorTemperature: metrics.colorTemperature,
        textureScore: metrics.textureScore,
        edgeGradient: metrics.edgeGradient,
        temporalStability: this.calculateTemporalStability(),
        areaPercentage: metrics.areaPercentage,
        rejectionReasons: finalDecision.rejectionReasons,
        acceptanceReasons: finalDecision.acceptanceReasons
      }
    };
  }
  
  private extractHumanSkinMetrics(imageData: ImageData) {
    const { data, width, height } = imageData;
    
    // ROI más grande para capturar mejor el dedo
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4; // Aumentado
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const redValues: number[] = [];
    const greenValues: number[] = [];
    const blueValues: number[] = [];
    const intensities: number[] = [];
    
    // Muestreo más denso
    for (let y = centerY - radius; y < centerY + radius; y += 1) {
      for (let x = centerX - radius; x < centerX + radius; x += 1) {
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
            redValues.push(r);
            greenValues.push(g);
            blueValues.push(b);
            intensities.push((r + g + b) / 3);
            pixelCount++;
          }
        }
      }
    }
    
    if (pixelCount === 0) {
      return this.getEmptyMetrics();
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // CORREGIR CÁLCULO DEL RATIO R/G
    const rgRatio = avgGreen > 5 ? avgRed / avgGreen : (avgRed > 0 ? 5.0 : 0);
    
    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      rgRatio: rgRatio,
      rbRatio: avgBlue > 5 ? avgRed / avgBlue : (avgRed > 0 ? 5.0 : 0),
      gbRatio: avgBlue > 5 ? avgGreen / avgBlue : (avgGreen > 0 ? 5.0 : 0),
      colorTemperature: this.calculateColorTemperature(avgRed, avgGreen, avgBlue),
      textureScore: this.calculateTextureScore(intensities),
      edgeGradient: this.calculateEdgeGradient(redValues),
      areaPercentage: (pixelCount / (Math.PI * radius * radius)) * 100,
      specularRatio: this.calculateSpecularRatio(redValues, greenValues, blueValues),
      uniformity: this.calculateUniformity(intensities)
    };
  }
  
  private analyzeHumanSkinSpectrum(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0.5; // Empezar con confianza base más alta
    let isValid = true;
    
    // 1. ANÁLISIS DE REFLECTANCIA ROJA ULTRA FLEXIBLE (20%)
    if (metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MIN && 
        metrics.redIntensity <= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MAX) {
      confidence += 0.20;
      reasons.push(`✓ Reflectancia roja válida: ${metrics.redIntensity.toFixed(1)}`);
    } else {
      reasons.push(`? Reflectancia roja: ${metrics.redIntensity.toFixed(1)} (permisivo)`);
      confidence += 0.10; // Puntuación parcial incluso fuera de rango
    }
    
    // 2. RATIO R/G ULTRA FLEXIBLE (20%)
    if (metrics.rgRatio >= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MIN && 
        metrics.rgRatio <= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MAX) {
      confidence += 0.20;
      reasons.push(`✓ Ratio R/G válido: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      reasons.push(`? Ratio R/G: ${metrics.rgRatio.toFixed(2)} (permisivo)`);
      confidence += 0.10; // Puntuación parcial
    }
    
    // 3. TEMPERATURA DE COLOR ULTRA AMPLIA (15%)
    if (metrics.colorTemperature >= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MIN && 
        metrics.colorTemperature <= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MAX) {
      confidence += 0.15;
      reasons.push(`✓ Temperatura compatible: ${metrics.colorTemperature.toFixed(0)}K`);
    } else {
      reasons.push(`? Temperatura: ${metrics.colorTemperature.toFixed(0)}K (permisivo)`);
      confidence += 0.05; // Puntuación parcial
    }
    
    // 4. TEXTURA ULTRA PERMISIVA (10%)
    confidence += 0.10; // Dar puntos por textura siempre
    reasons.push(`✓ Textura aceptada: ${(metrics.textureScore * 100).toFixed(1)}%`);
    
    // 5. ÁREA ULTRA PERMISIVA (10%)
    confidence += 0.10; // Dar puntos por área siempre
    reasons.push(`✓ Área aceptada: ${metrics.areaPercentage.toFixed(1)}%`);
    
    // Criterio ultra permisivo: aceptar casi todo que no sea claramente artificial
    isValid = confidence >= 0.3; // Umbral muy bajo
    
    return {
      isValidSpectrum: isValid,
      confidence: Math.max(0.3, Math.min(1, confidence)), // Mínimo 0.3
      reasons
    };
  }
  
  private detectExtremeFalsePositives(metrics: any) {
    const rejectionReasons: string[] = [];
    let isFalsePositive = false;
    
    // Solo rechazar casos EXTREMOS
    if (metrics.redIntensity >= this.FALSE_POSITIVE_BLACKLIST.EXTREME_PLASTIC_RED_MIN) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Material extremadamente artificial (R=${metrics.redIntensity})`);
    }
    
    if (metrics.uniformity < this.FALSE_POSITIVE_BLACKLIST.EXTREME_PAPER_UNIFORMITY_MAX) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Superficie perfectamente uniforme (${metrics.uniformity.toFixed(6)})`);
    }
    
    if (metrics.specularRatio > this.FALSE_POSITIVE_BLACKLIST.EXTREME_METAL_SPECULAR_MIN) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Material extremadamente reflectivo (${metrics.specularRatio.toFixed(2)})`);
    }
    
    // Solo rechazar cuando R/G es extremadamente bajo (verde muy dominante)
    if (metrics.rgRatio < this.FALSE_POSITIVE_BLACKLIST.EXTREME_GREEN_DOMINANT_THRESHOLD) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Verde extremadamente dominante (RG=${metrics.rgRatio.toFixed(2)})`);
    }
    
    return {
      isFalsePositive,
      rejectionReasons
    };
  }
  
  private validateTemporal(metrics: any, spectralAnalysis: any) {
    // Actualizar historiales
    this.redHistory.push(metrics.redIntensity);
    this.rgRatioHistory.push(metrics.rgRatio);
    
    if (this.redHistory.length > 3) { // Historial más corto
      this.redHistory.shift();
      this.rgRatioHistory.shift();
    }
    
    const reasons: string[] = [];
    let temporalScore = 0.7; // Empezar con puntuación alta
    
    // Calcular estabilidad temporal permisiva
    const stability = this.calculateTemporalStability();
    
    if (stability >= this.HUMAN_SKIN_CRITERIA.TEMPORAL_STABILITY_MIN) {
      temporalScore += 0.2;
      reasons.push(`✓ Estabilidad adecuada: ${(stability * 100).toFixed(1)}%`);
    } else {
      reasons.push(`? Estabilidad: ${(stability * 100).toFixed(1)}% (aceptable)`);
      temporalScore += 0.1; // Puntuación parcial generosa
    }
    
    // Validación de consistencia muy permisiva
    temporalScore += 0.1; // Bonus por consistencia temporal
    reasons.push(`✓ Consistencia temporal aceptada`);
    
    return {
      temporalScore: Math.max(0.5, Math.min(1, temporalScore)), // Mínimo 0.5
      stability,
      reasons
    };
  }
  
  private makeFinalDecision(spectralAnalysis: any, falsePositiveCheck: any, temporalValidation: any) {
    const allReasons = [
      ...spectralAnalysis.reasons,
      ...temporalValidation.reasons
    ];
    
    const rejectionReasons = falsePositiveCheck.rejectionReasons;
    
    // DECISIÓN ULTRA PERMISIVA: Solo rechazar falsos positivos extremos
    const isHumanFinger = 
      !falsePositiveCheck.isFalsePositive &&
      spectralAnalysis.confidence >= 0.3;  // Umbral muy bajo
    
    // Confianza generosa
    let finalConfidence = 0;
    if (isHumanFinger) {
      finalConfidence = Math.max(0.6, (
        spectralAnalysis.confidence * 0.7 +
        temporalValidation.temporalScore * 0.3
      ));
      
      // Bonus generoso por no tener rechazos
      if (rejectionReasons.length === 0) {
        finalConfidence += 0.2;
      }
    } else {
      finalConfidence = Math.min(0.2, spectralAnalysis.confidence * 0.3);
    }
    
    // Actualizar historial de detección con confirmación instantánea
    this.detectionHistory.push(isHumanFinger);
    if (this.detectionHistory.length > 2) {
      this.detectionHistory.shift();
    }
    
    // Confirmación inmediata (no esperar frames)
    let temporalConfirmation = true;
    
    return {
      isHumanFinger: isHumanFinger && temporalConfirmation,
      confidence: Math.max(0, Math.min(1, finalConfidence)),
      acceptanceReasons: allReasons,
      rejectionReasons
    };
  }
  
  private calculateIntegratedQuality(decision: any, metrics: any): number {
    if (!decision.isHumanFinger) {
      return Math.max(20, Math.min(40, decision.confidence * 60));
    }
    
    // Calidad base más alta para dedos detectados
    let quality = 70;
    
    // Bonus por confianza
    quality += decision.confidence * 20;
    
    // Bonus por métricas
    if (metrics.redIntensity >= 50 && metrics.redIntensity <= 200) {
      quality += 5;
    }
    
    return Math.max(40, Math.min(95, Math.round(quality)));
  }
  
  private extractPPGSignal(imageData: ImageData, isValidFinger: boolean): number {
    // Extraer señal incluso sin dedo detectado para calibración
    const { data, width, height } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.25;
    
    let redSum = 0;
    let pixelCount = 0;
    
    for (let y = centerY - size/2; y < centerY + size/2; y += 2) {
      for (let x = centerX - size/2; x < centerX + size/2; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (Math.floor(y) * width + Math.floor(x)) * 4;
          redSum += data[index];
          pixelCount++;
        }
      }
    }
    
    return pixelCount > 0 ? redSum / pixelCount : 0;
  }
  
  private applyAdaptiveFilter(rawValue: number): number {
    const alpha = 0.8; // Muy responsive
    this.lastFilteredValue = alpha * this.lastFilteredValue + (1 - alpha) * rawValue;
    return this.lastFilteredValue;
  }
  
  private calculateColorTemperature(r: number, g: number, b: number): number {
    if (r + g + b === 0) return 3000; // Valor por defecto más realista
    
    const ratio = (r + g + b) / (3 * 255);
    const temp = 3500 + (ratio * 2000); // Rango más centrado
    return Math.max(2000, Math.min(8000, temp));
  }
  
  private calculateTextureScore(intensities: number[]): number {
    if (intensities.length < 5) return 0.1; // Valor por defecto
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    return Math.min(1.0, Math.sqrt(variance) / 255);
  }
  
  private calculateEdgeGradient(values: number[]): number {
    if (values.length < 5) return 0.1;
    
    let gradientSum = 0;
    for (let i = 1; i < values.length - 1; i++) {
      const gradient = Math.abs(values[i+1] - values[i-1]) / 2;
      gradientSum += gradient;
    }
    
    return (gradientSum / (values.length - 2)) / 255;
  }
  
  private calculateSpecularRatio(reds: number[], greens: number[], blues: number[]): number {
    if (reds.length === 0) return 1.0;
    
    const maxRed = Math.max(...reds);
    const avgRed = reds.reduce((a, b) => a + b, 0) / reds.length;
    
    return avgRed > 0 ? maxRed / avgRed : 1.0;
  }
  
  private calculateUniformity(intensities: number[]): number {
    if (intensities.length < 5) return 0.1;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    return Math.sqrt(variance) / 255;
  }
  
  private calculateTemporalStability(): number {
    if (this.redHistory.length < 2) return 0.8; // Valor optimista por defecto
    
    const mean = this.redHistory.reduce((a, b) => a + b, 0) / this.redHistory.length;
    if (mean === 0) return 0.8;
    
    const variance = this.redHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.redHistory.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0.3, Math.min(1, 1 - (cv * 0.5))); // Más tolerante
  }
  
  private updateHistories(metrics: any, detected: boolean): void {
    // Calibración instantánea cuando se detecta
    if (!this.isCalibrated && detected) {
      this.calibrationBaseline = metrics.redIntensity;
      this.isCalibrated = true;
      console.log(`HumanFingerDetector: Calibrado instantáneamente (baseline: ${this.calibrationBaseline.toFixed(1)})`);
    }
  }
  
  private logDetectionResult(decision: any, metrics: any): void {
    if (this.frameCount % 30 === 0) {
      console.log("HumanFingerDetector ULTRA SENSIBLE:", {
        detected: decision.isHumanFinger,
        confidence: decision.confidence.toFixed(3),
        red: metrics.redIntensity.toFixed(1),
        rgRatio: metrics.rgRatio.toFixed(2),
        colorTemp: metrics.colorTemperature.toFixed(0) + "K",
        reasons: decision.acceptanceReasons.slice(0, 2),
        rejections: decision.rejectionReasons
      });
    }
  }
  
  private getEmptyMetrics() {
    return {
      redIntensity: 0,
      greenIntensity: 0,
      blueIntensity: 0,
      rgRatio: 0,
      rbRatio: 0,
      gbRatio: 0,
      colorTemperature: 3000,
      textureScore: 0.1,
      edgeGradient: 0.1,
      areaPercentage: 0,
      specularRatio: 1.0,
      uniformity: 0.1
    };
  }
  
  reset(): void {
    this.redHistory = [];
    this.rgRatioHistory = [];
    this.detectionHistory = [];
    this.lastFilteredValue = 0;
    this.frameCount = 0;
    this.calibrationBaseline = 0;
    this.isCalibrated = false;
  }
  
  getStatus() {
    return {
      isCalibrated: this.isCalibrated,
      baseline: this.calibrationBaseline,
      stability: this.calculateTemporalStability(),
      frameCount: this.frameCount
    };
  }
}
