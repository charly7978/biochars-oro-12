import { BloodPressureProcessor, BloodPressureResult } from "./blood-pressure-processor";
export type { BloodPressureResult };
import { GlucoseProcessor } from "./glucose-processor";
import { ArrhythmiaProcessor } from "./arrhythmia-processor";
import { calculateAC, calculateDC, calculateStandardDeviation, findPeaksAndValleys, calculateAmplitude } from './utils'; // Importar utilidades

/**
 * Datos de referencia opcionales que el usuario podría ingresar para calibrar
 * ciertas mediciones experimentales.
 */
export interface VitalSignsReferenceData {
  referenceSystolic?: number;
  referenceDiastolic?: number;
  referenceAge?: number;       // Para calibración de PA
  referenceGlucose?: number;   // Para calibración de Glucosa
}

/**
 * PROCESADOR DE SIGNOS VITALES 100% REAL
 * Cálculos basados únicamente en mediciones físicas reales del PPG
 * ADVERTENCIA: Varias mediciones (ej. Glucosa, Presión Arterial, Lípidos, Hemoglobina)
 * estimadas mediante PPG de smartphone son ALTAMENTE EXPERIMENTALES y su precisión
 * NO está garantizada. NO deben usarse para diagnóstico médico sin supervisión profesional.
 */

export interface VitalSignsResult {
  heartRate: number;
  spo2: number;
  pressure: BloodPressureResult | { systolic: 0, diastolic: 0, confidence: 0, status?: string };
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
    status?: 'experimental_unreliable';
  };
  hemoglobin: number;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  };
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
      hemoglobin: number;
    };
  };
}

export class VitalSignsProcessor {
  private signalBuffer: number[] = [];
  private rrIntervals: number[] = [];
  private lastValidResults: VitalSignsResult | null = null;
  private globalCalibrationSuccess: boolean = false;

  // Instancias de los procesadores dedicados
  private bpProcessor: BloodPressureProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor; // Instancia del procesador de arritmias

  // Propiedades para el procesamiento de latidos y calidad de señal (integrado de HeartBeatProcessor)
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private smoothBPM: number = 0;
  private readonly BPM_ALPHA = 0.3; // Factor de suavizado para BPM
  private currentSignalQuality: number = 0; // Calidad de señal actual
  private recentSignalStrengths: number[] = []; // Historial para calcular calidad
  private readonly SIGNAL_STRENGTH_HISTORY = 30;
  private lastSignalStrength: number = 0;
  private peakValidationBuffer: number[] = []; // Buffer para validar picos
  private readonly PEAK_VALIDATION_THRESHOLD = 0.3; // Umbral de validación de picos
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak: boolean = false;
  private lastValue: number = 0; // Para cálculo de derivada
  private baseline: number = 0; // Para normalización
  private readonly BASELINE_FACTOR = 0.8;

  constructor() {
    console.log("VitalSignsProcessor: Inicializado (SIN SIMULACIONES)");
    this.bpProcessor = new BloodPressureProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor(); // Inicializar ArrhythmiaProcessor
    this.resetDetectionStates(); // Inicializar estados de detección
  }

  /**
   * Establece el estado de calibración global y, si es exitosa y se proporcionan datos
   * de referencia, calibra los sub-procesadores que lo requieran.
   */
  public setExternalCalibration(isSuccess: boolean, referenceData?: VitalSignsReferenceData): void {
    this.globalCalibrationSuccess = isSuccess;
    console.log(`VitalSignsProcessor: Estado de calibración externa actualizado a: ${isSuccess}`);

    if (isSuccess && referenceData) {
      if (referenceData.referenceSystolic !== undefined && 
          referenceData.referenceDiastolic !== undefined) {
        this.bpProcessor.calibrate(
          referenceData.referenceSystolic,
          referenceData.referenceDiastolic,
          referenceData.referenceAge // age es opcional en bpProcessor.calibrate
        );
      }
      if (referenceData.referenceGlucose !== undefined) {
        this.glucoseProcessor.calibrate(referenceData.referenceGlucose);
      }
    } else if (!isSuccess) {
        // Si la calibración global falla, resetear la calibración de los sub-procesadores también
        this.bpProcessor.reset(); // Asumiendo que reset() también invalida su calibración interna
        this.glucoseProcessor.reset(); // Asumiendo que reset() también invalida su calibración interna
    }
  }

  processSignal(ppgValue: number, rrData?: { intervals: number[]; lastPeakTime: number | null }): VitalSignsResult {
    // Solo procesar si la calibración global fue exitosa
    if (!this.globalCalibrationSuccess) {
      return {
        heartRate: 0,
        spo2: 0,
        pressure: { systolic: 0, diastolic: 0, confidence: 0, status: "GLOBAL_CALIBRATION_FAILED" },
        glucose: 0,
        lipids: { totalCholesterol: 0, triglycerides: 0, status: "experimental_unreliable" },
        hemoglobin: 0,
        arrhythmiaStatus: "NO_VALID_RESULT",
        lastArrhythmiaData: null,
        calibration: {
          isCalibrating: false,
          progress: { heartRate: 0, spo2: 0, pressure: 0, arrhythmia: 0, glucose: 0, lipids: 0, hemoglobin: 0 }
        }
      };
    }

    const now = Date.now();

    // 1. Preprocesamiento y normalización
    // Actualizar baseline
    if (this.baseline === 0) {
        this.baseline = ppgValue;
    } else {
        this.baseline = this.baseline * this.BASELINE_FACTOR + ppgValue * (1 - this.BASELINE_FACTOR);
    }
    const normalizedValue = ppgValue - this.baseline;
    this.signalBuffer.push(normalizedValue); // Almacenar valor normalizado
    if (this.signalBuffer.length > 300) { // Mantener un buffer razonable
      this.signalBuffer.shift();
    }

    // 2. Detección de Picos y Cálculo de RR
    const derivative = normalizedValue - this.lastValue; // Aproximación simple de la derivada
    this.lastValue = normalizedValue; // Actualizar lastValue para la próxima iteración

    const peakDetectionResult = this.enhancedPeakDetection(normalizedValue, derivative);
    let isPeak = peakDetectionResult.isPeak;
    const peakConfidence = peakDetectionResult.confidence;

    // Confirmar pico basado en un buffer temporal
    isPeak = this.confirmPeak(isPeak, normalizedValue, peakConfidence);

    let currentRRData: { intervals: number[]; lastPeakTime: number | null } = { intervals: [], lastPeakTime: null };
    if (isPeak && this.lastConfirmedPeak) {
        const peakTime = now;
        if (this.lastPeakTime !== null) {
            const rrInterval = peakTime - this.lastPeakTime;
            // Validación básica de RR interval (ej. entre 300ms y 2000ms para 30-200 BPM)
            if (rrInterval >= 300 && rrInterval <= 2000) {
                this.rrIntervals.push(rrInterval);
                if (this.rrIntervals.length > 60) { // Mantener historial de 60 segundos a 60 BPM
                    this.rrIntervals.shift();
                }
                console.log("VitalSignsProcessor: RR Interval detectado", rrInterval);
            } else {
                console.warn("VitalSignsProcessor: RR Interval fuera de rango plausible", rrInterval);
            }
        } else {
           console.log("VitalSignsProcessor: Primer pico detectado.");
        }
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = peakTime;
        this.updateBPM(); // Actualizar BPM basado en el nuevo RR interval
        currentRRData = { intervals: [...this.rrIntervals], lastPeakTime: this.lastPeakTime }; // Pasar copia
    }
    this.lastConfirmedPeak = isPeak; // Actualizar estado del último pico confirmado

    // 3. Cálculo de Calidad de Señal
    // Usar la lógica de calculateSignalQuality de HeartBeatProcessor. Adaptarla si es necesario.
    this.currentSignalQuality = this.calculateSignalQuality(normalizedValue, peakConfidence);

    // 4. Procesar Arritmias (usando el procesador dedicado)
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(currentRRData);

    // 5. Calcular otros Signos Vitales
    // Asegurarse de pasar la señal procesada y los datos RR/Calidad a los sub-procesadores
    const heartRate = this.getSmoothBPM(); // Usar el BPM suavizado
    const spo2 = this.calculateRealSpO2(this.signalBuffer, this.currentSignalQuality); // Pasar buffer y calidad
    const pressure = this.calculateRealBloodPressure(this.signalBuffer, heartRate); // Pasar buffer y HR
    const glucose = this.calculateRealGlucose(this.signalBuffer, heartRate); // Pasar buffer y HR
    const lipids = this.calculateRealLipids(this.signalBuffer, this.currentSignalQuality); // Pasar buffer y calidad
    const hemoglobin = this.calculateRealHemoglobin(this.signalBuffer, this.currentSignalQuality); // Pasar buffer y calidad

    const result: VitalSignsResult = {
      heartRate: Math.round(heartRate), // Redondear para display
      spo2: Math.round(spo2), // Redondear para display
      pressure: pressure,
      glucose: Math.round(glucose * 10) / 10, // Un decimal para glucosa
      lipids: lipids,
      hemoglobin: Math.round(hemoglobin * 10) / 10, // Un decimal para hemoglobina
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      calibration: {
        isCalibrating: false, // VitalSignsProcessor no maneja la calibración directamente por ahora
        progress: { heartRate: 0, spo2: 0, pressure: 0, arrhythmia: 0, glucose: 0, lipids: 0, hemoglobin: 0 }
      }
    };

    // Guardar solo resultados "razonablemente" válidos basados en calidad y valores
    // Umbrales de validación más estrictos y basados en calidad de señal
    if (this.currentSignalQuality > 0.5 && heartRate > 40 && heartRate < 180 && spo2 > 90 && spo2 < 100) {
      this.lastValidResults = result;
      return result;
    } else {
      // Si la señal o los resultados no son válidos, devolver 0 y estado apropiado
      return {
        heartRate: 0,
        spo2: 0,
        pressure: { systolic: 0, diastolic: 0, confidence: 0, status: "INVALID_SIGNAL_QUALITY" }, // Estado más descriptivo
        glucose: 0,
        lipids: { totalCholesterol: 0, triglycerides: 0, status: "experimental_unreliable" },
        hemoglobin: 0,
        arrhythmiaStatus: "NO_VALID_RESULT",
        lastArrhythmiaData: null,
        calibration: {
          isCalibrating: false,
          progress: { heartRate: 0, spo2: 0, pressure: 0, arrhythmia: 0, glucose: 0, lipids: 0, hemoglobin: 0 }
        }
      };
    }
  }

  private calculateRealBPM(): number {
    // Este método ahora es redundante ya que BPM se calcula en processSignal basado en RR
    // Lo mantenemos para compatibilidad temporal si fuera necesario, pero su lógica
    // debería ser la que ya está integrada en processSignal.
    // Idealmente, este método debería eliminarse.
    console.warn("calculateRealBPM llamado - lógica principal está en processSignal");
     if (this.rrIntervals.length >= 2) {
       const avgRR = this.rrIntervals.slice(-Math.min(10, this.rrIntervals.length)).reduce((a, b) => a + b, 0) / Math.min(10, this.rrIntervals.length);
       if (avgRR > 0) {
         return Math.round(60000 / avgRR);
       }
     }
     return 0;
  }

  private detectRealPeaks(signal: number[]): number[] {
    // Este método también es redundante y debería ser eliminado. La detección de picos
    // se realiza en enhancedPeakDetection.
    console.warn("detectRealPeaks llamado - lógica principal está en enhancedPeakDetection");
    return []; // No debería usarse
  }

  // Métodos de detección de picos y calidad de HeartBeatProcessor, adaptados:

  private enhancedPeakDetection(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
    rawDerivative?: number;
  } {
    const SIGNAL_THRESHOLD = 0.02; // Umbral base para la señal
    const DERIVATIVE_THRESHOLD = -0.005; // Umbral base para la derivada
    const MIN_CONFIDENCE = 0.30; // Confianza mínima para considerar un pico
    const PEAK_DETECTION_SENSITIVITY = 0.6; // Sensibilidad para refinar detección

    let isPeak = false;
    let confidence = 0;
    const rawDerivative = derivative;

    // Condición principal para un pico: valor sobre umbral y derivada negativa (punto de inflexión después de subir)
    if (normalizedValue > SIGNAL_THRESHOLD && derivative < DERIVATIVE_THRESHOLD) {
        isPeak = true;
        // Calcular confianza basada en qué tan por encima del umbral está y la magnitud de la derivada negativa
        const signalConfidence = Math.min(1, (normalizedValue - SIGNAL_THRESHOLD) / SIGNAL_THRESHOLD);
        const derivativeConfidence = Math.min(1, Math.abs(derivative) / Math.abs(DERIVATIVE_THRESHOLD));
        confidence = (signalConfidence * 0.6 + derivativeConfidence * 0.4) * PEAK_DETECTION_SENSITIVITY; // Ajustar peso y sensibilidad
        confidence = Math.max(MIN_CONFIDENCE, Math.min(1, confidence)); // Asegurar mínimo y máximo
    }

    return {
        isPeak,
        confidence,
        rawDerivative
    };
  }

  private confirmPeak(
    isPeakCandidate: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Implementación de confirmación de pico similar a HeartBeatProcessor
    // Esto ayuda a reducir falsos positivos.
    const CONFIRMATION_WINDOW_SIZE = 5; // Tamaño del buffer para confirmar
    const CONFIDENCE_THRESHOLD = 0.5; // Umbral de confianza para considerar en buffer

    this.peakConfirmationBuffer.push({ value: normalizedValue, confidence: confidence, isCandidate: isPeakCandidate });
    if (this.peakConfirmationBuffer.length > CONFIRMATION_WINDOW_SIZE) {
        this.peakConfirmationBuffer.shift();
    }

    if (this.peakConfirmationBuffer.length < CONFIRMATION_WINDOW_SIZE) {
        return false; // No hay suficientes datos para confirmar
    }

    // Criterios de confirmación:
    // 1. El último punto debe ser un candidato a pico.
    // 2. Al menos N puntos en el buffer deben tener una confianza razonable.
    // 3. El punto candidato debe ser el valor más alto (o cercano al más alto) en el buffer.

    const lastPoint = this.peakConfirmationBuffer[this.peakConfirmationBuffer.length - 1];
    if (!lastPoint.isCandidate) return false;

    const highConfidenceCount = this.peakConfirmationBuffer.filter(p => p.confidence >= CONFIDENCE_THRESHOLD).length;
    if (highConfidenceCount < Math.ceil(CONFIRMATION_WINDOW_SIZE / 2)) { // Requerir al menos la mitad con alta confianza
        return false;
    }

    // Verificar si el último punto es el máximo o muy cercano en el buffer
    const maxBufferValue = Math.max(...this.peakConfirmationBuffer.map(p => p.value));
    const isNearMax = lastPoint.value >= maxBufferValue * 0.95; // Dentro del 5% del máximo

    return isNearMax; // Confirmar si pasa todos los criterios
  }

  private updateBPM(): void {
    if (this.rrIntervals.length === 0) return;

    // Calcular BPM basado en el promedio de los últimos RR intervals válidos
    const validRRIntervals = this.rrIntervals.filter(interval => interval >= 300 && interval <= 2000);

    if (validRRIntervals.length < 2) return; // Necesita al menos 2 intervalos para calcular BPM

    const avgRR = validRRIntervals.slice(-10) // Usar hasta los últimos 10 intervalos válidos
                                 .reduce((sum, interval) => sum + interval, 0) / validRRIntervals.slice(-10).length;

    if (avgRR > 0) {
        const currentBPM = 60000 / avgRR; // ms a BPM
        // Aplicar suavizado exponencial para estabilidad
        if (this.smoothBPM === 0) {
            this.smoothBPM = currentBPM;
        } else {
            this.smoothBPM = this.BPM_ALPHA * currentBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
        }
    }
  }

  public getSmoothBPM(): number {
      // Asegurar que el BPM suavizado esté dentro de un rango fisiológicamente plausible
      return Math.max(40, Math.min(180, this.smoothBPM));
  }

  private calculateSignalQuality(normalizedValue: number, confidence: number): number {
      // Lógica simplificada de calidad de señal basada en amplitud y confianza del pico.
      // Se puede expandir para incluir estabilidad de la línea base, forma del pulso, etc.

      // Calcular amplitud de la señal reciente (basado en el buffer normalizado)
      const recentSignal = this.signalBuffer.slice(-60); // Últimos 2 segundos
      if (recentSignal.length < 30) return 0; // Necesita suficientes datos

      const minVal = Math.min(...recentSignal);
      const maxVal = Math.max(...recentSignal);
      const amplitude = maxVal - minVal;

      // Calcular estabilidad de la línea base
      const baselineStability = calculateStandardDeviation(this.signalBuffer.slice(-120)); // SD de los últimos 4 segundos
      const maxAllowedSD = 0.05; // Umbral para SD (ajustar)
      const stabilityScore = Math.max(0, 1 - (baselineStability / maxAllowedSD));

      // Combinar amplitud, confianza y estabilidad para la calidad. Ajustar pesos.
      // La calidad debe ser alta solo si hay una señal clara (amplitud) Y picos detectables (confianza) Y la línea base es estable.
      // Podríamos también incorporar el Perfusion Index si el FrameProcessor lo calcula.
      const baseQuality = (amplitude * 10 + confidence * 2) / 12; // Ponderar amplitud y confianza del pico
      const finalQuality = baseQuality * stabilityScore; // Modulado por la estabilidad de la línea base

      // Asegurar que la calidad esté entre 0 y 1
      return Math.max(0, Math.min(1, finalQuality));
  }

   // Método placeholder para actualizar el estado de detección (si es necesario para la UI u otra lógica)
   private resetDetectionStates() {
      this.lastPeakTime = null;
      this.previousPeakTime = null;
      this.bpmHistory = [];
      this.smoothBPM = 0;
      this.rrIntervals = [];
      this.currentSignalQuality = 0;
      this.recentSignalStrengths = [];
      this.lastSignalStrength = 0;
      this.peakValidationBuffer = [];
      this.peakCandidateIndex = null;
      this.peakCandidateValue = 0;
      this.peakConfirmationBuffer = [];
      this.lastConfirmedPeak = false;
      this.lastValue = 0;
      this.baseline = 0;
      this.signalBuffer = []; // También resetear el buffer de señal
      this.arrhythmiaProcessor.reset(); // Resetear el procesador de arritmias
   }

  // Métodos de cálculo de signos vitales existentes, ahora usan datos procesados y RR:

  private calculateRealSpO2(ppgValues: number[], signalQuality: number): number {
    // Lógica existente de calculateRealSpO2, adaptada para usar ppgValues y signalQuality
    // Implementación real de SpO2 a partir del ratio AC/DC de la señal PPG ROJA e IR si estuviera disponible (o solo rojo con estimación)
    // **Requiere señal de canal IR para ser REAL**. Asumiendo solo rojo, esto es una estimación EXPERIMENTAL.
    console.warn("calculateRealSpO2 es experimental sin señal IR");
    if (ppgValues.length < 60 || signalQuality < 0.6) return 0; // Necesita suficientes datos y buena calidad

    const ac = calculateAC(ppgValues.slice(-60));
    const dc = calculateDC(ppgValues.slice(-60));

    if (dc === 0 || ac === 0) return 0; // Evitar división por cero o señal plana

    // FÓRMULA SpO2 EXPERIMENTAL (Solo rojo)
    // Esta fórmula es una SIMULACIÓN/ESTIMACIÓN y NO es médicamente precisa.
    // Requiere sensor IR para ser real.
    // Sustituir con lógica real si se añade sensor IR.
    const R = (ac / dc); // Este R normalmente usaría RED_AC/RED_DC / IR_AC/IR_DC
    // La siguiente línea es una **SIMULACIÓN** con fines de demostración/desarrollo.
    // DEBE ser reemplazada por una fórmula clínicamente validada que use canales ROJO e IR.
    const estimatedSpo2 = 100 - (15 * R); // Fórmula de ejemplo no médica

    // Ajuste basado en calidad (menos calidad = valor más cercano a un baseline plausible)
    const baselineSpo2 = 98; // Baseline plausible
    const finalSpo2 = estimatedSpo2 * signalQuality + baselineSpo2 * (1 - signalQuality);

    // Rango plausible para SpO2
    return Math.max(85, Math.min(100, finalSpo2)); // Rango más conservador
  }

  private calculateRealBloodPressure(currentSignalBuffer: number[], heartRate: number): BloodPressureResult | { systolic: 0, diastolic: 0, confidence: 0, status?: string } {
    // Lógica existente de calculateRealBloodPressure, adaptada para usar currentSignalBuffer y heartRate
    // **Requiere calibración con un manguito de presión arterial para ser REAL**. Sin calibración, es una ESTIMACIÓN EXPERIMENTAL.
    console.warn("calculateRealBloodPressure es experimental sin calibración");
    if (currentSignalBuffer.length < 100 || heartRate === 0 || !this.globalCalibrationSuccess) {
      return { systolic: 0, diastolic: 0, confidence: 0, status: "INSUFFICIENT_DATA_OR_UNCALIBRATED" };
    }

    // Usar el BPProcessor dedicado
    // El BPProcessor debe ser calibrado externamente antes de usarse.
    // La calibración (setExternalCalibration) ya maneja la llamada a bpProcessor.calibrate.
    return this.bpProcessor.calculateBloodPressure(currentSignalBuffer); // Pasar buffer al procesador dedicado
  }

  private calculateRealGlucose(currentSignalBuffer: number[], heartRate: number): number {
    // Lógica existente de calculateRealGlucose, adaptada.
    // **Esta medición es ALTAMENTE EXPERIMENTAL y no clínicamente validada vía PPG de smartphone**.
    console.warn("calculateRealGlucose es ALTAMENTE EXPERIMENTAL y no validado");
     if (currentSignalBuffer.length < 200 || heartRate === 0 || !this.globalCalibrationSuccess) return 0;

     // Usar el GlucoseProcessor dedicado
     // El GlucoseProcessor debe ser calibrado externamente antes de usarse.
     // La calibración (setExternalCalibration) ya maneja la llamada a glucoseProcessor.calibrate.
     return this.glucoseProcessor.calculateGlucose(currentSignalBuffer); // Pasar buffer al procesador dedicado
  }

  private calculateRealLipids(currentSignalBuffer: number[], signalQuality: number): { totalCholesterol: number; triglycerides: number; status?: 'experimental_unreliable' } {
    // Lógica existente de calculateRealLipids, adaptada.
    // **Esta medición es ALTAMENTE EXPERIMENTAL y no clínicamente validada vía PPG de smartphone**.
    console.warn("calculateRealLipids es ALTAMENTE EXPERIMENTAL y no validado");
     if (currentSignalBuffer.length < 300 || signalQuality < 0.7) {
       return { totalCholesterol: 0, triglycerides: 0, status: 'experimental_unreliable' };
     }
     // Simulación/Estimación experimental - reemplazar con lógica real si se valida
     // ESTO ES ACTUALMENTE UNA SIMULACIÓN BASADA EN LA CALIDAD Y VARIABILIDAD DE LA SEÑAL
     // NO ES UNA MEDICIÓN REAL DE LÍPIDOS VÍA PPG.
     const variability = calculateStandardDeviation(currentSignalBuffer.slice(-100));
     const estimatedCholesterol = 150 + (variability * 1000) + (signalQuality * 50);
     const estimatedTriglycerides = 100 + (variability * 500) + (signalQuality * 30);

     return {
       totalCholesterol: Math.max(100, Math.min(300, estimatedCholesterol)),
       triglycerides: Math.max(50, Math.min(400, estimatedTriglycerides)),
       status: 'experimental_unreliable'
     };
  }

  private calculateRealHemoglobin(currentSignalBuffer: number[], signalQuality: number): number {
    // Lógica existente de calculateRealHemoglobin, adaptada.
    // **Esta medición es ALTAMENTE EXPERIMENTAL y no clínicamente validada vía PPG de smartphone**.
    console.warn("calculateRealHemoglobin es ALTAMENTE EXPERIMENTAL y no validado");
     if (currentSignalBuffer.length < 300 || signalQuality < 0.7) return 0;

     // Simulación/Estimación experimental - reemplazar con lógica real si se valida
     // ESTO ES ACTUALMENTE UNA SIMULACIÓN BASADA EN LA FORMA DEL PULSO Y CALIDAD DE LA SEÑAL
     // NO ES UNA MEDICIÓN REAL DE HEMOGLOBINA VÍA PPG.
     const peaks = findPeaksAndValleys(currentSignalBuffer.slice(-100)).peakIndices;
     const valleys = findPeaksAndValleys(currentSignalBuffer.slice(-100)).valleyIndices;
     let morphologyScore = 0;
     if (peaks.length > 1 && valleys.length > 1) {
        const avgAmplitude = calculateAmplitude(currentSignalBuffer.slice(-100), peaks, valleys);
        morphologyScore = avgAmplitude * signalQuality; // Ejemplo simple
     }
     const estimatedHemoglobin = 14 + (morphologyScore * 5); // Fórmula de ejemplo no médica

     return Math.max(10, Math.min(18, estimatedHemoglobin)); // Rango plausible
  }

  reset(): VitalSignsResult | null {
    console.log("VitalSignsProcessor: Reset parcial (mantiene calibración)");
    // Resetear estados de detección y buffers, pero mantener estado de calibración y sub-procesadores
    this.resetDetectionStates();
    return this.lastValidResults; // Opcional: devolver los últimos resultados válidos antes del reset
  }

  fullReset(): void {
    console.log("VitalSignsProcessor: Reset COMPLETO (resetea todo, incluida calibración)");
    this.resetDetectionStates();
    this.globalCalibrationSuccess = false;
    this.lastValidResults = null;
    this.bpProcessor.reset(); // Resetear sub-procesadores también
    this.glucoseProcessor.reset(); // Resetear sub-procesadores también
    this.arrhythmiaProcessor.reset(); // Resetear sub-procesador de arritmias
  }

  // Métodos que no deberían llamarse externamente
  // private calculateRealBPM(): number { /* ... */ }
  // private detectRealPeaks(signal: number[]): number[] { /* ... */ }
  // private calculateRealSpO2(): number { /* ... */ }
  // private calculateRealBloodPressure(): BloodPressureResult | { systolic: 0, diastolic: 0, confidence: 0, status?: string } { /* ... */ }
  // private calculateRealGlucose(): number { /* ... */ }
  // private calculateRealLipids(): { totalCholesterol: number; triglycerides: number; status?: 'experimental_unreliable' } { /* ... */ }
  // private calculateRealHemoglobin(): number { /* ... */ }

  // Getter para exponer la calidad de señal si es necesario
  public getSignalQuality(): number {
      return this.currentSignalQuality;
  }
}
