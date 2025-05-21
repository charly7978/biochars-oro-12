
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  signalQuality?: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [signalQuality, setSignalQuality] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Variables para seguimiento de detección
  const detectionAttempts = useRef<number>(0);
  const lastDetectionTime = useRef<number>(Date.now());
  
  // Variables para efecto látigo en picos
  const peakAmplificationFactor = useRef<number>(4.5); // Incrementado para picos más prominentes
  const peakDecayRate = useRef<number>(0.65); // Ajustado para caída más rápida
  const lastPeakTime = useRef<number | null>(null);
  
  // Umbral de calidad mínima para procesar - reducido para mejor detección
  const MIN_QUALITY_THRESHOLD = 5; // Valor muy bajo para permitir detección inicial
  
  // Variables para sincronización de picos visuales con audio
  const lastReportedPeakTime = useRef<number>(0);
  const MIN_VISUAL_PEAK_INTERVAL_MS = 430; // Optimizado para mejor sincronización
  
  // Variable para almacenar valores de señal recientes para análisis
  const recentSignalValues = useRef<number[]>([]);
  const MAX_SIGNAL_HISTORY = 20;
  
  // Ventana deslizante para detección de picos más precisa
  const signalWindow = useRef<number[]>([]);
  const SIGNAL_WINDOW_SIZE = 8; // Reducido para mejor respuesta
  
  // Umbral adaptativo para detección de picos
  const peakThreshold = useRef<number>(0.6);
  const peakAmplitude = useRef<number>(0);
  
  // Control de picos para evitar duplicados
  const processingPeakLock = useRef<boolean>(false);
  const PEAK_LOCK_TIMEOUT_MS = 300; // Bloqueo temporal para evitar picos duplicados

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

    // Actualizar ventana deslizante para análisis
    signalWindow.current.push(value);
    if (signalWindow.current.length > SIGNAL_WINDOW_SIZE) {
      signalWindow.current.shift();
    }
    
    // Almacenar valores recientes para análisis de tendencias
    recentSignalValues.current.push(value);
    if (recentSignalValues.current.length > MAX_SIGNAL_HISTORY) {
      recentSignalValues.current.shift();
    }
    
    // Análisis previo de la señal para mejor detección de picos
    let enhancedValue = value;
    let isPeakCandidate = false;
    
    if (signalWindow.current.length >= 4) { // Reducido para respuesta más rápida
      // Calcular estadísticas de ventana actual
      const windowValues = [...signalWindow.current];
      const currentValue = windowValues[windowValues.length - 1];
      const previousValues = windowValues.slice(0, windowValues.length - 1);
      
      // Detectar aumento significativo seguido de disminución (patrón de pico)
      const maxPrevValue = Math.max(...previousValues);
      const increaseFactor = currentValue / (maxPrevValue > 0 ? maxPrevValue : 0.1);
      
      // Actualizar umbral adaptativo basado en la amplitud de señal reciente
      if (recentSignalValues.current.length > 8) { // Reducido para respuesta más rápida
        const recentMax = Math.max(...recentSignalValues.current);
        const recentMin = Math.min(...recentSignalValues.current);
        const range = recentMax - recentMin;
        
        // Ajustar amplificación según rango de señal
        if (range > 0.1) {
          peakAmplificationFactor.current = Math.min(5.5, 3.0 + range * 5);
          peakThreshold.current = Math.max(0.4, Math.min(0.8, range * 1.8)); // Más sensible
        }
      }
      
      // Actualizar amplitud de pico observada
      if (currentValue > peakAmplitude.current) {
        peakAmplitude.current = currentValue * 0.9 + peakAmplitude.current * 0.1; // Actualización más rápida
      } else {
        peakAmplitude.current = currentValue * 0.1 + peakAmplitude.current * 0.9; // Decae lentamente
      }
    }

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

    // Aplicar efecto látigo a los picos con detección mejorada y sincronización con audio
    let enhancedValue2 = value;
    let isPeak = false; // Por defecto asumimos que no hay pico
    
    // PASO 1: Verificar si tenemos un pico real del procesador
    if (result.isPeak) {
      // Verificar bloqueo de procesamiento para evitar duplicados
      if (!processingPeakLock.current) {
        // Verificar si el pico está suficientemente espaciado del último pico reportado
        const timeSinceLastReportedPeak = now - lastReportedPeakTime.current;
        
        if (timeSinceLastReportedPeak >= MIN_VISUAL_PEAK_INTERVAL_MS) {
          // Iniciar bloqueo para evitar picos duplicados
          processingPeakLock.current = true;
          setTimeout(() => {
            processingPeakLock.current = false;
          }, PEAK_LOCK_TIMEOUT_MS);
          
          // Amplificar significativamente el pico para efecto más pronunciado
          enhancedValue2 = value * peakAmplificationFactor.current;
          lastPeakTime.current = now;
          lastReportedPeakTime.current = now;
          
          // Este es un pico válido que debe mostrarse
          isPeak = true;
          
          console.log('useHeartBeatProcessor: Pico válido detectado', {
            value,
            enhancedValue: enhancedValue2,
            timeSinceLastPeak: timeSinceLastReportedPeak,
            timestamp: new Date().toISOString()
          });
        } else {
          // Este es un pico demasiado cercano al anterior, lo ignoramos visualmente
          // pero mantenemos el procesamiento de audio
          isPeak = false;
          
          console.log('useHeartBeatProcessor: Pico ignorado (demasiado cercano)', {
            value,
            timeSinceLastPeak: timeSinceLastReportedPeak,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('useHeartBeatProcessor: Pico bloqueado por procesamiento previo');
      }
    } else if (lastPeakTime.current) {
      // PASO 2: Aplicar efecto látigo si no es un pico pero estamos cerca de uno
      // Calcular tiempo desde el último pico
      const timeSincePeak = now - lastPeakTime.current;
      
      // Aplicar caída progresiva para efecto látigo (más rápido al inicio, luego más lento)
      if (timeSincePeak < 220) { // 220ms de caída rápida (antes 250)
        const decayFactor = Math.pow(peakDecayRate.current, timeSincePeak / 15); // Más rápido
        enhancedValue2 = value * (1 + (peakAmplificationFactor.current - 1) * decayFactor);
      }
    }
    
    // Actualizar el valor filtrado con nuestro valor amplificado
    result.filteredValue = enhancedValue2;

    console.log('useHeartBeatProcessor - resultado:', {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: isPeak, // Usando nuestro isPeak controlado
      enhancedValue: enhancedValue2,
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
        filteredValue: enhancedValue2, // Usar valor mejorado
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
      isPeak: isPeak, // Usar nuestro isPeak controlado
      filteredValue: enhancedValue2, // Usar valor mejorado
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
    lastReportedPeakTime.current = 0;
    peakAmplitude.current = 0;
    signalWindow.current = [];
    recentSignalValues.current = [];
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

  // Adición para obtener los datos RR para compatibilidad API
  const getRRIntervals = useCallback(() => {
    if (processorRef.current) {
      return processorRef.current.getRRIntervals();
    }
    return { intervals: [], lastPeakTime: null };
  }, []);

  return {
    currentBPM,
    confidence,
    signalQuality,
    processSignal,
    reset,
    setArrhythmiaState,
    getRRIntervals
  };
};
