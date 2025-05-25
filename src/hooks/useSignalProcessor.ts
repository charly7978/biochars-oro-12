
import { useState, useRef, useCallback, useEffect } from 'react';
import { RealPPGProcessor } from '../modules/signal-processing/RealPPGProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook para procesamiento real de señales PPG - FASES 2-6 implementadas
 */
export const useSignalProcessor = () => {
  const processorRef = useRef<RealPPGProcessor | null>(null);
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

  const handleSignalReady = useCallback((signal: ProcessedSignal) => {
    console.log("useSignalProcessor: Real signal received", {
      timestamp: new Date(signal.timestamp).toISOString(),
      fingerDetected: signal.fingerDetected,
      quality: signal.quality,
      rawValue: signal.rawValue.toFixed(4),
      filteredValue: signal.filteredValue.toFixed(4)
    });
    
    setLastSignal(signal);
    setError(null);
    setFramesProcessed(prev => prev + 1);
    
    // Actualizar estadísticas solo con señales válidas
    if (signal.fingerDetected && signal.quality > 20) {
      setSignalStats(prev => {
        const newStats = {
          minValue: Math.min(prev.minValue, signal.filteredValue),
          maxValue: Math.max(prev.maxValue, signal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1,
          lastQualityUpdateTime: signal.timestamp
        };
        
        return newStats;
      });
    }
  }, []);

  const handleError = useCallback((error: ProcessingError) => {
    console.error("useSignalProcessor: Processing error:", error);
    setError(error);
  }, []);

  // Crear procesador real
  useEffect(() => {
    console.log("useSignalProcessor: Creating real PPG processor");

    processorRef.current = new RealPPGProcessor();
    processorRef.current.onSignalReady = handleSignalReady;
    processorRef.current.onError = handleError;
    
    return () => {
      if (processorRef.current) {
        processorRef.current.stop();
      }
    };
  }, [handleSignalReady, handleError]);

  const startProcessing = useCallback(async () => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available");
      return;
    }

    console.log("useSignalProcessor: Starting real processing");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0,
      lastQualityUpdateTime: 0
    });
    
    processorRef.current.start();
  }, []);

  const stopProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to stop");
      return;
    }

    console.log("useSignalProcessor: Stopping real processing");
    
    setIsProcessing(false);
    processorRef.current.stop();
  }, []);

  const calibrate = useCallback(async (): Promise<boolean> => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to calibrate");
      return false;
    }

    try {
      console.log("useSignalProcessor: Starting real calibration");
      await processorRef.current.calibrate();
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Calibration error:", error);
      return false;
    }
  }, []);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to process frames");
      return;
    }
    
    if (isProcessing) {
      try {
        processorRef.current.processFrame(imageData);
      } catch (error) {
        console.error("processFrame: Error processing frame", error);
      }
    }
  }, [isProcessing]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame
  };
};
