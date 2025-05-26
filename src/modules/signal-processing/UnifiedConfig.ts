
/**
 * Configuración unificada para todo el sistema PPG
 * Basada en literatura médica y optimizada para dedos humanos reales
 */
export const UNIFIED_PPG_CONFIG = {
  // Umbrales científicos para detección de dedo humano
  FINGER_DETECTION: {
    MIN_RED_INTENSITY: 85,        // Mínimo para perfusión sanguínea visible
    MAX_RED_INTENSITY: 155,       // Máximo antes de saturación
    MIN_R_TO_G_RATIO: 1.15,      // Ratio hemoglobina mínimo
    MAX_R_TO_G_RATIO: 1.95,      // Ratio hemoglobina máximo
    MIN_PERFUSION_INDEX: 0.02,   // Índice de perfusión mínimo
    MAX_PERFUSION_INDEX: 15.0,   // Índice de perfusión máximo
    MIN_SKIN_TEXTURE: 0.03,      // Textura mínima de piel humana
    MIN_TEMPORAL_STABILITY: 0.4  // Estabilidad temporal mínima
  },
  
  // Parámetros de calibración automática
  CALIBRATION: {
    FRAMES_REQUIRED: 12,         // Frames para calibración inicial
    NOISE_PERCENTILE: 5,         // Percentil para ruido de fondo
    ADAPTATION_RATE: 0.05,       // Velocidad de adaptación
    RESET_THRESHOLD: 50          // Frames sin señal para reset
  },
  
  // Filtros anti-artificiales
  ARTIFACT_REJECTION: {
    MAX_LED_INTENSITY: 180,      // Rechazo de LEDs
    MAX_UNIFORMITY: 0.85,        // Rechazo de superficies uniformes
    MIN_COLOR_VARIANCE: 8,       // Varianza mínima de color
    MAX_TEMPORAL_STABILITY: 0.95 // Estabilidad máxima (artificial)
  },
  
  // Calidad de señal médica
  SIGNAL_QUALITY: {
    SNR_EXCELLENT: 15,           // SNR para calidad excelente
    SNR_GOOD: 8,                 // SNR para calidad buena
    SNR_FAIR: 4,                 // SNR para calidad aceptable
    STABILITY_WEIGHT: 0.3,       // Peso de estabilidad en calidad
    PERFUSION_WEIGHT: 0.4,       // Peso de perfusión en calidad
    TEMPORAL_WEIGHT: 0.3         // Peso de consistencia temporal
  },
  
  // Procesamiento de frames optimizado
  FRAME_PROCESSING: {
    ROI_SIZE_FACTOR: 0.35,       // Factor de tamaño de ROI
    SAMPLING_STEP: 2,            // Paso de muestreo para optimización
    TEXTURE_GRID_SIZE: 8,        // Tamaño de grid para textura
    HISTORY_SIZE: 15             // Tamaño de historial temporal
  },
  
  // Estados de detección con histéresis
  DETECTION_STATES: {
    MIN_CONSECUTIVE_ON: 2,       // Mínimo para activar detección
    MAX_CONSECUTIVE_OFF: 4,      // Máximo para desactivar detección
    CONFIDENCE_THRESHOLD: 0.7    // Umbral de confianza
  }
} as const;

export type UnifiedPPGConfig = typeof UNIFIED_PPG_CONFIG;
