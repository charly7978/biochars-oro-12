
import { DETECTOR_CONFIG } from './DetectorConfig';

/**
 * Validator for biological characteristics of human finger
 */
export class BiologicalValidator {
  /**
   * Verify biological perfusion pattern specific to human skin
   */
  public hasBiologicalPerfusion(red: number, green: number, blue: number): boolean {
    // Typical human skin pattern with circulation
    const skinTone = red > green && red > blue;
    const moderateIntensity = red >= 80 && red <= 160;
    const greenBalance = green >= 40 && green <= 110;
    const blueBalance = blue >= 25 && blue <= 90;
    
    // Verify not too bright (artificial)
    const notTooBright = !(red > 170 && green > 140 && blue > 120);
    
    return skinTone && moderateIntensity && greenBalance && blueBalance && notTooBright;
  }
  
  /**
   * Check if values are within biological red range
   */
  public isInBiologicalRedRange(redValue: number): boolean {
    return redValue >= DETECTOR_CONFIG.BIOLOGICAL_RED_MIN && 
           redValue <= DETECTOR_CONFIG.BIOLOGICAL_RED_MAX;
  }
  
  /**
   * Check if red-to-green ratio indicates hemoglobin presence
   */
  public hasValidHemoglobinRatio(rToGRatio: number): boolean {
    return rToGRatio >= DETECTOR_CONFIG.RED_TO_GREEN_RATIO_MIN && 
           rToGRatio <= DETECTOR_CONFIG.RED_TO_GREEN_RATIO_MAX;
  }
  
  /**
   * Check if texture score indicates biological surface
   */
  public hasBiologicalTexture(textureScore: number): boolean {
    return textureScore >= DETECTOR_CONFIG.MIN_TEXTURE_FOR_BIOLOGICAL;
  }
  
  /**
   * Check if stability indicates biological signal
   */
  public hasBiologicalStability(avgStability: number): boolean {
    return avgStability >= DETECTOR_CONFIG.MIN_STABILITY_FOR_BIOLOGICAL;
  }
}
