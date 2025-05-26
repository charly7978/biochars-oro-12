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
  public validateHemoglobinSignature(red: number, green: number, blue: number): number {
    const total = red + green + blue;
    if (total < 80) return 0;

    const redNorm = red / total;
    const greenNorm = green / total;
    const blueNorm = blue / total;

    // Rangos óptimos (pero ahora ponderaremos gradualmente)
    const redReflectance = 1 - redNorm; // 0 = todo rojo, 1 = nada rojo
    const oxygenationRatio = red / (green + blue + 1e-6);

    // Calculamos puntuaciones individuales de 0-1
    const redScore = 1 - Math.min(1, Math.abs(redReflectance - 0.3) / 0.3); // óptimo en 0.3
    const greenScore = 1 - Math.min(1, Math.abs(greenNorm - 0.15) / 0.15);     // óptimo en 0.15
    const blueScore  = 1 - Math.min(1, Math.abs(blueNorm  - 0.05) / 0.05);     // óptimo en 0.05
    const oxyScore   = 1 - Math.min(1, Math.abs(oxygenationRatio - 2.5) / 2.5); // óptimo alrededor de 2-3

    // Ponderamos más el redScore y oxyScore
    const finalScore = (redScore * 0.35) + (greenScore * 0.15) + (blueScore * 0.1) + (oxyScore * 0.4);
    return Math.max(0, Math.min(1, finalScore));
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
    if (redHistory.length < 20 || timespan < 800) return false;
    
    // Calcular variabilidad esperada para señal de pulso
    const mean = redHistory.reduce((a, b) => a + b, 0) / redHistory.length;
    if (mean < 20) return false; // Intensidad demasiado baja
    const variance = redHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / redHistory.length;
    const cv = Math.sqrt(variance) / mean;
    
    // La señal de pulso suele tener variabilidad 0.5-12%
    return cv >= 0.005 && cv <= 0.12;
  }

  public reset(): void {
    // No state to reset in this version
  }
}
