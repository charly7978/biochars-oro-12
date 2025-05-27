export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  confidence: number;
  // Podríamos añadir un campo opcional para transmitir la naturaleza experimental
  // status?: 'experimental' | 'reliable'; 
}

/**
 * ADVERTENCIA: La estimación de la presión arterial (PA) utilizando fotopletismografía (PPG)
 * de la cámara de un smartphone es una técnica ALTAMENTE EXPERIMENTAL. Los resultados pueden
 * variar significativamente entre individuos, condiciones de medición (luz, posición del dedo,
 * movimiento), y calibración. NO debe utilizarse para diagnóstico médico, ajuste de medicación
 * o cualquier propósito clínico sin la supervisión de un profesional de la salud.
 * Esta implementación se basa en principios teóricos y correlaciones que aún están bajo
 * investigación activa y no garantizan precisión médica.
 */
export class BloodPressureProcessor {
  private ptValues: number[] = [];
  private calibrationSystolic: number = 120;
  private calibrationDiastolic: number = 80;
  private isCalibrated: boolean = false;
  private ageAdjustment: number = 0;
  private lastValidBP: BloodPressureResult | null = null;
  
  /**
   * Calcula la presión arterial usando un análisis de la señal PPG, incluyendo el Tiempo de Tránsito del Pulso (PTT).
   * 
   * ADVERTENCIA: Estimación EXPERIMENTAL. La precisión NO está garantizada y NO reemplaza
   * a un tensiómetro médico validado. Úsese con fines informativos y bajo propio riesgo.
   * Requiere calibración previa para mejorar la aproximación.
   */
  public calculateBloodPressure(ppgValues: number[]): BloodPressureResult {
    if (!this.isCalibrated) {
      console.warn("BloodPressureProcessor: Intento de medir PA sin calibración. Resultados no fiables.");
      // Considerar devolver un objeto con confianza muy baja o NaN si no está calibrado.
      // Por ahora, se permite continuar, pero la UI debería reflejar esto.
    }

    if (ppgValues.length < 60) {
      return this.lastValidBP || { systolic: 0, diastolic: 0, confidence: 0 };
    }
    
    // Detectar picos y calcular intervalos de tiempo
    const peaks = this.detectPeaks(ppgValues);
    if (peaks.length < 3) {
      return this.lastValidBP || { systolic: 0, diastolic: 0, confidence: 0 };
    }
    
    // Calcular tiempo de tránsito de pulso (PTT)
    const ptt = this.calculatePTT(peaks, ppgValues);
    this.ptValues.push(ptt);
    
    // Mantener buffer de valores PTT
    if (this.ptValues.length > 20) {
      this.ptValues.shift();
    }
    
    if (this.ptValues.length < 5) {
      return this.lastValidBP || { systolic: 0, diastolic: 0, confidence: 0 };
    }
    
    // Calcular presión usando relación PTT inversa
    const avgPTT = this.ptValues.reduce((a, b) => a + b, 0) / this.ptValues.length;
    const pttStability = this.calculatePTTStability();
    
    // Algoritmo mejorado basado en investigación médica
    const baselinePTT = 200; // ms típico
    const pttRatio = baselinePTT / Math.max(avgPTT, 50);
    
    // Calcular presión sistólica
    let systolic = this.calibrationSystolic * Math.pow(pttRatio, 0.8);
    systolic += this.ageAdjustment;
    
    // Calcular presión diastólica (típicamente 60-80% de sistólica)
    let diastolic = systolic * 0.65;
    
    // Aplicar variabilidad natural y correcciones
    const heartRateEffect = this.calculateHeartRateEffect(peaks);
    systolic += heartRateEffect.systolicAdjust;
    diastolic += heartRateEffect.diastolicAdjust;
    
    // Aplicar límites fisiológicos
    systolic = Math.max(90, Math.min(200, Math.round(systolic)));
    diastolic = Math.max(50, Math.min(120, Math.round(diastolic)));
    
    // Asegurar relación válida entre sistólica y diastólica
    if (diastolic >= systolic) {
      diastolic = systolic - 20;
    }
    
    const confidence = Math.min(1.0, pttStability * 0.8 + (peaks.length / 10) * 0.2);
    
    const result: BloodPressureResult = {
      systolic,
      diastolic,
      confidence
      // status: 'experimental' // Ejemplo si se añade el campo
    };
    
    // Guardar como último resultado válido si la confianza es alta
    if (confidence > 0.6) {
      this.lastValidBP = result;
    }
    
    return result;
  }
  
  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    const threshold = this.calculateAdaptiveThreshold(values);
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && 
          values[i] > values[i+1] && 
          values[i] > values[i-2] && 
          values[i] > values[i+2] &&
          values[i] > threshold) {
        
        // Evitar picos muy cercanos (mínimo 15 muestras de separación)
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 15) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }
  
  private calculateAdaptiveThreshold(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile75 = sorted[Math.floor(sorted.length * 0.75)];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.max(mean, percentile75 * 0.8);
  }
  
  private calculatePTT(peaks: number[], values: number[]): number {
    if (peaks.length < 2) return 200; // Default PTT
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // PTT basado en morfología de onda
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const morphologyFactor = this.analyzePulseMorphology(peaks, values);
    
    // PTT en ms (asumiendo 30 FPS)
    return (avgInterval / 30) * 1000 * morphologyFactor;
  }
  
  private analyzePulseMorphology(peaks: number[], values: number[]): number {
    if (peaks.length < 2) return 1.0;
    
    let totalUpstroke = 0;
    let totalDownstroke = 0;
    let validPeaks = 0;
    
    for (let i = 0; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      
      // Buscar inicio del pulso (valle anterior)
      let valleyStart = peakIndex;
      for (let j = peakIndex - 1; j >= Math.max(0, peakIndex - 20); j--) {
        if (values[j] < values[valleyStart]) {
          valleyStart = j;
        }
      }
      
      // Buscar final del pulso (valle posterior)
      let valleyEnd = peakIndex;
      for (let j = peakIndex + 1; j < Math.min(values.length, peakIndex + 20); j++) {
        if (values[j] < values[valleyEnd]) {
          valleyEnd = j;
        }
      }
      
      if (valleyEnd > peakIndex && peakIndex > valleyStart) {
        const upstroke = peakIndex - valleyStart;
        const downstroke = valleyEnd - peakIndex;
        
        totalUpstroke += upstroke;
        totalDownstroke += downstroke;
        validPeaks++;
      }
    }
    
    if (validPeaks === 0) return 1.0;
    
    const avgUpstroke = totalUpstroke / validPeaks;
    const avgDownstroke = totalDownstroke / validPeaks;
    
    // Factor de morfología: upstroke rápido sugiere presión más alta
    return Math.max(0.7, Math.min(1.3, avgDownstroke / Math.max(avgUpstroke, 1)));
  }
  
  private calculatePTTStability(): number {
    if (this.ptValues.length < 3) return 0.5;
    
    const mean = this.ptValues.reduce((a, b) => a + b, 0) / this.ptValues.length;
    const variance = this.ptValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.ptValues.length;
    const cv = Math.sqrt(variance) / mean; // Coeficiente de variación
    
    return Math.max(0, Math.min(1, 1 - cv));
  }
  
  private calculateHeartRateEffect(peaks: number[]): { systolicAdjust: number; diastolicAdjust: number } {
    if (peaks.length < 2) return { systolicAdjust: 0, diastolicAdjust: 0 };
    
    // Calcular frecuencia cardíaca aproximada
    const avgInterval = peaks.slice(1).reduce((acc, peak, i) => acc + (peak - peaks[i]), 0) / (peaks.length - 1);
    const heartRate = (30 * 60) / avgInterval; // Asumiendo 30 FPS
    
    // Ajustes basados en frecuencia cardíaca
    let systolicAdjust = 0;
    let diastolicAdjust = 0;
    
    if (heartRate > 100) {
      // Taquicardia: aumenta presión sistólica
      systolicAdjust = (heartRate - 100) * 0.3;
      diastolicAdjust = (heartRate - 100) * 0.1;
    } else if (heartRate < 60) {
      // Bradicardia: puede reducir presión
      systolicAdjust = (60 - heartRate) * -0.2;
      diastolicAdjust = (60 - heartRate) * -0.1;
    }
    
    return { systolicAdjust, diastolicAdjust };
  }
  
  public calibrate(systolic: number, diastolic: number, age: number = 30): void {
    this.calibrationSystolic = systolic;
    this.calibrationDiastolic = diastolic;
    this.ageAdjustment = Math.max(0, (age - 30) * 0.5); // Ajuste por edad
    this.isCalibrated = true;
    console.log(`BloodPressureProcessor: Calibrado con S:${systolic}, D:${diastolic}, Edad:${age}`);
  }
  
  public reset(): void {
    this.ptValues = [];
  }
}
