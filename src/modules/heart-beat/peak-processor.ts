
/**
 * Peak detection and processing for heart beat signals
 */
import { updateSlidingWindow, isValidPeakTiming } from './utils/signal-utils';
import { MIN_QUALITY_THRESHOLD, PEAK_LOCK_TIMEOUT_MS } from './constants';
import { RRIntervalsData } from './types';

export interface PeakDetectionState {
  processingPeakLock: boolean;
  lastPeakTime: number | null;
  lastReportedPeakTime: number;
  lastValidPeakValue: number;
}

export class PeakProcessor {
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak: boolean = false;
  private peakValidationBuffer: number[] = [];
  private readonly PEAK_VALIDATION_THRESHOLD = 0.25;
  private peakCandidates: {value: number, time: number}[] = [];
  private readonly MAX_PEAK_CANDIDATES = 5;
  private recentPeakAmplitudes: number[] = [];
  private recentPeakConfidences: number[] = [];
  private recentPeakDerivatives: number[] = [];
  private adaptiveSignalThreshold: number;
  private adaptiveMinConfidence: number;
  private adaptiveDerivativeThreshold: number;
  private peaksSinceLastTuning = 0;
  
  // Limits for adaptive parameters - more sensitive values
  private readonly MIN_ADAPTIVE_SIGNAL_THRESHOLD = 0.003;
  private readonly MAX_ADAPTIVE_SIGNAL_THRESHOLD = 0.25;
  private readonly MIN_ADAPTIVE_MIN_CONFIDENCE = 0.15;
  private readonly MAX_ADAPTIVE_MIN_CONFIDENCE = 0.6;
  private readonly MIN_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.05;
  private readonly MAX_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.0008;
  private readonly ADAPTIVE_TUNING_PEAK_WINDOW = 5;
  private readonly ADAPTIVE_TUNING_LEARNING_RATE = 0.4;
  
  // Initial adaptive parameters
  private readonly DEFAULT_SIGNAL_THRESHOLD = 0.005;
  private readonly DEFAULT_MIN_CONFIDENCE = 0.12;
  private readonly DEFAULT_DERIVATIVE_THRESHOLD = -0.0015;

  constructor() {
    this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
    this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
    this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
  }

  public reset(): void {
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.peakValidationBuffer = [];
    this.peakCandidates = [];
    this.recentPeakAmplitudes = [];
    this.recentPeakConfidences = [];
    this.recentPeakDerivatives = [];
    this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
    this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
    this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
    this.peaksSinceLastTuning = 0;
  }

  public enhancedPeakDetection(normalizedValue: number, derivative: number, lastPeakTime: number | null): {
    isPeak: boolean;
    confidence: number;
    rawDerivative?: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = lastPeakTime
      ? now - lastPeakTime
      : Number.MAX_VALUE;

    // Reject detections too close in time
    if (timeSinceLastPeak < 250) { // DEFAULT_MIN_PEAK_TIME_MS
      return { isPeak: false, confidence: 0 };
    }
    
    // Multiple detection systems for greater robustness
    
    // 1. Detection by derivative (direction change)
    const isDerivativePeak = derivative < this.adaptiveDerivativeThreshold && 
                           normalizedValue > this.adaptiveSignalThreshold;
    
    // 2. Detection by peak value (when value exceeds a threshold)
    const isAmplitudePeak = normalizedValue > this.adaptiveSignalThreshold * 2 && 
                          timeSinceLastPeak > 250 * 1.5;
    
    // 3. Detection by pattern (increase followed by decrease)
    let isPatternPeak = false;
    if (this.peakConfirmationBuffer.length >= 3) {
      const currentIndex = this.peakConfirmationBuffer.length - 1;
      if (this.peakConfirmationBuffer[currentIndex] > this.peakConfirmationBuffer[currentIndex - 1] && 
          this.peakConfirmationBuffer[currentIndex] > this.peakConfirmationBuffer[currentIndex - 2] &&
          normalizedValue > this.adaptiveSignalThreshold) {
        isPatternPeak = true;
      }
    }
    
    // Combine results from the three strategies
    const isPeak = isDerivativePeak || 
                 (isAmplitudePeak && normalizedValue > this.adaptiveSignalThreshold * 3) || 
                 (isPatternPeak && derivative < 0);
    
    // Calculate confidence based on how many detection strategies agree
    let confidence = 0.5; // Base
    if (isDerivativePeak) confidence += 0.3;
    if (isAmplitudePeak) confidence += 0.2;
    if (isPatternPeak) confidence += 0.2;
    
    // Limit confidence to maximum value (1.0)
    confidence = Math.min(1.0, confidence);

    return { isPeak, confidence, rawDerivative: derivative };
  }

  public confirmPeak(
    isPeak: boolean,
    normalizedValue: number
  ): boolean {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    
    // Second stage validation: ensure we're at a true peak
    // not a minor fluctuation
    if (isPeak && !this.lastConfirmedPeak) {
      // Verify this value is truly a local peak
      if (this.peakConfirmationBuffer.length >= 3) {
        const currentIndex = this.peakConfirmationBuffer.length - 1;
        const currentValue = this.peakConfirmationBuffer[currentIndex];
        
        // It's a local peak if greater than its neighbors
        const isPeakLocal = currentValue > this.peakConfirmationBuffer[currentIndex - 1];
        
        // Confirm only if it's truly a local peak and exceeds threshold
        if (isPeakLocal && currentValue > this.adaptiveSignalThreshold) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      // Reset state to detect next peak
      this.lastConfirmedPeak = false;
    }
    
    return false;
  }

  public validatePeak(peakValue: number, confidence: number): boolean {
    // Reduce threshold to allow even weaker peaks
    return confidence >= this.adaptiveMinConfidence * 0.5;
  }

  public performAdaptiveTuning(normalizedValue: number, confidence: number, rawDerivative?: number): void {
    // Store peak data for tuning
    this.recentPeakAmplitudes.push(normalizedValue);
    this.recentPeakConfidences.push(confidence);
    if (rawDerivative !== undefined) {
      this.recentPeakDerivatives.push(rawDerivative);
    }

    if (this.recentPeakAmplitudes.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
      this.recentPeakAmplitudes.shift();
    }
    if (this.recentPeakConfidences.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
      this.recentPeakConfidences.shift();
    }
    if (this.recentPeakDerivatives.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
      this.recentPeakDerivatives.shift();
    }
    
    this.peaksSinceLastTuning++;
    if (this.peaksSinceLastTuning >= Math.floor(this.ADAPTIVE_TUNING_PEAK_WINDOW / 2)) {
      this._updateAdaptiveParameters();
      this.peaksSinceLastTuning = 0;
    }
  }

  private _updateAdaptiveParameters(): void {
    if (this.recentPeakAmplitudes.length < this.ADAPTIVE_TUNING_PEAK_WINDOW / 2) return;
    
    // Calculate statistics from recent peaks
    const avgAmplitude = this.recentPeakAmplitudes.reduce((sum, val) => sum + val, 0) / 
                         this.recentPeakAmplitudes.length;
    
    const avgConfidence = this.recentPeakConfidences.reduce((sum, val) => sum + val, 0) / 
                          this.recentPeakConfidences.length;
    
    // Adjust signal threshold based on observed amplitudes
    const targetThreshold = Math.max(
      this.MIN_ADAPTIVE_SIGNAL_THRESHOLD,
      Math.min(this.MAX_ADAPTIVE_SIGNAL_THRESHOLD, avgAmplitude * 0.35)
    );
    
    // Adjust derivative threshold
    let targetDerivative = this.DEFAULT_DERIVATIVE_THRESHOLD;
    if (this.recentPeakDerivatives.length > 0) {
      const avgDerivative = this.recentPeakDerivatives.reduce((sum, val) => sum + val, 0) / 
                            this.recentPeakDerivatives.length;
      targetDerivative = Math.max(
        this.MIN_ADAPTIVE_DERIVATIVE_THRESHOLD,
        Math.min(this.MAX_ADAPTIVE_DERIVATIVE_THRESHOLD, avgDerivative * 1.1)
      );
    }
    
    // Adjust minimum confidence based on observed confidence
    const targetConfidence = Math.max(
      this.MIN_ADAPTIVE_MIN_CONFIDENCE,
      Math.min(this.MAX_ADAPTIVE_MIN_CONFIDENCE, avgConfidence * 0.8)
    );
    
    // Update values with smoothed interpolation
    this.adaptiveSignalThreshold = this.adaptiveSignalThreshold * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) + 
                                 targetThreshold * this.ADAPTIVE_TUNING_LEARNING_RATE;
    
    this.adaptiveMinConfidence = this.adaptiveMinConfidence * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) + 
                               targetConfidence * this.ADAPTIVE_TUNING_LEARNING_RATE;
    
    this.adaptiveDerivativeThreshold = this.adaptiveDerivativeThreshold * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) + 
                                     targetDerivative * this.ADAPTIVE_TUNING_LEARNING_RATE;
    
    console.log("PeakProcessor: Adaptive tuning updated:", {
      signalThreshold: this.adaptiveSignalThreshold.toFixed(4),
      minConfidence: this.adaptiveMinConfidence.toFixed(4),
      derivativeThreshold: this.adaptiveDerivativeThreshold.toFixed(4),
      basedOn: {
        averagePeakAmplitude: avgAmplitude.toFixed(4),
        peakSamples: this.recentPeakAmplitudes.length
      }
    });
  }
}
