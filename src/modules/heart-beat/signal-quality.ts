
/**
 * Signal quality assessment and management
 */
import { MIN_QUALITY_THRESHOLD, INITIAL_SENSITIVITY_LEVEL } from './constants';

export interface SignalQualityState {
  sensitivityLevel: number;
  consistentSignalCounter: number;
  noFingerFrameCount: number;
  signalHistory: number[];
  lastFrameProcessedTime: number;
}

export const createInitialSignalQualityState = (): SignalQualityState => ({
  sensitivityLevel: INITIAL_SENSITIVITY_LEVEL,
  consistentSignalCounter: 0,
  noFingerFrameCount: 0,
  signalHistory: [],
  lastFrameProcessedTime: Date.now()
});

/**
 * Assess signal quality and adjust sensitivity
 * @param value Current signal value
 * @param signalQuality Current signal quality
 * @param context Context data including confidence
 * @param state Signal quality state
 * @param fingerDetected Whether a finger is detected
 * @param detectionAttempts Number of detection attempts
 * @returns Assessment result with updated state
 */
export const assessSignalQuality = (
  value: number,
  signalQuality: number,
  context: { confidence: number },
  state: SignalQualityState,
  fingerDetected: boolean,
  detectionAttempts: number
): {
  effectiveFingerDetected: boolean;
  state: SignalQualityState;
} => {
  const now = Date.now();
  const newState = { ...state };
  
  // Track signal history for trend analysis
  newState.signalHistory.push(value);
  if (newState.signalHistory.length > 10) {
    newState.signalHistory.shift();
  }

  // Adaptive sensitivity adjustment based on signal history
  if (newState.signalHistory.length >= 5) {
    const recent = newState.signalHistory.slice(-5);
    const avg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recent.length;
    
    // Adjust sensitivity based on signal variance
    if (variance < 0.01) {
      // Very stable signal - reduce sensitivity slightly
      newState.sensitivityLevel = Math.min(4.0, newState.sensitivityLevel * 1.02);
    } else if (variance > 0.1) {
      // Volatile signal - increase sensitivity
      newState.sensitivityLevel = Math.max(1.5, newState.sensitivityLevel * 0.95);
    }
  }

  // Progressive quality assessment
  let effectiveFingerDetected = fingerDetected;
  
  // If finger is detected and signal quality is above threshold, increase consistent signal counter
  if (fingerDetected && signalQuality > MIN_QUALITY_THRESHOLD) {
    newState.consistentSignalCounter = Math.min(10, newState.consistentSignalCounter + 1);
    newState.noFingerFrameCount = 0;
  } 
  // If finger is not detected, increase no-finger frame count
  else if (!fingerDetected) {
    newState.noFingerFrameCount++;
    
    // Gradual reduction of consistent signal counter when no finger detected
    if (newState.noFingerFrameCount > 3) {
      newState.consistentSignalCounter = Math.max(0, newState.consistentSignalCounter - 0.5);
    }
    
    // Override finger detection based on history for stability
    if (newState.consistentSignalCounter > 5) {
      effectiveFingerDetected = true;
    }
  }
  
  // Update last frame processed time
  newState.lastFrameProcessedTime = now;

  return {
    effectiveFingerDetected,
    state: newState
  };
};
