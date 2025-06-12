import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  signalQuality?: number; // Nuevo campo para calidad de señal
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [signalQuality, setSignalQuality] = useState<number>(0); // Estado para calidad de señal
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  // Variables para seguimiento de detección
  const detectionAttempts = useRef<number>(0);
  const lastDetectionTime = useRef<number>(Date.now());
  // Variables para efecto látigo en picos
  const peakAmplificationFactor = useRef<number>(2.8); // Factor de amplificación para picos (mayor)
  const peakDecayRate = useRef<number>(0.85); // Velocidad de caída para efecto látigo
  const lastPeakTime = useRef<number | null>(null);
  
  // Umbral de calidad mínima para procesar - muy reducido para mejorar detección inicial
  const MIN_QUALITY_THRESHOLD = 10; // Valor muy bajo para permitir detección inicial

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creando nueva instancia de HeartBeatProcessor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
      console.log('useHeartBeatProcessor: Processor registrado en window', {
        processorRegistrado: !!(window as any).heartBeatProcessor,
        timestamp: new Date().toISOString()
      });

      // Añadir evento para asegurar que el audio se inicialice correctamente
      const initializeAudio = () => {
        console.log('useHeartBeatProcessor: Inicializando audio por interacción del usuario');
        if (processorRef.current) {
          // Esto forzará la creación del contexto de audio
          const dummyContext = new AudioContext();
          dummyContext.resume().then(() => {
            console.log('Audio context activated by user interaction');
            dummyContext.close();
          });
        }
      };
      
      document.body.addEventListener('click', initializeAudio, { once: true });
      document.body.addEventListener('touchstart', initializeAudio, { once: true });
    }

    return () => {
      console.log('useHeartBeatProcessor: Limpiando processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
        console.log('useHeartBeatProcessor: Processor eliminado de window', {
          processorExiste: !!(window as any).heartBeatProcessor,
          timestamp: new Date().toISOString()
        });
      }
    };
  }, []);

  const processSignal = useCallback((value: number, fingerDetected: boolean = true): HeartBeatResult => {
    const now = Date.now();
    detectionAttempts.current++;
    
    // Inicialización de processor si no existe
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor no inicializado', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        signalQuality: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Procesar señal independientemente de estado de detección para entrenar algoritmos
    // Esto ayuda a los algoritmos adaptativos a ajustarse más rápido
    console.log('useHeartBeatProcessor - processSignal:', {
      inputValue: value,
      normalizadoValue: value.toFixed(2),
      fingerDetected,
      detectionAttempts: detectionAttempts.current,
      timeSinceLastDetection: now - lastDetectionTime.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });

    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    const currentQuality = result.signalQuality || 0;
    
    // Actualizar el estado de calidad de señal
    setSignalQuality(currentQuality);

    // Aplicar efecto látigo a los picos
    let enhancedValue = value;
    if (result.isPeak) {
      // Amplificar significativamente el pico para un efecto más pronunciado
      enhancedValue = value * peakAmplificationFactor.current;
      lastPeakTime.current = now;
    } else if (lastPeakTime.current) {
      // Calcular tiempo desde el último pico
      const timeSincePeak = now - lastPeakTime.current;
      
      // Aplicar caída progresiva para efecto látigo (más rápido al inicio, luego más lento)
      if (timeSincePeak < 300) { // 300ms de caída rápida
        const decayFactor = Math.pow(peakDecayRate.current, timeSincePeak / 30);
        enhancedValue = value * (1 + (peakAmplificationFactor.current - 1) * decayFactor);
      }
    }
    
    // Actualizar el valor filtrado con nuestro valor amplificado
    result.filteredValue = enhancedValue;

    console.log('useHeartBeatProcessor - resultado:', {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      enhancedValue: enhancedValue,
      arrhythmiaCount: result.arrhythmiaCount,
      signalQuality: currentQuality,
      rrIntervals: JSON.stringify(rrData.intervals.slice(-5)),
      ultimoPico: rrData.lastPeakTime,
      tiempoDesdeUltimoPico: rrData.lastPeakTime ? Date.now() - rrData.lastPeakTime : null,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Si no hay dedo detectado pero tenemos una señal de calidad razonable
    // consideramos que el dedo está presente (corrige falsos negativos)
    const effectiveFingerDetected = fingerDetected || (currentQuality > MIN_QUALITY_THRESHOLD && result.confidence > 0.3);
    
    // Si no hay dedo detectado efectivamente, reducir los valores
    if (!effectiveFingerDetected) {
      console.log('useHeartBeatProcessor: Dedo no detectado efectivamente', {
        fingerDetected,
        currentQuality,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      });
      
      // Reducir gradualmente los valores actuales en vez de resetearlos inmediatamente
      // Esto evita cambios bruscos en la UI
      if (currentBPM > 0) {
        const reducedBPM = Math.max(0, currentBPM - 5);
        const reducedConfidence = Math.max(0, confidence - 0.1);
        setCurrentBPM(reducedBPM);
        setConfidence(reducedConfidence);
      }
      
      return {
        bpm: currentBPM, // Mantener último valor conocido brevemente
        confidence: Math.max(0, confidence - 0.1), // Reducir gradualmente
        isPeak: false,
        filteredValue: enhancedValue, // Usar valor mejorado
        arrhythmiaCount: 0,
        signalQuality: currentQuality,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Actualizar tiempo de última detección
    lastDetectionTime.current = now;
    
    // Si la confianza es suficiente, actualizar valores
    if (result.confidence >= 0.5 && result.bpm > 0) {
      console.log('useHeartBeatProcessor - Actualizando BPM y confianza', {
        prevBPM: currentBPM,
        newBPM: result.bpm,
        prevConfidence: confidence,
        newConfidence: result.confidence,
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    return {
      ...result,
      filteredValue: enhancedValue, // Usar valor mejorado
      signalQuality: currentQuality,
      rrData
    };
  }, [currentBPM, confidence, signalQuality]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reseteando processor', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
      console.log('useHeartBeatProcessor: Processor reseteado correctamente', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('useHeartBeatProcessor: No se pudo resetear - processor no existe', {
        timestamp: new Date().toISOString()
      });
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    setSignalQuality(0);
    detectionAttempts.current = 0;
    lastDetectionTime.current = Date.now();
  }, [currentBPM, confidence]);

  // Aseguramos que setArrhythmiaState funcione correctamente
  const setArrhythmiaState = useCallback((isArrhythmiaDetected: boolean) => {
    console.log('useHeartBeatProcessor: Estableciendo estado de arritmia', {
      isArrhythmiaDetected,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.setArrhythmiaDetected(isArrhythmiaDetected);
    } else {
      console.warn('useHeartBeatProcessor: No se pudo establecer estado de arritmia - processor no existe');
    }
  }, []);

  const [bpm, setBpm] = useState<number | null>(null);
  const [rrIntervals, setRRIntervals] = useState<number[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  // peaks: number[], fps: number
  const processPeaks = useCallback((peaks: number[], fps = 30) => {
    if (peaks.length < 2) {
      setBpm(null);
      setRRIntervals([]);
      setWarning("No se detectan latidos válidos.");
      return;
    }
    // RR intervals en ms
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push((peaks[i] - peaks[i - 1]) * (1000 / fps));
    }
    setRRIntervals(intervals);

    // BPM promedio
    const avgRR = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpmValue = avgRR > 0 ? Math.round(60000 / avgRR) : null;
    setBpm(bpmValue);

    setWarning(null);
  }, []);

  return {
    currentBPM,
    confidence,
    signalQuality, // Exponiendo la calidad de señal
    processSignal,
    reset,
    setArrhythmiaState,
    bpm,
    rrIntervals,
    warning,
    processPeaks,
  };
};
