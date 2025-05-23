
/**
 * BPM calculation and management
 */

export class BPMCalculator {
  private bpmHistory: number[] = [];
  private smoothBPM: number = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private readonly MAX_RR_HISTORY = 20;
  private readonly BPM_ALPHA = 0.25;
  private readonly DEFAULT_MIN_BPM = 30;
  private readonly DEFAULT_MAX_BPM = 220;
  
  // New properties for extended visualization
  private peakValues: number[] = [];
  private readonly MAX_PEAK_VALUES = 15;

  constructor() {}

  public reset(): void {
    this.bpmHistory = [];
    this.smoothBPM = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.rrIntervals = [];
    this.peakValues = [];
  }

  public updatePeakTimes(now: number, peakValue?: number): void {
    this.previousPeakTime = this.lastPeakTime;
    this.lastPeakTime = now;
    
    // Save RR interval for analysis
    if (this.previousPeakTime) {
      const rrInterval = now - this.previousPeakTime;
      if (rrInterval >= 300 && rrInterval <= 2000) { // Between 30 and 200 BPM
        this.rrIntervals.push(rrInterval);
        if (this.rrIntervals.length > this.MAX_RR_HISTORY) {
          this.rrIntervals.shift();
        }
      }
    }
    
    // Store peak value if provided
    if (peakValue !== undefined) {
      this.peakValues.push(peakValue);
      if (this.peakValues.length > this.MAX_PEAK_VALUES) {
        this.peakValues.shift();
      }
    }
    
    this.updateBPM();
  }

  private updateBPM(): void {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    // Biological validation of BPM
    if (instantBPM >= this.DEFAULT_MIN_BPM && instantBPM <= this.DEFAULT_MAX_BPM) { 
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 12) { // 12 beat history for stability
        this.bpmHistory.shift();
      }
    }
  }

  public getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0 && rawBPM > 0) { 
        this.smoothBPM = rawBPM;
    } else if (rawBPM > 0) { 
        // EMA smoothing to avoid abrupt fluctuations
        this.smoothBPM = this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    } else if (this.bpmHistory.length === 0) { 
        this.smoothBPM = 0;
    }
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    // Use median for more stable BPM and eliminate outliers
    const sortedBPM = [...this.bpmHistory].sort((a,b) => a - b);
    const mid = Math.floor(sortedBPM.length / 2);
    if (sortedBPM.length % 2 === 0) {
        return (sortedBPM[mid-1] + sortedBPM[mid]) / 2;
    }
    return sortedBPM[mid];
  }

  public getFinalBPM(): number { 
    if (this.bpmHistory.length < 5) {
      return Math.round(this.getSmoothBPM()); 
    }
    
    // For more accurate final calculation, remove outliers
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.floor(sorted.length * 0.2);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (!finalSet.length) {
        return Math.round(this.getSmoothBPM());
    }
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }

  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }

  public getPeakValues(): number[] {
    return [...this.peakValues];
  }

  public getLastPeakTime(): number | null {
    return this.lastPeakTime;
  }

  // Get last RR interval in milliseconds
  public getLastRRInterval(): number | null {
    if (this.rrIntervals.length === 0) return null;
    return this.rrIntervals[this.rrIntervals.length - 1];
  }
}
