
/**
 * Validador de textura específica de piel humana
 * Detecta patrones microscópicos característicos de la piel
 */
export class SkinTextureValidator {
  private readonly SKIN_TEXTURE_PATTERNS = {
    MIN_ROUGHNESS: 0.02,
    MAX_ROUGHNESS: 0.15,
    MIN_GRADIENT_VARIATION: 0.1,
    MAX_GRADIENT_VARIATION: 0.6,
    PORE_DENSITY_RANGE: { min: 0.05, max: 0.25 }
  };
  
  /**
   * Analizar textura de piel en ROI
   */
  public validateSkinTexture(imageData: ImageData, roi: { x: number, y: number, width: number, height: number }): boolean {
    const { data, width } = imageData;
    const { x, y, width: roiWidth, height: roiHeight } = roi;
    
    // 1. Análisis de rugosidad superficial
    const roughness = this.calculateSurfaceRoughness(data, width, x, y, roiWidth, roiHeight);
    
    // 2. Análisis de gradientes direccionales
    const gradientVariation = this.calculateGradientVariation(data, width, x, y, roiWidth, roiHeight);
    
    // 3. Detección de patrones tipo poro
    const poreScore = this.detectPorePatterns(data, width, x, y, roiWidth, roiHeight);
    
    // 4. Análisis de irregularidad natural
    const irregularity = this.calculateNaturalIrregularity(data, width, x, y, roiWidth, roiHeight);
    
    const validRoughness = roughness >= this.SKIN_TEXTURE_PATTERNS.MIN_ROUGHNESS && 
                          roughness <= this.SKIN_TEXTURE_PATTERNS.MAX_ROUGHNESS;
                          
    const validGradients = gradientVariation >= this.SKIN_TEXTURE_PATTERNS.MIN_GRADIENT_VARIATION && 
                          gradientVariation <= this.SKIN_TEXTURE_PATTERNS.MAX_GRADIENT_VARIATION;
                          
    const validPores = poreScore >= this.SKIN_TEXTURE_PATTERNS.PORE_DENSITY_RANGE.min && 
                      poreScore <= this.SKIN_TEXTURE_PATTERNS.PORE_DENSITY_RANGE.max;
                      
    const validIrregularity = irregularity >= 0.1 && irregularity <= 0.4;
    
    console.log("SkinTextureValidator:", {
      roughness: roughness.toFixed(3),
      gradientVariation: gradientVariation.toFixed(3),
      poreScore: poreScore.toFixed(3),
      irregularity: irregularity.toFixed(3),
      validRoughness,
      validGradients,
      validPores,
      validIrregularity
    });
    
    // Todas las validaciones deben pasar para confirmar piel humana
    return validRoughness && validGradients && validPores && validIrregularity;
  }
  
  private calculateSurfaceRoughness(data: Uint8ClampedArray, width: number, x: number, y: number, roiWidth: number, roiHeight: number): number {
    let totalVariation = 0;
    let sampleCount = 0;
    
    // Usar kernel Laplaciano para detectar rugosidad
    const laplacianKernel = [
      [0, -1, 0],
      [-1, 4, -1],
      [0, -1, 0]
    ];
    
    for (let py = y + 1; py < y + roiHeight - 1; py += 2) {
      for (let px = x + 1; px < x + roiWidth - 1; px += 2) {
        let laplacianSum = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const index = ((py + ky) * width + (px + kx)) * 4;
            const intensity = (data[index] + data[index + 1] + data[index + 2]) / 3;
            laplacianSum += intensity * laplacianKernel[ky + 1][kx + 1];
          }
        }
        
        totalVariation += Math.abs(laplacianSum);
        sampleCount++;
      }
    }
    
    return sampleCount > 0 ? (totalVariation / sampleCount) / 255 : 0;
  }
  
  private calculateGradientVariation(data: Uint8ClampedArray, width: number, x: number, y: number, roiWidth: number, roiHeight: number): number {
    const gradients: number[] = [];
    
    // Calcular gradientes en múltiples direcciones
    for (let py = y + 1; py < y + roiHeight - 1; py += 3) {
      for (let px = x + 1; px < x + roiWidth - 1; px += 3) {
        const centerIndex = (py * width + px) * 4;
        const centerIntensity = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
        
        // Gradientes en 8 direcciones
        const directions = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],           [1, 0],
          [-1, 1],  [0, 1],  [1, 1]
        ];
        
        let maxGradient = 0;
        
        for (const [dx, dy] of directions) {
          const neighborIndex = ((py + dy) * width + (px + dx)) * 4;
          const neighborIntensity = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
          const gradient = Math.abs(centerIntensity - neighborIntensity);
          maxGradient = Math.max(maxGradient, gradient);
        }
        
        gradients.push(maxGradient);
      }
    }
    
    if (gradients.length === 0) return 0;
    
    const mean = gradients.reduce((a, b) => a + b, 0) / gradients.length;
    const variance = gradients.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / gradients.length;
    
    return Math.sqrt(variance) / 255;
  }
  
  private detectPorePatterns(data: Uint8ClampedArray, width: number, x: number, y: number, roiWidth: number, roiHeight: number): number {
    let poreCount = 0;
    let totalSamples = 0;
    
    // Buscar patrones circulares oscuros (poros)
    for (let py = y + 2; py < y + roiHeight - 2; py += 4) {
      for (let px = x + 2; px < x + roiWidth - 2; px += 4) {
        const centerIndex = (py * width + px) * 4;
        const centerIntensity = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
        
        // Verificar si el centro es más oscuro que los alrededores (característica de poro)
        let surroundingSum = 0;
        let surroundingCount = 0;
        
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (Math.sqrt(dx * dx + dy * dy) > 2) continue;
            
            const surroundingIndex = ((py + dy) * width + (px + dx)) * 4;
            const surroundingIntensity = (data[surroundingIndex] + data[surroundingIndex + 1] + data[surroundingIndex + 2]) / 3;
            surroundingSum += surroundingIntensity;
            surroundingCount++;
          }
        }
        
        if (surroundingCount > 0) {
          const avgSurrounding = surroundingSum / surroundingCount;
          if (centerIntensity < avgSurrounding * 0.85) {
            poreCount++;
          }
        }
        
        totalSamples++;
      }
    }
    
    return totalSamples > 0 ? poreCount / totalSamples : 0;
  }
  
  private calculateNaturalIrregularity(data: Uint8ClampedArray, width: number, x: number, y: number, roiWidth: number, roiHeight: number): number {
    const intensities: number[] = [];
    
    // Muestrear intensidades en grid regular
    for (let py = y; py < y + roiHeight; py += 5) {
      for (let px = x; px < x + roiWidth; px += 5) {
        const index = (py * width + px) * 4;
        const intensity = (data[index] + data[index + 1] + data[index + 2]) / 3;
        intensities.push(intensity);
      }
    }
    
    if (intensities.length < 4) return 0;
    
    // Calcular irregularidad como desviación de un patrón uniforme
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intensities.length;
    
    return Math.sqrt(variance) / mean;
  }
}
