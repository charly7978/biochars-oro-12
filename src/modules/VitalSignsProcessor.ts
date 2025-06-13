import { SignalOptimizer } from "@/modules/signal-processing/SignalOptimizer";
import { processBloodPressureSignal, updateBloodPressureFeedback } from "@/modules/vital-signs/blood-pressure-processor";

// Procesa la señal real y retorna los resultados de presión arterial optimizados
export function processVitalSigns(rawSignal: number[]) {
    // Inicializa el optimizador con parámetros reales (ajusta según hardware si es necesario)
    const optimizer = new SignalOptimizer({
        defaultGain: 1,
        ppgGain: 0.95,
        spo2Factor: 1.05,
        arrhythmiaThreshold: 50,
    });

    // Optimiza la señal en todos los canales
    const optimizedChannels = optimizer.optimize(rawSignal);

    // Usa el canal optimizado de presión arterial
    const bpResult = processBloodPressureSignal(optimizedChannels.bloodPressure);

    // Ejemplo de feedback bidireccional: puedes actualizar parámetros en tiempo real
    // optimizer.updateFeedback("bloodPressure", { calibrationFactor: nuevoValor, smoothingWindow: nuevoValor });
    // updateBloodPressureFeedback({ calibrationFactor: nuevoValor, smoothingWindow: nuevoValor });

    // Retorna el resultado para la UI
    return {
        bloodPressure: bpResult
    };
}
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ) {
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  public reset(): void {
    this.processor.reset();
  }
}

// Procesamiento real de signos vitales con integración del optimizador y canal exclusivo de presión arterial
export function processVitalSigns(rawSignal: number[]): { bloodPressure: any } {
    // Inicializa el optimizador con parámetros reales (ajustar según hardware)
    const optimizer = new SignalOptimizer({
        defaultGain: 1,
        ppgGain: 0.95,
        spo2Factor: 1.05,
        arrhythmiaThreshold: 50,
    });

    // Optimiza la señal en todos los canales
    const optimizedChannels = optimizer.optimize(rawSignal);

    // Usa el canal optimizado de presión arterial
    const bpResult = processBloodPressureSignal(optimizedChannels.bloodPressure);

    // Retorna el resultado para la UI
    return {
        bloodPressure: bpResult
    };
}
    // Ejemplo de feedback: actualizar parámetros en tiempo real (si corresponde)
    // optimizer.updateFeedback("ppg", { calibrationFactor: nuevoValor });
  
    // ...existing code that notifica o actualiza otros vitales...
}
