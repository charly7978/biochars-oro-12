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
    if (total < 70) return 0; // Reducido aún más el umbral de señal total

    const redNorm = red / total;
    const greenNorm = green / total;
    const blueNorm = blue / total;

    const redReflectance = 1 - redNorm; 
    const oxygenationRatio = red / (green + blue + 1e-6);

    // Puntuaciones individuales con rangos más amplios o pesos ajustados
    // Óptimo RedReflectance ~0.3-0.4 (dedo rosado/rojo)
    const redScore = Math.max(0, 1 - Math.abs(redReflectance - 0.35) / 0.35); 
    // Óptimo GreenNorm ~0.1-0.2 (poco verde)
    const greenScore = Math.max(0, 1 - Math.abs(greenNorm - 0.15) / 0.20); 
    // Óptimo BlueNorm ~0.05-0.1 (muy poco azul)
    const blueScore  = Math.max(0, 1 - Math.abs(blueNorm  - 0.08) / 0.10);  
    // Óptimo OxygenationRatio ~1.5-3.5 (más rojo que la suma de verde y azul)
    const oxyScore   = Math.max(0, 1 - Math.abs(oxygenationRatio - 2.5) / 2.0);

    // Ponderación: Hemoglobina (rojo) y Oxigenación son claves.
    const finalScore = (redScore * 0.4) + (greenScore * 0.1) + (blueScore * 0.05) + (oxyScore * 0.45);
    return Math.max(0, Math.min(1, finalScore)); 
  }
  
  /**
   * Calcular índice de oxigenación aproximado
   */
  public calculateOxygenationIndex(red: number, green: number, blue: number): number {
    if (red + green + blue < 80) return 0; // Aumentado ligeramente para estabilidad de este cálculo
    
    const ratio = red / (blue + green + 1e-6); // Usar G+B en denominador para mejor proxy de IR
    
    // Mapeo más sensible para SpO2
    return Math.max(0, Math.min(1, (ratio - 0.8) / 1.2)); 
  }
  
  /**
   * Detectar presencia de pulsación en los valores
   */
  public detectPulsation(redHistory: number[], timespan: number): boolean {
    if (redHistory.length < 15 || timespan < 500) return false; // Necesitamos menos datos y menos tiempo
    
    const mean = redHistory.reduce((a, b) => a + b, 0) / redHistory.length;
    if (mean < 15) return false; // Intensidad media mínima muy baja
    const variance = redHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / redHistory.length;
    if (variance === 0) return false; // Sin variación no hay pulso
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    // Rango de CV mucho más amplio: 0.3% a 15%
    return cv >= 0.003 && cv <= 0.15;
  }

  public reset(): void {
    // No state to reset in this version
  }
}
