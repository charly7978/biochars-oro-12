
/**
 * BPM calculation and management
 */

interface BPMState {
  currentBPM: number;
  confidence: number;
}

/**
 * Update BPM with smooth transition
 * @param result Processor result containing BPM and confidence
 * @param currentState Current BPM state
 * @returns Updated BPM state
 */
export const updateBPM = (
  result: { bpm: number; confidence: number }, 
  currentState: BPMState
): BPMState => {
  const { currentBPM, confidence } = currentState;
  
  // If the confidence is sufficient, update values with a permissive threshold
  if (result.confidence >= 0.25 && result.bpm > 20 && result.bpm < 260) {
    console.log('bpm-manager: Actualizando BPM y confianza', {
      prevBPM: currentBPM,
      newBPM: result.bpm,
      prevConfidence: confidence,
      newConfidence: result.confidence,
      timestamp: new Date().toISOString().substr(11, 12)
    });
    
    // Apply smoothing to avoid abrupt changes in reported BPM
    const smoothedBPM = currentBPM > 0 
      ? currentBPM * 0.5 + result.bpm * 0.5  // Equal weight to old and new values
      : result.bpm;
    
    return {
      currentBPM: Math.round(smoothedBPM),
      confidence: result.confidence
    };
  }
  
  return currentState;
};

/**
 * Gradually reduce BPM and confidence when no finger is detected
 * @param currentState Current BPM state
 * @returns Updated BPM state
 */
export const decreaseBPMGradually = (currentState: BPMState): BPMState => {
  const { currentBPM, confidence } = currentState;
  
  if (currentBPM > 0) {
    return {
      currentBPM: Math.max(0, currentBPM - 1),  // Very slow decay
      confidence: Math.max(0, confidence - 0.02)  // Very slow decay
    };
  }
  
  return currentState;
};
