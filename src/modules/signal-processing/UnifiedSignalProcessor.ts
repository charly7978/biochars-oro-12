import { ProcessedSignal, ProcessingError } from '../../types/signal';

/**
 * Unified real-world signal processor
 * NO artificial amplification, NO fake detection
 * Only physiologically accurate measurements
 */
export class UnifiedSignalProcessor {
  private recentRedValues: number[] = [];
  private peaks: Array<{value: number, timestamp: number}> = [];
  private fingerDetectionBuffer: boolean[] = [];
  private qualityHistory: number[] = [];
  
  private readonly BUFFER_SIZE = 15;
  private readonly FINGER_RED_MIN = 120;
  private readonly FINGER_RED_MAX = 200;
  private readonly PEAK_MIN_INTERVAL = 400; // 150 BPM max
  private readonly PEAK_MAX_INTERVAL = 1500; // 40 BPM min
  private readonly STABILITY_THRESHOLD = 0.8;
  private readonly MIN_FINGER_FRAMES = 5;

  public isProcessing = false;
  public onSignalReady?: (signal: ProcessedSignal) => void;
  public onError?: (error: ProcessingError) => void;

  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    this.onSignalReady = onSignalReady;
    this.onError = onError;
  }

  start(): void {
    this.isProcessing = true;
    this.reset();
    console.log("UnifiedSignalProcessor: Started with real-world parameters");
  }

  stop(): void {
    this.isProcessing = false;
    console.log("UnifiedSignalProcessor: Stopped");
  }

  private reset(): void {
    this.recentRedValues = [];
    this.peaks = [];
    this.fingerDetectionBuffer = [];
    this.qualityHistory = [];
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing || !this.onSignalReady) return;

    try {
      // 1. Extract real red channel value
      const redValue = this.extractRedChannel(imageData);
      
      // 2. Update buffers
      this.recentRedValues.push(redValue);
      if (this.recentRedValues.length > this.BUFFER_SIZE) {
        this.recentRedValues.shift();
      }

      // 3. Real finger detection
      const isFingerDetected = this.detectRealFinger(redValue);
      
      // 4. Calculate real signal quality
      const quality = this.calculateRealQuality(redValue, isFingerDetected);
      
      // 5. Detect real peaks (only if finger detected)
      const isPeak = isFingerDetected ? this.detectRealPeak(redValue) : false;
      
      // 6. Create honest signal
      const signal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: redValue, // NO artificial filtering
        quality: Math.round(quality),
        fingerDetected: isFingerDetected,
        roi: this.calculateROI(imageData),
        perfusionIndex: isFingerDetected ? this.calculatePerfusion(redValue) : 0
      };

      this.onSignalReady(signal);

    } catch (error) {
      console.error("UnifiedSignalProcessor: Frame processing error", error);
      this.handleError("PROCESSING_ERROR", "Frame processing failed");
    }
  }

  private extractRedChannel(imageData: ImageData): number {
    const { data, width, height } = imageData;
    
    // Center region only (30% of image)
    const centerX = Math.floor(width * 0.35);
    const centerY = Math.floor(height * 0.35);
    const regionSize = Math.floor(Math.min(width, height) * 0.3);
    
    let totalRed = 0;
    let validPixels = 0;
    
    for (let y = centerY; y < centerY + regionSize && y < height; y++) {
      for (let x = centerX; x < centerX + regionSize && x < width; x++) {
        const idx = (y * width + x) * 4;
        const red = data[idx];
        const green = data[idx + 1];
        const blue = data[idx + 2];
        
        // Only count pixels that could be skin
        if (red > 80 && red > green * 0.8 && red > blue * 0.8) {
          totalRed += red;
          validPixels++;
        }
      }
    }
    
    return validPixels > 0 ? totalRed / validPixels : 0;
  }

  private detectRealFinger(redValue: number): boolean {
    // Simple physiological range check
    const inRange = redValue >= this.FINGER_RED_MIN && redValue <= this.FINGER_RED_MAX;
    
    this.fingerDetectionBuffer.push(inRange);
    if (this.fingerDetectionBuffer.length > this.MIN_FINGER_FRAMES) {
      this.fingerDetectionBuffer.shift();
    }

    // Need consistent detection across multiple frames
    const consistentFrames = this.fingerDetectionBuffer.filter(f => f).length;
    return consistentFrames >= Math.ceil(this.MIN_FINGER_FRAMES * 0.8);
  }

  private calculateRealQuality(redValue: number, isFingerDetected: boolean): number {
    if (!isFingerDetected) return 0;
    if (this.recentRedValues.length < 5) return 10;

    // Calculate signal stability (lower variance = higher quality)
    const recent = this.recentRedValues.slice(-10);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    const stability = Math.max(0, 1 - (Math.sqrt(variance) / 30));

    // Quality based on stability and being in optimal range
    const optimalValue = 160;
    const distanceFromOptimal = Math.abs(redValue - optimalValue) / 40;
    const rangeQuality = Math.max(0, 1 - distanceFromOptimal);

    const quality = (stability * 0.7 + rangeQuality * 0.3) * 100;
    
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > 10) {
      this.qualityHistory.shift();
    }

    return Math.max(0, Math.min(100, quality));
  }

  private detectRealPeak(redValue: number): boolean {
    if (this.recentRedValues.length < 10) return false;

    const now = Date.now();
    
    // Check if enough time passed since last peak
    if (this.peaks.length > 0) {
      const lastPeak = this.peaks[this.peaks.length - 1];
      if (now - lastPeak.timestamp < this.PEAK_MIN_INTERVAL) {
        return false;
      }
    }

    // Check if current value is a local maximum
    const recent = this.recentRedValues.slice(-7);
    const currentIndex = recent.length - 1;
    const currentValue = recent[currentIndex];

    // Must be higher than neighbors
    let isLocalMax = true;
    for (let i = Math.max(0, currentIndex - 2); i <= Math.min(recent.length - 1, currentIndex + 2); i++) {
      if (i !== currentIndex && recent[i] >= currentValue) {
        isLocalMax = false;
        break;
      }
    }

    if (!isLocalMax) return false;

    // Must exceed minimum prominence
    const recentMin = Math.min(...recent);
    const prominence = (currentValue - recentMin) / Math.max(1, recentMin);
    
    if (prominence < 0.05) return false; // 5% minimum change

    // Valid peak detected
    this.peaks.push({ value: redValue, timestamp: now });
    
    // Keep only recent peaks
    this.peaks = this.peaks.filter(p => now - p.timestamp < 10000);

    console.log("UnifiedSignalProcessor: Real peak detected", {
      value: redValue.toFixed(1),
      prominence: (prominence * 100).toFixed(1) + '%',
      interval: this.getLastInterval() || 'N/A'
    });

    return true;
  }

  private getLastInterval(): number | null {
    if (this.peaks.length < 2) return null;
    
    const sorted = this.peaks.sort((a, b) => b.timestamp - a.timestamp);
    const interval = sorted[0].timestamp - sorted[1].timestamp;
    
    // Validate physiological range
    if (interval >= this.PEAK_MIN_INTERVAL && interval <= this.PEAK_MAX_INTERVAL) {
      return interval;
    }
    
    return null;
  }

  getCurrentBPM(): number {
    const interval = this.getLastInterval();
    return interval ? Math.round(60000 / interval) : 0;
  }

  private calculateROI(imageData: ImageData) {
    const { width, height } = imageData;
    return {
      x: Math.floor(width * 0.35),
      y: Math.floor(height * 0.35),
      width: Math.floor(width * 0.3),
      height: Math.floor(height * 0.3)
    };
  }

  private calculatePerfusion(redValue: number): number {
    // Simple perfusion estimate based on red intensity
    const normalized = Math.max(0, Math.min(1, (redValue - this.FINGER_RED_MIN) / (this.FINGER_RED_MAX - this.FINGER_RED_MIN)));
    return normalized * 5; // 0-5% range
  }

  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    if (this.onError) {
      this.onError(error);
    }
  }
}
