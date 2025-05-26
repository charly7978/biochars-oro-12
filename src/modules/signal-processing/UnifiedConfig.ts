
/**
 * Configuración unificada CORREGIDA para detección REAL de dedos humanos
 * Umbrales ajustados para detectar SOLO dedos reales
 */
export const UNIFIED_PPG_CONFIG = {
  // Umbrales CORRECTOS para detección de dedo humano REAL
  FINGER_DETECTION: {
    MIN_RED_INTENSITY: 80,        // Más alto para dedos reales
    MAX_RED_INTENSITY: 180,       // Rango realista para dedos
    MIN_R_TO_G_RATIO: 1.2,       // Ratio típico de hemoglobina
    MAX_R_TO_G_RATIO: 2.0,       // Ratio máximo realista
    MIN_PERFUSION_INDEX: 0.5,    // Mínimo para circulación real
    MAX_PERFUSION_INDEX: 15.0,   // Máximo realista
    MIN_SKIN_TEXTURE: 0.1,       // Textura mínima de piel real
    MIN_TEMPORAL_STABILITY: 0.3  // Estabilidad mínima real
  },
  
  // Parámetros de calibración para dedos reales
  CALIBRATION: {
    FRAMES_REQUIRED: 10,         // Más frames para calibración precisa
    NOISE_PERCENTILE: 15,        // Percentil conservador
    ADAPTATION_RATE: 0.05,       // Adaptación lenta
    RESET_THRESHOLD: 25          // Reset conservador
  },
  
  // Filtros anti-artificiales MÁS ESTRICTOS
  ARTIFACT_REJECTION: {
    MAX_LED_INTENSITY: 200,      // Rechazar LEDs muy brillantes
    MAX_UNIFORMITY: 0.85,        // Rechazar superficies uniformes
    MIN_COLOR_VARIANCE: 8,       // Mínima variación de color
    MAX_TEMPORAL_STABILITY: 0.95 // Rechazar señales demasiado estables
  },
  
  // Calidad de señal realista
  SIGNAL_QUALITY: {
    SNR_EXCELLENT: 15,           
    SNR_GOOD: 8,                 
    SNR_FAIR: 4,                 
    STABILITY_WEIGHT: 0.2,       
    PERFUSION_WEIGHT: 0.5,       // Más peso a perfusión real
    TEMPORAL_WEIGHT: 0.3         
  },
  
  // Procesamiento optimizado para dedos
  FRAME_PROCESSING: {
    ROI_SIZE_FACTOR: 0.4,        // ROI más pequeño y centrado
    SAMPLING_STEP: 1,            
    TEXTURE_GRID_SIZE: 8,        
    HISTORY_SIZE: 15             
  },
  
  // Estados de detección con histéresis CORRECTA
  DETECTION_STATES: {
    MIN_CONSECUTIVE_ON: 3,       // Más frames para confirmar dedo
    MAX_CONSECUTIVE_OFF: 5,      // Más tolerancia a pérdida temporal
    CONFIDENCE_THRESHOLD: 0.7    // Umbral más alto para confianza
  }
} as const;

export type UnifiedPPGConfig = typeof UNIFIED_PPG_CONFIG;
