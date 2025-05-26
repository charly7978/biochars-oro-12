
import { DETECTOR_CONFIG } from './DetectorConfig';

/**
 * Validator for biological characteristics of human finger
 */
export class BiologicalValidator {
  /**
   * Verify biological perfusion pattern specific to human skin
   */
  public hasBiologicalPerfusion(red: number, green: number, blue: number): boolean {
    // Patrón más permisivo para piel humana con circulación
    const skinTone = red >= green; // Más permisivo
    const moderateIntensity = red >= 65 && red <= 180; // Más amplio
    const greenBalance = green >= 25 && green <= 120; // Más amplio
    const blueBalance = blue >= 15 && blue <= 100; // Más amplio
    
    // Verificar que no sea demasiado brillante (artificial)
    const notTooBright = !(red > 180 && green > 150 && blue > 130);
    
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
