import { calculateAC, calculateDC } from './utils'; // Asumiendo que estas utilidades existen

/**
 * PROCESADOR DE SpO2 - IMPLEMENTACIÓN EXPERIMENTAL (Requiere Hardware Específico)
 * Esta implementación calcula una ESTIMACIÓN EXPERIMENTAL de la saturación de oxígeno
 * basada únicamente en la señal PPG del canal ROJO de una cámara de smartphone.
 * ADVERTENCIA: Esta medición NO es médicamente fiable ni clínicamente validada sin
 * un sensor dedicado que emita y detecte luz en longitudes de onda ROJA e INFRARROJA.
 * NO DEBE USARSE PARA DIAGNÓSTICO MÉDICO.
 */

export class SpO2Processor {
  private calibrationBaseline: number = 0;
  private isCalibrated: boolean = false;
  // Historiales para la señal procesada (asumiendo que recibimos una señal única, no canales R/IR separados)
  private processedSignalHistory: number[] = [];
  private qualityHistory: number[] = [];
  private lastSmoothedValue: number = 0;
  private measurementHistory: number[] = [];
  private readonly QUALITY_THRESHOLD = 0.7; // Calidad mínima para medición válida
  private readonly STABILITY_WINDOW = 30; // Ventana para evaluar estabilidad
  private readonly MAX_VARIATION_ALLOWED = 5; // Máxima variación SpO2 permitida entre mediciones
  
  // Añadir un indicador para saber si hay hardware IR disponible (siempre falso en este proyecto)
  private hasIRHardware: boolean = false; // Asumimos que no hay hardware IR dedicado en un smartphone estándar
  
  /**
   * Calcula SpO2 con validación médica estricta y reducción de artefactos
   */
  public calculateSpO2(ppgValues: number[], signalQuality: number = 0): number {
    // Si no hay hardware IR dedicado, no podemos calcular SpO2 real.
    // Retornar 0 o un indicador de no disponible.
    if (!this.hasIRHardware) {
        console.warn("SpO2Processor: No IR hardware detected. Cannot calculate real SpO2.");
        return 0; // Retorna 0 si no hay hardware IR
    }

    // --- A partir de aquí, la lógica asume que tenemos datos de canales ROJO e IR REALES ---
    // En el contexto de este proyecto (solo cámara RGB), este código NUNCA se ejecutará con datos reales.
    // Se mantiene como referencia si en el futuro se integra hardware IR.

    if (ppgValues.length < 80) return 0; // Requiere más datos
    
    // Validación de calidad de señal
    this.qualityHistory.push(signalQuality);
    if (this.qualityHistory.length > 20) {
      this.qualityHistory.shift();
    }
    
    const avgQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
    if (avgQuality < this.QUALITY_THRESHOLD) {
      console.log("SpO2Processor: Calidad insuficiente", { avgQuality, required: this.QUALITY_THRESHOLD });
      return 0;
    }
    
    // Filtrar valores anómalos antes del procesamiento
    const filteredValues = this.removeOutliers(ppgValues);
    if (filteredValues.length < ppgValues.length * 0.8) {
      console.log("SpO2Processor: Demasiados valores anómalos");
      return 0;
    }
    
    // *** LÓGICA DE CÁLCULO DE SpO2 REAL AQUÍ (si hubiera datos IR) ***
    // Sustituir con la extracción y procesamiento REAL de señales ROJA e IR si se cuenta con hardware adecuado.
    // Por ahora, este bloque no es funcional para SpO2 real con hardware estándar.
    
    // Placeholder / Lógica para datos simulados o de un solo canal (deshabilitada por hasIRHardware = false)
    let redRatio = 0.1; // Ejemplo de valores esperados
    let irRatio = 0.2;
    let R = redRatio / irRatio; // Esto no es válido con un solo canal
    let spo2 = 0; // No podemos calcular SpO2 real sin hardware IR, establecer en 0

    // Validar estabilidad temporal antes de aplicar suavizado
    if (!this.validateTemporalStability(spo2)) {
      console.log("SpO2Processor: Medición temporalmente inestable");
      return 0;
    }
    
    // Aplicar filtro de suavizado temporal avanzado
    spo2 = this.applySmoothingFilterImproved(spo2);
    
    // Agregar a historial para análisis de tendencia
    this.measurementHistory.push(spo2);
    if (this.measurementHistory.length > this.STABILITY_WINDOW) {
      this.measurementHistory.shift();
    }
    
    // Clamp a rango fisiológico válido con validación estricta
    let finalSpO2 = Math.max(88, Math.min(100, Math.round(spo2 * 10) / 10));
    
    console.log("SpO2Processor: Medición válida", {
      spo2: finalSpO2,
      R,
      redRatio,
      irRatio,
      quality: avgQuality
    });
    
    return finalSpO2;
  }
  
  /**
   * Remover outliers usando método IQR
   */
  private removeOutliers(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Validar estabilidad temporal
   */
  private validateTemporalStability(newValue: number): boolean {
    if (this.measurementHistory.length < 5) return true;
    
    const recentMeasurements = this.measurementHistory.slice(-5);
    const avgRecent = recentMeasurements.reduce((a, b) => a + b, 0) / recentMeasurements.length;
    const deviation = Math.abs(newValue - avgRecent);
    
    return deviation <= this.MAX_VARIATION_ALLOWED;
  }
  
  /**
   * Filtro de suavizado mejorado con validación
   */
  private applySmoothingFilterImproved(newValue: number): number {
    const alpha = 0.25; // Factor de suavizado más conservador
    
    if (!this.lastSmoothedValue) {
      this.lastSmoothedValue = newValue;
      return newValue;
    }
    
    // Aplicar suavizado solo si la diferencia no es extrema
    const difference = Math.abs(newValue - this.lastSmoothedValue);
    if (difference > 10) {
      // Cambio muy grande, usar valor anterior con pequeña corrección
      this.lastSmoothedValue = this.lastSmoothedValue + Math.sign(newValue - this.lastSmoothedValue) * 2;
    } else {
      this.lastSmoothedValue = alpha * newValue + (1 - alpha) * this.lastSmoothedValue;
    }
    
    return this.lastSmoothedValue;
  }
  
  public calibrate(knownSpo2: number = 98): void {
    this.calibrationBaseline = knownSpo2;
    this.isCalibrated = true;
  }
  
  public reset(): void {
    this.qualityHistory = [];
    this.lastSmoothedValue = 0;
    this.measurementHistory = [];
  }
}
