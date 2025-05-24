
import { ProcessedSignal, ProcessingError } from '../../types/signal';

/**
 * FASES 3-6: Procesador PPG real sin artificios - detección honesta de dedo y latidos
 */
export class RealPPGProcessor {
  private processingState = false;
  private frameCount = 0;
  private redChannelHistory: number[] = [];
  private signalHistory: number[] = [];
  private qualityHistory: number[] = [];
  private lastPeakTime = 0;
  private rrIntervals: number[] = [];
  private fingerDetectionCounter = 0;
  private noFingerCounter = 0;
  
  // FASE 3: Parámetros reales para detección de dedo
  private readonly FINGER_DETECTION_THRESHOLD = 0.12; // 12% de variación mínima
  private readonly FINGER_CONFIRMATION_FRAMES = 5;
  private readonly NO_FINGER_CONFIRMATION_FRAMES = 8;
  private readonly RED_HISTORY_SIZE = 30;
  private readonly SIGNAL_HISTORY_SIZE = 60;
  private readonly QUALITY_HISTORY_SIZE = 20;
  
  // FASE 4: Parámetros honestos para señal
  private readonly MIN_SIGNAL_AMPLITUDE = 0.08;
  private readonly MAX_SIGNAL_AMPLITUDE = 0.6;
  private readonly REAL_GAIN_FACTOR = 1.2; // Ganancia mínima real
  
  // FASE 5: Parámetros fisiológicos para picos
  private readonly MIN_RR_INTERVAL = 333; // 180 BPM máximo
  private readonly MAX_RR_INTERVAL = 1500; // 40 BPM mínimo
  private readonly PEAK_DETECTION_SENSITIVITY = 1.8; // Sensibilidad real
  
  public onSignalReady?: (signal: ProcessedSignal) => void;
  public onError?: (error: ProcessingError) => void;

  constructor() {
    console.log("RealPPGProcessor: Initializing with medical parameters", {
      fingerThreshold: this.FINGER_DETECTION_THRESHOLD,
      gainFactor: this.REAL_GAIN_FACTOR,
      peakSensitivity: this.PEAK_DETECTION_SENSITIVITY
    });
  }

  start(): void {
    this.processingState = true;
    this.frameCount = 0;
    console.log("RealPPGProcessor: Started with honest processing");
  }

  stop(): void {
    this.processingState = false;
    this.reset();
    console.log("RealPPGProcessor: Stopped");
  }

  async calibrate(): Promise<void> {
    console.log("RealPPGProcessor: Calibrating with real baselines");
    // Limpiar historiales para nueva calibración
    this.redChannelHistory = [];
    this.signalHistory = [];
    this.qualityHistory = [];
    this.fingerDetectionCounter = 0;
    this.noFingerCounter = 0;
  }

  processFrame(imageData: ImageData): void {
    if (!this.processingState) return;

    this.frameCount++;
    
    try {
      // FASE 2: Extraer datos reales del canal rojo
      const redChannelValue = this.extractRedChannelAverage(imageData);
      
      // FASE 3: Detección real de dedo
      const fingerDetected = this.detectFingerPresence(redChannelValue);
      
      if (fingerDetected) {
        // FASE 4: Procesamiento honesto de señal
        const processedSignal = this.processSignalHonestly(redChannelValue);
        const quality = this.calculateRealQuality(processedSignal);
        
        // FASE 5: Detección de picos fisiológicos
        const isPeak = this.detectPhysiologicalPeak(processedSignal.filteredValue);
        
        const signal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: redChannelValue,
          filteredValue: processedSignal.filteredValue,
          quality: quality,
          fingerDetected: true,
          roi: { x: 0, y: 0, width: imageData.width, height: imageData.height },
          perfusionIndex: processedSignal.perfusionIndex
        };

        if (this.onSignalReady) {
          this.onSignalReady(signal);
        }
      } else {
        // Sin dedo detectado - enviar señal nula
        const signal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: 0,
          filteredValue: 0,
          quality: 0,
          fingerDetected: false,
          roi: { x: 0, y: 0, width: imageData.width, height: imageData.height }
        };

        if (this.onSignalReady) {
          this.onSignalReady(signal);
        }
      }
    } catch (error) {
      if (this.onError) {
        this.onError({
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Frame processing failed',
          timestamp: Date.now()
        });
      }
    }
  }

  // FASE 2: Extracción real del canal rojo
  private extractRedChannelAverage(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let pixelCount = 0;

    // Procesar cada 4to pixel para eficiencia (RGBA = 4 bytes por pixel)
    for (let i = 0; i < data.length; i += 16) { // Saltar 4 pixels
      redSum += data[i]; // Canal rojo
      pixelCount++;
    }

    return pixelCount > 0 ? redSum / pixelCount / 255 : 0; // Normalizar 0-1
  }

  // FASE 3: Detección real de presencia de dedo
  private detectFingerPresence(redValue: number): boolean {
    this.redChannelHistory.push(redValue);
    
    if (this.redChannelHistory.length > this.RED_HISTORY_SIZE) {
      this.redChannelHistory.shift();
    }

    if (this.redChannelHistory.length < 10) {
      return false; // Insuficientes datos
    }

    // Calcular variación real del canal rojo
    const mean = this.redChannelHistory.reduce((sum, val) => sum + val, 0) / this.redChannelHistory.length;
    const variance = this.redChannelHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.redChannelHistory.length;
    const variation = Math.sqrt(variance) / mean;

    // FASE 3: Lógica de confirmación con histéresis
    if (variation > this.FINGER_DETECTION_THRESHOLD) {
      this.fingerDetectionCounter = Math.min(this.FINGER_CONFIRMATION_FRAMES + 2, this.fingerDetectionCounter + 1);
      this.noFingerCounter = Math.max(0, this.noFingerCounter - 1);
    } else {
      this.noFingerCounter = Math.min(this.NO_FINGER_CONFIRMATION_FRAMES + 2, this.noFingerCounter + 1);
      this.fingerDetectionCounter = Math.max(0, this.fingerDetectionCounter - 1);
    }

    const fingerDetected = this.fingerDetectionCounter >= this.FINGER_CONFIRMATION_FRAMES && 
                          this.noFingerCounter < this.NO_FINGER_CONFIRMATION_FRAMES;

    if (this.frameCount % 30 === 0) { // Log cada segundo
      console.log("RealPPGProcessor: Finger detection status", {
        variation: variation.toFixed(4),
        fingerCounter: this.fingerDetectionCounter,
        noFingerCounter: this.noFingerCounter,
        detected: fingerDetected,
        redValue: redValue.toFixed(3)
      });
    }

    return fingerDetected;
  }

  // FASE 4: Procesamiento honesto de señal
  private processSignalHonestly(redValue: number): { filteredValue: number; perfusionIndex: number } {
    this.signalHistory.push(redValue);
    
    if (this.signalHistory.length > this.SIGNAL_HISTORY_SIZE) {
      this.signalHistory.shift();
    }

    if (this.signalHistory.length < 10) {
      return { filteredValue: 0, perfusionIndex: 0 };
    }

    // Aplicar filtro pasa-altas simple para componente AC
    const mean = this.signalHistory.slice(-10).reduce((sum, val) => sum + val, 0) / 10;
    const acComponent = redValue - mean;
    
    // FASE 4: Ganancia real mínima
    const filteredValue = acComponent * this.REAL_GAIN_FACTOR;
    
    // Calcular índice de perfusión real
    const dcComponent = mean;
    const perfusionIndex = dcComponent > 0 ? Math.abs(acComponent) / dcComponent : 0;

    return { filteredValue, perfusionIndex };
  }

  // FASE 4: Cálculo de calidad real basado en SNR
  private calculateRealQuality(signal: { filteredValue: number; perfusionIndex: number }): number {
    this.qualityHistory.push(signal.perfusionIndex);
    
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }

    if (this.qualityHistory.length < 5) {
      return 0;
    }

    // Calcular SNR real
    const mean = this.qualityHistory.reduce((sum, val) => sum + val, 0) / this.qualityHistory.length;
    const noise = this.qualityHistory.reduce((sum, val) => sum + Math.abs(val - mean), 0) / this.qualityHistory.length;
    
    const snr = noise > 0 ? mean / noise : 0;
    
    // Mapear SNR a calidad 0-100 sin inflación
    const quality = Math.min(100, Math.max(0, snr * 50));

    return quality;
  }

  // FASE 5: Detección de picos fisiológicos
  private detectPhysiologicalPeak(filteredValue: number): boolean {
    if (this.signalHistory.length < 10) return false;

    const now = Date.now();
    const timeSinceLastPeak = now - this.lastPeakTime;

    // Verificar intervalo RR fisiológico
    if (timeSinceLastPeak < this.MIN_RR_INTERVAL) {
      return false; // Muy pronto para ser un latido real
    }

    // Detectar pico usando derivada y umbral adaptativo
    const recentValues = this.signalHistory.slice(-5);
    const currentValue = Math.abs(filteredValue);
    const avgRecent = recentValues.reduce((sum, val) => sum + Math.abs(val), 0) / recentValues.length;
    const stdDev = Math.sqrt(recentValues.reduce((sum, val) => sum + Math.pow(Math.abs(val) - avgRecent, 2), 0) / recentValues.length);
    
    const threshold = avgRecent + (stdDev * this.PEAK_DETECTION_SENSITIVITY);
    
    const isPeak = currentValue > threshold && currentValue > this.MIN_SIGNAL_AMPLITUDE;

    if (isPeak) {
      // Validar que es fisiológicamente posible
      if (timeSinceLastPeak <= this.MAX_RR_INTERVAL) {
        this.lastPeakTime = now;
        
        // Almacenar intervalo RR para análisis
        if (this.rrIntervals.length > 0) {
          this.rrIntervals.push(timeSinceLastPeak);
          if (this.rrIntervals.length > 10) {
            this.rrIntervals.shift();
          }
        } else {
          this.rrIntervals.push(timeSinceLastPeak);
        }

        console.log("RealPPGProcessor: Physiological peak detected", {
          value: currentValue.toFixed(3),
          threshold: threshold.toFixed(3),
          rrInterval: timeSinceLastPeak,
          estimatedBPM: Math.round(60000 / timeSinceLastPeak)
        });

        return true;
      }
    }

    return false;
  }

  private reset(): void {
    this.redChannelHistory = [];
    this.signalHistory = [];
    this.qualityHistory = [];
    this.rrIntervals = [];
    this.fingerDetectionCounter = 0;
    this.noFingerCounter = 0;
    this.lastPeakTime = 0;
  }

  get isProcessing(): boolean {
    return this.processingState;
  }
}
