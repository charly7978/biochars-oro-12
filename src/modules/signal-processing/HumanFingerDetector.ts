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
  // CRITERIOS MÉDICOS AJUSTADOS PARA MAYOR FIABILIDAD
  private readonly HUMAN_SKIN_CRITERIA = {
    // Reflectancia roja con rango más realista para dedo iluminado
    RED_REFLECTANCE_MIN: 40,    // Aumentado (antes 20)
    RED_REFLECTANCE_MAX: 230,   // Reducido (antes 250)
    RED_OPTIMAL_MIN: 70,        // Nuevo: rango óptimo
    RED_OPTIMAL_MAX: 180,       // Nuevo: rango óptimo
    
    // Ratio R/G ajustado para piel humana
    RG_RATIO_MIN: 0.9,          // Aumentado (antes 0.8)
    RG_RATIO_MAX: 2.5,          // Reducido (antes 3.0)
    RG_OPTIMAL_MIN: 1.1,        // Nuevo
    RG_OPTIMAL_MAX: 1.8,        // Nuevo
    
    // Temperatura de color más acotada
    COLOR_TEMP_MIN: 2200,      // Aumentado (antes 2000)
    COLOR_TEMP_MAX: 5500,      // Reducido (antes 7000)
    
    // Textura: variaciones sutiles son esperables
    TEXTURE_MIN: 0.01,         // Aumentado (antes 0.005)
    TEXTURE_MAX: 0.20,         // Reducido (antes 0.30)
    
    // Estabilidad temporal razonable
    TEMPORAL_STABILITY_MIN: 0.65, // Aumentado (antes 0.5)
    
    MIN_AREA_PERCENTAGE: 10,   // Aumentado (antes 5)
    MAX_EDGE_GRADIENT: 0.6,    // Reducido (antes 0.8)
    MAX_SPECULAR_RATIO: 3.5     // Reducido (antes 5.0)
  };
  
  private readonly FALSE_POSITIVE_BLACKLIST = {
    EXTREME_PLASTIC_RED_MIN: 240, // Ligeramente reducido
    EXTREME_PAPER_UNIFORMITY_MAX: 0.005, // Ligeramente aumentado
    EXTREME_METAL_SPECULAR_MIN: 4.5,   // Ligeramente reducido
    EXTREME_BLUE_DOMINANT_THRESHOLD: 2.0, // Más estricto
    EXTREME_GREEN_DOMINANT_THRESHOLD: 0.5, // Más estricto (R/G < 0.5)
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
    
    const metrics = this.extractHumanSkinMetrics(imageData);
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);
    const falsePositiveCheck = this.detectExtremeFalsePositives(metrics);
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis);
    const finalDecision = this.makeFinalDecision(
      spectralAnalysis, 
      falsePositiveCheck, 
      temporalValidation
    );
    
    const quality = this.calculateIntegratedQuality(finalDecision, metrics);
    const rawValue = this.extractPPGSignal(imageData, finalDecision.isHumanFinger);
    const filteredValue = this.applyAdaptiveFilter(rawValue);
    
    this.updateHistories(metrics, finalDecision.isHumanFinger);
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
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35; // ROI ligeramente más pequeño que antes (0.4)
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    const redValues: number[] = [];
    const greenValues: number[] = [];
    const blueValues: number[] = [];
    const intensities: number[] = [];
    
    for (let y = centerY - radius; y < centerY + radius; y += 2) { // Muestreo un poco menos denso
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
            redValues.push(r);
            greenValues.push(g);
            blueValues.push(b);
            intensities.push((r + g + b) / 3);
            pixelCount++;
          }
        }
      }
    }
    
    if (pixelCount < 10) { // Necesitamos un mínimo de píxeles
      return this.getEmptyMetrics();
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    const rgRatio = avgGreen > 10 ? avgRed / avgGreen : (avgRed > 0 ? 4.0 : 0); // Más robusto si G es bajo
    
    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      rgRatio: rgRatio,
      rbRatio: avgBlue > 10 ? avgRed / avgBlue : (avgRed > 0 ? 4.0 : 0),
      gbRatio: avgBlue > 10 ? avgGreen / avgBlue : (avgGreen > 0 ? 4.0 : 0),
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
    let confidence = 0.0; // Empezar con confianza base realista
    let criteriaMet = 0;
    const totalCriteria = 5; // Contar los criterios principales

    // 1. Reflectancia Roja (Peso: 0.3)
    if (metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MIN && 
        metrics.redIntensity <= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MAX) {
      confidence += 0.3;
      reasons.push(`✓ Reflectancia roja (${metrics.redIntensity.toFixed(1)}) en rango.`);
      criteriaMet++;
      if (metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL_MIN && metrics.redIntensity <= this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL_MAX) {
        confidence += 0.05; // Bonus por estar en rango óptimo
        reasons.push(`+ Reflectancia roja óptima.`);
      }
    } else {
      reasons.push(`✗ Reflectancia roja (${metrics.redIntensity.toFixed(1)}) fuera de rango.`);
      // Penalización pequeña si está cerca, mayor si está lejos
      const dist = Math.min(Math.abs(metrics.redIntensity - this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MIN), 
                            Math.abs(metrics.redIntensity - this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MAX));
      confidence -= Math.min(0.15, dist / 50); 
    }
    
    // 2. Ratio R/G (Peso: 0.25)
    if (metrics.rgRatio >= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MIN && 
        metrics.rgRatio <= this.HUMAN_SKIN_CRITERIA.RG_RATIO_MAX) {
      confidence += 0.25;
      reasons.push(`✓ Ratio R/G (${metrics.rgRatio.toFixed(2)}) en rango.`);
      criteriaMet++;
      if (metrics.rgRatio >= this.HUMAN_SKIN_CRITERIA.RG_OPTIMAL_MIN && metrics.rgRatio <= this.HUMAN_SKIN_CRITERIA.RG_OPTIMAL_MAX) {
        confidence += 0.05;
        reasons.push(`+ Ratio R/G óptimo.`);
      }
    } else {
      reasons.push(`✗ Ratio R/G (${metrics.rgRatio.toFixed(2)}) fuera de rango.`);
      const dist = Math.min(Math.abs(metrics.rgRatio - this.HUMAN_SKIN_CRITERIA.RG_RATIO_MIN), 
                            Math.abs(metrics.rgRatio - this.HUMAN_SKIN_CRITERIA.RG_RATIO_MAX));
      confidence -= Math.min(0.1, dist / 1.0);
    }
    
    // 3. Temperatura de Color (Peso: 0.15)
    if (metrics.colorTemperature >= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MIN && 
        metrics.colorTemperature <= this.HUMAN_SKIN_CRITERIA.COLOR_TEMP_MAX) {
      confidence += 0.15;
      reasons.push(`✓ Temperatura de color (${metrics.colorTemperature.toFixed(0)}K) compatible.`);
      criteriaMet++;
    } else {
      reasons.push(`✗ Temperatura de color (${metrics.colorTemperature.toFixed(0)}K) fuera de rango.`);
      confidence -= 0.05;
    }
    
    // 4. Textura (Peso: 0.1)
    if (metrics.textureScore >= this.HUMAN_SKIN_CRITERIA.TEXTURE_MIN && 
        metrics.textureScore <= this.HUMAN_SKIN_CRITERIA.TEXTURE_MAX) {
      confidence += 0.1;
      reasons.push(`✓ Textura (${(metrics.textureScore * 100).toFixed(1)}%) aceptable.`);
      criteriaMet++;
    } else {
      reasons.push(`✗ Textura (${(metrics.textureScore * 100).toFixed(1)}%) fuera de rango.`);
      confidence -= 0.05;
    }
    
    // 5. Área Cubierta (Peso: 0.1)
    if (metrics.areaPercentage >= this.HUMAN_SKIN_CRITERIA.MIN_AREA_PERCENTAGE) {
      confidence += 0.1;
      reasons.push(`✓ Área cubierta (${metrics.areaPercentage.toFixed(1)}%) suficiente.`);
      criteriaMet++;
    } else {
      reasons.push(`✗ Área cubierta (${metrics.areaPercentage.toFixed(1)}%) insuficiente.`);
      confidence -= 0.1;
    }

    // El espectro es válido si se cumplen al menos 3 de 5 criterios principales
    // y la confianza calculada supera un umbral más realista.
    const isValidSpectrum = criteriaMet >= 3 && confidence >= 0.45; 
    
    return {
      isValidSpectrum,
      confidence: Math.max(0, Math.min(1, confidence)), 
      reasons
    };
  }
  
  private detectExtremeFalsePositives(metrics: any) {
    const rejectionReasons: string[] = [];
    let isFalsePositive = false;
    
    if (metrics.redIntensity >= this.FALSE_POSITIVE_BLACKLIST.EXTREME_PLASTIC_RED_MIN && metrics.rgRatio < 0.8) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Posible plástico rojo brillante (R=${metrics.redIntensity.toFixed(1)}, RG=${metrics.rgRatio.toFixed(2)})`);
    }
    
    if (metrics.uniformity < this.FALSE_POSITIVE_BLACKLIST.EXTREME_PAPER_UNIFORMITY_MAX && metrics.redIntensity > 150) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Superficie extremadamente uniforme y brillante (U=${metrics.uniformity.toFixed(4)}, R=${metrics.redIntensity.toFixed(1)})`);
    }
    
    if (metrics.specularRatio > this.FALSE_POSITIVE_BLACKLIST.EXTREME_METAL_SPECULAR_MIN) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Material muy reflectivo/metálico (SR=${metrics.specularRatio.toFixed(2)})`);
    }
    
    if (metrics.rbRatio > this.FALSE_POSITIVE_BLACKLIST.EXTREME_BLUE_DOMINANT_THRESHOLD && metrics.redIntensity < 80) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Azul muy dominante (RB=${metrics.rbRatio.toFixed(2)})`);
    }
    
    if (metrics.rgRatio < this.FALSE_POSITIVE_BLACKLIST.EXTREME_GREEN_DOMINANT_THRESHOLD && metrics.redIntensity < 80) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Verde muy dominante (RG=${metrics.rgRatio.toFixed(2)})`);
    }
    
    return {
      isFalsePositive,
      rejectionReasons
    };
  }
  
  private validateTemporal(metrics: any, spectralAnalysis: any) {
    this.redHistory.push(metrics.redIntensity);
    this.rgRatioHistory.push(metrics.rgRatio);
    
    if (this.redHistory.length > 5) { // Historial más corto para respuesta rápida
      this.redHistory.shift();
      this.rgRatioHistory.shift();
    }
    
    const reasons: string[] = [];
    let temporalScore = 0.5; // Puntuación base más conservadora
    
    const stability = this.calculateTemporalStability();
    
    if (stability >= this.HUMAN_SKIN_CRITERIA.TEMPORAL_STABILITY_MIN) {
      temporalScore += 0.3; // Mayor peso a la estabilidad
      reasons.push(`✓ Estabilidad temporal adecuada: ${(stability * 100).toFixed(1)}%`);
    } else if (stability >= 0.5) { // Aún algo estable
        temporalScore += 0.15;
        reasons.push(`? Estabilidad temporal moderada: ${(stability * 100).toFixed(1)}%`);
    } else {
      reasons.push(`✗ Estabilidad temporal baja: ${(stability * 100).toFixed(1)}%`);
      temporalScore -= 0.1;
    }
    
    // Consistencia de detección previa
    if (this.detectionHistory.length >= 2 && this.detectionHistory.every(d => d)) {
        temporalScore += 0.2; // Bonus por consistencia
        reasons.push(`+ Consistencia en detección previa.`);
    }
    
    return {
      temporalScore: Math.max(0, Math.min(1, temporalScore)), // Asegurar rango 0-1
      stability,
      reasons
    };
  }
  
  private makeFinalDecision(spectralAnalysis: any, falsePositiveCheck: any, temporalValidation: any) {
    const acceptanceReasons = [
      ...spectralAnalysis.reasons,
      ...temporalValidation.reasons
    ];
    
    const rejectionReasons = falsePositiveCheck.rejectionReasons;
    
    let isHumanFinger = 
      spectralAnalysis.isValidSpectrum &&
      !falsePositiveCheck.isFalsePositive &&
      temporalValidation.temporalScore >= 0.5; // Umbral de estabilidad temporal más significativo

    let finalConfidence = 0;
    if (isHumanFinger) {
      // Promedio ponderado más equilibrado
      finalConfidence = 
        spectralAnalysis.confidence * 0.6 +
        temporalValidation.temporalScore * 0.4;
      
      // Bonus moderado si no hay rechazos fuertes
      if (rejectionReasons.length === 0) {
        finalConfidence = Math.min(1, finalConfidence + 0.1);
      }
    } else {
      // Si no es dedo, la confianza debe ser baja
      finalConfidence = Math.min(0.3, spectralAnalysis.confidence * 0.4, temporalValidation.temporalScore * 0.3);
      if (rejectionReasons.length > 0) {
        finalConfidence *= 0.5; // Reducir más si hay rechazos por FP
      }
    }
    
    // Mantener la confianza al menos en un mínimo si el espectro fue válido inicialmente
    if (spectralAnalysis.isValidSpectrum && !falsePositiveCheck.isFalsePositive) {
        finalConfidence = Math.max(0.25, finalConfidence); 
    }

    this.detectionHistory.push(isHumanFinger);
    if (this.detectionHistory.length > 3) { // Historial corto para detección
      this.detectionHistory.shift();
    }
    
    // Confirmación basada en mayoría en el historial reciente
    const confirmedDetections = this.detectionHistory.filter(d => d).length;
    const temporalConfirmation = confirmedDetections >= 2; // Necesita al menos 2 de 3 detecciones positivas
    
    return {
      isHumanFinger: isHumanFinger && temporalConfirmation,
      confidence: Math.max(0, Math.min(1, finalConfidence)),
      acceptanceReasons,
      rejectionReasons
    };
  }
  
  private calculateIntegratedQuality(decision: any, metrics: any): number {
    if (!decision.isHumanFinger) {
      return Math.max(10, Math.min(50, decision.confidence * 80)); // Calidad más baja si no hay dedo
    }
    
    let quality = 60; // Base más realista para dedo detectado
    
    quality += decision.confidence * 25; // Influencia de la confianza
    
    // Contribución de la reflectancia roja
    if (metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL_MIN && 
        metrics.redIntensity <= this.HUMAN_SKIN_CRITERIA.RED_OPTIMAL_MAX) {
      quality += 10;
    } else if (metrics.redIntensity >= this.HUMAN_SKIN_CRITERIA.RED_REFLECTANCE_MIN) {
      quality += 5;
    }

    // Contribución de la estabilidad
    quality += metrics.temporalStability * 15; // Usar la estabilidad calculada
    
    return Math.max(30, Math.min(98, Math.round(quality))); // Rango de calidad más realista
  }
  
  private extractPPGSignal(imageData: ImageData, isValidFinger: boolean): number {
    const { data, width, height } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.3; // ROI ligeramente más pequeño para PPG puro
    
    let redSum = 0;
    let pixelCount = 0;
    
    for (let y = centerY - size/2; y < centerY + size/2; y++) { // Muestreo más denso para PPG
      for (let x = centerX - size/2; x < centerX + size/2; x++) {
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
    // Filtro EMA más suave para reducir ruido pero mantener forma de onda
    const alpha = 0.65; // Más peso al valor actual para respuesta rápida
    this.lastFilteredValue = alpha * rawValue + (1 - alpha) * this.lastFilteredValue;
    return this.lastFilteredValue;
  }
  
  private calculateColorTemperature(r: number, g: number, b: number): number {
    if (r + g + b < 30) return 2500; // Evitar división por cero o valores muy bajos
    
    // Fórmula más precisa para CCT (McCamy's approximation)
    // n = (x - xe) / (ye - y)
    // CCT = -449 * n^3 + 3525 * n^2 - 6823.3 * n + 5520.33
    // donde x = R/(R+G+B), y = G/(R+G+B)
    const sumRGB = r + g + b;
    const x = r / sumRGB;
    const y = g / sumRGB;

    if (isNaN(x) || isNaN(y) || y === 0.1858) return 3000; // Evitar división por cero

    const n = (x - 0.3320) / (0.1858 - y);
    const cct = -449 * Math.pow(n, 3) + 3525 * Math.pow(n, 2) - 6823.3 * n + 5520.33;
    
    return Math.max(1800, Math.min(10000, Math.round(cct))); // Rango fisiológico y práctico
  }
  
  private calculateTextureScore(intensities: number[]): number {
    if (intensities.length < 10) return 0.05; 
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    // Normalizar por la intensidad media para que sea relativo
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    return Math.min(1.0, cv * 2); // Multiplicar para dar más rango al score de textura
  }
  
  private calculateEdgeGradient(values: number[]): number {
    if (values.length < 10) return 0.05;
    
    let gradientSum = 0;
    // Usar Sobel simplificado para gradiente horizontal y vertical
    for (let i = 1; i < values.length - 1; i++) {
        // Simplificación: gradiente como diferencia con vecinos
        gradientSum += Math.abs(values[i] - values[i-1]);
    }
    const avgGradient = gradientSum / (values.length - 1);
    return Math.min(1.0, avgGradient / 50); // Normalizar por un valor empírico de gradiente máximo esperado
  }
  
  private calculateSpecularRatio(reds: number[], greens: number[], blues: number[]): number {
    if (reds.length < 10) return 1.0;
    
    const intensities = reds.map((r, i) => (r + greens[i] + blues[i]) / 3);
    const sortedIntensities = [...intensities].sort((a,b) => a-b);
    const top5percentIndex = Math.floor(sortedIntensities.length * 0.95);
    const medianIndex = Math.floor(sortedIntensities.length * 0.5);

    const top5percentAvg = sortedIntensities.slice(top5percentIndex).reduce((s,v)=>s+v,0) / (sortedIntensities.length - top5percentIndex);
    const medianValue = sortedIntensities[medianIndex];

    return medianValue > 5 ? top5percentAvg / medianValue : 1.0; // Evitar división por cero
  }
  
  private calculateUniformity(intensities: number[]): number {
    if (intensities.length < 10) return 0.05;
    
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    const stdDev = Math.sqrt(variance);

    // Coeficiente de variación como medida de uniformidad (menor es más uniforme)
    const cv = mean > 0 ? stdDev / mean : 1.0; // Si la media es 0, asumir no uniforme
    return Math.min(1.0, cv);
  }
  
  private calculateTemporalStability(): number {
    if (this.redHistory.length < 3) return 0.7; 
    
    const mean = this.redHistory.reduce((a, b) => a + b, 0) / this.redHistory.length;
    if (mean < 10) return 0.3; // Si la señal es muy baja, la estabilidad es baja
    
    const variance = this.redHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.redHistory.length;
    const stdDev = Math.sqrt(variance);
    
    // Coeficiente de variación normalizado (menor es más estable)
    const cv = stdDev / mean;
    return Math.max(0, Math.min(1, 1 - cv * 2.5)); // Ajustar sensibilidad del CV
  }
  
  private updateHistories(metrics: any, detected: boolean): void {
    if (detected && metrics.redIntensity > 30) { // Calibrar solo con señal razonable
      if (!this.isCalibrated || Math.abs(this.calibrationBaseline - metrics.redIntensity) > 20) {
          // Adaptación más rápida del baseline si hay cambios grandes o no está calibrado
          this.calibrationBaseline = this.calibrationBaseline * 0.8 + metrics.redIntensity * 0.2;
      } else {
          this.calibrationBaseline = this.calibrationBaseline * 0.95 + metrics.redIntensity * 0.05;
      }
      this.isCalibrated = true;
    }
  }
  
  private logDetectionResult(decision: any, metrics: any): void {
    if (this.frameCount % 60 === 0) { // Loguear menos frecuentemente
      console.log("HumanFingerDetector (FIABILIDAD AJUSTADA):", {
        detected: decision.isHumanFinger,
        confidence: decision.confidence.toFixed(3),
        quality: this.calculateIntegratedQuality(decision, metrics).toFixed(0),
        red: metrics.redIntensity.toFixed(1),
        rgRatio: metrics.rgRatio.toFixed(2),
        reasons: decision.acceptanceReasons.filter((r: string) => r.startsWith('✓') || r.startsWith('?')).slice(0,3), // Solo razones positivas o de advertencia
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
      textureScore: 0.05,
      edgeGradient: 0.05,
      areaPercentage: 0,
      specularRatio: 1.0,
      uniformity: 0.5 // Asumir no uniforme por defecto
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
    console.log("HumanFingerDetector: Reset completo.");
  }
  
  getStatus() {
    return {
      isCalibrated: this.isCalibrated,
      baseline: this.calibrationBaseline.toFixed(1),
      stability: this.calculateTemporalStability().toFixed(2),
      frameCount: this.frameCount
    };
  }
}
