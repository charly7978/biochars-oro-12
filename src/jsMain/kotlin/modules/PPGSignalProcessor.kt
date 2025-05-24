package modules

import kotlinx.coroutines.GlobalScope // Consider a specific scope if needed
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import modules.signalprocessing.*
import org.w3c.dom.ImageData
import kotlin.math.log
import kotlin.math.max
import kotlin.math.min

// Based on src/modules/signal-processing/PPGSignalProcessor.ts
class PPGSignalProcessor(
    override var onSignalReady: ((signal: ProcessedSignal) -> Unit)? = null,
    override var onError: ((error: ProcessingError) -> Unit)? = null
) : modules.signalprocessing.SignalProcessor { // Implements the interface defined in signalprocessing.Types

    var isProcessing: Boolean = false
    private var kalmanFilter: KalmanFilter
    private var sgFilter: SavitzkyGolayFilter
    private var trendAnalyzer: SignalTrendAnalyzer
    private var biophysicalValidator: BiophysicalValidator
    private var frameProcessor: FrameProcessor
    private var calibrationHandler: CalibrationHandler // This one seems more for PPG-specific calibration
    private var signalAnalyzer: SignalAnalyzer
    // var lastValues: MutableList<Double> = mutableListOf() // Not obviously used in the TS processFrame, can be added if needed
    var isCalibratingPPG: Boolean = false // Specific to this processor's calibration cycle
    var frameProcessedCount = 0

    val config: SignalProcessorConfig = SignalProcessorConfig(
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
        CALIBRATION_SAMPLES = 10, // For CalibrationHandler, not the main VitalSignsProcessor calibration
        TEXTURE_GRID_SIZE = 8,
        ROI_SIZE_FACTOR = 0.6
    )

    init {
        console.log("[DIAG] PPGSignalProcessor.kt: Constructor", js("{hasSignalReadyCallback: (onSignalReady != null), hasErrorCallback: (onError != null)}"))
        
        kalmanFilter = KalmanFilter()
        sgFilter = SavitzkyGolayFilter() // Default window size 9
        trendAnalyzer = SignalTrendAnalyzer() // Default history 30
        biophysicalValidator = BiophysicalValidator()
        frameProcessor = FrameProcessor(FrameProcessor.Config(config.TEXTURE_GRID_SIZE, config.ROI_SIZE_FACTOR))
        calibrationHandler = CalibrationHandler(
            modules.signalprocessing.CalibrationHandler.Config(
                CALIBRATION_SAMPLES = config.CALIBRATION_SAMPLES,
                MIN_RED_THRESHOLD = config.MIN_RED_THRESHOLD,
                MAX_RED_THRESHOLD = config.MAX_RED_THRESHOLD
            )
        )
        signalAnalyzer = SignalAnalyzer(
            modules.signalprocessing.SignalAnalyzer.Config(
                QUALITY_LEVELS = config.QUALITY_LEVELS,
                QUALITY_HISTORY_SIZE = config.QUALITY_HISTORY_SIZE,
                MIN_CONSECUTIVE_DETECTIONS = config.MIN_CONSECUTIVE_DETECTIONS,
                MAX_CONSECUTIVE_NO_DETECTIONS = config.MAX_CONSECUTIVE_NO_DETECTIONS
            )
        )
        console.log("PPGSignalProcessor.kt: Instance created with configuration:", config)
    }
    
    override suspend fun initialize() {
        console.log("[DIAG] PPGSignalProcessor.kt: initialize() called", js("{hasSignalReadyCallback: (onSignalReady != null), hasErrorCallback: (onError != null)}"))
        try {
            // lastValues.clear()
            kalmanFilter.reset()
            sgFilter.reset()
            trendAnalyzer.reset()
            biophysicalValidator.reset()
            calibrationHandler.resetCalibration() // Use the specific reset for this handler
            signalAnalyzer.reset()
            frameProcessedCount = 0
            console.log("PPGSignalProcessor.kt: System initialized.")
        } catch (error: dynamic) {
            console.error("PPGSignalProcessor.kt: Initialization error", error)
            handleError("INIT_ERROR", "Error initializing advanced processor")
        }
    }

    override fun start() {
        console.log("[DIAG] PPGSignalProcessor.kt: start() called", js("{isProcessing: isProcessing}"))
        if (isProcessing) return
        isProcessing = true
        // Initialize is suspend, so call it in a scope or ensure start is also suspend
        GlobalScope.launch { // Or use a passed-in CoroutineScope
            initialize()
        }
        console.log("PPGSignalProcessor.kt: Advanced system started")
    }

    override fun stop() {
        console.log("[DIAG] PPGSignalProcessor.kt: stop() called", js("{isProcessing: isProcessing}"))
        isProcessing = false
        // lastValues.clear()
        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        biophysicalValidator.reset()
        calibrationHandler.resetCalibration()
        signalAnalyzer.reset()
        console.log("PPGSignalProcessor.kt: Advanced system stopped")
    }

    override suspend fun calibrate(): Boolean {
        try {
            console.log("PPGSignalProcessor.kt: Starting adaptive PPG calibration")
            initialize() // Re-initialize components for calibration
            
            isCalibratingPPG = true
            calibrationHandler.resetCalibration() // Reset specific PPG calibration data
            
            // In TS, there was a setTimeout. Here, we use delay within a coroutine.
            // This calibration is specific to PPGSignalProcessor, separate from VitalSignsProcessor's calibration.
            GlobalScope.launch { // Or use a passed-in CoroutineScope
                delay(3000) // Calibrate for 3 seconds
                isCalibratingPPG = false
                // The actual calibration values are determined by calibrationHandler.handleCalibration during processFrame
                if (calibrationHandler.isCalibrationComplete()) {
                    console.log("PPGSignalProcessor.kt: Adaptive PPG calibration completed (values used by handler).")
                } else {
                    console.warn("PPGSignalProcessor.kt: Adaptive PPG calibration period ended, but handler did not complete. Using defaults or last good values.")
                }
            }
            console.log("PPGSignalProcessor.kt: Adaptive PPG calibration initiated (3s duration). Values determined by CalibrationHandler.")
            return true
        } catch (error: dynamic) {
            console.error("PPGSignalProcessor.kt: PPG Calibration error", error)
            handleError("CALIBRATION_ERROR", "Error during adaptive PPG calibration")
            isCalibratingPPG = false
            return false
        }
    }

    // processFrame and handleError will be next
}