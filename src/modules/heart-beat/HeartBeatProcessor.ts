
/**
 * Heart beat processor - main class for heart rate detection
 */
import { 
  MIN_QUALITY_THRESHOLD,
  PEAK_LOCK_TIMEOUT_MS,
  MAX_SIGNAL_HISTORY,
  SIGNAL_WINDOW_SIZE,
  INITIAL_SENSITIVITY_LEVEL
} from './constants';
import { HeartBeatResult } from './types';
import { AudioManager } from './audio-manager';
import { HeartBeatFilters } from './filters';
import { PeakProcessor } from './peak-processor';
import { BPMCalculator } from './bpm-calculator';
import { SignalQualityAnalyzer } from './signal-quality-analyzer';

export class HeartBeatProcessor {
  // Core processing components
  private audioManager: AudioManager;
  private filters: HeartBeatFilters;
  private peakProcessor: PeakProcessor;
  private bpmCalculator: BPMCalculator;
  private signalQualityAnalyzer: SignalQualityAnalyzer;
  
  // Signal processing variables
  private signalBuffer: number[] = [];
  private baseline: number = 0;
  private lastValue: number = 0;
  private values: number[] = [];
  private startTime: number = 0;
  private isArrhythmiaDetected: boolean = false;
  private readonly BASELINE_FACTOR = 0.65;
  private readonly DEFAULT_SAMPLE_RATE = 60;
  private readonly DEFAULT_WINDOW_SIZE = 20;
  private readonly WARMUP_TIME_MS = 500;

  constructor() {
    this.audioManager = new AudioManager();
    this.filters = new HeartBeatFilters();
    this.peakProcessor = new PeakProcessor();
    this.bpmCalculator = new BPMCalculator();
    this.signalQualityAnalyzer = new SignalQualityAnalyzer();
    
    this.startTime = Date.now();
    console.log("HeartBeatProcessor: Instance created with medical configuration");
  }

  public processSignal(value: number): HeartBeatResult {
    // Apply reasonable amplification
    value = this.filters.boostSignal(value, this.signalBuffer);
    
    const medVal = this.filters.medianFilter(value);
    const movAvgVal = this.filters.calculateMovingAverage(medVal);
    const smoothed = this.filters.calculateEMA(movAvgVal);
    
    // Explicitly define filteredValue
    const filteredValue = smoothed;

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.DEFAULT_WINDOW_SIZE) { 
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 15) { // Reduced requirement for faster evaluation
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: filteredValue,
        arrhythmiaCount: 0,
        signalQuality: 0
      };
    }

    // Baseline tracking with better adaptation for weak signals
    this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);
    const normalizedValue = smoothed - this.baseline;
    
    // Track signal strength
    this.signalQualityAnalyzer.trackSignalStrength(Math.abs(normalizedValue));
    
    // Auto-reset with adaptive threshold for weak signals
    const shouldReset = this.signalQualityAnalyzer.autoResetIfSignalIsLow(Math.abs(normalizedValue));
    if (shouldReset) {
      this.resetDetectionStates();
    }

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // Enhanced derivative calculation for direction changes
    let smoothDerivative = 0;
    if (this.values.length === 3) {
      // More precise central derivative
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    } else {
      smoothDerivative = smoothed - this.lastValue;
    }
    this.lastValue = smoothed;
    
    // Medically valid peak detection with adaptive threshold
    const peakDetectionResult = this.peakProcessor.enhancedPeakDetection(
      normalizedValue, 
      smoothDerivative, 
      this.bpmCalculator.getLastPeakTime()
    );
    let isPeak = peakDetectionResult.isPeak;
    const confidence = peakDetectionResult.confidence;
    const rawDerivative = peakDetectionResult.rawDerivative;
    
    // Secondary validation stage for peak confirmation
    const isConfirmedPeak = this.peakProcessor.confirmPeak(isPeak, normalizedValue);

    // Calculate current signal quality based on multiple factors (0-100)
    const rrData = this.bpmCalculator.getRRIntervals();
    const currentQuality = this.signalQualityAnalyzer.calculateSignalQuality(
      normalizedValue, 
      confidence, 
      [], // recentPeakAmplitudes - not needed here
      rrData.intervals
    );

    // If we have a confirmed peak and not in warmup period
    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      
      // Strict validation according to medical criteria
      if (this.peakProcessor.validatePeak(normalizedValue, confidence)) {
        // Update BPM calculator with new peak
        this.bpmCalculator.updatePeakTimes(now);
        
        // Play sound and update state
        this.audioManager.playHeartSound(1.0, this.isArrhythmiaDetected, this.isInWarmup());

        // Update adaptive parameters for peak detection
        this.peakProcessor.performAdaptiveTuning(normalizedValue, confidence, rawDerivative);
      } else {
        console.log(`HeartBeatProcessor: Peak rejected - insufficient confidence: ${confidence}`);
        isPeak = false;
      }
    }
    
    // Return result with new parameters
    return {
      bpm: Math.round(this.bpmCalculator.getSmoothBPM()),
      confidence: isPeak ? 0.95 : this.signalQualityAnalyzer.adjustConfidenceForSignalStrength(0.6),
      isPeak: isPeak,
      filteredValue: filteredValue,
      arrhythmiaCount: 0,
      signalQuality: currentQuality,
      rrData: this.bpmCalculator.getRRIntervals()
    };
  }

  private isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  public setArrhythmiaDetected(isDetected: boolean): void {
    this.isArrhythmiaDetected = isDetected;
    console.log(`HeartBeatProcessor: Estado de arritmia establecido a ${isDetected}`);
  }

  private resetDetectionStates(): void {
    this.peakProcessor.reset();
    this.isArrhythmiaDetected = false;
    console.log("HeartBeatProcessor: auto-reset adaptative parameters and arrhythmia flag (low signal).");
  }

  public getFinalBPM(): number { 
    return this.bpmCalculator.getFinalBPM();
  }

  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return this.bpmCalculator.getRRIntervals();
  }

  public reset(): void {
    this.signalBuffer = [];
    this.values = [];
    this.baseline = 0;
    this.lastValue = 0;
    this.startTime = Date.now();
    
    this.filters.reset();
    this.peakProcessor.reset();
    this.bpmCalculator.reset();
    this.signalQualityAnalyzer.reset();
    this.isArrhythmiaDetected = false;
    
    console.log("HeartBeatProcessor: Full reset performed");
  }
}
