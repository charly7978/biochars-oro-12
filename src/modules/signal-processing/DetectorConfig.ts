
/**
 * Configuration constants for the adaptive detector
 */
export const DETECTOR_CONFIG = {
  // History and threshold settings
  HISTORY_SIZE: 10,
  CONFIDENCE_THRESHOLD: 0.35,
  MIN_CONSECUTIVE_DETECTIONS: 2,
  MAX_CONSECUTIVE_NON_DETECTIONS: 3,
  
  // Signal strength limits
  MIN_SIGNAL_STRENGTH: 70,
  MAX_SIGNAL_STRENGTH: 170,
  
  // Baseline recalibration
  BASELINE_RECALIBRATION_FRAMES: 60,
  
  // Biological parameters - adjusted for human finger detection
  BIOLOGICAL_RED_MIN: 75,
  BIOLOGICAL_RED_MAX: 175,
  RED_TO_GREEN_RATIO_MIN: 1.1,
  RED_TO_GREEN_RATIO_MAX: 2.2,
  MIN_TEXTURE_FOR_BIOLOGICAL: 0.15,
  MIN_STABILITY_FOR_BIOLOGICAL: 0.4,
  MAX_BRIGHTNESS_VARIATION: 0.25,
  
  // Default adaptive thresholds
  DEFAULT_ADAPTIVE_THRESHOLDS: { min: 60, max: 180 }
} as const;
