import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;
  debugInfo?: {
    avgRed?: number;
    avgGreen?: number;
    avgBlue?: number;
    rgRatio?: number;
    rbRatio?: number;
    redDominanceScore?: number;
    pulsatilityScore?: number;
    stabilityScore?: number;
    rejectionReasons?: string[];
    acceptanceReasons?: string[];
    dbgSpectralConfidence?: number;
    dbgPulsatilityScore?: number;
    dbgStabilityScore?: number;
    dbgRawQuality?: number;
    [key: string]: any;
  };
  calibrationPhase?: string;
  calibrationProgress?: number;
  calibrationInstructions?: string;
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

export interface SignalProcessor {
  initialize: () => Promise<void>;
  start: () => void;
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
