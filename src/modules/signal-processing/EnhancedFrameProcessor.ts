
/**
 * Procesador de frames con calibración precisa y lógica humana firme
 */
export class EnhancedFrameProcessor {
  private deviceType: 'android' | 'ios' | 'desktop';
  private exposureOptimized: boolean = false;
  private baselineRed: number | null = null;
  private frameCount: number = 0;
  private readonly CALIBRATION_FRAMES = 30; // Calibración más rápida pero firme
  
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
   * Detección de ROI con calibración precisa
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
    
    // ROI optimizado para detección precisa
    let roiSize: number;
    switch (this.deviceType) {
      case 'android':
        roiSize = Math.min(width, height) * 0.5; // Tamaño moderado para precisión
        break;
      case 'ios':
        roiSize = Math.min(width, height) * 0.45;
        break;
      default:
        roiSize = Math.min(width, height) * 0.55;
    }
    
    const roiX = Math.max(0, centerX - roiSize / 2);
    const roiY = Math.max(0, centerY - roiSize / 2);
    const roiWidth = Math.min(roiSize, width - roiX);
    const roiHeight = Math.min(roiSize, height - roiY);
    
    // Calcular estabilidad con algoritmo preciso
    let totalIntensity = 0;
    let pixelCount = 0;
    const intensities: number[] = [];
    
    // Sampling preciso para mejor análisis
    for (let y = roiY; y < roiY + roiHeight; y += 3) {
      for (let x = roiX; x < roiX + roiWidth; x += 3) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Solo considerar píxeles con valores razonables
        if (r > 30 && g > 15 && b > 10) {
          const intensity = (r * 0.5 + g * 0.3 + b * 0.2); // Peso hacia rojo
          intensities.push(intensity);
          totalIntensity += intensity;
          pixelCount++;
        }
      }
    }
    
    let stability = 0.1; // Valor base bajo
    if (pixelCount > 20 && intensities.length > 20) {
      const avgIntensity = totalIntensity / pixelCount;
      const variance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / pixelCount;
      const cv = Math.sqrt(variance) / avgIntensity; // Coeficiente de variación
      
      // Estabilidad basada en coeficiente de variación
      if (cv < 0.15) {
        stability = 0.9; // Muy estable
      } else if (cv < 0.25) {
        stability = 0.7; // Moderadamente estable
      } else if (cv < 0.35) {
        stability = 0.4; // Poco estable
      } else {
        stability = 0.1; // Muy inestable
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
   * Extracción de datos con calibración precisa y lógica humana
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
    
    // Extracción precisa con validación de píxeles
    for (let y = roi.y; y < roi.y + roi.height; y += 2) {
      for (let x = roi.x; x < roi.x + roi.width; x += 2) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Validar que el píxel tenga valores razonables para PPG
        if (r >= 40 && r <= 240 && g >= 20 && g <= 200 && b >= 15 && b <= 180) {
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
    
    // Si no hay suficientes píxeles válidos, retornar valores que indiquen "sin dedo"
    if (validPixelCount < 50) {
      console.log("EnhancedFrameProcessor: Insuficientes píxeles válidos para detección");
      return {
        redValue: 25, // Valor bajo que será rechazado
        avgRed: 25,
        avgGreen: 20,
        avgBlue: 18,
        textureScore: 0.1,
        rToGRatio: 1.0,
        rToBRatio: 1.0,
        roi,
        stability: roi.stability
      };
    }
    
    // Calcular promedios
    const avgRed = redSum / validPixelCount;
    const avgGreen = greenSum / validPixelCount;
    const avgBlue = blueSum / validPixelCount;
    
    // Calcular textura precisa
    const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    textureVariance = intensities.reduce((acc, val) => acc + Math.pow(val - avgIntensity, 2), 0) / intensities.length;
    const textureScore = Math.min(1.0, Math.sqrt(textureVariance) / 180);
    
    // Usar valores robustos (mediana y percentiles)
    redValues.sort((a, b) => a - b);
    greenValues.sort((a, b) => a - b);
    blueValues.sort((a, b) => a - b);
    
    const medianRed = redValues[Math.floor(redValues.length / 2)];
    const p75Red = redValues[Math.floor(redValues.length * 0.75)];
    const p25Red = redValues[Math.floor(redValues.length * 0.25)];
    
    // Valor rojo robusto que evita outliers
    const robustRedValue = (medianRed + p75Red + p25Red) / 3;
    
    // Establecer baseline durante calibración
    if (this.frameCount <= this.CALIBRATION_FRAMES && robustRedValue >= 60 && robustRedValue <= 180) {
      if (this.baselineRed === null) {
        this.baselineRed = robustRedValue;
      } else {
        this.baselineRed = this.baselineRed * 0.9 + robustRedValue * 0.1;
      }
    }
    
    // Usar el valor más confiable
    const finalRedValue = Math.max(avgRed, robustRedValue);
    
    // Calcular ratios con validación
    const rToGRatio = avgGreen > 15 ? finalRedValue / avgGreen : 0.8;
    const rToBRatio = avgBlue > 12 ? finalRedValue / avgBlue : 0.8;
    
    console.log("EnhancedFrameProcessor: Datos extraídos con calibración precisa", {
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
