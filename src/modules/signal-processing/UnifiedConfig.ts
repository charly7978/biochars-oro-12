
/**
 * Configuración unificada CORREGIDA para todo el sistema PPG
 * Umbrales ajustados para detección real de dedos humanos
 */
export const UNIFIED_PPG_CONFIG = {
  // Umbrales REALISTAS para detección de dedo humano
  FINGER_DETECTION: {
    MIN_RED_INTENSITY: 50,        // Reducido para capturar dedos reales
    MAX_RED_INTENSITY: 200,       // Aumentado para mayor rango
    MIN_R_TO_G_RATIO: 1.05,      // Más tolerante
    MAX_R_TO_G_RATIO: 2.5,       // Más amplio
    MIN_PERFUSION_INDEX: 0.01,   // Más bajo para detectar pulso débil
    MAX_PERFUSION_INDEX: 20.0,   // Más alto para mayor rango
    MIN_SKIN_TEXTURE: 0.02,      // Más bajo para ser menos restrictivo
    MIN_TEMPORAL_STABILITY: 0.2  // Más tolerante
  },
  
  // Parámetros de calibración automática AJUSTADOS
  CALIBRATION: {
    FRAMES_REQUIRED: 8,          // Reducido para calibración más rápida
    NOISE_PERCENTILE: 10,        // Aumentado para mejor estimación
    ADAPTATION_RATE: 0.08,       // Más rápida adaptación
    RESET_THRESHOLD: 30          // Menos frames para reset
  },
  
  // Filtros anti-artificiales RELAJADOS
  ARTIFACT_REJECTION: {
    MAX_LED_INTENSITY: 220,      // Más alto para LEDs potentes
    MAX_UNIFORMITY: 0.90,        // Más tolerante
    MIN_COLOR_VARIANCE: 5,       // Más bajo para capturar variación sutil
    MAX_TEMPORAL_STABILITY: 0.98 // Más tolerante
  },
  
  // Calidad de señal médica AJUSTADA
  SIGNAL_QUALITY: {
    SNR_EXCELLENT: 12,           // Más realista
    SNR_GOOD: 6,                 // Más bajo
    SNR_FAIR: 3,                 // Más accesible
    STABILITY_WEIGHT: 0.25,      // Menos peso a estabilidad
    PERFUSION_WEIGHT: 0.45,      // Más peso a perfusión
    TEMPORAL_WEIGHT: 0.3         // Peso moderado a temporal
  },
  
  // Procesamiento de frames optimizado
  FRAME_PROCESSING: {
    ROI_SIZE_FACTOR: 0.6,        // Más grande para mejor captura
    SAMPLING_STEP: 1,            // Sin saltos para mejor precisión
    TEXTURE_GRID_SIZE: 6,        // Más pequeño para mejor detalle
    HISTORY_SIZE: 12             // Más pequeño para respuesta rápida
  },
  
  // Estados de detección con histéresis AJUSTADOS
  DETECTION_STATES: {
    MIN_CONSECUTIVE_ON: 2,       // Rápida activación
    MAX_CONSECUTIVE_OFF: 3,      // Rápida desactivación si no hay señal
    CONFIDENCE_THRESHOLD: 0.6    // Umbral más bajo para detectar
  }
} as const;

export type UnifiedPPGConfig = typeof UNIFIED_PPG_CONFIG;
