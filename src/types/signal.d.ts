import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

export interface PPGFrame {
  data: Uint8Array;
  width: number;
  height: number;
  timestamp: number;
}

export interface OptimizedSignal {
  cleanSignal: number;
  quality: number;
  metrics: {
    amplitude: number;
    frequency: number;
    noiseLevel: number;
    perfusionIndex: number;
  };
  feedback: {
    signalStrength: number;
    noiseLevel: number;
    isValid: boolean;
  };
}

declare global {
  interface Window {
    heartBeatProcessor: HeartBeatProcessor;
  }
}
  stop: () => void;
  calibrate: () => Promise<boolean>;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

declare global {
  interface Window {
    heartBeatProcessor: HeartBeatProcessor;
  }
}
