
import { DETECTOR_CONFIG } from './DetectorConfig';

/**
 * Validator for biological characteristics of human finger
 */
export class BiologicalValidator {
  /**
   * Verify biological perfusion pattern specific to human skin
   */
  public hasBiologicalPerfusion(red: number, green: number, blue: number): boolean {
    // Validación más estricta para piel humana real
    const skinTone = red > green && red > blue; // Debe ser claramente rojizo
    const moderateIntensity = red >= 80 && red <= 160; // Rango más estricto
    const greenBalance = green >= 30 && green <= 100; // Más equilibrado
    const blueBalance = blue >= 20 && blue <= 85; // Más equilibrado
    
    // Verificar que no sea demasiado brillante (artificial) o demasiado oscuro (ruido)
    const properBrightness = !(red > 160 && green > 120 && blue > 100) && 
                           !(red < 50 && green < 25 && blue < 15);
    
    // Ratio red/green debe ser fisiológico
    const properRGRatio = green > 0 ? (red / green >= 1.1 && red / green <= 2.2) : false;
    
    return skinTone && moderateIntensity && greenBalance && blueBalance && 
           properBrightness && properRGRatio;
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
  
  /**
   * Comprehensive validation for actual finger presence
   */
  public validateFingerPresence(red: number, green: number, blue: number, 
                               textureScore: number, stability: number): boolean {
    // Debe pasar TODAS las validaciones para confirmar dedo real
    const validPerfusion = this.hasBiologicalPerfusion(red, green, blue);
    const validRange = this.isInBiologicalRedRange(red);
    const validRatio = green > 0 ? this.hasValidHemoglobinRatio(red / green) : false;
    const validTexture = this.hasBiologicalTexture(textureScore);
    const validStability = this.hasBiologicalStability(stability);
    
    return validPerfusion && validRange && validRatio && validTexture && validStability;
  }
}
