
/**
 * NÚCLEO DE PROCESAMIENTO DE SEÑALES SIMPLIFICADO
 * Responsable solo del procesamiento de la señal PPG
 */

import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';

export interface ProcessedSignalData {
  rawValue: number;
  filteredValue: number;
  amplifiedValue: number;
  timestamp: number;
}

export class SignalProcessingCore {
  private kalmanFilter: OptimizedKalmanFilter;
  private sgFilter: SavitzkyGolayFilter;
  private baseline: number = 0;
  private signalHistory: number[] = [];
  
  constructor() {
    this.kalmanFilter = new OptimizedKalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
  }
  
  /**
   * Procesar señal PPG simple y efectivo
   */
  processSignal(redValue: number, quality: number): ProcessedSignalData {
    // Establecer baseline inicial
    if (this.baseline === 0) {
      this.baseline = redValue;
    } else {
      // Adaptación lenta del baseline
      this.baseline = this.baseline * 0.99 + redValue * 0.01;
    }
    
    // Filtrado Kalman
    const kalmanFiltered = this.kalmanFilter.filter(redValue);
    
    // Filtrado Savitzky-Golay
    const sgFiltered = this.sgFilter.filter(kalmanFiltered);
    
    // Normalización respecto al baseline
    const normalized = sgFiltered - this.baseline;
    
    // Amplificación basada en calidad
    const amplificationFactor = this.calculateAmplification(quality);
    const amplified = normalized * amplificationFactor;
    
    // Actualizar historial
    this.signalHistory.push(amplified);
    if (this.signalHistory.length > 100) {
      this.signalHistory.shift();
    }
    
    return {
      rawValue: redValue,
      filteredValue: sgFiltered,
      amplifiedValue: amplified,
      timestamp: Date.now()
    };
  }
  
  /**
   * Calcular factor de amplificación basado en calidad
   */
  private calculateAmplification(quality: number): number {
    // Amplificación inversamente proporcional a la calidad
    if (quality > 70) return 8;   // Señal buena, poca amplificación
    if (quality > 50) return 15;  // Señal media, amplificación moderada
    return 25;                    // Señal débil, alta amplificación
  }
  
  /**
   * Obtener estadísticas de la señal
   */
  getSignalStats() {
    if (this.signalHistory.length < 10) {
      return { mean: 0, variance: 0, snr: 0 };
    }
    
    const mean = this.signalHistory.reduce((a, b) => a + b, 0) / this.signalHistory.length;
    const variance = this.signalHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.signalHistory.length;
    const snr = variance > 0 ? Math.abs(mean) / Math.sqrt(variance) : 0;
    
    return { mean, variance, snr };
  }
  
  reset(): void {
    this.baseline = 0;
    this.signalHistory = [];
    this.kalmanFilter.reset();
    this.sgFilter.reset();
  }
}
