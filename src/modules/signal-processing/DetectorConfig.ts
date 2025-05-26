
/**
 * Configuration constants for the adaptive detector
 */
export const DETECTOR_CONFIG = {
  // History and threshold settings
  HISTORY_SIZE: 10,
  CONFIDENCE_THRESHOLD: 0.25, // Más sensible para dedo humano
  MIN_CONSECUTIVE_DETECTIONS: 2,
  MAX_CONSECUTIVE_NON_DETECTIONS: 3,
  
  // Signal strength limits - más amplio para dedo humano
  MIN_SIGNAL_STRENGTH: 60,
  MAX_SIGNAL_STRENGTH: 180,
  
  // Baseline recalibration
  BASELINE_RECALIBRATION_FRAMES: 60,
  
  // Biological parameters - sensibilizado para dedo humano
  BIOLOGICAL_RED_MIN: 65, // Más sensible
  BIOLOGICAL_RED_MAX: 185, // Más amplio
  RED_TO_GREEN_RATIO_MIN: 1.0, // Más permisivo
  RED_TO_GREEN_RATIO_MAX: 2.5, // Más amplio
  MIN_TEXTURE_FOR_BIOLOGICAL: 0.10, // Más sensible
  MIN_STABILITY_FOR_BIOLOGICAL: 0.3, // Más permisivo
  MAX_BRIGHTNESS_VARIATION: 0.3, // Más permisivo
  
  // Default adaptive thresholds - ampliados para dedo humano
  DEFAULT_ADAPTIVE_THRESHOLDS: { min: 50, max: 190 }
} as const;
