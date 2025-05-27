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
    rgRatio: number;
    rbRatio: number; 
    redDominanceScore: number; 
    pulsatilityScore: number;  
    stabilityScore: number;    
    rejectionReasons: string[];
    acceptanceReasons: string[];
    dbgSpectralConfidence?: number;
    dbgRawQuality?: number;
  };
}

export interface HumanFingerDetectorConfig {
  MIN_RED_INTENSITY: number;
  MAX_RED_INTENSITY: number;
  MIN_RG_RATIO: number;
  MIN_RB_RATIO: number;
  HISTORY_SIZE_SHORT: number; // Renombrado desde HISTORY_SIZE_SHORT_PULS para consistencia
  HISTORY_SIZE_LONG: number;  // Renombrado desde HISTORY_SIZE_LONG_STAB para consistencia
  PULSABILITY_STD_THRESHOLD: number; 
  STABILITY_FRAME_DIFF_THRESHOLD: number;
  STABILITY_WINDOW_STD_THRESHOLD: number;
  ROI_WIDTH_FACTOR: number; 
  ROI_HEIGHT_FACTOR: number; 
  EMA_ALPHA_RAW: number; 
  CONFIDENCE_EMA_ALPHA: number; 
}

const defaultDetectorConfig: HumanFingerDetectorConfig = {
  MIN_RED_INTENSITY: 30,
  MAX_RED_INTENSITY: 245,
  MIN_RG_RATIO: 1.0,
  MIN_RB_RATIO: 1.0,
  HISTORY_SIZE_SHORT: 15,
  HISTORY_SIZE_LONG: 45,
  PULSABILITY_STD_THRESHOLD: 0.15,
  STABILITY_FRAME_DIFF_THRESHOLD: 35,
  STABILITY_WINDOW_STD_THRESHOLD: 30,
  ROI_WIDTH_FACTOR: 0.3, 
  ROI_HEIGHT_FACTOR: 0.3,
  EMA_ALPHA_RAW: 0.3,
  CONFIDENCE_EMA_ALPHA: 0.2,
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
  
  private frameCount = 0;
  private lastRawRedEMA: number = 0; 
  private smoothedConfidence: number = 0;
  
  constructor(config: Partial<HumanFingerDetectorConfig> = {}) {
    this.config = { ...defaultDetectorConfig, ...config };
    this.reset();
    console.log("HumanFingerDetector: Inicializado con config:", this.config);
  }

  public configure(newConfig: Partial<HumanFingerDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("HumanFingerDetector: Reconfigurado con nuevos umbrales/parámetros:", this.config);
    // Considerar si es necesario un reset completo o parcial de historiales aquí
    // this.reset(); // Podría ser demasiado agresivo si solo cambian umbrales menores
  }

  public detectHumanFinger(imageData: ImageData): HumanFingerResult {
    this.frameCount++;
    const timestamp = Date.now();
    const detailedLog = true; // FORZAR LOGS DETALLADOS PARA DEBUG

    if (detailedLog) console.log(`\n--- HFD Frame: ${this.frameCount} ---`);
    
    const { width, height, data } = imageData;
    const roiWidth = Math.floor(width * this.config.ROI_WIDTH_FACTOR);
    const roiHeight = Math.floor(height * this.config.ROI_HEIGHT_FACTOR);
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

    if (pixelCount < 10) { 
      return this.createDefaultResult(timestamp, "ROI con muy pocos píxeles");
    }

    const avgRed = sumR / pixelCount;
    const avgGreen = sumG / pixelCount;
    const avgBlue = sumB / pixelCount;

    if (this.lastRawRedEMA === 0) this.lastRawRedEMA = avgRed;
    const currentFilteredRed = this.lastRawRedEMA * (1 - this.config.EMA_ALPHA_RAW) + avgRed * this.config.EMA_ALPHA_RAW;
    this.lastRawRedEMA = currentFilteredRed;

    if (detailedLog) {
      console.log("[HFD] RGB Averages:", { avgRed: avgRed.toFixed(2), avgGreen: avgGreen.toFixed(2), avgBlue: avgBlue.toFixed(2) });
      console.log("[HFD] Filtered Red:", currentFilteredRed.toFixed(2));
    }

    this.rawRedHistory.push(avgRed); 
    if (this.rawRedHistory.length > this.config.HISTORY_SIZE_LONG) this.rawRedHistory.shift();
    
    this.filteredRedHistory.push(currentFilteredRed); 
    if (this.filteredRedHistory.length > this.config.HISTORY_SIZE_LONG) this.filteredRedHistory.shift();

    const metrics = this.calculateMetricsInternal(avgRed, avgGreen, avgBlue, imageData);
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);
    const falsePositiveCheck = this.detectExtremeFalsePositives(metrics);
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis);

    if (detailedLog) {
      console.log("[HFD] Spectral Analysis:", spectralAnalysis);
      console.log("[HFD] False Positive Check:", falsePositiveCheck);
      console.log("[HFD] Temporal Validation:", temporalValidation);
    }
    
    const decisionInternal = this.makeFinalDecision(
      spectralAnalysis, 
      falsePositiveCheck, 
      temporalValidation
    );
    
    const qualityScores = this.calculateIntegratedQuality(decisionInternal.isHumanFinger, metrics, temporalValidation.stability, temporalValidation.pulsatilityScore);
    
    if (detailedLog) {
      console.log("[HFD] Internal Decision:", decisionInternal);
      console.log("[HFD] Quality Scores:", qualityScores);
    }

    const result: HumanFingerResult = {
      isHumanFinger: decisionInternal.isHumanFinger,
      confidence: decisionInternal.confidence,
      quality: qualityScores.finalQuality,
      rawValue: avgRed, 
      filteredValue: currentFilteredRed, 
      timestamp,
      debugInfo: {
        avgRed,
        avgGreen,
        avgBlue,
        rgRatio: metrics.rgRatio,
        rbRatio: metrics.rbRatio, 
        redDominanceScore: spectralAnalysis.redDominanceScore, 
        pulsatilityScore: temporalValidation.pulsatilityScore, 
        stabilityScore: temporalValidation.stability, 
        rejectionReasons: decisionInternal.rejectionReasons,
        acceptanceReasons: decisionInternal.acceptanceReasons,
        dbgSpectralConfidence: decisionInternal.dbgSpectralConfidence,
        dbgRawQuality: qualityScores.rawQuality
      }
    };
    if (detailedLog) console.log("[HFD] Final Result:", result);
    return result;
  }

  private calculateMetricsInternal(avgRed: number, avgGreen: number, avgBlue: number, imageData: ImageData) {
    const rgRatio = avgGreen > 5 ? avgRed / avgGreen : 0;
    const rbRatio = avgBlue > 5 ? avgRed / avgBlue : 0;
    // Eliminar placeholders: solo usar datos reales
    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      rgRatio: rgRatio,
      rbRatio: rbRatio,
      gbRatio: avgBlue > 5 ? avgGreen / avgBlue : 0,
      colorTemperature: this.calculateColorTemperature(avgRed, avgGreen, avgBlue),
      textureScore: this.calculateTextureScore([avgRed]),
      edgeGradient: this.calculateEdgeGradient([avgRed]),
      areaPercentage: 100,
      specularRatio: this.calculateSpecularRatio([avgRed], [avgGreen], [avgBlue]),
      uniformity: this.calculateUniformity([avgRed])
    };
  }
  
  private analyzeHumanSkinSpectrum(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0.0; 
    let criteriaMet = 0;
    let redDominanceScore = 0;

    if (metrics.redIntensity >= this.config.MIN_RED_INTENSITY && 
        metrics.redIntensity <= this.config.MAX_RED_INTENSITY) {
      confidence += 0.35; 
      reasons.push(`✓ RInt (${metrics.redIntensity.toFixed(0)})`);
      criteriaMet++;
    } else {
      reasons.push(`✗ RInt (${metrics.redIntensity.toFixed(0)})`);
      confidence -= 0.1;
    }
    
    if (metrics.rgRatio >= this.config.MIN_RG_RATIO && metrics.rbRatio >= this.config.MIN_RB_RATIO) {
      confidence += 0.35; 
      redDominanceScore = Math.min(1, ((metrics.rgRatio - this.config.MIN_RG_RATIO) + (metrics.rbRatio - this.config.MIN_RB_RATIO)) / 3.0);
      reasons.push(`✓ RDom (R/G:${metrics.rgRatio.toFixed(1)}, R/B:${metrics.rbRatio.toFixed(1)})`);
      criteriaMet++;
    } else {
      reasons.push(`✗ RDom (R/G:${metrics.rgRatio.toFixed(1)}, R/B:${metrics.rbRatio.toFixed(1)})`);
      confidence -= 0.15;
    }

    const isValidSpectrum = criteriaMet >= 2 && confidence >= 0.5; 
    
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
    if (metrics.redIntensity > this.FALSE_POSITIVE_BLACKLIST.EXTREME_PLASTIC_RED_MIN && metrics.rgRatio < 0.7) {
      isFalsePositive = true;
      rejectionReasons.push(`✗ Plástico/Reflejo? (R=${metrics.redIntensity.toFixed(0)}, RG=${metrics.rgRatio.toFixed(1)})`);
    }
    if (metrics.rgRatio < this.FALSE_POSITIVE_BLACKLIST.EXTREME_GREEN_DOMINANT_THRESHOLD || metrics.rbRatio < 0.8) { 
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
    let meetsStabilityOverall = true; 

    if (this.filteredRedHistory.length >= this.config.HISTORY_SIZE_SHORT) {
      const recentSignal = this.filteredRedHistory.slice(-this.config.HISTORY_SIZE_SHORT);
      const mean = recentSignal.reduce((s, v) => s + v, 0) / recentSignal.length;
      const stdDev = mean > 0 ? Math.sqrt(recentSignal.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recentSignal.length) : 0;
      
      if (stdDev > this.config.PULSABILITY_STD_THRESHOLD) { 
          meetsPulsatility = true;
          pulsatilityScore = Math.min(1, stdDev / (this.config.PULSABILITY_STD_THRESHOLD * 2.5));
          reasons.push(`✓ Pulsat. (stdFilt:${stdDev.toFixed(2)})`);
      } else {
        reasons.push(`✗ Pulsat. (stdFilt:${stdDev.toFixed(2)} < ${this.config.PULSABILITY_STD_THRESHOLD})`);
      }
    } else {
        reasons.push(`Datos insuf. para pulsat. (${this.filteredRedHistory.length}/${this.config.HISTORY_SIZE_SHORT})`);
    }

    if (this.rawRedHistory.length >= 2) {
      const frameDiff = Math.abs(this.rawRedHistory[this.rawRedHistory.length - 1] - this.rawRedHistory[this.rawRedHistory.length - 2]);
      if (frameDiff > this.config.STABILITY_FRAME_DIFF_THRESHOLD) {
        reasons.push(`✗ Inest. frame (Diff:${frameDiff.toFixed(0)} > ${this.config.STABILITY_FRAME_DIFF_THRESHOLD})`);
        meetsStabilityOverall = false;
      }

      if (this.rawRedHistory.length >= this.config.HISTORY_SIZE_LONG) {
        const longTermSignal = this.rawRedHistory;
        const mean = longTermSignal.reduce((s, v) => s + v, 0) / longTermSignal.length;
        const stdDevLong = mean > 0 ? Math.sqrt(longTermSignal.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / longTermSignal.length) : 0;
        if (stdDevLong > this.config.STABILITY_WINDOW_STD_THRESHOLD) {
          reasons.push(`✗ Inest. ventana (StdRaw:${stdDevLong.toFixed(0)} > ${this.config.STABILITY_WINDOW_STD_THRESHOLD})`);
          meetsStabilityOverall = false;
        }
        stability = Math.max(0, 1 - (stdDevLong / (this.config.STABILITY_WINDOW_STD_THRESHOLD * 3)));
      } else {
         stability = meetsStabilityOverall ? 0.65 : 0.25;
      }
      if (meetsStabilityOverall) {
        reasons.push(`✓ Estab. (score:${stability.toFixed(2)})`);
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
    const acceptanceReasons = [...spectralAnalysis.reasons, ...temporalValidation.reasons].filter(r => r.startsWith('✓'));
    const rejectionReasons = [...falsePositiveCheck.rejectionReasons];

    let isHumanFinger = false;
    let currentConfidence = 0;
    let dbgSpectralConfidence = spectralAnalysis.confidence;

    // Criterio primario: Espectro y pulsatilidad
    if (spectralAnalysis.isValidSpectrum && temporalValidation.meetsPulsatility) {
      isHumanFinger = true;
      currentConfidence = (spectralAnalysis.confidence * 0.6) + (temporalValidation.pulsatilityScore * 0.4); // Mayor peso al espectro y pulso
      if (!temporalValidation.meetsStability) {
        currentConfidence *= 0.8; // Penalizar ligeramente si es inestable pero hay espectro y pulso
        rejectionReasons.push("Advertencia: Inestable pero con pulso/espectro OK");
      }
    } else {
      // Si falla el espectro o la pulsatilidad, es menos probable que sea dedo
      if (!spectralAnalysis.isValidSpectrum) rejectionReasons.push("Espectro color inválido");
      if (!temporalValidation.meetsPulsatility) rejectionReasons.push("Pulsatilidad insuf.");
      if (!temporalValidation.meetsStability && spectralAnalysis.isValidSpectrum) {
          rejectionReasons.push("Señal inestable (sin pulso claro)");
      } else if (!temporalValidation.meetsStability) {
          rejectionReasons.push("Señal inestable");
      }
      currentConfidence = (spectralAnalysis.confidence * 0.3) + (temporalValidation.pulsatilityScore * 0.2) + (temporalValidation.stability * 0.1);
    }

    if (falsePositiveCheck.isFalsePositive) {
        isHumanFinger = false; // Anular si es un falso positivo claro
        currentConfidence *= 0.5; // Reducir drásticamente la confianza
    }
    
    if(!isHumanFinger) {
        currentConfidence = Math.min(0.45, currentConfidence);
    }

    this.smoothedConfidence = this.smoothedConfidence * (1 - this.config.CONFIDENCE_EMA_ALPHA) + currentConfidence * this.config.CONFIDENCE_EMA_ALPHA;
    
    return {
      isHumanFinger,
      confidence: Math.max(0, Math.min(1, this.smoothedConfidence)),
      acceptanceReasons,
      rejectionReasons,
      dbgSpectralConfidence
    };
  }
  
  private calculateIntegratedQuality(isFinger: boolean, metrics: any, stabilityScoreParam: number, pulsatilityScoreParam: number): { finalQuality: number, rawQuality: number } {
    const currentStabilityScore = stabilityScoreParam;
    const currentPulsatilityScore = pulsatilityScoreParam;
    const avgRed = metrics.redIntensity;
    let rawQualityCalc = 0;

    if (detailedLog) { // Usar la misma variable detailedLog o pasarla como parámetro si está en otro scope
      console.log("[HFD IQ] Inputs:", { isFinger, smoothedConfidence: this.smoothedConfidence, currentStabilityScore, currentPulsatilityScore, avgRed });
    }

    if (!isFinger) {
      rawQualityCalc = Math.max(0, Math.min(25, Math.round(this.smoothedConfidence * 50)));
      if (detailedLog) console.log("[HFD IQ] Not a finger, rawQualityCalc:", rawQualityCalc);
      return { finalQuality: rawQualityCalc, rawQuality: rawQualityCalc };
    }
    
    rawQualityCalc = 
        ((currentPulsatilityScore * 0.60) +   
        (this.smoothedConfidence * 0.30) + 
        (currentStabilityScore * 0.10)) * 100;

    if (detailedLog) console.log("[HFD IQ] Finger detected, initial rawQualityCalc:", rawQualityCalc);

    if (avgRed < this.config.MIN_RED_INTENSITY + 10 || avgRed > this.config.MAX_RED_INTENSITY - 10) {
      rawQualityCalc *= 0.95; 
      if (detailedLog) console.log("[HFD IQ] Penalized for red intensity, new rawQualityCalc:", rawQualityCalc);
    }
    
    const finalQualityCalc = Math.max(10, Math.min(99, Math.round(rawQualityCalc)));
    if (detailedLog) {
      console.log("[HFD IQ] Final Scores:", { finalQualityCalc, rawQualityCalc: Math.round(rawQualityCalc) });
    }
    if (isNaN(finalQualityCalc) || isNaN(rawQualityCalc)) {
        console.error("[HFD IQ CRITICAL] NaN DETECTED IN QUALITY CALCULATION", 
            { isFinger, smoothedConfidence: this.smoothedConfidence, currentStabilityScore, currentPulsatilityScore, avgRed, rawQualityCalc, finalQualityCalc }
        );
        // Devolver 0 si es NaN para evitar propagar NaN
        return { finalQuality: 0, rawQuality: 0 }; 
    }
    return { finalQuality: finalQualityCalc, rawQuality: Math.round(rawQualityCalc) };
  }

  private createDefaultResult(timestamp: number, reason: string): HumanFingerResult {
    this.smoothedConfidence = this.smoothedConfidence * (1 - this.config.CONFIDENCE_EMA_ALPHA); 
    return {
      isHumanFinger: false,
      confidence: this.smoothedConfidence,
      quality: 0,
      rawValue: 0,
      filteredValue: 0,
      timestamp,
      debugInfo: {
        avgRed: 0, avgGreen: 0, avgBlue: 0, rgRatio: 0, rbRatio: 0,
        redDominanceScore: 0, pulsatilityScore: 0, stabilityScore: 0,
        rejectionReasons: [reason],
        acceptanceReasons: [],
        dbgRawQuality: 0
      }
    };
  }
  
  reset(): void {
    this.rawRedHistory = [];
    this.filteredRedHistory = [];
    this.frameCount = 0;
    this.lastRawRedEMA = 0;
    this.smoothedConfidence = 0;
    console.log("HumanFingerDetector: Estado interno reseteado.");
  }
  
  public getStatus() {
    return {
      frameCount: this.frameCount,
      config: this.config 
    };
  }

  // --- Funciones de cálculo de métricas auxiliares (pueden simplificarse o eliminarse si no se usan) ---
  private calculateColorTemperature(r: number, g: number, b: number): number {
    if (r + g + b < 15) return 3000; 
    const sumRGB = r + g + b;
    if (sumRGB === 0) return 3000;
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
    if (topQuantileIndex >= sortedIntensities.length || medianIndex >= sortedIntensities.length || (sortedIntensities.length - topQuantileIndex === 0) ) return 1.0; 
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

  private logDetectionResult(decision: any, metrics: any, quality: number): void {
    // if (this.frameCount % 30 === 0) { // Loguear cada segundo (asumiendo 30fps)
      console.log("[HFD INTERNAL LOG] Detection Result:", {
        D: decision.isHumanFinger ? 1:0,
        C: decision.confidence.toFixed(2),
        Q: quality.toFixed(0),
        R: metrics.redIntensity.toFixed(0),
        RG: metrics.rgRatio.toFixed(1),
        RB: metrics.rbRatio.toFixed(1),
        PS: pulsatilityScoreParamForLog, // Necesitaría acceso a pulsatilityScore desde makeFinalDecision o qualityScores
        SS: stabilityScoreParamForLog, // Necesitaría acceso a stabilityScore desde makeFinalDecision o qualityScores
        Reject: decision.rejectionReasons.length > 0 ? decision.rejectionReasons.join(', ').substring(0,30) : "-",
        Accept: decision.acceptanceReasons.length > 0 ? decision.acceptanceReasons.join(', ').substring(0,30) : "-"
      });
    // }
  }
}

// Helper para la función de log, ya que las variables no están en scope directo
// Estas variables necesitarían pasarse a logDetectionResult o ser accesibles de otra forma
let pulsatilityScoreParamForLog = 0;
let stabilityScoreParamForLog = 0;
