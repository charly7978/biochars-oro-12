import { KalmanFilter } from './KalmanFilter';
import type { PPGFrame } from '@/types/signal';

export interface OptimizedSignal {
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
}

export class SignalOptimizer {
  private kalmanFilter: KalmanFilter;
  private readonly MIN_SIGNAL_STRENGTH = 0.1;
  private calibrationBuffer: number[] = [];
  
  constructor() {
    this.kalmanFilter = new KalmanFilter({
      processNoise: 0.01,
      measurementNoise: 0.1,
      estimateUncertainty: 1
    });
  }

  optimize(frame: PPGFrame): OptimizedSignal {
    // Extraer componente rojo (sensible a cambios de sangre)
    const rawRedSignal = this.extractRedChannel(frame);
    
    // Aplicar filtrado Kalman adaptativo
    const filteredSignal = this.kalmanFilter.filter(rawRedSignal);
    
    // Calcular métricas de calidad de señal
    const signalQuality = this.calculateSignalQuality(filteredSignal, frame);
    
    // Actualizar parámetros del filtro basado en calidad
    this.updateKalmanParameters(signalQuality);

    // Calcular métricas en tiempo real
    const metrics = this.calculateSignalMetrics(frame, filteredSignal);

    return {
      cleanSignal: filteredSignal,
      quality: signalQuality,
      metrics,
      feedback: {
        signalStrength: metrics.amplitude,
        noiseLevel: metrics.noiseLevel,
        isValid: signalQuality > this.MIN_SIGNAL_STRENGTH
      }
    };
  }

  private extractRedChannel(frame: PPGFrame): number {
    // Extraer y normalizar solo componente rojo
    const redSum = frame.data.reduce((sum, pixel, i) => {
      // Cada 4 bytes es un pixel RGBA, tomamos solo R
      return i % 4 === 0 ? sum + pixel : sum;
    }, 0);
    return redSum / (frame.width * frame.height * 255);
  }

  private calculateSignalQuality(signal: number, frame: PPGFrame): number {
    const snr = this.calculateSNR(frame);
    const stability = this.calculateStability(signal);
    return (snr + stability) / 2;
  }

  private calculateSignalMetrics(frame: PPGFrame, filteredSignal: number) {
    return {
      amplitude: Math.abs(filteredSignal),
      frequency: this.calculateFrequency(frame.data),
      noiseLevel: this.calculateNoiseLevel(frame.data),
      perfusionIndex: this.calculatePerfusionIndex(filteredSignal)
    };
  }

  private calculateFrequency(data: Uint8Array): number {
    // Implementar FFT o cruce por cero para frecuencia real
    const zeroCrossings = this.countZeroCrossings(data);
    return zeroCrossings / (data.length / 30); // Asumiendo 30fps
  }

  private calculateNoiseLevel(data: Uint8Array): number {
    // Calcular varianza local en ventana móvil
    const windowSize = 5;
    let totalVariance = 0;
    
    for (let i = 0; i < data.length - windowSize; i++) {
      const window = data.slice(i, i + windowSize);
      totalVariance += this.calculateVariance(window);
    }

    return totalVariance / (data.length - windowSize);
  }

  private calculatePerfusionIndex(signal: number): number {
    // PI real basado en AC/DC
    const ac = Math.abs(signal - this.calculateDC(this.calibrationBuffer));
    const dc = this.calculateDC(this.calibrationBuffer);
    return dc !== 0 ? (ac / dc) * 100 : 0;
  }

  private calculateVariance(values: Uint8Array | number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  }

  private calculateDC(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private countZeroCrossings(data: Uint8Array): number {
    let crossings = 0;
    const mean = this.calculateDC(Array.from(data));
    
    for (let i = 1; i < data.length; i++) {
      if ((data[i] - mean) * (data[i-1] - mean) < 0) {
        crossings++;
      }
    }
    
    return crossings;
  }
}

export class BidirectionalOptimizer {
  private readonly FILTER_SIZE = 10;
  private qualityScore = 1.0;

  optimize(signal: number): number {
    // Aplicar filtro bidireccional
    const filtered = this.applyFilter(signal);
    return filtered;
  }

  getQualityScore(): number {
    return this.qualityScore;
  }

  private applyFilter(value: number): number {
    return value * 0.95; // Simplificado para ejemplo
  }

  reset(): void {
    this.qualityScore = 1.0;
  }
}
