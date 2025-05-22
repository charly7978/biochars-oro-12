
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
  const peakAmplificationFactor = useRef<number>(4.5);
  const peakDecayRate = useRef<number>(0.65);
  const lastPeakTime = useRef<number | null>(null);
  
  // Umbral de calidad mínima para procesar
  const MIN_QUALITY_THRESHOLD = 5;
  
  // Variables para sincronización de picos visuales con audio
  const lastReportedPeakTime = useRef<number>(0);
  const MIN_VISUAL_PEAK_INTERVAL_MS = 500; // Ajustado para captar latidos más lentos con mayor precisión
  
  // Variable para almacenar valores de señal recientes para análisis
  const recentSignalValues = useRef<number[]>([]);
  const MAX_SIGNAL_HISTORY = 20;
  
  // Ventana deslizante para detección de picos más precisa
  const signalWindow = useRef<number[]>([]);
  const SIGNAL_WINDOW_SIZE = 10; // Aumentado para mejor análisis de tendencia
  
  // Umbral adaptativo para detección de picos
  const peakThreshold = useRef<number>(0.5); // Más sensible para captar señales débiles
  const peakAmplitude = useRef<number>(0);
  
  // Control estricto de picos para evitar duplicados
  const processingPeakLock = useRef<boolean>(false);
  const PEAK_LOCK_TIMEOUT_MS = 350; // Tiempo de bloqueo ajustado para latidos normales

  // Nuevo: Control de sensibilidad adaptativo
  const sensitivityLevel = useRef<number>(1.0); // Nivel base de sensibilidad
  const lastValidPeakValue = useRef<number>(0); // Último valor de pico válido
  const consistentSignalCounter = useRef<number>(0); // Contador para señales consistentes

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

    // Actualizar ventana deslizante para análisis de tendencias
    signalWindow.current.push(value);
    if (signalWindow.current.length > SIGNAL_WINDOW_SIZE) {
      signalWindow.current.shift();
    }
    
    // Almacenar valores recientes para análisis
    recentSignalValues.current.push(value);
    if (recentSignalValues.current.length > MAX_SIGNAL_HISTORY) {
      recentSignalValues.current.shift();
    }
    
    // Análisis de tendencias para mejor detección de picos genuinos
    let isPeakCandidate = false;
    
    if (signalWindow.current.length >= 5) { 
      // Calcular estadísticas de ventana actual
      const windowValues = [...signalWindow.current];
      const currentValue = windowValues[windowValues.length - 1];
      const previousValues = windowValues.slice(0, windowValues.length - 1);
      
      // Ajuste dinámico de sensibilidad basado en la calidad de la señal
      if (fingerDetected && recentSignalValues.current.length > 10) {
        const recentMax = Math.max(...recentSignalValues.current);
        const recentMin = Math.min(...recentSignalValues.current);
        const range = recentMax - recentMin;
        
        // Si la señal es estable aumentar sensibilidad, si es errática reducirla
        if (range > 0.05) {
          // Para señales fuertes con buena variación, aumentar sensibilidad
          sensitivityLevel.current = Math.min(1.5, sensitivityLevel.current * 1.05);
          consistentSignalCounter.current++;
        } else if (range < 0.02) {
          // Para señales con poca variación, reducir sensibilidad
          sensitivityLevel.current = Math.max(0.7, sensitivityLevel.current * 0.95);
          consistentSignalCounter.current = 0;
        }
        
        // Ajustar umbral adaptativo según rango y sensibilidad
        if (range > 0.1) {
          peakThreshold.current = Math.max(0.25, Math.min(0.6, range * (1.2 * sensitivityLevel.current)));
        } else {
          // Con señales débiles ser más sensible
          peakThreshold.current = Math.max(0.15, Math.min(0.4, 0.3 * sensitivityLevel.current));
        }
        
        // Log para debug cada 50 frames
        if (detectionAttempts.current % 50 === 0) {
          console.log('useHeartBeatProcessor: Ajuste adaptativo', {
            sensibilidad: sensitivityLevel.current.toFixed(2),
            umbralPico: peakThreshold.current.toFixed(2),
            rangoSeñal: range.toFixed(3),
            señalesConsistentes: consistentSignalCounter.current
          });
        }
      }
      
      // Actualizar amplitud de pico observada con mayor peso a señales fuertes
      if (value > peakAmplitude.current) {
        peakAmplitude.current = value * 0.35 + peakAmplitude.current * 0.65; // Peso para alzas
      } else {
        peakAmplitude.current = value * 0.05 + peakAmplitude.current * 0.95; // Mayor inercia para bajadas
      }
    }

    // Procesar señal con HeartBeatProcessor
    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    const currentQuality = result.signalQuality || 0;
    
    // Actualizar el estado de calidad de señal
    setSignalQuality(currentQuality);

    // Verificación de picos mejorada para coherencia con audio
    let isPeak = false;
    
    // PASO 1: Verificar si tenemos un pico real del procesador y calidad suficiente
    if (result.isPeak && currentQuality > MIN_QUALITY_THRESHOLD * 0.8) {
      // Solo procesar picos si no estamos en periodo de bloqueo
      if (!processingPeakLock.current) {
        const timeSinceLastReportedPeak = now - lastReportedPeakTime.current;
        
        // Ajuste dinámico del intervalo mínimo según BPM detectado
        const minAcceptablePeakInterval = currentBPM > 0 
          ? Math.max(250, Math.min(600, 60000 / (currentBPM * 1.3))) // Más flexible para captar variaciones
          : MIN_VISUAL_PEAK_INTERVAL_MS;
        
        if (timeSinceLastReportedPeak >= minAcceptablePeakInterval) {
          // Iniciar bloqueo para evitar picos duplicados
          processingPeakLock.current = true;
          setTimeout(() => {
            processingPeakLock.current = false;
          }, PEAK_LOCK_TIMEOUT_MS);
          
          // Registrar tiempo del pico válido
          lastPeakTime.current = now;
          lastReportedPeakTime.current = now;
          lastValidPeakValue.current = value;
          
          // Este es un pico válido que debe mostrarse y sonar
          isPeak = true;
          
          console.log('useHeartBeatProcessor: Pico válido detectado - LATIDO REAL', {
            value: value.toFixed(3),
            umbral: peakThreshold.current.toFixed(2),
            intervaloDesdeUltimoPico: timeSinceLastReportedPeak,
            equivalenteBPM: Math.round(60000 / timeSinceLastReportedPeak),
            calidad: currentQuality,
            timestamp: new Date(now).toISOString().substr(11, 12) // Solo hora:min:seg.ms
          });
        } else {
          // Ignorar picos demasiado cercanos - no pueden ser latidos humanos reales
          isPeak = false;
          
          console.log('useHeartBeatProcessor: Pico ignorado (demasiado cercano para ser latido real)', {
            timeSinceLastPeak: timeSinceLastReportedPeak,
            umbralTiempo: minAcceptablePeakInterval,
            timestamp: new Date(now).toISOString().substr(11, 12)
          });
        }
      } else {
        console.log('useHeartBeatProcessor: Pico bloqueado por procesamiento previo');
      }
    }
    
    // Si no hay dedo detectado pero tenemos una señal de calidad razonable
    // consideramos que el dedo está presente (corrige falsos negativos)
    const effectiveFingerDetected = fingerDetected || 
                                   (currentQuality > MIN_QUALITY_THRESHOLD && 
                                    result.confidence > 0.25 && 
                                    consistentSignalCounter.current > 5);
    
    // Si no hay dedo detectado efectivamente, reducir los valores
    if (!effectiveFingerDetected) {
      // Reducir gradualmente los valores actuales
      if (currentBPM > 0) {
        const reducedBPM = Math.max(0, currentBPM - 3); // Decaimiento más lento
        const reducedConfidence = Math.max(0, confidence - 0.05); // Decaimiento más lento
        setCurrentBPM(reducedBPM);
        setConfidence(reducedConfidence);
        sensitivityLevel.current = 1.0; // Resetear sensibilidad al perder el dedo
        consistentSignalCounter.current = 0;
      }
      
      return {
        bpm: currentBPM,
        confidence: Math.max(0, confidence - 0.05),
        isPeak: false,
        filteredValue: value,
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
    if (result.confidence >= 0.4 && result.bpm > 30 && result.bpm < 220) {
      console.log('useHeartBeatProcessor - Actualizando BPM y confianza', {
        prevBPM: currentBPM,
        newBPM: result.bpm,
        prevConfidence: confidence,
        newConfidence: result.confidence,
        sessionId: sessionId.current,
        timestamp: new Date().toISOString().substr(11, 12)
      });
      
      // Aplicar un suavizado para evitar cambios bruscos en BPM reportado
      const smoothedBPM = currentBPM > 0 
        ? currentBPM * 0.7 + result.bpm * 0.3 
        : result.bpm;
      
      setCurrentBPM(Math.round(smoothedBPM));
      setConfidence(result.confidence);
    }

    // Devolver resultado con isPeak controlado para sincronización con beeps
    return {
      ...result,
      isPeak: isPeak, // Usar nuestro isPeak controlado para que coincida exactamente con los beeps
      filteredValue: value,
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
