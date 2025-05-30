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
  EMA_ALPHA_RAW: number;
  CONFIDENCE_EMA_ALPHA: number;
  // Añadir umbrales específicos si es necesario, aunque ajustaremos los existentes por ahora
  // HIGH_LIGHT_RED_MIN?: number;
  // HIGH_LIGHT_RG_MIN?: number;
}

const defaultDetectorConfig: HumanFingerDetectorConfig = {
  MIN_RED_INTENSITY: 15,
  MAX_RED_INTENSITY: 250,
  MIN_RG_RATIO: 0.85,
  MIN_RB_RATIO: 0.85,
  HISTORY_SIZE_SHORT: 20,
  HISTORY_SIZE_LONG: 60,
  PULSABILITY_STD_THRESHOLD: 0.06,
  STABILITY_FRAME_DIFF_THRESHOLD: 40,
  STABILITY_WINDOW_STD_THRESHOLD: 30,
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
  
  private isHighLightCondition = false; // Nuevo flag para detectar condición de alta luz
  
  // 1. Cambios en la clase HumanFingerDetector:
  // Agregar variables para umbrales adaptativos
  private adaptiveRedMin: number = 0;
  private adaptiveRedMax: number = 255;
  private adaptiveRgRatioMin: number = 0.7;
  private adaptiveRbRatioMin: number = 0.7;
  
  constructor(config: Partial<HumanFingerDetectorConfig> = {}) {
    this.config = { ...defaultDetectorConfig, ...config };
    this.reset();
    // Inicializar umbrales adaptativos con valores por defecto
    this.adaptiveRedMin = this.config.MIN_RED_INTENSITY;
    this.adaptiveRedMax = this.config.MAX_RED_INTENSITY;
    this.adaptiveRgRatioMin = this.config.MIN_RG_RATIO;
    this.adaptiveRbRatioMin = this.config.MIN_RB_RATIO;
    console.log("HumanFingerDetector: Inicializado con config:", this.config);
  }

  public configure(newConfig: Partial<HumanFingerDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("HumanFingerDetector: Reconfigurado con nuevos umbrales/parámetros:", this.config);
    // Considerar si es necesario un reset completo o parcial de historiales aquí
    // this.reset(); // Podría ser demasiado agresivo si solo cambian umbrales menores
  }

  public detectHumanFinger(imageData: ImageData): HumanFingerResult {
    const timestamp = Date.now();

    // *** Temporary: Extract simple average red from a central ROI for initial debugging ***
    // Replace this with proper FrameProcessor integration if available and needed
    const width = imageData.width;
    const height = imageData.height;
    const roiSize = Math.min(width, height) * 0.3; // Simple ROI 30% of smaller dimension
    const roiX = Math.floor((width - roiSize) / 2);
    const roiY = Math.floor((height - roiSize) / 2);

    let totalRed = 0;
    let totalGreen = 0;
    let totalBlue = 0;
    let pixelCount = 0;

    for (let y = roiY; y < roiY + roiSize; y++) {
      for (let x = roiX; x < roiX + roiSize; x++) {
        const index = (y * width + x) * 4;
        totalRed += imageData.data[index];
        totalGreen += imageData.data[index + 1];
        totalBlue += imageData.data[index + 2];
        pixelCount++;
      }
    }

    const avgRed = pixelCount > 0 ? totalRed / pixelCount : 0;
    const avgGreen = pixelCount > 0 ? totalGreen / pixelCount : 0;
    const avgBlue = pixelCount > 0 ? totalBlue / pixelCount : 0;
    // *** End Temporary Extraction ***

    // Add this log to see the raw extracted values
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Avg RGB: R=${avgRed.toFixed(2)}, G=${avgGreen.toFixed(2)}, B=${avgBlue.toFixed(2)}`); // Comentado para evitar spam sin consola

    // Detect high light condition (potential flash)
    this.isHighLightCondition = avgRed > 200 && avgGreen > 180 && avgBlue > 150; // Heurística: valores altos en todos los canales

    // Actualizar historiales
    this.rawRedHistory.push(avgRed);
    if (this.rawRedHistory.length > 120) this.rawRedHistory.shift();
    // Calcular umbrales adaptativos cada 10 frames
    if (this.frameCount % 10 === 0 && this.rawRedHistory.length > 30) {
      const sortedRed = [...this.rawRedHistory].sort((a, b) => a - b);
      this.adaptiveRedMin = Math.max(10, sortedRed[Math.floor(sortedRed.length * 0.05)] - 5);
      this.adaptiveRedMax = Math.min(255, sortedRed[Math.floor(sortedRed.length * 0.95)] + 5);
      // Ratios RG/RB adaptativos
      const rgRatios = this.rawRedHistory.map((r, i) => {
        const g = avgGreen; // Aproximación rápida
        return g > 0 ? r / g : 0;
      });
      const rbRatios = this.rawRedHistory.map((r, i) => {
        const b = avgBlue; // Aproximación rápida
        return b > 0 ? r / b : 0;
      });
      rgRatios.sort((a, b) => a - b);
      rbRatios.sort((a, b) => a - b);
      this.adaptiveRgRatioMin = Math.max(0.6, rgRatios[Math.floor(rgRatios.length * 0.05)] - 0.05);
      this.adaptiveRbRatioMin = Math.max(0.6, rbRatios[Math.floor(rbRatios.length * 0.05)] - 0.05);
    }

    // Use the metrics calculation from the original code, passing extracted values
    const metrics = this.calculateMetricsInternal(avgRed, avgGreen, avgBlue, imageData, 0, {
      adaptiveRedMin: this.adaptiveRedMin,
      adaptiveRedMax: this.adaptiveRedMax,
      adaptiveRgRatioMin: this.adaptiveRgRatioMin,
      adaptiveRbRatioMin: this.adaptiveRbRatioMin,
    });
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Metrics:`, metrics); // Comentado

    // Use the spectral analysis
    const spectralAnalysis = this.analyzeHumanSkinSpectrum(metrics);
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Spectral Analysis:`, spectralAnalysis); // Comentado

    // Use the false positive detection
    const falsePositiveCheck = this.detectExtremeFalsePositives(metrics);
    // console.log(`[FingerDetector] Frame ${this.frameCount} - False Positive Check:`, falsePositiveCheck); // Comentado

    // Use the temporal validation
    const temporalValidation = this.validateTemporal(metrics, spectralAnalysis); // Pass spectralAnalysis if needed by validateTemporal
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Temporal Validation:`, temporalValidation); // Comentado

    // Make final decision
    const decision = this.makeFinalDecision(spectralAnalysis, falsePositiveCheck, temporalValidation, metrics); // Pasar 'metrics' como parámetro
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Final Decision Inputs:`, { spectralAnalysis, falsePositiveCheck, temporalValidation }); // Comentado
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Raw Decision:`, decision); // Comentado

    // Calculate quality (update this to use decision.isFinger if that's the structure)
    const { finalQuality, rawQuality } = this.calculateIntegratedQuality(decision.isFinger, metrics, temporalValidation.stability, temporalValidation.pulsatilityScore); // Assuming these scores are returned by validateTemporal
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Quality: final=${finalQuality.toFixed(2)}, raw=${rawQuality.toFixed(2)}`); // Comentado

    // Log the final result before returning
    // this.logDetectionResult(decision, metrics, finalQuality); // Comentado/modificado en la edición anterior

    this.frameCount++;
    this.lastRawRedEMA = (this.config.EMA_ALPHA_RAW * avgRed) + (1 - this.config.EMA_ALPHA_RAW) * this.lastRawRedEMA;
    this.smoothedConfidence = (this.config.CONFIDENCE_EMA_ALPHA * decision.confidence) + (1 - this.config.CONFIDENCE_EMA_ALPHA) * this.smoothedConfidence;

    // Based on your existing code structure, the result includes rawValue, filteredValue etc.
    // You might need to pass more data through the pipeline.
    // For now, let's construct a result based on the calculated values.
    return {
      isHumanFinger: decision.isFinger,
      confidence: this.smoothedConfidence, // Use smoothed confidence
      quality: finalQuality,
      rawValue: avgRed, // Or the value passed through FrameProcessor
      filteredValue: this.lastRawRedEMA, // Simple EMA as a placeholder for filtered value
      timestamp: timestamp,
      debugInfo: {
        avgRed: metrics.redIntensity,
        avgGreen: metrics.greenIntensity,
        avgBlue: metrics.blueIntensity,
        rgRatio: metrics.rgRatio,
        rbRatio: metrics.rbRatio,
        redDominanceScore: spectralAnalysis?.redDominanceScore || 0, // Use scores from analysis
        pulsatilityScore: temporalValidation?.pulsatilityScore || 0,
        stabilityScore: temporalValidation?.stability || 0, // Assuming validateTemporal returns stability score
        rejectionReasons: decision.rejectionReasons,
        acceptanceReasons: decision.acceptanceReasons,
        dbgSpectralConfidence: spectralAnalysis?.confidence,
        dbgRawQuality: rawQuality,
        // Add other debug info as needed
      },
    };
  }

  private calculateMetricsInternal(avgRed: number, avgGreen: number, avgBlue: number, imageData: ImageData, perfusionIndex: number, adaptive?: any) {
    const rgRatio = (avgGreen > 0) ? avgRed / avgGreen : 0;
    const rbRatio = (avgBlue > 0) ? avgRed / avgBlue : 0;
    // Usar umbrales adaptativos si están presentes
    const redMin = adaptive?.adaptiveRedMin ?? this.config.MIN_RED_INTENSITY;
    const redMax = adaptive?.adaptiveRedMax ?? this.config.MAX_RED_INTENSITY;
    const rgMin = adaptive?.adaptiveRgRatioMin ?? this.config.MIN_RG_RATIO;
    const rbMin = adaptive?.adaptiveRbRatioMin ?? this.config.MIN_RB_RATIO;
    return {
      redIntensity: avgRed,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue,
      rgRatio: rgRatio,
      rbRatio: rbRatio,
      gbRatio: avgBlue > 5 ? avgGreen / avgBlue : 0,
      perfusionIndex: perfusionIndex,
      adaptiveRedMin: redMin,
      adaptiveRedMax: redMax,
      adaptiveRgRatioMin: rgMin,
      adaptiveRbRatioMin: rbMin,
    };
  }
  
  private analyzeHumanSkinSpectrum(metrics: any) {
    const reasons: string[] = [];
    let confidence = 0.0; 
    let criteriaMet = 0;
    let redDominanceScore = 0;
    // Usar umbrales adaptativos
    const minRed = metrics.adaptiveRedMin ?? this.config.MIN_RED_INTENSITY;
    const maxRed = metrics.adaptiveRedMax ?? this.config.MAX_RED_INTENSITY;
    const minRG = metrics.adaptiveRgRatioMin ?? this.config.MIN_RG_RATIO;
    const minRB = metrics.adaptiveRbRatioMin ?? this.config.MIN_RB_RATIO;
    if (metrics.redIntensity >= minRed && metrics.redIntensity <= maxRed) {
      confidence += 0.35; 
      reasons.push(`✓ RInt (${metrics.redIntensity.toFixed(0)})`);
      criteriaMet++;
    } else {
      reasons.push(`✗ RInt (${metrics.redIntensity.toFixed(0)})`);
      confidence -= 0.1;
    }
    
    if (metrics.rgRatio >= minRG && metrics.rbRatio >= minRB) {
      confidence += 0.35; 
      redDominanceScore = Math.min(1, ((metrics.rgRatio - minRG) + (metrics.rbRatio - minRB)) / 3.0);
      reasons.push(`✓ RDom (R/G:${metrics.rgRatio.toFixed(1)}, R/B:${metrics.rbRatio.toFixed(1)})`);
      criteriaMet++;
    } else {
      reasons.push(`✗ RDom (R/G:${metrics.rgRatio.toFixed(1)}, R/B:${metrics.rbRatio.toFixed(1)})`);
      confidence -= 0.15;
    }

    const isValidSpectrum = criteriaMet >= 2 && confidence >= 0.5; 
    
    // Add log here to see redDominanceScore
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Red Dominance Score: ${redDominanceScore.toFixed(2)}`); // Comentado

    // Añadir una pequeña tolerancia si estamos en alta luz para el criterio espectral
    const spectralTolerance = this.isHighLightCondition ? 0.1 : 0; // Ajuste menor para alta luz
    const isDominantlyRed = redDominanceScore > (0.3 - spectralTolerance); // Ajuste umbral de dominancia
    const isRGOK = metrics.rgRatio > (minRG - spectralTolerance);
    const isRBOk = metrics.rbRatio > (minRB - spectralTolerance);

    let criteriaMet = 0;
    if (isDominantlyRed) criteriaMet++
    if (isRGOK) criteriaMet++
    if (isRBOk) criteriaMet++

    // Relajar umbral de cuántos criterios deben cumplirse en alta luz
    const minCriteriaNeeded = this.isHighLightCondition ? 2 : 3; // 2/3 en alta luz, 3/3 en condiciones normales

    const isValidSpectrum = criteriaMet >= minCriteriaNeeded; // Usar umbral ajustado

    // Simplificar el cálculo de confianza espectral en alta luz si es necesario
    const confidence = isValidSpectrum ? (criteriaMet / 3) : 0; // Podría ser más sofisticado

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
    // Validar pulsatilidad con autocorrelación si hay suficiente historial
    if (this.filteredRedHistory.length >= this.config.HISTORY_SIZE_SHORT && metrics.redIntensity > this.config.MIN_RED_INTENSITY) {
      const recentHistory = this.filteredRedHistory.slice(-this.config.HISTORY_SIZE_SHORT);
      // Calcular autocorrelación para detectar periodicidad
      let mean = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
      let autocorr = 0;
      for (let lag = 1; lag < Math.floor(recentHistory.length / 2); lag++) {
        let sum = 0;
        for (let i = 0; i < recentHistory.length - lag; i++) {
          sum += (recentHistory[i] - mean) * (recentHistory[i + lag] - mean);
        }
        autocorr = Math.max(autocorr, sum / (recentHistory.length - lag));
      }
      // Normalizar autocorrelación
      const stdDev = Math.sqrt(recentHistory.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / recentHistory.length);
      const normAutocorr = stdDev > 0 ? autocorr / (stdDev * stdDev) : 0;
      pulsatilityScore = Math.min(1, (stdDev / this.config.PULSABILITY_STD_THRESHOLD) * 1.5) * normAutocorr;
      meetsPulsatility = stdDev >= this.config.PULSABILITY_STD_THRESHOLD && normAutocorr > 0.3;
      reasons.push(`Pulsabilidad: std=${stdDev.toFixed(3)}, autocorr=${normAutocorr.toFixed(2)} (Umbral: ${this.config.PULSABILITY_STD_THRESHOLD})`);
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

    // Add log here to see raw pulsatility and stability scores before thresholds
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Raw Temporal Scores: Pulsatility=${pulsatilityScore.toFixed(2)}, Stability=${stability.toFixed(2)}`); // Comentado
    // Add log here to see boolean results and reasons
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Temporal Validation Results: Meets Pulsatility=${meetsPulsatility}, Meets Stability=${meetsStability}, Reasons: ${reasons.join(', ')}`); // Comentado
    return {
      pulsatilityScore: pulsatilityScore,
      stability: stability,
      reasons,
      meetsPulsatility,
      meetsStability
    };
  }
  
  private makeFinalDecision(spectralAnalysis: any, falsePositiveCheck: any, temporalValidation: any, metrics: any) {
    let isFinger = false;
    const rejectionReasons: string[] = [];
    const acceptanceReasons: string[] = [];
    let confidence = 0;

    // Evaluar criterios ajustados para alta luz si es necesario
    const isSpectralOk = spectralAnalysis?.isValidSpectrum || false; // Usar el resultado de isValidSpectrum calculado en analyzeHumanSkinSpectrum
    const isTemporalOk = temporalValidation.meetsPulsatility && temporalValidation.meetsStability; // Usar los resultados booleanos ajustados
    const isFalsePositive = falsePositiveCheck.isFalsePositive;

    // Lógica de decisión: Priorizar criterios espectrales y temporales en condiciones de alta luz
    if (!isFalsePositive && isTemporalOk && isSpectralOk) {
        // Condición ideal: Pasa todas las pruebas clave (espectral, temporal) y no es falso positivo
        isFinger = true;
        acceptanceReasons.push('Passed spectral and temporal checks');
        confidence = (spectralAnalysis.confidence + temporalValidation.pulsatilityScore/100 + (1-temporalValidation.stability/100))/3; // Combinar confianzas, ajustar según escala
    } else if (!isFalsePositive && isTemporalOk && (spectralAnalysis?.redDominanceScore > 0.2 || metrics.rgRatio > 1.5)) { // Criterio alternativo menos estricto
        // Condición menos estricta: Pasa temporal, no es falso positivo, y al menos muestra cierta dominancia de rojo o RG ratio alto
        isFinger = true;
        acceptanceReasons.push('Passed temporal with acceptable spectral indicators');
        confidence = (temporalValidation.pulsatilityScore/100 + (1-temporalValidation.stability/100) + 0.2)/3; // Confianza un poco menor
    } else if (!isFalsePositive && isSpectralOk && temporalValidation.meetsPulsatility) { // Otra alternativa
        // Pasa espectral y pulsatilidad, pero no estabilidad (podría ser movimiento?) - considerar como dedo con menor confianza
        isFinger = true;
        acceptanceReasons.push('Passed spectral and pulsatility');
        confidence = (spectralAnalysis.confidence + temporalValidation.pulsatilityScore/100 + 0.1)/3; // Confianza intermedia
    } else if (!isFalsePositive && (metrics.redIntensity > (this.isHighLightCondition ? 180 : this.config.MIN_RED_INTENSITY)) && (metrics.rgRatio > (this.isHighLightCondition ? 1.8 : this.config.MIN_RG_RATIO))) {
         // Criterio de respaldo para alta luz: si no es falso positivo y la intensidad roja y el RG ratio son altos
         isFinger = true;
         acceptanceReasons.push('Passed high-light backup check');
         confidence = 0.4; // Confianza baja en este caso
    }

    // Si no se detecta, registrar razones de rechazo
    if (!isFinger) {
        if (!isSpectralOk) rejectionReasons.push('Failed spectral skin check');
        if (!temporalValidation.meetsPulsatility) rejectionReasons.push('Failed pulsatility check');
        if (!temporalValidation.meetsStability && temporalValidation.meetsPulsatility) rejectionReasons.push('Failed stability check despite pulsatility');
        if (isFalsePositive) rejectionReasons.push(`Detected as extreme false positive (${falsePositiveCheck.reason})`);
        // Añadir otras posibles razones de fallo si se implementan más criterios
        // Si falló la condición de respaldo de alta luz
        if (!isSpectralOk && !isTemporalOk && !isFalsePositive && this.isHighLightCondition) {
             if (metrics.redIntensity <= (this.isHighLightCondition ? 180 : this.config.MIN_RED_INTENSITY)) rejectionReasons.push('Red intensity too low for high light');
             if (metrics.rgRatio <= (this.isHighLightCondition ? 1.8 : this.config.MIN_RG_RATIO)) rejectionReasons.push('RG ratio too low for high light');
        }
    }

    // Asegurar que la confianza esté entre 0 y 1
    confidence = Math.max(0, Math.min(1, confidence));

    // console.log(`[FingerDetector] Frame ${this.frameCount} - Decision Factors: Spectral OK=${isSpectralOk}, False Positive=${isFalsePositive}, Temporal OK=${isTemporalOk}, Combined Score=${confidence.toFixed(2)}`); // Comentado
    // console.log(`[FingerDetector] Frame ${this.frameCount} - Decision Result: Is Finger=${isFinger}, Confidence=${confidence.toFixed(2)}, Rejections: ${rejectionReasons.join(', ')}, Acceptances: ${acceptanceReasons.join(', ')}`); // Comentado

    return {
      isFinger,
      confidence,
      rejectionReasons,
      acceptanceReasons,
      // Add other relevant decision metrics here if needed for debugging
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

    // console.log(`[HFD] Calculated Quality - Raw: ${rawQuality.toFixed(2)}, Final: ${finalQuality.toFixed(2)}`); // Comentado
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

  private logDetectionResult(decision: any, metrics: any, quality: number): void {
    // Remove or comment out the existing log inside this function to avoid redundancy with new logs
    // console.log(...);
  }
}

let pulsatilityScoreParamForLog = 0;
let stabilityScoreParamForLog = 0;
