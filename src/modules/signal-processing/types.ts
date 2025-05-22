
export interface DetectorScores {
  redChannel: number;
  stability: number;
  pulsatility: number;
  biophysical: number;
  periodicity: number;
  textureScore?: number;
}

export interface DetectionResult {
  isFingerDetected: boolean;
  quality: number;
  detectorDetails: DetectorScores & {
    avgQuality: number;
    consecutiveDetections: number;
    consecutiveNoDetections: number;
    rearCamera?: boolean;
    fingerBorderDetected?: boolean;
    edgeScore?: number;
    textureConsistency?: number;
  };
}

export interface FrameData {
  redValue: number;
  textureScore: number;
  rToGRatio: number;
  rToBRatio: number;
  avgRed?: number;
  avgGreen?: number;
  avgBlue?: number;
  edgeValue?: number; // Nuevo: valor de detección de bordes
}

export interface SignalProcessorConfig {
  BUFFER_SIZE: number;
  MIN_RED_THRESHOLD: number;
  MAX_RED_THRESHOLD: number;
  STABILITY_WINDOW: number;
  MIN_STABILITY_COUNT: number;
  HYSTERESIS: number;
  MIN_CONSECUTIVE_DETECTIONS: number;
  MAX_CONSECUTIVE_NO_DETECTIONS: number;
  QUALITY_LEVELS: number;
  QUALITY_HISTORY_SIZE: number;
  CALIBRATION_SAMPLES: number;
  TEXTURE_GRID_SIZE: number;
  ROI_SIZE_FACTOR: number;
}

export interface CalibrationValues {
  baselineRed: number;
  baselineVariance: number;
  minRedThreshold: number;
  maxRedThreshold: number;
  isCalibrated: boolean;
}
