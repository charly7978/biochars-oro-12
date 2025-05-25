
/**
 * Analizador FFT para detección precisa de frecuencia cardíaca
 */
export class FFTAnalyzer {
  private readonly SAMPLE_RATE = 30; // FPS típico
  private readonly MIN_BPM = 45;
  private readonly MAX_BPM = 180;
  private signalBuffer: number[] = [];
  private readonly BUFFER_SIZE = 256; // Potencia de 2 para FFT eficiente
  
  /**
   * Añadir muestra al buffer
   */
  public addSample(value: number): void {
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
  }
  
  /**
   * Análisis FFT para detectar BPM
   */
  public analyzeBPM(): { bpm: number; confidence: number; spectrum: number[] } | null {
    if (this.signalBuffer.length < this.BUFFER_SIZE) {
      return null;
    }
    
    // Preparar señal para FFT
    const signal = this.preprocessSignal(this.signalBuffer);
    
    // FFT simplificado usando DFT
    const spectrum = this.computeDFT(signal);
    
    // Encontrar pico dominante en rango de frecuencia cardíaca
    const minFreq = this.MIN_BPM / 60; // Hz
    const maxFreq = this.MAX_BPM / 60; // Hz
    
    const minBin = Math.floor(minFreq * this.BUFFER_SIZE / this.SAMPLE_RATE);
    const maxBin = Math.floor(maxFreq * this.BUFFER_SIZE / this.SAMPLE_RATE);
    
    let maxMagnitude = 0;
    let peakBin = 0;
    
    for (let i = minBin; i <= maxBin; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        peakBin = i;
      }
    }
    
    if (maxMagnitude < 0.1) {
      return null; // Señal demasiado débil
    }
    
    // Convertir bin a BPM
    const frequency = (peakBin * this.SAMPLE_RATE) / this.BUFFER_SIZE;
    const bpm = Math.round(frequency * 60);
    
    // Calcular confianza basada en la prominencia del pico
    const avgMagnitude = spectrum.slice(minBin, maxBin + 1).reduce((a, b) => a + b, 0) / (maxBin - minBin + 1);
    const confidence = Math.min(1.0, maxMagnitude / (avgMagnitude * 3));
    
    return {
      bpm: Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, bpm)),
      confidence,
      spectrum: spectrum.slice(0, Math.floor(this.BUFFER_SIZE / 2))
    };
  }
  
  /**
   * Preprocesamiento de señal
   */
  private preprocessSignal(signal: number[]): number[] {
    // Remover tendencia DC
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    let detrended = signal.map(val => val - mean);
    
    // Aplicar ventana Hamming
    const windowed = detrended.map((val, i) => {
      const windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (signal.length - 1));
      return val * windowValue;
    });
    
    return windowed;
  }
  
  /**
   * DFT simplificado para análisis espectral
   */
  private computeDFT(signal: number[]): number[] {
    const N = signal.length;
    const spectrum: number[] = new Array(Math.floor(N / 2));
    
    for (let k = 0; k < Math.floor(N / 2); k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag) / N;
    }
    
    return spectrum;
  }
  
  public reset(): void {
    this.signalBuffer = [];
  }
}
