
/**
 * Detector for artificial sources (lights, objects, reflective surfaces)
 */
export class ArtificialSourceDetector {
  /**
   * Detect artificial sources that should be rejected
   */
  public isArtificialSource(
    red: number, 
    green: number, 
    blue: number, 
    stability: number, 
    rToGRatio: number
  ): boolean {
    // Direct light: very bright and balanced
    const isDirectLight = red > 170 && green > 150 && blue > 130;
    
    // Artificial surface: too balanced (not like skin)
    const tooBalanced = Math.abs(red - green) < 15 && Math.abs(green - blue) < 15;
    
    // Artificial stability: too stable to be biological
    const unnaturallyStable = stability > 0.85 && red > 140;
    
    // Non-biological ratio: very low or very high
    const nonBiologicalRatio = rToGRatio < 1.1 || rToGRatio > 2.2;
    
    // Bright object: very intense without biological characteristics
    const brightObject = red > 180 && (tooBalanced || nonBiologicalRatio);
    
    // Reflective surface
    const reflectiveSurface = red > 160 && green > 140 && blue > 120 && stability > 0.8;
    
    return isDirectLight || brightObject || reflectiveSurface || 
           (unnaturallyStable && tooBalanced) || 
           (red > 150 && nonBiologicalRatio);
  }
}
