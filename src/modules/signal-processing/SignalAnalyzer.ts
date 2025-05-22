
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
  private readonly MOTION_ARTIFACT_THRESHOLD = 0.75; // Ajustado para mejor equilibrio (era 0.7)
  private valueHistory: number[] = []; // Track signal history for artifact detection
  
  // Nuevo: calibración adaptativa
  private calibrationPhase: boolean = true;
  private calibrationSamples: number[] = [];
  private readonly CALIBRATION_SAMPLE_SIZE = 20;
  private adaptiveThreshold: number = 0.1; // Umbral inicial que se ajustará (más estricto)
  
  // Mejoras para la detección de dedo en cámara trasera
  private rearCameraDetection: boolean = false;
  private textureConsistencyHistory: number[] = [];
  private readonly TEXTURE_HISTORY_SIZE = 12;
  private edgeDetectionScore: number = 0;
  private fingerBorderDetected: boolean = false;
  
  // Nuevas propiedades para mejorar la visualización de picos
  private peakAmplificationFactor: number = 2.5; // Factor de amplificación para picos
  private peakSharpness: number = 0.8; // Factor de nitidez para picos (0-1)
  private whipEffect: number = 1.5; // Factor de efecto látigo
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    // Configuración de hysteresis simétrica para detección más rápida
    this.CONFIG = {
      QUALITY_LEVELS: config.QUALITY_LEVELS,
      QUALITY_HISTORY_SIZE: config.QUALITY_HISTORY_SIZE,
      MIN_CONSECUTIVE_DETECTIONS: 3,
      MAX_CONSECUTIVE_NO_DETECTIONS: 3
    };
  }
  
  updateDetectorScores(scores: {
    redValue: number;
    redChannel: number;
    stability: number;
    pulsatility: number;
    biophysical: number;
    periodicity: number;
    textureScore?: number; // Opcional para compatibilidad
    edgeValue?: number; // Nuevo: valor de detección de bordes
  }): void {
    // Store actual scores with enhancement multipliers
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel * 1.2)); // Aumentado (antes 1.1)
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability * 1.1)); // Incrementado levemente (antes 1.05)
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility * 1.25)); // Aumentado significativamente (antes 1.15)
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical * 1.1)); // Ahora también se aumenta (antes sin multiplicador)
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity * 1.1)); // Aumentado levemente (antes sin multiplicador)
    
    // Store texture score if available
    if (typeof scores.textureScore !== 'undefined') {
      this.detectorScores.textureScore = scores.textureScore;
      
      // Analizar consistencia de textura para mejorar detección de dedo
      this.textureConsistencyHistory.push(scores.textureScore);
      if (this.textureConsistencyHistory.length > this.TEXTURE_HISTORY_SIZE) {
        this.textureConsistencyHistory.shift();
      }
    }
    
    // Detectar bordes para mejorar la detección de dedos en cámara trasera
    if (typeof scores.edgeValue !== 'undefined' && scores.edgeValue > 0) {
      // Actualizar puntuación de detección de bordes con suavizado
      this.edgeDetectionScore = this.edgeDetectionScore * 0.7 + scores.edgeValue * 0.3;
      
      // Determinar si hay un borde de dedo visible
      if (this.edgeDetectionScore > 0.35 && scores.redChannel > 0.25) {
        this.fingerBorderDetected = true;
        
        // Mejorar estabilidad cuando se detecta borde de dedo
        if (this.detectorScores.stability < 0.7) {
          this.detectorScores.stability = Math.min(1.0, this.detectorScores.stability * 1.15);
        }
      } else {
        this.fingerBorderDetected = false;
      }
    }
    
    // Track values for motion artifact detection
    this.valueHistory.push(scores.redValue);
    if (this.valueHistory.length > 15) {
      this.valueHistory.shift();
    }
    
    // Detectar artefactos de movimiento con tolerancia ajustada
    if (this.valueHistory.length >= 5) {
      const recentValues = this.valueHistory.slice(-5);
      const maxChange = Math.max(...recentValues) - Math.min(...recentValues);
      const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Calcular cambio normalizado como porcentaje de media - más tolerante
      const normalizedChange = meanValue > 0 ? maxChange / meanValue : 0;
      
      // Update motion artifact score with smoothing
      this.motionArtifactScore = this.motionArtifactScore * 0.7 + (normalizedChange > 0.55 ? 0.3 : 0); // Umbral aumentado (antes 0.5)
      
      // Aplicar penalización de artefacto más suave
      if (this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD) {
        this.detectorScores.stability *= 0.7; // Penalización más suave (antes 0.6)
      }
    }
    
    // Calibración adaptativa - recolectar muestras en fase de calibración
    if (this.calibrationPhase && this.detectorScores.redChannel > 0.1) {
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
      adaptiveThreshold: this.adaptiveThreshold,
      calibrationPhase: this.calibrationPhase
    });
  }
  
  // Nuevo método para detectar uso de cámara trasera basado en características de la señal
  private detectRearCamera(scores: any): void {
    // La cámara trasera tiende a tener:
    // 1. Mayor intensidad en canal rojo
    // 2. Mejor textura debido a la mayor resolución
    // 3. Menor ruido (estabilidad)
    
    // Combinación de factores para detección de cámara trasera
    if (scores.redChannel > 0.45 && // Mayor intensidad en cámara trasera
        scores.redValue > 60 && // Valor absoluto mayor
        this.detectorScores.stability > 0.55 && // Mejor estabilidad
        (this.textureConsistencyHistory.length >= 5 && 
         this.getAverageTexture() > 0.65)) { // Mejor textura consistente
      
      this.rearCameraDetection = true;
    } else if (scores.redChannel < 0.3 || // Señales débiles
               scores.redValue < 40 || // Valores bajos
               this.detectorScores.stability < 0.4) { // Inestabilidad
      
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

  // Nuevo método para calibración adaptativa del umbral
  private calibrateAdaptiveThreshold(): void {
    // Ordenar muestras y eliminar valores extremos (10% superior e inferior)
    const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
    const trimCount = Math.floor(sortedSamples.length * 0.1);
    const trimmedSamples = sortedSamples.slice(trimCount, sortedSamples.length - trimCount);
    
    // Calcular media y desviación estándar
    const mean = trimmedSamples.reduce((sum, val) => sum + val, 0) / trimmedSamples.length;
    const variance = trimmedSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / trimmedSamples.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular coeficiente de variación (CV) para ajustar sensibilidad
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Ajustar umbral según variabilidad - menor variabilidad requiere umbral más alto
    // para evitar falsos positivos, mayor variabilidad requiere umbral más bajo
    if (cv < 0.05) { // Muy estable
      this.adaptiveThreshold = 0.04; // Umbral más alto para evitar falsos positivos
    } else if (cv < 0.1) { // Estable
      this.adaptiveThreshold = 0.025; // Umbral moderado
    } else { // Variable
      this.adaptiveThreshold = 0.02; // Umbral más bajo para mejorar detección
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

  // Nuevo método para amplificar picos con efecto látigo
  enhanceSignalPeaks(value: number, isPeak: boolean): number {
    // Si es un pico, aplicamos una amplificación mayor con efecto de látigo
    if (isPeak) {
      // Aplicar amplificación de pico con efecto látigo
      // Esto crea un movimiento rápido inicial seguido de una caída más lenta
      return value * this.peakAmplificationFactor * this.whipEffect;
    } else {
      // Si no es un pico, mantener el valor pero con ligera nitidez
      const baselineValue = value * (1 + this.peakSharpness * 0.3);
      // Aplicar una ligera atenuación en valores no pico para aumentar contraste
      return baselineValue * 0.9;
    }
  }

  // LÓGICA MEJORADA: Detección adaptativa según tipo de cámara
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
    
    // Ajustar umbrales según si estamos usando cámara trasera o frontal
    let qualityOn = this.adaptiveThreshold;
    let qualityOff = this.adaptiveThreshold * 0.5;
    let stabilityOn = 0.4;
    let pulseOn = 0.3;
    
    // Ajustes específicos para cámara trasera (más estrictos para evitar falsos positivos)
    if (this.rearCameraDetection) {
      // Criterios más estrictos para cámara trasera para evitar falsos positivos
      qualityOn = Math.max(this.adaptiveThreshold, 0.03); // Mínimo umbral de calidad más alto
      stabilityOn = 0.45;  // Mayor estabilidad requerida
      pulseOn = 0.35;      // Mayor pulsatilidad requerida
      
      // Si detectamos bordes de dedo claros, podemos reducir un poco los requisitos
      if (this.fingerBorderDetected && this.edgeDetectionScore > 0.4) {
        qualityOn *= 0.9;  // Reducir umbral un 10%
        stabilityOn *= 0.95; // Reducir estabilidad requerida un 5%
      }
      
      // Considerar consistencia de textura
      const textureConsistency = this.getTextureConsistency();
      if (textureConsistency > 0.8) {
        // Alta consistencia = señal más confiable
        stabilityOn *= 0.9; // Reducir estabilidad requerida un 10%
      }
    } 
    // Para cámara frontal mantenemos los umbrales predeterminados
    
    // Lógica de histeresis: adquisición vs mantenimiento
    if (!this.isCurrentlyDetected) {
      // Detección inicial: calidad, estabilidad, pulsatilidad y tendencia válida
      if (avgQuality > qualityOn && trendResult !== 'non_physiological' &&
          this.detectorScores.stability > stabilityOn &&
          this.detectorScores.pulsatility > pulseOn) {
        this.consecutiveDetections++;
      } else {
        this.consecutiveDetections = 0;
      }
    } else {
      // Mantenimiento: añadir estabilidad y pulsatilidad para reducir falsos positivos
      const stabilityOff = this.rearCameraDetection ? 0.35 : 0.3; // Más estricto en cámara trasera
      const pulseOff = this.rearCameraDetection ? 0.3 : 0.25;    // Más estricto en cámara trasera
      
      if (avgQuality < qualityOff || trendResult === 'non_physiological' ||
          this.detectorScores.stability < stabilityOff ||
          this.detectorScores.pulsatility < pulseOff) {
        this.consecutiveNoDetections++;
      } else {
        this.consecutiveNoDetections = 0;
      }
    }
    
    // Cambiar estado tras N cuadros consecutivos
    if (!this.isCurrentlyDetected && this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS) {
      this.isCurrentlyDetected = true;
    }
    if (this.isCurrentlyDetected && this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS) {
      this.isCurrentlyDetected = false;
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
        textureConsistency: this.getTextureConsistency()
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
    this.calibrationPhase = true; // Reiniciar fase de calibración
    this.calibrationSamples = []; // Limpiar muestras de calibración
    this.adaptiveThreshold = 0.1; // Restablecer umbral adaptativo
    
    // Reinicias nuevas propiedades
    this.rearCameraDetection = false;
    this.textureConsistencyHistory = [];
    this.edgeDetectionScore = 0;
    this.fingerBorderDetected = false;
    
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

