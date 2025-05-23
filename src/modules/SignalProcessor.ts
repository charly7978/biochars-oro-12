
// Updated wrapper to use the new UnifiedSignalProcessor
import { UnifiedSignalProcessor } from './signal-processing/UnifiedSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Use the unified processor directly
export class PPGSignalProcessor extends UnifiedSignalProcessor {
  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    console.log("PPGSignalProcessor: Using unified real-world processor", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
    });
    
    super(onSignalReady, onError);
  }
  
  async initialize(): Promise<void> {
    console.log("PPGSignalProcessor: Initialize - ready to process");
    // No complex initialization needed
  }

  async calibrate(): Promise<boolean> {
    console.log("PPGSignalProcessor: Calibrate - no artificial calibration needed");
    return true;
  }
}

// Re-export types
export * from './signal-processing/types';
