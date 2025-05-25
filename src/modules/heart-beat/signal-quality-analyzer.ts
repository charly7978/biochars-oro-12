
/**
 * Signal quality analyzer for heart beat detection
 */

export interface SignalStrengthState {
  lastSignalStrength: number;
  recentSignalStrengths: number[];
}

export class SignalQualityAnalyzer {
  private lastSignalStrength: number = 0;
  private recentSignalStrengths: number[] = [];
  private readonly SIGNAL_STRENGTH_HISTORY = 40;
  private currentSignalQuality: number = 0;
  private lowSignalCount = 0;
  private readonly LOW_SIGNAL_THRESHOLD = 0;
  private readonly LOW_SIGNAL_FRAMES = 50;

  constructor() {}

  public reset(): void {
    this.lastSignalStrength = 0;
    this.recentSignalStrengths = [];
    this.currentSignalQuality = 0;
    this.lowSignalCount = 0;
  }

  public trackSignalStrength(amplitude: number): void {
    this.lastSignalStrength = amplitude;
    this.recentSignalStrengths.push(amplitude);
    
    if (this.recentSignalStrengths.length > this.SIGNAL_STRENGTH_HISTORY) {
      this.recentSignalStrengths.shift();
    }
  }

  public adjustConfidenceForSignalStrength(confidence: number): number {
    if (this.recentSignalStrengths.length < 5) return confidence;
    
    // Calculate average signal strength
    const avgStrength = this.recentSignalStrengths.reduce((sum, val) => sum + val, 0) / 
                        this.recentSignalStrengths.length;
    
    // Very weak signals reduce confidence
    if (avgStrength < 0.1) {
      return Math.min(1.0, confidence * 0.7);
    }
    
    // Strong signals increase confidence
    if (avgStrength > 0.4) {
      return Math.min(1.0, confidence * 1.2);
    }
    
    return Math.min(1.0, confidence);
  }

  public calculateSignalQuality(normalizedValue: number, confidence: number, recentPeakAmplitudes: number[], rrIntervals: number[]): number {
    if (this.recentSignalStrengths.length < 10) return 0;
    
    // Factors for quality calculation:
    
    // 1. Signal amplitude (0-40)
    const recentAmplitudes = recentPeakAmplitudes.length > 0 ? 
        recentPeakAmplitudes : this.recentSignalStrengths.slice(-5);
    
    const avgAmplitude = recentAmplitudes.reduce((sum, val) => sum + val, 0) / 
        Math.max(1, recentAmplitudes.length);
    
    // Amplitudes < 0.05 indicate weak signal, > 0.5 indicate strong signal
    const amplitudeFactor = Math.min(40, Math.max(0, avgAmplitude * 100));
    
    // 2. Signal consistency (0-30)
    let consistencyFactor = 10; // Base value
    
    // 3. RR interval regularity (0-30)
    let regularityFactor = 0;
    if (rrIntervals.length >= 3) {
        const intervals = rrIntervals.slice(-5);
        const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        const intervalDeviation = intervals.reduce((sum, val) => sum + Math.abs(val - avgInterval), 0) / intervals.length;
        
        // Deviation < 30ms indicates high regularity, > 100ms indicates low regularity
        regularityFactor = Math.min(30, Math.max(0, 30 - intervalDeviation / 5));
    } else {
        regularityFactor = 10; // Base value if insufficient history
    }
    
    // Total quality score (0-100)
    const qualityScore = Math.min(100, amplitudeFactor + consistencyFactor + regularityFactor);
    this.currentSignalQuality = qualityScore;
    
    return qualityScore;
  }

  public autoResetIfSignalIsLow(amplitude: number): boolean {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.lowSignalCount = 0;
        return true;
      }
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1); // Gradual reduction
    }
    return false;
  }

  public getCurrentSignalQuality(): number {
    return this.currentSignalQuality;
  }

  public getSignalStrengthState(): SignalStrengthState {
    return {
      lastSignalStrength: this.lastSignalStrength,
      recentSignalStrengths: [...this.recentSignalStrengths]
    };
  }
}
