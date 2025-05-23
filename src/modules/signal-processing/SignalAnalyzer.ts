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
  private readonly DETECTION_TIMEOUT = 2000; // Reducido para respuesta más rápida (antes 3000)
  private readonly MOTION_ARTIFACT_THRESHOLD = 0.85; // Reducido para permitir más movimiento (antes 0.8)
  private valueHistory: number[] = []; // Track signal history for artifact detection
  
  // Calibración adaptativa mejorada
  private calibrationPhase: boolean = true;
  private calibrationSamples: number[] = [];
  private readonly CALIBRATION_SAMPLE_SIZE = 20; // Reducido para calibración más rápida (antes 25)
  private adaptiveThreshold: number = 0.09; // Umbral inicial reducido para mayor sensibilidad (antes 0.12)
  
  // Mejoras para la detección de dedo en cámara trasera
  private rearCameraDetection: boolean = false;
  private textureConsistencyHistory: number[] = [];
  private readonly TEXTURE_HISTORY_SIZE = 12; // Reducido para adaptación más rápida (antes 15)
  private edgeDetectionScore: number = 0;
  private fingerBorderDetected: boolean = false;
  
  // Propiedades para visualización de picos mejorada
  private peakAmplificationFactor: number = 3.0; // Aumentado para mejor visualización (antes 2.5)
  private peakSharpness: number = 1.0; // Aumentado para más nitidez (antes 0.8)
  private whipEffect: number = 2.0; // Aumentado para más dramatismo (antes 1.5)
  
  // Nuevas propiedades para mejorar la detección y reducir falsos positivos
  private consistentSignalCounter: number = 0;
  private readonly CONSISTENT_SIGNAL_THRESHOLD = 3; // Reducido para detección más rápida (antes 5)
  private fingerMovementScore: number = 0; // Detector de movimiento de dedo
  private readonly COLOR_RATIO_HISTORY_SIZE = 8; // Reducido para adaptación más rápida (antes 10)
  private colorRatioHistory: Array<{rToG: number, rToB: number}> = [];
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    // Configuración de hysteresis ajustada para mejor detección
    this.CONFIG = {
      QUALITY_LEVELS: config.QUALITY_LEVELS,
      QUALITY_HISTORY_SIZE: config.QUALITY_HISTORY_SIZE,
      MIN_CONSECUTIVE_DETECTIONS: 3, // Reducido para respuesta más rápida (antes 4)
      MAX_CONSECUTIVE_NO_DETECTIONS: 3  // Aumentado para mayor tolerancia (antes 2)
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
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel * 1.25)); // Incrementado (antes 1.15)
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability * 1.2)); // Incrementado (antes 1.15)
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility * 1.4)); // Incrementado (antes 1.3)
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical * 1.3)); // Incrementado (antes 1.2)
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity * 1.25)); // Incrementado (antes 1.15)
    
    // Guardar historial de ratios de color con rangos más permisivos
    if (typeof scores.rToGRatio !== 'undefined' && typeof scores.rToBRatio !== 'undefined') {
      this.colorRatioHistory.push({
        rToG: scores.rToGRatio,
        rToB: scores.rToBRatio
      });
      
      if (this.colorRatioHistory.length > this.COLOR_RATIO_HISTORY_SIZE) {
        this.colorRatioHistory.shift();
      }
      
      // Validar si los ratios de color están en rangos fisiológicos (más permisivos)
      const avgRtoG = this.colorRatioHistory.reduce((sum, val) => sum + val.rToG, 0) / 
                     this.colorRatioHistory.length;
      const avgRtoB = this.colorRatioHistory.reduce((sum, val) => sum + val.rToB, 0) / 
                     this.colorRatioHistory.length;
      
      // Rangos más amplios para aceptar más variedad de cámaras y condiciones
      if (avgRtoG < 0.8 || avgRtoG > 4.0 || avgRtoB < 0.8 || avgRtoB > 4.0) {
        this.detectorScores.biophysical *= 0.9; // Penalizar menos (antes 0.85)
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
      
      // Análisis de consistencia temporal con criterios más permisivos
      const textureConsistency = this.getTextureConsistency();
      if (textureConsistency > 0.75) { // Umbral reducido (antes 0.85)
        this.consistentSignalCounter = Math.min(this.CONSISTENT_SIGNAL_THRESHOLD, this.consistentSignalCounter + 1);
      } else if (textureConsistency < 0.55) { // Umbral reducido (antes 0.65)
        this.consistentSignalCounter = Math.max(0, this.consistentSignalCounter - 1);
      }
      
      // Premiar alta consistencia temporal en detección
      if (this.consistentSignalCounter >= this.CONSISTENT_SIGNAL_THRESHOLD) {
        this.detectorScores.stability = Math.min(1.0, this.detectorScores.stability * 1.15); // Incrementado (antes 1.1)
      }
    }
    
    // Detectar bordes para mejorar la detección con criterios más permisivos
    if (typeof scores.edgeValue !== 'undefined' && scores.edgeValue > 0) {
      // Actualizar puntuación de detección de bordes con más peso para el valor actual
      this.edgeDetectionScore = this.edgeDetectionScore * 0.6 + scores.edgeValue * 0.4; // Más peso al valor actual (antes 0.7/0.3)
      
      // Umbral reducido para detectar más fácilmente bordes del dedo
      if (this.edgeDetectionScore > 0.35 && scores.redChannel > 0.25) { // Umbrales reducidos (antes 0.4/0.3)
        this.fingerBorderDetected = true;
        
        // Mejorar estabilidad cuando se detecta borde de dedo
        if (this.detectorScores.stability < 0.8) { // Umbral aumentado (antes 0.7)
          this.detectorScores.stability = Math.min(1.0, this.detectorScores.stability * 1.2); // Mayor mejora (antes 1.15)
        }
      } else {
        this.fingerBorderDetected = false;
      }
    }
    
    // Detección de movimiento del dedo - más tolerante
    this.trackValueForMotionDetection(scores.redValue);
    
    // Calibración adaptativa - umbrales más permisivos
    if (this.calibrationPhase && this.detectorScores.redChannel > 0.12) { // Umbral reducido (antes 0.15)
      this.calibrationSamples.push(scores.redValue);
      
      // Cuando tenemos suficientes muestras, calibramos el umbral
      if (this.calibrationSamples.length >= this.CALIBRATION_SAMPLE_SIZE) {
        this.calibrateAdaptiveThreshold();
        this.calibrationPhase = false;
      }
    }
    
    // Determinar si estamos usando la cámara trasera basado en características de la señal
    this.detectRearCamera(scores);

    // Asignar weightedSum para detección
    const weightedSum = this.detectorScores.redChannel * 0.3 +
                        this.detectorScores.stability * 0.3 +
                        this.detectorScores.pulsatility * 0.2 +
                        this.detectorScores.biophysical * 0.2;
    this.detectorScores.weightedSum = weightedSum;
    this.detectorScores.motionScore = this.motionArtifactScore;
    this.detectorScores.fingerMovement = this.fingerMovementScore;
    
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
      consistentSignalCounter: this.consistentSignalCounter,
      weightedSum: weightedSum
    });
  }
  
  // Track values for motion artifact detection with more permisive thresholds
  private trackValueForMotionDetection(value: number): void {
    this.valueHistory.push(value);
    if (this.valueHistory.length > 15) { // Mantener último
      this.valueHistory.shift();
    }
    
    // Detectar artefactos de movimiento con criterios más permisivos
    if (this.valueHistory.length >= 5) {
      const recentValues = this.valueHistory.slice(-5);
      const maxChange = Math.max(...recentValues) - Math.min(...recentValues);
      const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Calcular cambio normalizado como porcentaje de media
      const normalizedChange = meanValue > 0 ? maxChange / meanValue : 0;
      
      // Update motion artifact score with smoothing, umbral más permisivo
      this.motionArtifactScore = this.motionArtifactScore * 0.7 + (normalizedChange > 0.7 ? 0.3 : 0); // Umbral incrementado (antes 0.6)
      
      // Análisis de movimiento del dedo (diferente al artefacto de movimiento general)
      if (this.valueHistory.length >= 10) {
        const trend = this.analyzeValueTrend(this.valueHistory.slice(-10));
        
        // Alta variación seguida de estabilidad indica movimiento del dedo
        if (trend === 'decreasing_then_stable' || trend === 'increasing_then_stable') {
          this.fingerMovementScore = Math.min(1.0, this.fingerMovementScore + 0.2); // Incremento más suave (antes 0.3)
        } else {
          this.fingerMovementScore = Math.max(0, this.fingerMovementScore - 0.05); // Decaimiento más lento (antes 0.1)
        }
        
        // Aplicar penalización de movimiento del dedo más suave
        if (this.fingerMovementScore > 0.7) { // Umbral incrementado (antes 0.5)
          this.detectorScores.stability *= 0.9; // Penalizar menos (antes 0.85)
        }
      }
      
      // Aplicar penalización de artefacto más suave
      if (this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD) {
        this.detectorScores.stability *= 0.8; // Penalizar menos (antes 0.75)
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
    // Criterios más permisivos para detección de cámara trasera
    if (scores.redChannel > 0.35 && // Umbral reducido (antes 0.45)
        scores.redValue > 50 && // Umbral reducido (antes 60)
        this.detectorScores.stability > 0.45 && // Umbral reducido (antes 0.55) 
        (this.textureConsistencyHistory.length >= 5 && 
         this.getAverageTexture() > 0.55)) { // Umbral reducido (antes 0.65)
      
      this.rearCameraDetection = true;
    } else if (scores.redChannel < 0.25 || // Umbral reducido (antes 0.3)
               scores.redValue < 30 || // Umbral reducido (antes 40)
               this.detectorScores.stability < 0.3) { // Umbral reducido (antes 0.4)
      
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

  // Método para calibración adaptativa del umbral con valores más permisivos
  private calibrateAdaptiveThreshold(): void {
    // Ordenar muestras y eliminar valores extremos - más permisivo
    const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
    const trimCount = Math.floor(sortedSamples.length * 0.1); // Eliminar menos valores extremos (antes 0.15)
    const trimmedSamples = sortedSamples.slice(trimCount, sortedSamples.length - trimCount);
    
    // Calcular media y desviación estándar
    const mean = trimmedSamples.reduce((sum, val) => sum + val, 0) / trimmedSamples.length;
    const variance = trimmedSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / trimmedSamples.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular coeficiente de variación para ajustar sensibilidad
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Ajustar umbral según variabilidad con umbrales más bajos
    if (cv < 0.05) { // Muy estable
      this.adaptiveThreshold = 0.035; // Valor reducido (antes 0.042)
    } else if (cv < 0.1) { // Estable
      this.adaptiveThreshold = 0.022; // Valor reducido (antes 0.028)
    } else { // Variable
      this.adaptiveThreshold = 0.015; // Valor reducido (antes 0.022)
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

  // Método para amplificar picos con efecto látigo mejorado
  enhanceSignalPeaks(value: number, isPeak: boolean): number {
    // Si es un pico, aplicamos una amplificación mayor con efecto de látigo
    if (isPeak) {
      // Aplicar amplificación de pico con efecto látigo
      return value * this.peakAmplificationFactor * this.whipEffect;
    } else {
      // Si no es un pico, mantener el valor pero con ligera nitidez
      const baselineValue = value * (1 + this.peakSharpness * 0.3);
      // Aplicar una ligera atenuación en valores no pico para aumentar contraste
      return baselineValue * 0.85; // Menos atenuación (antes 0.9)
    }
  }

  // LÓGICA MEJORADA: Detección adaptativa con criterios más permisivos
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
    let qualityOn = this.adaptiveThreshold * 0.9; // Reducido para mayor sensibilidad
    let qualityOff = this.adaptiveThreshold * 0.4; // Reducido para mayor histéresis (antes 0.5)
    let stabilityOn = 0.35; // Reducido (antes 0.42)
    let pulseOn = 0.28; // Reducido (antes 0.32)
    
    // Ajustes específicos para cámara trasera (más permisivos)
    if (this.rearCameraDetection) {
      // Criterios más permisivos para cámara trasera
      qualityOn = Math.max(this.adaptiveThreshold * 0.9, 0.025); // Reducido (antes 0.032)
      stabilityOn = 0.4; // Reducido (antes 0.48)
      pulseOn = 0.32; // Reducido (antes 0.38)
      
      // Si detectamos bordes de dedo claros, ajustar criterios
      if (this.fingerBorderDetected && this.edgeDetectionScore > 0.35) { // Umbral reducido (antes 0.45)
        qualityOn *= 0.85; // Reducir umbral más agresivamente (antes 0.92)
        stabilityOn *= 0.9; // Reducir umbral (antes 0.95)
      }
      
      // Considerar consistencia de textura
      const textureConsistency = this.getTextureConsistency();
      if (textureConsistency > 0.75) { // Umbral reducido (antes 0.85)
        // Alta consistencia = señal más confiable
        stabilityOn *= 0.85; // Reducir más (antes 0.92)
      }
    } 
    
    // Ajustar umbrales según contador de consistencia
    if (this.consistentSignalCounter > this.CONSISTENT_SIGNAL_THRESHOLD - 1) {
      // Si la señal ha sido consistente, reducir umbrales más agresivamente
      qualityOn *= 0.9; // Reducir más (antes 0.95)
      stabilityOn *= 0.9; // Reducir más (antes 0.95)
    }
    
    // Requerir umbral mínimo para la suma ponderada de características
    const weightedSum = this.detectorScores.weightedSum || 0;
    
    // Lógica de histeresis mejorada con umbrales más permisivos
    if (!this.isCurrentlyDetected) {
      // Detección inicial con criterios más permisivos
      if (avgQuality > qualityOn && 
          (trendResult !== 'non_physiological' || this.consistentSignalCounter >= this.CONSISTENT_SIGNAL_THRESHOLD) &&
          this.detectorScores.stability > stabilityOn &&
          this.detectorScores.pulsatility > pulseOn &&
          weightedSum > 0.32) { // Umbral reducido (antes 0.38)
        this.consecutiveDetections++;
      } else {
        this.consecutiveDetections = 0;
      }
    } else {
      // Mantenimiento con tolerancia mayor
      const stabilityOff = this.rearCameraDetection ? 0.3 : 0.25; // Reducidos (antes 0.36/0.32)
      const pulseOff = this.rearCameraDetection ? 0.25 : 0.2; // Reducidos (antes 0.32/0.27)
      
      // Considerar peso bajo de calidad para no perder señales débiles válidas
      if (avgQuality < qualityOff || 
          (trendResult === 'non_physiological' && this.consistentSignalCounter < this.CONSISTENT_SIGNAL_THRESHOLD) ||
          this.detectorScores.stability < stabilityOff ||
          this.detectorScores.pulsatility < pulseOff || 
          weightedSum < 0.25) { // Umbral reducido (antes 0.3)
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
        weightedSum: weightedSum,
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
    this.adaptiveThreshold = 0.09; // Valor inicial más bajo
    
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
