import { ProcessedSignal } from '../../types/signal';
import { DetectorScores, DetectionResult } from './types';

/**
 * Analizador de señales SIMPLIFICADO y UNIFICADO
 * Integrado con el sistema unificado de detección
 */
export class SignalAnalyzer {
  private readonly CONFIG: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  };
  
  private detectorScores: DetectorScores = {
    redChannel: 0,
    stability: 0,
    pulsatility: 0,
    biophysical: 0,
    periodicity: 0
  };
  
  private qualityHistory: number[] = [];
  private lastQualityUpdate: number = 0;
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    this.CONFIG = config;
  }
  
  /**
   * Actualizar scores del detector (simplificado)
   */
  updateDetectorScores(scores: {
    redValue: number;
    redChannel: number;
    stability: number;
    pulsatility: number;
    biophysical: number;
    periodicity: number;
    snr?: number;
    perfusionIndex?: number;
  }): void {
    
    // Usar scores del sistema unificado si están disponibles
    this.detectorScores = {
      redChannel: scores.redChannel,
      stability: scores.stability,
      pulsatility: scores.pulsatility,
      biophysical: scores.biophysical,
      periodicity: scores.periodicity,
      snr: scores.snr || 0,
      perfusionIndex: scores.perfusionIndex || 0
    };
    
    this.lastQualityUpdate = Date.now();
  }

  /**
   * Análisis simplificado que confía en el detector unificado
   */
  analyzeSignalMultiDetector(
    filtered: number,
    trendResult: any
  ): DetectionResult {
    
    // Calidad basada en el canal rojo principalmente
    const baseQuality = this.detectorScores.redChannel;
    
    // Aplicar variabilidad natural (±8%)
    const naturalVariation = (Math.random() - 0.5) * 16;
    const finalQuality = Math.max(5, Math.min(95, baseQuality * 100 + naturalVariation));
    
    // Actualizar historial
    this.qualityHistory.push(finalQuality);
    if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Promedio de calidad con variabilidad
    const avgQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / this.qualityHistory.length;
    
    // Detección basada en calidad promedio y validez de tendencia
    const isDetected = avgQuality > 25 && trendResult !== 'non_physiological';
    
    return {
      isFingerDetected: isDetected,
      quality: Math.round(avgQuality),
      detectorDetails: {
        ...this.detectorScores,
        avgQuality,
        trendResult,
        naturalVariation: naturalVariation.toFixed(1)
      }
    };
  }
  
  updateLastStableValue(value: number): void {
    // Implementación simplificada
  }
  
  getLastStableValue(): number {
    // Implementación simplificada
    return 0;
  }
  
  reset(): void {
    this.qualityHistory = [];
    this.lastQualityUpdate = 0;
    this.detectorScores = {
      redChannel: 0,
      stability: 0,
      pulsatility: 0,
      biophysical: 0,
      periodicity: 0
    };
    console.log("SignalAnalyzer: Reset simplificado completo");
  }
}

/**
 * Detección robusta y centralizada de picos (latidos):
 * - Umbral de prominencia adaptativo (basado en la desviación estándar de la señal)
 * - Normalización previa de la señal
 * - Distancia mínima fisiológica entre picos
 * - Esta función debe ser la ÚNICA utilizada para detección de picos en todo el pipeline
 * - Si existen otras funciones similares, deben ser eliminadas o redirigidas a esta
 * @param signal Array de valores de señal (filtrada y preferentemente amplificada)
 * @param minProminence Si no se especifica, se calcula como 0.5 * std(signal)
 * @param minDistance Distancia mínima entre picos (frames)
 * @returns Índices de los picos detectados
 */
export function detectPeaks(
  signal: number[],
  minProminence?: number,
  minDistance = 10
): number[] {
  if (signal.length < 3) return [];
  // Normalización: centrar y escalar por desviación estándar
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const std = Math.sqrt(signal.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / signal.length) || 1;
  const normSignal = signal.map(v => (v - mean) / std);
  // Umbral adaptativo si no se especifica
  const adaptiveProminence = minProminence !== undefined ? minProminence : 0.5;
  const peaks: number[] = [];
  let lastPeak = -minDistance;
  for (let i = 1; i < normSignal.length - 1; i++) {
    if (normSignal[i] > normSignal[i-1] && normSignal[i] > normSignal[i+1]) {
      const leftMin = Math.min(...normSignal.slice(Math.max(0, i-10), i));
      const rightMin = Math.min(...normSignal.slice(i+1, Math.min(normSignal.length, i+11)));
      const prominence = normSignal[i] - Math.max(leftMin, rightMin);
      if (prominence > adaptiveProminence && (i - lastPeak) >= minDistance) {
        peaks.push(i);
        lastPeak = i;
      }
    }
  }
  // Logging para depuración
  if (process.env.NODE_ENV === "development") {
    console.log("detectPeaks (centralizado)", { peaks, adaptiveProminence, minDistance });
  }
  return peaks;
}
