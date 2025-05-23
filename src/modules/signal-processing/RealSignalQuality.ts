
/**
 * Real signal quality assessment based on actual physiological parameters
 */
export class RealSignalQuality {
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 30;

  assessQuality(
    redIntensity: number, 
    isFingerDetected: boolean,
    signalValue: number
  ): number {
    if (!isFingerDetected) {
      return 0;
    }

    this.signalHistory.push(signalValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }

    if (this.signalHistory.length < 10) {
      return 20; // Initial low quality until we have enough data
    }

    let qualityScore = 0;

    // 1. Red channel quality (0-30 points)
    const redQuality = this.assessRedChannelQuality(redIntensity);
    qualityScore += redQuality;

    // 2. Signal stability (0-30 points)
    const stabilityQuality = this.assessSignalStability();
    qualityScore += stabilityQuality;

    // 3. Pulsatile variation (0-40 points)
    const pulsatileQuality = this.assessPulsatileVariation();
    qualityScore += pulsatileQuality;

    return Math.min(100, Math.max(0, qualityScore));
  }

  private assessRedChannelQuality(redIntensity: number): number {
    // Optimal red intensity for finger PPG: 140-180
    const optimal = 160;
    const distance = Math.abs(redIntensity - optimal);
    
    if (distance <= 10) return 30; // Excellent
    if (distance <= 20) return 25; // Very good
    if (distance <= 30) return 20; // Good
    if (distance <= 40) return 15; // Fair
    return 10; // Poor
  }

  private assessSignalStability(): number {
    if (this.signalHistory.length < 10) return 0;

    const recent = this.signalHistory.slice(-10);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher stability
    const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 1;
    
    if (coefficientOfVariation <= 0.1) return 30; // Very stable
    if (coefficientOfVariation <= 0.2) return 25; // Stable
    if (coefficientOfVariation <= 0.3) return 20; // Moderately stable
    if (coefficientOfVariation <= 0.5) return 15; // Somewhat unstable
    return 10; // Unstable
  }

  private assessPulsatileVariation(): number {
    if (this.signalHistory.length < 20) return 0;

    // Look for rhythmic variations typical of heartbeat
    const recent = this.signalHistory.slice(-20);
    
    // Calculate peak-to-peak variation
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const range = max - min;
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    // Pulsatile index (range relative to mean)
    const pulsatileIndex = mean !== 0 ? range / mean : 0;
    
    // Good pulsatile signal should have 5-20% variation
    if (pulsatileIndex >= 0.05 && pulsatileIndex <= 0.20) return 40; // Excellent pulsatility
    if (pulsatileIndex >= 0.03 && pulsatileIndex <= 0.30) return 30; // Good pulsatility
    if (pulsatileIndex >= 0.02 && pulsatileIndex <= 0.40) return 20; // Fair pulsatility
    if (pulsatileIndex >= 0.01) return 10; // Poor pulsatility
    return 0; // No pulsatility detected
  }

  getQualityDescription(quality: number): string {
    if (quality >= 80) return "Excelente";
    if (quality >= 60) return "Buena";
    if (quality >= 40) return "Regular";
    if (quality >= 20) return "Pobre";
    return "Sin señal";
  }

  reset(): void {
    this.signalHistory = [];
  }
}
