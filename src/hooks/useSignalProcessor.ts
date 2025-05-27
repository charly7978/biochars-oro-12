import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalProcessingPipeline, SignalPipelineConfig } from '../modules/signal-processing/SignalProcessingPipeline';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Tipo para el estado de calibración que se expondrá
export interface CalibrationStatus {
  phase: string;
  progress: number;
  instructions: string;
  isComplete: boolean;
  succeeded?: boolean; // Opcional: para indicar si la calibración fue exitosa
  recommendations?: string[]; // Opcional: recomendaciones si falló
}

// Extender ProcessedSignal para incluir opcionalmente info de calibración si se emite durante ese proceso
interface ExtendedProcessedSignal extends ProcessedSignal {
  calibrationPhase?: string;
  calibrationProgress?: number;
  calibrationInstructions?: string;
}

/**
 * Custom hook for managing PPG signal processing using the new SignalProcessingPipeline
 */
export const useSignalProcessor = () => {
  const processorRef = useRef<SignalProcessingPipeline | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus | null>(null);
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

    const onSignalReadyCallback = (signal: ExtendedProcessedSignal) => {
      // console.log("[DIAG] useSignalProcessor/onSignalReady: Frame recibido desde Pipeline", {
      //   timestamp: new Date(signal.timestamp).toISOString(),
      //   fingerDetected: signal.fingerDetected,
      //   quality: signal.quality,
      //   rawValue: signal.rawValue,
      //   filteredValue: signal.filteredValue,
      // });
      
      setLastSignal(signal);
      setError(null);
      
      // Solo contar frames si no estamos en una fase de calibración que emita señales "especiales"
      if (!signal.calibrationPhase) {
          setFramesProcessed(prev => prev + 1);
      }
      
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

    const onCalibrationUpdateCallback = (status: { phase: string; progress: number; instructions: string; isComplete: boolean; results?: any}) => {
        console.log("useSignalProcessor: Actualización de calibración recibida", status);
        const newStatus: CalibrationStatus = {
            phase: status.phase,
            progress: status.progress,
            instructions: status.instructions,
            isComplete: status.isComplete,
        };
        if (status.isComplete && status.results) {
            newStatus.succeeded = status.results.success;
            newStatus.recommendations = status.results.recommendations;
            setIsCalibrating(false); // La calibración del pipeline terminó
        }
        setCalibrationStatus(newStatus);
    };

    // CAMBIO: Instanciar SignalProcessingPipeline
    processorRef.current = new SignalProcessingPipeline(
        { /* aquí podrías pasar una config inicial si es necesario */ }, 
        onSignalReadyCallback, 
        onErrorCallback, 
        onCalibrationUpdateCallback // Pasar el nuevo callback
    );
    
    console.log("useSignalProcessor: SignalProcessingPipeline creado con todos los callbacks.");
    
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
    if (isCalibrating) {
        console.warn("useSignalProcessor: No se puede iniciar procesamiento de medición mientras se calibra.");
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
  }, [isCalibrating]);

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
  }, [isProcessing, framesProcessed, signalStats]);

  const startCalibration = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay SignalProcessingPipeline para iniciar calibración.");
      return;
    }
    if (isProcessing) {
        console.warn("useSignalProcessor: Deteniendo procesamiento de medición antes de calibrar.");
        stopProcessing(); // Detener medición si está activa
    }
    console.log("useSignalProcessor: Iniciando modo calibración desde hook");
    setIsCalibrating(true);
    setCalibrationStatus({ phase: 'init', progress: 0, instructions: 'Preparando calibración...', isComplete: false });
    processorRef.current.startCalibrationMode(); // Llama al método del pipeline
    processorRef.current.start(); // Asegurar que el pipeline esté "activo" para procesar frames para la calibración
  }, [isProcessing, stopProcessing]);

  const endCalibration = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay SignalProcessingPipeline para finalizar calibración.");
      return;
    }
    processorRef.current.endCalibrationMode();
    setIsCalibrating(false);
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
    isCalibrating,
    calibrationStatus,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    startCalibration,
    endCalibration,
    processFrame,
    signalHistory: signalHistoryRef.current,
    qualityTransitions: qualityTransitionsRef.current
  };
};
