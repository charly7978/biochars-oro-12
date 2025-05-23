
/**
 * Signal quality assessment for heart beat monitoring
 */

import { 
  MAX_SIGNAL_HISTORY,
  SIGNAL_WINDOW_SIZE,
  INITIAL_SENSITIVITY_LEVEL
} from './constants';
import { updateSlidingWindow } from './utils/signal-utils';

interface SignalQualityState {
  recentSignalValues: number[];
  signalWindow: number[];
  peakThreshold: number;
  peakAmplitude: number;
  sensitivityLevel: number;
  consistentSignalCounter: number;
}

interface SignalQualityResult {
  state: SignalQualityState;
  effectiveFingerDetected: boolean;
}

/**
 * Assess signal quality and adjust sensitivity parameters
 * @param value Current signal value
 * @param currentQuality Current quality assessment
 * @param result Processor result with confidence data
 * @param state Signal quality tracking state
 * @param fingerDetected Whether finger is detected
 * @returns Updated state and effective finger detection status
 */
export const assessSignalQuality = (
  value: number,
  currentQuality: number,
  result: { confidence: number },
  state: SignalQualityState,
  fingerDetected: boolean = true,
  detectionAttempts: number = 0
): SignalQualityResult => {
  const newState = { ...state };
  
  // Update signal history
  newState.recentSignalValues = updateSlidingWindow(
    state.recentSignalValues,
    value,
    MAX_SIGNAL_HISTORY
  );
  
  // Update signal window
  newState.signalWindow = updateSlidingWindow(
    state.signalWindow,
    value,
    SIGNAL_WINDOW_SIZE
  );
  
  // Dynamic sensitivity adjustment
  if (fingerDetected && newState.recentSignalValues.length > 5) {
    const recentMax = Math.max(...newState.recentSignalValues);
    const recentMin = Math.min(...newState.recentSignalValues);
    const range = recentMax - recentMin;
    
    // Ultra aggressive sensitivity adjustments
    if (range > 0.005) {
      newState.sensitivityLevel = Math.min(4.0, state.sensitivityLevel * 1.25);
      newState.consistentSignalCounter++;
    } else if (range < 0.004) {
      newState.sensitivityLevel = Math.max(1.8, state.sensitivityLevel * 0.98);
      newState.consistentSignalCounter = Math.max(0, state.consistentSignalCounter - 1);
    }
    
    // Adaptive threshold adjustment
    if (range > 0.02) {
      newState.peakThreshold = Math.max(0.08, Math.min(0.35, range * (2.0 * newState.sensitivityLevel)));
    } else {
      // For weak signals, be much more sensitive
      newState.peakThreshold = Math.max(0.05, Math.min(0.2, 0.15 * newState.sensitivityLevel));
    }
    
    // More frequent logging for better monitoring
    if (detectionAttempts % 15 === 0) {
      console.log('signal-quality: Ajuste ultra adaptativo', {
        sensibilidad: newState.sensitivityLevel.toFixed(2),
        umbralPico: newState.peakThreshold.toFixed(2),
        rangoSeñal: range.toFixed(3),
        señalesConsistentes: newState.consistentSignalCounter
      });
    }
  }
  
  // Update peak amplitude with greater weight to strong signals
  if (value > state.peakAmplitude) {
    newState.peakAmplitude = value * 0.6 + state.peakAmplitude * 0.4;
  } else {
    newState.peakAmplitude = value * 0.15 + state.peakAmplitude * 0.85;
  }
  
  // Determine effective finger detection
  const effectiveFingerDetected = fingerDetected || 
                                  (currentQuality > MIN_QUALITY_THRESHOLD * 0.7 && 
                                  result.confidence > 0.1 && 
                                  state.consistentSignalCounter > 1);
  
  return {
    state: newState,
    effectiveFingerDetected
  };
};

/**
 * Create initial state for signal quality assessment
 */
export const createInitialSignalQualityState = (): SignalQualityState => ({
  recentSignalValues: [],
  signalWindow: [],
  peakThreshold: 0.15,
  peakAmplitude: 0,
  sensitivityLevel: INITIAL_SENSITIVITY_LEVEL,
  consistentSignalCounter: 0
});
