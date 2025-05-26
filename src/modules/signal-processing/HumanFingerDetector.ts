
/**
 * DETECTOR DEFINITIVO DE DEDO HUMANO
 * Sistema unificado con criterios médicos estrictos
 * Agresivo contra falsos positivos, sensible a dedos reales
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
  // CRITERIOS MÉDICOS ESTRICTOS PARA PIEL HUMANA
  private readonly HUMAN_SKIN_CRITERIA = {
    // Reflectancia roja específica para melanina/hemoglobina
    RED_REFLECTANCE_MIN: 80,
    RED_REFLECTANCE_MAX: 150,
    RED_OPTIMAL: 115,
    
    // Ratio R/G para hemoglobina en capilares
    RG_RATIO_MIN: 1.2,
    RG_RATIO_MAX: 1.8,
    RG_OPTIMAL: 1.5,
    
    // Temperatura de color humana (3000-4000K)
    COLOR_TEMP_MIN: 3000,
    COLOR_TEMP_MAX: 4000,
    
    // Textura de epidermis
    TEXTURE_MIN: 0.02,
    TEXTURE_MAX: 0.12,
    
    // Estabilidad temporal (dedo quieto)
    TEMPORAL_STABILITY_MIN: 0.85,
    
    // Área mínima cubierta
    MIN_AREA_PERCENTAGE: 15,
    
    // Gradiente de bordes suave
    MAX_EDGE_GRADIENT: 0.3,
    
    // Anti-brillos especulares
    MAX_SPECULAR_RATIO: 2.5
  };
  
  // DETECCIÓN AGRESIVA DE FALSOS POSITIVOS
  private readonly FALSE_POSITIVE_BLACKLIST = {
    // Materiales artificiales por reflectancia
    PLASTIC_RED_MIN: 180,
    PAPER_UNIFORMITY_MAX: 0.01,
    METAL_SPECULAR_MIN: 3.0,
    
    // Colores no-piel
    BLUE_DOMINANT_THRESHOLD: 1.3,
    GREEN_DOMINANT_THRESHOLD: 1.5,
    
    // Objetos demasiado uniformes
    ARTIFICIAL_UNIFORMITY_MAX: 0.005
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
    
    // 2. ANÁLISIS ESPECTRAL DE PIEL HUMANA
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);
    
    // 3. DETECCIÓN AGRESIVA DE FALSOS POSITIVOS
    const falsePositiveCheck = this.detectFalsePositives(metrics);
    
    // 4. VALIDACIÓN TEMPORAL ESTRICTA
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis);
    
    // 5. DECISIÓN FINAL UNIFICADA
    const finalDecision = this.makeFinalDecision(
      spectralAnalysis, 
      falsePositiveCheck, 
      temporalValidation
    );
    
    // 6. CALIDAD INTEGRADA BASADA EN CONFIANZA HUMANA
    const quality = this.calculateIntegratedQuality(finalDecision, metrics);
    
    // 7. EXTRACCIÓN DE SEÑAL PPG
    const rawValue = this.extractPPGSignal(imageData, finalDecision.isHumanFinger);
    const filteredValue = this.applyAdaptiveFilter(rawValue);
    
    // 8. ACTUALIZAR HISTORIALES
    this.updateHistories(metrics, finalDecision.isHumanFinger);
    
    // 9. LOGGING DETALLADO
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
    
    // ROI centrado y optimizado para dedo
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.25;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const redValues: number[] = [];
    const greenValues: number[] = [];
    const blueValues: number[] = [];
    const intensities: number[] = [];
    
    // Muestreo denso en ROI
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
    
    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      rgRatio: avgGreen > 5 ? avgRed / avgGreen : 0,
      rbRatio: avgBlue > 5 ? avgRed / avgBlue : 0,
      gbRatio: avgBlue > 5 ? avgGreen / avgBlue : 0,
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
    let confidence = 0;
    let isValid = true;
    
    // 1. ANÁLISIS DE REFLECTANCIA ROJA (30%)
    if (metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MIN && 
        metrics.redIntensity <= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MAX) {
      
      const redDeviation = Math.abs(metrics.redIntensity - this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL);
      const redScore = Math.max(0, 1 - (redDeviation / this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL));
      confidence += redScore * 0.30;
      reasons.push(`✓ Reflectancia roja humana: ${metrics.redIntensity.toFixed(1)}`);
      
      // Bonus para rango perfecto
      if (metrics.redIntensity >= 100 && metrics.redIntensity <= 130) {
        confidence += 0.10;
        reasons.push(`✓ Rango perfecto de melanina/hemoglobina`);
      }
    } else {
      isValid = false;
      reasons.push(`✗ Reflectancia roja no-humana: ${metrics.redIntensity.toFixed(1)}`);
    }
    
    // 2. RATIO R/G PARA HEMOGLOBINA (25%)
    if (metrics.rgRatio >= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MIN && 
        metrics.rgRatio <= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MAX) {
      
      const rgDeviation = Math.abs(metrics.rgRatio - this.HUMAN_SKIN_CRITERIA.RG_OPTIMAL);
      const rgScore = Math.max(0, 1 - (rgDeviation / this.HUMAN_SKIN_CRITERIA.RG_OPTIMAL));
      confidence += rgScore * 0.25;
      reasons.push(`✓ Ratio R/G de capilares: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      isValid = false;
      reasons.push(`✗ Ratio R/G anómalo: ${metrics.rgRatio.toFixed(2)}`);
    }
    
    // 3. TEMPERATURA DE COLOR HUMANA (20%)
    if (metrics.colorTemperature >= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MIN && 
        metrics.colorTemperature <= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MAX) {
      confidence += 0.20;
      reasons.push(`✓ Temperatura color humana: ${metrics.colorTemperature.toFixed(0)}K`);
    } else {
      isValid = false;
      reasons.push(`✗ Temperatura no-humana: ${metrics.colorTemperature.toFixed(0)}K`);
    }
    
    // 4. TEXTURA DE EPIDERMIS (15%)
    if (metrics.textureScore >= this.HUMAN_SKIN_CRITERIA.TEXTURE_MIN && 
        metrics.textureScore <= this.HUMAN_SKIN_CRITERIA.TEXTURE_MAX) {
      confidence += 0.15;
      reasons.push(`✓ Textura de piel: ${(metrics.textureScore * 100).toFixed(1)}%`);
    } else {
      reasons.push(`~ Textura atípica: ${(metrics.textureScore * 100).toFixed(1)}%`);
    }
    
    // 5. ÁREA ADECUADA (10%)
    if (metrics.areaPercentage >= this.HUMAN_SKIN_CRITERIA.MIN_AREA_PERCENTAGE) {
      confidence += 0.10;
      reasons.push(`✓ Área suficiente: ${metrics.areaPercentage.toFixed(1)}%`);
    } else {
      reasons.push(`~ Área insuficiente: ${metrics.areaPercentage.toFixed(1)}%`);
    }
    
    return {
      isValidSpectrum: isValid,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons
    };
  }
  
  private detectFalsePositives(metrics: any) {
    const rejectionReasons: string[] = [];
    let isFalsePositive = false;
    
    // 1. DETECCIÓN DE PLÁSTICO (reflectancia roja muy alta)
    if (metrics.redIntensity > this.FALSE_POSITIVE_BLACKLIST.PLASTIC_RED_MIN) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Material plástico detectado (R=${metrics.redIntensity})`);
    }
    
    // 2. DETECCIÓN DE PAPEL (demasiado uniforme)
    if (metrics.uniformity < this.FALSE_POSITIVE_BLACKLIST.PAPER_UNIFORMITY_MAX) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Superficie de papel detectada (uniformidad=${metrics.uniformity.toFixed(4)})`);
    }
    
    // 3. DETECCIÓN DE METAL (brillos especulares)
    if (metrics.specularRatio > this.FALSE_POSITIVE_BLACKLIST.METAL_SPECULAR_MIN) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Material metálico detectado (especular=${metrics.specularRatio.toFixed(2)})`);
    }
    
    // 4. COLORES DOMINANTES NO-PIEL
    if (metrics.gbRatio > this.FALSE_POSITIVE_BLACKLIST.BLUE_DOMINANT_THRESHOLD) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Color azul dominante (GB=${metrics.gbRatio.toFixed(2)})`);
    }
    
    if (metrics.rgRatio < 0.8) { // Verde dominante
      isFalsePositive = true;
      rejectionReasons.push(`✗ Color verde dominante (RG=${metrics.rgRatio.toFixed(2)})`);
    }
    
    // 5. GRADIENTE DE BORDES ARTIFICIAL
    if (metrics.edgeGradient > this.HUMAN_SKIN_CRITERIA.MAX_EDGE_GRADIENT) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Bordes artificiales detectados (gradiente=${metrics.edgeGradient.toFixed(3)})`);
    }
    
    // 6. RATIO ESPECULAR EXCESIVO
    if (metrics.specularRatio > this.HUMAN_SKIN_CRITERIA.MAX_SPECULAR_RATIO) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Brillos no-piel excesivos (especular=${metrics.specularRatio.toFixed(2)})`);
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
    
    if (this.redHistory.length > 5) {
      this.redHistory.shift();
      this.rgRatioHistory.shift();
    }
    
    const reasons: string[] = [];
    let temporalScore = 0;
    
    // Calcular estabilidad temporal
    const stability = this.calculateTemporalStability();
    
    if (stability >= this.HUMAN_SKIN_CRITERIA.TEMPORAL_STABILITY_MIN) {
      temporalScore += 0.5;
      reasons.push(`✓ Estabilidad temporal adecuada: ${(stability * 100).toFixed(1)}%`);
    } else {
      reasons.push(`~ Estabilidad baja: ${(stability * 100).toFixed(1)}%`);
    }
    
    // Validación de consistencia histórica
    if (this.redHistory.length >= 3) {
      const recentAvg = this.redHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const deviation = Math.abs(metrics.redIntensity - recentAvg) / recentAvg;
      
      if (deviation < 0.2) {
        temporalScore += 0.3;
        reasons.push(`✓ Consistencia temporal mantenida`);
      } else {
        reasons.push(`~ Variación temporal alta: ${(deviation * 100).toFixed(1)}%`);
      }
    }
    
    // Validación de calibración
    if (this.isCalibrated && this.calibrationBaseline > 0) {
      const calibrationDeviation = Math.abs(metrics.redIntensity - this.calibrationBaseline) / this.calibrationBaseline;
      if (calibrationDeviation < 0.3) {
        temporalScore += 0.2;
        reasons.push(`✓ Consistente con calibración`);
      }
    }
    
    return {
      temporalScore: Math.max(0, Math.min(1, temporalScore)),
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
    
    // DECISIÓN ESTRICTA: Debe pasar TODOS los criterios
    const isHumanFinger = 
      spectralAnalysis.isValidSpectrum && 
      !falsePositiveCheck.isFalsePositive &&
      spectralAnalysis.confidence >= 0.6 &&
      temporalValidation.temporalScore >= 0.3;
    
    // Confianza combinada
    let finalConfidence = 0;
    if (isHumanFinger) {
      finalConfidence = (
        spectralAnalysis.confidence * 0.7 +
        temporalValidation.temporalScore * 0.3
      );
    } else {
      // Penalización severa para falsos positivos
      finalConfidence = Math.min(0.2, spectralAnalysis.confidence * 0.3);
    }
    
    // Actualizar historial de detección
    this.detectionHistory.push(isHumanFinger);
    if (this.detectionHistory.length > 3) {
      this.detectionHistory.shift();
    }
    
    // Requerir 2 de 3 frames consecutivos para confirmación
    let temporalConfirmation = true;
    if (this.detectionHistory.length >= 3) {
      const recentDetections = this.detectionHistory.slice(-3);
      const positiveCount = recentDetections.filter(d => d).length;
      temporalConfirmation = positiveCount >= 2;
      
      if (!temporalConfirmation && isHumanFinger) {
        rejectionReasons.push(`✗ Falta confirmación temporal (${positiveCount}/3 frames)`);
      }
    }
    
    return {
      isHumanFinger: isHumanFinger && temporalConfirmation,
      confidence: finalConfidence,
      acceptanceReasons: allReasons,
      rejectionReasons
    };
  }
  
  private calculateIntegratedQuality(decision: any, metrics: any): number {
    if (!decision.isHumanFinger) {
      // Falsos positivos siempre baja calidad
      return Math.max(5, Math.min(25, decision.confidence * 30));
    }
    
    // Calidad basada en múltiples factores para dedos reales
    let quality = 50;
    
    // Bonus por confianza alta
    quality += decision.confidence * 30;
    
    // Bonus por métricas óptimas
    if (metrics.redIntensity >= 100 && metrics.redIntensity <= 130) {
      quality += 15;
    }
    
    if (metrics.rgRatio >= 1.3 && metrics.rgRatio <= 1.7) {
      quality += 10;
    }
    
    // Bonus por estabilidad
    const stability = this.calculateTemporalStability();
    quality += stability * 10;
    
    // Penalización por valores extremos
    if (metrics.redIntensity > 150 || metrics.redIntensity < 80) {
      quality -= 20;
    }
    
    return Math.max(15, Math.min(95, Math.round(quality)));
  }
  
  private extractPPGSignal(imageData: ImageData, isValidFinger: boolean): number {
    if (!isValidFinger) {
      return 0;
    }
    
    const { data, width, height } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.15; // ROI pequeño para PPG
    
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
    const alpha = 0.8;
    this.lastFilteredValue = alpha * this.lastFilteredValue + (1 - alpha) * rawValue;
    return this.lastFilteredValue;
  }
  
  private calculateColorTemperature(r: number, g: number, b: number): number {
    // Aproximación simplificada de temperatura de color
    if (r + g + b === 0) return 0;
    
    const ratio = (r + g + b) / (3 * 255);
    const temp = 6500 - (ratio * 2000); // Rango aproximado 4500-6500K
    return Math.max(2000, Math.min(8000, temp));
  }
  
  private calculateTextureScore(intensities: number[]): number {
    if (intensities.length < 10) return 0;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    return Math.min(1.0, Math.sqrt(variance) / 255);
  }
  
  private calculateEdgeGradient(values: number[]): number {
    if (values.length < 5) return 0;
    
    let gradientSum = 0;
    for (let i = 1; i < values.length - 1; i++) {
      const gradient = Math.abs(values[i+1] - values[i-1]) / 2;
      gradientSum += gradient;
    }
    
    return (gradientSum / (values.length - 2)) / 255;
  }
  
  private calculateSpecularRatio(reds: number[], greens: number[], blues: number[]): number {
    if (reds.length === 0) return 0;
    
    const maxRed = Math.max(...reds);
    const maxGreen = Math.max(...greens);
    const maxBlue = Math.max(...blues);
    const avgRed = reds.reduce((a, b) => a + b, 0) / reds.length;
    
    return avgRed > 0 ? maxRed / avgRed : 0;
  }
  
  private calculateUniformity(intensities: number[]): number {
    if (intensities.length < 5) return 0;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    return Math.sqrt(variance) / 255;
  }
  
  private calculateTemporalStability(): number {
    if (this.redHistory.length < 3) return 0.5;
    
    const mean = this.redHistory.reduce((a, b) => a + b, 0) / this.redHistory.length;
    if (mean === 0) return 0;
    
    const variance = this.redHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.redHistory.length;
    const cv = Math.sqrt(variance) / mean;
    
    return Math.max(0, Math.min(1, 1 - (cv * 1.5)));
  }
  
  private updateHistories(metrics: any, detected: boolean): void {
    // Calibración automática
    if (!this.isCalibrated && detected && this.redHistory.length >= 3) {
      this.calibrationBaseline = this.redHistory.reduce((a, b) => a + b, 0) / this.redHistory.length;
      this.isCalibrated = true;
      console.log(`HumanFingerDetector: Calibrado automáticamente (baseline: ${this.calibrationBaseline.toFixed(1)})`);
    }
  }
  
  private logDetectionResult(decision: any, metrics: any): void {
    if (this.frameCount % 30 === 0) {
      console.log("HumanFingerDetector:", {
        detected: decision.isHumanFinger,
        confidence: decision.confidence.toFixed(3),
        red: metrics.redIntensity.toFixed(1),
        rgRatio: metrics.rgRatio.toFixed(2),
        colorTemp: metrics.colorTemperature.toFixed(0) + "K",
        stability: (this.calculateTemporalStability() * 100).toFixed(1) + "%",
        reasons: decision.acceptanceReasons.slice(0, 2),
        rejections: decision.rejectionReasons.slice(0, 2)
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
      colorTemperature: 0,
      textureScore: 0,
      edgeGradient: 0,
      areaPercentage: 0,
      specularRatio: 0,
      uniformity: 0
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
