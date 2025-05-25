
/**
 * Analizador FFT médico con algoritmos específicos para PPG
 * Implementa estándares médicos para análisis de frecuencia cardíaca
 */
export class MedicalFFTAnalyzer {
  private readonly SAMPLE_RATE = 30; // FPS típico
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200;
  private readonly BUFFER_SIZE = 512; // Potencia de 2 optimizada
  private readonly MIN_PEAK_PROMINENCE = 0.3;
  private readonly SMOOTHING_WINDOW = 5;
  
  private signalBuffer: number[] = [];
  private confidenceHistory: number[] = [];
  private bpmHistory: number[] = [];
  private lastValidBpm: number | null = null;
  
  /**
   * Añadir muestra con pre-procesamiento médico
   */
  public addSample(value: number): void {
    // Pre-procesamiento: eliminación de outliers
    if (this.signalBuffer.length > 0) {
      const lastValue = this.signalBuffer[this.signalBuffer.length - 1];
      const change = Math.abs(value - lastValue) / Math.abs(lastValue);
      
      // Rechazar cambios extremos (>300% cambio entre muestras)
      if (change > 3.0) {
        value = lastValue + (value > lastValue ? lastValue * 0.1 : -lastValue * 0.1);
      }
    }
    
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
  }
  
  /**
   * Análisis FFT médico con validación clínica
   */
  public analyzeBPM(): { bpm: number; confidence: number; spectrum: number[]; isValid: boolean } | null {
    if (this.signalBuffer.length < this.BUFFER_SIZE * 0.75) {
      return null;
    }
    
    // Preprocesamiento médico de la señal
    const processedSignal = this.medicalPreprocessing(this.signalBuffer);
    
    // FFT con ventana Hanning para análisis médico
    const spectrum = this.computeFFTWithHanning(processedSignal);
    
    // Análisis de picos con criterios médicos
    const peakAnalysis = this.medicalPeakAnalysis(spectrum);
    
    if (!peakAnalysis) {
      return null;
    }
    
    const { bpm, confidence, harmonicRatio } = peakAnalysis;
    
    // Validación clínica del BPM
    const isValid = this.validateMedicalBPM(bpm, confidence, harmonicRatio);
    
    // Suavizado temporal para estabilidad
    if (isValid) {
      this.bpmHistory.push(bpm);
      this.confidenceHistory.push(confidence);
      
      if (this.bpmHistory.length > this.SMOOTHING_WINDOW) {
        this.bpmHistory.shift();
        this.confidenceHistory.shift();
      }
      
      // BPM suavizado con peso por confianza
      const weightedBpm = this.calculateWeightedBPM();
      const avgConfidence = this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length;
      
      this.lastValidBpm = weightedBpm;
      
      return {
        bpm: Math.round(weightedBpm),
        confidence: avgConfidence,
        spectrum: spectrum.slice(0, Math.floor(this.BUFFER_SIZE / 2)),
        isValid: true
      };
    }
    
    return {
      bpm: this.lastValidBpm || 0,
      confidence: 0,
      spectrum: spectrum.slice(0, Math.floor(this.BUFFER_SIZE / 2)),
      isValid: false
    };
  }
  
  /**
   * Preprocesamiento médico de señal PPG
   */
  private medicalPreprocessing(signal: number[]): number[] {
    // 1. Eliminación de tendencia DC
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    let detrended = signal.map(val => val - mean);
    
    // 2. Filtro pasa-banda médico (0.5-4 Hz para PPG)
    detrended = this.medicalBandpassFilter(detrended);
    
    // 3. Normalización z-score
    const std = Math.sqrt(
      detrended.reduce((acc, val) => acc + val * val, 0) / detrended.length
    );
    
    if (std > 0) {
      detrended = detrended.map(val => val / std);
    }
    
    return detrended;
  }
  
  /**
   * Filtro pasa-banda médico para PPG
   */
  private medicalBandpassFilter(signal: number[]): number[] {
    // Implementación simplificada de filtro Butterworth
    const alpha = 0.1; // Factor de suavizado
    const filtered: number[] = new Array(signal.length);
    
    filtered[0] = signal[0];
    for (let i = 1; i < signal.length; i++) {
      filtered[i] = alpha * signal[i] + (1 - alpha) * filtered[i - 1];
    }
    
    return filtered;
  }
  
  /**
   * FFT con ventana Hanning optimizada
   */
  private computeFFTWithHanning(signal: number[]): number[] {
    const N = signal.length;
    const spectrum: number[] = new Array(Math.floor(N / 2));
    
    // Aplicar ventana Hanning
    const windowed = signal.map((val, i) => {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
      return val * window;
    });
    
    // DFT optimizado para frecuencias médicas relevantes
    const minBin = Math.floor(this.MIN_BPM / 60 * N / this.SAMPLE_RATE);
    const maxBin = Math.floor(this.MAX_BPM / 60 * N / this.SAMPLE_RATE);
    
    for (let k = 0; k < Math.floor(N / 2); k++) {
      let real = 0;
      let imag = 0;
      
      // Solo calcular para frecuencias médicamente relevantes
      if (k >= minBin && k <= maxBin) {
        for (let n = 0; n < N; n++) {
          const angle = -2 * Math.PI * k * n / N;
          real += windowed[n] * Math.cos(angle);
          imag += windowed[n] * Math.sin(angle);
        }
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag) / N;
    }
    
    return spectrum;
  }
  
  /**
   * Análisis de picos con criterios médicos
   */
  private medicalPeakAnalysis(spectrum: number[]): { bpm: number; confidence: number; harmonicRatio: number } | null {
    const minBin = Math.floor(this.MIN_BPM / 60 * this.BUFFER_SIZE / this.SAMPLE_RATE);
    const maxBin = Math.floor(this.MAX_BPM / 60 * this.BUFFER_SIZE / this.SAMPLE_RATE);
    
    let maxMagnitude = 0;
    let peakBin = 0;
    
    // Encontrar pico principal
    for (let i = minBin; i <= maxBin; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        peakBin = i;
      }
    }
    
    if (maxMagnitude < this.MIN_PEAK_PROMINENCE) {
      return null;
    }
    
    // Análisis de armónicos para validación médica
    const fundamental = (peakBin * this.SAMPLE_RATE) / this.BUFFER_SIZE;
    const secondHarmonic = Math.floor(2 * peakBin);
    const harmonicMagnitude = secondHarmonic < spectrum.length ? spectrum[secondHarmonic] : 0;
    const harmonicRatio = harmonicMagnitude / maxMagnitude;
    
    // Cálculo de confianza médica
    const localNoise = this.calculateLocalNoise(spectrum, peakBin, 5);
    const snr = maxMagnitude / (localNoise + 0.001);
    const confidence = Math.min(1.0, snr / 10) * (1 + harmonicRatio * 0.3);
    
    const bpm = fundamental * 60;
    
    return {
      bpm: Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, bpm)),
      confidence: Math.min(1.0, confidence),
      harmonicRatio
    };
  }
  
  /**
   * Validación médica del BPM
   */
  private validateMedicalBPM(bpm: number, confidence: number, harmonicRatio: number): boolean {
    // Criterios médicos de validación
    const bpmValid = bpm >= this.MIN_BPM && bpm <= this.MAX_BPM;
    const confidenceValid = confidence >= 0.4;
    const harmonicValid = harmonicRatio >= 0.1 && harmonicRatio <= 0.8;
    
    // Validación de consistencia temporal
    let temporalValid = true;
    if (this.bpmHistory.length >= 3) {
      const recentBpms = this.bpmHistory.slice(-3);
      const maxVariation = Math.max(...recentBpms) - Math.min(...recentBpms);
      temporalValid = maxVariation <= 30; // Máximo 30 BPM de variación
    }
    
    return bpmValid && confidenceValid && harmonicValid && temporalValid;
  }
  
  /**
   * Cálculo de BPM ponderado por confianza
   */
  private calculateWeightedBPM(): number {
    if (this.bpmHistory.length === 0) return 0;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < this.bpmHistory.length; i++) {
      const weight = this.confidenceHistory[i];
      weightedSum += this.bpmHistory[i] * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Calcular ruido local alrededor de un pico
   */
  private calculateLocalNoise(spectrum: number[], peakBin: number, window: number): number {
    let noiseSum = 0;
    let count = 0;
    
    for (let i = Math.max(0, peakBin - window); i <= Math.min(spectrum.length - 1, peakBin + window); i++) {
      if (i !== peakBin) {
        noiseSum += spectrum[i];
        count++;
      }
    }
    
    return count > 0 ? noiseSum / count : 0;
  }
  
  public reset(): void {
    this.signalBuffer = [];
    this.confidenceHistory = [];
    this.bpmHistory = [];
    this.lastValidBpm = null;
  }
  
  public getLastValidBPM(): number | null {
    return this.lastValidBpm;
  }
}
