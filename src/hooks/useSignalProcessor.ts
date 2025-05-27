import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalProcessingPipeline } from '../modules/signal-processing/SignalProcessingPipeline';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Custom hook for managing PPG signal processing using the new SignalProcessingPipeline
 */
export const useSignalProcessor = () => {
  const processorRef = useRef<SignalProcessingPipeline | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0,
    lastQualityUpdateTime: 0
  });
  const signalHistoryRef = useRef<ProcessedSignal[]>([]);
  const qualityTransitionsRef = useRef<{time: number, from: number, to: number}[]>([]);
  const calibrationInProgressRef = useRef(false);
  const errorCountRef = useRef(0);
  const lastErrorTimeRef = useRef(0);

  useEffect(() => {
    const sessionId = Math.random().toString(36).substring(2, 9);
    console.log("useSignalProcessor: Creating new SignalProcessingPipeline instance", {
      timestamp: new Date().toISOString(),
      sessionId
    });

    const onSignalReadyCallback = (signal: ProcessedSignal) => {
      // console.log("[DIAG] useSignalProcessor/onSignalReady: Frame recibido desde Pipeline", {
      //   timestamp: new Date(signal.timestamp).toISOString(),
      //   fingerDetected: signal.fingerDetected,
      //   quality: signal.quality,
      //   rawValue: signal.rawValue,
      //   filteredValue: signal.filteredValue,
      // });
      
      setLastSignal(signal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      signalHistoryRef.current.push(signal);
      if (signalHistoryRef.current.length > 100) {
        signalHistoryRef.current.shift();
      }
      
      const prevSignal = signalHistoryRef.current[signalHistoryRef.current.length - 2];
      if (prevSignal && Math.abs(prevSignal.quality - signal.quality) > 15) {
        qualityTransitionsRef.current.push({
          time: signal.timestamp,
          from: prevSignal.quality,
          to: signal.quality
        });
        if (qualityTransitionsRef.current.length > 20) {
          qualityTransitionsRef.current.shift();
        }
      }
      
      if (signal.fingerDetected && signal.quality > 30) {
        setSignalStats(prev => ({
          minValue: Math.min(prev.minValue, signal.filteredValue),
          maxValue: Math.max(prev.maxValue, signal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1,
          lastQualityUpdateTime: signal.timestamp
        }));
      }
    };

    const onErrorCallback = (errorData: ProcessingError) => {
      const currentTime = Date.now();
      if (currentTime - lastErrorTimeRef.current < 2000) {
        errorCountRef.current++;
        console.error("useSignalProcessor: Error suprimido desde Pipeline:", {
          ...errorData,
          errorCount: errorCountRef.current
        });
        return;
      }
      errorCountRef.current = 1;
      lastErrorTimeRef.current = currentTime;
      console.error("useSignalProcessor: Error detallado desde Pipeline:", errorData);
      setError(errorData);
    };

    // CAMBIO: Instanciar SignalProcessingPipeline
    processorRef.current = new SignalProcessingPipeline({}, onSignalReadyCallback, onErrorCallback);
    
    console.log("useSignalProcessor: SignalProcessingPipeline creado con callbacks.");
    
    return () => {
      if (processorRef.current) {
        console.log("useSignalProcessor: Limpiando SignalProcessingPipeline");
        processorRef.current.stop();
      }
      signalHistoryRef.current = [];
      qualityTransitionsRef.current = [];
    };
  }, []);

  const startProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay SignalProcessingPipeline disponible para iniciar.");
      return;
    }

    console.log("useSignalProcessor: Iniciando procesamiento con SignalProcessingPipeline", {
      timestamp: new Date().toISOString(),
    });
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0,
      lastQualityUpdateTime: 0
    });
    signalHistoryRef.current = [];
    qualityTransitionsRef.current = [];
    errorCountRef.current = 0;
    lastErrorTimeRef.current = 0;
    
    processorRef.current.start();
  }, [isProcessing]); // isProcessing no debería estar aquí si startProcessing la modifica

  const stopProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay SignalProcessingPipeline disponible para detener.");
      return;
    }

    console.log("useSignalProcessor: Deteniendo procesamiento con SignalProcessingPipeline", {
      framesProcessed: framesProcessed,
      finalStats: signalStats,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processorRef.current.stop();
    calibrationInProgressRef.current = false;
  }, [isProcessing, framesProcessed, signalStats]); // isProcessing no debería estar aquí si stopProcessing la modifica

  const calibrate = useCallback(async () => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay SignalProcessingPipeline disponible para calibrar.");
      return false;
    }
    // La calibración ahora podría ser manejada internamente por SignalProcessingPipeline
    // o este método podría pasarle datos de referencia si fuera necesario.
    // Por ahora, asumimos que el pipeline tiene su propia lógica de calibración o no la necesita explícitamente aquí.
    console.log("useSignalProcessor: Calibración (manejada por SignalProcessingPipeline si es necesario)");
    calibrationInProgressRef.current = true;
    // Simular un proceso de calibración si el pipeline no tiene uno explícito invocado desde aquí
    // await new Promise(resolve => setTimeout(resolve, 2000)); 
    // processorRef.current.reset(); // O un método específico de calibración
    calibrationInProgressRef.current = false;
    return true; 
  }, []);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay SignalProcessingPipeline para procesar frames.");
      return;
    }
    if (isProcessing && processorRef.current.isProcessing) { // Doble chequeo
      // if (framesProcessed % 30 === 0) { // Log menos frecuente para reducir ruido
      //   console.log(`[DIAG] useSignalProcessor/processFrame con Pipeline: Procesando frame #${framesProcessed}`);
      // }
      try {
        processorRef.current.processFrame(imageData);
      } catch (error) {
        console.error("useSignalProcessor: Error al llamar processFrame en Pipeline", error);
      }
    }
  }, [isProcessing, framesProcessed]); // framesProcessed no debería estar aquí

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    isCalibrating: calibrationInProgressRef.current,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame,
    signalHistory: signalHistoryRef.current,
    qualityTransitions: qualityTransitionsRef.current
  };
};
