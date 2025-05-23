
/**
 * Real finger detection based on actual physiological parameters
 * NO ARTIFICIAL BOOSTING OR FAKE CONFIDENCE
 */
export interface RealFingerDetectionResult {
  isFingerDetected: boolean;
  redIntensity: number;
  confidence: number;
  reason: string;
}

export class RealFingerDetector {
  private recentRedValues: number[] = [];
  private readonly HISTORY_SIZE = 10;
  private readonly MIN_RED_FOR_FINGER = 120; // Real physiological minimum
  private readonly MAX_RED_FOR_FINGER = 200; // Real physiological maximum
  private readonly MIN_CONSISTENCY_FRAMES = 5; // Frames needed for stable detection
  private consecutiveGoodFrames = 0;
  private consecutiveBadFrames = 0;
  private isCurrentlyDetected = false;

  detectFinger(imageData: ImageData): RealFingerDetectionResult {
    // Extract red channel intensity from center region
    const { redIntensity, coverage } = this.extractRedChannelData(imageData);
    
    // Track recent values for stability analysis
    this.recentRedValues.push(redIntensity);
    if (this.recentRedValues.length > this.HISTORY_SIZE) {
      this.recentRedValues.shift();
    }

    // Calculate stability (low variance = good finger contact)
    const stability = this.calculateStability();
    
    // Real finger detection criteria
    const isInValidRange = redIntensity >= this.MIN_RED_FOR_FINGER && 
                          redIntensity <= this.MAX_RED_FOR_FINGER;
    const hasGoodCoverage = coverage > 0.6; // At least 60% of region covered
    const isStable = stability > 0.7; // Stable signal
    
    const currentFrameGood = isInValidRange && hasGoodCoverage && isStable;
    
    // Hysteresis for stable detection
    if (currentFrameGood) {
      this.consecutiveGoodFrames++;
      this.consecutiveBadFrames = 0;
      
      if (!this.isCurrentlyDetected && this.consecutiveGoodFrames >= this.MIN_CONSISTENCY_FRAMES) {
        this.isCurrentlyDetected = true;
      }
    } else {
      this.consecutiveBadFrames++;
      this.consecutiveGoodFrames = 0;
      
      if (this.isCurrentlyDetected && this.consecutiveBadFrames >= 3) {
        this.isCurrentlyDetected = false;
      }
    }

    // Real confidence based on actual measurements
    const confidence = this.calculateRealConfidence(redIntensity, stability, coverage);
    
    // Determine reason for detection state
    let reason = '';
    if (!isInValidRange) {
      reason = redIntensity < this.MIN_RED_FOR_FINGER ? 'Too dark' : 'Too bright';
    } else if (!hasGoodCoverage) {
      reason = 'Insufficient coverage';
    } else if (!isStable) {
      reason = 'Signal unstable';
    } else {
      reason = 'Good finger contact';
    }

    return {
      isFingerDetected: this.isCurrentlyDetected,
      redIntensity,
      confidence,
      reason
    };
  }

  private extractRedChannelData(imageData: ImageData): { redIntensity: number; coverage: number } {
    const { data, width, height } = imageData;
    
    // Focus on center region (30% of image)
    const centerX = Math.floor(width * 0.35);
    const centerY = Math.floor(height * 0.35);
    const regionWidth = Math.floor(width * 0.3);
    const regionHeight = Math.floor(height * 0.3);
    
    let totalRed = 0;
    let pixelCount = 0;
    let validPixels = 0;
    
    for (let y = centerY; y < centerY + regionHeight; y++) {
      for (let x = centerX; x < centerX + regionWidth; x++) {
        const idx = (y * width + x) * 4;
        const red = data[idx];
        const green = data[idx + 1];
        const blue = data[idx + 2];
        
        // Only count pixels that could be finger tissue
        if (red > 80 && red > green && red > blue) {
          totalRed += red;
          validPixels++;
        }
        pixelCount++;
      }
    }
    
    const redIntensity = validPixels > 0 ? totalRed / validPixels : 0;
    const coverage = validPixels / pixelCount;
    
    return { redIntensity, coverage };
  }

  private calculateStability(): number {
    if (this.recentRedValues.length < 3) return 0;
    
    const values = this.recentRedValues.slice(-5);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to stability score (lower variance = higher stability)
    return Math.max(0, 1 - (stdDev / 50));
  }

  private calculateRealConfidence(redIntensity: number, stability: number, coverage: number): number {
    // Real confidence based on actual measurements, not artificial boosting
    let confidence = 0;
    
    // Red intensity contribution (0-40 points)
    if (redIntensity >= this.MIN_RED_FOR_FINGER && redIntensity <= this.MAX_RED_FOR_FINGER) {
      const optimal = 160; // Optimal red value for finger
      const distance = Math.abs(redIntensity - optimal);
      confidence += Math.max(0, 40 - (distance / 2));
    }
    
    // Stability contribution (0-30 points)
    confidence += stability * 30;
    
    // Coverage contribution (0-30 points)
    confidence += coverage * 30;
    
    return Math.min(100, Math.max(0, confidence));
  }

  reset(): void {
    this.recentRedValues = [];
    this.consecutiveGoodFrames = 0;
    this.consecutiveBadFrames = 0;
    this.isCurrentlyDetected = false;
  }
}
