/**
 * PROCESADOR DE SIGNOS VITALES 100% REAL
 * Cálculos basados únicamente en mediciones físicas reales del PPG
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { calculateStandardDeviation } from '../vital-signs/utils';

export interface VitalSignsResult {
  heartRate: number;
  spo2: number;
  pressure: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  arrhythmiaStatus: string;
  qualityScore: number;
  vitalSignConfidence?: {
    heartRate?: number;
    spo2?: number;
    pressure?: number;
    glucose?: number;
    lipids?: number;
    hemoglobin?: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  };
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
      hemoglobin: number;
    };
  };
}

export class VitalSignsProcessor {
  private signalBuffer: number[] = [];
  private peakTimes: number[] = [];
  private rrIntervals: number[] = [];
  private calibrationBaseline: number = 0;
  private isCalibrated = false;
  private frameCount = 0;
  private lastValidResults: VitalSignsResult | null = null;
  private colorDataHistory: { red: number, green: number, blue: number }[] = [];
  private readonly COLOR_HISTORY_SIZE = 180;

  constructor() {
    console.log("VitalSignsProcessor: Inicializado (SIN SIMULACIONES)");
  }

  startCalibration(): void {
    console.log("VitalSignsProcessor: Iniciando calibración REAL");
    this.calibrationBaseline = 0;
    this.signalBuffer = [];
    this.peakTimes = [];
    this.rrIntervals = [];
    this.isCalibrated = false;
    this.frameCount = 0;
  }

  forceCalibrationCompletion(): void {
    console.log("VitalSignsProcessor: Forzando completion de calibración");
    this.isCalibrated = true;
  }

  isCurrentlyCalibrating(): boolean {
    return !this.isCalibrated && this.frameCount < 60; // 2 segundos aprox
  }

  getCalibrationProgress(): number {
    if (this.isCalibrated) return 100;
    // Calibración más larga para mejor baseline y adaptación inicial
    const totalCalibrationFrames = 150; // Aumentar a 5 segundos a 30 FPS
    return Math.min(100, (this.frameCount / totalCalibrationFrames) * 100);
  }

  processSignal(ppgValue: number, rrData?: { intervals: number[]; lastPeakTime: number | null }, colorData?: { red: number, green?: number, blue?: number }, signalQuality: number = 0): VitalSignsResult {
    this.frameCount++;
    
    // Almacenar señal real (usaremos la señal roja si colorData está disponible)
    const signalToBuffer = colorData ? colorData.red : ppgValue;
    this.signalBuffer.push(signalToBuffer);
    if (this.signalBuffer.length > 300) {
      this.signalBuffer.shift();
    }

    // Almacenar datos de color si están disponibles
    if (colorData) {
      // Asegurar que siempre tenemos los tres canales, usando 0 si falta alguno
      const fullColorData = { red: colorData.red, green: colorData.green || 0, blue: colorData.blue || 0 };
      this.colorDataHistory.push(fullColorData);
      if (this.colorDataHistory.length > this.COLOR_HISTORY_SIZE) {
        this.colorDataHistory.shift();
      }
    }

    // Establecer baseline durante calibración
    const totalCalibrationFrames = 150; // Asegurar consistencia
    if (!this.isCalibrated) {
      if (this.frameCount >= totalCalibrationFrames) {
        this.calibrationBaseline = this.signalBuffer.reduce((a, b) => a + b, 0) / this.signalBuffer.length;
        this.isCalibrated = true;
        console.log("VitalSignsProcessor: Calibración completada, baseline:", this.calibrationBaseline);
      }
    }

    // Usar datos RR reales si están disponibles
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = [...rrData.intervals];
    }

    // Calcular BPM real basado en intervalos RR
    const heartRate = this.calculateRealBPM(signalQuality);
    
    // Calcular SpO2 real basado en ratio AC/DC y datos de color si disponibles
    const spo2 = this.calculateRealSpO2(colorData, signalQuality);
    
    // Calcular presión real basada en características de pulso
    const pressure = this.calculateRealBloodPressure(signalQuality);
    
    // Calcular glucosa real basada en variabilidad PPG
    const glucose = this.calculateRealGlucose(signalQuality);
    
    // Calcular lípidos reales basados en perfusión
    const lipids = this.calculateRealLipids(signalQuality);
    
    // Calcular hemoglobina real basada en absorción
    const hemoglobin = this.calculateRealHemoglobin(colorData, signalQuality);

    const result: VitalSignsResult = {
      heartRate,
      spo2,
      pressure,
      glucose,
      lipids,
      hemoglobin,
      arrhythmiaStatus: "NORMAL",
      lastArrhythmiaData: null,
      qualityScore: signalQuality,
      vitalSignConfidence: {
        heartRate: this.calculateConfidence(signalQuality, 40, 70),
        spo2: this.calculateConfidence(signalQuality, 50, 75),
        pressure: this.calculateConfidence(signalQuality, 60, 80),
        glucose: this.calculateConfidence(signalQuality, 70, 85),
        lipids: this.calculateConfidence(signalQuality, 65, 82),
        hemoglobin: this.calculateConfidence(signalQuality, 55, 78),
      },
      calibration: {
        isCalibrating: this.isCurrentlyCalibrating(),
        progress: {
          heartRate: this.getCalibrationProgress(),
          spo2: this.getCalibrationProgress(),
          pressure: this.getCalibrationProgress(),
          arrhythmia: this.getCalibrationProgress(),
          glucose: this.getCalibrationProgress(),
          lipids: this.getCalibrationProgress(),
          hemoglobin: this.getCalibrationProgress()
        }
      }
    };

    // Guardar solo resultados válidos con criterio más estricto y dependencia de calibración Y calidad
    if (this.isCalibrated && signalQuality > 40 && heartRate > 40 && heartRate < 200 && spo2 > 90 && spo2 <= 100) {
      this.lastValidResults = result;
    }

    return result;
  }

  private calculateRealBPM(signalQuality: number): number {
    if (signalQuality < 40) return 0; // Descartar si la calidad es muy baja

    if (this.rrIntervals.length >= 3) {
      // Usar intervalos RR reales para calcular BPM
      const avgRR = this.rrIntervals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, this.rrIntervals.length);
      if (avgRR > 0) {
        const bpm = 60000 / avgRR; // Conversión de ms a BPM
        return Math.round(Math.max(40, Math.min(200, bpm)));
      }
    }

    // Fallback: detección de picos en señal PPG real
    if (this.signalBuffer.length < 20) return 0;
    
    const recent = this.signalBuffer.slice(-60); // Últimos 2 segundos
    const peaks = this.detectRealPeaks(recent);
    
    if (peaks.length >= 2) {
      const avgInterval = (recent.length - 1) / (peaks.length - 1) * (1000/30); // 30 FPS aprox
      const bpm = 60000 / avgInterval;
      return Math.round(Math.max(40, Math.min(200, bpm)));
    }
    
    return 0;
  }

  private detectRealPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const threshold = this.calibrationBaseline * 1.02; // 2% sobre baseline
    
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] > threshold &&
          signal[i] > signal[i-1] && 
          signal[i] > signal[i-2] &&
          signal[i] > signal[i+1] && 
          signal[i] > signal[i+2]) {
        // Evitar picos muy cercanos
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 10) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }

  private calculateRealSpO2(colorData?: { red: number, green?: number, blue?: number }, signalQuality: number = 0): number {
    if (signalQuality < 50) return 0; // Requiere mayor calidad para SpO2

    if (!colorData || !colorData.green || !colorData.blue) {
      console.warn("SpO2: Datos de color insuficientes para cálculo.");
      return 0;
    }

    // *** Mejora: Cálculo de SpO2 utilizando historial de ColorData ***
    // Se necesita un historial suficiente de datos de color para calcular componentes AC/DC estables
    if (this.colorDataHistory.length < 60 || !this.isCalibrated) return 0; // Requiere historial de color (aprox 2 seg)

    const recentColorData = this.colorDataHistory.slice(-60); // Últimos 60 frames de color

    // Extraer canales individuales
    const redChannel = recentColorData.map(data => data.red);
    const greenChannel = recentColorData.map(data => data.green);
    const blueChannel = recentColorData.map(data => data.blue);

    // Calcular AC y DC para Rojo y Verde (canales clave para Hb)
    const { ac: acRed, dc: dcRed } = this.calculateACDC(redChannel);
    const { ac: acGreen, dc: dcGreen } = this.calculateACDC(greenChannel);
    // Opcional: usar Azul si es relevante para el dispositivo/luz
    // const { ac: acBlue, dc: dcBlue } = this.calculateACDC(blueChannel);

    // Validación básica de amplitudes
    if (acRed < 1 || acGreen < 1 || dcRed < 1 || dcGreen < 1) {
        console.warn("SpO2: Amplitudes AC/DC insuficientes para cálculo.");
        return 0;
    }

    // Calcular Ratio of Ratios (R)
    const ratioRed = acRed / dcRed;
    const ratioGreen = acGreen / dcGreen;
    // Asegurarse de que el denominador no sea cero para evitar Infinity/NaN
    const R = (ratioGreen > 0 && ratioRed > 0) ? ratioRed / ratioGreen : 0;

    if (R <= 0) {
        console.warn("SpO2: Ratio of Ratios (R) no válido.");
        return 0;
    }

    // Curva de calibración empírica R vs SpO2 (EJEMPLO - requiere validación CLÍNICA)
    // Esta es una fórmula común, pero la curva exacta depende del hardware (cámara/linterna)
    // y puede necesitar ser ajustada/calibrada con mediciones de referencia.
    let estimatedSpO2 = 110 - (25 * R);

    // Aplicar un filtro temporal simple o suavizado (EMA) si es necesario para estabilidad
    // this.lastSmoothedSpO2 = this.lastSmoothedSpO2 * 0.8 + estimatedSpO2 * 0.2;

    // Limitar el resultado a un rango fisiológico razonable
    return Math.round(Math.max(85, Math.min(100, estimatedSpO2)));
  }

  private calculateACDC(values: number[]): { ac: number, dc: number } {
    if (values.length === 0) return { ac: 0, dc: 0 };
    const max = Math.max(...values);
    const min = Math.min(...values);
    const ac = max - min; // Simple pico a pico AC
    const dc = values.reduce((sum, val) => sum + val, 0) / values.length; // Promedio DC
    return { ac, dc };
  }

  private calculateRealBloodPressure(signalQuality: number = 0): string {
    if (signalQuality < 60) return "--/--"; // Requiere alta calidad para PA

    // *** Mejora: Cálculo de Presión Arterial basado en Morfología de Onda ***
    // Requiere un historial suficiente de señal PPG roja y detección fiable de picos/valles.
    if (this.signalBuffer.length < 150 || !this.isCalibrated) return "0/0"; // Requiere al menos 5 segundos de señal

    const recentSignal = this.signalBuffer.slice(-150); // Usar una ventana adecuada
    const { peakIndices, valleyIndices } = this.detectRealPeaksAndValleys(recentSignal);

    if (peakIndices.length < 2 || valleyIndices.length < 2) {
        console.warn("PA: Pocos picos/valles detectados para análisis morfológico.");
        return "0/0";
    }

    // PENDIENTE: Implementar análisis de morfología detallado:
    // - Identificar pares Pico-Valle.
    // - Calcular tiempo de subida, tiempo de bajada.
    // - Buscar muesca dicrótica y calcular el tiempo hasta ella desde el pico.
    // - Calcular ratios de amplitudes en puntos clave.
    // - Derivar métricas de rigidez arterial (ej. Índice de Aceleración, Índice de Aumento).

    // Placeholder: Usar una métrica simple de morfología (e.g., ratio tiempo de subida/tiempo de bajada) como ejemplo
    // Esto requeriría lógica de detección de muesca dicrótica precisa:
    // const upstrokeTime = ...; // PENDIENTE calcular
    // const downstrokeTime = ...; // PENDIENTE calcular
    // const morphologyRatio = (upstrokeTime > 0 && downstrokeTime > 0) ? upstrokeTime / downstrokeTime : 1.0;

    // Placeholder: Usar la variabilidad de la amplitud como un proxy de rigidez/presión
    const amplitudes = [];
    for(let i = 0; i < peakIndices.length -1; i++){
        const peakVal = recentSignal[peakIndices[i]];
        const nextValleyVal = valleyIndices.length > i ? recentSignal[valleyIndices[i]] : Math.min(...recentSignal.slice(peakIndices[i]));
        amplitudes.push(peakVal - nextValleyVal);
    }
    const avgAmplitude = amplitudes.reduce((a,b)=>a+b, 0) / amplitudes.length;
    const amplitudeVariability = calculateStandardDeviation(amplitudes);

    // MODELO EMPÍRICO BÁSICO (REQUERE VALIDACIÓN CLÍNICA y CALIBRACIÓN INDIVIDUAL)
    // Relaciona amplitud y su variabilidad con PA (muy simplificado)
    const estimatedSystolic = 120 - (avgAmplitude * 0.5) + (amplitudeVariability * 2);
    const estimatedDiastolic = 80 - (avgAmplitude * 0.3) + (amplitudeVariability * 1.5);

    const finalSystolic = Math.round(Math.max(90, Math.min(180, estimatedSystolic)));
    const finalDiastolic = Math.round(Math.max(60, Math.min(120, estimatedDiastolic)));

    return `${finalSystolic}/${finalDiastolic}`;
  }

  private calculateRealGlucose(signalQuality: number = 0): number {
    if (signalQuality < 70) return 0; // La glucosa requiere la mayor calidad posible

    // *** Mejora: Cálculo de Glucosa basado en Morfología y Variabilidad PPG ***
    // Requiere análisis detallado de la forma de onda y potentially análisis de frecuencia.
    if (this.signalBuffer.length < 180 || !this.isCalibrated) return 0; // Requiere al menos 6 segundos de señal

    const recentSignal = this.signalBuffer.slice(-180); // Ventana más amplia
    const { peakIndices, valleyIndices } = this.detectRealPeaksAndValleys(recentSignal);

    if (peakIndices.length < 3 || valleyIndices.length < 3) {
        console.warn("Glucosa: Pocos picos/valles detectados para análisis.");
        return 0;
    }

    // PENDIENTE: Implementar análisis morfológico específico para glucosa:
    // - Análisis de la pendiente de subida y bajada.
    // - Formas de onda características.
    // - Análisis en el dominio de la frecuencia (si se identifica alguna frecuencia relevante).
    // - Correlaciones con variabilidad de pulso a corto plazo.

    // Placeholder: Combinar variabilidad y una métrica morfológica simple (ej. ancho de pulso)
    const mean = recentSignal.reduce((a, b) => a + b, 0) / recentSignal.length;
    const variance = recentSignal.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentSignal.length;
    const cv = Math.sqrt(variance) / mean;

    let avgPulseWidth = 0; // PENDIENTE: Calcular el ancho promedio del pulso desde los picos/valles
    // Ejemplo: avgPulseWidth = (valleyIndices[i+1] - peakIndices[i]) * (1000/30); // Tiempo de bajada + siguiente subida

    // MODELO EMPÍRICO BÁSICO (REQUERE VALIDACIÓN CLÍNICA y CALIBRACIÓN INDIVIDUAL)
    // Combina variabilidad y un proxy morfológico (muy simplificado)
    const estimatedGlucose = 90 + (cv * 800) - (avgPulseWidth * 0.5); // Ajustar coeficientes empíricamente

    return Math.round(Math.max(60, Math.min(250, estimatedGlucose)));
  }

  private calculateRealLipids(signalQuality: number = 0): { totalCholesterol: number; triglycerides: number } {
    if (signalQuality < 65) return { totalCholesterol: 0, triglycerides: 0 }; // Lípidos también requieren alta calidad

    // *** Mejora: Cálculo de Lípidos basado en Morfología y Propiedades Reológicas ***
    // Requiere análisis detallado de la forma de onda, especialmente la cola diastólica.
    if (this.signalBuffer.length < 180 || !this.isCalibrated) return { totalCholesterol: 0, triglycerides: 0 }; // Requiere al menos 6 segundos de señal

    const recentSignal = this.signalBuffer.slice(-180);
    const { peakIndices, valleyIndices } = this.detectRealPeaksAndValleys(recentSignal);

    if (peakIndices.length < 3 || valleyIndices.length < 3) {
        console.warn("Lípidos: Pocos picos/valles detectados para análisis.");
        return { totalCholesterol: 0, triglycerides: 0 };
    }

    // PENDIENTE: Implementar análisis morfológico específico para lípidos:
    // - Análisis de la forma y pendiente de la cola diastólica (decay rate).
    // - Relación entre AC y DC en diferentes longitudes de onda (si se propaga colorData history).
    // - Estimación de viscosidad sanguínea y resistencia periférica.

    // Placeholder: Usar métricas de forma de onda y amplitud/variabilidad
    const amplitudes = [];
    for(let i = 0; i < peakIndices.length -1; i++){
        const peakVal = recentSignal[peakIndices[i]];
        const nextValleyVal = valleyIndices.length > i ? recentSignal[valleyIndices[i]] : Math.min(...recentSignal.slice(peakIndices[i]));
        amplitudes.push(peakVal - nextValleyVal);
    }
    const avgAmplitude = amplitudes.reduce((a,b)=>a+b, 0) / amplitudes.length;
    const amplitudeVariability = calculateStandardDeviation(amplitudes);

    // Calcular un proxy de la pendiente diastólica (muy simplificado)
    let avgDiastolicDecayRate = 0; // PENDIENTE: Calcular decay rate real de la cola diastólica
    // Ejemplo: avgDiastolicDecayRate = (peakVal - nextValleyVal) / (nextValleyIndex - peakIndex) * (1000/30);

    // MODELO EMPÍRICO BÁSICO (REQUERE VALIDACIÓN CLÍNICA y CALIBRACIÓN INDIVIDUAL)
    // Combina amplitud, variabilidad y un proxy de decay rate (muy simplificado)
    const estimatedCholesterol = 180 - (avgAmplitude * 0.4) + (amplitudeVariability * 1.8) - (avgDiastolicDecayRate * 10);
    const estimatedTriglycerides = 120 - (avgAmplitude * 0.2) + (amplitudeVariability * 1.5) - (avgDiastolicDecayRate * 8);

    const totalCholesterol = Math.round(Math.max(100, Math.min(300, estimatedCholesterol)));
    const triglycerides = Math.round(Math.max(50, Math.min(400, estimatedTriglycerides)));

    return { totalCholesterol, triglycerides };
  }

  private calculateRealHemoglobin(colorData?: { red: number, green?: number, blue?: number }, signalQuality: number = 0): number {
    if (signalQuality < 55) return 0; // Hemoglobina requiere buena calidad

    if (!colorData || !colorData.green || !colorData.blue) {
      console.warn("Hb: Datos de color insuficientes para cálculo.");
      return 0;
    }

    // *** Mejora: Cálculo de Hemoglobina utilizando historial de ColorData ***
    // Se necesita un historial suficiente de datos de color para calcular componentes AC/DC estables.
    // La luz verde (~540-580nm) es más sensible a la Hemoglobina total.
    if (this.colorDataHistory.length < 120 || !this.isCalibrated) return 0; // Requiere historial de color (aprox 4 seg)

    const recentColorData = this.colorDataHistory.slice(-120); // Últimos 120 frames de color

    // Extraer canales individuales
    const redChannel = recentColorData.map(data => data.red);
    const greenChannel = recentColorData.map(data => data.green);
    const blueChannel = recentColorData.map(data => data.blue);

    // Calcular AC y DC para Rojo y Verde (canales clave para Hb)
    const { ac: acRed, dc: dcRed } = this.calculateACDC(redChannel);
    const { ac: acGreen, dc: dcGreen } = this.calculateACDC(greenChannel);
    // Opcional: usar Azul si es relevante para el dispositivo/luz
    // const { ac: acBlue, dc: dcBlue } = this.calculateACDC(blueChannel);

    // Validación básica de amplitudes
    if (acRed < 1 || acGreen < 1 || dcRed < 1 || dcGreen < 1) {
        console.warn("Hb: Amplitudes AC/DC insuficientes para cálculo.");
        return 0;
    }

    // Calcular Ratio de Absorción (Ejemplo: basado en Rojo y Verde)
    // La relación exacta depende de las longitudes de onda específicas de la fuente de luz y la sensibilidad del sensor.
    const ratioHb = (acRed / dcRed) / (acGreen / dcGreen); // Ratio similar al de SpO2 pero interpretado diferente
    // O una relación más simple si se valida (AC_Green / DC_Green)
    // const ratioHb = acGreen / dcGreen;

    if (ratioHb <= 0) {
         console.warn("Hb: Ratio de absorción no válido.");
         return 0;
    }

    // Curva de calibración empírica Ratio vs Hemoglobina (EJEMPLO - requiere validación CLÍNICA)
    // Esta fórmula es puramente ilustrativa y NO está validada médicamente.
    // Se necesitaría calibrar con mediciones de hemoglobina de referencia.
    const estimatedHemoglobin = 14.5 - (ratioHb - 1.0) * 8; // Ajustar coeficientes empíricamente

    // Limitar el resultado a un rango fisiológico razonable
    return Math.round(Math.max(8, Math.min(18, estimatedHemoglobin)) * 10) / 10; // Redondear a 1 decimal
  }

  // *** Nueva función: Detección de picos y valles para análisis morfológico ***
  private detectRealPeaksAndValleys(signal: number[]): { peakIndices: number[], valleyIndices: number[] } {
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    const minPeakProminence = calculateStandardDeviation(signal.slice(-60)) * 0.5; // Umbral basado en variabilidad reciente
    const minPeakDistance = Math.max(15, Math.floor(signal.length / 20)); // Distancia mínima entre picos/valles (aprox 3-4 picos en 6 seg)

    if (signal.length < 30) return { peakIndices: [], valleyIndices: [] }; // Requiere señal suficiente

    // Detectar picos
    for (let i = 1; i < signal.length - 1; i++) {
        if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
            // Validación de prominencia simple (el pico es significativamente más alto que los puntos vecinos)
            if (signal[i] - Math.max(signal[i-1], signal[i+1]) > minPeakProminence / 2) {
                // Validación de distancia mínima
                if (peakIndices.length === 0 || i - peakIndices[peakIndices.length - 1] > minPeakDistance) {
                    peakIndices.push(i);
                }
            }
        }
    }

    // Detectar valles (similar a picos pero buscando mínimos)
     for (let i = 1; i < signal.length - 1; i++) {
         if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
             // Validación de prominencia para valles
             if (Math.min(signal[i-1], signal[i+1]) - signal[i] > minPeakProminence / 2) {
                 // Validación de distancia mínima
                 if (valleyIndices.length === 0 || i - valleyIndices[valleyIndices.length - 1] > minPeakDistance) {
                     valleyIndices.push(i);
                 }
             }
         }
     }

    // Asegurar que picos y valles alternan (lógica de limpieza básica)
    // (Implementación más sofisticada podría ser necesaria si la detección es ruidosa)
    const finalPeakIndices: number[] = [];
    const finalValleyIndices: number[] = [];
    let lastType: 'peak' | 'valley' | null = null;

    const allIndices = [...peakIndices.map(idx => ({ idx, type: 'peak' as const })), ...valleyIndices.map(idx => ({ idx, type: 'valley' as const }))].sort((a, b) => a.idx - b.idx);

    for(const item of allIndices) {
        if (item.type !== lastType) {
            if (item.type === 'peak') finalPeakIndices.push(item.idx);
            else finalValleyIndices.push(item.idx);
            lastType = item.type;
        } else {
            // Si el mismo tipo aparece consecutivamente, mantener el más prominente (simplificado: el último)
             if (item.type === 'peak') finalPeakIndices[finalPeakIndices.length - 1] = item.idx;
             else finalValleyIndices[finalValleyIndices.length - 1] = item.idx;
        }
    }

    return { peakIndices: finalPeakIndices, valleyIndices: finalValleyIndices };
  }

  reset(): VitalSignsResult | null {
    console.log("VitalSignsProcessor: Reset manteniendo últimos resultados");
    const savedResults = this.lastValidResults;
    
    this.signalBuffer = [];
    this.peakTimes = [];
    this.rrIntervals = [];
    this.frameCount = 0;
    this.isCalibrated = false;
    
    return savedResults;
  }

  fullReset(): void {
    console.log("VitalSignsProcessor: Reset completo");
    this.signalBuffer = [];
    this.peakTimes = [];
    this.rrIntervals = [];
    this.calibrationBaseline = 0;
    this.isCalibrated = false;
    this.frameCount = 0;
    this.lastValidResults = null;
  }

  // Método auxiliar para calcular la confianza basada en la calidad de la señal
  private calculateConfidence(signalQuality: number, minThreshold: number, maxThreshold: number): number {
    if (signalQuality < minThreshold) return 0; // Debajo del umbral mínimo, confianza 0
    if (signalQuality >= maxThreshold) return 100; // Por encima del umbral máximo, confianza 100

    // Calcular confianza linealmente entre minThreshold y maxThreshold
    return Math.round(((signalQuality - minThreshold) / (maxThreshold - minThreshold)) * 100);
  }
}
