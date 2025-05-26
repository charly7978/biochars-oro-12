/**
 * Procesador de frames con calibración precisa y lógica humana firme pero más sensible
 */
export class EnhancedFrameProcessor {
  private deviceType: 'android' | 'ios' | 'desktop';
  private exposureOptimized: boolean = false;
  private baselineRed: number | null = null;
  private frameCount: number = 0;
  private readonly CALIBRATION_FRAMES = 20; // Calibración más rápida
  
  constructor() {
    this.deviceType = this.detectDeviceType();
  }
  
  private detectDeviceType(): 'android' | 'ios' | 'desktop' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) return 'android';
    if (/ipad|iphone|ipod/.test(userAgent)) return 'ios';
    return 'desktop';
  }
  
  /**
   * Configuración de cámara optimizada por dispositivo
   */
  public getOptimalCameraConstraints(): MediaTrackConstraints {
    const baseConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    };
    
    switch (this.deviceType) {
      case 'android':
        return {
          ...baseConstraints,
          facingMode: { exact: 'environment' },
          exposureMode: 'manual',
          whiteBalanceMode: 'manual'
        };
      
      case 'ios':
        return {
          ...baseConstraints,
          facingMode: { exact: 'environment' },
          exposureMode: 'continuous',
          focusMode: 'continuous'
        };
      
      default:
        return {
          ...baseConstraints,
          exposureMode: 'manual'
        };
    }
  }
  
  /**
   * Optimización de exposición para PPG
   */
  public async optimizeExposureForPPG(videoTrack: MediaStreamTrack): Promise<boolean> {
    try {
      const capabilities = videoTrack.getCapabilities();
      
      if (capabilities.exposureTime && capabilities.exposureMode) {
        const maxExposure = capabilities.exposureTime.max || 1000;
        const targetExposure = Math.min(maxExposure * 0.7, 800);
        
        await videoTrack.applyConstraints({
          advanced: [{
            exposureMode: 'manual',
            exposureTime: targetExposure
          }]
        });
        
        this.exposureOptimized = true;
        console.log("EnhancedFrameProcessor: Exposición optimizada para PPG:", targetExposure);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn("EnhancedFrameProcessor: No se pudo optimizar exposición:", error);
      return false;
    }
  }
  
  /**
   * Detección de ROI con calibración más sensible
   */
  public detectEnhancedROI(imageData: ImageData): {
    x: number;
    y: number;
    width: number;
    height: number;
    stability: number;
  } {
    const { width, height, data } = imageData;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // ROI más amplio para mejor detección
    let roiSize: number;
    switch (this.deviceType) {
      case 'android':
        roiSize = Math.min(width, height) * 0.6; // Aumentado
        break;
      case 'ios':
        roiSize = Math.min(width, height) * 0.55; // Aumentado
        break;
      default:
        roiSize = Math.min(width, height) * 0.65; // Aumentado
    }
    
    const roiX = Math.max(0, centerX - roiSize / 2);
    const roiY = Math.max(0, centerY - roiSize / 2);
    const roiWidth = Math.min(roiSize, width - roiX);
    const roiHeight = Math.min(roiSize, height - roiY);
    
    // Calcular estabilidad con algoritmo más permisivo
    let totalIntensity = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    // Sampling más denso para mejor análisis
    for (let y = roiY; y < roiY + roiHeight; y += 2) { // Reducido de 3 a 2
      for (let x = roiX; x < roiX + roiWidth; x += 2) { // Reducido de 3 a 2
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Criterios más permisivos para píxeles válidos
        if (r > 20 && g > 10 && b > 8) { // Más permisivo
          const intensity = (r * 0.5 + g * 0.3 + b * 0.2);
          intensities.push(intensity);
          totalIntensity += intensity;
          pixelCount++;
        }
      }
    }
    
    let stability = 0.2; // Valor base más alto
    if (pixelCount > 15 && intensities.length > 15) { // Menos píxeles requeridos
      const avgIntensity = totalIntensity / pixelCount;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / pixelCount;
      const cv = Math.sqrt(variance) / avgIntensity;
      
      // Estabilidad más permisiva
      if (cv < 0.20) {
        stability = 0.9; // Muy estable
      } else if (cv < 0.35) {
        stability = 0.7; // Moderadamente estable
      } else if (cv < 0.50) {
        stability = 0.5; // Poco estable pero aceptable
      } else {
        stability = 0.2; // Inestable pero algo
      }
    }
    
    return {
      x: Math.round(roiX),
      y: Math.round(roiY),
      width: Math.round(roiWidth),
      height: Math.round(roiHeight),
      stability
    };
  }
  
  /**
   * Extracción de datos con criterios más permisivos
   */
  public extractEnhancedFrameData(imageData: ImageData) {
    this.frameCount++;
    const roi = this.detectEnhancedROI(imageData);
    const { width, height, data } = imageData;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let validPixelCount = 0;
    let textureVariance = 0;
    const intensities: number[] = [];
    const redValues: number[] = [];
    const greenValues: number[] = [];
    const blueValues: number[] = [];
    
    // Extracción con validación más permisiva
    for (let y = roi.y; y < roi.y + roi.height; y += 2) {
      for (let x = roi.x; x < roi.x + roi.width; x += 2) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Validación más permisiva para PPG
        if (r >= 25 && r <= 250 && g >= 15 && g <= 220 && b >= 10 && b <= 200) { // Más amplio
          redSum += r;
          greenSum += g;
          blueSum += b;
          
          redValues.push(r);
          greenValues.push(g);
          blueValues.push(b);
          
          const intensity = (r + g + b) / 3;
          intensities.push(intensity);
          validPixelCount++;
        }
      }
    }
    
    // Menos píxeles requeridos para considerar válido
    if (validPixelCount < 30) { // Reducido de 50
      console.log("EnhancedFrameProcessor: Pocos píxeles válidos, pero intentando detección");
      return {
        redValue: 30, // Valor que puede ser considerado
        avgRed: 30,
        avgGreen: 25,
        avgBlue: 22,
        textureScore: 0.15,
        rToGRatio: 1.2,
        rToBRatio: 1.4,
        roi,
        stability: roi.stability
      };
    }
    
    // Calcular promedios
    const avgRed = redSum / validPixelCount;
    const avgGreen = greenSum / validPixelCount;
    const avgBlue = blueSum / validPixelCount;
    
    // Calcular textura con tolerancia
    const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    textureVariance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / intensities.length;
    const textureScore = Math.min(1.0, Math.sqrt(textureVariance) / 160); // Más permisivo
    
    // Usar valores robustos
    redValues.sort((a, b) => a - b);
    greenValues.sort((a, b) => a - b);
    blueValues.sort((a, b) => a - b);
    
    const medianRed = redValues[Math.floor(redValues.length / 2)];
    const p75Red = redValues[Math.floor(redValues.length * 0.75)];
    const p25Red = redValues[Math.floor(redValues.length * 0.25)];
    
    const robustRedValue = (medianRed + p75Red + p25Red) / 3;
    
    // Establecer baseline durante calibración más permisivo
    if (this.frameCount <= this.CALIBRATION_FRAMES && robustRedValue >= 40 && robustRedValue <= 200) { // Más amplio
      if (this.baselineRed === null) {
        this.baselineRed = robustRedValue;
      } else {
        this.baselineRed = this.baselineRed * 0.85 + robustRedValue * 0.15; // Más adaptativo
      }
    }
    
    const finalRedValue = Math.max(avgRed, robustRedValue);
    
    // Calcular ratios con mayor tolerancia
    const rToGRatio = avgGreen > 10 ? finalRedValue / avgGreen : 1.0; // Más permisivo
    const rToBRatio = avgBlue > 8 ? finalRedValue / avgBlue : 1.2; // Más permisivo
    
    console.log("EnhancedFrameProcessor: Datos extraídos con mayor sensibilidad", {
      finalRedValue: finalRedValue.toFixed(1),
      avgRed: avgRed.toFixed(1),
      avgGreen: avgGreen.toFixed(1),
      avgBlue: avgBlue.toFixed(1),
      textureScore: textureScore.toFixed(3),
      rToGRatio: rToGRatio.toFixed(2),
      rToBRatio: rToBRatio.toFixed(2),
      stability: roi.stability.toFixed(2),
      validPixelCount,
      frameCount: this.frameCount,
      baselineRed: this.baselineRed?.toFixed(1) || 'null'
    });
    
    return {
      redValue: finalRedValue,
      avgRed,
      avgGreen,
      avgBlue,
      textureScore,
      rToGRatio,
      rToBRatio,
      roi,
      stability: roi.stability
    };
  }
  
  /**
   * Reset para nueva sesión de medición
   */
  public reset(): void {
    this.baselineRed = null;
    this.frameCount = 0;
    this.exposureOptimized = false;
  }
}
