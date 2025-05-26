/**
 * DETECTOR DEFINITIVO DE DEDO HUMANO - VERSIÓN CALIBRADA
 * Sistema unificado con criterios médicos ajustados para mayor sensibilidad
 * Mantiene rechazo agresivo de falsos positivos
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
  // CRITERIOS MÉDICOS AJUSTADOS PARA MAYOR SENSIBILIDAD
  private readonly HUMAN_SKIN_CRITERIA = {
    // Reflectancia roja ampliada para capturar más variaciones de piel
    RED_REFLECTANCE_MIN: 45,    // Reducido de 80
    RED_REFLECTANCE_MAX: 180,   // Aumentado de 150
    RED_OPTIMAL: 100,           // Reducido de 115
    
    // Ratio R/G más flexible para diferentes tonos de piel
    RG_RATIO_MIN: 1.0,         // Reducido de 1.2
    RG_RATIO_MAX: 2.2,         // Aumentado de 1.8
    RG_OPTIMAL: 1.4,           // Reducido de 1.5
    
    // Temperatura de color más amplia
    COLOR_TEMP_MIN: 2500,      // Reducido de 3000
    COLOR_TEMP_MAX: 5000,      // Aumentado de 4000
    
    // Textura más flexible
    TEXTURE_MIN: 0.01,         // Reducido de 0.02
    TEXTURE_MAX: 0.20,         // Aumentado de 0.12
    
    // Estabilidad temporal más permisiva
    TEMPORAL_STABILITY_MIN: 0.75,  // Reducido de 0.85
    
    // Área mínima reducida
    MIN_AREA_PERCENTAGE: 10,   // Reducido de 15
    
    // Gradiente de bordes más permisivo
    MAX_EDGE_GRADIENT: 0.5,    // Aumentado de 0.3
    
    // Anti-brillos ajustado
    MAX_SPECULAR_RATIO: 3.5    // Aumentado de 2.5
  };
  
  // DETECCIÓN MÁS ESPECÍFICA DE FALSOS POSITIVOS
  private readonly FALSE_POSITIVE_BLACKLIST = {
    // Materiales artificiales por reflectancia extrema
    PLASTIC_RED_MIN: 200,       // Aumentado de 180
    PAPER_UNIFORMITY_MAX: 0.003, // Reducido de 0.01
    METAL_SPECULAR_MIN: 4.0,    // Aumentado de 3.0
    
    // Colores dominantes no-piel más específicos
    BLUE_DOMINANT_THRESHOLD: 1.5,   // Aumentado de 1.3
    GREEN_DOMINANT_THRESHOLD: 2.0,  // Aumentado de 1.5
    
    // Uniformidad artificial más específica
    ARTIFICIAL_UNIFORMITY_MAX: 0.002  // Reducido de 0.005
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
    
    // 2. ANÁLISIS ESPECTRAL DE PIEL HUMANA CON CRITERIOS FLEXIBLES
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);
    
    // 3. DETECCIÓN ESPECÍFICA DE FALSOS POSITIVOS
    const falsePositiveCheck = this.detectFalsePositives(metrics);
    
    // 4. VALIDACIÓN TEMPORAL FLEXIBLE
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis);
    
    // 5. DECISIÓN FINAL BALANCEADA
    const finalDecision = this.makeFinalDecision(
      spectralAnalysis, 
      falsePositiveCheck, 
      temporalValidation
    );
    
    // 6. CALIDAD INTEGRADA MEJORADA
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
    
    // ROI centrado y optimizado para dedo
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3; // Aumentado de 0.25
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const redValues: number[] = [];
    const greenValues: number[] = [];
    const blueValues: number[] = [];
    const intensities: number[] = [];
    
    // Muestreo más denso para mejor análisis
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
      rgRatio: avgGreen > 1 ? avgRed / avgGreen : 0,  // Umbral reducido
      rbRatio: avgBlue > 1 ? avgRed / avgBlue : 0,    // Umbral reducido
      gbRatio: avgBlue > 1 ? avgGreen / avgBlue : 0,  // Umbral reducido
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
    
    // 1. ANÁLISIS DE REFLECTANCIA ROJA MÁS FLEXIBLE (25%)
    if (metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MIN && 
        metrics.redIntensity <= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MAX) {
      
      const redDeviation = Math.abs(metrics.redIntensity - this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL);
      const maxDeviation = this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MAX - this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL;
      const redScore = Math.max(0, 1 - (redDeviation / maxDeviation));
      confidence += redScore * 0.25;
      reasons.push(`✓ Reflectancia roja válida: ${metrics.redIntensity.toFixed(1)}`);
      
      // Bonus para rango perfecto ampliado
      if (metrics.redIntensity >= 70 && metrics.redIntensity <= 140) {
        confidence += 0.15;
        reasons.push(`✓ Rango perfecto de piel humana`);
      }
    } else {
      reasons.push(`? Reflectancia roja fuera de rango: ${metrics.redIntensity.toFixed(1)}`);
      // No marcar como inválido inmediatamente, permitir que otros criterios compensen
    }
    
    // 2. RATIO R/G MÁS FLEXIBLE (25%)
    if (metrics.rgRatio >= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MIN && 
        metrics.rgRatio <= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MAX) {
      
      const rgDeviation = Math.abs(metrics.rgRatio - this.HUMAN_SKIN_CRITERIA.RG_OPTIMAL);
      const maxRgDeviation = this.HUMAN_SKIN_CRITERIA.RG_RATIO_MAX - this.HUMAN_SKIN_CRITERIA.RG_OPTIMAL;
      const rgScore = Math.max(0, 1 - (rgDeviation / maxRgDeviation));
      confidence += rgScore * 0.25;
      reasons.push(`✓ Ratio R/G de piel: ${metrics.rgRatio.toFixed(2)}`);
    } else {
      reasons.push(`? Ratio R/G atípico: ${metrics.rgRatio.toFixed(2)}`);
    }
    
    // 3. TEMPERATURA DE COLOR AMPLIADA (20%)
    if (metrics.colorTemperature >= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MIN && 
        metrics.colorTemperature <= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MAX) {
      confidence += 0.20;
      reasons.push(`✓ Temperatura color piel: ${metrics.colorTemperature.toFixed(0)}K`);
    } else {
      reasons.push(`? Temperatura atípica: ${metrics.colorTemperature.toFixed(0)}K`);
    }
    
    // 4. TEXTURA MÁS PERMISIVA (15%)
    if (metrics.textureScore >= this.HUMAN_SKIN_CRITERIA.TEXTURE_MIN && 
        metrics.textureScore <= this.HUMAN_SKIN_CRITERIA.TEXTURE_MAX) {
      confidence += 0.15;
      reasons.push(`✓ Textura compatible: ${(metrics.textureScore * 100).toFixed(1)}%`);
    } else {
      reasons.push(`? Textura no típica: ${(metrics.textureScore * 100).toFixed(1)}%`);
    }
    
    // 5. ÁREA SUFICIENTE (15%)
    if (metrics.areaPercentage >= this.HUMAN_SKIN_CRITERIA.MIN_AREA_PERCENTAGE) {
      confidence += 0.15;
      reasons.push(`✓ Área adecuada: ${metrics.areaPercentage.toFixed(1)}%`);
    } else {
      reasons.push(`? Área insuficiente: ${metrics.areaPercentage.toFixed(1)}%`);
    }
    
    // Criterio más flexible: validar si cumple al menos 3 de 5 criterios principales
    const criteriaMet = [
      metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MIN && 
      metrics.redIntensity <= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MAX,
      
      metrics.rgRatio >= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MIN && 
      metrics.rgRatio <= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MAX,
      
      metrics.colorTemperature >= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MIN && 
      metrics.colorTemperature <= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MAX,
      
      metrics.textureScore >= this.HUMAN_SKIN_CRITERIA.TEXTURE_MIN && 
      metrics.textureScore <= this.HUMAN_SKIN_CRITERIA.TEXTURE_MAX,
      
      metrics.areaPercentage >= this.HUMAN_SKIN_CRITERIA.MIN_AREA_PERCENTAGE
    ].filter(Boolean).length;
    
    isValid = criteriaMet >= 3; // Al menos 3 de 5 criterios
    
    return {
      isValidSpectrum: isValid,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons
    };
  }
  
  private detectFalsePositives(metrics: any) {
    const rejectionReasons: string[] = [];
    let isFalsePositive = false;
    
    // 1. DETECCIÓN MÁS ESPECÍFICA DE PLÁSTICO
    if (metrics.redIntensity > this.FALSE_POSITIVE_BLACKLIST.PLASTIC_RED_MIN) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Material plástico (R=${metrics.redIntensity})`);
    }
    
    // 2. DETECCIÓN MÁS ESPECÍFICA DE PAPEL
    if (metrics.uniformity < this.FALSE_POSITIVE_BLACKLIST.PAPER_UNIFORMITY_MAX) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Superficie artificial (uniformidad=${metrics.uniformity.toFixed(4)})`);
    }
    
    // 3. DETECCIÓN DE METAL MÁS ESPECÍFICA
    if (metrics.specularRatio > this.FALSE_POSITIVE_BLACKLIST.METAL_SPECULAR_MIN) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Material metálico (especular=${metrics.specularRatio.toFixed(2)})`);
    }
    
    // 4. COLORES DOMINANTES NO-PIEL MÁS ESPECÍFICOS
    if (metrics.gbRatio > this.FALSE_POSITIVE_BLACKLIST.BLUE_DOMINANT_THRESHOLD) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Color azul dominante (GB=${metrics.gbRatio.toFixed(2)})`);
    }
    
    if (metrics.rgRatio < 0.6) { // Más específico para verde
      isFalsePositive = true;
      rejectionReasons.push(`✗ Color verde dominante (RG=${metrics.rgRatio.toFixed(2)})`);
    }
    
    // 5. DETECCIÓN DE COLORES EXTREMOS
    if (metrics.redIntensity < 20 || metrics.greenIntensity < 10 || metrics.blueIntensity < 5) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Colores demasiado oscuros (R:${metrics.redIntensity.toFixed(0)} G:${metrics.greenIntensity.toFixed(0)} B:${metrics.blueIntensity.toFixed(0)})`);
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
      temporalScore += 0.6;
      reasons.push(`✓ Estabilidad adecuada: ${(stability * 100).toFixed(1)}%`);
    } else {
      reasons.push(`? Estabilidad baja: ${(stability * 100).toFixed(1)}%`);
      temporalScore += stability * 0.4; // Puntuación parcial
    }
    
    // Validación de consistencia con criterios más flexibles
    if (this.redHistory.length >= 3) {
      const recentAvg = this.redHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const deviation = Math.abs(metrics.redIntensity - recentAvg) / Math.max(recentAvg, 1);
      
      if (deviation < 0.3) { // Más permisivo
        temporalScore += 0.3;
        reasons.push(`✓ Consistencia temporal mantenida`);
      } else {
        reasons.push(`? Variación temporal: ${(deviation * 100).toFixed(1)}%`);
        temporalScore += Math.max(0, 0.3 - deviation); // Puntuación gradual
      }
    }
    
    // Validación de calibración más flexible
    if (this.isCalibrated && this.calibrationBaseline > 0) {
      const calibrationDeviation = Math.abs(metrics.redIntensity - this.calibrationBaseline) / Math.max(this.calibrationBaseline, 1);
      if (calibrationDeviation < 0.4) { // Más permisivo
        temporalScore += 0.1;
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
    
    // DECISIÓN MÁS BALANCEADA: Debe NO ser falso positivo y tener confianza mínima
    const isHumanFinger = 
      !falsePositiveCheck.isFalsePositive &&
      spectralAnalysis.confidence >= 0.4 &&  // Reducido de 0.6
      temporalValidation.temporalScore >= 0.2; // Reducido de 0.3
    
    // Confianza combinada mejorada
    let finalConfidence = 0;
    if (isHumanFinger) {
      finalConfidence = (
        spectralAnalysis.confidence * 0.6 +
        temporalValidation.temporalScore * 0.4
      );
      
      // Bonus por no tener rechazos
      if (rejectionReasons.length === 0) {
        finalConfidence += 0.1;
      }
    } else {
      // Penalización moderada para permitir mejora
      finalConfidence = Math.min(0.3, spectralAnalysis.confidence * 0.5);
    }
    
    // Actualizar historial de detección
    this.detectionHistory.push(isHumanFinger);
    if (this.detectionHistory.length > 3) {
      this.detectionHistory.shift();
    }
    
    // Requerir solo 1 de 2 frames recientes para confirmación más rápida
    let temporalConfirmation = true;
    if (this.detectionHistory.length >= 2) {
      const recentDetections = this.detectionHistory.slice(-2);
      const positiveCount = recentDetections.filter(d => d).length;
      temporalConfirmation = positiveCount >= 1; // Solo necesita 1 de 2
      
      if (!temporalConfirmation && isHumanFinger) {
        rejectionReasons.push(`? Esperando confirmación temporal (${positiveCount}/2 frames)`);
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
      // Calidad baja pero no cero para falsos negativos potenciales
      return Math.max(15, Math.min(35, decision.confidence * 50));
    }
    
    // Calidad mejorada para dedos detectados
    let quality = 60; // Base más alta
    
    // Bonus por confianza
    quality += decision.confidence * 25;
    
    // Bonus por métricas óptimas ampliadas
    if (metrics.redIntensity >= 70 && metrics.redIntensity <= 140) {
      quality += 10;
    }
    
    if (metrics.rgRatio >= 1.1 && metrics.rgRatio <= 1.9) {
      quality += 8;
    }
    
    // Bonus por estabilidad
    const stability = this.calculateTemporalStability();
    quality += stability * 7;
    
    return Math.max(25, Math.min(95, Math.round(quality)));
  }
  
  private extractPPGSignal(imageData: ImageData, isValidFinger: boolean): number {
    if (!isValidFinger) {
      return 0;
    }
    
    const { data, width, height } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.2; // ROI más grande
    
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
    const alpha = 0.7; // Más responsive
    this.lastFilteredValue = alpha * this.lastFilteredValue + (1 - alpha) * rawValue;
    return this.lastFilteredValue;
  }
  
  private calculateColorTemperature(r: number, g: number, b: number): number {
    if (r + g + b === 0) return 0;
    
    const ratio = (r + g + b) / (3 * 255);
    const temp = 6500 - (ratio * 3000); // Rango ampliado
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
    
    return Math.max(0, Math.min(1, 1 - (cv * 1.2))); // Menos estricto
  }
  
  private updateHistories(metrics: any, detected: boolean): void {
    // Calibración automática más rápida
    if (!this.isCalibrated && detected && this.redHistory.length >= 2) { // Reducido de 3
      this.calibrationBaseline = this.redHistory.reduce((a, b) => a + b, 0) / this.redHistory.length;
      this.isCalibrated = true;
      console.log(`HumanFingerDetector: Calibrado rápidamente (baseline: ${this.calibrationBaseline.toFixed(1)})`);
    }
  }
  
  private logDetectionResult(decision: any, metrics: any): void {
    if (this.frameCount % 30 === 0) {
      console.log("HumanFingerDetector CALIBRADO:", {
        detected: decision.isHumanFinger,
        confidence: decision.confidence.toFixed(3),
        red: metrics.redIntensity.toFixed(1),
        rgRatio: metrics.rgRatio.toFixed(2),
        colorTemp: metrics.colorTemperature.toFixed(0) + "K",
        stability: (this.calculateTemporalStability() * 100).toFixed(1) + "%",
        reasons: decision.acceptanceReasons.slice(0, 3),
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
