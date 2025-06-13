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

class CircularBuffer {
  private buffer: number[];
  private maxSize: number;
  private pointer: number = 0;
  private filled: boolean = false;

  constructor(size: number) {
    this.maxSize = size;
    this.buffer = new Array(size).fill(0);
  }

  push(value: number) {
    this.buffer[this.pointer] = value;
    this.pointer = (this.pointer + 1) % this.maxSize;
    if (this.pointer === 0) this.filled = true;
  }

  getValues(): number[] {
    if (!this.filled) return this.buffer.slice(0, this.pointer);
    return [...this.buffer.slice(this.pointer), ...this.buffer.slice(0, this.pointer)];
  }

  length(): number {
    return this.filled ? this.maxSize : this.pointer;
  }

  clear() {
    this.pointer = 0;
    this.filled = false;
    this.buffer.fill(0);
  }
}

export class SignalProcessingCore {
  private kalmanFilter: OptimizedKalmanFilter;
  private sgFilter: SavitzkyGolayFilter;
  private baseline: number = 0;
  private signalHistory: CircularBuffer;
  private lastPeakTimestamp: number = 0;
  private lastPeakValue: number = 0;
  private peakIndices: number[] = [];
  private lastPeakIndex: number = -10;
  private PEAK_MIN_DISTANCE = 8; // frames (ajusta según tu FPS)
  private PEAK_THRESHOLD = 8;    // ajusta según la amplitud de tu señal

  constructor() {
    this.kalmanFilter = new OptimizedKalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
    this.signalHistory = new CircularBuffer(100);
  }
  
  /**
   * Procesar señal PPG y detectar latidos
   */
  processSignal(redValue: number, quality: number): ProcessedSignalData {
    // Baseline adaptativo rápido pero estable
    if (this.baseline === 0) {
      this.baseline = redValue;
    } else {
      this.baseline = this.baseline * 0.98 + redValue * 0.02;
    }

    // Filtrado Kalman
    const kalmanFiltered = this.kalmanFilter.filter(redValue);

    // Filtrado Savitzky-Golay
    const sgFiltered = this.sgFilter.filter(kalmanFiltered);

    // Normalización respecto al baseline
    const normalized = sgFiltered - this.baseline;

    // Amplificación dinámica
    const amplificationFactor = this.calculateDynamicAmplification();
    const amplified = normalized * amplificationFactor;

    // Actualizar historial de señal *amplificada*
    this.signalHistory.push(amplified);
    if (this.signalHistory.length > 100) this.signalHistory.shift();

    // Detección de picos (latidos) sobre la señal amplificada
    this.detectPeaks();

    return {
      rawValue: redValue,
      filteredValue: sgFiltered,
      amplifiedValue: amplified,
      timestamp: Date.now()
    };
  }

  /**
   * Detección de picos en la señal amplificada.
   * Guarda los índices de los picos recientes en this.peakIndices.
   */
  private detectPeaks() {
    const sig = this.signalHistory;
    const len = sig.length;
    if (len < 3) return;

    // Solo busca pico en el último punto agregado
    const i = len - 2;
    if (
      i - this.lastPeakIndex > this.PEAK_MIN_DISTANCE &&
      sig[i] > this.PEAK_THRESHOLD &&
      sig[i] > sig[i - 1] &&
      sig[i] > sig[i + 1]
    ) {
      this.peakIndices.push(i);
      this.lastPeakIndex = i;
      // Mantén solo los últimos 20 picos
      if (this.peakIndices.length > 20) this.peakIndices.shift();
    }
  }

  /**
   * Devuelve los índices de los picos detectados (latidos) respecto al buffer actual.
   */
  public getPeakIndices(): number[] {
    // Ajusta los índices para que sean relativos al array actual
    const offset = this.signalHistory.length - 100;
    return this.peakIndices.map(idx => idx - offset).filter(idx => idx >= 0);
  }

  /**
   * Calcular factor de amplificación dinámico
   */
  private calculateDynamicAmplification(): number {
    const history = this.signalHistory.getValues();
    if (history.length < 20) return 10;
    const minVal = Math.min(...history);
    const maxVal = Math.max(...history);
    const currentAmplitude = maxVal - minVal;

    const TARGET_AMPLITUDE = 60;
    const MIN_AMP_FACTOR = 8;
    const MAX_AMP_FACTOR = 40;

    if (currentAmplitude < 1e-6) return MAX_AMP_FACTOR;

    let factor = TARGET_AMPLITUDE / currentAmplitude;
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
    const history = this.signalHistory.getValues();
    if (history.length < 10) return { mean: 0, variance: 0, snr: 0 };
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / history.length;
    const snr = variance > 0 ? Math.abs(mean) / Math.sqrt(variance) : 0;
    return { mean, variance, snr };
  }
  
  reset(): void {
    this.baseline = 0;
    this.signalHistory.clear();
    this.kalmanFilter.reset();
    this.sgFilter.reset();
  }
}

// Ajusta la detección de picos para mayor sensibilidad
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
  // Umbral más bajo y menor distancia para captar latidos débiles
  const peaks = detectPeaks(norm, 0.08, 6);

  // Validación: al menos 2 picos en 8 segundos (~240 frames a 30fps)
  const valid = peaks.length >= 2;
  if (process.env.NODE_ENV === "development") {
    console.log("analyzeFrame", { finger, peaks, normSample: norm.slice(-10), valid });
  }
  if (!valid) return { valid: false, peaks: [], filtered: norm };
  return { valid: true, peaks, filtered: norm };
}
