package modules.signal_processing

import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sqrt

// Asumiendo que DetectorScores y DetectionResult están definidos (en Types.kt)
// import modules.signal_processing.DetectorScores
// import modules.signal_processing.DetectionResult

data class SignalAnalyzerConfig(
    val QUALITY_LEVELS: Int,
    val QUALITY_HISTORY_SIZE: Int,
    val MIN_CONSECUTIVE_DETECTIONS: Int,
    val MAX_CONSECUTIVE_NO_DETECTIONS: Int
)

// La estructura TrendResult ya está definida como typealias en SignalTrendAnalyzer.kt
// o podría ser un enum como se sugirió.
// data class TrendResultWrapper(val type: String) // Si se necesita envolver.

class SignalAnalyzer(private val config: SignalAnalyzerConfig) {

    private var detectorScores: DetectorScores = DetectorScores(
        redChannel = 0.0,
        stability = 0.0,
        pulsatility = 0.0,
        biophysical = 0.0,
        periodicity = 0.0,
        textureScore = 0.0
    )
    private var stableFrameCount: Int = 0
    private var lastStableValue: Double = 0.0
    private var consecutiveDetections: Int = 0
    private var consecutiveNoDetections: Int = 0
    private var isCurrentlyDetected: Boolean = false
    private var lastDetectionTime: Long = 0L
    private var qualityHistory: MutableList<Double> = mutableListOf()
    private var motionArtifactScore: Double = 0.0
    private val DETECTION_TIMEOUT = 3000L // ms
    private val MOTION_ARTIFACT_THRESHOLD = 0.75
    private var valueHistory: MutableList<Double> = mutableListOf() // Track signal history for artifact detection

    private var calibrationPhase: Boolean = true
    private var calibrationSamples: MutableList<Double> = mutableListOf()
    private val CALIBRATION_SAMPLE_SIZE = 20 // Debería coincidir con config.CALIBRATION_SAMPLES de PPGSignalProcessor si se usa allí
    private var adaptiveThreshold: Double = 0.1 // Umbral inicial que se ajustará

    fun updateDetectorScores(scores: DetectorScores) {
        // Actualiza directamente las propiedades del objeto detectorScores interno.
        // Se podría hacer una copia si se prefiere la inmutabilidad en ciertos contextos.
        this.detectorScores.redChannel = scores.redChannel
        this.detectorScores.stability = scores.stability
        this.detectorScores.pulsatility = scores.pulsatility
        this.detectorScores.biophysical = scores.biophysical
        this.detectorScores.periodicity = scores.periodicity
        this.detectorScores.textureScore = scores.textureScore ?: 0.0

        // Lógica adicional de updateDetectorScores del original (no visible en el outline) podría ir aquí.
        // Por ejemplo, calcular motionArtifactScore basado en la varianza de los scores o del valor crudo.
        if (valueHistory.isNotEmpty()) {
            val meanValue = valueHistory.average()
            val variance = valueHistory.map { (it - meanValue).pow(2) }.average()
            // Normalizar la varianza para obtener un score (esto es una simplificación)
            motionArtifactScore = (variance / (meanValue.takeIf { it != 0.0 } ?: 1.0)).coerceIn(0.0, 1.0)
        }
    }

    private fun calibrateAdaptiveThreshold() {
        if (calibrationSamples.size < CALIBRATION_SAMPLE_SIZE) return

        val mean = calibrationSamples.average()
        val stdDev = sqrt(calibrationSamples.map { (it - mean).pow(2) }.average())
        
        // Ajustar el umbral adaptativo. Esta es una forma de hacerlo.
        // La lógica original podría ser diferente.
        adaptiveThreshold = (stdDev / mean.takeIf { it != 0.0 } ?: 1.0) * 0.5 // Ejemplo: 50% del CV
        adaptiveThreshold = adaptiveThreshold.coerceIn(0.05, 0.5) // Limitar el umbral
        
        calibrationPhase = false
        // calibrationSamples.clear() // Opcional: limpiar después de calibrar el umbral
        println("Adaptive threshold calibrated to: $adaptiveThreshold")
    }

    // El parámetro trendResult en el original era `any`. Necesitamos un tipo más específico.
    // Asumiendo que TrendResult es el String o Enum definido anteriormente.
    // Y que trendResult tiene una estructura que permite acceder a `stability` y `periodicity` (si es un objeto).
    // Si trendResult es solo el string como "stable", entonces esta función necesita ser adaptada.
    // Por ahora, asumo que trendResult es un objeto con esos campos, o que los scores están en this.detectorScores.
    fun analyzeSignalMultiDetector(
        filteredValue: Double,
        // trendResult: Any // El original era 'any'. Necesitamos saber qué es esto.
        // Asumiré que los scores relevantes ya están en this.detectorScores (stability, periodicity)
    ): DetectionResult {
        if (calibrationPhase) {
            calibrationSamples.add(abs(filteredValue - (valueHistory.lastOrNull() ?: filteredValue))) // Añadir diferencia para calibrar umbral de cambio
            if (calibrationSamples.size >= CALIBRATION_SAMPLE_SIZE) {
                calibrateAdaptiveThreshold()
            }
            // Durante la calibración, podemos devolver un estado de baja calidad o no detectado.
            return DetectionResult(false, 0.0, mapOf("status" to "calibrating adaptive threshold"))
        }

        valueHistory.add(filteredValue)
        if (valueHistory.size > config.QUALITY_HISTORY_SIZE) { // Usar un tamaño de historial para valueHistory también
            valueHistory.removeAt(0)
        }

        var qualityScore = 0.0
        val detectorDetails = mutableMapOf<String, Any>()

        // 1. Red Channel Strength (ejemplo, podría venir de detectorScores)
        val redChannelScore = (this.detectorScores.redChannel / 255.0).coerceIn(0.0, 1.0) // Asumiendo 0-255
        detectorDetails["redChannelRaw"] = this.detectorScores.redChannel
        detectorDetails["redChannelScore"] = redChannelScore
        qualityScore += redChannelScore * 0.2 // Ponderación

        // 2. Signal Stability (de detectorScores, ya debería ser un score 0-1)
        val stabilityScore = this.detectorScores.stability.coerceIn(0.0, 1.0)
        detectorDetails["stabilityScore"] = stabilityScore
        qualityScore += stabilityScore * 0.3

        // 3. Pulsatility (de detectorScores, ya debería ser un score 0-1)
        val pulsatilityScore = this.detectorScores.pulsatility.coerceIn(0.0, 1.0)
        detectorDetails["pulsatilityScore"] = pulsatilityScore
        qualityScore += pulsatilityScore * 0.2

        // 4. Biophysical plausibility (de detectorScores, ya debería ser un score 0-1)
        val biophysicalScore = this.detectorScores.biophysical.coerceIn(0.0, 1.0)
        detectorDetails["biophysicalScore"] = biophysicalScore
        qualityScore += biophysicalScore * 0.15
        
        // 5. Periodicity/Rhythm (de detectorScores, ya debería ser un score 0-1)
        val periodicityScore = this.detectorScores.periodicity.coerceIn(0.0, 1.0)
        detectorDetails["periodicityScore"] = periodicityScore
        qualityScore += periodicityScore * 0.15
        
        // 6. Motion artifact (calculado en updateDetectorScores o aquí)
        // Asumiendo que motionArtifactScore es 0 (sin artefacto) a 1 (mucho artefacto)
        val motionResistanceScore = (1.0 - motionArtifactScore).coerceIn(0.0, 1.0)
        detectorDetails["motionArtifactScore"] = motionArtifactScore // El score del artefacto
        detectorDetails["motionResistanceScore"] = motionResistanceScore // La calidad debido a la resistencia
        // qualityScore *= motionResistanceScore // Aplicar como un multiplicador o sumarlo ponderado
        // Por ahora, lo incluimos en los detalles pero no afecta directamente el qualityScore total aquí.

        // Lógica de detección de dedo (isFingerDetected)
        // Esta es una interpretación basada en la calidad y los umbrales.
        val isSignalGoodEnough = qualityScore > (adaptiveThreshold + 0.1) // Umbral ligeramente superior para detección

        if (isSignalGoodEnough && biophysicalScore > 0.5 && redChannelScore > 0.3) { // Condiciones adicionales para 'dedo detectado'
            consecutiveDetections++
            consecutiveNoDetections = 0
            if (consecutiveDetections >= config.MIN_CONSECUTIVE_DETECTIONS || isCurrentlyDetected) {
                isCurrentlyDetected = true
                lastDetectionTime = System.currentTimeMillis()
                lastStableValue = filteredValue
                stableFrameCount++
            }
        } else {
            consecutiveNoDetections++
            if (consecutiveNoDetections >= config.MAX_CONSECUTIVE_NO_DETECTIONS || 
                (isCurrentlyDetected && (System.currentTimeMillis() - lastDetectionTime > DETECTION_TIMEOUT))) {
                isCurrentlyDetected = false
                stableFrameCount = 0
                // No reiniciar consecutiveDetections aquí, para permitir una recuperación más rápida si la señal vuelve.
            }
        }

        // Actualizar historial de calidad
        qualityHistory.add(qualityScore)
        if (qualityHistory.size > config.QUALITY_HISTORY_SIZE) {
            qualityHistory.removeAt(0)
        }
        val smoothedQuality = if (qualityHistory.isNotEmpty()) qualityHistory.average() else 0.0

        detectorDetails["overallQualityPreSmoothing"] = qualityScore
        detectorDetails["adaptiveThreshold"] = adaptiveThreshold
        detectorDetails["consecutiveDetections"] = consecutiveDetections
        detectorDetails["consecutiveNoDetections"] = consecutiveNoDetections

        return DetectionResult(
            isFingerDetected = isCurrentlyDetected,
            quality = (smoothedQuality * config.QUALITY_LEVELS).toInt() / config.QUALITY_LEVELS.toDouble(), // Discretizar calidad
            detectorDetails = detectorDetails
        )
    }

    fun updateLastStableValue(value: Double) {
        lastStableValue = value
    }

    fun getLastStableValue(): Double {
        return lastStableValue
    }

    fun reset() {
        detectorScores = DetectorScores(0.0,0.0,0.0,0.0,0.0,0.0) // Reset con valores por defecto
        stableFrameCount = 0
        lastStableValue = 0.0
        consecutiveDetections = 0
        consecutiveNoDetections = 0
        isCurrentlyDetected = false
        lastDetectionTime = 0L
        qualityHistory.clear()
        motionArtifactScore = 0.0
        valueHistory.clear()
        
        calibrationPhase = true
        calibrationSamples.clear()
        adaptiveThreshold = 0.1 // Reset al valor inicial
        println("SignalAnalyzer reset.")
    }
} 