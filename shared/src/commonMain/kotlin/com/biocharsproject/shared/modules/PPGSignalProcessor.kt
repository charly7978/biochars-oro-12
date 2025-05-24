package com.biocharsproject.shared.modules

import com.biocharsproject.shared.types.*
import com.biocharsproject.shared.modules.signal_processing.*
import kotlinx.coroutines.*
import kotlin.time.TimeSource // For MonotonicTimeSource if available and needed, else System.currentTimeMillis()

// Data class ImageDataWrapper needs to be defined or imported.
// Assuming it's a simple data holder for image data properties relevant to FrameProcessor.
// If it was defined in FrameProcessor.kt, that file also needs to be moved and its content made available.
// For now, let's define a placeholder here or assume it will be available from a moved FrameProcessor.kt
// Actual definition for ImageDataWrapper:
// data class ImageDataWrapper(val data: ByteArray, val width: Int, val height: Int, val format: String)


// Placeholder or ensure FrameProcessorConfig, CalibrationHandlerConfig, SignalAnalyzerConfig are moved/available
// For now, these will cause errors if not defined/imported from their respective files after moving.
// data class FrameProcessorConfig(val textureGridSize: Int, val roiSizeFactor: Double)
// data class CalibrationHandlerConfig(val calibrationSamples: Int, val minRedThreshold: Double, val maxRedThreshold: Double)
// data class SignalAnalyzerConfig(val qualityLevels: Int, val qualityHistorySize: Int, val minConsecutiveDetections: Int, val maxConsecutiveNoDetections: Int)


open class PPGSignalProcessor(
    actual override var onSignalReady: ((signal: ProcessedSignal) -> Unit)? = null,
    actual override var onError: ((error: ProcessingError) -> Unit)? = null
) : SignalProcessor, CoroutineScope {

    private val job = Job()
    actual override val coroutineContext = Dispatchers.Default + job

    var isProcessing: Boolean = false
        private set
    
    lateinit var kalmanFilter: KalmanFilter
        private set
    lateinit var sgFilter: SavitzkyGolayFilter
        private set
    lateinit var trendAnalyzer: SignalTrendAnalyzer
        private set
    
    // Estas dependencias ahora se inicializarán correctamente
    lateinit var biophysicalValidator: BiophysicalValidator 
        private set
    lateinit var frameProcessor: FrameProcessor
        private set
    lateinit var calibrationHandler: CalibrationHandler
        private set
    lateinit var signalAnalyzer: SignalAnalyzer
        private set

    var lastValues: MutableList<Double> = mutableListOf()
        private set
    var isCalibrating: Boolean = false
        private set
    var frameProcessedCount = 0
        private set

    // TODO: Ensure these Config data classes are properly defined/imported in commonMain
    // For now, defining them as inner data classes or top-level in this file if they are simple enough
    // Or they should be moved from their original locations (e.g., signal_processing.Types.kt for SignalProcessorConfig)
    // SignalProcessorConfig is already in shared/modules/signal_processing/Types.kt
    // We need to ensure FrameProcessorConfig etc. are also moved or defined.
    // For now, let's assume SignalProcessorConfig is correctly imported.
    // The others might need to be defined temporarily if not yet moved.
    // data class FrameProcessorConfigPlaceholder(val textureGridSize: Int, val roiSizeFactor: Double) // No longer needed
    // data class CalibrationHandlerConfigPlaceholder(val calibrationSamples: Int, val minRedThreshold: Double, val maxRedThreshold: Double) // No longer needed
    // data class SignalAnalyzerConfigPlaceholder(val qualityLevels: Int, val qualityHistorySize: Int, val minConsecutiveDetections: Int, val maxConsecutiveNoDetections: Int) // No longer needed


    val CONFIG: SignalProcessorConfig = SignalProcessorConfig(
        BUFFER_SIZE = 100,
        MIN_RED_THRESHOLD = 50.0,
        MAX_RED_THRESHOLD = 220.0,
        STABILITY_WINDOW = 15,
        MIN_STABILITY_COUNT = 5,
        HYSTERESIS = 0.1,
        MIN_CONSECUTIVE_DETECTIONS = 3,
        MAX_CONSECUTIVE_NO_DETECTIONS = 5,
        QUALITY_LEVELS = 10,
        QUALITY_HISTORY_SIZE = 10,
        CALIBRATION_SAMPLES = 50,
        TEXTURE_GRID_SIZE = 8,
        ROI_SIZE_FACTOR = 0.6
    )
    
    // Placeholder for actual ImageDataWrapper - this needs to be defined in commonMain
    // or expect/actual if it involves platform-specific image data.
    // For common processing logic, it should be a common data class.
    // data class CommonImageDataWrapper(val pixelData: ByteArray, val width: Int, val height: Int, val format: String = "RGBA")
    // MOVED to shared/src/commonMain/kotlin/com/biocharsproject/shared/types/Signal.kt


    init {
        // Initialization in initialize()
    }

    actual override suspend fun initialize() { // Removed Promise return type
        kalmanFilter = KalmanFilter()
        sgFilter = SavitzkyGolayFilter(windowSize = 9)
        trendAnalyzer = SignalTrendAnalyzer(historyLength = CONFIG.STABILITY_WINDOW)
        
        // Inicializar con las clases reales y la configuración global
        biophysicalValidator = BiophysicalValidator()
        frameProcessor = FrameProcessor(CONFIG)
        calibrationHandler = CalibrationHandler(CONFIG)
        signalAnalyzer = SignalAnalyzer(CONFIG)
            
        resetState()
        println("PPGSignalProcessor initialized")
    }

    actual override fun start() {
        if (isProcessing) {
            println("PPGSignalProcessor is already running.")
            return
        }
        isProcessing = true
        isCalibrating = false
        frameProcessedCount = 0
        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        biophysicalValidator.reset() 
        signalAnalyzer.reset() 
        
        println("PPGSignalProcessor started.")
    }

    actual override fun stop() {
        if (!isProcessing) {
            println("PPGSignalProcessor is not running.")
            return
        }
        isProcessing = false
        println("PPGSignalProcessor stopped. Total frames processed: $frameProcessedCount")
    }

    actual override suspend fun calibrate(): Boolean { // Changed Promise<Boolean> to Boolean
        if (isProcessing) {
            // stop()
        }
        println("Starting calibration...")
        isCalibrating = true
        calibrationHandler.resetCalibration() 
        signalAnalyzer.reset() 
        frameProcessedCount = 0
        
        // Actual calibration logic will depend on processFrame calls.
        // This suspend function now simply flags calibration to start.
        // The caller should await its completion if it needs to know when it's done,
        // or listen to onSignalReady for calibration progress.
        return true // Indicates calibration mode has been entered.
    }
    
    private fun resetState() {
        lastValues.clear()
        frameProcessedCount = 0
        // isCalibrated = false; // Managed by calibrationHandler
        // Otros estados que necesiten reseteo
    }

    // This method will require CommonImageDataWrapper and actual implementations of FrameProcessor, etc.
    open fun processFrame(imageData: CommonImageDataWrapper) {
        if (!isProcessing && !isCalibrating) {
            return
        }

        try {
            // val startTime = TimeSource.Monotonic.markNow() // For performance measurement

            val frameData = frameProcessor.extractFrameData(imageData) 

            if (frameData.redValue < CONFIG.MIN_RED_THRESHOLD || frameData.redValue > CONFIG.MAX_RED_THRESHOLD) {
                handleError("low_signal", "Red value out of basic threshold: ${frameData.redValue}")
                // Considerar si se debe retornar aquí o permitir que el flujo continúe con baja calidad
                // return 
            }

            var processedValue = frameData.redValue

            if (isCalibrating) {
                val calibrationComplete = calibrationHandler.handleCalibration(processedValue)
                val calValues = calibrationHandler.getCalibrationValues()

                onSignalReady?.invoke(
                    ProcessedSignal(
                        timestamp = System.currentTimeMillis(),
                        rawValue = processedValue,
                        filteredValue = processedValue, 
                        quality = if (calibrationComplete && calValues.baselineVariance > 0) (calValues.baselineRed / calValues.baselineVariance).coerceIn(0.0,1.0) else 0.1,
                        fingerDetected = false, // Finger detection might not be reliable during calibration
                        roi = frameProcessor.detectROI(processedValue, imageData), // Usar ROI real
                        perfusionIndex = null
                    )
                )
                if (calibrationComplete) {
                    isCalibrating = false
                    println("Calibration completed. Baseline: ${calValues.baselineRed}, Variance: ${calValues.baselineVariance}, MinT: ${calValues.minRedThreshold}, MaxT: ${calValues.maxRedThreshold}")
                    signalAnalyzer.reset() // Reset analyzer after calibration
                    trendAnalyzer.reset()
                    kalmanFilter.reset()
                    sgFilter.reset()
                }
                frameProcessedCount++
                return 
            }

            if (!calibrationHandler.isCalibrationComplete()) {
                 handleError("calibration_incomplete", "Calibration is not complete. Please run calibrate().")
                 onSignalReady?.invoke( ProcessedSignal(
                        timestamp = System.currentTimeMillis(),
                        rawValue = processedValue,
                        filteredValue = processedValue, // o un valor filtrado básico
                        quality = 0.0,
                        fingerDetected = false,
                        roi = frameProcessor.detectROI(processedValue, imageData), // Usar ROI real
                        perfusionIndex = null
                    )
                )
                return
            }

            val sgFiltered = sgFilter.filter(processedValue)
            val kalmanFiltered = kalmanFilter.filter(sgFiltered)

            trendAnalyzer.analyzeTrend(kalmanFiltered)
            val trendScores = trendAnalyzer.getScores() // Obtener scores para usarlos

            val pulsatilityIndex = biophysicalValidator.calculatePulsatilityIndex(kalmanFiltered)
            val biophysicalScore = biophysicalValidator.validateBiophysicalRange(frameData.avgRed ?: frameData.redValue, frameData.rToGRatio ?: 0.0, frameData.rToBRatio ?: 0.0)


            val currentDetectorScores = DetectorScores(
                redChannel = frameData.avgRed ?: frameData.redValue, // Usar avgRed si está disponible
                stability = trendScores.stability,
                pulsatility = pulsatilityIndex,
                biophysical = biophysicalScore,
                periodicity = trendScores.periodicity,
                textureScore = frameData.textureScore
            )
            signalAnalyzer.updateDetectorScores(currentDetectorScores)
            val analysisResult = signalAnalyzer.analyzeSignalMultiDetector(kalmanFiltered)
            val fingerDetected = analysisResult.isFingerDetected
            val quality = analysisResult.quality

            
            val roi = frameProcessor.detectROI(processedValue, imageData) // Usar ROI real


            val finalSignal = ProcessedSignal(
                timestamp = System.currentTimeMillis(),
                rawValue = processedValue,
                filteredValue = kalmanFiltered,
                quality = quality,
                fingerDetected = fingerDetected,
                roi = roi,
                perfusionIndex = pulsatilityIndex // Assuming pulsatilityIndex is the perfusion index
            )
            onSignalReady?.invoke(finalSignal)
            
            lastValues.add(kalmanFiltered)
            if(lastValues.size > CONFIG.BUFFER_SIZE) {
                lastValues.removeAt(0)
            }
            frameProcessedCount++
            // println("Frame processed in ${startTime.elapsedNow()}")

        } catch (e: Exception) {
            handleError("processing_error", "Error during frame processing: ${e.message}")
        }
    }

    protected fun handleError(code: String, message: String) {
        val error = ProcessingError(code, message, System.currentTimeMillis())
        onError?.invoke(error)
        println("PPGSignalProcessor Error: [$code] $message") // También loguear a consola
    }
} 