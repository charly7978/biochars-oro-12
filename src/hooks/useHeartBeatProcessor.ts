
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { HeartBeatResult } from '../modules/heart-beat/types';
import { 
  MIN_QUALITY_THRESHOLD,
  INITIAL_SENSITIVITY_LEVEL,
  PEAK_AMPLIFICATION_FACTOR,
  PEAK_DECAY_RATE
} from '../modules/heart-beat/constants';
import { detectAndValidatePeak } from '../modules/heart-beat/peak-detection';
import { 
  assessSignalQuality, 
  createInitialSignalQualityState 
} from '../modules/heart-beat/signal-quality';
import { updateBPM, decreaseBPMGradually } from '../modules/heart-beat/bpm-manager';

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [signalQuality, setSignalQuality] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Variables for detection tracking
  const detectionAttempts = useRef<number>(0);
  const lastDetectionTime = useRef<number>(Date.now());
  
  // Variables for whip effect on peaks
  const peakAmplificationFactor = useRef<number>(PEAK_AMPLIFICATION_FACTOR);
  const peakDecayRate = useRef<number>(PEAK_DECAY_RATE);
  const lastPeakTime = useRef<number | null>(null);
  
  // Variables for peak visual sync with audio
  const lastReportedPeakTime = useRef<number>(0);
  
  // Peak detection state
  const peakDetectionState = useRef({
    processingPeakLock: false,
    lastPeakTime: null as number | null,
    lastReportedPeakTime: 0,
    lastValidPeakValue: 0
  });
  
  // Signal quality state
  const signalQualityState = useRef(createInitialSignalQualityState());

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

      // Add event to ensure audio initializes correctly
      const initializeAudio = () => {
        console.log('useHeartBeatProcessor: Inicializando audio por interacción del usuario');
        if (processorRef.current) {
          // This will force audio context creation
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
    
    // Initialize processor if it doesn't exist
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

    // AGGRESSIVE AMPLIFICATION - crucial for very weak signals
    value = value * 2.0;

    // Process signal quality and sensitivity
    const qualityResult = assessSignalQuality(
      value, 
      signalQuality, 
      { confidence }, 
      signalQualityState.current,
      fingerDetected,
      detectionAttempts.current
    );
    signalQualityState.current = qualityResult.state;

    // Process signal with HeartBeatProcessor
    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    const currentQuality = result.signalQuality || 0;
    
    // Update the signal quality state
    setSignalQuality(currentQuality);

    // Enhanced peak validation
    const peakResult = detectAndValidatePeak(
      value, 
      result, 
      peakDetectionState.current, 
      currentBPM
    );
    
    // Update peak detection state
    const isPeak = peakResult.isPeak;
    if (isPeak) {
      peakDetectionState.current = peakResult.updatedState;
      lastPeakTime.current = now;
    }

    // Handle no finger detection
    const effectiveFingerDetected = qualityResult.effectiveFingerDetected;
    if (!effectiveFingerDetected) {
      // Very gradual reduction
      const bpmState = decreaseBPMGradually({ currentBPM, confidence });
      setCurrentBPM(bpmState.currentBPM);
      setConfidence(bpmState.confidence);
      signalQualityState.current.sensitivityLevel = INITIAL_SENSITIVITY_LEVEL;
      signalQualityState.current.consistentSignalCounter = 0;
      
      return {
        bpm: currentBPM,
        confidence: Math.max(0, confidence - 0.02),
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

    // Update last detection time
    lastDetectionTime.current = now;
    
    // Update BPM if confidence is sufficient
    const bpmState = updateBPM(result, { currentBPM, confidence });
    if (bpmState.currentBPM !== currentBPM || bpmState.confidence !== confidence) {
      setCurrentBPM(bpmState.currentBPM);
      setConfidence(bpmState.confidence);
    }

    // Return result with controlled isPeak for synchronization with beeps
    return {
      ...result,
      isPeak, 
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
    signalQualityState.current = createInitialSignalQualityState();
    peakDetectionState.current = {
      processingPeakLock: false,
      lastPeakTime: null,
      lastReportedPeakTime: 0,
      lastValidPeakValue: 0
    };
  }, [currentBPM, confidence]);

  // Ensure that setArrhythmiaState works correctly
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

  // Addition to get RR data for API compatibility
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
