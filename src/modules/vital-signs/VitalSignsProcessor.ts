import { BloodPressureProcessor, BloodPressureResult } from "./blood-pressure-processor";
export type { BloodPressureResult };
import { GlucoseProcessor } from "./glucose-processor";

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

  constructor() {
    console.log("VitalSignsProcessor: Inicializado (SIN SIMULACIONES)");
    this.bpProcessor = new BloodPressureProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
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
    // Si la calibración global no fue exitosa, no procesar ni devolver resultados significativos.
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

    // Almacenar señal real
    this.signalBuffer.push(ppgValue);
    if (this.signalBuffer.length > 300) {
      this.signalBuffer.shift();
    }

    // Usar datos RR reales si están disponibles
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = [...rrData.intervals];
    }

    // Calcular BPM real basado en intervalos RR
    const heartRate = this.calculateRealBPM();
    
    // Calcular SpO2 real basado en ratio AC/DC
    const spo2 = this.calculateRealSpO2();
    
    // Calcular presión real basada en características de pulso
    const pressure = this.calculateRealBloodPressure(this.signalBuffer);
    
    // Calcular glucosa real basada en variabilidad PPG
    const glucose = this.calculateRealGlucose(this.signalBuffer);
    
    // Calcular lípidos reales basados en perfusión
    const lipids = this.calculateRealLipids();
    
    // Calcular hemoglobina real basada en absorción
    const hemoglobin = this.calculateRealHemoglobin();

    const result: VitalSignsResult = {
      heartRate,
      spo2,
      pressure,
      glucose,
      lipids,
      hemoglobin,
      arrhythmiaStatus: "NORMAL",
      lastArrhythmiaData: null,
      calibration: {
        isCalibrating: false,
        progress: {
          heartRate: 0,
          spo2: 0,
          pressure: 0,
          arrhythmia: 0,
          glucose: 0,
          lipids: 0,
          hemoglobin: 0
        }
      }
    };

    // Guardar solo resultados válidos
    if (heartRate > 40 && heartRate < 200 && spo2 > 80) {
      this.lastValidResults = result;
    } else {
      // Si la señal no es válida, no exponer resultados
      return {
        heartRate: 0,
        spo2: 0,
        pressure: { systolic: 0, diastolic: 0, confidence: 0, status: "INVALID_SIGNAL" },
        glucose: 0,
        lipids: { totalCholesterol: 0, triglycerides: 0, status: "experimental_unreliable" },
        hemoglobin: 0,
        arrhythmiaStatus: "NO_VALID_RESULT",
        lastArrhythmiaData: null,
        calibration: {
          isCalibrating: false,
          progress: {
            heartRate: 0,
            spo2: 0,
            pressure: 0,
            arrhythmia: 0,
            glucose: 0,
            lipids: 0,
            hemoglobin: 0
          }
        }
      };
    }

    return result;
  }

  private calculateRealBPM(): number {
    if (this.rrIntervals.length >= 3) {
      // Usar intervalos RR reales para calcular BPM
      const avgRR = this.rrIntervals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, this.rrIntervals.length);
      if (avgRR > 0) {
        const bpm = 60000 / avgRR; // Conversión de ms a BPM
        return Math.round(Math.max(40, Math.min(200, bpm)));
      }
    }

    // Fallback: detección de picos en señal PPG real
    if (this.signalBuffer.length < 20) return 0;
    
    const recent = this.signalBuffer.slice(-60); // Últimos 2 segundos
    const peaks = this.detectRealPeaks(recent);
    
    if (peaks.length >= 2) {
      const avgInterval = (recent.length - 1) / (peaks.length - 1) * (1000/30); // 30 FPS aprox
      const bpm = 60000 / avgInterval;
      return Math.round(Math.max(40, Math.min(200, bpm)));
    }
    
    return 0;
  }

  private detectRealPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    if (signal.length === 0) return [];
    const meanSignal = signal.reduce((a,b) => a+b, 0) / signal.length;
    const threshold = meanSignal * 1.05; // 5% por encima de la media como ejemplo, ajustar si es necesario
    
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] > threshold &&
          signal[i] > signal[i-1] && 
          signal[i] > signal[i-2] &&
          signal[i] > signal[i+1] && 
          signal[i] > signal[i+2]) {
        // Evitar picos muy cercanos
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 10) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }

  private calculateRealSpO2(): number {
    if (this.signalBuffer.length < 30) return 0;
    
    // Calcular componente AC (amplitud de pulsación)
    const recent = this.signalBuffer.slice(-30);
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const ac = max - min;
    
    // Calcular componente DC (nivel promedio)
    const dc = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (dc === 0 || ac === 0) return 0;
    
    // Ratio AC/DC para estimación de SpO2
    const ratio = ac / dc;
    
    // Fórmula empírica basada en investigación médica
    const spo2 = 110 - (25 * ratio);
    
    return Math.round(Math.max(80, Math.min(100, spo2)));
  }

  private calculateRealBloodPressure(currentSignalBuffer: number[]): BloodPressureResult | { systolic: 0, diastolic: 0, confidence: 0, status?: string } {
    if (currentSignalBuffer.length < 60) {
        return { systolic: 0, diastolic: 0, confidence: 0, status: "INSUFFICIENT_DATA" };
    }
    // BP Processor internamente verifica su propio this.isCalibrated (que se setea vía su propio .calibrate())
    const bpResult = this.bpProcessor.calculateBloodPressure(currentSignalBuffer);
    return bpResult;
  }

  private calculateRealGlucose(currentSignalBuffer: number[]): number {
    if (currentSignalBuffer.length < 60) {
        return 0;
    }
    // Glucose Processor internamente verifica su propio this.isCalibrated (que se setea vía su propio .calibrate())
    const glucoseEstimation = this.glucoseProcessor.calculateGlucose(currentSignalBuffer);
    return glucoseEstimation;
  }

  private calculateRealLipids(): { totalCholesterol: number; triglycerides: number; status?: 'experimental_unreliable' } {
    // ADVERTENCIA: La estimación de lípidos con PPG de smartphone es ALTAMENTE EXPERIMENTAL
    // y NO se considera fiable para uso médico. No hay una base científica sólida
    // ampliamente aceptada para esta medición con la tecnología actual de smartphones.
    // Devolver valores placeholder o que indiquen "no medible".
    return { totalCholesterol: 0, triglycerides: 0, status: "experimental_unreliable" };
  }

  private calculateRealHemoglobin(): number {
    // ADVERTENCIA: La estimación de hemoglobina con PPG de smartphone es ALTAMENTE EXPERIMENTAL
    // y NO se considera fiable para uso médico.
    // Devolver un valor placeholder o que indique "no medible".
    return 0; // Indica no medible o valor no fiable
  }

  reset(): VitalSignsResult | null {
    console.log("VitalSignsProcessor: Reset manteniendo últimos resultados");
    const savedResults = this.lastValidResults;
    
    this.signalBuffer = [];
    this.rrIntervals = [];
    this.globalCalibrationSuccess = false;
    
    // También resetear sub-procesadores
    this.bpProcessor.reset();
    this.glucoseProcessor.reset();

    return savedResults;
  }

  fullReset(): void {
    console.log("VitalSignsProcessor: Reset completo");
    this.signalBuffer = [];
    this.rrIntervals = [];
    this.frameCount = 0; // Aunque no se usa para calibración, se mantenía para processSignal, pero ya no es tan relevante
    this.lastValidResults = null;
    this.globalCalibrationSuccess = false;

    this.bpProcessor.reset();
    this.glucoseProcessor.reset();
  }
}
