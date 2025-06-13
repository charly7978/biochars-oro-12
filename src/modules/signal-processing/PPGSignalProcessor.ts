import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { RealFingerDetector, FingerDetectionResult } from './RealFingerDetector';
import { QualityCalculator } from './QualityCalculator';

/**
 * PROCESADOR PPG SIMPLE - SIN SIMULACIONES
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  
  // Componentes simplificados
  private fingerDetector: RealFingerDetector;
  private qualityCalculator: QualityCalculator;
  
  // Estado simple
  private frameCount = 0;
  private detectionHistory: boolean[] = [];
  private signalBuffer: number[] = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("PPGSignalProcessor: Inicializando procesador real");
    
    this.fingerDetector = new RealFingerDetector();
    this.qualityCalculator = new QualityCalculator();
    
    console.log("PPGSignalProcessor: Componentes reales inicializados");
  }

  async initialize(): Promise<void> {
    console.log("PPGSignalProcessor: Inicializando sistema real");
    try {
      this.frameCount = 0;
      this.detectionHistory = [];
      this.signalBuffer = [];
      
      // Reset componentes
      this.fingerDetector.reset();
      this.qualityCalculator.reset();
      
      console.log("PPGSignalProcessor: Sistema real inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error en inicialización", error);
      this.handleError("INIT_ERROR", "Error inicializando procesador");
    }
  }

  start(): void {
    console.log("PPGSignalProcessor: Iniciando medición real");
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.initialize();
    
    console.log("PPGSignalProcessor: Sistema real activo");
  }

  stop(): void {
    console.log("PPGSignalProcessor: Deteniendo medición real");
    this.isProcessing = false;
    
    // Reset completo
    this.fingerDetector.reset();
    this.qualityCalculator.reset();
    
    this.frameCount = 0;
    this.detectionHistory = [];
    this.signalBuffer = [];
    
    console.log("PPGSignalProcessor: Sistema real detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración real");
      await this.initialize();
      
      // La calibración es automática en los primeros frames
      setTimeout(() => {
        console.log("PPGSignalProcessor: Calibración real completada");
      }, 2000);
      
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error en calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error en calibración");
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing || !this.onSignalReady) return;

    try {
      this.frameCount++;
      const shouldLog = this.frameCount % 60 === 0;

      // 1. DETECCIÓN REAL DE DEDO
      const detectionResult: FingerDetectionResult = this.fingerDetector.detectFinger(imageData);
      
      // 2. EXTRACCIÓN SIMPLE DE SEÑAL PPG
      const rawSignalValue = this.extractSimplePPGSignal(imageData, detectionResult.roi);
      
      // Almacenar señal
      this.signalBuffer.push(rawSignalValue);
      if (this.signalBuffer.length > 50) {
        this.signalBuffer.shift();
      }
      
      // 3. FILTRADO SIMPLE
      const filteredValue = this.applySimpleFilter(rawSignalValue);

      // 4. CÁLCULO DE CALIDAD REAL
      const pulsationStrength = this.calculateSimplePulsation();
      const realQuality = this.qualityCalculator.calculateQuality(
        rawSignalValue,
        pulsationStrength,
        detectionResult.isFingerDetected
      );

      // 5. FILTRO TEMPORAL SIMPLE
      this.detectionHistory.push(detectionResult.isFingerDetected);
      if (this.detectionHistory.length > 3) {
        this.detectionHistory.shift();
      }
      
      const finalDetected = this.detectionHistory.length >= 2 ? 
        this.detectionHistory.slice(-2).filter(d => d).length >= 1 : 
        detectionResult.isFingerDetected;

      // 6. CREAR SEÑAL PROCESADA
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: rawSignalValue,
        filteredValue: filteredValue,
        quality: realQuality,
        fingerDetected: finalDetected,
        roi: { x: 0, y: 0, width: imageData.width, height: imageData.height },
        perfusionIndex: this.calculateSimplePerfusion()
      };

      // 7. LOGGING REAL
      if (shouldLog || finalDetected) {
        console.log("PPGSignalProcessor REAL: Estado", {
          frameCount: this.frameCount,
          fingerDetected: finalDetected,
          quality: realQuality,
          rawSignal: rawSignalValue.toFixed(1),
          confidence: detectionResult.confidence.toFixed(2),
          calibrationProgress: this.fingerDetector.getCalibrationStatus().progress
        });
      }

      // 8. ENVIAR SEÑAL
      this.onSignalReady(processedSignal);
      
    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame real", error);
      this.handleError("PROCESSING_ERROR", "Error en procesamiento real");
    }
  }

  /**
   * Extrae señal PPG simple del canal rojo
   */
  private extractSimplePPGSignal(imageData: ImageData, roi: { x: number; y: number; width: number; height: number; }): number {
    const { data, width } = imageData;
    
    // Usar la ROI detectada para la extracción de la señal
    const roiX = Math.floor(roi.x);
    const roiY = Math.floor(roi.y);
    const roiWidth = Math.floor(roi.width);
    const roiHeight = Math.floor(roi.height);

    let redSum = 0;
    let pixelCount = 0;
    
    // Iterar solo sobre la ROI y muestrear píxeles (cada 4 píxeles para eficiencia)
    for (let y = roiY; y < roiY + roiHeight; y += 4) {
      for (let x = roiX; x < roiX + roiWidth; x += 4) {
        // Asegurar que estamos dentro de los límites de la imagen
        if (x >= 0 && x < width && y >= 0 && y < imageData.height) {
          const index = (y * width + x) * 4;
          redSum += data[index]; // Solo canal rojo
          pixelCount++;
        }
      }
    }
    
    return pixelCount > 0 ? redSum / pixelCount : 0;
  }

  /**
   * Filtro simple de señal
   */
  private applySimpleFilter(currentValue: number): number {
    // Usar un filtro EMA (Exponential Moving Average) para un suavizado más dinámico y con menos retardo.
    // La constante ALPHA (0.2 en este ejemplo) determina el peso del valor actual.
    // Un ALPHA más alto hace el filtro más reactivo a los cambios; uno más bajo lo hace más suave.
    const EMA_ALPHA = 0.2; // Este valor puede ajustarse según la necesidad de suavizado vs. reactividad

    if (this.signalBuffer.length === 0) {
      // Si el buffer está vacío, inicializar con el valor actual
      return currentValue;
    }

    // El valor `filteredValue` se usa como el valor `smoothedValue` anterior en la fórmula EMA
    const previousSmoothedValue = this.signalBuffer[this.signalBuffer.length - 1];

    const smoothed = EMA_ALPHA * currentValue + (1 - EMA_ALPHA) * previousSmoothedValue;

    return smoothed;
  }

  /**
   * Calcula pulsación simple
   */
  private calculateSimplePulsation(): number {
    // Se requiere un buffer de señal suficientemente grande para detectar pulsaciones.
    if (this.signalBuffer.length < 20) return 0; // Aumentar el tamaño mínimo del buffer

    const recentSignal = this.signalBuffer.slice(); // Trabajar con una copia para evitar mutaciones

    // Implementación de una detección de picos y valles más robusta
    let peaks: number[] = [];
    let troughs: number[] = [];
    let lastPeakIndex = -1;
    let lastTroughIndex = -1;

    // Un simple algoritmo de detección de picos/valles basado en cambios de dirección
    for (let i = 1; i < recentSignal.length - 1; i++) {
      if (recentSignal[i] > recentSignal[i - 1] && recentSignal[i] > recentSignal[i + 1]) {
        // Pico
        peaks.push(recentSignal[i]);
        lastPeakIndex = i;
      } else if (recentSignal[i] < recentSignal[i - 1] && recentSignal[i] < recentSignal[i + 1]) {
        // Valle
        troughs.push(recentSignal[i]);
        lastTroughIndex = i;
      }
    }

    if (peaks.length < 1 || troughs.length < 1) return 0;

    // Calcular la amplitud promedio pico-a-valle
    let totalAmplitude = 0;
    let count = 0;

    // Emparejar picos y valles de forma simple
    for (const peakVal of peaks) {
      // Encontrar el valle más cercano después del pico
      let closestTrough = Infinity;
      for (const troughVal of troughs) {
        // Un método más avanzado consideraría la secuencia temporal
        // Aquí, simplemente buscamos el valle más bajo para la amplitud
        if (troughVal < closestTrough) {
            closestTrough = troughVal;
        }
      }
      if (closestTrough !== Infinity) {
          totalAmplitude += (peakVal - closestTrough);
          count++;
      }
    }

    if (count === 0) return 0;

    const averageAmplitude = totalAmplitude / count;
    const meanSignal = recentSignal.reduce((a, b) => a + b, 0) / recentSignal.length;

    // La fuerza de pulsación se puede definir como la amplitud AC dividida por la componente DC (promedio de la señal)
    return meanSignal > 0 ? (averageAmplitude / meanSignal) : 0;
  }

  /**
   * Calcula perfusión simple
   */
  private calculateSimplePerfusion(): number {
    if (this.signalBuffer.length < 50) return 0.0; // Se necesita un buffer más grande para un PI robusto

    const recent = this.signalBuffer.slice(-50); // Usar una ventana más grande para el cálculo

    // Calcular la componente DC (valor promedio de la señal)
    const dcComponent = recent.reduce((a, b) => a + b, 0) / recent.length;

    // Calcular la componente AC (variación de pico a valle)
    // Se podría integrar la lógica de detección de picos/valles de calculateSimplePulsation
    // Para simplificar, usaremos la diferencia máxima y mínima en esta ventana.
    const maxSignal = Math.max(...recent);
    const minSignal = Math.min(...recent);
    const acComponent = (maxSignal - minSignal) / 2; // Amplitud pico-a-valle dividida por 2 para AC

    if (dcComponent <= 0) return 0.0; // Evitar división por cero o valores no válidos

    // El índice de perfusión se calcula como (AC / DC) * 100%
    const perfusionIndex = (acComponent / dcComponent) * 100;

    // Limitar el índice de perfusión a un rango razonable (ej. 0.1% a 20%)
    return Math.max(0.1, Math.min(20.0, perfusionIndex));
  }

  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    if (typeof this.onError === 'function') {
      this.onError(error);
    }
  }
  
  public getPerformanceStats() {
    return {
      frameCount: this.frameCount,
      detectionRate: this.detectionHistory.filter(d => d).length / Math.max(1, this.detectionHistory.length),
      avgSignal: this.signalBuffer.length > 0 ? 
        this.signalBuffer.reduce((a, b) => a + b, 0) / this.signalBuffer.length : 0
    };
  }
  
  public getLastValidBPM(): number | null {
    return null;
  }
}
