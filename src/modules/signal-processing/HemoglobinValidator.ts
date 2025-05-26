
/**
 * Validador de firma espectral de hemoglobina real
 * Detecta específicamente las características ópticas de la sangre oxigenada
 */
export class HemoglobinValidator {
  private readonly HEMOGLOBIN_ABSORPTION_PEAKS = {
    // Picos de absorción de hemoglobina en RGB aproximados
    RED_ABSORPTION: { min: 0.3, max: 0.7 }, // Absorción moderada en rojo
    GREEN_ABSORPTION: { min: 0.6, max: 0.9 }, // Alta absorción en verde
    BLUE_ABSORPTION: { min: 0.4, max: 0.8 }   // Absorción moderada en azul
  };
  
  /**
   * Validar firma espectral de hemoglobina
   */
  public validateHemoglobinSignature(red: number, green: number, blue: number): boolean {
    // Normalizar valores a rango 0-1
    const total = red + green + blue;
    if (total < 150) return false; // Señal demasiado débil
    
    const redNorm = red / total;
    const greenNorm = green / total;
    const blueNorm = blue / total;
    
    // La hemoglobina oxigenada tiene características específicas:
    // 1. Menor absorción en rojo (más reflectancia)
    const redReflectance = 1 - redNorm;
    
    // 2. Mayor absorción en verde (menos reflectancia)
    const greenAbsorption = greenNorm;
    
    // 3. Absorción moderada en azul
    const blueAbsorption = blueNorm;
    
    // Verificar patrones de absorción característicos
    const validRedPattern = redReflectance >= 0.35 && redReflectance <= 0.65;
    const validGreenPattern = greenAbsorption >= 0.25 && greenAbsorption <= 0.45;
    const validBluePattern = blueAbsorption >= 0.15 && blueAbsorption <= 0.35;
    
    // Verificar ratio característico de hemoglobina oxigenada
    const oxygenationRatio = red / (green + blue);
    const validOxygenation = oxygenationRatio >= 0.8 && oxygenationRatio <= 1.8;
    
    return validRedPattern && validGreenPattern && validBluePattern && validOxygenation;
  }
  
  /**
   * Calcular índice de oxigenación aproximado
   */
  public calculateOxygenationIndex(red: number, green: number, blue: number): number {
    if (red + green + blue < 100) return 0;
    
    // Basado en la diferencia de absorción entre rojo e infrarrojo (aproximado con azul)
    const ratio = red / (blue + 1);
    
    // Normalizar a 0-1 basado en rangos típicos de SpO2
    return Math.max(0, Math.min(1, (ratio - 0.5) / 1.5));
  }
  
  /**
   * Detectar presencia de pulsación en los valores
   */
  public detectPulsation(redHistory: number[], timespan: number): boolean {
    if (redHistory.length < 20 || timespan < 1000) return false;
    
    // Calcular variabilidad esperada para señal de pulso
    const mean = redHistory.reduce((a, b) => a + b, 0) / redHistory.length;
    const variance = redHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / redHistory.length;
    const cv = Math.sqrt(variance) / mean;
    
    // La señal de pulso debe tener variabilidad característica (1-8%)
    return cv >= 0.01 && cv <= 0.08;
  }
}
