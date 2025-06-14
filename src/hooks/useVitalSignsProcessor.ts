import { useEffect, useState, useCallback, useRef } from "react";
import { VitalSignsProcessor, VitalSignsResult } from "../modules/vital-signs/VitalSignsProcessor";

export function useVitalSignsProcessor() {
  const [calibrationFeedback, setCalibrationFeedback] = useState("SIN DATOS");
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const processor = new VitalSignsProcessor();
  const arrhythmiaCounterRef = useRef(0);
  const lastArrhythmiaTimeRef = useRef(0);
  const processedSignalsRef = useRef(0);
  const hasDetectedArrhythmiaRef = useRef(false);
  const sessionIdRef = useRef(Date.now().toString());
  const signalLogRef = useRef<any[]>([]);

  useEffect(() => {
    // Se asume que el sistema real emite eventos "sensorData" con datos del sensor
    const sensorListener = (event: Event & { detail: { ppgValue: number; rrData: any } }) => {
      const sensorData = event.detail;
      const result = processor.processSignal(sensorData.ppgValue, sensorData.rrData);
      setCalibrationFeedback(result.calibrationFeedback);
      // Actualizar los resultados válidos
      if (result.heartRate > 40 && result.heartRate < 200 && result.spo2 > 80) { // Criterios simplificados para validez
        setLastValidResults(result);
      }
    };

    window.addEventListener("sensorData", sensorListener);
    return () => {
      window.removeEventListener("sensorData", sensorListener);
    };
  }, [processor]);

  // Advanced configuration based on clinical guidelines
  const MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000; // Minimum 1 second between arrhythmias
  const MAX_ARRHYTHMIAS_PER_SESSION = 20; // Reasonable maximum for 30 seconds
  const SIGNAL_QUALITY_THRESHOLD = 0.55; // Signal quality required for reliable detection
  
  useEffect(() => {
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      parametros: {
        MIN_TIME_BETWEEN_ARRHYTHMIAS,
        MAX_ARRHYTHMIAS_PER_SESSION,
        SIGNAL_QUALITY_THRESHOLD
      }
    });
    
    return () => {
      console.log("useVitalSignsProcessor: Hook destruido", {
        sessionId: sessionIdRef.current,
        arritmiasTotales: arrhythmiaCounterRef.current,
        señalesProcesadas: processedSignalsRef.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Start calibration for all vital signs
   */
  const startCalibration = useCallback(() => {
    console.log("useVitalSignsProcessor: Iniciando calibración de todos los parámetros", {
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current
    });
    
    processor.startCalibration();
  }, [processor]);
  
  /**
   * Force calibration to complete immediately
   */
  const forceCalibrationCompletion = useCallback(() => {
    console.log("useVitalSignsProcessor: Forzando finalización de calibración", {
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current
    });
    
    processor.forceCalibrationCompletion();
  }, [processor]);
  
  // Process the signal with improved algorithms
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    processedSignalsRef.current++;
    
    console.log("useVitalSignsProcessor: Procesando señal", {
      valorEntrada: value,
      rrDataPresente: !!rrData,
      intervalosRR: rrData?.intervals.length || 0,
      ultimosIntervalos: rrData?.intervals.slice(-3) || [],
      contadorArritmias: arrhythmiaCounterRef.current,
      señalNúmero: processedSignalsRef.current,
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      calibrando: processor.isCurrentlyCalibrating(),
      progresoCalibración: processor.getCalibrationProgress()
    });
    
    // Process signal through the vital signs processor
    const result = processor.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Guardar para depuración
    if (processedSignalsRef.current % 20 === 0) {
      signalLogRef.current.push({
        timestamp: currentTime,
        value,
        result: {...result}
      });
      
      // Mantener el log a un tamaño manejable
      if (signalLogRef.current.length > 50) {
        signalLogRef.current = signalLogRef.current.slice(-50);
      }
      
      console.log("useVitalSignsProcessor: Log de señales", {
        totalEntradas: signalLogRef.current.length,
        ultimasEntradas: signalLogRef.current.slice(-3)
      });
    }
    
    // Si tenemos un resultado válido, guárdalo
    if (result.heartRate > 40 && result.heartRate < 200 && result.spo2 > 80 && result.glucose.estimatedGlucose > 0) {
      console.log("useVitalSignsProcessor: Resultado válido detectado", {
        spo2: result.spo2,
        presión: result.pressure,
        glucosa: result.glucose,
        lípidos: result.lipids,
        timestamp: new Date().toISOString()
      });
      
      setLastValidResults(result);
    }
    
    // Enhanced RR interval analysis (more robust than previous)
    if (rrData?.intervals && rrData.intervals.length >= 3) {
      const lastThreeIntervals = rrData.intervals.slice(-3);
      const avgRR = lastThreeIntervals.reduce((a, b) => a + b, 0) / lastThreeIntervals.length;
      
      // Calculate RMSSD (Root Mean Square of Successive Differences)
      let rmssd = 0;
      for (let i = 1; i < lastThreeIntervals.length; i++) {
        rmssd += Math.pow(lastThreeIntervals[i] - lastThreeIntervals[i-1], 2);
      }
      rmssd = Math.sqrt(rmssd / (lastThreeIntervals.length - 1));
      
      // Enhanced arrhythmia detection criteria with SD metrics
      const lastRR = lastThreeIntervals[lastThreeIntervals.length - 1];
      const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
      
      // Calculate standard deviation of intervals
      const rrSD = Math.sqrt(
        lastThreeIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
        lastThreeIntervals.length
      );
      
      console.log("useVitalSignsProcessor: Análisis avanzado RR", {
        rmssd,
        rrVariation,
        rrSD,
        lastRR,
        avgRR,
        lastThreeIntervals,
        tiempoDesdeÚltimaArritmia: currentTime - lastArrhythmiaTimeRef.current,
        arritmiaDetectada: hasDetectedArrhythmiaRef.current,
        contadorArritmias: arrhythmiaCounterRef.current,
        timestamp: new Date().toISOString()
      });
      
      // Multi-parametric arrhythmia detection algorithm
      if ((rmssd > 50 && rrVariation > 0.20) || // Primary condition
          (rrSD > 35 && rrVariation > 0.18) ||  // Secondary condition
          (lastRR > 1.4 * avgRR) ||             // Extreme outlier condition
          (lastRR < 0.6 * avgRR)) {             // Extreme outlier condition
          
        console.log("useVitalSignsProcessor: Posible arritmia detectada", {
          rmssd,
          rrVariation,
          rrSD,
          condición1: rmssd > 50 && rrVariation > 0.20,
          condición2: rrSD > 35 && rrVariation > 0.18,
          condición3: lastRR > 1.4 * avgRR,
          condición4: lastRR < 0.6 * avgRR,
          timestamp: new Date().toISOString()
        });
        
        if (currentTime - lastArrhythmiaTimeRef.current >= MIN_TIME_BETWEEN_ARRHYTHMIAS &&
            arrhythmiaCounterRef.current < MAX_ARRHYTHMIAS_PER_SESSION) {
          
          hasDetectedArrhythmiaRef.current = true;
          const nuevoContador = arrhythmiaCounterRef.current + 1;
          arrhythmiaCounterRef.current = nuevoContador;
          lastArrhythmiaTimeRef.current = currentTime;
          
          console.log("Arritmia confirmada:", {
            rmssd,
            rrVariation,
            rrSD,
            lastRR,
            avgRR,
            intervals: lastThreeIntervals,
            counter: nuevoContador,
            timestamp: new Date().toISOString()
          });

          return {
            ...result,
            arrhythmiaStatus: `ARRITMIA DETECTADA|${nuevoContador}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              rmssd,
              rrVariation
            }
          };
        } else {
          console.log("useVitalSignsProcessor: Arritmia detectada pero ignorada", {
            motivo: currentTime - lastArrhythmiaTimeRef.current < MIN_TIME_BETWEEN_ARRHYTHMIAS ? 
              "Demasiado pronto desde la última" : "Máximo número de arritmias alcanzado",
            tiempoDesdeÚltima: currentTime - lastArrhythmiaTimeRef.current,
            máximoPermitido: MAX_ARRHYTHMIAS_PER_SESSION,
            contadorActual: arrhythmiaCounterRef.current,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // If we previously detected an arrhythmia, maintain that state
    if (hasDetectedArrhythmiaRef.current) {
      return {
        ...result,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${arrhythmiaCounterRef.current}`,
        lastArrhythmiaData: null
      };
    }
    
    // No arrhythmias detected
    return {
      ...result,
      arrhythmiaStatus: `SIN ARRITMIAS|${arrhythmiaCounterRef.current}`
    };
  }, [processor]);

  // Soft reset: mantener los resultados pero reiniciar los procesadores
  const reset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo suave", {
      estadoAnterior: {
        arritmias: arrhythmiaCounterRef.current,
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    const savedResults = processor.reset();
    if (savedResults) {
      setLastValidResults(savedResults); // Si hay resultados guardados, actualizarlos
      console.log("useVitalSignsProcessor: Guardando resultados tras reset", { resultados: savedResults });
    } else {
      console.log("useVitalSignsProcessor: No hay resultados para guardar tras reset");
      setLastValidResults(null); // Asegurarse de limpiar si no hay resultados válidos
    }

    // Resetear los contadores del hook
    arrhythmiaCounterRef.current = 0;
    lastArrhythmiaTimeRef.current = 0;
    processedSignalsRef.current = 0;
    hasDetectedArrhythmiaRef.current = false;
    signalLogRef.current = [];

    setCalibrationFeedback("SIN DATOS"); // Resetear el feedback de calibración
  }, [processor, lastValidResults]);

  // Full reset: limpia todo y reinicia los procesadores completamente
  const fullReset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo completo", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
    processor.fullReset();
    setLastValidResults(null); // Limpiar completamente los resultados
    setCalibrationFeedback("SIN DATOS"); // Limpiar feedback de calibración
    arrhythmiaCounterRef.current = 0;
    lastArrhythmiaTimeRef.current = 0;
    processedSignalsRef.current = 0;
    hasDetectedArrhythmiaRef.current = false;
    signalLogRef.current = [];
  }, [processor]);

  return {
    lastValidResults,
    calibrationFeedback,
    startCalibration,
    forceCalibrationCompletion,
    processSignal,
    reset,
    fullReset,
  };
}
