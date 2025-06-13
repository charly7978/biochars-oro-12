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
    // Esto es un placeholder para un modelo de aprendizaje automático o regresión fisiológica.
    // La combinación de características debe basarse en datos validados clínicamente.
    
    // Ejemplo de un modelo de regresión lineal simple (placeholder, necesita datos de entrenamiento)
    // Coeficientes hipotéticos derivados de una investigación:
    const weightSpectral = 50;  // Impacto de la actividad vasomotora en glucosa
    const weightVascular = -20; // Impacto de la resistencia vascular (mayor resistencia -> menor pendiente de ascenso -> mayor glucosa)
    const weightMorphology = 0.5; // Impacto del AUC (mayor AUC -> mayor glucosa, o viceversa, depende de la morfología)

    // La estimación de glucosa se basa en la combinación lineal de las características
    let estimatedGlucose = 
      this.baselineGlucose + 
      (spectralFeatures.glucoseIndicator * weightSpectral) + 
      (vascularResistance * weightVascular) + 
      (morphologyIndex * weightMorphology);

    // Aplicar filtro temporal para estabilidad, sin ajustes circadianos heurísticos
    const smoothedGlucose = this.applyTemporalFilter(estimatedGlucose);
    
    // Calcular confianza y variabilidad basadas en la calidad de la señal y la consistencia de las características
    // La confianza y la variabilidad deben ser un reflejo de la robustez de la medición.
    const confidence = this.calculateConfidence(preprocessedSignal);
    const variability = this.calculateVariability();

    // Límites fisiológicos (estrictamente como clamps, no como parte del cálculo)
    const finalGlucose = Math.max(70, Math.min(180, Math.round(smoothedGlucose)));

    // Definir un rango basado en la estimación y la confianza/variabilidad
    // Un rango más amplio indica menor confianza o mayor variabilidad.
    const rangeOffset = (1 - confidence) * 30 + variability * 0.8; // Ajustar factores según investigación
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
    // 1. Eliminación de tendencia DC (baseline wander removal)
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let detrended = values.map(val => val - mean);

    // La señal ya viene pre-filtrada con Butterworth desde PPGSignalProcessor
    // Por lo tanto, solo necesitamos normalizarla aquí.
    const filtered = detrended; // Ya filtrada, solo se renombra para claridad

    // 2. Normalización (0 a 1)
    const minVal = Math.min(...filtered);
    const maxVal = Math.max(...filtered);
    if (maxVal - minVal === 0) return new Array(filtered.length).fill(0); // Evitar división por cero

    const normalized = filtered.map(val => (val - minVal) / (maxVal - minVal));

    return normalized;
  }
  
  private extractGlucoseSpectralFeatures(values: number[]): { glucoseIndicator: number } {
    const N = values.length;
    if (N === 0) return { glucoseIndicator: 0 };

    // Aplicar ventana Hanning para reducir el 'spectral leakage'
    const windowed = values.map((val, i) => 
      val * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)))
    );

    // Realizar una Transformada Discreta de Fourier (DFT) simplificada para obtener el espectro.
    // Para una FFT completa se necesitaría una implementación más robusta o una librería externa.
    const spectrum: number[] = new Array(Math.floor(N / 2));
    for (let k = 0; k < Math.floor(N / 2); k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += windowed[n] * Math.cos(angle);
        imag += windowed[n] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(real * real + imag * imag) / N;
    }

    // Definir bandas de frecuencia de interés para glucosa (ejemplo, basado en investigación genérica de PPG)
    // Estas bandas pueden necesitar afinación con investigación específica.
    const SAMPLE_RATE = 30; // Asumiendo 30 FPS
    const freqResolution = SAMPLE_RATE / N;

    // Frecuencias bajas (0.5-1.5 Hz) - relacionadas con actividad vasomotora
    const lowFreqMinBin = Math.floor(0.5 / freqResolution);
    const lowFreqMaxBin = Math.floor(1.5 / freqResolution);

    // Frecuencias medias (1.5-3.0 Hz) - relacionadas con la actividad cardíaca (primer y segundo armónico de HR)
    const midFreqMinBin = Math.floor(1.5 / freqResolution);
    const midFreqMaxBin = Math.floor(3.0 / freqResolution);

    // Frecuencias altas (3.0-8.0 Hz) - menos relacionadas directamente con glucosa, más con ruido y artefactos
    const highFreqMinBin = Math.floor(3.0 / freqResolution);
    const highFreqMaxBin = Math.floor(8.0 / freqResolution);

    let lowFreqPower = 0;
    for (let i = lowFreqMinBin; i <= lowFreqMaxBin && i < spectrum.length; i++) {
      lowFreqPower += spectrum[i] * spectrum[i]; // Potencia = Magnitud^2
    }

    let midFreqPower = 0;
    for (let i = midFreqMinBin; i <= midFreqMaxBin && i < spectrum.length; i++) {
      midFreqPower += spectrum[i] * spectrum[i];
    }

    let highFreqPower = 0;
    for (let i = highFreqMinBin; i <= highFreqMaxBin && i < spectrum.length; i++) {
      highFreqPower += spectrum[i] * spectrum[i];
    }

    // Usar una relación de potencia como indicador de glucosa. 
    // Por ejemplo, una relación entre la potencia de baja frecuencia y la potencia total.
    // La relación exacta debe ser científicamente validada.
    const totalPower = lowFreqPower + midFreqPower + highFreqPower;
    const glucoseIndicator = totalPower > 0 ? (lowFreqPower / totalPower) : 0; // Ejemplo: más baja frecuencia puede indicar algo

    return { glucoseIndicator };
  }
  
  private calculateVascularResistance(values: number[]): number {
    // Detectar picos y sus inicios para calcular la pendiente de ascenso (proxy de rigidez arterial)
    const peakIndices = this.findPeaks(values);
    if (peakIndices.length < 2) return 0; // Necesitamos al menos dos picos para calcular intervalos

    let resistanceScore = 0;
    let validSlopes = 0;

    for (const peakIndex of peakIndices) {
      const upstrokeStart = this.findUpstrokeStart(values, peakIndex);
      if (upstrokeStart !== -1 && upstrokeStart < peakIndex) {
        const slope = (values[peakIndex] - values[upstrokeStart]) / (peakIndex - upstrokeStart); // Amplitud/Tiempo
        
        // Una mayor pendiente de ascenso podría correlacionarse con menor resistencia vascular (e.g. en estados de normoglucemia)
        // La relación exacta debe ser validada científicamente. Esto es un placeholder.
        resistanceScore += slope; 
        validSlopes++;
      }
    }
    
    return validSlopes > 0 ? resistanceScore / validSlopes : 0; // Promedio de pendientes
  }
  
  private analyzePulseMorphologyForGlucose(values: number[]): number {
    // Calcular Área Bajo la Curva (AUC) de la onda de pulso normalizada
    // Un AUC mayor o cambios en la forma podrían correlacionarse con niveles de glucosa
    // Esto es un placeholder y debe basarse en investigación fisiológica.
    if (values.length === 0) return 0;

    let auc = 0;
    for (let i = 0; i < values.length - 1; i++) {
      // Aproximación trapezoidal del área
      auc += (values[i] + values[i + 1]) / 2;
    }

    // Normalizar AUC por la longitud de la señal para que sea comparable
    const normalizedAuc = auc / values.length;

    // La relación exacta y su impacto deben ser científicamente validados.
    // Esto es un ejemplo de cómo podría influir.
    return normalizedAuc * 10; // Ajustar factor de escalado
  }
  
  private findUpstrokeStart(values: number[], peakIndex: number): number {
    // Busca hacia atrás desde el pico para encontrar el inicio del ascenso (valle previo)
    if (peakIndex === 0) return -1;

    let current = peakIndex;
    // Buscar el punto donde la derivada cambia de negativa a positiva o llega a un mínimo local
    while (current > 0 && values[current] >= values[current - 1]) {
      current--;
    }
    // Retroceder un poco más para asegurar el inicio del ascenso
    return Math.max(0, current - 2); 
  }
  
  // Nuevo método para encontrar picos de forma más robusta (se podría refactorizar con utilities.ts)
  private findPeaks(values: number[]): number[] {
      const peakIndices: number[] = [];
      if (values.length < 5) return peakIndices; // Necesita suficientes puntos para detección

      for (let i = 2; i < values.length - 2; i++) {
          // Un pico es un punto que es mayor que sus vecinos cercanos
          if (values[i] > values[i-1] && values[i] > values[i+1] &&
              values[i] > values[i-2] && values[i] > values[i+2]) {
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
    return index > 0 && index < values.length - 1 && values[index] > values[index - 1] && values[index] > values[index + 1];
  }
  
  private calculateUpstrokeTime(values: number[], peakIndex: number): number {
    const start = this.findUpstrokeStart(values, peakIndex);
    if (start === -1) return 0;
    return peakIndex - start;
  }
  
  private calculateDownstrokeTime(values: number[], peakIndex: number): number {
    const N = values.length;
    if (peakIndex >= N - 1) return 0;

    let current = peakIndex;
    // Buscar el siguiente valle o el punto donde el valor deja de decrecer
    while (current < N - 1 && values[current] >= values[current + 1]) {
      current++;
    }
    // Retroceder un poco para asegurar el final del descenso
    return Math.min(N - 1, current + 2) - peakIndex;
  }
  
  private applyTemporalFilter(newValue: number): number {
    // Asegurar que solo se almacenen valores válidos para el historial
    if (newValue > 0) {
      this.glucoseHistory.push(newValue);
      if (this.glucoseHistory.length > 10) { // Mantener un historial de 10 mediciones
        this.glucoseHistory.shift();
      }
    }
    
    // Aplicar una media móvil simple para suavizar el resultado
    if (this.glucoseHistory.length === 0) return newValue; // Si no hay historial, devolver el valor actual

    const sum = this.glucoseHistory.reduce((a, b) => a + b, 0);
    return sum / this.glucoseHistory.length;
  }

  private calculateConfidence(signal: number[]): number {
    // Evaluar la confianza en la medición de glucosa
    // Esto debería basarse en la calidad de la señal de entrada, la consistencia de las características
    // y la estabilidad de las mediciones de glucosa a lo largo del tiempo.
    
    if (signal.length === 0) return 0;

    // Ejemplo: Confianza basada en la varianza de la señal (menos ruido = más confianza)
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const variance = signal.reduce((a, b) => a + (b - mean) ** 2, 0) / signal.length;
    const stdDev = Math.sqrt(variance);

    // Escalar la desviación estándar a una confianza (ej: inversa, saturando en 0-1)
    // Ajustar los parámetros para que reflejen la calidad real de la señal.
    const signalQualityConfidence = Math.max(0, 1 - (stdDev / 50)); // Si stdDev es 50, confianza 0; si es 0, confianza 1

    // También se puede incorporar la consistencia de las mediciones históricas de glucosa
    let historicalConsistencyConfidence = 1.0;
    if (this.glucoseHistory.length > 2) {
        const histStdDev = this.calculateStandardDeviation(this.glucoseHistory);
        // Si las mediciones históricas son muy variables, la confianza disminuye
        historicalConsistencyConfidence = Math.max(0, 1 - (histStdDev / 10)); // Ajustar factor
    }

    // Combinar confianzas (ej: promedio o producto)
    return (signalQualityConfidence + historicalConsistencyConfidence) / 2;
  }

  private calculateVariability(): number {
    // Medir la variabilidad de las estimaciones recientes de glucosa
    if (this.glucoseHistory.length < 2) return 0; // Se necesitan al menos 2 puntos para calcular variabilidad

    const stdDev = this.calculateStandardDeviation(this.glucoseHistory);
    // Normalizar la desviación estándar a un rango de variabilidad (ej: 0-1)
    // Un valor más alto indica mayor variabilidad.
    return Math.min(1, stdDev / 20); // Ajustar el divisor para escalar la variabilidad
  }
  
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  public calibrate(knownGlucose: number): void {
    // Ajustar la línea base de glucosa en función de una medición conocida.
    // Esto es crucial para la precisión y debe hacerse en condiciones controladas.
    this.baselineGlucose = knownGlucose;
    this.isCalibrated = true;
    console.log(`Glucosa calibrada a: ${knownGlucose} mg/dL`);
  }
  
  public reset(): void {
    this.glucoseHistory = [];
    this.baselineGlucose = 95; // Restablecer a un valor predeterminado normal
    this.isCalibrated = false;
    console.log("Procesador de glucosa reiniciado.");
  }
}
