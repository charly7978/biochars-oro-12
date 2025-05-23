
/**
 * Types for the heart beat processing system
 */

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  signalQuality?: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export interface RRIntervalsData {
  intervals: number[];
  lastPeakTime: number | null;
}
