package com.biocharsproject.shared.modules

import com.biocharsproject.shared.types.Signal.ProcessedSignal
import com.biocharsproject.shared.types.Signal.ProcessingError
import com.biocharsproject.shared.types.Signal.SignalProcessor
import com.biocharsproject.shared.types.Signal.ROI
import com.biocharsproject.shared.modules.signal_processing.*
import com.biocharsproject.shared.utils.CircularBuffer
import kotlinx.coroutines.delay
import kotlin.js.Date

/**
 * PPGSignalProcessor processes camera frames to extract photoplethysmography signals
 * and calculate vital signs like heart rate, SpO2, and blood pressure.
 */
class PPGSignalProcessor(
    override var onSignalReady: ((ProcessedSignal) -> Unit)? = null,
    override var onError: ((ProcessingError) -> Unit)? = null
) : SignalProcessor {
    
    var isProcessing: Boolean = false
    
    // Signal processing components
    lateinit var kalmanFilter: KalmanFilter
    lateinit var sgFilter: SavitzkyGolayFilter
    lateinit var trendAnalyzer: SignalTrendAnalyzer
    lateinit var biophysicalValidator: BiophysicalValidator
    lateinit var frameProcessor: FrameProcessor
    lateinit var calibrationHandler: CalibrationHandler
    lateinit var signalAnalyzer: SignalAnalyzer
    
    val lastValues = mutableListOf<Double>()
    var isCalibrating: Boolean = false
    var frameProcessedCount = 0
    
    // Configuration values
    val CONFIG = SignalProcessorConfig(
        BUFFER_SIZE = 150,
        MIN_RED_THRESHOLD = 0.05,
        MAX_RED_THRESHOLD = 8.0,
        STABILITY_WINDOW = 10,
        MIN_STABILITY_COUNT = 5,
        HYSTERESIS = 0.15,
        MIN_CONSECUTIVE_DETECTIONS = 4,
        MAX_CONSECUTIVE_NO_DETECTIONS = 5,
        QUALITY_LEVELS = 5,
        QUALITY_HISTORY_SIZE = 15,
        CALIBRATION_SAMPLES = 30,
        TEXTURE_GRID_SIZE = 8,
        ROI_SIZE_FACTOR = 0.65
    )
    
    /**
     * Initialize all required filters and analyzers
     */
    override suspend fun initialize() {
        try {
            // Initialize signal processing components
            kalmanFilter = KalmanFilter()
            sgFilter = SavitzkyGolayFilter(9)
            trendAnalyzer = SignalTrendAnalyzer(30)
            biophysicalValidator = BiophysicalValidator()
            frameProcessor = FrameProcessor(CONFIG)
            calibrationHandler = CalibrationHandler(CONFIG)
            signalAnalyzer = SignalAnalyzer(CONFIG)
            
            // Reset all components
            reset()
            
            // Initial calibration
            delay(100) // Small delay to ensure UI is ready
        } catch (e: Exception) {
            handleError("INIT_ERROR", "Failed to initialize signal processor: ${e.message}")
            throw e
        }
    }
    
    /**
     * Start signal processing
     */
    override fun start() {
        isProcessing = true
        // In the web version, this doesn't do much as processing is driven by frames
        // coming from the camera
    }
    
    /**
     * Stop signal processing
     */
    override fun stop() {
        isProcessing = false
        reset()
    }
    
    /**
     * Run the calibration process
     */
    override suspend fun calibrate(): Boolean {
        isCalibrating = true
        calibrationHandler.resetCalibration()
        
        // In a full implementation, this would collect samples
        // from the camera and calibrate based on them
        
        var calibrationSuccess = false
        try {
            // Simulate calibration process
            delay(1000)
            calibrationSuccess = true
            isCalibrating = false
        } catch (e: Exception) {
            handleError("CALIBRATION_ERROR", "Failed to calibrate: ${e.message}")
            isCalibrating = false
        }
        
        return calibrationSuccess
    }
    
    /**
     * Process a video frame to extract PPG signal
     */
    fun processFrame(imageData: ImageData) {
        if (!isProcessing) return
        
        try {
            frameProcessedCount++
            
            // Extract frame data using frame processor
            val frameData = frameProcessor.extractFrameData(imageData)
            
            // Apply filters to the red value
            var filteredValue = kalmanFilter.filter(frameData.redValue)
            filteredValue = sgFilter.filter(filteredValue)
            
            // Update trend analyzer with new value
            val trendResult = trendAnalyzer.analyzeTrend(filteredValue)
            
            // Calculate pulsatility index
            val pulsatilityIndex = biophysicalValidator.calculatePulsatilityIndex(filteredValue)
            
            // Calculate biophysical validity score
            val biophysicalScore = biophysicalValidator.validateBiophysicalRange(
                frameData.redValue,
                frameData.rToGRatio,
                frameData.rToBRatio
            )
            
            // Update detector scores in the signal analyzer
            signalAnalyzer.updateDetectorScores(
                mapOf(
                    "redValue" to frameData.redValue,
                    "redChannel" to frameData.redValue,
                    "stability" to trendAnalyzer.getStabilityScore(),
                    "pulsatility" to pulsatilityIndex,
                    "biophysical" to biophysicalScore,
                    "periodicity" to trendAnalyzer.getPeriodicityScore(),
                    "textureScore" to frameData.textureScore
                )
            )
            
            // Analyze signal with multiple detectors
            val detectionResult = signalAnalyzer.analyzeSignalMultiDetector(
                filteredValue,
                trendResult
            )
            
            // Detect ROI based on signal quality
            val roi = frameProcessor.detectROI(frameData.redValue, imageData)
            
            // If finger is detected, update the stable value
            if (detectionResult.isFingerDetected) {
                signalAnalyzer.updateLastStableValue(filteredValue)
            }
            
            // Build and emit the processed signal
            val signal = ProcessedSignal(
                timestamp = Date.now(),
                rawValue = frameData.redValue,
                filteredValue = filteredValue,
                quality = detectionResult.quality,
                fingerDetected = detectionResult.isFingerDetected,
                roi = ROI(roi.x, roi.y, roi.width, roi.height),
                perfusionIndex = pulsatilityIndex
            )
            
            // Call the signal ready callback
            onSignalReady?.invoke(signal)
            
            // Add to values history
            if (lastValues.size >= CONFIG.BUFFER_SIZE) {
                lastValues.removeAt(0)
            }
            lastValues.add(filteredValue)
            
        } catch (e: Exception) {
            handleError("PROCESSING_ERROR", "Frame processing error: ${e.message}")
        }
    }
    
    /**
     * Reset all signal processing components
     */
    private fun reset() {
        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        biophysicalValidator.reset()
        signalAnalyzer.reset()
        lastValues.clear()
        frameProcessedCount = 0
    }
    
    /**
     * Handle and report errors
     */
    private fun handleError(code: String, message: String) {
        val error = ProcessingError(
            code = code,
            message = message,
            timestamp = Date.now()
        )
        onError?.invoke(error)
    }
}

/**
 * Configuration for signal processor
 */
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