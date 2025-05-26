/**
 * Procesador de frames optimizado para detectar específicamente dedos humanos
 */
export class EnhancedFrameProcessor {
  private deviceType: 'android' | 'ios' | 'desktop';
  private exposureOptimized: boolean = false;
  private baselineRed: number | null = null;
  private frameCount: number = 0;
  private readonly CALIBRATION_FRAMES = 15;
  
  constructor() {
    this.deviceType = this.detectDeviceType();
  }
  
  private detectDeviceType(): 'android' | 'ios' | 'desktop' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) return 'android';
    if (/ipad|iphone|ipod/.test(userAgent)) return 'android';
    return 'desktop';
  }
  
  /**
   * Configuración de cámara optimizada para detección de dedo
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
   * Detección de ROI específica para dedo humano
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
    
    // ROI conservador para enfocarse en el centro donde debe estar el dedo
    let roiSize: number;
    switch (this.deviceType) {
      case 'android':
        roiSize = Math.min(width, height) * 0.45; // Más conservador
        break;
      case 'ios':
        roiSize = Math.min(width, height) * 0.40; // Más conservador
        break;
      default:
        roiSize = Math.min(width, height) * 0.50; // Más conservador
    }
    
    const roiX = Math.max(0, centerX - roiSize / 2);
    const roiY = Math.max(0, centerY - roiSize / 2);
    const roiWidth = Math.min(roiSize, width - roiX);
    const roiHeight = Math.min(roiSize, height - roiY);
    
    // Calcular estabilidad con criterios biológicos
    let totalIntensity = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    // Sampling específico para detectar características del dedo
    for (let y = roiY; y < roiY + roiHeight; y += 3) {
      for (let x = roiX; x < roiX + roiWidth; x += 3) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Criterios específicos para píxeles de dedo humano
        if (this.isFingerPixel(r, g, b)) {
          const intensity = (r * 0.6 + g * 0.3 + b * 0.1); // Peso hacia rojo
          intensities.push(intensity);
          totalIntensity += intensity;
          pixelCount++;
        }
      }
    }
    
    let stability = 0.1; // Base muy baja
    if (pixelCount > 25 && intensities.length > 25) {
      const avgIntensity = totalIntensity / pixelCount;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / pixelCount;
      const cv = Math.sqrt(variance) / avgIntensity;
      
      // Estabilidad específica para tejido biológico
      if (cv < 0.12) {
        stability = 0.95; // Muy estable biológicamente
      } else if (cv < 0.18) {
        stability = 0.8; // Moderadamente estable
      } else if (cv < 0.25) {
        stability = 0.6; // Poco estable pero aceptable
      } else if (cv < 0.35) {
        stability = 0.3; // Inestable
      } else {
        stability = 0.1; // No es dedo
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
   * Determinar si un píxel pertenece a un dedo humano
   */
  private isFingerPixel(r: number, g: number, b: number): boolean {
    // Rangos específicos para piel humana con hemoglobina
    const redRange = r >= 70 && r <= 180;
    const greenRange = g >= 25 && g <= 140;
    const blueRange = b >= 15 && b <= 120;
    
    // Ratios típicos de hemoglobina
    const rToGRatio = g > 0 ? r / g : 0;
    const validRatio = rToGRatio >= 1.1 && rToGRatio <= 2.2;
    
    // No debe ser demasiado brillante (luz directa)
    const notToobrright = r < 200 && g < 180 && b < 160;
    
    return redRange && greenRange && blueRange && validRatio && notToobrright;
  }
  
  /**
   * Extracción de datos específica para dedo humano
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
    
    // Extracción con validación específica para dedo
    for (let y = roi.y; y < roi.y + roi.height; y += 2) {
      for (let x = roi.x; x < roi.x + roi.width; x += 2) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Solo procesar píxeles que parezcan dedo humano
        if (this.isFingerPixel(r, g, b)) {
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
    
    // Requerir mínimo de píxeles válidos para considerar que hay dedo
    if (validPixelCount < 40) {
      console.log("EnhancedFrameProcessor: Insuficientes píxeles de dedo detectados");
      return {
        redValue: 20, // Valor que será rechazado
        avgRed: 20,
        avgGreen: 15,
        avgBlue: 12,
        textureScore: 0.05,
        rToGRatio: 0.8,
        rToBRatio: 1.0,
        roi,
        stability: roi.stability
      };
    }
    
    // Calcular promedios
    const avgRed = redSum / validPixelCount;
    const avgGreen = greenSum / validPixelCount;
    const avgBlue = blueSum / validPixelCount;
    
    // Calcular textura biológica
    const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    textureVariance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / intensities.length;
    const textureScore = Math.min(1.0, Math.sqrt(textureVariance) / 140);
    
    // Usar percentiles para valores robustos (característico de tejido)
    redValues.sort((a, b) => a - b);
    const medianRed = redValues[Math.floor(redValues.length / 2)];
    const p75Red = redValues[Math.floor(redValues.length * 0.75)];
    const p25Red = redValues[Math.floor(redValues.length * 0.25)];
    
    const robustRedValue = (medianRed + p75Red + p25Red) / 3;
    
    // Establecer baseline más conservador
    if (this.frameCount <= this.CALIBRATION_FRAMES && robustRedValue >= 80 && robustRedValue <= 160) {
      if (this.baselineRed === null) {
        this.baselineRed = robustRedValue;
      } else {
        this.baselineRed = this.baselineRed * 0.9 + robustRedValue * 0.1;
      }
    }
    
    const finalRedValue = Math.max(avgRed, robustRedValue);
    
    // Calcular ratios biológicos
    const rToGRatio = avgGreen > 15 ? finalRedValue / avgGreen : 1.0;
    const rToBRatio = avgBlue > 10 ? finalRedValue / avgBlue : 1.2;
    
    console.log("EnhancedFrameProcessor: Datos específicos para dedo", {
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
