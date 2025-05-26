
/**
 * Analyzer for natural signal variability patterns
 */
export class SignalVariabilityAnalyzer {
  private signalConsistencyHistory: number[] = [];
  
  /**
   * Verify natural variability of blood pulse signal
   */
  public hasNaturalVariability(redValue: number): boolean {
    this.signalConsistencyHistory.push(redValue);
    if (this.signalConsistencyHistory.length > 10) {
      this.signalConsistencyHistory.shift();
    }
    
    if (this.signalConsistencyHistory.length < 6) return false;
    
    const recent = this.signalConsistencyHistory.slice(-6);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variations = recent.map(v => Math.abs(v - avg));
    const avgVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
    
    // Natural variability: neither too stable nor too chaotic
    const variationRatio = avgVariation / avg;
    return variationRatio >= 0.03 && variationRatio <= 0.12;
  }
  
  /**
   * Reset signal history
   */
  public reset(): void {
    this.signalConsistencyHistory = [];
  }
}
