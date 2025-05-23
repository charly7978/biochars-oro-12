/**
 * Real peak detection for heartbeat using physiological constraints
 */
export interface RealPeakResult {
  isPeak: boolean;
  confidence: number;
  interval?: number;
}

export class RealPeakDetector {
  private signalBuffer: Array<{value: number, timestamp: number}> = [];
  private peaks: Array<{value: number, timestamp: number}> = [];
  private readonly BUFFER_SIZE = 50;
  private readonly MIN_PEAK_INTERVAL = 400; // 150 BPM max
  private readonly MAX_PEAK_INTERVAL = 1500; // 40 BPM min
  private readonly PEAK_THRESHOLD_FACTOR = 0.6; // Peak must be 60% above local minimum
  private lastPeakTime = 0;

  detectPeak(signalValue: number, isFingerDetected: boolean): RealPeakResult {
    if (!isFingerDetected) {
      return { isPeak: false, confidence: 0 };
    }

    const now = Date.now();
    
    // Add to buffer
    this.signalBuffer.push({ value: signalValue, timestamp: now });
    if (this.signalBuffer.length > this.BUFFER_SIZE) {
      this.signalBuffer.shift();
    }

    // Need enough data for peak detection
    if (this.signalBuffer.length < 10) {
      return { isPeak: false, confidence: 0 };
    }

    // Check if enough time has passed since last peak
    if (now - this.lastPeakTime < this.MIN_PEAK_INTERVAL) {
      return { isPeak: false, confidence: 0 };
    }

    // Get recent data for analysis
    const recentData = this.signalBuffer.slice(-10);
    const currentPoint = recentData[recentData.length - 1];
    
    // Check if current point is a local maximum
    const isLocalMax = this.isLocalMaximum(recentData, recentData.length - 1);
    
    if (!isLocalMax) {
      return { isPeak: false, confidence: 0 };
    }

    // Calculate dynamic threshold based on recent signal range
    const recentValues = recentData.map(d => d.value);
    const recentMin = Math.min(...recentValues);
    const recentMax = Math.max(...recentValues);
    const dynamicThreshold = recentMin + (recentMax - recentMin) * this.PEAK_THRESHOLD_FACTOR;

    // Check if peak exceeds threshold
    if (currentPoint.value < dynamicThreshold) {
      return { isPeak: false, confidence: 0 };
    }

    // Calculate confidence based on peak prominence
    const prominence = (currentPoint.value - recentMin) / (recentMax - recentMin);
    const confidence = Math.min(100, prominence * 100);

    // Valid peak detected
    this.peaks.push(currentPoint);
    this.lastPeakTime = now;

    // Keep only recent peaks
    this.peaks = this.peaks.filter(p => now - p.timestamp < 10000);

    // Calculate interval if we have previous peak
    let interval: number | undefined;
    if (this.peaks.length >= 2) {
      const sortedPeaks = this.peaks.sort((a, b) => b.timestamp - a.timestamp);
      interval = sortedPeaks[0].timestamp - sortedPeaks[1].timestamp;
    }

    console.log("RealPeakDetector: Peak detected", {
      value: currentPoint.value.toFixed(2),
      confidence: confidence.toFixed(1),
      interval: interval || 'N/A',
      prominence: prominence.toFixed(2)
    });

    return {
      isPeak: true,
      confidence,
      interval
    };
  }

  private isLocalMaximum(data: Array<{value: number, timestamp: number}>, index: number): boolean {
    const windowSize = 3;
    const startIdx = Math.max(0, index - windowSize);
    const endIdx = Math.min(data.length - 1, index + windowSize);

    const currentValue = data[index].value;

    // Check if current value is maximum in the window
    for (let i = startIdx; i <= endIdx; i++) {
      if (i !== index && data[i].value >= currentValue) {
        return false;
      }
    }

    return true;
  }

  getLastInterval(): number | null {
    if (this.peaks.length < 2) return null;
    
    const sortedPeaks = this.peaks.sort((a, b) => b.timestamp - a.timestamp);
    const interval = sortedPeaks[0].timestamp - sortedPeaks[1].timestamp;
    
    // Validate interval is physiologically possible
    if (interval >= this.MIN_PEAK_INTERVAL && interval <= this.MAX_PEAK_INTERVAL) {
      return interval;
    }
    
    return null;
  }

  getCurrentBPM(): number {
    const interval = this.getLastInterval();
    if (!interval) return 0;
    
    return Math.round(60000 / interval);
  }

  reset(): void {
    this.signalBuffer = [];
    this.peaks = [];
    this.lastPeakTime = 0;
  }
}
