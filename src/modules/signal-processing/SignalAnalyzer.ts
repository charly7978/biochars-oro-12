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
  // Reduced DETECTION_TIMEOUT for faster response
  private readonly DETECTION_TIMEOUT = 1800; 
  // Increased threshold for better motion tolerance
  private readonly MOTION_ARTIFACT_THRESHOLD = 0.88; 
  private valueHistory: number[] = [];
  
  // Optimized calibration parameters
  private calibrationPhase: boolean = true;
  private calibrationSamples: number[] = [];
  // Reduced sample size for faster calibration
  private readonly CALIBRATION_SAMPLE_SIZE = 18;
  // Lower threshold for higher sensitivity
  private adaptiveThreshold: number = 0.075; 
  
  // Improved camera detection parameters
  private rearCameraDetection: boolean = false;
  private textureConsistencyHistory: number[] = [];
  // Optimized for faster adaptation
  private readonly TEXTURE_HISTORY_SIZE = 10;
  private edgeDetectionScore: number = 0;
  private fingerBorderDetected: boolean = false;
  
  // Enhanced peak visualization parameters
  private peakAmplificationFactor: number = 3.2;
  private peakSharpness: number = 1.2;
  private whipEffect: number = 2.2;
  
  // Optimized finger detection parameters
  private consistentSignalCounter: number = 0;
  // Reduced for faster detection
  private readonly CONSISTENT_SIGNAL_THRESHOLD = 2;
  private fingerMovementScore: number = 0;
  // Reduced for faster adaptation
  private readonly COLOR_RATIO_HISTORY_SIZE = 6;
  private colorRatioHistory: Array<{rToG: number, rToB: number}> = [];
  
  // New parameters for improved detection
  private lastConfidentDetection: number = 0;
  private confidenceScore: number = 0;
  private readonly CONFIDENCE_DECAY_RATE = 0.05;
  private readonly CONFIDENCE_BOOST_RATE = 0.2;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.4;
  private steadySignalCounter: number = 0;
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    // Optimized hysteresis configuration
    this.CONFIG = {
      QUALITY_LEVELS: config.QUALITY_LEVELS,
      QUALITY_HISTORY_SIZE: config.QUALITY_HISTORY_SIZE,
      // Reduced for faster response
      MIN_CONSECUTIVE_DETECTIONS: 2,
      // More tolerance for intermittent detection
      MAX_CONSECUTIVE_NO_DETECTIONS: 4
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
    rToGRatio?: number;
    rToBRatio?: number;
  }): void {
    // Enhanced score calculations with optimized multipliers
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel * 1.3));
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability * 1.25));
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility * 1.5));
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical * 1.35));
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity * 1.3));
    
    // More permissive color ratio checks with wider ranges
    if (typeof scores.rToGRatio !== 'undefined' && typeof scores.rToBRatio !== 'undefined') {
      this.colorRatioHistory.push({
        rToG: scores.rToGRatio,
        rToB: scores.rToBRatio
      });
      
      if (this.colorRatioHistory.length > this.COLOR_RATIO_HISTORY_SIZE) {
        this.colorRatioHistory.shift();
      }
      
      // Wider acceptable ranges for different camera types and lighting conditions
      const avgRtoG = this.colorRatioHistory.reduce((sum, val) => sum + val.rToG, 0) / 
                     this.colorRatioHistory.length;
      const avgRtoB = this.colorRatioHistory.reduce((sum, val) => sum + val.rToB, 0) / 
                     this.colorRatioHistory.length;
      
      // More permissive ranges with less severe penalty
      if (avgRtoG < 0.7 || avgRtoG > 4.5 || avgRtoB < 0.7 || avgRtoB > 4.5) {
        this.detectorScores.biophysical *= 0.95; 
      }
    }
    
    // Enhanced texture consistency analysis
    if (typeof scores.textureScore !== 'undefined') {
      this.detectorScores.textureScore = scores.textureScore;
      
      this.textureConsistencyHistory.push(scores.textureScore);
      if (this.textureConsistencyHistory.length > this.TEXTURE_HISTORY_SIZE) {
        this.textureConsistencyHistory.shift();
      }
      
      // More permissive texture consistency thresholds
      const textureConsistency = this.getTextureConsistency();
      if (textureConsistency > 0.7) {
        this.consistentSignalCounter = Math.min(this.CONSISTENT_SIGNAL_THRESHOLD + 2, 
                                               this.consistentSignalCounter + 1);
        
        // Track steady signal for improved confidence
        this.steadySignalCounter = Math.min(10, this.steadySignalCounter + 1);
      } else if (textureConsistency < 0.5) {
        this.consistentSignalCounter = Math.max(0, this.consistentSignalCounter - 0.8);
        this.steadySignalCounter = Math.max(0, this.steadySignalCounter - 1);
      }
      
      // Reward consistent signals more generously
      if (this.consistentSignalCounter >= this.CONSISTENT_SIGNAL_THRESHOLD || 
          this.steadySignalCounter > 4) {
        this.detectorScores.stability = Math.min(1.0, this.detectorScores.stability * 1.2);
        
        // Boost confidence
        this.confidenceScore = Math.min(1.0, this.confidenceScore + this.CONFIDENCE_BOOST_RATE);
      }
    }
    
    // Improved edge detection for better finger boundary recognition
    if (typeof scores.edgeValue !== 'undefined' && scores.edgeValue > 0) {
      // More responsive edge score with higher weight for current value
      this.edgeDetectionScore = this.edgeDetectionScore * 0.5 + scores.edgeValue * 0.5;
      
      // More permissive edge detection threshold
      if (this.edgeDetectionScore > 0.32 && scores.redChannel > 0.2) {
        this.fingerBorderDetected = true;
        
        // Greater improvement when edges detected
        if (this.detectorScores.stability < 0.85) {
          this.detectorScores.stability = Math.min(1.0, this.detectorScores.stability * 1.25);
        }
        
        // Boost confidence
        this.confidenceScore = Math.min(1.0, this.confidenceScore + this.CONFIDENCE_BOOST_RATE * 0.5);
      } else {
        this.fingerBorderDetected = false;
      }
    }
    
    // Improved motion detection with more tolerance
    this.trackValueForMotionDetection(scores.redValue);
    
    // More adaptive calibration thresholds
    if (this.calibrationPhase && this.detectorScores.redChannel > 0.1) {
      this.calibrationSamples.push(scores.redValue);
      
      if (this.calibrationSamples.length >= this.CALIBRATION_SAMPLE_SIZE) {
        this.calibrateAdaptiveThreshold();
        this.calibrationPhase = false;
      }
    }
    
    // Enhanced camera detection
    this.detectRearCamera(scores);

    // Optimized weighting for improved detection
    const weightedSum = this.detectorScores.redChannel * 0.32 +
                        this.detectorScores.stability * 0.32 +
                        this.detectorScores.pulsatility * 0.22 +
                        this.detectorScores.biophysical * 0.14;
    this.detectorScores.weightedSum = weightedSum;
    this.detectorScores.motionScore = this.motionArtifactScore;
    this.detectorScores.fingerMovement = this.fingerMovementScore;
    
    // Apply confidence score decay
    this.confidenceScore = Math.max(0, this.confidenceScore - this.CONFIDENCE_DECAY_RATE);
    
    // Store last confident detection time
    if (weightedSum > 0.35 && this.confidenceScore > this.MIN_CONFIDENCE_THRESHOLD) {
      this.lastConfidentDetection = Date.now();
    }
    
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
      steadySignalCounter: this.steadySignalCounter,
      confidenceScore: this.confidenceScore,
      weightedSum: weightedSum
    });
  }
  
  // Improved motion artifact detection
  private trackValueForMotionDetection(value: number): void {
    this.valueHistory.push(value);
    if (this.valueHistory.length > 15) {
      this.valueHistory.shift();
    }
    
    // More permissive motion artifact detection
    if (this.valueHistory.length >= 5) {
      const recentValues = this.valueHistory.slice(-5);
      const maxChange = Math.max(...recentValues) - Math.min(...recentValues);
      const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      const normalizedChange = meanValue > 0 ? maxChange / meanValue : 0;
      
      // More lenient motion artifact scoring
      this.motionArtifactScore = this.motionArtifactScore * 0.75 + (normalizedChange > 0.75 ? 0.25 : 0);
      
      // Improved finger movement detection
      if (this.valueHistory.length >= 10) {
        const trend = this.analyzeValueTrend(this.valueHistory.slice(-10));
        
        if (trend === 'decreasing_then_stable' || trend === 'increasing_then_stable') {
          this.fingerMovementScore = Math.min(1.0, this.fingerMovementScore + 0.15);
          
          // Boost confidence when we see meaningful patterns
          if (trend === 'increasing_then_stable') {
            this.confidenceScore = Math.min(1.0, this.confidenceScore + this.CONFIDENCE_BOOST_RATE * 0.3);
          }
        } else {
          this.fingerMovementScore = Math.max(0, this.fingerMovementScore - 0.04);
        }
        
        // Less severe penalty for finger movement
        if (this.fingerMovementScore > 0.75) {
          this.detectorScores.stability *= 0.92;
        }
      }
      
      // Less severe motion artifact penalty
      if (this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD) {
        this.detectorScores.stability *= 0.85;
      }
    }
  }

  // Enhanced trend analysis
  private analyzeValueTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' | 'increasing_then_stable' | 'decreasing_then_stable' | 'unstable' {
    if (values.length < 6) return 'unstable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const firstVar = this.calculateVariance(firstHalf);
    const secondVar = this.calculateVariance(secondHalf);
    
    // More permissive thresholds
    const THRESHOLD = 0.12;
    const VAR_THRESHOLD = 0.12;
    
    if (secondAvg > firstAvg * (1 + THRESHOLD)) {
      return secondVar < VAR_THRESHOLD ? 'increasing_then_stable' : 'increasing';
    } else if (firstAvg > secondAvg * (1 + THRESHOLD)) {
      return secondVar < VAR_THRESHOLD ? 'decreasing_then_stable' : 'decreasing';
    } else {
      return secondVar < VAR_THRESHOLD && firstVar < VAR_THRESHOLD ? 'stable' : 'unstable';
    }
  }
  
  // Auxiliar for calculating variance
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  }
  
  // Enhanced rear camera detection
  private detectRearCamera(scores: any): void {
    // More permissive camera detection thresholds
    if (scores.redChannel > 0.3 &&
        scores.redValue > 45 &&
        this.detectorScores.stability > 0.4 && 
        (this.textureConsistencyHistory.length >= 5 && 
         this.getAverageTexture() > 0.5)) {
      
      this.rearCameraDetection = true;
    } else if (scores.redChannel < 0.22 ||
               scores.redValue < 25 ||
               this.detectorScores.stability < 0.25) {
      
      this.rearCameraDetection = false;
    }
  }
  
  // Enhanced textura promedio for analysis of consistency
  private getAverageTexture(): number {
    if (this.textureConsistencyHistory.length === 0) return 0;
    
    return this.textureConsistencyHistory.reduce((sum, val) => sum + val, 0) / 
           this.textureConsistencyHistory.length;
  }
  
  // Improved texture consistency calculation
  private getTextureConsistency(): number {
    if (this.textureConsistencyHistory.length < 3) return 0;
    
    const values = [...this.textureConsistencyHistory];
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    
    // More permissive consistency scale
    return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 2.8));
  }

  // Enhanced adaptive threshold calibration
  private calibrateAdaptiveThreshold(): void {
    const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
    const trimCount = Math.floor(sortedSamples.length * 0.08);
    const trimmedSamples = sortedSamples.slice(trimCount, sortedSamples.length - trimCount);
    
    const mean = trimmedSamples.reduce((sum, val) => sum + val, 0) / trimmedSamples.length;
    const variance = trimmedSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / trimmedSamples.length;
    const stdDev = Math.sqrt(variance);
    
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // More permissive thresholds
    if (cv < 0.05) {
      this.adaptiveThreshold = 0.032;
    } else if (cv < 0.1) {
      this.adaptiveThreshold = 0.02;
    } else {
      this.adaptiveThreshold = 0.014;
    }
    
    console.log("SignalAnalyzer: Calibración adaptativa completada", {
      muestras: this.calibrationSamples.length,
      media: mean.toFixed(2),
      desviacionEstandar: stdDev.toFixed(2),
      coeficienteVariacion: cv.toFixed(3),
      umbralAdaptativo: this.adaptiveThreshold
    });
    
    this.calibrationSamples = [];
  }

  // Method for amplifying peaks with whip effect
  enhanceSignalPeaks(value: number, isPeak: boolean): number {
    if (isPeak) {
      return value * this.peakAmplificationFactor * this.whipEffect;
    } else {
      const baselineValue = value * (1 + this.peakSharpness * 0.3);
      return baselineValue * 0.85;
    }
  }

  // Improved detection logic with more permissive thresholds
  analyzeSignalMultiDetector(
    filtered: number,
    trendResult: any
  ): DetectionResult {
    // Update quality history and calculate average quality
    this.qualityHistory.push(this.detectorScores.redChannel);
    if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    const avgQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / this.qualityHistory.length;
    
    // More permissive detection thresholds
    let qualityOn = this.adaptiveThreshold * 0.85;
    let qualityOff = this.adaptiveThreshold * 0.35;
    let stabilityOn = 0.32;
    let pulseOn = 0.25;
    
    // Camera-specific adjustments
    if (this.rearCameraDetection) {
      qualityOn = Math.max(this.adaptiveThreshold * 0.85, 0.022);
      stabilityOn = 0.38;
      pulseOn = 0.3;
      
      if (this.fingerBorderDetected && this.edgeDetectionScore > 0.32) {
        qualityOn *= 0.8;
        stabilityOn *= 0.85;
      }
      
      const textureConsistency = this.getTextureConsistency();
      if (textureConsistency > 0.7) {
        stabilityOn *= 0.8;
      }
    } 
    
    // Additional detection help from consistent signal
    if (this.consistentSignalCounter > this.CONSISTENT_SIGNAL_THRESHOLD - 1 || 
        this.steadySignalCounter > 3) {
      qualityOn *= 0.85;
      stabilityOn *= 0.85;
    }
    
    // Consider recent confident detection
    const timeSinceLastConfidentDetection = Date.now() - this.lastConfidentDetection;
    if (timeSinceLastConfidentDetection < 2000) {
      const recencyFactor = Math.max(0.6, 1 - (timeSinceLastConfidentDetection / 2000));
      qualityOn *= recencyFactor;
      stabilityOn *= recencyFactor;
    }
    
    // Calculate weighted sum with refined weights
    const weightedSum = this.detectorScores.weightedSum || 0;
    
    // Improved hysteresis logic with time-based confidence
    if (!this.isCurrentlyDetected) {
      // More permissive detection initiation
      if ((avgQuality > qualityOn && 
          (trendResult !== 'non_physiological' || 
           this.consistentSignalCounter >= this.CONSISTENT_SIGNAL_THRESHOLD || 
           this.steadySignalCounter > 3) &&
          this.detectorScores.stability > stabilityOn &&
          this.detectorScores.pulsatility > pulseOn &&
          weightedSum > 0.3) || 
          this.confidenceScore > this.MIN_CONFIDENCE_THRESHOLD * 1.5) {
        
        this.consecutiveDetections++;
      } else {
        this.consecutiveDetections = 0;
      }
    } else {
      // More resilient detection maintenance
      const stabilityOff = this.rearCameraDetection ? 0.28 : 0.22;
      const pulseOff = this.rearCameraDetection ? 0.23 : 0.18;
      
      if ((avgQuality < qualityOff && 
          (trendResult === 'non_physiological' && 
           this.consistentSignalCounter < this.CONSISTENT_SIGNAL_THRESHOLD && 
           this.steadySignalCounter < 2) &&
          this.detectorScores.stability < stabilityOff &&
          this.detectorScores.pulsatility < pulseOff && 
          weightedSum < 0.22) || 
          (this.confidenceScore < this.MIN_CONFIDENCE_THRESHOLD * 0.5 && 
           timeSinceLastConfidentDetection > 3000)) {
        
        this.consecutiveNoDetections++;
      } else {
        this.consecutiveNoDetections = 0;
      }
    }
    
    // State transition with hysteresis
    if (!this.isCurrentlyDetected && 
        this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS) {
      this.isCurrentlyDetected = true;
      console.log("SignalAnalyzer: Dedo detectado después de", 
                 this.CONFIG.MIN_CONSECUTIVE_DETECTIONS, "detecciones consecutivas");
    }
    
    if (this.isCurrentlyDetected && 
        this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS) {
      this.isCurrentlyDetected = false;
      console.log("SignalAnalyzer: Dedo perdido después de", 
                 this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS, "no detecciones consecutivas");
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
        fingerMovement: this.fingerMovementScore,
        confidenceScore: this.confidenceScore,
        steadySignalCounter: this.steadySignalCounter
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
    this.adaptiveThreshold = 0.075;
    
    this.rearCameraDetection = false;
    this.textureConsistencyHistory = [];
    this.edgeDetectionScore = 0;
    this.fingerBorderDetected = false;
    this.consistentSignalCounter = 0;
    this.fingerMovementScore = 0;
    this.colorRatioHistory = [];
    this.confidenceScore = 0;
    this.lastConfidentDetection = 0;
    this.steadySignalCounter = 0;
    
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
