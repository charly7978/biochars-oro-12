package com.biocharsproject.shared.modules.signal_processing

import kotlinx.serialization.Serializable
import com.biocharsproject.shared.types.Signal.ROI

/**
 * Common types for PPG signal processing
 */

/**
 * Frame data from camera image processing
 */
@Serializable
data class FrameData(
    val redValue: Double,
    val avgRed: Double? = null,
    val avgGreen: Double? = null,
    val avgBlue: Double? = null,
    val textureScore: Double,
    val rToGRatio: Double,
    val rToBRatio: Double
)

@Serializable
data class SignalProcessorConfig(
    val BUFFER_SIZE: Int,
    val MIN_RED_THRESHOLD: Double,
    val MAX_RED_THRESHOLD: Double,
    val STABILITY_WINDOW: Int,
    val MIN_STABILITY_COUNT: Int,
    val HYSTERESIS: Double,
    val MIN_CONSECUTIVE_DETECTIONS: Int,
    val MAX_CONSECUTIVE_NO_DETECTIONS: Int,
    val QUALITY_LEVELS: Int,
    val QUALITY_HISTORY_SIZE: Int,
    val CALIBRATION_SAMPLES: Int,
    val TEXTURE_GRID_SIZE: Int,
    val ROI_SIZE_FACTOR: Double
)

@Serializable
data class CalibrationValues(
    val baselineRed: Double,
    val baselineVariance: Double,
    val minRedThreshold: Double,
    val maxRedThreshold: Double,
    val isCalibrated: Boolean
)

@Serializable
data class DetectorScores(
    var redChannel: Double, // Usamos var para que puedan ser modificables si es necesario
    var stability: Double,
    var pulsatility: Double,
    var biophysical: Double,
    var periodicity: Double,
    // Para [key: string]: number, Kotlin usaría un MutableMap
    // Sin embargo, dado que las claves principales están definidas, 
    // se podría optar por añadir propiedades opcionales o un mapa si hay muchas claves dinámicas.
    // Por simplicidad, mantendremos las propiedades fijas y se puede añadir un mapa si es necesario.
    var textureScore: Double? = null // Ejemplo de propiedad adicional que era opcional
)

@Serializable
data class DetectionResult(
    val isFingerDetected: Boolean,
    val quality: Double,
    // Record<string, number | string> se traduce mejor a Map<String, Any>
    // donde Any puede ser Number o String. Se necesita cuidado en el uso.
    val detectorDetails: Map<String, Any>
) 