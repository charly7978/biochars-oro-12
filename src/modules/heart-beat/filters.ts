
/**
 * Signal filtering utilities for heart beat detection
 */

export class HeartBeatFilters {
  private readonly MEDIAN_FILTER_WINDOW = 2;
  private readonly MOVING_AVERAGE_WINDOW = 2;
  private readonly EMA_ALPHA = 0.65;
  
  // Filter buffers
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;

  constructor() {}

  public reset(): void {
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.smoothedValue = 0;
  }

  public medianFilter(value: number): number {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  public calculateMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }

  public calculateEMA(value: number): number {
    this.smoothedValue =
      this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  public boostSignal(value: number, signalBuffer: number[]): number {
    const SIGNAL_BOOST_FACTOR = 4.2;
    
    if (signalBuffer.length < 10) return value * SIGNAL_BOOST_FACTOR * 1.8; // Extra boost initially
    
    // Calculate recent signal statistics
    const recentSignals = signalBuffer.slice(-10);
    const avgSignal = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const maxSignal = Math.max(...recentSignals);
    const minSignal = Math.min(...recentSignals);
    const range = maxSignal - minSignal;
    
    // Calculate amplification factor proportional to signal strength
    let boostFactor = SIGNAL_BOOST_FACTOR;
    
    if (range < 0.4) { // Lower threshold to boost more signals
      // Very weak signal - amplify more aggressively
      boostFactor = SIGNAL_BOOST_FACTOR * 4.0; // Much stronger boost
    } else if (range < 1.5) {
      // Weak-moderate signal - amplify moderately
      boostFactor = SIGNAL_BOOST_FACTOR * 3.0; // Stronger boost
    } else if (range > 6.0) {
      // Strong signal - minimal amplification
      boostFactor = 1.5; // Small amplification instead of none
    }
    
    // Apply linear amplification centered on average
    const centered = value - avgSignal;
    const boosted = avgSignal + (centered * boostFactor);
    
    // Enhanced peak visualization: preserve peaks better
    const isPotentialPeak = value > avgSignal + range * 0.3;
    if (isPotentialPeak) {
        // Apply extra boost to potential peaks for better visualization
        return boosted * 1.2;
    }
    
    return boosted;
  }
}
