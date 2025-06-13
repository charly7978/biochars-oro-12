import { VitalSignsProcessor as NewVitalSignsProcessor } from './vital-signs/VitalSignsProcessor';
import { SignalOptimizer } from "@/modules/signal-processing/SignalOptimizer";
import { processBloodPressureSignal } from "@/modules/vital-signs/blood-pressure-processor";

/**
 * This is a wrapper class to maintain backward compatibility with
 * the original VitalSignsProcessor implementation while using the 
 * refactored version under the hood.
 */
export class VitalSignsProcessor {
  private processor: NewVitalSignsProcessor;
  
  // Expose constants for compatibility
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_WINDOW = 10;
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  private readonly PEAK_THRESHOLD = 0.3;
  
  constructor() {
    this.processor = new NewVitalSignsProcessor();
  }
  
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ) {
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  public reset(): void {
    this.processor.reset();
  }
}

// Esta función es la responsable de procesar la señal de todos los signos vitales
export function processVitalSigns(rawSignal: number[]): void {
    // rawSignal: la señal obtenida del sensor/hardware.
  
    // Inicializa el optimizador con parámetros configurables.
    const optimizer = new SignalOptimizer({
        defaultGain: 1,
        ppgGain: 0.95,
        spo2Factor: 1.05,
        arrhythmiaThreshold: 50,
    });
  
    // Optimiza la señal en todos los canales.
    const optimizedChannels = optimizer.optimize(rawSignal);
  
    // Procesa la señal de presión arterial utilizando el canal optimizado (por ejemplo, PPG).
    const bpResult = processBloodPressureSignal(optimizedChannels.ppg);
  
    // Se puede actualizar el estado global o la UI con los resultados.
    console.log("Presión arterial estimada:", bpResult);
  
    // Ejemplo de feedback: actualizar parámetros en tiempo real (si corresponde)
    // optimizer.updateFeedback("ppg", { calibrationFactor: nuevoValor });
  
    // ...existing code that notifica o actualiza otros vitales...
}
