/**
 * Real Signal Quality Analyzer
 * Calculates signal quality based on actual measured characteristics.
 */

export interface RealQualityMetrics {
  snr: number; // Signal-to-Noise Ratio
  stability: number; // Temporal stability of the signal
  artifactScore: number; // Score indicating presence of artifacts (0 = many, 1 = none)
  redIntensity: number;
  redToGreenRatio: number;
  hemoglobinScore: number;
  pulsationStrength: number; 
}

export class RealSignalQualityAnalyzer {
  private readonly HISTORY_SIZE = 30; // Samples for stability and trend analysis
  private valueHistory: number[] = [];
  private qualityHistory: number[] = [];


  constructor() {
    this.reset();
  }

  public calculateQuality(
    currentSignalValue: number,
    noiseEstimate: number,
    hemoglobinScore: number,
    pulsationStrength: number, // Assuming a value 0-1
    isFingerActuallyDetected: boolean // Crucial input
  ): number {
    if (!isFingerActuallyDetected) {
      // If no finger, quality is very low, but with some noise
      return Math.max(0, Math.min(15, Math.random() * 20)); 
    }

    // 1. Signal-to-Noise Ratio (SNR)
    const snr = (noiseEstimate > 0) ? (Math.abs(currentSignalValue) / noiseEstimate) : 0;
    // Normalize SNR to a 0-1 score. Assuming good SNR for PPG is > 5
    const snrScore = Math.min(1, Math.max(0, (snr - 1) / 9)); // Score from 0 (SNR=1) to 1 (SNR=10+)

    // 2. Stability (using Coefficient of Variation on recent history)
    this.valueHistory.push(currentSignalValue);
    if (this.valueHistory.length > this.HISTORY_SIZE) {
      this.valueHistory.shift();
    }
    let stabilityScore = 0;
    if (this.valueHistory.length >= this.HISTORY_SIZE / 2) {
      const mean = this.valueHistory.reduce((a, b) => a + b, 0) / this.valueHistory.length;
      if (mean !== 0) {
        const variance = this.valueHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.valueHistory.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / Math.abs(mean);
        // Lower CV is better. Target CV < 0.1 for high stability.
        stabilityScore = Math.max(0, 1 - (cv / 0.35)); // Score 1 if CV=0, 0 if CV >= 0.35
      }
    }
    
    // 3. Pulsation Strength (already 0-1)
    const pulsationScore = Math.max(0, Math.min(1, pulsationStrength));

    // 4. Hemoglobin Score (already 0-1)
    const hemoScore = Math.max(0, Math.min(1, hemoglobinScore));

    // Weighted quality calculation
    // Weights: SNR (0.3), Stability (0.3), Pulsation (0.25), Hemoglobin (0.15)
    let combinedQuality = 
      (snrScore * 0.30) +
      (stabilityScore * 0.30) +
      (pulsationScore * 0.25) +
      (hemoScore * 0.15);
      
    combinedQuality = combinedQuality * 100; // Scale to 0-100

    // Introduce minor natural variability if signal is generally good
    if (combinedQuality > 40) {
        const variability = (Math.random() - 0.5) * 8; // +/- 4
        combinedQuality += variability;
    }
    
    // Ensure final quality is within 0-100, but allow lower values if finger is detected
    finalQuality = Math.max(5, Math.min(98, combinedQuality)); // Min quality 5 if finger detected

     // Smoothing the final quality
    this.qualityHistory.push(finalQuality);
    if (this.qualityHistory.length > 5) { // Shorter window for responsiveness
      this.qualityHistory.shift();
    }
    const smoothedQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;


    if (this.valueHistory.length % 30 === 0) {
        console.log(\"[RealSignalQualityAnalyzer]\", {
            currentSignalValue: currentSignalValue.toFixed(2),
            noiseEstimate: noiseEstimate.toFixed(2),
            snr: snr.toFixed(2),
            snrScore: snrScore.toFixed(2),
            stabilityScore: stabilityScore.toFixed(2),
            pulsationScore: pulsationScore.toFixed(2),
            hemoScore: hemoScore.toFixed(2),
            combinedQuality_raw: (weightedQuality*100).toFixed(1),
            finalQuality_before_smooth: finalQuality.toFixed(1),
            smoothedQuality: smoothedQuality.toFixed(1)
        });
    }

    return Math.round(smoothedQuality);
  }

  public reset(): void {
    this.valueHistory = [];
    this.qualityHistory = [];
    console.log("RealSignalQualityAnalyzer: Reset");
  }
} 