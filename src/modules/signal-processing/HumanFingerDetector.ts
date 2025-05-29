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
  roi: { x: number; y: number; width: number; height: number };
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
  MIN_RED_INTENSITY: 40,
  MAX_RED_INTENSITY: 230,
  MIN_RG_RATIO: 1.3,
  MIN_RB_RATIO: 1.5,
  HISTORY_SIZE_SHORT: 10,      // Coincide con HISTORY_SIZE_SHORT_PULS
  HISTORY_SIZE_LONG: 30,       // Coincide con HISTORY_SIZE_LONG_STAB
  PULSABILITY_STD_THRESHOLD: 0.6,
  STABILITY_FRAME_DIFF_THRESHOLD: 12,
  STABILITY_WINDOW_STD_THRESHOLD: 9,
  ROI_WIDTH_FACTOR: 0.3, 
  ROI_HEIGHT_FACTOR: 0.3,
  EMA_ALPHA_RAW: 0.35, 
  CONFIDENCE_EMA_ALPHA: 0.15,
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

    // --- TEMPORARY DIAGNOSTIC OVERRIDE: Force finger detected ---
    // const tempResult: HumanFingerResult = { ... };
    // // console.log(\"HFDetector: Returning TEMPORARY_OVERRIDE result\"); // Optional: re-add if logs are available later
    // return tempResult;
    // --- END TEMPORARY OVERRIDE ---

    // 1. Calculate color metrics from central ROI (or whole image if no ROI logic yet)
    // Assuming the central ROI logic or similar will be implemented here or before this call
    // For now, use a simplified approach if a proper ROI wasn't selected.
    // A robust implementation needs a dynamic ROI selection based on image analysis.
    // Let's assume for now a function getCentralROIColorData(imageData) exists or basic avg is used.
    // Based on previous code, it seems avgRed, avgGreen, avgBlue are intended to be calculated.

    // Placeholder: Replace with actual ROI analysis to get avgRed, avgGreen, avgBlue
    // For now, let's read the first pixel as a basic placeholder if no ROI logic is present yet.
    // **TODO: Implement proper ROI selection and averaging**
    let avgRed = 0, avgGreen = 0, avgBlue = 0;
    let roi = { x: 0, y: 0, width: imageData.width, height: imageData.height }; // Default to full image
    
    // Simple average over a central square for now - Needs refinement!
    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;
    const roiWidth = Math.max(1, Math.floor(imageData.width * this.config.ROI_WIDTH_FACTOR));
    const roiHeight = Math.max(1, Math.floor(imageData.height * this.config.ROI_HEIGHT_FACTOR));
    const roiX = Math.max(0, Math.floor(centerX - roiWidth / 2));
    const roiY = Math.max(0, Math.floor(centerY - roiHeight / 2));
    
    roi = { x: roiX, y: roiY, width: roiWidth, height: roiHeight };

    let sumRed = 0, sumGreen = 0, sumBlue = 0;
    let pixelCount = 0;
    
    // Ensure ROI is within bounds
    const effectiveRoiX = Math.max(0, roi.x);
    const effectiveRoiY = Math.max(0, roi.y);
    const effectiveRoiWidth = Math.min(roi.width, imageData.width - effectiveRoiX);
    const effectiveRoiHeight = Math.min(roi.height, imageData.height - effectiveRoiY);

    if (effectiveRoiWidth > 0 && effectiveRoiHeight > 0) {
      for (let y = effectiveRoiY; y < effectiveRoiY + effectiveRoiHeight; y++) {
        for (let x = effectiveRoiX; x < effectiveRoiX + effectiveRoiWidth; x++) {
          const index = (y * imageData.width + x) * 4;
          sumRed += imageData.data[index];
          sumGreen += imageData.data[index + 1];
          sumBlue += imageData.data[index + 2];
          pixelCount++;
        }
      }
    }

    if (pixelCount > 0) {
      avgRed = sumRed / pixelCount;
      avgGreen = sumGreen / pixelCount;
      avgBlue = sumBlue / pixelCount;
    } else {
        // Fallback if ROI is somehow invalid, maybe use a single central pixel or previous frame's average
        const centralPixelIndex = (Math.floor(centerY) * imageData.width + Math.floor(centerX)) * 4;
        if (centralPixelIndex < imageData.data.length) { // Basic boundary check
            avgRed = imageData.data[centralPixelIndex];
            avgGreen = imageData.data[centralPixelIndex + 1];
            avgBlue = imageData.data[centralPixelIndex + 2];
        }
        roi = { x: Math.floor(centerX), y: Math.floor(centerY), width: 1, height: 1 };
         console.warn("HFDetector: Invalid ROI, using central pixel fallback.");
    }

    // 2. Calculate metrics based on color data
    const metrics = this.calculateMetricsInternal(avgRed, avgGreen, avgBlue, imageData);

    // Update raw signal history for temporal analysis
    this.rawRedHistory.push(metrics.redIntensity);
    if (this.rawRedHistory.length > Math.max(this.config.HISTORY_SIZE_SHORT, this.config.HISTORY_SIZE_LONG)) {
      this.rawRedHistory.shift();
    }
    
    // Apply simple EMA filter to raw red for filtered history used in pulsatility
    if (this.frameCount === 1) { // Initialize on first frame
        this.lastRawRedEMA = metrics.redIntensity;
    } else {
        this.lastRawRedEMA = this.lastRawRedEMA * (1 - this.config.EMA_ALPHA_RAW) + metrics.redIntensity * this.config.EMA_ALPHA_RAW;
    }
    this.filteredRedHistory.push(this.lastRawRedEMA);
     if (this.filteredRedHistory.length > this.config.HISTORY_SIZE_SHORT) {
       this.filteredRedHistory.shift();
    }

    // 3. Analyze spectral characteristics
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);

    // 4. Check for extreme false positives (e.g., simple red objects)
    const falsePositiveCheck = this.detectExtremeFalsePositives(metrics);
    
    // 5. Validate temporal characteristics (pulsatility and stability)
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis);

    // 6. Make final decision based on all analyses
    const decision = this.makeFinalDecision(spectralAnalysis, falsePositiveCheck, temporalValidation);

    // 7. Calculate integrated quality score
    const quality = this.calculateIntegratedQuality(decision.isHumanFinger, temporalValidation.stability, temporalValidation.pulsatilityScore, metrics.redIntensity, temporalValidation, spectralAnalysis);

    // 8. Log result periodically for debugging
    this.logDetectionResult(decision, metrics, quality);

    // 9. Return the final result
    const result: HumanFingerResult = {
      isHumanFinger: decision.isHumanFinger,
      confidence: decision.confidence,
      quality: quality,
      rawValue: metrics.redIntensity, // Using the calculated avgRed
      filteredValue: this.lastRawRedEMA, // Using the filtered value for output
      timestamp,
      roi: roi, // Return the calculated ROI
      debugInfo: {
        avgRed: metrics.redIntensity,
        avgGreen: metrics.greenIntensity,
        avgBlue: metrics.blueIntensity,
        rgRatio: metrics.rgRatio,
        rbRatio: metrics.rbRatio,
        redDominanceScore: spectralAnalysis.redDominanceScore,
        pulsatilityScore: temporalValidation.pulsatilityScore,
        stabilityScore: temporalValidation.stability,
        rejectionReasons: decision.rejectionReasons,
        acceptanceReasons: decision.acceptanceReasons
      }
    };

    // console.log("HFDetector: Result", result); // Optional: re-add if logs are available later

    return result;
  }

  private calculateMetricsInternal(avgRed: number, avgGreen: number, avgBlue: number, imageData: ImageData) {
    const rgRatio = avgGreen > 5 ? avgRed / avgGreen : (avgRed > 10 ? 10 : 0.5);
    const rbRatio = avgBlue > 5 ? avgRed / avgBlue : (avgRed > 10 ? 10 : 0.5);
    
    // Las siguientes métricas son placeholders o simplificaciones si no se quiere hacer un análisis de ROI completo aquí
    // Si se necesitan con precisión, se debería pasar el array de píxeles del ROI a estas funciones.
    const placeholderIntensities = this.rawRedHistory.length > 0 ? this.rawRedHistory : [avgRed]; // Usa historial o valor actual
    const placeholderReds = this.rawRedHistory.length > 0 ? this.rawRedHistory : [avgRed];
    const placeholderGreens = this.rawRedHistory.length > 0 ? this.rawRedHistory.map(r => r / (rgRatio||1)) : [avgGreen];
    const placeholderBlues = this.rawRedHistory.length > 0 ? this.rawRedHistory.map(r => r / (rbRatio||1)) : [avgBlue];

    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      rgRatio: rgRatio,
      rbRatio: rbRatio,
      gbRatio: avgBlue > 5 ? avgGreen / avgBlue : (avgGreen > 10 ? 10 : 0.5),
      colorTemperature: this.calculateColorTemperature(avgRed, avgGreen, avgBlue),
      textureScore: this.calculateTextureScore(placeholderIntensities), 
      edgeGradient: this.calculateEdgeGradient(placeholderReds),
      areaPercentage: 100, // Asumimos que el ROI definido está cubierto
      specularRatio: this.calculateSpecularRatio(placeholderReds, placeholderGreens, placeholderBlues), 
      uniformity: this.calculateUniformity(placeholderIntensities)
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
          pulsatilityScore = Math.min(1, stdDev / (this.config.PULSABILITY_STD_THRESHOLD * 4));
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
        stability = Math.max(0, 1 - (stdDevLong / (this.config.STABILITY_WINDOW_STD_THRESHOLD * 2))); 
      } else {
         stability = meetsStabilityOverall ? 0.6 : 0.2; // Ajustado para reflejar mejor el estado sin historial largo
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
    const acceptanceReasons = [...spectralAnalysis.reasons, ...temporalValidation.reasons].filter(r => r.startsWith('✓')); // Solo razones positivas
    const rejectionReasons = [...falsePositiveCheck.rejectionReasons]; 

    if (!spectralAnalysis.isValidSpectrum) rejectionReasons.push("Espectro color inválido");
    if (!temporalValidation.meetsPulsatility) rejectionReasons.push("Pulsatilidad insuf.");
    if (!temporalValidation.meetsStability) rejectionReasons.push("Señal inestable");

    // Criterios simplificados y firmes:
    const isHumanFinger =
      spectralAnalysis.isValidSpectrum && // Debe cumplir criterios de color básicos
      !falsePositiveCheck.isFalsePositive && // No debe ser un falso positivo extremo (e.g., plástico)
      spectralAnalysis.redDominanceScore > 0.4; // Reducir ligeramente el requisito de dominancia roja para aumentar sensibilidad
      // NOTA: Se elimina la dependencia estricta de la validación temporal para la decisión binaria isHumanFinger.
      // La calidad (quality) aún usará los datos temporales.
      

    let currentConfidence = 0;
    if (isHumanFinger) {
      // Calcular confianza basada en criterios simplificados
      currentConfidence = (spectralAnalysis.confidence * 0.6) + // Mayor peso al espectro
                          (spectralAnalysis.redDominanceScore * 0.3) + // Peso a la dominancia roja
                          (1 - (falsePositiveCheck.isFalsePositive ? 1 : 0)) * 0.1; // Pequeño peso si no es falso positivo
      currentConfidence = Math.max(0.4, currentConfidence); // Base de confianza si cumple
    } else {
      currentConfidence = Math.min(0.4,
        (spectralAnalysis.confidence * 0.3) +
        (temporalValidation.pulsatilityScore * 0.15) +
        (temporalValidation.stability * 0.05)
      );
    }
    
    this.smoothedConfidence = this.smoothedConfidence * (1 - this.config.CONFIDENCE_EMA_ALPHA) + currentConfidence * this.config.CONFIDENCE_EMA_ALPHA;
    
    return {
      isHumanFinger,
      confidence: Math.max(0, Math.min(1, this.smoothedConfidence)),
      acceptanceReasons,
      rejectionReasons
    };
  }
  
  private calculateIntegratedQuality(isFinger: boolean, stabilityScore: number, pulsatilityScore: number, avgRed: number, temporalValidation: any, spectralAnalysis: any): number {
    if (!isFinger) {
      // Si no es un dedo detectado, la calidad es muy baja
      return Math.max(0, Math.min(20, Math.round(this.smoothedConfidence * 40))); // Ajustar ligeramente el rango si no es dedo
    }
    
    // Calcular calidad combinada, reflejando la fortaleza de las características PPG
    let quality = (
      pulsatilityScore * 0.5 + // Gran peso a la pulsatilidad
      stabilityScore * 0.3 + // Peso a la estabilidad
      spectralAnalysis.redDominanceScore * 0.1 + // Peso a la dominancia roja como indicador de contacto/iluminación
      this.smoothedConfidence * 0.1 // Peso a la confianza general suavizada
    ) * 100;

    if (avgRed < this.config.MIN_RED_INTENSITY + 20 || avgRed > this.config.MAX_RED_INTENSITY - 20) {
      quality *= 0.85; // Penalizar si la intensidad está en los extremos del rango aceptable
    }
    
    // Asegurar un rango de calidad útil
    return Math.max(30, Math.min(100, Math.round(quality))); // Calidad mínima de 30 si es dedo (para indicar una base de calidad)
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
      roi: { x: 0, y: 0, width: 0, height: 0 },
      debugInfo: {
        avgRed: 0, avgGreen: 0, avgBlue: 0, rgRatio: 0, rbRatio: 0,
        redDominanceScore: 0, pulsatilityScore: 0, stabilityScore: 0,
        rejectionReasons: [reason],
        acceptanceReasons: []
      }
    };
  }
  
  reset(): void {
    this.rawRedHistory = [];
    this.filteredRedHistory = [];
    // this.lastDetectionResult = null; // Ya no se usa
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
}
