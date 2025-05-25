
import { MIN_QUALITY_THRESHOLD, PEAK_LOCK_TIMEOUT_MS } from './constants';
import { isValidPeakTiming } from './utils/signal-utils';

/**
 * Logic for peak detection and validation
 */

interface PeakDetectionState {
  processingPeakLock: boolean;
  lastPeakTime: number | null;
  lastReportedPeakTime: number;
  lastValidPeakValue: number;
}

interface PeakDetectionResult {
  isPeak: boolean;
  updatedState: PeakDetectionState;
}

/**
 * Detect and validate a heart beat peak
 * @param value Current signal value
 * @param result Processor result containing quality and confidence data
 * @param state Current peak detection state
 * @param currentBPM Current BPM reading
 * @returns Detection result with updated state
 */
export const detectAndValidatePeak = (
  value: number,
  result: { isPeak: boolean; signalQuality?: number },
  state: PeakDetectionState,
  currentBPM: number
): PeakDetectionResult => {
  const now = Date.now();
  const newState = { ...state };
  let isPeak = false;

  // Only process peaks with minimum quality and not in processing lock
  if (result.isPeak && 
      (result.signalQuality || 0) > MIN_QUALITY_THRESHOLD && 
      !state.processingPeakLock) {
    
    if (isValidPeakTiming(state.lastReportedPeakTime, currentBPM)) {
      // Valid peak detected - update state
      newState.processingPeakLock = true;
      newState.lastPeakTime = now;
      newState.lastReportedPeakTime = now;
      newState.lastValidPeakValue = value;
      isPeak = true;
      
      console.log('peak-detection: Pico válido detectado - LATIDO REAL CONFIRMADO', {
        value: value.toFixed(3),
        calidad: result.signalQuality,
        timestamp: new Date(now).toISOString().substr(11, 12)
      });
      
      // Schedule unlock
      setTimeout(() => {
        newState.processingPeakLock = false;
      }, PEAK_LOCK_TIMEOUT_MS);
    } else {
      console.log('peak-detection: Pico ignorado (demasiado cercano para ser latido real)', {
        timeSinceLastPeak: now - state.lastReportedPeakTime,
        timestamp: new Date(now).toISOString().substr(11, 12)
      });
    }
  } else if (result.isPeak && state.processingPeakLock) {
    console.log('peak-detection: Pico bloqueado por procesamiento previo');
  }

  return {
    isPeak,
    updatedState: newState
  };
};
