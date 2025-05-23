
import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { RealFingerDetector } from './RealFingerDetector';
import { RealSignalQuality } from './RealSignalQuality';
import { RealPeakDetector } from './RealPeakDetector';

/**
 * Simplified PPG processor focused on real physiological measurements
 * NO ARTIFICIAL AMPLIFICATION OR FAKE ENHANCEMENTS
 */
export class SimplifiedPPGProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  private fingerDetector: RealFingerDetector;
  private signalQuality: RealSignalQuality;
  private peakDetector: RealPeakDetector;
  private frameCount = 0;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.fingerDetector = new RealFingerDetector();
    this.signalQuality = new RealSignalQuality();
    this.peakDetector = new RealPeakDetector();
    
    console.log("SimplifiedPPGProcessor: Initialized with real physiological processing");
  }

  async initialize(): Promise<void> {
    this.fingerDetector.reset();
    this.signalQuality.reset();
    this.peakDetector.reset();
    this.frameCount = 0;
    console.log("SimplifiedPPGProcessor: Initialized");
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("SimplifiedPPGProcessor: Started");
  }

  stop(): void {
    this.isProcessing = false;
    console.log("SimplifiedPPGProcessor: Stopped");
  }

  async calibrate(): Promise<boolean> {
    // Real calibration - just reset and start fresh
    await this.initialize();
    console.log("SimplifiedPPGProcessor: Calibrated (reset to baseline)");
    return true;
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing || !this.onSignalReady) {
      return;
    }

    try {
      this.frameCount++;
      const shouldLog = this.frameCount % 30 === 0;

      // 1. Real finger detection
      const fingerResult = this.fingerDetector.detectFinger(imageData);
      
      // 2. Extract real red channel value (no artificial amplification)
      const rawRedValue = this.extractRealRedValue(imageData);
      
      // 3. Simple baseline correction
      const correctedValue = this.simpleBaselineCorrection(rawRedValue);
      
      // 4. Real signal quality assessment
      const quality = this.signalQuality.assessQuality(
        fingerResult.redIntensity,
        fingerResult.isFingerDetected,
        correctedValue
      );

      // 5. Real peak detection
      const peakResult = this.peakDetector.detectPeak(correctedValue, fingerResult.isFingerDetected);

      if (shouldLog) {
        console.log("SimplifiedPPGProcessor: Real measurements", {
          fingerDetected: fingerResult.isFingerDetected,
          fingerReason: fingerResult.reason,
          redIntensity: fingerResult.redIntensity.toFixed(1),
          quality: quality.toFixed(1),
          qualityDesc: this.signalQuality.getQualityDescription(quality),
          rawValue: rawRedValue.toFixed(2),
          correctedValue: correctedValue.toFixed(2),
          isPeak: peakResult.isPeak,
          bpm: this.peakDetector.getCurrentBPM()
        });
      }

      // 6. Create real processed signal (no fake values)
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: rawRedValue,
        filteredValue: correctedValue, // Real filtered value, not amplified
        quality: Math.round(quality),
        fingerDetected: fingerResult.isFingerDetected,
        roi: this.calculateSimpleROI(imageData),
        perfusionIndex: this.calculateRealPerfusionIndex(fingerResult.redIntensity, quality)
      };

      this.onSignalReady(processedSignal);

    } catch (error) {
      console.error("SimplifiedPPGProcessor: Error processing frame", error);
      this.handleError("PROCESSING_ERROR", "Error in real signal processing");
    }
  }

  private extractRealRedValue(imageData: ImageData): number {
    const { data, width, height } = imageData;
    
    // Extract from center region only
    const centerX = Math.floor(width * 0.4);
    const centerY = Math.floor(height * 0.4);
    const regionSize = Math.floor(Math.min(width, height) * 0.2);
    
    let totalRed = 0;
    let pixelCount = 0;
    
    for (let y = centerY; y < centerY + regionSize && y < height; y++) {
      for (let x = centerX; x < centerX + regionSize && x < width; x++) {
        const idx = (y * width + x) * 4;
        totalRed += data[idx]; // Just the red channel, no manipulation
        pixelCount++;
      }
    }
    
    return pixelCount > 0 ? totalRed / pixelCount : 0;
  }

  private simpleBaselineCorrection(value: number): number {
    // Simple high-pass filter to remove DC component
    // This is much simpler than the complex filtering in the original
    const alpha = 0.99;
    
    if (!this.lastBaselineValue) {
      this.lastBaselineValue = value;
      return 0;
    }
    
    this.lastBaselineValue = alpha * this.lastBaselineValue + (1 - alpha) * value;
    return value - this.lastBaselineValue;
  }
  
  private lastBaselineValue?: number;

  private calculateSimpleROI(imageData: ImageData) {
    // Simple center ROI
    const { width, height } = imageData;
    return {
      x: Math.floor(width * 0.3),
      y: Math.floor(height * 0.3),
      width: Math.floor(width * 0.4),
      height: Math.floor(height * 0.4)
    };
  }

  private calculateRealPerfusionIndex(redIntensity: number, quality: number): number {
    // Real perfusion index calculation (simplified)
    if (quality < 40) return 0;
    
    // Typical perfusion index ranges from 0.2% to 20%
    // Higher red intensity typically means better perfusion
    const normalizedRed = Math.max(0, Math.min(1, (redIntensity - 100) / 100));
    return normalizedRed * 10; // Scale to 0-10% range
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
