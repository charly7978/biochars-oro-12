
/**
 * Detector mejorado de fuentes artificiales
 * Detecta LED, superficies metálicas, objetos uniformes y patrones no biológicos
 */
export class EnhancedArtificialDetector {
  private readonly LED_PATTERNS = {
    MIN_INTENSITY_SPIKE: 180,
    MAX_COLOR_VARIATION: 30,
    MIN_UNIFORMITY: 0.85,
    TEMPORAL_STABILITY_THRESHOLD: 0.95
  };
  
  private readonly METALLIC_PATTERNS = {
    MIN_REFLECTANCE: 150,
    MAX_TEXTURE_VARIATION: 0.05,
    MIN_SPECULAR_RATIO: 0.8
  };
  
  private intensityHistory: number[] = [];
  private readonly HISTORY_SIZE = 15;
  
  /**
   * Detectar si la fuente es artificial
   */
  public isArtificialSource(frameData: {
    redValue: number;
    avgGreen: number;
    avgBlue: number;
    textureScore: number;
    stability: number;
    uniformity: number;
  }): { isArtificial: boolean; reasons: string[] } {
    
    const { redValue, avgGreen, avgBlue, textureScore, stability, uniformity } = frameData;
    const reasons: string[] = [];
    
    // 1. Detectar LED o luz directa
    const isLED = this.detectLEDPattern(redValue, avgGreen, avgBlue, stability);
    if (isLED.detected) {
      reasons.push(...isLED.reasons);
    }
    
    // 2. Detectar superficie metálica o reflectiva
    const isMetal = this.detectMetallicSurface(redValue, avgGreen, avgBlue, textureScore);
    if (isMetal.detected) {
      reasons.push(...isMetal.reasons);
    }
    
    // 3. Detectar objeto uniforme (no biológico)
    const isUniform = this.detectUniformObject(redValue, avgGreen, avgBlue, uniformity);
    if (isUniform.detected) {
      reasons.push(...isUniform.reasons);
    }
    
    // 4. Detectar variabilidad temporal no natural
    const isUnnatural = this.detectUnnaturalTemporalPattern(redValue);
    if (isUnnatural.detected) {
      reasons.push(...isUnnatural.reasons);
    }
    
    // 5. Detectar saturación extrema
    const isSaturated = this.detectSaturation(redValue, avgGreen, avgBlue);
    if (isSaturated.detected) {
      reasons.push(...isSaturated.reasons);
    }
    
    const isArtificial = reasons.length > 0;
    
    console.log("EnhancedArtificialDetector:", {
      isArtificial,
      reasons,
      redValue,
      avgGreen,
      avgBlue,
      textureScore,
      stability,
      uniformity
    });
    
    return { isArtificial, reasons };
  }
  
  private detectLEDPattern(red: number, green: number, blue: number, stability: number): { detected: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // LEDs tienden a ser muy brillantes
    if (red > this.LED_PATTERNS.MIN_INTENSITY_SPIKE || 
        green > this.LED_PATTERNS.MIN_INTENSITY_SPIKE || 
        blue > this.LED_PATTERNS.MIN_INTENSITY_SPIKE) {
      reasons.push("Intensidad excesiva característica de LED");
    }
    
    // LEDs tienen poca variación de color
    const colorRange = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (colorRange < this.LED_PATTERNS.MAX_COLOR_VARIATION) {
      reasons.push("Variación de color mínima (LED/luz artificial)");
    }
    
    // LEDs son temporalmente muy estables
    if (stability > this.LED_PATTERNS.TEMPORAL_STABILITY_THRESHOLD) {
      reasons.push("Estabilidad temporal excesiva (luz artificial)");
    }
    
    // Patrón RGB balanceado típico de luz blanca
    const avg = (red + green + blue) / 3;
    const redDev = Math.abs(red - avg) / avg;
    const greenDev = Math.abs(green - avg) / avg;
    const blueDev = Math.abs(blue - avg) / avg;
    
    if (redDev < 0.1 && greenDev < 0.1 && blueDev < 0.1 && avg > 120) {
      reasons.push("Patrón RGB balanceado (luz blanca artificial)");
    }
    
    return { detected: reasons.length > 0, reasons };
  }
  
  private detectMetallicSurface(red: number, green: number, blue: number, textureScore: number): { detected: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Superficies metálicas tienen alta reflectancia
    const avgIntensity = (red + green + blue) / 3;
    if (avgIntensity > this.METALLIC_PATTERNS.MIN_REFLECTANCE) {
      
      // Poca textura (superficies lisas)
      if (textureScore < this.METALLIC_PATTERNS.MAX_TEXTURE_VARIATION) {
        reasons.push("Alta reflectancia con textura mínima (superficie metálica)");
      }
      
      // Reflexión especular (colores balanceados)
      const colorBalance = Math.min(red, green, blue) / Math.max(red, green, blue);
      if (colorBalance > this.METALLIC_PATTERNS.MIN_SPECULAR_RATIO) {
        reasons.push("Reflexión especular característica de metal");
      }
    }
    
    return { detected: reasons.length > 0, reasons };
  }
  
  private detectUniformObject(red: number, green: number, blue: number, uniformity: number): { detected: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Objetos artificiales tienden a ser uniformes
    if (uniformity > 0.9) {
      reasons.push("Uniformidad excesiva (objeto artificial)");
    }
    
    // Colores no biológicos
    const isNonBiological = this.isNonBiologicalColor(red, green, blue);
    if (isNonBiological) {
      reasons.push("Color no característico de tejido biológico");
    }
    
    return { detected: reasons.length > 0, reasons };
  }
  
  private detectUnnaturalTemporalPattern(redValue: number): { detected: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    this.intensityHistory.push(redValue);
    if (this.intensityHistory.length > this.HISTORY_SIZE) {
      this.intensityHistory.shift();
    }
    
    if (this.intensityHistory.length >= 10) {
      // Detectar estabilidad no natural (demasiado estable)
      const variance = this.calculateVariance(this.intensityHistory);
      const mean = this.intensityHistory.reduce((a, b) => a + b, 0) / this.intensityHistory.length;
      const cv = Math.sqrt(variance) / mean;
      
      if (cv < 0.005) { // Menos del 0.5% de variación
        reasons.push("Estabilidad temporal no natural (señal artificial)");
      }
      
      // Detectar cambios abruptos repetitivos
      const changes = [];
      for (let i = 1; i < this.intensityHistory.length; i++) {
        changes.push(Math.abs(this.intensityHistory[i] - this.intensityHistory[i-1]));
      }
      
      const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
      const largeChanges = changes.filter(c => c > avgChange * 3).length;
      
      if (largeChanges > changes.length * 0.3) {
        reasons.push("Patrón de cambios abruptos no biológico");
      }
    }
    
    return { detected: reasons.length > 0, reasons };
  }
  
  private detectSaturation(red: number, green: number, blue: number): { detected: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Detectar saturación de canales
    if (red >= 250 || green >= 250 || blue >= 250) {
      reasons.push("Saturación de sensor (señal artificial)");
    }
    
    // Detectar valores demasiado bajos (ruido)
    if (red + green + blue < 60) {
      reasons.push("Señal demasiado débil (ruido de fondo)");
    }
    
    return { detected: reasons.length > 0, reasons };
  }
  
  private isNonBiologicalColor(red: number, green: number, blue: number): boolean {
    // Verificar si los colores están fuera del rango típico de piel humana
    const skinColorRanges = {
      red: { min: 60, max: 180 },
      green: { min: 40, max: 140 },
      blue: { min: 30, max: 120 }
    };
    
    return red < skinColorRanges.red.min || red > skinColorRanges.red.max ||
           green < skinColorRanges.green.min || green > skinColorRanges.green.max ||
           blue < skinColorRanges.blue.min || blue > skinColorRanges.blue.max;
  }
  
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * Reset del detector
   */
  public reset(): void {
    this.intensityHistory = [];
  }
}
