import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

export interface SignalMetrics {
  snr: number;
  stability: number;
  quality: number;
}

export interface OptimizationChannel {
  signal: number[];
  noise: number[];
}

export interface PPGFrame {
  timestamp: number;
  values: number[];
  quality?: number;
}

export interface VitalSignsResult {
  heartRate: number;
  spo2: number;
  pressure: string;
  glucose?: number;
  lipids?: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin?: number;
  quality: number;
  arrhythmiaDetected?: boolean;
}

declare global {
  interface Window {
    heartBeatProcessor: HeartBeatProcessor;
  }
}
    hdl: number;
  };
  hemoglobin?: number;
}

export interface SignalQuality {
  overallQuality: number;
  noiseLevel: number;
  stabilityScore: number;
  isValid: boolean;
}

declare global {
  interface Window {
    heartBeatProcessor: HeartBeatProcessor;
  }
}
