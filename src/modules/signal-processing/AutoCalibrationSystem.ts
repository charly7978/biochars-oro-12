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
    const phaseDuration = this.PHASE_DURATIONS[this.currentPhase] || 5000;
    // Asegurar que phaseElapsed no sea negativo si phaseStartTime es futuro (improbable pero seguro)
    const phaseElapsed = Math.max(0, currentTime - this.phaseStartTime);
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
        // Avanzar si se completa el tiempo Y el dedo ha sido consistentemente detectado recientemente
        // (Esta lógica de "consistentemente detectado" podría necesitar más elaboración aquí o basarse en la calidad)
        shouldAdvance = phaseElapsed >= phaseDuration && frameData.fingerDetected && frameData.quality > 30;
        if (phaseElapsed >= phaseDuration && !(frameData.fingerDetected && frameData.quality > 30)) {
            console.log("AutoCalibrationSystem: Detección de dedo fallida/calidad baja al final de la fase, extendiendo...");
            this.phaseStartTime = Date.now() - (phaseDuration * 0.8); // Retroceder un poco el tiempo para dar más oportunidad
        }
        break;
        
      case this.CALIBRATION_PHASES.SIGNAL_OPTIMIZATION:
        instructions = "Mantenga el dedo quieto mientras optimizamos la señal";
        this.processSignalOptimizationPhase(frameData);
        shouldAdvance = phaseElapsed >= phaseDuration && frameData.quality > 50; // Exigir mejor calidad para avanzar
         if (phaseElapsed >= phaseDuration && !(frameData.quality > 50)) {
            console.log("AutoCalibrationSystem: Calidad de señal insuficiente para optimización, extendiendo...");
            this.phaseStartTime = Date.now() - (phaseDuration * 0.8);
        }
        break;
        
      case this.CALIBRATION_PHASES.VALIDATION:
        instructions = "Validando calibración - mantenga posición";
        this.processValidationPhase(frameData);
        shouldAdvance = phaseElapsed >= phaseDuration;
        break;
    }
    
    if (shouldAdvance) {
      this.advancePhase();
      // Si avanzamos a COMPLETE, recalcular progreso para que sea 100%
      if (this.currentPhase === this.CALIBRATION_PHASES.COMPLETE) {
        return {
          phase: this.currentPhase,
          progress: 100,
          instructions: "Calibración Completada",
          isComplete: true,
          results: this.getCalibrationResults()
        };
      }
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
          gain: avgQuality > 60 ? 1.0 : 1.2, // Ganancia adaptativa simplificada
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
        
        // Acumular scores, normalizar después en getCalibrationResults
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
      this.samples.baseline = []; // Limpiar muestras de fases anteriores si es necesario
      this.samples.fingerDetection = [];
      this.samples.signalQuality = [];
      console.log(`AutoCalibrationSystem: Avanzando a fase ${this.currentPhase}`);
    } else if (this.currentPhase !== this.CALIBRATION_PHASES.COMPLETE) {
        // Esto asegura que si se llama advancePhase en la última fase (VALIDATION) y debe completarse,
        // se transite a COMPLETE. 
        this.currentPhase = this.CALIBRATION_PHASES.COMPLETE;
        this.phaseStartTime = Date.now(); // Registrar tiempo de finalización
        console.log(`AutoCalibrationSystem: Transición final a fase ${this.currentPhase}`);
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
    stabilityScore: number; // Nuevo: score de estabilidad
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let success = true;
    
    if (!this.calibrationData.baseline) {
      success = false;
      recommendations.push("No se pudo establecer línea base - verifique iluminación y que no haya dedo.");
    }
    
    if (!this.calibrationData.fingerThresholds) {
      success = false;
      recommendations.push("No se detectó dedo consistentemente o la señal fue muy variable.");
    }
    
    if (!this.calibrationData.signalParams) {
      success = false;
      recommendations.push("Calidad de señal insuficiente para optimización - limpie lente y mejore presión/posición.");
    }
    
    const validation = this.calibrationData.validationResults;
    // Normalizar accuracy y stability basados en el número de muestras que se deberían haber tomado
    // Asumiendo aprox 30 FPS y duración de fase de validación de 3 segundos = 90 muestras
    const expectedValidationSamples = (this.PHASE_DURATIONS[this.CALIBRATION_PHASES.VALIDATION] / 1000) * 30; 
    const accuracy = validation ? (validation.accuracy / expectedValidationSamples) * 100 : 0;
    const stabilityScore = validation ? (validation.stability / expectedValidationSamples) * 100 : 0;
    
    if (accuracy < 60) { // Umbral más realista
      success = false; // Si la precisión es baja, la calibración no es exitosa
      recommendations.push("Precisión de validación baja - repita calibración en mejor ambiente.");
    }
    if (stabilityScore < 60) {
       success = false;
       recommendations.push("Estabilidad de señal baja durante validación.");
    }
    
    if (success && recommendations.length === 0) {
      recommendations.push("Calibración exitosa - sistema listo para medición.");
    }
    
    return {
      success,
      baseline: this.calibrationData.baseline,
      thresholds: this.calibrationData.fingerThresholds,
      signalParams: this.calibrationData.signalParams,
      accuracy: Math.round(accuracy),
      stabilityScore: Math.round(stabilityScore),
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
      validationResults: { accuracy: 0, stability: 0 } // Resetear validationResults
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
  
  // Método para obtener la fase actual
  public getCurrentPhase(): string {
    return this.currentPhase;
  }

  public getCurrentProgress(): number {
    if (this.currentPhase === this.CALIBRATION_PHASES.COMPLETE) return 100;
    const currentTime = Date.now();
    const phaseElapsed = Math.max(0, currentTime - this.phaseStartTime);
    const phaseDuration = this.PHASE_DURATIONS[this.currentPhase] || 5000;
    return Math.min(100, Math.round((phaseElapsed / phaseDuration) * 100));
  }
}
