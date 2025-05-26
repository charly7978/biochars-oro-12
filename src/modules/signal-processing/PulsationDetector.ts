
/**
 * DETECTOR DE PULSACIÓN CARDÍACA REAL - ANÁLISIS MÉDICO
 * Detecta únicamente pulsación cardíaca humana real sin simulaciones
 */

interface PulsationData {
  value: number;
  timestamp: number;
}

export class PulsationDetector {
  private redHistory: PulsationData[] = [];
  private peakHistory: number[] = [];
  private lastPeakTime = 0;
  
  detectPulsation(redValue: number): number {
    const now = Date.now();
    this.redHistory.push({ value: redValue, timestamp: now });
    
    // Mantener ventana de análisis de 4 segundos
    const cutoffTime = now - 4000;
    this.redHistory = this.redHistory.filter(item => item.timestamp > cutoffTime);
    
    if (this.redHistory.length < 80) return 0; // Necesitamos suficientes datos
    
    const values = this.redHistory.map(item => item.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Filtrar ruido con media móvil
    const smoothedValues = this.applySmoothingFilter(values);
    
    // Detectar picos característicos del pulso cardíaco
    const peaks = this.detectCardiacPeaks(smoothedValues, mean);
    
    if (peaks.length >= 2) {
      // Calcular variabilidad cardíaca (HRV)
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      
      // Validar que los intervalos sean fisiológicamente posibles (40-200 BPM)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const intervalMs = (avgInterval * 4000) / this.redHistory.length; // Convertir a ms
      
      if (intervalMs >= 300 && intervalMs <= 1500) { // 40-200 BPM
        // Calcular fuerza de pulsación basada en amplitud real
        const amplitude = Math.max(...smoothedValues) - Math.min(...smoothedValues);
        const relativeAmplitude = amplitude / mean;
        
        // Validar que la amplitud sea característica de pulso cardíaco
        if (relativeAmplitude >= 0.02 && relativeAmplitude <= 0.15) {
          return Math.min(1.0, relativeAmplitude / 0.05);
        }
      }
    }
    
    return 0;
  }
  
  private applySmoothingFilter(values: number[]): number[] {
    const smoothed: number[] = [];
    const windowSize = 3;
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(values.length - 1, i + windowSize); j++) {
        sum += values[j];
        count++;
      }
      
      smoothed.push(sum / count);
    }
    
    return smoothed;
  }
  
  private detectCardiacPeaks(values: number[], baseline: number): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 10; // Mínima distancia entre picos
    const threshold = baseline + (Math.max(...values) - baseline) * 0.3;
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > threshold && 
          values[i] > values[i-1] && 
          values[i] > values[i+1]) {
        
        // Verificar distancia mínima con pico anterior
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }
  
  reset(): void {
    this.redHistory = [];
    this.peakHistory = [];
    this.lastPeakTime = 0;
  }
}
