package modules

import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import modules.signalprocessing.*
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.js.Date // For Date.now()

// Assuming these are in the same package or imported correctly
// import modules.signalprocessing.KalmanFilter
// import modules.signalprocessing.SavitzkyGolayFilter
// import modules.signalprocessing.SignalTrendAnalyzer
// import modules.signalprocessing.BiophysicalValidator
// import modules.signalprocessing.FrameProcessor
// import modules.signalprocessing.CalibrationHandler
// import modules.signalprocessing.SignalAnalyzer

class PPGSignalProcessor(
    override var onSignalReady: ((signal: ProcessedSignal) -> Unit)? = null,
    override var onError: ((error: ProcessingError) -> Unit)? = null
) : SignalProcessor {
    var isProcessing: Boolean = false
    var kalmanFilter: KalmanFilter
    var sgFilter: SavitzkyGolayFilter
    var trendAnalyzer: SignalTrendAnalyzer
    var biophysicalValidator: BiophysicalValidator
    var frameProcessor: FrameProcessor
    var calibrationHandler: CalibrationHandler
    var signalAnalyzer: SignalAnalyzer
    var lastValues: MutableList<Double> = mutableListOf()
    var isCalibrating: Boolean = false
    var frameProcessedCount = 0

    // Configuration with stricter medically appropriate thresholds
    val CONFIG = SignalProcessorConfig(
        BUFFER_SIZE = 15,
        MIN_RED_THRESHOLD = 0.0,     // Umbral mínimo de rojo a 0 para aceptar señales débiles
        MAX_RED_THRESHOLD = 240.0,
        STABILITY_WINDOW = 10,      // Increased for more stability assessment
        MIN_STABILITY_COUNT = 5,   // Requires more stability for detection
        HYSTERESIS = 2.5,          // Increased hysteresis for stable detection
        MIN_CONSECUTIVE_DETECTIONS = 6,  // Requires more frames to confirm detection
        MAX_CONSECUTIVE_NO_DETECTIONS = 4,  // Quicker to lose detection when finger is removed
        QUALITY_LEVELS = 20,
        QUALITY_HISTORY_SIZE = 10,
        CALIBRATION_SAMPLES = 10,
        TEXTURE_GRID_SIZE = 8,
        ROI_SIZE_FACTOR = 0.6
    )

    init {
        println("[DIAG] PPGSignalProcessor: Constructor, hasSignalReadyCallback: ${onSignalReady != null}, hasErrorCallback: ${onError != null}")

        kalmanFilter = KalmanFilter()
        sgFilter = SavitzkyGolayFilter()
        trendAnalyzer = SignalTrendAnalyzer()
        biophysicalValidator = BiophysicalValidator()
        frameProcessor = FrameProcessor(
            FrameProcessor.Config( // Assuming FrameProcessor has an inner Config class
                TEXTURE_GRID_SIZE = CONFIG.TEXTURE_GRID_SIZE,
                ROI_SIZE_FACTOR = CONFIG.ROI_SIZE_FACTOR
            )
        )
        calibrationHandler = CalibrationHandler(
            CalibrationHandler.Config( // Assuming CalibrationHandler has an inner Config class
                CALIBRATION_SAMPLES = CONFIG.CALIBRATION_SAMPLES,
                MIN_RED_THRESHOLD = CONFIG.MIN_RED_THRESHOLD,
                MAX_RED_THRESHOLD = CONFIG.MAX_RED_THRESHOLD
            )
        )
        signalAnalyzer = SignalAnalyzer(
            SignalAnalyzer.Config( // Assuming SignalAnalyzer has an inner Config class
                QUALITY_LEVELS = CONFIG.QUALITY_LEVELS,
                QUALITY_HISTORY_SIZE = CONFIG.QUALITY_HISTORY_SIZE,
                MIN_CONSECUTIVE_DETECTIONS = CONFIG.MIN_CONSECUTIVE_DETECTIONS,
                MAX_CONSECUTIVE_NO_DETECTIONS = CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS
            )
        )
        println("PPGSignalProcessor: Instance created with medically appropriate configuration: $CONFIG")
    }

    override suspend fun initialize() {
        println("[DIAG] PPGSignalProcessor: initialize() called, hasSignalReadyCallback: ${onSignalReady != null}, hasErrorCallback: ${onError != null}")
        try {
            lastValues.clear()
            kalmanFilter.reset()
            sgFilter.reset()
            trendAnalyzer.reset()
            biophysicalValidator.reset()
            signalAnalyzer.reset()
            frameProcessedCount = 0
            println("PPGSignalProcessor: System initialized with callbacks: hasSignalReadyCallback: ${onSignalReady != null}, hasErrorCallback: ${onError != null}")
        } catch (e: Exception) {
            console.error("PPGSignalProcessor: Initialization error", e)
            handleError("INIT_ERROR", "Error initializing advanced processor")
        }
    }

    override fun start() {
        println("[DIAG] PPGSignalProcessor: start() called, isProcessing: $isProcessing")
        if (isProcessing) return
        isProcessing = true
        GlobalScope.launch { // Launching a coroutine for suspend function
            initialize()
        }
        println("PPGSignalProcessor: Advanced system started")
    }

    override fun stop() {
        println("[DIAG] PPGSignalProcessor: stop() called, isProcessing: $isProcessing")
        isProcessing = false
        lastValues.clear()
        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        biophysicalValidator.reset()
        signalAnalyzer.reset()
        println("PPGSignalProcessor: Advanced system stopped")
    }

    override suspend fun calibrate(): Boolean {
        return try {
            println("PPGSignalProcessor: Starting adaptive calibration")
            initialize() // This is a suspend function, so calibrate must be suspend or run in a coroutine

            isCalibrating = true

            // After a period of calibration, automatically finish
            // Use kotlinx.coroutines.delay for non-blocking delay
            GlobalScope.launch {
                delay(3000L)
                isCalibrating = false
                println("PPGSignalProcessor: Adaptive calibration completed automatically")
            }

            println("PPGSignalProcessor: Adaptive calibration initiated")
            true
        } catch (e: Exception) {
            console.error("PPGSignalProcessor: Calibration error", e)
            handleError("CALIBRATION_ERROR", "Error during adaptive calibration")
            isCalibrating = false
            false
        }
    }

    override fun processFrame(imageData: ImageData) {
        // console.log is not directly available in Kotlin/JS like this for objects.
        // Using string interpolation for simple logging.
        println("[DIAG] PPGSignalProcessor: processFrame() called, isProcessing: $isProcessing, hasOnSignalReadyCallback: ${onSignalReady != null}, imageSize: ${imageData.width}x${imageData.height}, timestamp: ${Date().toISOString()}")

        if (!isProcessing) {
            println("PPGSignalProcessor: Not processing, ignoring frame")
            return
        }

        try {
            frameProcessedCount++
            val shouldLog = frameProcessedCount % 30 == 0 // Log every 30 frames

            if (onSignalReady == null) {
                console.error("PPGSignalProcessor: onSignalReady callback not available, cannot continue")
                handleError("CALLBACK_ERROR", "Callback onSignalReady not available")
                return
            }

            // 1. Extract frame features with enhanced validation
            // Assuming FrameProcessor.extractFrameData takes our local ImageData
            val extractionResult = frameProcessor.extractFrameData(imageData) 
            val redValue = extractionResult.redValue
            val textureScore = extractionResult.textureScore
            val rToGRatio = extractionResult.rToGRatio
            val rToBRatio = extractionResult.rToBRatio
            
            // Assuming FrameProcessor.detectROI takes redValue and our local ImageData
            val roi = frameProcessor.detectROI(redValue, imageData)

            if (shouldLog) {
                println("PPGSignalProcessor DEBUG: step: FrameExtraction, redValue: $redValue, roiX: ${roi.x}, roiY: ${roi.y}, roiWidth: ${roi.width}, roiHeight: ${roi.height}, textureScore: $textureScore, rToGRatio: $rToGRatio, rToBRatio: $rToBRatio")
            }

            // Early rejection of invalid frames - stricter thresholds
            if (redValue < CONFIG.MIN_RED_THRESHOLD * 0.9) {
                if (shouldLog) {
                    println("PPGSignalProcessor: Signal too weak, skipping processing: $redValue")
                }
                val minimalSignal = ProcessedSignal(
                    timestamp = Date.now(),
                    rawValue = redValue,
                    filteredValue = redValue,
                    quality = 0,
                    fingerDetected = false,
                    roi = roi,
                    perfusionIndex = 0.0
                )
                onSignalReady?.invoke(minimalSignal)
                if (shouldLog) {
                    println("PPGSignalProcessor DEBUG: Sent onSignalReady (Early Reject - Weak Signal): $minimalSignal")
                }
                return
            }

            // 2. Apply multi-stage filtering to the signal
            var filteredValue = kalmanFilter.filter(redValue)
            filteredValue = sgFilter.filter(filteredValue)
            
            val AMPLIFICATION_FACTOR = 30.0 // Use Double for consistency
            filteredValue *= AMPLIFICATION_FACTOR

            // 3. Perform signal trend analysis with strict physiological validation
            val trendResult = trendAnalyzer.analyzeTrend(filteredValue)

            if (trendResult == TrendResult.NON_PHYSIOLOGICAL && !isCalibrating) {
                if (shouldLog) {
                    println("PPGSignalProcessor: Non-physiological signal rejected")
                }
                val rejectSignal = ProcessedSignal(
                    timestamp = Date.now(),
                    rawValue = redValue,
                    filteredValue = filteredValue,
                    quality = 0,
                    fingerDetected = false,
                    roi = roi,
                    perfusionIndex = 0.0
                )
                onSignalReady?.invoke(rejectSignal)
                if (shouldLog) {
                    println("PPGSignalProcessor DEBUG: Sent onSignalReady (Reject - Non-Physiological Trend): $rejectSignal")
                }
                return
            }
            
            // Additional validation for color channel ratios
            if ((rToGRatio < 0.9 || rToGRatio > 4.0) && !isCalibrating) {
                if (shouldLog) {
                     println("PPGSignalProcessor: Non-physiological color ratio detected: rToGRatio: $rToGRatio, rToBRatio: $rToBRatio")
                }
                val rejectSignal = ProcessedSignal(
                    timestamp = Date.now(),
                    rawValue = redValue,
                    filteredValue = filteredValue,
                    quality = 0,
                    fingerDetected = false,
                    roi = roi,
                    perfusionIndex = 0.0
                )
                onSignalReady?.invoke(rejectSignal)
                if (shouldLog) {
                    println("PPGSignalProcessor DEBUG: Sent onSignalReady (Reject - Non-Physiological Color Ratio): $rejectSignal")
                }
                return
            }

            // 4. Calculate comprehensive detector scores with medical validation
            val detectorScores = DetectorScores(
                // redValue = redValue, // redValue is not part of DetectorScores data class
                redChannel = min(1.0, max(0.0, (redValue - CONFIG.MIN_RED_THRESHOLD) /
                        (CONFIG.MAX_RED_THRESHOLD - CONFIG.MIN_RED_THRESHOLD))),
                stability = trendAnalyzer.getStabilityScore(),
                pulsatility = biophysicalValidator.calculatePulsatilityIndex(filteredValue),
                biophysical = biophysicalValidator.validateBiophysicalRange(redValue, rToGRatio, rToBRatio),
                periodicity = trendAnalyzer.getPeriodicityScore(),
                textureScore = textureScore // Added from FrameData/FrameProcessor
            )

            signalAnalyzer.updateDetectorScores(detectorScores)

            // 5. Perform multi-detector analysis for highly accurate finger detection
            val detectionResult = signalAnalyzer.analyzeSignalMultiDetector(filteredValue, trendResult)
            val isFingerDetected = detectionResult.isFingerDetected
            val quality = detectionResult.quality

            // Calculate physiologically valid perfusion index only when finger is detected
            val perfusionIndex = if (isFingerDetected && quality > 30) {
                (ln(redValue) * 0.55 - 1.2)
            } else {
                0.0
            }

            val processedSignal = ProcessedSignal(
                timestamp = Date.now(),
                rawValue = redValue,
                filteredValue = filteredValue,
                quality = quality,
                fingerDetected = isFingerDetected,
                roi = roi, // Assuming roi from frameProcessor is compatible
                perfusionIndex = max(0.0, perfusionIndex)
            )

            if (shouldLog) {
                println("PPGSignalProcessor: Sending validated signal: fingerDetected: $isFingerDetected, quality: $quality, redValue: $redValue, filteredValue: $filteredValue, timestamp: ${Date().toISOString()}")
            }
            
            onSignalReady?.invoke(processedSignal)
            if (shouldLog) {
                println("PPGSignalProcessor DEBUG: Sent onSignalReady (Final): $processedSignal")
            }

        } catch (e: Exception) {
            console.error("PPGSignalProcessor: Error processing frame", e)
            // In Kotlin, e already includes message and stack trace typically.
            // We can pass e.message or a custom message.
            handleError("PROCESSING_ERROR", "Error processing frame: ${e.message}")
        }
    }

    private fun handleError(code: String, message: String) {
        console.error("PPGSignalProcessor: Error Code: $code, Message: $message")
        val error = ProcessingError(
            code = code,
            message = message,
            timestamp = Date.now()
        )
        onError?.invoke(error) ?: console.error("PPGSignalProcessor: onError callback not available, cannot report error: $error")
    }
}