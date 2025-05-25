/**
 * Procesador de frames mejorado con optimizaciones específicas por dispositivo
 */
export class EnhancedFrameProcessor {
  private deviceType: 'android' | 'ios' | 'desktop';
  private exposureOptimized: boolean = false;
  
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
   * Detección mejorada de ROI con compensación de movimiento
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
    
    // ROI adaptativo según dispositivo
    let roiSize: number;
    switch (this.deviceType) {
      case 'android':
        roiSize = Math.min(width, height) * 0.4;
        break;
      case 'ios':
        roiSize = Math.min(width, height) * 0.35;
        break;
      default:
        roiSize = Math.min(width, height) * 0.5;
    }
    
    const roiX = Math.max(0, centerX - roiSize / 2);
    const roiY = Math.max(0, centerY - roiSize / 2);
    const roiWidth = Math.min(roiSize, width - roiX);
    const roiHeight = Math.min(roiSize, height - roiY);
    
    // Calcular estabilidad basada en variación de intensidad
    let totalIntensity = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    for (let y = roiY; y < roiY + roiHeight; y += 4) {
      for (let x = roiX; x < roiX + roiWidth; x += 4) {
        const index = (y * width + x) * 4;
        const intensity = (data[index] + data[index + 1] + data[index + 2]) / 3;
        intensities.push(intensity);
        totalIntensity += intensity;
        pixelCount++;
      }
    }
    
    const avgIntensity = totalIntensity / pixelCount;
    const variance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / pixelCount;
    const stability = Math.max(0, 1 - variance / 10000); // Normalizar estabilidad
    
    return {
      x: Math.round(roiX),
      y: Math.round(roiY),
      width: Math.round(roiWidth),
      height: Math.round(roiHeight),
      stability
    };
  }
  
  /**
   * Extracción mejorada de datos del frame
   */
  public extractEnhancedFrameData(imageData: ImageData) {
    const roi = this.detectEnhancedROI(imageData);
    const { width, height, data } = imageData;
    
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0;
    let textureVariance = 0;
    const intensities: number[] = [];
    
    // Extracción optimizada por dispositivo
    const step = this.deviceType === 'desktop' ? 2 : 3; // Menor sampling en móviles
    
    for (let y = roi.y; y < roi.y + roi.height; y += step) {
      for (let x = roi.x; x < roi.x + roi.width; x += step) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        redSum += r;
        greenSum += g;
        blueSum += b;
        
        const intensity = (r + g + b) / 3;
        intensities.push(intensity);
        pixelCount++;
      }
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calcular textura mejorada
    const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    textureVariance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / intensities.length;
    
    return {
      redValue: avgRed,
      avgRed,
      avgGreen,
      avgBlue,
      textureScore: Math.sqrt(textureVariance) / 255,
      rToGRatio: avgGreen > 0 ? avgRed / avgGreen : 0,
      rToBRatio: avgBlue > 0 ? avgRed / avgBlue : 0,
      roi,
      stability: roi.stability
    };
  }
}
