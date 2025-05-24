package modules.signal_processing

import kotlinx.coroutines.*
// import types.ProcessedSignal // Definido en src/types/Signal.kt
// import types.ProcessingError // Definido en src/types/Signal.kt
// import types.SignalProcessor // Definido en src/types/Signal.kt
// import modules.signal_processing.SignalProcessorConfig // Definido en Types.kt
// import modules.signal_processing.CalibrationValues // Definido en Types.kt
// import modules.signal_processing.FrameData // Definido en Types.kt
// import modules.signal_processing.ImageDataWrapper // Definido en FrameProcessor.kt

// Necesitamos importar las clases que hemos traducido:
import types.* // Para ProcessedSignal, ProcessingError, SignalProcessor

class PPGSignalProcessor(
    override var onSignalReady: ((signal: ProcessedSignal) -> Unit)? = null,
    override var onError: ((error: ProcessingError) -> Unit)? = null
) : SignalProcessor, CoroutineScope {

    private val job = Job()
    override val coroutineContext = Dispatchers.Default + job // Usar Dispatchers.Default para CPU-bound tasks

    var isProcessing: Boolean = false
        private set
    
    // Componentes (se inicializarán en el constructor o en initialize)
    lateinit var kalmanFilter: KalmanFilter
        private set
    lateinit var sgFilter: SavitzkyGolayFilter
        private set
    lateinit var trendAnalyzer: SignalTrendAnalyzer
        private set
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

    // Configuración por defecto, similar al original
    val CONFIG: SignalProcessorConfig = SignalProcessorConfig(
        BUFFER_SIZE = 100, // Ejemplo, ajustar
        MIN_RED_THRESHOLD = 50.0, // Ajustar
        MAX_RED_THRESHOLD = 220.0, // Ajustar
        STABILITY_WINDOW = 15, // Ajustar
        MIN_STABILITY_COUNT = 5, // Ajustar
        HYSTERESIS = 0.1, // Ajustar
        MIN_CONSECUTIVE_DETECTIONS = 3, // De SignalAnalyzerConfig
        MAX_CONSECUTIVE_NO_DETECTIONS = 5, // De SignalAnalyzerConfig
        QUALITY_LEVELS = 10, // De SignalAnalyzerConfig
        QUALITY_HISTORY_SIZE = 10, // De SignalAnalyzerConfig
        CALIBRATION_SAMPLES = 50, // De CalibrationHandlerConfig, PPGSignalProcessor tiene su propio valor
        TEXTURE_GRID_SIZE = 8, // De FrameProcessorConfig
        ROI_SIZE_FACTOR = 0.6 // De FrameProcessorConfig
    )

    init {
        // La inicialización de los componentes se hará en el método initialize
        // para permitir que sea asíncrona si es necesario (aunque aquí son síncronas)
    }

    override suspend fun initialize(): Promise<void> {
        return coroutineScope {
            // Inicializar todos los componentes
            kalmanFilter = KalmanFilter()
            sgFilter = SavitzkyGolayFilter(windowSize = 9) // Ejemplo de windowSize, ajustar si es necesario
            trendAnalyzer = SignalTrendAnalyzer(historyLength = CONFIG.STABILITY_WINDOW)
            biophysicalValidator = BiophysicalValidator()
            frameProcessor = FrameProcessor(FrameProcessorConfig(CONFIG.TEXTURE_GRID_SIZE, CONFIG.ROI_SIZE_FACTOR))
            calibrationHandler = CalibrationHandler(CalibrationHandlerConfig(CONFIG.CALIBRATION_SAMPLES, CONFIG.MIN_RED_THRESHOLD, CONFIG.MAX_RED_THRESHOLD))
            signalAnalyzer = SignalAnalyzer(SignalAnalyzerConfig(CONFIG.QUALITY_LEVELS, CONFIG.QUALITY_HISTORY_SIZE, CONFIG.MIN_CONSECUTIVE_DETECTIONS, CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS))
            
            resetState()
            println("PPGSignalProcessor initialized")
            // En Kotlin/JS, Promise<void> se puede representar simplemente retornando Unit
            // o, si se interactúa con JS, usando una Promise real. Para un `suspend fun` interno,
            // no se devuelve una Promise directamente. El `suspend` maneja la asincronía.
            // Para cumplir con la interfaz JS, se podría envolver la llamada a esta función suspendida
            // desde JS usando `GlobalScope.promise { initialize() }`.
            // Aquí, dado que la interfaz `SignalProcessor` lo pide, debemos retornar algo compatible.
            // Una forma es no retornar nada explícitamente (Unit) y el llamador JS lo manejará.
            // O usar `CompletableDeferred` si se necesita una Promise real para JS.
            // Por ahora, lo dejo así, y la forma de llamarlo desde JS determinará el puente exacto.
            kotlin.js.Promise<Nothing?> { resolve, _ -> resolve(null) } // Placeholder para cumplir el tipo
        }
    }

    override fun start() {
        if (isProcessing) {
            println("PPGSignalProcessor is already running.")
            return
        }
        isProcessing = true
        isCalibrating = false // Asegurar que no esté en modo calibración al iniciar
        frameProcessedCount = 0
        // Resetear componentes clave, excepto la calibración si ya se hizo
        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        biophysicalValidator.reset()
        // No reseteamos calibrationHandler aquí para mantener la calibración si ya existe.
        signalAnalyzer.reset() // SignalAnalyzer tiene su propia fase de calibración de umbral adaptativo
        
        println("PPGSignalProcessor started.")
    }

    override fun stop() {
        if (!isProcessing) {
            println("PPGSignalProcessor is not running.")
            return
        }
        isProcessing = false
        println("PPGSignalProcessor stopped. Total frames processed: $frameProcessedCount")
    }

    override suspend fun calibrate(): Promise<Boolean> {
        if (isProcessing) {
            // Podríamos permitir la calibración mientras se procesa, o detener y calibrar.
            // Por ahora, la detenemos para simplificar.
            // stop()
        }
        println("Starting calibration...")
        isCalibrating = true
        calibrationHandler.resetCalibration() 
        signalAnalyzer.reset() // También resetea la calibración del umbral adaptativo del analizador
        frameProcessedCount = 0 // Reiniciar contador para la calibración

        // La lógica de calibración en el original implica procesar frames.
        // En un escenario real, esto se haría recibiendo frames en un loop hasta que isCalibrationComplete() sea true.
        // Aquí simulamos esto, pero la estructura de la app debe proveer los frames.
        // La función `calibrate` en TS es `async`, lo que sugiere que podría tomar tiempo.
        // Aquí, como no tenemos un flujo de frames, solo preparamos para la calibración.
        // El método `processFrame` se encargará de pasar los datos a `calibrationHandler` si `isCalibrating` es true.
        // Devolvemos una promesa que se resolverá cuando `isCalibrationComplete` sea true. 
        // Esto es un placeholder, ya que la calibración real depende de llamadas a processFrame.

        // Para simular, podemos simplemente decir que está lista para calibrar.
        // La verdadera finalización de la calibración ocurrirá dentro de `processFrame`.
        // Devolvemos una promesa que se resuelve a true (indicando que la *solicitud* de calibración fue exitosa)
        return kotlin.js.Promise { resolve, _ -> resolve(true) }
    }

    fun processFrame(imageData: ImageDataWrapper) {
        if (!isProcessing && !isCalibrating) {
            // println("Processor is stopped and not calibrating. Skipping frame.")
            return
        }

        try {
            val startTime = MonotonicTimeSource.markNow() // Para medir tiempo de procesamiento

            // 1. Extracción de datos del Frame
            val frameData = frameProcessor.extractFrameData(imageData)
            if (frameData.redValue < CONFIG.MIN_RED_THRESHOLD || frameData.redValue > CONFIG.MAX_RED_THRESHOLD) {
                // Si el valor de rojo está fuera de umbrales básicos, podría no ser una señal útil.
                // Podríamos emitir un error o una señal de baja calidad aquí.
                // Por ahora, continuamos pero la calidad será baja.
                // handleError("low_signal", "Red value out of basic threshold: ${frameData.redValue}")
                // return // Opcional: detener el procesamiento si la señal es demasiado mala inicialmente.
            }

            var processedValue = frameData.redValue

            // 2. Calibración (si está en curso)
            if (isCalibrating) {
                val calibrationComplete = calibrationHandler.handleCalibration(processedValue)
                val calValues = calibrationHandler.getCalibrationValues()
                // Emitir señal de calibración (ejemplo)
                val roi = frameProcessor.detectROI(processedValue, imageData) // ROI para la señal de calibración
                onSignalReady?.invoke(
                    ProcessedSignal(
                        timestamp = System.currentTimeMillis(),
                        rawValue = processedValue,
                        filteredValue = processedValue, // Sin filtrar durante la calibración de este handler
                        quality = if (calibrationComplete) 1.0 else (calibrationHandler.calibrationSamples.size.toDouble() / CONFIG.CALIBRATION_SAMPLES),
                        fingerDetected = false, // Aún no se detecta formalmente
                        roi = roi,
                        perfusionIndex = null
                    )
                )
                if (calibrationComplete) {
                    isCalibrating = false
                    println("Calibration completed. Baseline: ${calValues.baselineRed}, MinT: ${calValues.minRedThreshold}, MaxT: ${calValues.maxRedThreshold}")
                    // Podríamos necesitar reiniciar otros componentes después de la calibración
                    signalAnalyzer.reset() // Para que aprenda con los nuevos umbrales/valores
                    trendAnalyzer.reset()
                    kalmanFilter.reset()
                    sgFilter.reset()
                }
                frameProcessedCount++
                return // Durante la calibración, no hacemos el procesamiento completo de la señal PPG
            }

            // Asegurar que la calibración base esté hecha (la del CalibrationHandler)
            if (!calibrationHandler.isCalibrationComplete()) {
                // handleError("calibration_pending", "Calibration is not yet complete. Please calibrate first.")
                // Podríamos iniciarla automáticamente o esperar.
                // Por ahora, si no está calibrado y no estamos en `isCalibrating`, emitimos error o señal de muy baja calidad.
                 onSignalReady?.invoke(
                    ProcessedSignal(
                        timestamp = System.currentTimeMillis(),
                        rawValue = processedValue,
                        filteredValue = 0.0,
                        quality = 0.0,
                        fingerDetected = false,
                        roi = frameProcessor.detectROI(processedValue, imageData),
                        perfusionIndex = null
                    )
                )
                println("Calibration is not complete. Please run calibrate().")
                return
            }
            
            // Ajustar el valor procesado usando los umbrales de calibración (ejemplo de normalización)
            // Esta es una interpretación, la lógica original de cómo se usan los valores de calibración es crucial.
            // val cal = calibrationHandler.getCalibrationValues()
            // processedValue = (processedValue - cal.minRedThreshold) / (cal.maxRedThreshold - cal.minRedThreshold).takeIf{ it != 0.0 } ?: 0.0
            // processedValue = processedValue.coerceIn(0.0, 1.0) // Normalizar a 0-1

            // 3. Filtrado (Savitzky-Golay y Kalman)
            val sgFiltered = sgFilter.filter(processedValue)
            val kalmanFiltered = kalmanFilter.filter(sgFiltered)

            // 4. Análisis de Tendencia
            val trendResultString = trendAnalyzer.analyzeTrend(kalmanFiltered) // Devuelve un String
            val trendScores = trendAnalyzer.getScores() // Obtener los scores detallados

            // 5. Validación Biofísica
            // Usamos el valor filtrado por Kalman para el PI, o el valor procesado antes de filtrar?
            // El original de BiophysicalValidator.calculatePulsatilityIndex tomaba `value: number`.
            // Usaremos kalmanFiltered.
            val pulsatilityIndex = biophysicalValidator.calculatePulsatilityIndex(kalmanFiltered)
            // Asegurarse que rToGRatio y rToBRatio vengan de FrameData
            val biophysicalScore = biophysicalValidator.validateBiophysicalRange(frameData.redValue, frameData.rToGRatio, frameData.rToBRatio)

            // 6. Actualizar DetectorScores para SignalAnalyzer
            // Los scores de trendAnalyzer (stability, periodicity) y biophysicalValidator deben pasarse
            val currentDetectorScores = DetectorScores(
                redChannel = frameData.redValue, // Valor rojo crudo del frame
                stability = trendScores.stability, // De TrendAnalyzer
                pulsatility = pulsatilityIndex, // De BiophysicalValidator (normalizado si es necesario)
                biophysical = biophysicalScore, // De BiophysicalValidator
                periodicity = trendScores.periodicity, // De TrendAnalyzer
                textureScore = frameData.textureScore
            )
            signalAnalyzer.updateDetectorScores(currentDetectorScores)

            // 7. Análisis de Señal Multi-Detector
            // El `trendResult` original en TS era `any`. Aquí pasamos el `kalmanFiltered` y
            // `signalAnalyzer` usa los scores que actualizamos en el paso anterior.
            val detectionResult = signalAnalyzer.analyzeSignalMultiDetector(kalmanFiltered)

            // 8. ROI Detección/Actualización (puede depender de la calidad de la señal)
            // Podríamos querer actualizar el ROI solo si la detección es buena.
            val roi = if (detectionResult.isFingerDetected || frameProcessedCount % 5 == 0) { // Actualizar ROI si detectado o periodicamente
                frameProcessor.detectROI(kalmanFiltered, imageData)
            } else {
                frameProcessor.roiHistory.lastOrNull() ?: frameProcessor.detectROI(kalmanFiltered, imageData) // Usar el último conocido o re-detectar
            }

            // 9. Perfusión Index (ejemplo, podría ser el mismo que el PI o derivado)
            val perfusionIndex = pulsatilityIndex // Asumiendo que son lo mismo por ahora

            // 10. Ensamblar la señal procesada
            val finalSignal = ProcessedSignal(
                timestamp = System.currentTimeMillis(),
                rawValue = frameData.redValue, // El valor "crudo" después de la extracción inicial del frame
                filteredValue = kalmanFiltered,
                quality = detectionResult.quality,
                fingerDetected = detectionResult.isFingerDetected,
                roi = roi,
                perfusionIndex = perfusionIndex.takeIf { it.isFinite() && it >= 0 }
            )

            lastValues.add(finalSignal.filteredValue)
            if (lastValues.size > CONFIG.BUFFER_SIZE) {
                lastValues.removeAt(0)
            }

            onSignalReady?.invoke(finalSignal)
            frameProcessedCount++

            val duration = startTime.elapsedNow()
            if (frameProcessedCount % 100 == 0) { // Loguear cada 100 frames
                // println("Frame $frameProcessedCount processed in ${duration.inWholeMilliseconds}ms. Quality: ${finalSignal.quality}, Finger: ${finalSignal.fingerDetected}")
                // println("Details: ${detectionResult.detectorDetails}")
            }

        } catch (e: Exception) {
            // En Kotlin/JS, las excepciones de JS pueden ser atrapadas.
            // Es importante manejar errores específicos si es posible.
            handleError("processing_exception", e.message ?: "Unknown error during frame processing: ${e::class.simpleName}")
            // e.printStackTrace() // Para debug en consola JS
        }
    }

    private fun resetState() {
        isProcessing = false
        isCalibrating = false
        frameProcessedCount = 0
        lastValues.clear()

        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        biophysicalValidator.reset()
        calibrationHandler.resetCalibration()
        signalAnalyzer.reset() 
        // frameProcessor.reset() // FrameProcessor también tiene un reset
    }

    private fun handleError(code: String, message: String) {
        val error = ProcessingError(code, message, System.currentTimeMillis())
        onError?.invoke(error)
        // println("Error: [$code] $message") // Loguear error
    }
    
    // Para CoroutineScope
    fun cancelScope() {
        job.cancel()
    }
}

// Se necesita una fuente de tiempo monotónico para medir duraciones de forma fiable.
// En Kotlin/JS puro, no hay una directa equivalente a performance.now() sin acceder al navegador.
// Esta es una implementación básica si no se puede acceder a `performance.now()`.
// Si se ejecuta en el navegador, se puede usar `kotlin.browser.window.performance.now()`.
object MonotonicTimeSource {
    private val initialTimeMillis = System.currentTimeMillis()
    private val initialNanoTime = System.nanoTime()

    fun markNow(): TimeMark {
        return TimeMark(System.nanoTime())
    }

    class TimeMark(private val nanoTime: Long) {
        fun elapsedNow(): Duration {
            val elapsedNanos = System.nanoTime() - nanoTime
            return Duration(elapsedNanos / 1_000_000, (elapsedNanos % 1_000_000).toInt())
        }
    }
    // Simplificación de Duration para este contexto
    data class Duration(val inWholeMilliseconds: Long, val nanoPart: Int) 
} 