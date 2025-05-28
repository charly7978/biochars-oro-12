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
  HISTORY_SIZE_SHORT: number;
  HISTORY_SIZE_LONG: number;
  PULSABILITY_STD_THRESHOLD: number;
  STABILITY_FRAME_DIFF_THRESHOLD: number;
  STABILITY_WINDOW_STD_THRESHOLD: number;
  ROI_WIDTH_FACTOR: number;
  ROI_HEIGHT_FACTOR: number;
  EMA_ALPHA_RAW: number;
  CONFIDENCE_EMA_ALPHA: number;
}

const defaultDetectorConfig: HumanFingerDetectorConfig = {
  MIN_RED_INTENSITY: 25,
  MAX_RED_INTENSITY: 250,
  MIN_RG_RATIO: 0.95,
  MIN_RB_RATIO: 0.95,
  HISTORY_SIZE_SHORT: 20,
  HISTORY_SIZE_LONG: 60,
  PULSABILITY_STD_THRESHOLD: 0.08,
  STABILITY_FRAME_DIFF_THRESHOLD: 30,
  STABILITY_WINDOW_STD_THRESHOLD: 25,
  ROI_WIDTH_FACTOR: 0.4,
  ROI_HEIGHT_FACTOR: 0.4,
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

    const frameData = (imageData as any).frameData;
    const perfusionIndex = frameData?.perfusionIndex || 0;

    const metrics = this.calculateMetricsInternal(avgRed, avgGreen, avgBlue, imageData, perfusionIndex);
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

  private calculateMetricsInternal(avgRed: number, avgGreen: number, avgBlue: number, imageData: ImageData, perfusionIndex: number) {
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
      uniformity: this.calculateUniformity([avgRed]),
      perfusionIndex: perfusionIndex
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
      redDominanceScore,
      perfusionIndexConfidence: metrics.perfusionIndex > 0 ? Math.min(1, metrics.perfusionIndex / 10) : 0
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
    return { isFalsePositive, rejectionReasons, perfusionIndex: metrics.perfusionIndex };
  }
  
  private validateTemporal(metrics: any, spectralAnalysis: any): { pulsatilityScore: number, stability: number, reasons: string[], meetsPulsatility: boolean, meetsStability: boolean } {
    const reasons: string[] = [];
    let meetsPulsatility = false;
    let meetsStabilityWindow = false;
    let meetsStabilityFrameDiff = false;
    let pulsatilityScore = 0;
    let stability = 0;

    if (this.filteredRedHistory.length >= this.config.HISTORY_SIZE_SHORT && metrics.redIntensity > this.config.MIN_RED_INTENSITY) {
        const recentHistory = this.filteredRedHistory.slice(-this.config.HISTORY_SIZE_SHORT);
        const mean = recentHistory.reduce((a,b) => a+b, 0) / recentHistory.length;
        const stdDev = Math.sqrt(recentHistory.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / recentHistory.length);
        pulsatilityScore = Math.min(1, (stdDev / this.config.PULSABILITY_STD_THRESHOLD) * 1.5);
        meetsPulsatility = stdDev >= this.config.PULSABILITY_STD_THRESHOLD;
        reasons.push(`Pulsabilidad: ${stdDev.toFixed(3)} (Umbral: ${this.config.PULSABILITY_STD_THRESHOLD})`);
    } else {
        reasons.push(`Pulsabilidad: historial insuficiente (${this.filteredRedHistory.length})`);
    }

    if (this.filteredRedHistory.length >= this.config.HISTORY_SIZE_LONG && this.rawRedHistory.length >= 2 && metrics.redIntensity > this.config.MIN_RED_INTENSITY) {
        const recentFiltered = this.filteredRedHistory.slice(-this.config.HISTORY_SIZE_LONG);
        const recentRaw = this.rawRedHistory.slice(-2);
        
        const meanLong = recentFiltered.reduce((a,b) => a+b, 0) / recentFiltered.length;
        const stdDevLong = Math.sqrt(recentFiltered.map(x => Math.pow(x - meanLong, 2)).reduce((a, b) => a + b, 0) / recentFiltered.length);
        const stabilityWindowScore = Math.max(0, 1 - (stdDevLong / this.config.STABILITY_WINDOW_STD_THRESHOLD) * 1.2);
        meetsStabilityWindow = stdDevLong <= this.config.STABILITY_WINDOW_STD_THRESHOLD;
        reasons.push(`Estabilidad (Ventana): ${stdDevLong.toFixed(3)} (Umbral: ${this.config.STABILITY_WINDOW_STD_THRESHOLD})`);

        const frameDiff = Math.abs(recentRaw[1] - recentRaw[0]);
        const stabilityFrameDiffScore = Math.max(0, 1 - (frameDiff / this.config.STABILITY_FRAME_DIFF_THRESHOLD) * 1.2);
        meetsStabilityFrameDiff = frameDiff <= this.config.STABILITY_FRAME_DIFF_THRESHOLD;
        reasons.push(`Estabilidad (FrameDiff): ${frameDiff.toFixed(3)} (Umbral: ${this.config.STABILITY_FRAME_DIFF_THRESHOLD})`);

        stability = (stabilityWindowScore * 0.6 + stabilityFrameDiffScore * 0.4);
        stability = Math.max(0, Math.min(1, stability));
    } else {
        reasons.push(`Estabilidad: historial insuficiente (${this.filteredRedHistory.length})`);
    }

    if (metrics.perfusionIndex !== undefined && metrics.perfusionIndex > 0) {
       const piStabilityFactor = Math.min(1, metrics.perfusionIndex / 5);
       stability = (stability * 0.7 + piStabilityFactor * 0.3);
       stability = Math.max(0, Math.min(1, stability));
       reasons.push(`Estabilidad (PI Factor): ${piStabilityFactor.toFixed(2)}`);
    }

    const meetsStability = meetsStabilityWindow && meetsStabilityFrameDiff;

    return {
      pulsatilityScore,
      stability,
      reasons,
      meetsPulsatility,
      meetsStability
    };
  }
  
  private makeFinalDecision(spectralAnalysis: any, falsePositiveCheck: any, temporalValidation: any) {
    const acceptanceReasons = [...spectralAnalysis.reasons, ...temporalValidation.reasons].filter(r => r.startsWith('✓'));
    const rejectionReasons = [...falsePositiveCheck.rejectionReasons];

    let isHumanFinger = false;
    let currentConfidence = 0;
    let dbgSpectralConfidence = spectralAnalysis.confidence;

    if (spectralAnalysis.isValidSpectrum && temporalValidation.meetsPulsatility) {
      isHumanFinger = true;
      currentConfidence = (spectralAnalysis.confidence * 0.6) + (temporalValidation.pulsatilityScore * 0.4);
      if (!temporalValidation.meetsStability) {
        currentConfidence *= 0.8;
        rejectionReasons.push("Advertencia: Inestable pero con pulso/espectro OK");
      }
    } else {
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
        isHumanFinger = false;
        currentConfidence *= 0.5;
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
    let qualityScore = (
      (metrics.redIntensity / 255) * 0.2 +
      (metrics.rgRatio / 3) * 0.1 +
      (metrics.rbRatio / 3) * 0.1 +
      pulsatilityScoreParam * 0.3 +
      stabilityScoreParam * 0.3
    );

    if (metrics.perfusionIndex !== undefined && metrics.perfusionIndex > 0) {
        const piScore = Math.min(0.2, metrics.perfusionIndex / 50);
        qualityScore += piScore;
    }

    const rawQuality = Math.max(0, Math.min(1, qualityScore)) * 100;

    const finalQuality = isFinger ? rawQuality : 0;

    const adjustedFinalQuality = finalQuality * this.smoothedConfidence;

    return {
      finalQuality: Math.round(adjustedFinalQuality),
      rawQuality: Math.round(rawQuality)
    };
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
      config: this.config,
      smoothedConfidence: this.smoothedConfidence.toFixed(2),
      lastRawRedEMA: this.lastRawRedEMA.toFixed(2),
      historyLengths: { raw: this.rawRedHistory.length, filtered: this.filteredRedHistory.length }
    };
  }

  private calculateColorTemperature(r: number, g: number, b: number): number {
    console.warn("calculateColorTemperature es placeholder");
    if ((r + g + b) === 0) return 0;
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const avgVal = (r + g + b) / 3;

    const colorScore = (r - b) / (maxVal - minVal + 1e-5);
    const estimatedTemp = 6000 - colorScore * 4000;

    return Math.max(2000, Math.min(10000, estimatedTemp));
  }
  
  private calculateTextureScore(intensities: number[]): number {
    console.warn("calculateTextureScore es placeholder");
    return 0.7 + Math.random() * 0.1;
  }
  
  private calculateEdgeGradient(values: number[]): number {
    console.warn("calculateEdgeGradient es placeholder");
    return 0.1 + Math.random() * 0.05;
  }
  
  private calculateSpecularRatio(reds: number[], greens: number[], blues: number[]): number {
    console.warn("calculateSpecularRatio es placeholder");
    return 0.2 + Math.random() * 0.1;
  }
  
  private calculateUniformity(intensities: number[]): number {
    console.warn("calculateUniformity es placeholder");
    return 0.8 + Math.random() * 0.05;
  }

  private logDetectionResult(decision: any, metrics: any, quality: number): void {
    if (!decision.isHumanFinger) {
        console.warn("--- HFD Rejected (", this.frameCount, ") ---");
        console.warn("Reasons:", decision.rejectionReasons);
        console.warn("Metrics:", metrics);
        console.warn("Spectral:", decision.debugInfo?.dbgSpectralConfidence);
        console.warn("Temporal:", { pulsatility: decision.debugInfo?.pulsatilityScore, stability: decision.debugInfo?.stabilityScore });
        console.warn("Quality:", quality);
    } else {
        console.log("--- HFD Accepted (", this.frameCount, ") ---");
        console.log("Reasons:", decision.acceptanceReasons);
        console.log("Metrics:", metrics);
        console.log("Confidence:", decision.confidence.toFixed(2));
        console.log("Quality:", quality);
        console.log("Temporal:", { pulsatility: decision.debugInfo?.pulsatilityScore.toFixed(2), stability: decision.debugInfo?.stabilityScore.toFixed(2) });
        console.log("Raw Quality:", decision.debugInfo?.dbgRawQuality.toFixed(2));
        console.log("PI:", metrics.perfusionIndex?.toFixed(2) || "N/A");
    }
  }
}

let pulsatilityScoreParamForLog = 0;
let stabilityScoreParamForLog = 0;
