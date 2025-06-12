/**
 * Procesador de Arritmias Ultra-Conservador con eliminación agresiva de falsos positivos
 * Implementa múltiples capas de validación médica estricta
 */
export class ArrhythmiaProcessor {
  // Configuración ultra-conservadora
  private readonly RR_WINDOW_SIZE = 20; // Ventana más grande para análisis robusto
  private readonly RMSSD_THRESHOLD = 80; // Umbral muy alto y conservador
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 6000; // Período de aprendizaje muy extendido
  private readonly SD1_THRESHOLD = 60; // Umbral Poincaré muy conservador
  private readonly PERFUSION_INDEX_MIN = 0.6; // PI mínimo muy alto
  
  // Parámetros ultra-estrictos
  private readonly PNNX_THRESHOLD = 0.5; // pNN50 muy conservador
  private readonly SHANNON_ENTROPY_THRESHOLD = 2.8; // Entropía muy alta
  private readonly SAMPLE_ENTROPY_THRESHOLD = 2.2; // Entropía de muestra muy alta
  
  // Control agresivo de falsos positivos
  private readonly MIN_ARRHYTHMIA_INTERVAL = 8000; // 8 segundos mínimo entre arritmias
  private readonly MAX_ARRHYTHMIAS_PER_MINUTE = 2; // Máximo 1 arritmia por minuto
  private readonly MIN_SIGNAL_QUALITY = 0.8; // Calidad mínima muy alta
  
  // Validación ultra-estricta
  private readonly CONSISTENCY_WINDOW = 8; // Ventana más grande
  private readonly MIN_CONSISTENT_DETECTIONS = 6; // Más detecciones consistentes
  private readonly MIN_VALID_RR_INTERVALS = 15; // Mínimo de intervalos válidos
  private readonly MAX_RR_VARIATION_THRESHOLD = 0.3; // Máxima variación permitida

  // State variables
  private rrIntervals: number[] = [];
  private qualityHistory: number[] = [];
  private lastPeakTime: number | null = null;
  private isLearningPhase = true;
  private hasDetectedFirstArrhythmia = false;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastRMSSD: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaTime: number = 0;
  private measurementStartTime: number = Date.now();
  private arrhythmiaTimestamps: number[] = [];
  private consecutiveNormalBeats = 0;
  private potentialArrhythmias: Array<{timestamp: number, confidence: number, metrics: any}> = [];
  
  // Nuevas validaciones ultra-estrictas
  private baselineRRMean: number = 0;
  private baselineRRSD: number = 0;
  private rrStabilityHistory: number[] = [];
  private falsePositivePreventionScore = 0;

  // Advanced metrics
  private shannonEntropy: number = 0;
  private sampleEntropy: number = 0;
  private pnnX: number = 0;

  // Callback para notificar estados de arritmia
  private onArrhythmiaDetection?: (isDetected: boolean) => void;

  /**
   * Define una función de callback para notificar cuando se detecta una arritmia
   */
  public setArrhythmiaDetectionCallback(callback: (isDetected: boolean) => void): void {
    this.onArrhythmiaDetection = callback;
    console.log("ArrhythmiaProcessor: Callback ultra-conservador establecido");
  }

  /**
   * Procesamiento ultra-conservador con múltiples capas de validación
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();

    // Actualizar intervalos RR con validación ultra-estricta
    if (rrData?.intervals && rrData.intervals.length > 0) {
      // Filtrar intervalos con criterios ultra-estrictos
      const ultraValidIntervals = rrData.intervals.filter(interval => 
        interval >= 500 && interval <= 1500 && // Rango más estricto
        this.isPhysiologicallyPlausible(interval)
      );
      
      if (ultraValidIntervals.length < rrData.intervals.length * 0.9) {
        console.log("ArrhythmiaProcessor: Demasiados intervalos inválidos, rechazando frame");
        return this.getCurrentStatus(currentTime);
      }
      
      this.rrIntervals = ultraValidIntervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Establecer baseline una sola vez con datos muy robustos
      if (this.baselineRRMean === 0 && this.rrIntervals.length >= this.MIN_VALID_RR_INTERVALS) {
        this.establishUltraStrictBaseline();
      }
      
      // Solo procesar después del período de aprendizaje extendido y con baseline
      if (!this.isLearningPhase && 
          this.rrIntervals.length >= this.RR_WINDOW_SIZE && 
          this.baselineRRMean > 0) {
        this.detectArrhythmiaUltraConservative();
      }
    }

    // Verificar fase de aprendizaje extendida
    const timeSinceStart = currentTime - this.measurementStartTime;
    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD && this.baselineRRMean > 0) {
      this.isLearningPhase = false;
    }

    return this.getCurrentStatus(currentTime);
  }

  /**
   * Establecer baseline ultra-estricto
   */
  private establishUltraStrictBaseline(): void {
    if (this.rrIntervals.length < this.MIN_VALID_RR_INTERVALS) return;
    
    // Usar solo los intervalos más estables para el baseline
    const sortedIntervals = [...this.rrIntervals].sort((a, b) => a - b);
    const trimCount = Math.floor(sortedIntervals.length * 0.2); // Eliminar 20% extremos
    const stableIntervals = sortedIntervals.slice(trimCount, sortedIntervals.length - trimCount);
    
    this.baselineRRMean = stableIntervals.reduce((a, b) => a + b, 0) / stableIntervals.length;
    
    const variance = stableIntervals.reduce((acc, val) => 
      acc + Math.pow(val - this.baselineRRMean, 2), 0) / stableIntervals.length;
    this.baselineRRSD = Math.sqrt(variance);
    
    console.log("ArrhythmiaProcessor: Baseline ultra-estricto establecido", {
      media: this.baselineRRMean.toFixed(1),
      desviacion: this.baselineRRSD.toFixed(1),
      intervalos: stableIntervals.length
    });
  }

  /**
   * Verificar si un intervalo RR es fisiológicamente plausible
   */
  private isPhysiologicallyPlausible(interval: number): boolean {
    // Verificar que está en rango de frecuencias cardíacas normales (40-150 BPM)
    const bpm = 60000 / interval;
    return bpm >= 40 && bpm <= 150;
  }

  /**
   * Detección ultra-conservadora con múltiples validaciones
   */
  private detectArrhythmiaUltraConservative(): void {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) return;

    const currentTime = Date.now();
    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // 1. Validación de calidad ultra-estricta
    const avgQuality = this.qualityHistory.length > 0 ? 
      this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length : 0;
    
    if (avgQuality < this.MIN_SIGNAL_QUALITY) {
      console.log("ArrhythmiaProcessor: Calidad insuficiente para análisis", { avgQuality });
      return;
    }
    
    // 2. Validación de estabilidad del baseline
    if (!this.isBaselineStable(recentRR)) {
      console.log("ArrhythmiaProcessor: Baseline inestable, evitando falsos positivos");
      return;
    }
    
    // 3. Cálculo de métricas ultra-conservadoras
    const metrics = this.calculateUltraConservativeMetrics(recentRR);
    if (!metrics) return;
    
    const { rmssd, rrVariation, coefficientOfVariation } = metrics;
    
    // 4. Score ultra-conservador (requiere múltiples criterios simultáneos)
    const arrhythmiaScore = this.calculateUltraConservativeScore(metrics);
    
    // 5. Validaciones temporales ultra-estrictas
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectArrhythmia = timeSinceLastArrhythmia >= this.MIN_ARRHYTHMIA_INTERVAL;
    
    const recentArrhythmias = this.arrhythmiaTimestamps.filter(
      timestamp => currentTime - timestamp < 60000
    );
    const tooManyArrhythmias = recentArrhythmias.length >= this.MAX_ARRHYTHMIAS_PER_MINUTE;
    
    // 6. Validación de consistencia ultra-estricta
    const isConsistent = this.validateUltraStrictConsistency(metrics);
    
    console.log("ArrhythmiaProcessor: Análisis ultra-conservador", {
      arrhythmiaScore,
      umbralRequerido: 0.95,
      canDetectArrhythmia,
      tooManyArrhythmias,
      isConsistent,
      rmssd,
      umbralRMSSD: this.RMSSD_THRESHOLD
    });
    
    // 7. Decisión final ultra-estricta (requiere score muy alto y todas las validaciones)
    const shouldDetectArrhythmia = 
      arrhythmiaScore >= 0.95 && // Score ultra-alto requerido
      canDetectArrhythmia && 
      !tooManyArrhythmias &&
      isConsistent &&
      rmssd > this.RMSSD_THRESHOLD && // Doble verificación de RMSSD
      this.falsePositivePreventionScore < 0.3; // Score de prevención de falsos positivos
    
    if (shouldDetectArrhythmia) {
      this.confirmArrhythmiaUltraConservative(currentTime, metrics);
    } else {
      this.consecutiveNormalBeats++;
      
      // Resetear estado después de muchos latidos normales
      if (this.consecutiveNormalBeats >= 30) {
        this.arrhythmiaDetected = false;
        this.falsePositivePreventionScore = Math.max(0, this.falsePositivePreventionScore - 0.1);
      }
    }
  }

  /**
   * Verificar estabilidad del baseline para evitar falsos positivos
   */
  private isBaselineStable(intervals: number[]): boolean {
    const avgRR = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const baselineDeviation = Math.abs(avgRR - this.baselineRRMean) / this.baselineRRMean;
    
    // Si nos alejamos mucho del baseline, el contexto cambió
    if (baselineDeviation > 0.2) {
      return false;
    }
    
    // Verificar estabilidad reciente
    this.rrStabilityHistory.push(baselineDeviation);
    if (this.rrStabilityHistory.length > 10) {
      this.rrStabilityHistory.shift();
    }
    
    const avgStability = this.rrStabilityHistory.reduce((a, b) => a + b, 0) / 
                        this.rrStabilityHistory.length;
    
    return avgStability < 0.15; // Muy estable
  }

  /**
   * Calcular métricas ultra-conservadoras
   */
  private calculateUltraConservativeMetrics(intervals: number[]): {
    rmssd: number;
    rrVariation: number;
    coefficientOfVariation: number;
  } | null {
    // Validar intervalos ultra-estrictamente
    const ultraValidIntervals = intervals.filter(rr => 
      rr >= 600 && rr <= 1200 && // Rango ultra-estricto
      Math.abs(rr - this.baselineRRMean) / this.baselineRRMean < 0.4 // No muy lejos del baseline
    );
    
    if (ultraValidIntervals.length < this.RR_WINDOW_SIZE * 0.9) {
      return null;
    }
    
    // Calcular RMSSD ultra-conservador
    let sumSquaredDiff = 0;
    let validDifferences = 0;
    
    for (let i = 1; i < ultraValidIntervals.length; i++) {
      const diff = ultraValidIntervals[i] - ultraValidIntervals[i-1];
      // Solo diferencias fisiológicamente muy plausibles
      if (Math.abs(diff) <= 150) {
        sumSquaredDiff += diff * diff;
        validDifferences++;
      }
    }
    
    if (validDifferences < 5) return null;
    
    const rmssd = Math.sqrt(sumSquaredDiff / validDifferences);
    
    // Otras métricas
    const avgRR = ultraValidIntervals.reduce((a, b) => a + b, 0) / ultraValidIntervals.length;
    const lastRR = ultraValidIntervals[ultraValidIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    const rrSD = Math.sqrt(
      ultraValidIntervals.reduce((sum, val) => sum + Math.pow(val - avgRR, 2), 0) / 
      ultraValidIntervals.length
    );
    const coefficientOfVariation = rrSD / avgRR;
    
    this.calculateNonLinearMetrics(ultraValidIntervals);
    
    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    return { rmssd, rrVariation, coefficientOfVariation };
  }

  /**
   * Score ultra-conservador que requiere múltiples criterios simultáneos
   */
  private calculateUltraConservativeScore(metrics: {
    rmssd: number;
    rrVariation: number;
    coefficientOfVariation: number;
  }): number {
    const { rmssd, rrVariation, coefficientOfVariation } = metrics;
    
    let score = 0;
    let criteriaCount = 0;
    
    // Todos los criterios deben ser muy altos para sumar
    if (rmssd > this.RMSSD_THRESHOLD) {
      score += 0.4;
      criteriaCount++;
    }
    
    if (rrVariation > 0.3) {
      score += 0.3;
      criteriaCount++;
    }
    
    if (coefficientOfVariation > 0.25) {
      score += 0.2;
      criteriaCount++;
    }
    
    if (this.shannonEntropy > this.SHANNON_ENTROPY_THRESHOLD) {
      score += 0.1;
      criteriaCount++;
    }
    
    // Requiere al menos 3 criterios simultáneos para considerar arritmia
    if (criteriaCount < 3) {
      score = 0;
    }
    
    return score;
  }

  /**
   * Validación ultra-estricta de consistencia
   */
  private validateUltraStrictConsistency(metrics: any): boolean {
    this.potentialArrhythmias.push({
      timestamp: Date.now(),
      confidence: this.calculateUltraConservativeScore(metrics),
      metrics
    });
    
    if (this.potentialArrhythmias.length > this.CONSISTENCY_WINDOW) {
      this.potentialArrhythmias.shift();
    }
    
    // Requiere muchas detecciones ultra-consistentes
    const ultraHighConfidence = this.potentialArrhythmias.filter(
      p => p.confidence >= 0.9
    ).length;
    
    return ultraHighConfidence >= this.MIN_CONSISTENT_DETECTIONS;
  }

  /**
   * Confirmar arritmia con todas las validaciones ultra-conservadoras
   */
  private confirmArrhythmiaUltraConservative(currentTime: number, metrics: any): void {
    this.arrhythmiaCount++;
    this.lastArrhythmiaTime = currentTime;
    this.consecutiveNormalBeats = 0;
    this.hasDetectedFirstArrhythmia = true;
    this.arrhythmiaDetected = true;
    
    // Incrementar score de prevención para reducir futuras detecciones
    this.falsePositivePreventionScore = Math.min(1.0, this.falsePositivePreventionScore + 0.5);
    
    this.arrhythmiaTimestamps.push(currentTime);
    this.arrhythmiaTimestamps = this.arrhythmiaTimestamps.filter(
      timestamp => currentTime - timestamp < 60000
    );
    
    if (this.onArrhythmiaDetection) {
      this.onArrhythmiaDetection(true);
    }
    
    console.log('ArrhythmiaProcessor - Arritmia ULTRA-CONFIRMADA:', {
      contador: this.arrhythmiaCount,
      rmssd: this.lastRMSSD,
      rrVariation: this.lastRRVariation,
      shannonEntropy: this.shannonEntropy,
      preventionScore: this.falsePositivePreventionScore,
      timestamp: currentTime
    });
  }

  /**
   * Obtener estado actual
   */
  private getCurrentStatus(currentTime: number): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    let arrhythmiaStatus;
    if (this.isLearningPhase) {
      arrhythmiaStatus = "CALIBRANDO...";
    } else if (this.hasDetectedFirstArrhythmia) {
      arrhythmiaStatus = `ARRITMIA DETECTADA|${this.arrhythmiaCount}`;
    } else {
      arrhythmiaStatus = `SIN ARRITMIAS|${this.arrhythmiaCount}`;
    }

    const lastArrhythmiaData = this.arrhythmiaDetected ? {
      timestamp: currentTime,
      rmssd: this.lastRMSSD,
      rrVariation: this.lastRRVariation
    } : null;

    return { arrhythmiaStatus, lastArrhythmiaData };
  }

  // ... keep existing code (calculateNonLinearMetrics, calculateShannonEntropy, estimateSampleEntropy methods)

  private calculateNonLinearMetrics(rrIntervals: number[]): void {
    let countAboveThreshold = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      if (Math.abs(rrIntervals[i] - rrIntervals[i-1]) > 50) {
        countAboveThreshold++;
      }
    }
    this.pnnX = countAboveThreshold / (rrIntervals.length - 1);
    
    this.calculateShannonEntropy(rrIntervals);
    this.sampleEntropy = this.estimateSampleEntropy(rrIntervals);
  }
  
  private calculateShannonEntropy(intervals: number[]): void {
    const bins: {[key: string]: number} = {};
    const binWidth = 25;
    
    intervals.forEach(interval => {
      const binKey = Math.floor(interval / binWidth);
      bins[binKey] = (bins[binKey] || 0) + 1;
    });
    
    let entropy = 0;
    const totalPoints = intervals.length;
    
    Object.values(bins).forEach(count => {
      const probability = count / totalPoints;
      entropy -= probability * Math.log2(probability);
    });
    
    this.shannonEntropy = entropy;
  }
  
  private estimateSampleEntropy(intervals: number[]): number {
    if (intervals.length < 4) return 0;
    
    const normalizedIntervals = intervals.map(interval => 
      (interval - intervals.reduce((a, b) => a + b, 0) / intervals.length) / 
      Math.max(1, Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b, 2), 0) / intervals.length))
    );
    
    let sumCorr = 0;
    for (let i = 0; i < normalizedIntervals.length - 1; i++) {
      sumCorr += Math.abs(normalizedIntervals[i + 1] - normalizedIntervals[i]);
    }
    
    return -Math.log(sumCorr / (normalizedIntervals.length - 1));
  }

  /**
   * Reset the arrhythmia processor state
   */
  public reset(): void {
    this.rrIntervals = [];
    this.qualityHistory = [];
    this.lastPeakTime = null;
    this.isLearningPhase = true;
    this.hasDetectedFirstArrhythmia = false;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaTimestamps = [];
    this.consecutiveNormalBeats = 0;
    this.potentialArrhythmias = [];
    this.shannonEntropy = 0;
    this.sampleEntropy = 0;
    this.pnnX = 0;
    this.baselineRRMean = 0;
    this.baselineRRSD = 0;
    this.rrStabilityHistory = [];
    this.falsePositivePreventionScore = 0;
    
    if (this.onArrhythmiaDetection) {
      this.onArrhythmiaDetection(false);
    }
  }
}
