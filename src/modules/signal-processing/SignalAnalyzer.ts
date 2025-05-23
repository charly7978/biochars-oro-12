import { ProcessedSignal } from '../../types/signal';
import { DetectorScores, DetectionResult } from './types';

/**
 * Clase para análisis de señales de PPG y detección de dedo
 * PROHIBIDA LA SIMULACIÓN Y TODO TIPO DE MANIPULACIÓN FORZADA DE DATOS
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
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private consecutiveNoDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private qualityHistory: number[] = [];
  private motionArtifactScore: number = 0;
  private readonly DETECTION_TIMEOUT = 3000; // Reducido para respuesta más rápida (antes 5000)
  private readonly MOTION_ARTIFACT_THRESHOLD = 0.8; // Aumentado para reducir falsos positivos (antes 0.75)
  private valueHistory: number[] = []; // Track signal history for artifact detection
  
  // Calibración adaptativa
  private calibrationPhase: boolean = true;
  private calibrationSamples: number[] = [];
  private readonly CALIBRATION_SAMPLE_SIZE = 25; // Aumentado para calibración más robusta (antes 20)
  private adaptiveThreshold: number = 0.12; // Umbral inicial aumentado para reducir falsos positivos (antes 0.1)
  
  // Mejoras para la detección de dedo en cámara trasera
  private rearCameraDetection: boolean = false;
  private textureConsistencyHistory: number[] = [];
  private readonly TEXTURE_HISTORY_SIZE = 15; // Aumentado para mejor análisis temporal (antes 12)
  private edgeDetectionScore: number = 0;
  private fingerBorderDetected: boolean = false;
  
  // Propiedades para visualización de picos
  private peakAmplificationFactor: number = 2.5;
  private peakSharpness: number = 0.8;
  private whipEffect: number = 1.5;
  
  // Nuevas propiedades para mejorar la detección y reducir falsos positivos
  private consistentSignalCounter: number = 0;
  private readonly CONSISTENT_SIGNAL_THRESHOLD = 5; // Requiere más señales consistentes
  private fingerMovementScore: number = 0; // Detector de movimiento de dedo
  private readonly COLOR_RATIO_HISTORY_SIZE = 10;
  private colorRatioHistory: Array<{rToG: number, rToB: number}> = [];
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    // Configuración de hysteresis mejorada para mejor detección
    this.CONFIG = {
      QUALITY_LEVELS: config.QUALITY_LEVELS,
      QUALITY_HISTORY_SIZE: config.QUALITY_HISTORY_SIZE,
      MIN_CONSECUTIVE_DETECTIONS: 4, // Incrementado para exigir más consistencia (antes 3)
      MAX_CONSECUTIVE_NO_DETECTIONS: 2  // Reducido para respuesta más rápida a pérdida de dedo (antes 3)
    };
  }
  
  updateDetectorScores(scores: {
    redValue: number;
    redChannel: number;
    stability: number;
    pulsatility: number;
    biophysical: number;
    periodicity: number;
    textureScore?: number;
    edgeValue?: number;
    rToGRatio?: number;  // Nueva: ratio rojo/verde para validación
    rToBRatio?: number;  // Nueva: ratio rojo/azul para validación
  }): void {
    // Store actual scores with improved enhancement multipliers
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel * 1.15)); // Ajustado (antes 1.2)
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability * 1.15)); // Incrementado para premiar estabilidad (antes 1.1)
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility * 1.3)); // Incrementado para premiar pulsatilidad (antes 1.25)
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical * 1.2)); // Incrementado para validación biofísica (antes 1.1)
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity * 1.15)); // Incrementado para premiar ritmo (antes 1.1)
    
    // Guardar historial de ratios de color para validación biofísica
    if (typeof scores.rToGRatio !== 'undefined' && typeof scores.rToBRatio !== 'undefined') {
      this.colorRatioHistory.push({
        rToG: scores.rToGRatio,
        rToB: scores.rToBRatio
      });
      
      if (this.colorRatioHistory.length > this.COLOR_RATIO_HISTORY_SIZE) {
        this.colorRatioHistory.shift();
      }
      
      // Validar si los ratios de color están en rangos fisiológicos
      // Para humanos, el canal rojo debería ser predominante
      const avgRtoG = this.colorRatioHistory.reduce((sum, val) => sum + val.rToG, 0) / this.colorRatioHistory.length;
      const avgRtoB = this.colorRatioHistory.reduce((sum, val) => sum + val.rToB, 0) / this.colorRatioHistory.length;
      
      // Penalizar si los ratios no están en rangos fisiológicos
      if (avgRtoG < 1.1 || avgRtoG > 3.5 || avgRtoB < 1.1 || avgRtoB > 3.5) {
        this.detectorScores.biophysical *= 0.85; // Penalizar sensible pero no excesivamente
      }
    }
    
    // Store texture score if available and process consistency
    if (typeof scores.textureScore !== 'undefined') {
      this.detectorScores.textureScore = scores.textureScore;
      
      // Analizar consistencia de textura para mejorar detección de dedo
      this.textureConsistencyHistory.push(scores.textureScore);
      if (this.textureConsistencyHistory.length > this.TEXTURE_HISTORY_SIZE) {
        this.textureConsistencyHistory.shift();
      }
      
      // Analizar consistencia temporal de la textura (importante para detectar dedo real)
      const textureConsistency = this.getTextureConsistency();
      if (textureConsistency > 0.85) { // Alta consistencia indica dedo real
        this.consistentSignalCounter = Math.min(this.CONSISTENT_SIGNAL_THRESHOLD, this.consistentSignalCounter + 1);
      } else if (textureConsistency < 0.65) { // Baja consistencia indica posible artefacto
        this.consistentSignalCounter = Math.max(0, this.consistentSignalCounter - 1);
      }
      
      // Premiar alta consistencia temporal en detección
      if (this.consistentSignalCounter >= this.CONSISTENT_SIGNAL_THRESHOLD) {
        this.detectorScores.stability = Math.min(1.0, this.detectorScores.stability * 1.1);
      }
    }
    
    // Detectar bordes para mejorar la detección de dedos en cámara trasera
    if (typeof scores.edgeValue !== 'undefined' && scores.edgeValue > 0) {
      // Actualizar puntuación de detección de bordes con suavizado
      this.edgeDetectionScore = this.edgeDetectionScore * 0.7 + scores.edgeValue * 0.3;
      
      // Determinar si hay un borde de dedo visible - umbral más estricto
      if (this.edgeDetectionScore > 0.4 && scores.redChannel > 0.3) { // Umbrales incrementados
        this.fingerBorderDetected = true;
        
        // Mejorar estabilidad cuando se detecta borde de dedo
        if (this.detectorScores.stability < 0.7) {
          this.detectorScores.stability = Math.min(1.0, this.detectorScores.stability * 1.15);
        }
      } else {
        this.fingerBorderDetected = false;
      }
    }
    
    // Detección de movimiento del dedo - importante para reducir falsos positivos
    this.trackValueForMotionDetection(scores.redValue);
    
    // Calibración adaptativa - recolectar muestras en fase de calibración
    if (this.calibrationPhase && this.detectorScores.redChannel > 0.15) { // Umbral incrementado
      this.calibrationSamples.push(scores.redValue);
      
      // Cuando tenemos suficientes muestras, calibramos el umbral
      if (this.calibrationSamples.length >= this.CALIBRATION_SAMPLE_SIZE) {
        this.calibrateAdaptiveThreshold();
        this.calibrationPhase = false;
      }
    }
    
    // Determinar si estamos usando la cámara trasera basado en características de la señal
    this.detectRearCamera(scores);
    
    console.log("SignalAnalyzer: Updated detector scores:", {
      redValue: scores.redValue,
      redChannel: this.detectorScores.redChannel,
      stability: this.detectorScores.stability,
      pulsatility: this.detectorScores.pulsatility,
      biophysical: this.detectorScores.biophysical,
      periodicity: this.detectorScores.periodicity,
      textureScore: scores.textureScore,
      edgeDetection: this.edgeDetectionScore,
      fingerBorderDetected: this.fingerBorderDetected,
      rearCamera: this.rearCameraDetection,
      motionArtifact: this.motionArtifactScore,
      fingerMovement: this.fingerMovementScore,
      adaptiveThreshold: this.adaptiveThreshold,
      calibrationPhase: this.calibrationPhase,
      consistentSignalCounter: this.consistentSignalCounter
    });
  }
  
  // Track values for motion artifact detection with improved analysis
  private trackValueForMotionDetection(value: number): void {
    this.valueHistory.push(value);
    if (this.valueHistory.length > 15) {
      this.valueHistory.shift();
    }
    
    // Detectar artefactos de movimiento con análisis mejorado
    if (this.valueHistory.length >= 5) {
      const recentValues = this.valueHistory.slice(-5);
      const maxChange = Math.max(...recentValues) - Math.min(...recentValues);
      const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Calcular cambio normalizado como porcentaje de media
      const normalizedChange = meanValue > 0 ? maxChange / meanValue : 0;
      
      // Update motion artifact score with smoothing
      this.motionArtifactScore = this.motionArtifactScore * 0.7 + (normalizedChange > 0.6 ? 0.3 : 0); // Umbral ajustado
      
      // Análisis de movimiento del dedo (diferente al artefacto de movimiento general)
      if (this.valueHistory.length >= 10) {
        const trend = this.analyzeValueTrend(this.valueHistory.slice(-10));
        
        // Alta variación seguida de estabilidad indica movimiento del dedo
        if (trend === 'decreasing_then_stable' || trend === 'increasing_then_stable') {
          this.fingerMovementScore = Math.min(1.0, this.fingerMovementScore + 0.3);
        } else {
          this.fingerMovementScore = Math.max(0, this.fingerMovementScore - 0.1);
        }
        
        // Aplicar penalización de movimiento del dedo
        if (this.fingerMovementScore > 0.5) {
          this.detectorScores.stability *= 0.85; // Penalizar estabilidad durante movimientos
        }
      }
      
      // Aplicar penalización de artefacto
      if (this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD) {
        this.detectorScores.stability *= 0.75; // Penalización por artefacto de movimiento
      }
    }
  }

  // Nuevo método para analizar la tendencia de los valores (útil para detectar movimiento de dedo)
  private analyzeValueTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' | 'increasing_then_stable' | 'decreasing_then_stable' | 'unstable' {
    if (values.length < 6) return 'unstable'; // Necesitamos suficientes puntos
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    // Calcular variabilidad en cada mitad
    const firstVar = this.calculateVariance(firstHalf);
    const secondVar = this.calculateVariance(secondHalf);
    
    const THRESHOLD = 0.15; // Umbral para considerar un cambio significativo
    const VAR_THRESHOLD = 0.1; // Umbral para considerar estabilidad
    
    // Analizar tendencia y estabilidad
    if (secondAvg > firstAvg * (1 + THRESHOLD)) {
      return secondVar < VAR_THRESHOLD ? 'increasing_then_stable' : 'increasing';
    } else if (firstAvg > secondAvg * (1 + THRESHOLD)) {
      return secondVar < VAR_THRESHOLD ? 'decreasing_then_stable' : 'decreasing';
    } else {
      return secondVar < VAR_THRESHOLD && firstVar < VAR_THRESHOLD ? 'stable' : 'unstable';
    }
  }
  
  // Auxiliar para calcular varianza
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  }
  
  // Método para detectar uso de cámara trasera basado en características de la señal
  private detectRearCamera(scores: any): void {
    // Criterios mejorados para detección de cámara trasera
    if (scores.redChannel > 0.45 && 
        scores.redValue > 60 && 
        this.detectorScores.stability > 0.55 && 
        (this.textureConsistencyHistory.length >= 5 && 
         this.getAverageTexture() > 0.65)) {
      
      this.rearCameraDetection = true;
    } else if (scores.redChannel < 0.3 || 
               scores.redValue < 40 || 
               this.detectorScores.stability < 0.4) {
      
      this.rearCameraDetection = false;
    }
    // En caso contrario, mantener el estado actual
  }
  
  // Calcular textura promedio para análisis de consistencia
  private getAverageTexture(): number {
    if (this.textureConsistencyHistory.length === 0) return 0;
    
    return this.textureConsistencyHistory.reduce((sum, val) => sum + val, 0) / 
           this.textureConsistencyHistory.length;
  }
  
  // Calcular consistencia de textura - útil para cámara trasera
  private getTextureConsistency(): number {
    if (this.textureConsistencyHistory.length < 3) return 0;
    
    const values = [...this.textureConsistencyHistory];
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    
    // Menor varianza = mayor consistencia (escala invertida)
    return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 3));
  }

  // Método para calibración adaptativa del umbral mejorado
  private calibrateAdaptiveThreshold(): void {
    // Ordenar muestras y eliminar valores extremos (15% superior e inferior) - más robusto
    const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
    const trimCount = Math.floor(sortedSamples.length * 0.15); // Aumentado para mayor robustez (antes 0.1)
    const trimmedSamples = sortedSamples.slice(trimCount, sortedSamples.length - trimCount);
    
    // Calcular media y desviación estándar
    const mean = trimmedSamples.reduce((sum, val) => sum + val, 0) / trimmedSamples.length;
    const variance = trimmedSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / trimmedSamples.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular coeficiente de variación (CV) para ajustar sensibilidad
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Ajustar umbral según variabilidad con ajustes mejorados
    if (cv < 0.05) { // Muy estable
      this.adaptiveThreshold = 0.042; // Umbral incrementado levemente (antes 0.04)
    } else if (cv < 0.1) { // Estable
      this.adaptiveThreshold = 0.028; // Umbral incrementado levemente (antes 0.025)
    } else { // Variable
      this.adaptiveThreshold = 0.022; // Umbral incrementado levemente (antes 0.02)
    }
    
    console.log("SignalAnalyzer: Calibración adaptativa completada", {
      muestras: this.calibrationSamples.length,
      media: mean.toFixed(2),
      desviacionEstandar: stdDev.toFixed(2),
      coeficienteVariacion: cv.toFixed(3),
      umbralAdaptativo: this.adaptiveThreshold
    });
    
    // Limpiar muestras de calibración
    this.calibrationSamples = [];
  }

  // Método para amplificar picos con efecto látigo
  enhanceSignalPeaks(value: number, isPeak: boolean): number {
    // Si es un pico, aplicamos una amplificación mayor con efecto de látigo
    if (isPeak) {
      // Aplicar amplificación de pico con efecto látigo
      return value * this.peakAmplificationFactor * this.whipEffect;
    } else {
      // Si no es un pico, mantener el valor pero con ligera nitidez
      const baselineValue = value * (1 + this.peakSharpness * 0.3);
      // Aplicar una ligera atenuación en valores no pico para aumentar contraste
      return baselineValue * 0.9;
    }
  }

  // LÓGICA MEJORADA: Detección adaptativa según tipo de cámara y validación múltiple
  analyzeSignalMultiDetector(
    filtered: number,
    trendResult: any
  ): DetectionResult {
    // Actualizar historial de calidad y calcular calidad media
    this.qualityHistory.push(this.detectorScores.redChannel);
    if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    const avgQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / this.qualityHistory.length;
    
    // Ajustar umbrales según tipo de cámara y consistencia de señal
    let qualityOn = this.adaptiveThreshold;
    let qualityOff = this.adaptiveThreshold * 0.5;
    let stabilityOn = 0.42; // Incrementado (antes 0.4)
    let pulseOn = 0.32;     // Incrementado (antes 0.3)
    
    // Ajustes específicos para cámara trasera (más estrictos para evitar falsos positivos)
    if (this.rearCameraDetection) {
      // Criterios más estrictos para cámara trasera
      qualityOn = Math.max(this.adaptiveThreshold, 0.032); // Levemente incrementado (antes 0.03)
      stabilityOn = 0.48;  // Mayor estabilidad requerida (antes 0.45)
      pulseOn = 0.38;      // Mayor pulsatilidad requerida (antes 0.35)
      
      // Si detectamos bordes de dedo claros, ajustar criterios
      if (this.fingerBorderDetected && this.edgeDetectionScore > 0.45) { // Umbral incrementado
        qualityOn *= 0.92;  // Reducir umbral solo un 8% (antes 10%)
        stabilityOn *= 0.95; // Mantener igual
      }
      
      // Considerar consistencia de textura
      const textureConsistency = this.getTextureConsistency();
      if (textureConsistency > 0.85) { // Umbral incrementado (antes 0.8)
        // Alta consistencia = señal más confiable
        stabilityOn *= 0.92; // Reducir menos estabilidad requerida (antes 0.9)
      }
    } 
    
    // Ajustar umbrales según contador de consistencia
    if (this.consistentSignalCounter > this.CONSISTENT_SIGNAL_THRESHOLD - 1) {
      // Si la señal ha sido consistente, reducir umbrales levemente
      qualityOn *= 0.95;
      stabilityOn *= 0.95;
    }
    
    // Requerir umbral mínimo para la suma ponderada de características
    const weightedSum = this.detectorScores.redChannel * 0.3 +
                       this.detectorScores.stability * 0.3 +
                       this.detectorScores.pulsatility * 0.2 +
                       this.detectorScores.biophysical * 0.2;
    
    // Lógica de histeresis mejorada: adquisición vs mantenimiento
    if (!this.isCurrentlyDetected) {
      // Detección inicial: calidad, estabilidad, pulsatilidad y tendencia válida
      if (avgQuality > qualityOn && trendResult !== 'non_physiological' &&
          this.detectorScores.stability > stabilityOn &&
          this.detectorScores.pulsatility > pulseOn &&
          weightedSum > 0.38) { // Suma ponderada mínima
        this.consecutiveDetections++;
      } else {
        this.consecutiveDetections = 0;
      }
    } else {
      // Mantenimiento: combinar múltiples factores para reducir falsos positivos
      const stabilityOff = this.rearCameraDetection ? 0.36 : 0.32; // Ajustados (antes 0.35/0.3)
      const pulseOff = this.rearCameraDetection ? 0.32 : 0.27;     // Ajustados (antes 0.3/0.25)
      
      // Considerar peso bajo de calidad para no perder señales débiles válidas
      if (avgQuality < qualityOff || 
          trendResult === 'non_physiological' ||
          this.detectorScores.stability < stabilityOff ||
          this.detectorScores.pulsatility < pulseOff || 
          weightedSum < 0.3) { // Suma ponderada mínima para mantener
        this.consecutiveNoDetections++;
      } else {
        this.consecutiveNoDetections = 0;
      }
    }
    
    // Cambiar estado tras N cuadros consecutivos según configuración mejorada
    if (!this.isCurrentlyDetected && this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS) {
      this.isCurrentlyDetected = true;
      console.log("SignalAnalyzer: Dedo detectado después de", this.CONFIG.MIN_CONSECUTIVE_DETECTIONS, "detecciones consecutivas");
    }
    
    if (this.isCurrentlyDetected && this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS) {
      this.isCurrentlyDetected = false;
      console.log("SignalAnalyzer: Dedo perdido después de", this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS, "no detecciones consecutivas");
    }
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: Math.round(avgQuality * 100),
      detectorDetails: {
        ...this.detectorScores,
        avgQuality,
        consecutiveDetections: this.consecutiveDetections,
        consecutiveNoDetections: this.consecutiveNoDetections,
        rearCamera: this.rearCameraDetection,
        fingerBorderDetected: this.fingerBorderDetected,
        edgeScore: this.edgeDetectionScore,
        textureConsistency: this.getTextureConsistency(),
        weightedSum: weightedSum, // Fixed: renamed from weightedScore to weightedSum
        motionScore: this.motionArtifactScore,
        fingerMovement: this.fingerMovementScore
      }
    };
  }
  
  updateLastStableValue(value: number): void {
    this.lastStableValue = value;
  }
  
  getLastStableValue(): number {
    return this.lastStableValue;
  }
  
  reset(): void {
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.consecutiveDetections = 0;
    this.consecutiveNoDetections = 0;
    this.isCurrentlyDetected = false;
    this.lastDetectionTime = 0;
    this.qualityHistory = [];
    this.motionArtifactScore = 0;
    this.valueHistory = [];
    this.calibrationPhase = true;
    this.calibrationSamples = [];
    this.adaptiveThreshold = 0.12; // Valor inicial más alto
    
    this.rearCameraDetection = false;
    this.textureConsistencyHistory = [];
    this.edgeDetectionScore = 0;
    this.fingerBorderDetected = false;
    this.consistentSignalCounter = 0;
    this.fingerMovementScore = 0;
    this.colorRatioHistory = [];
    
    this.detectorScores = {
      redChannel: 0,
      stability: 0,
      pulsatility: 0,
      biophysical: 0,
      periodicity: 0
    };
    console.log("SignalAnalyzer: Reset complete");
  }
}
