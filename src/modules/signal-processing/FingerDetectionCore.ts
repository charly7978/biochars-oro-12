
import { MetricsExtractor, ExtractedMetrics } from './MetricsExtractor';
import { PulsationDetector } from './PulsationDetector';
import { FingerValidator } from './FingerValidator';
import { QualityCalculator } from './QualityCalculator';

/**
 * NÚCLEO DE DETECCIÓN DE DEDOS REAL - REFACTORIZADO
 * Sistema simplificado para detectar dedos humanos reales
 */

export interface FingerDetectionResult {
  detected: boolean;
  confidence: number;
  quality: number;
  reasons: string[];
  metrics: {
    redIntensity: number;
    greenIntensity: number;
    blueIntensity: number;
    redToGreenRatio: number;
    textureScore: number;
    stability: number;
    hemoglobinScore: number;
    pulsationStrength: number;
    perfusionIndex: number;
    skinConsistency: number;
  };
  roi: { x: number; y: number; width: number; height: number }; 
}

export class FingerDetectionCore {
  private frameCount = 0;
  private metricsExtractor: MetricsExtractor;
  private pulsationDetector: PulsationDetector;
  private fingerValidator: FingerValidator;
  private qualityCalculator: QualityCalculator;

  constructor() { 
    this.metricsExtractor = new MetricsExtractor();
    this.pulsationDetector = new PulsationDetector();
    this.fingerValidator = new FingerValidator();
    this.qualityCalculator = new QualityCalculator();
  }

  /**
   * Detección principal simplificada para dedos humanos
   */
  detectFinger(imageData: ImageData): FingerDetectionResult {
    this.frameCount++;

    // Extraer métricas básicas
    const extractedMetrics = this.metricsExtractor.extractMetrics(imageData);
    
    // Detectar pulsación
    const pulsationStrength = this.pulsationDetector.detectPulsation(extractedMetrics.redIntensity);
    
    // Validar dedo
    const validation = this.fingerValidator.validateFinger(
      extractedMetrics, 
      pulsationStrength, 
      this.frameCount
    );
    
    // Calcular calidad
    const quality = this.qualityCalculator.calculateQuality(
      extractedMetrics.redIntensity,
      pulsationStrength,
      validation.detected
    );
    
    // Debug cada 20 frames
    if (this.frameCount % 20 === 0) {
      console.log("[FingerDetectionCore REFACTORIZADO]", {
        detected: validation.detected,
        quality: quality,
        confidence: validation.confidence.toFixed(3),
        frameCount: this.frameCount,
        reasons: validation.reasons.slice(0, 2).join(', '),
        red: extractedMetrics.redIntensity.toFixed(1),
        rgRatio: extractedMetrics.redToGreenRatio.toFixed(2),
        pulsation: pulsationStrength.toFixed(3)
      });
    }
    
    return {
      detected: validation.detected,
      confidence: validation.confidence,
      quality,
      reasons: validation.reasons,
      metrics: {
        redIntensity: extractedMetrics.redIntensity,
        greenIntensity: extractedMetrics.greenIntensity,
        blueIntensity: extractedMetrics.blueIntensity,
        redToGreenRatio: extractedMetrics.redToGreenRatio,
        textureScore: extractedMetrics.textureScore,
        stability: 0.8, // Valor fijo para compatibilidad
        hemoglobinScore: extractedMetrics.redToGreenRatio > 1.0 ? 0.7 : 0.3,
        pulsationStrength,
        perfusionIndex: pulsationStrength,
        skinConsistency: extractedMetrics.textureScore
      },
      roi: extractedMetrics.roi
    };
  }
  
  reset(): void {
    this.frameCount = 0;
    this.pulsationDetector.reset();
    this.qualityCalculator.reset();
    console.log("FingerDetectionCore: Reset completo");
  }
}
