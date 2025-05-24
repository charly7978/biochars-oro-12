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
    
    // initialize, start, stop, calibrate, processFrame, handleError will be added next
} 