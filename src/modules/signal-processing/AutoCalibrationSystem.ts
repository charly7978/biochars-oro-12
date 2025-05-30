
/**
 * Sistema de calibración automática médica para PPG
 */
export class AutoCalibrationSystem {
  private readonly CALIBRATION_PHASES = {
    BASELINE: 'baseline',
    FINGER_DETECTION: 'finger_detection',
    SIGNAL_OPTIMIZATION: 'signal_optimization',
    VALIDATION: 'validation',
    COMPLETE: 'complete'
  };
  
  private currentPhase: string = this.CALIBRATION_PHASES.BASELINE;
  private phaseStartTime: number = 0;
  private calibrationData: {
    baseline: { red: number; green: number; blue: number } | null;
    fingerThresholds: { min: number; max: number } | null;
    signalParams: { gain: number; offset: number } | null;
    validationResults: { accuracy: number; stability: number } | null;
  } = {
    baseline: null,
    fingerThresholds: null,
    signalParams: null,
    validationResults: null
  };
  
  private samples: {
    baseline: number[];
    fingerDetection: number[];
    signalQuality: number[];
  } = {
    baseline: [],
    fingerDetection: [],
    signalQuality: []
  };
  
  private readonly PHASE_DURATIONS = {
    [this.CALIBRATION_PHASES.BASELINE]: 3000,
    [this.CALIBRATION_PHASES.FINGER_DETECTION]: 5000,
    [this.CALIBRATION_PHASES.SIGNAL_OPTIMIZATION]: 4000,
    [this.CALIBRATION_PHASES.VALIDATION]: 3000
  };
  
  /**
   * Iniciar calibración automática
   */
  public startCalibration(): void {
    console.log("AutoCalibrationSystem: Iniciando calibración automática médica");
    this.currentPhase = this.CALIBRATION_PHASES.BASELINE;
    this.phaseStartTime = Date.now();
    this.resetData();
  }
  
  /**
   * Procesar muestra durante calibración
   */
  public processSample(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    quality: number;
    fingerDetected: boolean;
  }): {
    phase: string;
    progress: number;
    instructions: string;
    isComplete: boolean;
    results?: any;
  } {
    const currentTime = Date.now();
    const phaseElapsed = currentTime - this.phaseStartTime;
    const phaseDuration = this.PHASE_DURATIONS[this.currentPhase] || 5000;
    const progress = Math.min(100, (phaseElapsed / phaseDuration) * 100);
    
    let instructions = "";
    let shouldAdvance = false;
    
    switch (this.currentPhase) {
      case this.CALIBRATION_PHASES.BASELINE:
        instructions = "Mantenga la cámara sin contacto para establecer línea base";
        this.processBaselinePhase(frameData);
        shouldAdvance = phaseElapsed >= phaseDuration;
        break;
        
      case this.CALIBRATION_PHASES.FINGER_DETECTION:
        instructions = "Coloque su dedo sobre la cámara y manténgalo firme";
        this.processFingerDetectionPhase(frameData);
        shouldAdvance = phaseElapsed >= phaseDuration && frameData.fingerDetected;
        break;
        
      case this.CALIBRATION_PHASES.SIGNAL_OPTIMIZATION:
        instructions = "Mantenga el dedo quieto mientras optimizamos la señal";
        this.processSignalOptimizationPhase(frameData);
        shouldAdvance = phaseElapsed >= phaseDuration;
        break;
        
      case this.CALIBRATION_PHASES.VALIDATION:
        instructions = "Validando calibración - mantenga posición";
        this.processValidationPhase(frameData);
        shouldAdvance = phaseElapsed >= phaseDuration;
        break;
    }
    
    if (shouldAdvance) {
      this.advancePhase();
    }
    
    return {
      phase: this.currentPhase,
      progress: Math.round(progress),
      instructions,
      isComplete: this.currentPhase === this.CALIBRATION_PHASES.COMPLETE,
      results: this.currentPhase === this.CALIBRATION_PHASES.COMPLETE ? this.getCalibrationResults() : undefined
    };
  }
  
  /**
   * Procesar fase de línea base
   */
  private processBaselinePhase(frameData: any): void {
    if (!frameData.fingerDetected) {
      this.samples.baseline.push(frameData.redValue);
      
      if (this.samples.baseline.length >= 60) { // ~2 segundos de muestras
        const avgRed = this.samples.baseline.reduce((a, b) => a + b, 0) / this.samples.baseline.length;
        const stdDev = Math.sqrt(
          this.samples.baseline.reduce((acc, val) => acc + Math.pow(val - avgRed, 2), 0) / this.samples.baseline.length
        );
        
        this.calibrationData.baseline = {
          red: avgRed,
          green: frameData.avgGreen,
          blue: frameData.avgBlue
        };
        
        console.log("AutoCalibrationSystem: Línea base establecida", {
          baseline: this.calibrationData.baseline,
          stdDev
        });
      }
    }
  }
  
  /**
   * Procesar fase de detección de dedo
   */
  private processFingerDetectionPhase(frameData: any): void {
    if (frameData.fingerDetected) {
      this.samples.fingerDetection.push(frameData.redValue);
      
      if (this.samples.fingerDetection.length >= 100) { // ~3 segundos de muestras
        const values = this.samples.fingerDetection;
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        
        // Establecer umbrales adaptativos
        this.calibrationData.fingerThresholds = {
          min: Math.max(30, avgValue * 0.6),
          max: Math.min(250, avgValue * 1.4)
        };
        
        console.log("AutoCalibrationSystem: Umbrales de dedo calibrados", {
          thresholds: this.calibrationData.fingerThresholds,
          stats: { minValue, maxValue, avgValue }
        });
      }
    }
  }
  
  /**
   * Procesar fase de optimización de señal
   */
  private processSignalOptimizationPhase(frameData: any): void {
    if (frameData.fingerDetected && frameData.quality > 30) {
      this.samples.signalQuality.push(frameData.quality);
      
      if (this.samples.signalQuality.length >= 80) {
        const avgQuality = this.samples.signalQuality.reduce((a, b) => a + b, 0) / this.samples.signalQuality.length;
        
        // Calcular parámetros óptimos de señal
        const baselineValue = this.calibrationData.baseline?.red || 100;
        const currentValue = frameData.redValue;
        
        this.calibrationData.signalParams = {
          gain: avgQuality > 60 ? 1.0 : 1.2,
          offset: currentValue - baselineValue
        };
        
        console.log("AutoCalibrationSystem: Parámetros de señal optimizados", {
          signalParams: this.calibrationData.signalParams,
          avgQuality
        });
      }
    }
  }
  
  /**
   * Procesar fase de validación
   */
  private processValidationPhase(frameData: any): void {
    if (frameData.fingerDetected) {
      // Validar estabilidad y precisión
      const isInRange = this.calibrationData.fingerThresholds &&
        frameData.redValue >= this.calibrationData.fingerThresholds.min &&
        frameData.redValue <= this.calibrationData.fingerThresholds.max;
      
      const qualityGood = frameData.quality > 50;
      
      if (isInRange && qualityGood) {
        if (!this.calibrationData.validationResults) {
          this.calibrationData.validationResults = { accuracy: 0, stability: 0 };
        }
        
        this.calibrationData.validationResults.accuracy += isInRange ? 1 : 0;
        this.calibrationData.validationResults.stability += qualityGood ? 1 : 0;
      }
    }
  }
  
  /**
   * Avanzar a la siguiente fase
   */
  private advancePhase(): void {
    const phases = Object.values(this.CALIBRATION_PHASES);
    const currentIndex = phases.indexOf(this.currentPhase);
    
    if (currentIndex < phases.length - 1) {
      this.currentPhase = phases[currentIndex + 1];
      this.phaseStartTime = Date.now();
      
      console.log(`AutoCalibrationSystem: Avanzando a fase ${this.currentPhase}`);
    }
  }
  
  /**
   * Obtener resultados de calibración
   */
  public getCalibrationResults(): {
    success: boolean;
    baseline: any;
    thresholds: any;
    signalParams: any;
    accuracy: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let success = true;
    
    if (!this.calibrationData.baseline) {
      success = false;
      recommendations.push("No se pudo establecer línea base - verifique iluminación");
    }
    
    if (!this.calibrationData.fingerThresholds) {
      success = false;
      recommendations.push("No se detectó dedo consistentemente - mejore contacto");
    }
    
    if (!this.calibrationData.signalParams) {
      success = false;
      recommendations.push("Calidad de señal insuficiente - limpie lente y mejore presión");
    }
    
    const validation = this.calibrationData.validationResults;
    const accuracy = validation ? (validation.accuracy / 50) * 100 : 0; // 50 muestras esperadas
    
    if (accuracy < 70) {
      recommendations.push("Precisión baja - repita calibración en mejor ambiente");
    }
    
    if (success && recommendations.length === 0) {
      recommendations.push("Calibración exitosa - sistema listo para medición");
    }
    
    return {
      success,
      baseline: this.calibrationData.baseline,
      thresholds: this.calibrationData.fingerThresholds,
      signalParams: this.calibrationData.signalParams,
      accuracy: Math.round(accuracy),
      recommendations
    };
  }
  
  /**
   * Reset datos de calibración
   */
  private resetData(): void {
    this.calibrationData = {
      baseline: null,
      fingerThresholds: null,
      signalParams: null,
      validationResults: null
    };
    
    this.samples = {
      baseline: [],
      fingerDetection: [],
      signalQuality: []
    };
  }
  
  /**
   * Verificar si la calibración está en progreso
   */
  public isCalibrating(): boolean {
    return this.currentPhase !== this.CALIBRATION_PHASES.COMPLETE;
  }
  
  /**
   * Obtener progreso actual
   */
  public getCurrentProgress(): number {
    const currentTime = Date.now();
    const phaseElapsed = currentTime - this.phaseStartTime;
    const phaseDuration = this.PHASE_DURATIONS[this.currentPhase] || 5000;
    return Math.min(100, (phaseElapsed / phaseDuration) * 100);
  }
}
