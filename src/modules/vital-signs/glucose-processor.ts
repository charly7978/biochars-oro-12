export class GlucoseProcessor {
  private glucoseHistory: number[] = [];
  private baselineGlucose: number = 95; // mg/dL normal fasting
  private isCalibrated: boolean = false;
  
  /**
   * Calcula niveles de glucosa usando análisis avanzado de PPG
   */
  public calculateGlucose(ppgValues: number[]): {
    estimatedGlucose: number;
    glucoseRange: [number, number];
    confidence: number;
    variability: number;
    features: {
      spectralGlucoseIndicator: number;
      vascularResistanceIndex: number;
      pulseMorphologyScore: number;
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

    // Preprocesamiento avanzado de la señal
    const preprocessedSignal = this.preprocessPPGSignal(ppgValues);

    // Análisis de componentes espectrales relacionados con glucosa
    const spectralFeatures = this.extractGlucoseSpectralFeatures(preprocessedSignal);
    
    // Calcular índice de resistencia vascular
    const vascularResistance = this.calculateVascularResistance(preprocessedSignal);
    
    // Análisis de morfología de onda
    const morphologyIndex = this.analyzePulseMorphologyForGlucose(preprocessedSignal);
    
    // Algoritmo de estimación de glucosa basado en características reales
    // Esto es un placeholder. La lógica de combinación de características
    // se desarrollará en base a la investigación para evitar heurísticas.
    let estimatedGlucose = this.baselineGlucose; // Usar baseline calibrado

    // Ponderar las características con pesos derivados de la investigación
    // (estos pesos son ejemplos y se refinarán)
    estimatedGlucose += spectralFeatures.glucoseIndicator * 10; // Ejemplo: impactar más en la glucosa
    estimatedGlucose += vascularResistance * 5;
    estimatedGlucose += morphologyIndex * 7;

    // Aplicar filtro temporal para estabilidad, sin ajustes circadianos heurísticos
    const smoothedGlucose = this.applyTemporalFilter(estimatedGlucose);
    
    // Calcular confianza y variabilidad
    const confidence = this.calculateConfidence(preprocessedSignal);
    const variability = this.calculateVariability();

    // Límites fisiológicos (estrictamente como clamps, no como parte del cálculo)
    const finalGlucose = Math.max(70, Math.min(180, Math.round(smoothedGlucose)));

    // Definir un rango basado en la estimación y la variabilidad/confianza
    const rangeOffset = (1 - confidence) * 20 + variability * 0.5; // Ajustar según investigación
    const glucoseRange: [number, number] = [
      Math.max(70, finalGlucose - rangeOffset),
      Math.min(180, finalGlucose + rangeOffset),
    ];

    return {
      estimatedGlucose: finalGlucose,
      glucoseRange,
      confidence,
      variability,
      features: {
        spectralGlucoseIndicator: spectralFeatures.glucoseIndicator,
        vascularResistanceIndex: vascularResistance,
        pulseMorphologyScore: morphologyIndex,
      },
    };
  }
  
  private preprocessPPGSignal(values: number[]): number[] {
    // Implementación de preprocesamiento avanzada (ej. filtrado de Butterworth, eliminación de línea base)
    // Se utilizará una combinación de técnicas para asegurar la pureza de la señal.
    // Esto es crucial para los "cálculos reales".

    // 1. Eliminación de tendencia DC (baseline wander removal)
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let detrended = values.map(val => val - mean);

    // 2. Filtro pasa-banda (Butterworth)
    // Frecuencias típicas para PPG: 0.5 Hz - 8 Hz
    // La implementación de un filtro Butterworth completo puede ser compleja en JS.
    // Usaremos una aproximación o un filtro EMA/SMA más avanzado como paso inicial.
    // Por ahora, se usará un filtro simple de media móvil o EMA para suavizado y eliminación de ruido.
    // Posteriormente, se puede integrar una implementación más robusta de filtro IIR.
    const alpha = 0.1; // Factor de suavizado para EMA
    const filtered: number[] = new Array(detrended.length);
    if (detrended.length > 0) {
        filtered[0] = detrended[0];
        for (let i = 1; i < detrended.length; i++) {
            filtered[i] = alpha * detrended[i] + (1 - alpha) * filtered[i - 1];
        }
    } else {
        return [];
    }

    // 3. Normalización (0 a 1)
    const minVal = Math.min(...filtered);
    const maxVal = Math.max(...filtered);
    if (maxVal - minVal === 0) return new Array(filtered.length).fill(0); // Evitar división por cero

    const normalized = filtered.map(val => (val - minVal) / (maxVal - minVal));

    return normalized;
  }
  
  private extractGlucoseSpectralFeatures(values: number[]): { glucoseIndicator: number } {
    // Aplicar ventana Hanning
    const windowed = values.map((val, i) => 
      val * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (values.length - 1)))
    );
    
    // Análisis espectral simplificado enfocado en bandas específicas
    let lowFreqPower = 0;
    let midFreqPower = 0;
    let highFreqPower = 0;
    
    const N = windowed.length;
    
    // Calcular potencia en diferentes bandas de frecuencia
    for (let k = 1; k < N / 2; k++) {
      let real = 0, imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += windowed[n] * Math.cos(angle);
        imag += windowed[n] * Math.sin(angle);
      }
      
      const power = (real * real + imag * imag) / (N * N);
      
      if (k < N / 8) {
        lowFreqPower += power;
      } else if (k < N / 4) {
        midFreqPower += power;
      } else {
        highFreqPower += power;
      }
    }
    
    // Relación de potencias específica para glucosa
    const totalPower = lowFreqPower + midFreqPower + highFreqPower;
    const glucoseIndicator = totalPower > 0 ? 
      (midFreqPower - lowFreqPower) / totalPower : 0;
    
    return { glucoseIndicator };
  }
  
  private calculateVascularResistance(values: number[]): number {
    // Detectar picos sistólicos y valles diastólicos
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    // Utilizar una ventana de detección más robusta y considerar la prominencia
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1] && 
          values[i] > values[i-2] && values[i] > values[i+2]) {
        peaks.push(values[i]);
      }
      
      if (values[i] < values[i-1] && values[i] < values[i+1] && 
          values[i] < values[i-2] && values[i] < values[i+2]) {
        valleys.push(values[i]);
      }
    }
    
    if (peaks.length === 0 || valleys.length === 0) return 0;
    
    const avgPeak = peaks.reduce((a, b) => a + b, 0) / peaks.length;
    const avgValley = valleys.reduce((a, b) => a + b, 0) / valleys.length;
    
    // Índice de resistencia vascular (ajustado para ser más representativo de la fisiología)
    // Evitar división por cero o valores muy pequeños en avgPeak
    const resistance = avgPeak > 0 ? avgValley / avgPeak : 0;
    
    // Mapear la resistencia a un indicador de glucosa. 
    // Esta relación es compleja y se basará en investigaciones, no en valores arbitrarios.
    // Por ahora, se usa una función de mapeo que se ajustará según la investigación real.
    // Un valor más alto de resistencia podría correlacionarse con una mayor glucosa.
    const glucoseContribution = (resistance - 0.7) * 10; // Ejemplo: ajustar el factor y el offset

    return Math.max(-10, Math.min(10, glucoseContribution)); // Limitar el impacto
  }
  
  private analyzePulseMorphologyForGlucose(values: number[]): number {
    // Buscar características de forma asociadas con glucosa elevada
    const derivatives = this.calculateDerivatives(values);
    
    // Analizar tiempo de subida, tiempo de bajada y forma de onda
    let morphologyScore = 0;
    let validPulses = 0;
    
    const peakIndices = this.findPeaks(values); // Reutilizar/mejorar la detección de picos
    
    for (const peakIndex of peakIndices) {
        if (peakIndex > 0 && peakIndex < values.length - 1) {
            const upstrokeTime = this.calculateUpstrokeTime(values, peakIndex);
            const downstrokeTime = this.calculateDownstrokeTime(values, peakIndex);

            if (upstrokeTime > 0 && downstrokeTime > 0) {
                // Relación upstroke/downstroke como indicador de rigidez arterial, correlacionada con glucosa
                const ratio = upstrokeTime / downstrokeTime;
                // La relación exacta y su impacto deben ser científicamente validados.
                // Este es un ejemplo de cómo podría influir.
                morphologyScore += Math.max(-0.5, Math.min(0.5, (ratio - 1.0) * 5)); // Ajustar el factor y el offset
                validPulses++;
            }

            // También se pueden analizar otras características morfológicas, como:
            // - Ancho de pulso
            // - Área bajo la curva
            // - Índice de aumento (Augmentation Index)
            // Esto requeriría la implementación de funciones adicionales.
        }
    }
    
    return validPulses > 0 ? morphologyScore / validPulses : 0;
  }
  
  // Nuevo método para encontrar picos de forma más robusta (se podría refactorizar con utilities.ts)
  private findPeaks(values: number[]): number[] {
      const peakIndices: number[] = [];
      if (values.length < 5) return peakIndices; // Necesita suficientes puntos para detección

      for (let i = 2; i < values.length - 2; i++) {
          // Un pico es un punto que es mayor que sus vecinos cercanos
          if (values[i] > values[i-1] && values[i] > values[i-2] &&
              values[i] > values[i+1] && values[i] > values[i+2]) {
              peakIndices.push(i);
          }
      }
      return peakIndices;
  }

  private calculateDerivatives(values: number[]): number[] {
    const derivatives: number[] = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    return derivatives;
  }
  
  private isPeak(values: number[], index: number): boolean {
    return index > 2 && index < values.length - 2 &&
           values[index] > values[index-1] && values[index] > values[index+1] &&
           values[index] > values[index-2] && values[index] > values[index+2];
  }
  
  private calculateUpstrokeTime(values: number[], peakIndex: number): number {
    let startIndex = peakIndex;
    const peakValue = values[peakIndex];
    // Umbral relativo para detectar el inicio de la subida
    const threshold = peakValue * 0.1; // Ajustar umbral para mayor precisión
    
    for (let i = peakIndex - 1; i >= 0; i--) { // Recorrer hacia atrás hasta el inicio del pulso
      if (values[i] < threshold || (i > 0 && values[i] <= values[i-1])) { // Buscar el punto de inflexión o donde la señal baja significativamente
        startIndex = i;
        break;
      }
      startIndex = i; // En caso de no encontrar un umbral claro, usar el punto más bajo antes del pico
    }
    
    return (peakIndex - startIndex) > 0 ? (peakIndex - startIndex) : 0;
  }
  
  private calculateDownstrokeTime(values: number[], peakIndex: number): number {
    let endIndex = peakIndex;
    const peakValue = values[peakIndex];
    // Umbral relativo para detectar el final de la bajada
    const threshold = peakValue * 0.1; // Ajustar umbral para mayor precisión
    
    for (let i = peakIndex + 1; i < values.length; i++) { // Recorrer hacia adelante hasta el final del pulso
      if (values[i] < threshold || (i < values.length - 1 && values[i] >= values[i+1])) { // Buscar el punto de inflexión o donde la señal sube significativamente
        endIndex = i;
        break;
      }
      endIndex = i; // En caso de no encontrar un umbral claro, usar el punto más bajo después del pico
    }
    
    return (endIndex - peakIndex) > 0 ? (endIndex - peakIndex) : 0;
  }
  
  private applyTemporalFilter(newValue: number): number {
    this.glucoseHistory.push(newValue);
    if (this.glucoseHistory.length > 30) { // Aumentar la ventana del filtro temporal
      this.glucoseHistory.shift();
    }
    
    // Utilizar una media ponderada más sofisticada o filtro de Kalman si es posible
    // Por ahora, se mantiene un filtro de mediana y media ponderada, pero con mayor historial.
    const sorted = [...this.glucoseHistory].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Mayor peso al valor actual, pero suavizado por el historial
    return 0.8 * newValue + 0.2 * median;
  }

  private calculateConfidence(signal: number[]): number {
    // Implementar lógica para calcular la confianza de la medición
    // Basado en calidad de la señal, estabilidad, detección de picos, etc.
    // Un ejemplo simple: basado en la amplitud de la señal y la consistencia de los picos.
    if (signal.length === 0) return 0;

    const minVal = Math.min(...signal);
    const maxVal = Math.max(...signal);
    const amplitude = maxVal - minVal;

    // Calcular la variabilidad de los picos para la consistencia
    const peaks = this.findPeaks(signal);
    if (peaks.length < 5) return 0.2; // Baja confianza si no hay suficientes picos

    const peakValues = peaks.map(p => signal[p]);
    const peakStdDev = this.calculateStandardDeviation(peakValues); // Se asume que existe o se creará este método.

    // La confianza es mayor si la amplitud es buena y la variabilidad de los picos es baja
    // Estos factores de ponderación y umbrales deben ser refinados con datos reales y validación.
    let confidence = 0.5; // Base
    if (amplitude > 0.5) confidence += 0.2; // Buena amplitud
    if (peakStdDev < 0.1) confidence += 0.3; // Picos consistentes

    return Math.min(1.0, confidence);
  }

  private calculateVariability(): number {
    // Implementar lógica para calcular la variabilidad en las lecturas de glucosa
    // Esto podría basarse en la desviación estándar del glucoseHistory o en la variabilidad latido a latido del PPG.
    if (this.glucoseHistory.length < 5) return 0;

    const currentStdDev = this.calculateStandardDeviation(this.glucoseHistory);
    // Mapear la desviación estándar a una escala de variabilidad (0-1)
    // Ajustar el factor de escala según el rango esperado de desviación estándar para glucosa.
    return Math.min(1.0, currentStdDev / 20); // Ejemplo: si 20 es una desviación estándar alta para glucosa
  }
  
  // Asumiendo que este método se definirá o se importará de utils.ts
  private calculateStandardDeviation(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(avgSqDiff);
  }
  
  public calibrate(knownGlucose: number): void {
    this.baselineGlucose = knownGlucose;
    this.isCalibrated = true;
  }
  
  public reset(): void {
    this.glucoseHistory = [];
  }
}
