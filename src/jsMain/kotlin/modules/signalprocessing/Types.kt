package modules.signalprocessing

import kotlinx.serialization.Serializable

@Serializable
data class SignalProcessorConfig(
    val BUFFER_SIZE: Int,
    val MIN_RED_THRESHOLD: Double, // Changed to Double from Int for precision
    val MAX_RED_THRESHOLD: Double, // Changed to Double
    val STABILITY_WINDOW: Int,
    val MIN_STABILITY_COUNT: Int,
    val HYSTERESIS: Double,
    val MIN_CONSECUTIVE_DETECTIONS: Int,
    val MAX_CONSECUTIVE_NO_DETECTIONS: Int,
    val QUALITY_LEVELS: Int,
    val QUALITY_HISTORY_SIZE: Int,
    val CALIBRATION_SAMPLES: Int,
    val TEXTURE_GRID_SIZE: Int,
    val ROI_SIZE_FACTOR: Double // Changed to Double
)

@Serializable
data class ROIData(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int
)

@Serializable
data class ProcessedSignal(
    val timestamp: Double, // Changed from Long to Double for JS Date.now()
    val rawValue: Double,
    val filteredValue: Double,
    val quality: Int,
    val fingerDetected: Boolean,
    val roi: ROIData,
    val perfusionIndex: Double? = null
)

@Serializable
data class ProcessingError(
    val code: String,
    val message: String,
    val timestamp: Double // Changed from Long to Double
)

interface SignalProcessor {
    suspend fun initialize()
    fun start()
    fun stop()
    suspend fun calibrate(): Boolean
    fun processFrame(imageData: org.w3c.dom.ImageData) // Assuming ImageData is available
    var onSignalReady: ((signal: ProcessedSignal) -> Unit)?
    var onError: ((error: ProcessingError) -> Unit)?
}

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
  val redChannel: Double,
  val stability: Double,
  val pulsatility: Double,
  val biophysical: Double,
  val periodicity: Double,
  val textureScore: Double? = null // Added from FrameData/FrameProcessor
  // Allow other string keys for dynamic scores from JS version
  // This is hard to represent directly in a data class, might need a Map<String, Double>
)

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
data class DetectionResult(
  val isFingerDetected: Boolean,
  val quality: Int,
  val detectorDetails: Map<String, Any> // Using Map for flexibility
)

// TrendResult for SignalTrendAnalyzer
enum class TrendResult {
    STABLE, UNSTABLE, NON_PHYSIOLOGICAL
} 