
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
  // New field to track consecutive quality readings
  qualityReadings: number[];
}

export const createInitialSignalQualityState = (): SignalQualityState => ({
  sensitivityLevel: INITIAL_SENSITIVITY_LEVEL,
  consistentSignalCounter: 0,
  noFingerFrameCount: 0,
  signalHistory: [],
  lastFrameProcessedTime: Date.now(),
  qualityReadings: []
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
  
  // Track quality readings for stable detection
  newState.qualityReadings.push(signalQuality);
  if (newState.qualityReadings.length > 8) {
    newState.qualityReadings.shift();
  }
  
  // Calculate average quality from recent readings for stability
  const avgQuality = newState.qualityReadings.length > 0 
    ? newState.qualityReadings.reduce((sum, q) => sum + q, 0) / newState.qualityReadings.length 
    : 0;

  // Adaptive sensitivity adjustment based on signal history with improved algorithm
  if (newState.signalHistory.length >= 5) {
    const recent = newState.signalHistory.slice(-5);
    const avg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recent.length;
    
    // More responsive sensitivity adjustment based on signal variance
    if (variance < 0.008) {
      // Very stable signal - reduce sensitivity slightly for better peaks
      newState.sensitivityLevel = Math.min(4.2, newState.sensitivityLevel * 1.04);
    } else if (variance > 0.12) {
      // Volatile signal - increase sensitivity more aggressively
      newState.sensitivityLevel = Math.max(1.4, newState.sensitivityLevel * 0.92);
    } else if (variance > 0.05) {
      // Moderately volatile - adjust sensitivity slightly
      newState.sensitivityLevel = Math.max(1.8, newState.sensitivityLevel * 0.98);
    }
  }

  // Enhanced progressive quality assessment
  let effectiveFingerDetected = fingerDetected;
  
  // If finger is detected and signal quality is above threshold, increase consistent signal counter
  if (fingerDetected && signalQuality > MIN_QUALITY_THRESHOLD) {
    // More responsive increase for good quality signals
    const qualityFactor = Math.min(1.5, signalQuality / 50);
    newState.consistentSignalCounter = Math.min(12, newState.consistentSignalCounter + qualityFactor);
    newState.noFingerFrameCount = 0;
  } 
  // If finger is not detected, increase no-finger frame count
  else if (!fingerDetected) {
    newState.noFingerFrameCount++;
    
    // More gradual reduction based on how long finger has been detected previously
    if (newState.noFingerFrameCount > 2) {
      const reductionRate = newState.consistentSignalCounter > 8 ? 0.3 : 0.6;
      newState.consistentSignalCounter = Math.max(0, newState.consistentSignalCounter - reductionRate);
    }
    
    // Override finger detection based on history for stability with higher threshold
    // for more confidence when overriding the raw detection
    if (newState.consistentSignalCounter > 6 && avgQuality > MIN_QUALITY_THRESHOLD * 0.7) {
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
