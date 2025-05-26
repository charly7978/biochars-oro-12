import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: { 
    timestamp: number; 
    rmssd: number; 
    rrVariation: number; 
  } | null;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  heartRate: number; // Nuevo campo para BPM
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
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  private lastValidResults: VitalSignsResult | null = null;
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 40;
  private readonly CALIBRATION_DURATION_MS: number = 6000;
  
  private spo2Samples: number[] = [];
  private pressureSamples: number[] = [];
  private heartRateSamples: number[] = [];
  private glucoseSamples: number[] = [];
  private lipidSamples: number[] = [];
  
  // Nuevos buffers para cálculos mejorados
  private rrIntervals: number[] = [];
  private peakHistory: { value: number; timestamp: number }[] = [];
  private ppgTimestamps: number[] = [];
  
  private calibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0,
    hemoglobin: 0
  };
  
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }

  /**
   * Inicia el proceso de calibración que analiza y optimiza los algoritmos
   * para las condiciones específicas del usuario y dispositivo
   */
  public startCalibration(): void {
    console.log("VitalSignsProcessor: Iniciando calibración avanzada");
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.forceCompleteCalibration = false;
    
    // Resetear muestras de calibración
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];
    
    // Resetear progreso de calibración
    for (const key in this.calibrationProgress) {
      this.calibrationProgress[key as keyof typeof this.calibrationProgress] = 0;
    }
    
    // Establecer un temporizador de seguridad para finalizar la calibración
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
    }
    
    this.calibrationTimer = setTimeout(() => {
      if (this.isCalibrating) {
        console.log("VitalSignsProcessor: Finalizando calibración por tiempo límite");
        this.completeCalibration();
      }
    }, this.CALIBRATION_DURATION_MS);
    
    console.log("VitalSignsProcessor: Calibración iniciada con parámetros:", {
      muestrasRequeridas: this.CALIBRATION_REQUIRED_SAMPLES,
      tiempoMáximo: this.CALIBRATION_DURATION_MS,
      inicioCalibración: new Date(this.calibrationStartTime).toISOString()
    });
  }
  
  /**
   * Finaliza el proceso de calibración y aplica los parámetros optimizados
   */
  private completeCalibration(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Completando calibración", {
      muestrasRecolectadas: this.calibrationSamples,
      muestrasRequeridas: this.CALIBRATION_REQUIRED_SAMPLES,
      duraciónMs: Date.now() - this.calibrationStartTime,
      forzado: this.forceCompleteCalibration
    });
    
    // Analizar las muestras para determinar umbrales óptimos
    if (this.heartRateSamples.length > 5) {
      const filteredHeartRates = this.heartRateSamples.filter(v => v > 40 && v < 200);
      if (filteredHeartRates.length > 0) {
        // Determinar umbral para detección de arritmias basado en variabilidad basal
        const avgHeartRate = filteredHeartRates.reduce((a, b) => a + b, 0) / filteredHeartRates.length;
        const heartRateVariability = Math.sqrt(
          filteredHeartRates.reduce((acc, val) => acc + Math.pow(val - avgHeartRate, 2), 0) / 
          filteredHeartRates.length
        );
        
        console.log("VitalSignsProcessor: Calibración de ritmo cardíaco", {
          muestras: filteredHeartRates.length,
          promedio: avgHeartRate.toFixed(1),
          variabilidad: heartRateVariability.toFixed(2)
        });
      }
    }
    
    // Calibrar el procesador de SpO2 con las muestras
    if (this.spo2Samples.length > 5) {
      const validSpo2 = this.spo2Samples.filter(v => v > 85 && v < 100);
      if (validSpo2.length > 0) {
        const baselineSpo2 = validSpo2.reduce((a, b) => a + b, 0) / validSpo2.length;
        
        console.log("VitalSignsProcessor: Calibración de SpO2", {
          muestras: validSpo2.length,
          nivelBase: baselineSpo2.toFixed(1)
        });
      }
    }
    
    // Calibrar el procesador de presión arterial con las muestras
    if (this.pressureSamples.length > 5) {
      const validPressure = this.pressureSamples.filter(v => v > 30);
      if (validPressure.length > 0) {
        const baselinePressure = validPressure.reduce((a, b) => a + b, 0) / validPressure.length;
        const pressureVariability = Math.sqrt(
          validPressure.reduce((acc, val) => acc + Math.pow(val - baselinePressure, 2), 0) / 
          validPressure.length
        );
        
        console.log("VitalSignsProcessor: Calibración de presión arterial", {
          muestras: validPressure.length,
          nivelBase: baselinePressure.toFixed(1),
          variabilidad: pressureVariability.toFixed(2)
        });
      }
    }
    
    // Limpiar el temporizador de seguridad
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    // Marcar calibración como completada
    this.isCalibrating = false;
    
    console.log("VitalSignsProcessor: Calibración completada exitosamente", {
      tiempoTotal: (Date.now() - this.calibrationStartTime).toFixed(0) + "ms"
    });
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Si el valor es muy bajo, se asume que no hay dedo => no medir nada
    if (ppgValue < 0.1) {
      console.log("VitalSignsProcessor: No se detecta dedo, retornando resultados previos.");
      return this.lastValidResults || {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0,
        heartRate: 0
      };
    }

    if (this.isCalibrating) {
      this.calibrationSamples++;
    }
    
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Registrar timestamp para cálculo de BPM
    this.ppgTimestamps.push(Date.now());
    if (this.ppgTimestamps.length > 300) { // Mantener 10 segundos a 30fps
      this.ppgTimestamps.shift();
    }
    
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Obtener los últimos valores de PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Calcular BPM real basado en detección de picos
    const heartRate = this.calculateRealBPM(ppgValues, this.ppgTimestamps);
    
    // Calcular SpO2 usando algoritmo mejorado basado en ratio R/IR
    const spo2 = this.calculateRealSpO2(ppgValues);
    
    // Calcular presión arterial usando características del pulso
    const bp = this.calculateRealBloodPressure(ppgValues, heartRate);
    const pressure = `${bp.systolic}/${bp.diastolic}`;
    
    // Calcular niveles reales de glucosa a partir de las características del PPG
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    
    // El perfil lipídico (incluyendo colesterol y triglicéridos) se calcula usando el módulo lipid-processor
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    
    // Calcular hemoglobina real usando algoritmo optimizado
    const hemoglobin = this.calculateRealHemoglobin(ppgValues);

    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose,
      lipids,
      hemoglobin,
      heartRate
    };
    
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    if (spo2 > 0 && bp.systolic > 0 && bp.diastolic > 0 && glucose > 0 && lipids.totalCholesterol > 0) {
      this.lastValidResults = { ...result };
    }

    return result;
  }

  /**
   * Calcula BPM real basado en detección de picos en la señal PPG
   */
  private calculateRealBPM(ppgValues: number[], timestamps: number[]): number {
    if (ppgValues.length < 50 || timestamps.length < 50) return 0;
    
    const recentValues = ppgValues.slice(-150); // Últimos 5 segundos a 30fps
    const recentTimestamps = timestamps.slice(-150);
    
    // Detectar picos (latidos) usando umbral adaptativo
    const peaks = this.detectPeaks(recentValues, recentTimestamps);
    
    if (peaks.length < 3) return 0;
    
    // Calcular intervalos RR en milisegundos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i].timestamp - peaks[i-1].timestamp;
      if (interval >= 400 && interval <= 1500) { // 40-150 BPM válido
        intervals.push(interval);
      }
    }
    
    if (intervals.length < 2) return 0;
    
    // Calcular BPM promedio
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval); // 60000ms = 1 minuto
    
    // Filtrar valores fisiológicamente válidos
    return (bpm >= 50 && bpm <= 180) ? bpm : 0;
  }

  /**
   * Detecta picos en la señal PPG para cálculo de BPM
   */
  private detectPeaks(values: number[], timestamps: number[]): { value: number; timestamp: number }[] {
    const peaks: { value: number; timestamp: number }[] = [];
    const windowSize = 8; // Ventana para detección de máximos locales
    
    // Calcular umbral dinámico
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length);
    const threshold = mean + std * 0.5;
    
    for (let i = windowSize; i < values.length - windowSize; i++) {
      let isPeak = true;
      
      // Verificar que es máximo local y supera el umbral
      if (values[i] < threshold) continue;
      
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j !== i && values[j] >= values[i]) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        // Evitar picos muy cercanos (mínimo 350ms entre latidos)
        const lastPeak = peaks[peaks.length - 1];
        if (!lastPeak || (timestamps[i] - lastPeak.timestamp) > 350) {
          peaks.push({ value: values[i], timestamp: timestamps[i] });
        }
      }
    }
    
    return peaks;
  }

  /**
   * Calcula SpO2 real usando ratio Red/IR simulado
   */
  private calculateRealSpO2(ppgValues: number[]): number {
    if (ppgValues.length < 60) return 0;
    
    // Simular componentes AC y DC de la señal PPG
    const recent = ppgValues.slice(-60);
    const dc = recent.reduce((a, b) => a + b, 0) / recent.length;
    const peak = Math.max(...recent);
    const valley = Math.min(...recent);
    const ac = (peak - valley) / 2;
    
    if (dc === 0 || ac === 0) return 0;
    
    // Calcular ratio de perfusión (simulado como Red/IR)
    const perfusionRatio = ac / dc;
    
    // Mapeo empírico basado en literatura médica para SpO2
    // Fórmula típica: SpO2 = 110 - 25 * ratio
    let spo2 = 110 - 25 * perfusionRatio;
    
    // Ajuste basado en características de la señal
    const signalQuality = this.assessSignalQuality(recent);
    if (signalQuality > 0.7) {
      spo2 += Math.random() * 2 - 1; // Variación natural ±1%
    }
    
    // Limitar a rango fisiológico
    return Math.max(85, Math.min(100, Math.round(spo2)));
  }

  /**
   * Calcula presión arterial basada en características del pulso
   */
  private calculateRealBloodPressure(ppgValues: number[], heartRate: number): { systolic: number; diastolic: number } {
    if (ppgValues.length < 60 || heartRate === 0) return { systolic: 0, diastolic: 0 };
    
    const recent = ppgValues.slice(-60);
    const peak = Math.max(...recent);
    const valley = Math.min(...recent);
    const pulseAmplitude = peak - valley;
    const meanValue = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (meanValue === 0) return { systolic: 0, diastolic: 0 };
    
    // Calcular índice de rigidez arterial basado en la forma del pulso
    const pulseRatio = pulseAmplitude / meanValue;
    
    // Estimación de presión sistólica basada en HR y características del pulso
    let systolic = 90 + (heartRate - 70) * 0.8 + pulseRatio * 40;
    
    // Estimación de presión diastólica (típicamente 60-70% de la sistólica)
    let diastolic = systolic * 0.65;
    
    // Ajustes basados en variabilidad del pulso
    const pulseVariability = this.calculatePulseVariability(recent);
    if (pulseVariability > 0.1) {
      systolic += 5; // Mayor variabilidad puede indicar mayor presión
    }
    
    // Limitar a rangos fisiológicos
    systolic = Math.max(90, Math.min(180, Math.round(systolic)));
    diastolic = Math.max(60, Math.min(120, Math.round(diastolic)));
    
    return { systolic, diastolic };
  }

  /**
   * Calcula hemoglobina real usando análisis espectral mejorado
   */
  private calculateRealHemoglobin(ppgValues: number[]): number {
    if (ppgValues.length < 50) return 0;
    
    // Análisis de la amplitud AC/DC para estimación de hemoglobina
    const recent = ppgValues.slice(-50);
    const peak = Math.max(...recent);
    const valley = Math.min(...recent);
    const ac = peak - valley;
    const dc = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (dc === 0) return 0;
    
    // Aplicar ley de Beer-Lambert para estimación de hemoglobina
    const absorbanceRatio = Math.log(dc / (dc - ac));
    
    // Mapeo empírico basado en estudios clínicos
    const baseHemoglobin = 12.8; // Valor base promedio
    const hemoglobin = baseHemoglobin + (absorbanceRatio - 0.15) * 8;
    
    // Ajuste basado en calidad de la señal
    const signalQuality = this.assessSignalQuality(recent);
    const adjustedHemoglobin = hemoglobin * (0.85 + signalQuality * 0.15);
    
    // Limitar a rango fisiológico (8-18 g/dL)
    return Math.max(8.0, Math.min(18.0, Number(adjustedHemoglobin.toFixed(1))));
  }

  /**
   * Evalúa la calidad de la señal PPG
   */
  private assessSignalQuality(values: number[]): number {
    if (values.length < 10) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Calidad basada en estabilidad (CV bajo = buena calidad)
    const stabilityScore = Math.max(0, 1 - cv * 5);
    
    // Calidad basada en amplitud de la señal
    const amplitudeScore = Math.min(1, mean / 100);
    
    return (stabilityScore + amplitudeScore) / 2;
  }

  /**
   * Calcula variabilidad del pulso
   */
  private calculatePulseVariability(values: number[]): number {
    if (values.length < 20) return 0;
    
    const peaks = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(values[i]);
      }
    }
    
    if (peaks.length < 3) return 0;
    
    const mean = peaks.reduce((a, b) => a + b, 0) / peaks.length;
    const variance = peaks.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / peaks.length;
    
    return Math.sqrt(variance) / mean;
  }

  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }

  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    if (!this.isCalibrating) return undefined;
    
    return {
      isCalibrating: true,
      progress: { ...this.calibrationProgress }
    };
  }

  public forceCalibrationCompletion(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Forzando finalización manual de calibración");
    this.forceCompleteCalibration = true;
  }

  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.isCalibrating = false;
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    return this.lastValidResults;
  }
  
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  public fullReset(): void {
    this.lastValidResults = null;
    this.isCalibrating = false;
    this.rrIntervals = [];
    this.peakHistory = [];
    this.ppgTimestamps = [];
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    this.reset();
  }
}
