/**
 * DETECTOR DE DEDO HUMANO REFACTORIZADO - Versión Robusta y Simplificada
 * Enfocado en características fundamentales para una detección fiable.
 */

export interface HumanFingerResult {
  isHumanFinger: boolean;
  confidence: number; 
  quality: number;    
  rawValue: number;   
  filteredValue: number; 
  timestamp: number;
  debugInfo: {
    avgRed: number;
    avgGreen: number;
    avgBlue: number;
    redDominanceScore: number; 
    pulsatilityScore: number;  
    stabilityScore: number;    
    rejectionReasons: string[];
    acceptanceReasons: string[]; // Mantener por si se añaden en el futuro
  };
}

// Interfaz para la configuración del detector
export interface HumanFingerDetectorConfig {
  MIN_RED_INTENSITY: number;
  MAX_RED_INTENSITY: number;
  MIN_RG_RATIO: number;
  MIN_RB_RATIO: number;
  HISTORY_SIZE_SHORT: number;
  HISTORY_SIZE_LONG: number;
  PULSABILITY_THRESHOLD: number;
  STABILITY_THRESHOLD_FRAME: number;
  STABILITY_THRESHOLD_WINDOW_STDDEV: number;
  // Podrían añadirse más parámetros de FALSE_POSITIVE_BLACKLIST si se desea calibrarlos
}

const defaultDetectorConfig: HumanFingerDetectorConfig = {
  MIN_RED_INTENSITY: 50,
  MAX_RED_INTENSITY: 240,
  MIN_RG_RATIO: 1.1,
  MIN_RB_RATIO: 1.5,
  HISTORY_SIZE_SHORT: 10,
  HISTORY_SIZE_LONG: 30,
  PULSABILITY_THRESHOLD: 0.5, 
  STABILITY_THRESHOLD_FRAME: 15,
  STABILITY_THRESHOLD_WINDOW_STDDEV: 10,
};

export class HumanFingerDetector {
  private config: HumanFingerDetectorConfig;

  // Los criterios de "caja negra" (FALSE_POSITIVE_BLACKLIST) podrían seguir siendo internos o exponerse en config si fuera necesario
  private readonly FALSE_POSITIVE_BLACKLIST = {
    EXTREME_PLASTIC_RED_MIN: 240, 
    EXTREME_PAPER_UNIFORMITY_MAX: 0.005, 
    EXTREME_METAL_SPECULAR_MIN: 4.5,   
    EXTREME_BLUE_DOMINANT_THRESHOLD: 2.0, 
    EXTREME_GREEN_DOMINANT_THRESHOLD: 0.5, 
  };
  
  private rawRedHistory: number[] = [];
  private filteredRedHistory: number[] = [];
  private lastDetectionResult: HumanFingerResult | null = null;
  private frameCount = 0;
  private lastRawRedValue = 0; 
  private detectionConfidenceAcc = 0;
  private readonly CONFIDENCE_ALPHA = 0.1; 

  constructor(config: Partial<HumanFingerDetectorConfig> = {}) {
    this.config = { ...defaultDetectorConfig, ...config };
    this.reset();
    console.log("HumanFingerDetector: Inicializado con config:", this.config);
  }

  // El resto de los métodos (detectHumanFinger, extractHumanSkinMetrics, etc.) usarían this.config
  // en lugar de this.HUMAN_SKIN_CRITERIA directamente para los umbrales configurables.
  // Por ejemplo, en analyzeHumanSkinSpectrum:
  // if (metrics.redIntensity >= this.config.MIN_RED_INTENSITY && ...)

  public detectHumanFinger(imageData: ImageData): HumanFingerResult {
    this.frameCount++;
    const timestamp = Date.now();

    const { width, height, data } = imageData;
    const roiWidth = Math.floor(width * 0.3);
    const roiHeight = Math.floor(height * 0.3);
    const roiX = Math.floor((width - roiWidth) / 2);
    const roiY = Math.floor((height - roiHeight) / 2);
    
    let sumR = 0, sumG = 0, sumB = 0;
    let pixelCount = 0;

    for (let y = roiY; y < roiY + roiHeight; y++) {
      for (let x = roiX; x < roiX + roiWidth; x++) {
        const i = (y * width + x) * 4;
        sumR += data[i];
        sumG += data[i + 1];
        sumB += data[i + 2];
        pixelCount++;
      }
    }

    if (pixelCount === 0) {
      return this.createDefaultResult(timestamp, "ROI vacío o inválido");
    }

    const avgRed = sumR / pixelCount;
    const avgGreen = sumG / pixelCount;
    const avgBlue = sumB / pixelCount;

    if (this.lastRawRedValue === 0) this.lastRawRedValue = avgRed;
    const currentFilteredRed = this.lastRawRedValue * 0.6 + avgRed * 0.4; 
    this.lastRawRedValue = currentFilteredRed;

    this.rawRedHistory.push(avgRed); 
    if (this.rawRedHistory.length > this.config.HISTORY_SIZE_LONG) this.rawRedHistory.shift();
    
    this.filteredRedHistory.push(currentFilteredRed); 
    if (this.filteredRedHistory.length > this.config.HISTORY_SIZE_LONG) this.filteredRedHistory.shift();

    const metrics = this.calculateMetricsInternal(avgRed, avgGreen, avgBlue, imageData); // Pasar imageData para cálculos que la necesiten
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);
    const falsePositiveCheck = this.detectExtremeFalsePositives(metrics);
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis);
    const finalDecision = this.makeFinalDecision(
      spectralAnalysis, 
      falsePositiveCheck, 
      temporalValidation
    );
    
    const quality = this.calculateIntegratedQuality(finalDecision, metrics, temporalValidation.stability); // Pasar estabilidad para el cálculo de calidad
    
    this.logDetectionResult(finalDecision, metrics, quality);
    
    const result: HumanFingerResult = {
      isHumanFinger: finalDecision.isHumanFinger,
      confidence: finalDecision.confidence,
      quality: Math.round(quality),
      rawValue: avgRed, // avgRed es el rawValue del ROI
      filteredValue: currentFilteredRed, 
      timestamp,
      debugInfo: {
        avgRed,
        avgGreen,
        avgBlue,
        redDominanceScore: spectralAnalysis.redDominanceScore, // Asumiendo que analyzeHumanSkinSpectrum devuelve esto
        pulsatilityScore: temporalValidation.pulsatilityScore, // Asumiendo que validateTemporal devuelve esto
        stabilityScore: temporalValidation.stability, // Usar la estabilidad calculada
        rejectionReasons: finalDecision.rejectionReasons,
        acceptanceReasons: finalDecision.acceptanceReasons 
      }
    };
    this.lastDetectionResult = result;
    return result;
  }

  private calculateMetricsInternal(avgRed: number, avgGreen: number, avgBlue: number, imageData: ImageData) {
    // Esta función ahora toma los promedios R,G,B y puede calcular el resto si es necesario
    // O algunas métricas pueden ser pasadas directamente desde extractHumanSkinMetrics si se mantiene esa función separada.
    // Por simplicidad, recreamos las métricas necesarias aquí.
    const rgRatio = avgGreen > 5 ? avgRed / avgGreen : (avgRed > 10 ? 10 : 0.5);
    const rbRatio = avgBlue > 5 ? avgRed / avgBlue : (avgRed > 10 ? 10 : 0.5);
    
    // Para texture, edgeGradient, etc., se necesitaría el imageData o los arrays de valores del ROI
    // Por ahora, los dejaremos como placeholders o valores simples si no se pasan los datos completos del ROI.
    // Idealmente, extractHumanSkinMetrics se mantendría y se llamaría primero.
    // Pero para esta refactorización, simplificamos y asumimos que estas métricas se obtendrían
    // o se les daría menos peso si HumanFingerDetector se enfoca más en color y pulsatilidad/estabilidad.

    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      rgRatio: rgRatio,
      rbRatio: rbRatio,
      gbRatio: avgBlue > 5 ? avgGreen / avgBlue : (avgGreen > 10 ? 10 : 0.5),
      colorTemperature: this.calculateColorTemperature(avgRed, avgGreen, avgBlue),
      textureScore: 0.1, // Placeholder - se necesitaría análisis del ROI completo
      edgeGradient: 0.1, // Placeholder
      areaPercentage: 100, // Asumimos que el ROI definido está cubierto
      specularRatio: 1.5, // Placeholder
      uniformity: 0.2 // Placeholder
    };
  }
  
  private analyzeHumanSkinSpectrum(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0.0; 
    let criteriaMet = 0;
    let redDominanceScore = 0;

    if (metrics.redIntensity >= this.config.MIN_RED_INTENSITY && 
        metrics.redIntensity <= this.config.MAX_RED_INTENSITY) {
      confidence += 0.35; // Más peso a la intensidad correcta
      reasons.push(`✓ RInt (${metrics.redIntensity.toFixed(0)})`);
      criteriaMet++;
    } else {
      reasons.push(`✗ RInt (${metrics.redIntensity.toFixed(0)})`);
      confidence -= 0.1;
    }
    
    if (metrics.rgRatio >= this.config.MIN_RG_RATIO && metrics.rbRatio >= this.config.MIN_RB_RATIO) {
      confidence += 0.35; // Más peso a la dominancia del rojo
      redDominanceScore = Math.min(1, ((metrics.rgRatio - this.config.MIN_RG_RATIO) + (metrics.rbRatio - this.config.MIN_RB_RATIO)) / 3.0); // Normalizar
      reasons.push(`✓ RDom (R/G:${metrics.rgRatio.toFixed(1)}, R/B:${metrics.rbRatio.toFixed(1)})`);
      criteriaMet++;
    } else {
      reasons.push(`✗ RDom (R/G:${metrics.rgRatio.toFixed(1)}, R/B:${metrics.rbRatio.toFixed(1)})`);
      confidence -= 0.15;
    }
    
    // Otros criterios como temperatura de color, textura pueden tener menos peso o ser opcionales
    // if (metrics.colorTemperature >= 2200 && metrics.colorTemperature <= 5500) {
    //   confidence += 0.1;
    //   criteriaMet++;
    // }

    const isValidSpectrum = criteriaMet >= 2 && confidence >= 0.5; // Necesita ambos criterios principales con buena confianza
    
    return {
      isValidSpectrum,
      confidence: Math.max(0, Math.min(1, confidence)), 
      reasons,
      redDominanceScore 
    };
  }
  
  private detectExtremeFalsePositives(metrics: any) {
    const rejectionReasons: string[] = [];
    let isFalsePositive = false;
    if (metrics.redIntensity > 245 && metrics.rgRatio < 0.7) { // Muy brillante y no rojizo
      isFalsePositive = true;
      rejectionReasons.push(`✗ Plástico/Reflejo? (R=${metrics.redIntensity.toFixed(0)}, RG=${metrics.rgRatio.toFixed(1)})`);
    }
    if (metrics.rgRatio < 0.6 || metrics.rbRatio < 0.8) { // Muy poco rojo dominante
        isFalsePositive = true;
        rejectionReasons.push(`✗ Color no piel (RG=${metrics.rgRatio.toFixed(1)}, RB=${metrics.rbRatio.toFixed(1)})`);
    }
    return { isFalsePositive, rejectionReasons };
  }
  
  private validateTemporal(metrics: any, spectralAnalysis: any): { pulsatilityScore: number, stability: number, reasons: string[], meetsPulsatility: boolean, meetsStability: boolean } {
    const reasons: string[] = [];
    let pulsatilityScore = 0;
    let stability = 0;
    let meetsPulsatility = false;
    let meetsStabilityOverall = true; // Iniciar asumiendo estabilidad

    // Pulsatilidad
    if (this.filteredRedHistory.length >= this.config.HISTORY_SIZE_SHORT) {
      const recentSignal = this.filteredRedHistory.slice(-this.config.HISTORY_SIZE_SHORT);
      const mean = recentSignal.reduce((s, v) => s + v, 0) / recentSignal.length;
      const stdDev = mean > 0 ? Math.sqrt(recentSignal.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recentSignal.length) : 0;
      
      // Pulsatilidad se considera como la desviación estándar de la señal filtrada (que ya está centrada en cero por el EMA)
      if (stdDev > this.config.PULSABILITY_THRESHOLD) { 
          meetsPulsatility = true;
          pulsatilityScore = Math.min(1, stdDev / (this.config.PULSABILITY_THRESHOLD * 4)); // Normalizar (4 veces el umbral es score 1)
          reasons.push(`✓ Pulsat. (stdFilt:${stdDev.toFixed(2)})`);
      } else {
        reasons.push(`✗ Pulsat. (stdFilt:${stdDev.toFixed(2)} < ${this.config.PULSABILITY_THRESHOLD})`);
      }
    } else {
        reasons.push(`Datos insuf. para pulsat. (${this.filteredRedHistory.length}/${this.config.HISTORY_SIZE_SHORT})`);
    }

    // Estabilidad del rawRed
    if (this.rawRedHistory.length >= 2) {
      const frameDiff = Math.abs(this.rawRedHistory[this.rawRedHistory.length - 1] - this.rawRedHistory[this.rawRedHistory.length - 2]);
      if (frameDiff > this.config.STABILITY_THRESHOLD_FRAME) {
        reasons.push(`✗ Inest. frame (Diff:${frameDiff.toFixed(0)} > ${this.config.STABILITY_THRESHOLD_FRAME})`);
        meetsStabilityOverall = false;
      }

      if (this.rawRedHistory.length >= this.config.HISTORY_SIZE_LONG) {
        const longTermSignal = this.rawRedHistory;
        const mean = longTermSignal.reduce((s, v) => s + v, 0) / longTermSignal.length;
        const stdDevLong = mean > 0 ? Math.sqrt(longTermSignal.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / longTermSignal.length) : 0;
        if (stdDevLong > this.config.STABILITY_THRESHOLD_WINDOW_STDDEV) {
          reasons.push(`✗ Inest. ventana (StdRaw:${stdDevLong.toFixed(0)} > ${this.config.STABILITY_THRESHOLD_WINDOW_STDDEV})`);
          meetsStabilityOverall = false;
        }
        stability = Math.max(0, 1 - (stdDevLong / (this.config.STABILITY_THRESHOLD_WINDOW_STDDEV * 2))); 
      } else {
         stability = meetsStabilityOverall ? 0.7 : 0.3; 
      }
      if (meetsStabilityOverall) {
        reasons.push(`✓ Estab. (stdRaw:${stability.toFixed(2)})`);
      }
    } else {
        meetsStabilityOverall = false; 
        reasons.push("Datos insuf. para estab.");
    }
    
    return {
      pulsatilityScore,
      stability,
      reasons,
      meetsPulsatility,
      meetsStability: meetsStabilityOverall
    };
  }
  
  private makeFinalDecision(spectralAnalysis: any, falsePositiveCheck: any, temporalValidation: any) {
    const acceptanceReasons = [...spectralAnalysis.reasons, ...temporalValidation.reasons];
    const rejectionReasons = [...falsePositiveCheck.rejectionReasons]; // Empezar con las razones de FP

    // Añadir razones de rechazo si los criterios principales no se cumplen
    if (!spectralAnalysis.isValidSpectrum) rejectionReasons.push("Espectro de color no válido");
    if (!temporalValidation.meetsPulsatility) rejectionReasons.push("Pulsatilidad insuficiente");
    if (!temporalValidation.meetsStability) rejectionReasons.push("Señal inestable");

    const isHumanFinger = 
      spectralAnalysis.isValidSpectrum &&
      !falsePositiveCheck.isFalsePositive &&
      temporalValidation.meetsPulsatility &&
      temporalValidation.meetsStability;

    let currentConfidence = 0;
    if (isHumanFinger) {
      // Combinar confianzas de los componentes clave
      currentConfidence = (spectralAnalysis.confidence * 0.5) + 
                          (temporalValidation.pulsatilityScore * 0.3) + 
                          (temporalValidation.stability * 0.2);
      currentConfidence = Math.max(0.6, currentConfidence); // Mínimo si todos los checks pasan
    } else {
      // Confianza baja si algo falla, pero proporcional a lo que sí pasó
      currentConfidence = (spectralAnalysis.confidence * 0.2) + 
                          (temporalValidation.pulsatilityScore * 0.1) + 
                          (temporalValidation.stability * 0.05);
      currentConfidence = Math.min(0.4, currentConfidence); // Máximo si algo falló
    }
    
    this.detectionConfidenceAcc = this.detectionConfidenceAcc * (1 - this.CONFIDENCE_ALPHA) + currentConfidence * this.CONFIDENCE_ALPHA;
    
    return {
      isHumanFinger,
      confidence: Math.max(0, Math.min(1, this.detectionConfidenceAcc)),
      acceptanceReasons, // Pueden estar vacías si isHumanFinger es false
      rejectionReasons
    };
  }
  
  private calculateIntegratedQuality(decision: any, metrics: any, stabilityScore: number): number {
    if (!decision.isHumanFinger) {
      // Calidad baja, pero proporcional a la confianza de detección (hasta un máximo de ~40 si la confianza es ~0.5)
      return Math.max(5, Math.min(40, decision.confidence * 80)); 
    }
    
    // Si es dedo, la calidad se basa en confianza de detección y estabilidad de la señal
    let quality = decision.confidence * 60 + stabilityScore * 40;
    
    // Bonus si la señal roja está en el rango óptimo (más indirecto ahora)
    if (metrics.redIntensity >= this.config.MIN_RED_INTENSITY + 10 && metrics.redIntensity <= this.config.MAX_RED_INTENSITY - 10) {
      quality += 5;
    }
    
    return Math.max(30, Math.min(98, Math.round(quality)));
  }
  
  private extractPPGSignal(imageData: ImageData, isValidFinger: boolean): number {
    // Esta función ya no es necesaria aquí si el rawValue se toma del promedio del ROI en detectHumanFinger
    // Se mantiene por si se quiere una extracción diferente para PPG vs detección.
    // Por ahora, el rawValue ya es avgRed del ROI.
    const { data, width, height } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.3; 
    
    let redSum = 0;
    let pixelCount = 0;
    
    for (let y = centerY - size/2; y < centerY + size/2; y++) { 
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
    const alpha = 0.65; 
    // this.lastFilteredValue ya se actualiza en detectHumanFinger con this.lastRawRedValue
    // Esta función puede ser redundante o necesitar lógica diferente si se quiere un segundo filtrado.
    // Por ahora, la señal filtrada es this.lastRawRedValue (el EMA del avgRed).
    return this.lastRawRedValue; 
  }
  
  // Las siguientes funciones de cálculo de métricas se llaman desde calculateMetricsInternal
  // o directamente desde detectHumanFinger si se simplifica más.
  private calculateColorTemperature(r: number, g: number, b: number): number {
    if (r + g + b < 15) return 3000; 
    const sumRGB = r + g + b;
    const x = r / sumRGB;
    const y = g / sumRGB;
    if (isNaN(x) || isNaN(y) || Math.abs(0.1858 - y) < 1e-6) return 3000;
    const n = (x - 0.3320) / (0.1858 - y);
    const cct = -449 * Math.pow(n, 3) + 3525 * Math.pow(n, 2) - 6823.3 * n + 5520.33;
    return Math.max(1800, Math.min(10000, Math.round(cct)));
  }
  
  private calculateTextureScore(intensities: number[]): number {
    if (intensities.length < 10) return 0.05; 
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    if (mean === 0) return 0.5; 
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    const cv = Math.sqrt(variance) / mean;
    return Math.min(1.0, cv * 2.5); 
  }
  
  private calculateEdgeGradient(values: number[]): number {
    if (values.length < 10) return 0.05;
    let gradientSum = 0;
    for (let i = 1; i < values.length - 1; i++) {
        gradientSum += Math.abs(values[i] - values[i-1]);
    }
    const avgGradient = gradientSum / (values.length - 1);
    return Math.min(1.0, avgGradient / 30); 
  }
  
  private calculateSpecularRatio(reds: number[], greens: number[], blues: number[]): number {
    if (reds.length < 10) return 1.0;
    const intensities = reds.map((r, i) => (r + greens[i] + blues[i]) / 3);
    const sortedIntensities = [...intensities].sort((a,b) => a-b);
    const topQuantileIndex = Math.floor(sortedIntensities.length * 0.95);
    const medianIndex = Math.floor(sortedIntensities.length * 0.5);
    if (topQuantileIndex >= sortedIntensities.length || medianIndex >= sortedIntensities.length) return 1.0; // Safety check
    const topQuantileAvg = sortedIntensities.slice(topQuantileIndex).reduce((s,v)=>s+v,0) / (sortedIntensities.length - topQuantileIndex);
    const medianValue = sortedIntensities[medianIndex];
    return medianValue > 5 ? topQuantileAvg / medianValue : 1.0;
  }
  
  private calculateUniformity(intensities: number[]): number {
    if (intensities.length < 10) return 0.05;
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    if (mean === 0) return 1.0; 
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    return Math.min(1.0, cv);
  }
  
  private calculateTemporalStability(): number {
    if (this.rawRedHistory.length < 5) return 0.5; // Neutral si no hay suficientes datos
    const mean = this.rawRedHistory.reduce((a, b) => a + b, 0) / this.rawRedHistory.length;
    if (mean < this.config.MIN_RED_INTENSITY * 0.5) return 0.1; // Muy baja estabilidad si la señal es muy débil
    const variance = this.rawRedHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.rawRedHistory.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    // Una mayor variación (CV alto) implica menor estabilidad. Se invierte para que un score alto sea bueno.
    // El factor 5 es empírico para escalar el score.
    return Math.max(0, Math.min(1, 1 - cv * 5)); 
  }
  
  private updateHistories(metrics: any, detected: boolean): void {
    // La calibración del baseline y la actualización de la señal filtrada ya ocurren en detectHumanFinger.
    // Esta función podría usarse para lógicas de adaptación más complejas si fuera necesario.
  }
  
  private logDetectionResult(decision: any, metrics: any, quality: number): void {
    if (this.frameCount % 30 === 0) { // Loguear cada segundo (asumiendo 30fps)
      console.log("HFDetector:", {
        D: decision.isHumanFinger ? 1:0,
        C: decision.confidence.toFixed(2),
        Q: quality.toFixed(0),
        R: metrics.redIntensity.toFixed(0),
        RG: metrics.rgRatio.toFixed(1),
        RB: metrics.rbRatio.toFixed(1),
        PS: decision.debugInfo.pulsatilityScore.toFixed(2),
        SS: decision.debugInfo.stabilityScore.toFixed(2),
        Reject: decision.rejectionReasons.length > 0 ? decision.rejectionReasons[0].substring(0,15) : "-"
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
      uniformity: 0.5 
    };
  }

  reset(): void {
    this.rawRedHistory = [];
    this.filteredRedHistory = [];
    this.lastDetectionResult = null;
    this.frameCount = 0;
    this.lastRawRedValue = 0;
    this.detectionConfidenceAcc = 0;
    // No reseteamos this.config aquí, ya que se establece en el constructor
    console.log("HumanFingerDetector: Estado interno reseteado.");
  }
  
  public getStatus() {
    return {
      frameCount: this.frameCount,
      lastConfidence: this.detectionConfidenceAcc.toFixed(2),
      lastQuality: this.lastDetectionResult?.quality || 0,
      config: this.config // Exponer config actual para depuración
    };
  }

  private createDefaultResult(timestamp: number, reason: string): HumanFingerResult {
    const defaultResult = {
      isHumanFinger: false,
      confidence: 0,
      quality: 0,
      rawValue: 0,
      filteredValue: 0,
      timestamp,
      debugInfo: {
        avgRed: 0, avgGreen: 0, avgBlue: 0,
        redDominanceScore: 0, pulsatilityScore: 0, stabilityScore: 0,
        rejectionReasons: [reason],
        acceptanceReasons: []
      }
    };
    this.lastDetectionResult = defaultResult;
    return defaultResult;
  }
}
