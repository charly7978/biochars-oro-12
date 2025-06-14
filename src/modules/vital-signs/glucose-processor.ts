import { calculateAC, calculateDC, findPeaksAndValleys, calculateStandardDeviation } from "../vital-signs/utils";
import { SavitzkyGolayFilter } from "../signal-processing/SavitzkyGolayFilter";

export class GlucoseProcessor {
  private glucoseHistory: number[] = [];
  private baselineGlucose: number = 95; // mg/dL normal fasting
  private isCalibrated: boolean = false;
  
  // Propiedades para almacenar los resultados del filtro Savitzky-Golay
  private savitzkyGolayFilter: SavitzkyGolayFilter;
  private lastFilteredSignal: number[] = [];
  fullReset: any;
  
  constructor() {
    this.savitzkyGolayFilter = new SavitzkyGolayFilter(15); // Tamaño de ventana ajustado para PPG, puede necesitar optimización
  }

  /**
   * Calcula niveles de glucosa usando análisis avanzado de PPG
   */
  public calculateGlucose(ppgValues: number[]): {
    estimatedGlucose: number;
    glucoseRange: [number, number];
    confidence: number;
    variability: number;
    features: {
      spectralGlucoseIndicator: number; // Reutilizado para un índice combinado
      vascularResistanceIndex: number; // Reutilizado para el índice de perfusión
      pulseMorphologyScore: number; // Reutilizado para la variabilidad del pulso
    };
  } {
    if (ppgValues.length < 60) {
      return {
        estimatedGlucose: 0,
        glucoseRange: [0, 0],
        confidence: 0,
        variability: 0,
        features: {
          spectralGlucoseIndicator: 0,
          vascularResistanceIndex: 0,
          pulseMorphologyScore: 0,
        },
      };
    }

    // 1. Preprocesamiento: Filtrado Savitzky-Golay
    const filteredPPG: number[] = [];
    for (const value of ppgValues) {
      filteredPPG.push(this.savitzkyGolayFilter.filter(value));
    }
    this.lastFilteredSignal = filteredPPG; // Almacenar para futuros cálculos si es necesario

    // 2. Extracción de características
    const ac = calculateAC(filteredPPG);
    const dc = calculateDC(filteredPPG);
    const perfusionIndex = dc > 0 ? (ac / dc) * 100 : 0; // Índice de perfusión (AC/DC ratio)
    
    const { peakIndices } = findPeaksAndValleys(filteredPPG);
    const { rrIntervals, rrStdDev } = this.calculateRRIntervalsAndStdDev(peakIndices);
    const pulseVariability = rrStdDev; // Usar la desviación estándar de los intervalos RR como variabilidad del pulso

    const normalizedAmplitude = this.normalizeSignalAmplitude(filteredPPG);
    
    // Coeficientes ilustrativos (necesitarían ser determinados por entrenamiento con datos reales)
    // Estos valores son PLACEHOLDERS y deben ser calibrados en un entorno real.
    // La relación es compleja y no lineal en la realidad.
    const weightPerfusion = -0.5; // Mayor índice de perfusión podría indicar menor glucosa (negativa)
    const weightPulseVariability = 0.2; // Mayor variabilidad del pulso podría correlacionarse con glucosa (positiva)
    const weightNormalizedAmplitude = 0.8; // La amplitud puede variar con la glucosa

    // 3. Estimación de glucosa (modelo de regresión lineal simple)
    let estimatedGlucose = 
      this.baselineGlucose + 
      (perfusionIndex * weightPerfusion) + 
      (pulseVariability * weightPulseVariability) + 
      (normalizedAmplitude * weightNormalizedAmplitude);
    
    // Asegurar que la glucosa esté en un rango fisiológico razonable
    estimatedGlucose = Math.max(70, Math.min(250, estimatedGlucose)); // Ajustar límites según sea necesario
    
    // Aplicar filtro temporal a la estimación (para estabilidad)
    this.glucoseHistory.push(estimatedGlucose);
    if (this.glucoseHistory.length > 10) {
      this.glucoseHistory.shift();
    }
    const smoothedGlucose = this.glucoseHistory.reduce((a, b) => a + b, 0) / this.glucoseHistory.length;

    // 4. Cálculo de confianza y variabilidad de la medición
    // Basado en la calidad de la señal de entrada y la consistencia de las características.
    const confidence = this.calculateConfidence(filteredPPG, perfusionIndex, pulseVariability, normalizedAmplitude);
    const variability = this.calculateVariability(this.glucoseHistory);

    // Definir un rango basado en la estimación y la confianza/variabilidad
    const rangeOffset = (1 - confidence) * 20 + variability * 0.5; // Ajustar factores
    const glucoseRange: [number, number] = [
      Math.max(70, smoothedGlucose - rangeOffset),
      Math.min(250, smoothedGlucose + rangeOffset),
    ];

    return {
      estimatedGlucose: Math.round(smoothedGlucose),
      glucoseRange,
      confidence,
      variability,
      features: {
        spectralGlucoseIndicator: perfusionIndex, // Usado para PI
        vascularResistanceIndex: normalizedAmplitude, // Usado para amplitud normalizada
        pulseMorphologyScore: pulseVariability, // Usado para variabilidad del pulso
      },
    };
  }
  
  private calculateRRIntervalsAndStdDev(peakIndices: number[]): { rrIntervals: number[]; rrStdDev: number } {
    const rrIntervals: number[] = [];
    if (peakIndices.length < 2) {
      return { rrIntervals: [], rrStdDev: 0 };
    }

    for (let i = 1; i < peakIndices.length; i++) {
      rrIntervals.push(peakIndices[i] - peakIndices[i - 1]);
    }
    
    const rrStdDev = calculateStandardDeviation(rrIntervals);
    return { rrIntervals, rrStdDev };
  }
  
  private normalizeSignalAmplitude(values: number[]): number {
    if (values.length === 0) return 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    return mean > 0 ? range / mean : 0; // Amplitud relativa al nivel base
  }
  
  private calculateConfidence(filteredSignal: number[], perfusionIndex: number, pulseVariability: number, normalizedAmplitude: number): number {
    // Una confianza más alta se da con señales estables, un índice de perfusión razonable
    // y una variabilidad de pulso dentro de rangos normales.
    // Esto es un placeholder para una lógica de calidad de señal más avanzada.
    const signalStdDev = calculateStandardDeviation(filteredSignal); 
    
    let confidence = 1.0;
    
    // Reducir confianza si la desviación estándar de la señal es muy alta (ruido)
    if (signalStdDev > 0.05) { // Umbral arbitrario, necesita ajuste
      confidence -= Math.min(0.5, (signalStdDev - 0.05) * 5); 
    }
    
    // Reducir confianza si el índice de perfusión está fuera de un rango razonable
    if (perfusionIndex < 0.5 || perfusionIndex > 5.0) { // Rango arbitrario, necesita ajuste
      confidence -= 0.2;
    }

    // Reducir confianza si la variabilidad del pulso es anormalmente alta o baja (indica problemas)
    if (pulseVariability < 5 || pulseVariability > 20) { // Umbral arbitrario, necesita ajuste
      confidence -= 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence)); // Asegurar que esté entre 0 y 1
  }
  
  private calculateVariability(glucoseHistory: number[]): number {
    if (glucoseHistory.length < 5) return 0; // Se necesita un historial para calcular variabilidad
    return calculateStandardDeviation(glucoseHistory);
  }

  public calibrate(knownGlucose: number): void {
    // La calibración ahora afectará el baselineGlucose para ajustar el modelo.
    // Para una calibración real, se necesitarían múltiples puntos de datos y un modelo de regresión.
    // Aquí, simplemente ajustamos el baseline para que el modelo actual se aproxime al valor conocido.
    
    if (this.lastFilteredSignal.length > 0) {
      const ac = calculateAC(this.lastFilteredSignal);
      const dc = calculateDC(this.lastFilteredSignal);
      const perfusionIndex = dc > 0 ? (ac / dc) * 100 : 0;
      const { peakIndices } = findPeaksAndValleys(this.lastFilteredSignal);
      const { rrStdDev } = this.calculateRRIntervalsAndStdDev(peakIndices);
      const pulseVariability = rrStdDev;
      const normalizedAmplitude = this.normalizeSignalAmplitude(this.lastFilteredSignal);

      // Coeficientes ilustrativos para la calibración inversa
      const weightPerfusion = -0.5;
      const weightPulseVariability = 0.2;
      const weightNormalizedAmplitude = 0.8;

      // Calcular la "contribución" de las características al valor actual.
      const featuresContribution = 
        (perfusionIndex * weightPerfusion) + 
        (pulseVariability * weightPulseVariability) + 
        (normalizedAmplitude * weightNormalizedAmplitude);
      
      // Ajustar el baselineGlucose para que la ecuación dé el knownGlucose
      this.baselineGlucose = knownGlucose - featuresContribution;
      this.isCalibrated = true;
      console.log(`GlucoseProcessor: Calibrado. Nuevo baselineGlucose: ${this.baselineGlucose.toFixed(2)} mg/dL`);
    } else {
      console.warn("GlucoseProcessor: No hay suficientes datos para calibrar.");
      this.isCalibrated = false;
    }
  }

  public reset(): void {
    this.glucoseHistory = [];
    this.isCalibrated = false;
    this.savitzkyGolayFilter.reset(); // Restablecer el filtro
    this.lastFilteredSignal = [];
    this.baselineGlucose = 95; // Restablecer a un valor predeterminado normal
    console.log("GlucoseProcessor: Reset completo");
  }
}
