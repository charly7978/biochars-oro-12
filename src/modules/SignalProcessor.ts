
import { PPGSignalProcessor } from './signal-processing/PPGSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Restored original signal processor with torch fix
export class PPGSignalProcessor extends PPGSignalProcessor {
  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    console.log("PPGSignalProcessor: Using original advanced processor", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
    });
    
    super(onSignalReady, onError);
  }
}

// Re-export types
export * from './signal-processing/types';
