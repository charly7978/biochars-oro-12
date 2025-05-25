/**
 * Advanced Arrhythmia Processor con reducción de falsos positivos
 * Basado en investigación médica peer-reviewed con validación estricta
 */
export class ArrhythmiaProcessor {
  // Configuración más estricta basada en estándares médicos
  private readonly RR_WINDOW_SIZE = 15; // Ventana más grande para mejor análisis
  private readonly RMSSD_THRESHOLD = 60; // Umbral más alto y conservador
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 8000; // Período de aprendizaje extendido
  private readonly SD1_THRESHOLD = 45; // Umbral Poincaré más conservador
  private readonly PERFUSION_INDEX_MIN = 0.4; // PI mínimo más alto
  
  // Parámetros de detección más estrictos
  private readonly PNNX_THRESHOLD = 0.35; // pNN50 más conservador
  private readonly SHANNON_ENTROPY_THRESHOLD = 2.2; // Entropía más alta
  private readonly SAMPLE_ENTROPY_THRESHOLD = 1.8; // Entropía de muestra más alta
  
  // Control de falsos positivos
  private readonly MIN_ARRHYTHMIA_INTERVAL = 3000; // 3 segundos mínimo entre arritmias
  private readonly MAX_ARRHYTHMIAS_PER_MINUTE = 3; // Máximo 3 arritmias por minuto
  private readonly MIN_SIGNAL_QUALITY = 0.7; // Calidad mínima de señal requerida
  
  // Validación de consistencia
  private readonly CONSISTENCY_WINDOW = 5; // Ventana para validar consistencia
  private readonly MIN_CONSISTENT_DETECTIONS = 3; // Detecciones consistentes requeridas

  // State variables
  private rrIntervals: number[] = [];
  private rrDifferences: number[] = [];
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
  private potentialArrhythmias: Array<{timestamp: number, confidence: number}> = [];
  
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
    console.log("ArrhythmiaProcessor: Callback de detección establecido con validación estricta");
  }

  /**
   * Procesa datos RR con validación médica estricta y reducción de falsos positivos
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();

    // Actualizar intervalos RR con validación estricta
    if (rrData?.intervals && rrData.intervals.length > 0) {
      // Filtrar intervalos fisiológicamente válidos (más estricto)
      const validIntervals = rrData.intervals.filter(interval => 
        interval >= 400 && interval <= 2000 // Rango más estricto
      );
      
      if (validIntervals.length < rrData.intervals.length * 0.8) {
        console.log("ArrhythmiaProcessor: Demasiados intervalos inválidos, ignorando frame");
        return this.getCurrentStatus(currentTime);
      }
      
      this.rrIntervals = validIntervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Calcular diferencias RR
      if (this.rrIntervals.length >= 2) {
        this.rrDifferences = [];
        for (let i = 1; i < this.rrIntervals.length; i++) {
          this.rrDifferences.push(this.rrIntervals[i] - this.rrIntervals[i-1]);
        }
      }
      
      // Solo procesar si hay suficientes datos y no estamos en fase de aprendizaje
      if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
        this.detectArrhythmiaWithValidation();
      }
    }

    // Verificar si la fase de aprendizaje está completa
    const timeSinceStart = currentTime - this.measurementStartTime;
    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
    }

    return this.getCurrentStatus(currentTime);
  }

  /**
   * Detección de arritmias con validación médica múltiple y reducción de falsos positivos
   */
  private detectArrhythmiaWithValidation(): void {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) return;

    const currentTime = Date.now();
    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // 1. Validación de calidad de señal
    const avgQuality = this.qualityHistory.length > 0 ? 
      this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length : 0;
    
    if (avgQuality < this.MIN_SIGNAL_QUALITY) {
      console.log("ArrhythmiaProcessor: Calidad de señal insuficiente", { avgQuality });
      return;
    }
    
    // 2. Cálculo de métricas con validación estricta
    const metrics = this.calculateAdvancedMetrics(recentRR);
    if (!metrics) return;
    
    const { rmssd, rrVariation, coefficientOfVariation } = metrics;
    
    // 3. Algoritmo de detección multi-paramétrico más estricto
    const arrhythmiaScore = this.calculateArrhythmiaScore(metrics);
    
    // 4. Validación temporal para evitar falsos positivos
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectArrhythmia = timeSinceLastArrhythmia >= this.MIN_ARRHYTHMIA_INTERVAL;
    
    // 5. Validación de frecuencia (no más de X arritmias por minuto)
    const recentArrhythmias = this.arrhythmiaTimestamps.filter(
      timestamp => currentTime - timestamp < 60000
    );
    const tooManyArrhythmias = recentArrhythmias.length >= this.MAX_ARRHYTHMIAS_PER_MINUTE;
    
    console.log("ArrhythmiaProcessor: Análisis de validación", {
      arrhythmiaScore,
      canDetectArrhythmia,
      tooManyArrhythmias,
      recentArrhythmias: recentArrhythmias.length,
      timeSinceLastArrhythmia,
      rmssd,
      rrVariation,
      coefficientOfVariation
    });
    
    // 6. Decisión final con múltiples validaciones
    const shouldDetectArrhythmia = 
      arrhythmiaScore >= 0.8 && // Score alto requerido
      canDetectArrhythmia && 
      !tooManyArrhythmias &&
      this.validateConsistency(metrics);
    
    if (shouldDetectArrhythmia) {
      this.confirmArrhythmia(currentTime, metrics);
    } else {
      this.consecutiveNormalBeats++;
      
      // Si hay muchos latidos normales consecutivos, resetear estado
      if (this.consecutiveNormalBeats >= 20) {
        this.arrhythmiaDetected = false;
      }
    }
  }
  
  /**
   * Calcular métricas avanzadas con validación
   */
  private calculateAdvancedMetrics(intervals: number[]): {
    rmssd: number;
    rrVariation: number;
    coefficientOfVariation: number;
  } | null {
    // Validar que tenemos suficientes intervalos válidos
    const validIntervals = intervals.filter(rr => rr >= 500 && rr <= 1500);
    if (validIntervals.length < this.RR_WINDOW_SIZE * 0.8) {
      return null;
    }
    
    // Calcular RMSSD con validación estricta
    let sumSquaredDiff = 0;
    let validDifferences = 0;
    
    for (let i = 1; i < validIntervals.length; i++) {
      const diff = validIntervals[i] - validIntervals[i-1];
      // Solo incluir diferencias fisiológicamente plausibles
      if (Math.abs(diff) <= 200) {
        sumSquaredDiff += diff * diff;
        validDifferences++;
      }
    }
    
    if (validDifferences < 3) return null;
    
    const rmssd = Math.sqrt(sumSquaredDiff / validDifferences);
    
    // Calcular otras métricas
    const avgRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
    const lastRR = validIntervals[validIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    const rrSD = Math.sqrt(
      validIntervals.reduce((sum, val) => sum + Math.pow(val - avgRR, 2), 0) / validIntervals.length
    );
    const coefficientOfVariation = rrSD / avgRR;
    
    // Calcular métricas no lineales
    this.calculateNonLinearMetrics(validIntervals);
    
    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    return { rmssd, rrVariation, coefficientOfVariation };
  }
  
  /**
   * Calcular score de arritmia con múltiples criterios
   */
  private calculateArrhythmiaScore(metrics: {
    rmssd: number;
    rrVariation: number;
    coefficientOfVariation: number;
  }): number {
    const { rmssd, rrVariation, coefficientOfVariation } = metrics;
    
    let score = 0;
    
    // Criterio 1: RMSSD elevado (peso 0.3)
    if (rmssd > this.RMSSD_THRESHOLD) {
      score += 0.3 * Math.min(1, rmssd / (this.RMSSD_THRESHOLD * 2));
    }
    
    // Criterio 2: Variación RR alta (peso 0.25)
    if (rrVariation > 0.25) {
      score += 0.25 * Math.min(1, rrVariation / 0.5);
    }
    
    // Criterio 3: Coeficiente de variación alto (peso 0.2)
    if (coefficientOfVariation > 0.2) {
      score += 0.2 * Math.min(1, coefficientOfVariation / 0.4);
    }
    
    // Criterio 4: Entropía Shannon alta (peso 0.15)
    if (this.shannonEntropy > this.SHANNON_ENTROPY_THRESHOLD) {
      score += 0.15 * Math.min(1, this.shannonEntropy / (this.SHANNON_ENTROPY_THRESHOLD * 1.5));
    }
    
    // Criterio 5: pNN50 alto (peso 0.1)
    if (this.pnnX > this.PNNX_THRESHOLD) {
      score += 0.1 * Math.min(1, this.pnnX / (this.PNNX_THRESHOLD * 2));
    }
    
    return score;
  }
  
  /**
   * Validar consistencia de la detección
   */
  private validateConsistency(metrics: any): boolean {
    // Agregar a la lista de potenciales arritmias
    this.potentialArrhythmias.push({
      timestamp: Date.now(),
      confidence: this.calculateArrhythmiaScore(metrics)
    });
    
    // Mantener solo las últimas detecciones
    if (this.potentialArrhythmias.length > this.CONSISTENCY_WINDOW) {
      this.potentialArrhythmias.shift();
    }
    
    // Verificar que tenemos suficientes detecciones consistentes
    const recentHighConfidence = this.potentialArrhythmias.filter(
      p => p.confidence >= 0.7
    ).length;
    
    return recentHighConfidence >= this.MIN_CONSISTENT_DETECTIONS;
  }
  
  /**
   * Confirmar arritmia después de todas las validaciones
   */
  private confirmArrhythmia(currentTime: number, metrics: any): void {
    this.arrhythmiaCount++;
    this.lastArrhythmiaTime = currentTime;
    this.consecutiveNormalBeats = 0;
    this.hasDetectedFirstArrhythmia = true;
    this.arrhythmiaDetected = true;
    
    // Agregar timestamp para control de frecuencia
    this.arrhythmiaTimestamps.push(currentTime);
    
    // Limpiar timestamps antiguos (más de 1 minuto)
    this.arrhythmiaTimestamps = this.arrhythmiaTimestamps.filter(
      timestamp => currentTime - timestamp < 60000
    );
    
    // Notificar cambio de estado
    if (this.onArrhythmiaDetection) {
      this.onArrhythmiaDetection(true);
    }
    
    console.log('ArrhythmiaProcessor - Arritmia CONFIRMADA tras validación estricta:', {
      contador: this.arrhythmiaCount,
      rmssd: this.lastRMSSD,
      rrVariation: this.lastRRVariation,
      shannonEntropy: this.shannonEntropy,
      pnnX: this.pnnX,
      timestamp: currentTime,
      arrhythmiasInLastMinute: this.arrhythmiaTimestamps.length
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
    this.rrDifferences = [];
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
    
    if (this.onArrhythmiaDetection) {
      this.onArrhythmiaDetection(false);
    }
  }
}
