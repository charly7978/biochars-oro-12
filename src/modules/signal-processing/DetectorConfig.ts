
/**
 * Configuration constants for the adaptive detector
 */
export const DETECTOR_CONFIG = {
  // History and threshold settings - more selective
  HISTORY_SIZE: 10,
  CONFIDENCE_THRESHOLD: 0.35, // Threshold más equilibrado
  MIN_CONSECUTIVE_DETECTIONS: 3, // Más frames consecutivos requeridos
  MAX_CONSECUTIVE_NON_DETECTIONS: 4,
  
  // Signal strength limits - más estricto para evitar ruido
  MIN_SIGNAL_STRENGTH: 75, // Aumentado para evitar ruido de fondo
  MAX_SIGNAL_STRENGTH: 165, // Reducido para evitar sobre-saturación
  
  // Baseline recalibration
  BASELINE_RECALIBRATION_FRAMES: 60,
  
  // Biological parameters - equilibrados para dedo humano real
  BIOLOGICAL_RED_MIN: 80, // Más estricto que antes
  BIOLOGICAL_RED_MAX: 160, // Más conservador
  RED_TO_GREEN_RATIO_MIN: 1.1, // Más estricto
  RED_TO_GREEN_RATIO_MAX: 2.2, // Más conservador
  MIN_TEXTURE_FOR_BIOLOGICAL: 0.15, // Más selectivo
  MIN_STABILITY_FOR_BIOLOGICAL: 0.4, // Más estricto
  MAX_BRIGHTNESS_VARIATION: 0.25, // Más estricto
  
  // Default adaptive thresholds - más conservadores
  DEFAULT_ADAPTIVE_THRESHOLDS: { min: 75, max: 165 }
} as const;
