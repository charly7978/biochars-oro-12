/**
 * NÚCLEO DE PROCESAMIENTO DE SEÑALES SIMPLIFICADO
 * Responsable solo del procesamiento de la señal PPG
 */

import { OptimizedKalmanFilter } from './OptimizedKalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { isFingerPresent } from './FingerDetectionCore';
import { bandpassFilter, normalizeSignal } from './FrameProcessor';
import { detectPeaks } from './SignalAnalyzer';

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
      // Baseline adaptativo más rápido para señales débiles
      this.baseline = this.baseline * 0.97 + redValue * 0.03;
    }

    // Filtrado Kalman
    const kalmanFiltered = this.kalmanFilter.filter(redValue);

    // Filtrado Savitzky-Golay menos agresivo (ventana más pequeña si es configurable)
    const sgFiltered = this.sgFilter.filter(kalmanFiltered);

    // Normalización respecto al baseline
    const normalized = sgFiltered - this.baseline;

    // Amplificación dinámica: aumentar mínimo y máximo para señales débiles
    const amplificationFactor = this.calculateDynamicAmplification();
    const amplified = normalized * amplificationFactor;

    // Actualizar historial de señal *amplificada*
    this.signalHistory.push(amplified);
    if (this.signalHistory.length > 100) {
      this.signalHistory.shift();
    }

    // Diagnóstico: log de rango de señal y amplificación
    if (process.env.NODE_ENV === "development" && Math.random() < 0.01) {
      const min = Math.min(...this.signalHistory);
      const max = Math.max(...this.signalHistory);
      console.log("[SignalProcessingCore] Diagnóstico señal:", {
        raw: redValue,
        kalmanFiltered,
        sgFiltered,
        baseline: this.baseline,
        normalized,
        amplified,
        min,
        max,
        amplificationFactor
      });
    }

    return {
      rawValue: redValue,
      filteredValue: sgFiltered,
      amplifiedValue: amplified,
      timestamp: Date.now()
    };
  }

  /**
   * Calcular factor de amplificación dinámico
   */
  private calculateDynamicAmplification(): number {
    if (this.signalHistory.length < 20) return 10; // Aumentar mínimo
    // Usar el historial de la señal *ya procesada y amplificada* para estimar su rango dinámico
    const recentProcessedSignal = this.signalHistory.slice(-20);
    const minVal = Math.min(...recentProcessedSignal);
    const maxVal = Math.max(...recentProcessedSignal);
    const currentAmplitude = maxVal - minVal;

    const TARGET_AMPLITUDE = 80; // Aumentar amplitud deseada
    const MIN_AMP_FACTOR = 10;   // Aumentar mínimo
    const MAX_AMP_FACTOR = 60;   // Aumentar máximo

    if (currentAmplitude < 1e-6) return MAX_AMP_FACTOR; // Evitar división por cero

    let factor = TARGET_AMPLITUDE / currentAmplitude;

    // Limitar el factor para evitar amplificación excesiva o insuficiente
    factor = Math.max(MIN_AMP_FACTOR, Math.min(MAX_AMP_FACTOR, factor));

    return factor;
  }

  /**
   * Estimación de ruido (placeholder para futura implementación más robusta)
   * Por ahora, se basa en la desviación estándar de la señal *cruda* reciente.
   */
  public getNoiseEstimate(rawRedValuesHistory: number[]): number {
    if (rawRedValuesHistory.length < 10) return 5; // Valor por defecto mayor
    
    const recentRaw = rawRedValuesHistory.slice(-10);
    const mean = recentRaw.reduce((a,b) => a+b,0) / recentRaw.length;
    const variance = recentRaw.reduce((acc, val) => acc + Math.pow(val - mean, 2),0) / recentRaw.length;
    const stdDev = Math.sqrt(variance);
    
    // El ruido podría ser proporcional a la desviación estándar de la señal cruda
    // o una fracción de ella si hay mucha variabilidad fisiológica.
    // Esto es una estimación simple y necesita ser mejorada.
    return Math.max(1, stdDev * 0.5); // Evitar ruido cero
  }
  
  /**
   * Obtener estadísticas de la señal
   */
  getSignalStats() {
    if (this.signalHistory.length < 10) return { mean: 0, variance: 0, snr: 0 };
    
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

export function analyzeFrame(
  frame: Uint8ClampedArray,
  width: number,
  height: number,
  rawSignal: number[]
): { valid: boolean, peaks: number[], filtered: number[] } {
  const finger = isFingerPresent(frame, width, height);
  if (!finger) {
    if (process.env.NODE_ENV === "development") {
      console.log("[analyzeFrame] Dedo no detectado");
    }
    return { valid: false, peaks: [], filtered: [] };
  }
  // Filtrado y normalización
  const filtered = bandpassFilter(rawSignal, 30, 0.5, 4);
  const norm = normalizeSignal(filtered);
  const peaks = detectPeaks(norm, 0.12, 8); // Umbral y distancia más permisivos

  // Validación: al menos 2 picos en 8 segundos (~240 frames a 30fps)
  const valid = peaks.length >= 2;
  if (process.env.NODE_ENV === "development") {
    console.log("analyzeFrame", { finger, peaks, normSample: norm.slice(-10), valid });
  }
  if (!valid) return { valid: false, peaks: [], filtered: norm };
  return { valid: true, peaks, filtered: norm };
}
