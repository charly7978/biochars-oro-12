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

export interface PPGValues {
  red: number;
  ir: number; 
  ambient: number;
}

export interface VitalSignsResult {
  heartRate: number;
  spo2: number;
  pressure: string;
  glucose?: number;
  lipids?: {
    total: number;
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
