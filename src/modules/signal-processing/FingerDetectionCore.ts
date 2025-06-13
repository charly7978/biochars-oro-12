import { RealFingerDetector, FingerDetectionResult } from './RealFingerDetector';

/**
 * NÚCLEO DE DETECCIÓN SIMPLIFICADO - SIN REDUNDANCIAS
 * Usa el detector real optimizado
 */

export interface FingerDetectionCoreResult {
  detected: boolean;
  confidence: number;
  quality: number;
  reasons: string[];
  metrics: any;
  roi: { x: number; y: number; width: number; height: number };
}

export class FingerDetectionCore {
  private fingerDetector: RealFingerDetector;
  private frameCount = 0;

  constructor() {
    this.fingerDetector = new RealFingerDetector();
  }

  detectFinger(imageData: ImageData): FingerDetectionCoreResult {
    this.frameCount++;

    // Usar el detector real optimizado
    const result: FingerDetectionResult = this.fingerDetector.detectFinger(imageData);
    
    // ROI simple centrado
    const roi = {
      x: imageData.width / 2 - 80,
      y: imageData.height / 2 - 80,
      width: 160,
      height: 160
    };

    // Log cada 30 frames
    if (this.frameCount % 30 === 0) {
      console.log("FingerDetectionCore:", {
        detected: result.isFingerDetected,
        confidence: result.confidence.toFixed(3),
        quality: result.quality.toFixed(1),
        reasons: result.reasons.slice(0, 2)
      });
    }

    return {
      detected: result.isFingerDetected,
      confidence: result.confidence,
      quality: result.quality,
      reasons: result.reasons,
      metrics: {
        redIntensity: result.metrics.redIntensity,
        greenIntensity: 0, // Simplificado
        blueIntensity: 0,  // Simplificado
        redToGreenRatio: result.metrics.rgRatio,
        textureScore: result.metrics.textureScore,
        stability: result.metrics.stability,
        hemoglobinScore: result.metrics.rgRatio > 1.0 ? 0.7 : 0.3,
        pulsationStrength: 0, // Se calculará separadamente
        perfusionIndex: 0,
        skinConsistency: result.metrics.textureScore
      },
      roi
    };
  }
  
  reset(): void {
    this.frameCount = 0;
    this.fingerDetector.reset();
  }
}

/**
 * Detección avanzada de dedo usando brillo, varianza y predominancia de rojo.
 * Se ajustan umbrales para mayor sensibilidad.
 */
export function isFingerPresent(
  frame: Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  let sum = 0, sumSq = 0, redSum = 0, greenSum = 0, blueSum = 0;
  let n = 0;
  for (let i = 0; i < frame.length; i += 4) {
    const r = frame[i], g = frame[i+1], b = frame[i+2];
    const brightness = 0.299*r + 0.587*g + 0.114*b;
    sum += brightness;
    sumSq += brightness * brightness;
    redSum += r;
    greenSum += g;
    blueSum += b;
    n++;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const avgRed = redSum / n;
  const avgGreen = greenSum / n;
  const avgBlue = blueSum / n;

  // El dedo debe oscurecer el frame, reducir varianza y aumentar el rojo relativo
  const redDominance = avgRed > avgGreen + 5 && avgRed > avgBlue + 5;
  const isDark = mean < 120; // umbral más permisivo
  const isStable = variance < 400; // umbral más permisivo

  // Logging para depuración
  if (process.env.NODE_ENV === "development") {
    console.log("isFingerPresent", { mean, variance, avgRed, avgGreen, avgBlue, redDominance, isDark, isStable });
  }

  return isDark && isStable && redDominance;
}
