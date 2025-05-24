package pages

import androidx.compose.runtime.*
import androidx.compose.web.events.Event // Required for preventScroll
import components.*
import composables.ToastState // For future use
import composables.ToastType // For future use
import kotlinx.coroutines.*
import org.jetbrains.compose.web.attributes.disabled
import org.jetbrains.compose.web.css.*
import org.jetbrains.compose.web.dom.*
import org.w3c.dom.Document
import org.w3c.dom.Element
import org.w3c.dom.HTMLBodyElement
import org.w3c.dom.mediacapture.MediaStream
import org.w3c.dom.mediacapture.MediaStreamTrack
import org.w3c.dom.ImageBitmap
import org.w3c.dom.ImageData
import org.w3c.dom.CanvasRenderingContext2D
import org.w3c.dom.HTMLCanvasElement
import kotlin.js.Promise
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.js.timers.clearInterval
import kotlinx.js.timers.setInterval
import externals.*
import kotlinx.serialization.Serializable
import types.*


// External interfaces for browser APIs with vendor prefixes
@JsName("screen")
external val jsScreen: JsScreen?

@JsName("Element")
external interface ElementWithFullscreen : Element {
    fun webkitRequestFullscreen()
    fun msRequestFullscreen()
    fun mozRequestFullScreen()
}

@JsName("Document")
external interface DocumentWithFullscreenExit : Document {
    fun webkitExitFullscreen()
    fun msExitFullscreen()
    fun mozCancelFullScreen()
    val webkitFullscreenElement: Element?
    val msFullscreenElement: Element?
    val mozFullScreenElement: Element?
}


@Composable
fun IndexPage() {
    var isMonitoring by remember { mutableStateOf(false) }
    var isCameraOn by remember { mutableStateOf(false) }
    var signalQuality by remember { mutableStateOf(0) }
    var vitalSigns by remember { mutableStateOf(VitalSignsData()) }
    var heartRate by remember { mutableStateOf(0) }
    var ppgRawValue by remember { mutableStateOf(0f) } // for PPGSignalMeter's ppgValue
    var beatMarker by remember { mutableStateOf(0) } // For PPGSignalMeter's value (0 or 1)
    var arrhythmiaCount by remember { mutableStateOf<Any>("--") }
    var elapsedTime by remember { mutableStateOf(0) }
    var showResults by remember { mutableStateOf(false) }
    var isCalibratingState by remember { mutableStateOf(false) } // Renamed to avoid conflict with vitalSigns.calibration.isCalibrating
    var calibrationProgressUI by remember { mutableStateOf<CalibrationProgressData?>(null) } // For UI updates from vitalSignsProcessor
    
    var measurementTimerId: Int? by remember { mutableStateOf(null) }
    var lastArrhythmiaData by remember { mutableStateOf<ArrhythmiaData?>(null) }
    var isFullscreen by remember { mutableStateOf(false) }
    var rrIntervals by remember { mutableStateOf<List<Double>>(emptyList()) }
    var arrhythmiaToastShownThisEpisode by remember { mutableStateOf(false) }
    var currentArrhythmiaStateNotifiedToHeartBeat by remember { mutableStateOf(false) }

    var lastSignalState by remember { mutableStateOf<ProcessedSignal?>(null) }
    var videoStreamState by remember { mutableStateOf<MediaStream?>(null) }
    var imageCaptureState by remember { mutableStateOf<ImageCapture?>(null) }
    var animationFrameId by remember { mutableStateOf<Int?>(null) }

    val scope = rememberCoroutineScope()
    var calibrationVisualsJob by remember { mutableStateOf<Job?>(null) } // For the visual animation of calibration
    var calibrationTimeoutJob by remember { mutableStateOf<Job?>(null) }


    val ppgSignalProcessor = remember {
        PPGSignalProcessor(
            onSignalReady = { signal ->
                lastSignalState = signal
                console.log("[DIAG] IndexPage.kt: onSignalReady", signal)
            },
            onError = { error ->
                console.error("PPGSignalProcessor Error: ", error)
                ToastState.showToast("Error en procesador PPG: ${error.message}", ToastType.ERROR)
            }
        )
    }

    val heartBeatProcessor = remember { HeartBeatProcessor() }
    val vitalSignsProcessor = remember { VitalSignsProcessor() }


    fun enterFullScreen() {
        scope.launch {
            if (!isFullscreen) {
                val docEl = document.documentElement as? ElementWithFullscreen
                try {
                    when {
                        jsScreen?.orientation?.lock != null -> {
                            (jsScreen.orientation.lock("portrait") as Promise<Unit>).then {
                                console.log("Orientación portrait bloqueada")
                            }.catch { err ->
                                console.log("Error al bloquear la orientación:", err)
                            }
                        }
                    }
                    when {
                        document.documentElement?.requestFullscreen != null -> document.documentElement?.requestFullscreen()
                        docEl?.webkitRequestFullscreen != null -> docEl.webkitRequestFullscreen()
                        docEl?.msRequestFullscreen != null -> docEl.msRequestFullscreen()
                        docEl?.mozRequestFullScreen != null -> docEl.mozRequestFullScreen()
                    }
                    isFullscreen = true
                    console.log("Pantalla completa activada")
                } catch (err: dynamic) {
                    console.log("Error al entrar en pantalla completa:", err)
                }
            }
        }
    }

    fun exitFullScreen() {
        if (isFullscreen) {
            val doc = document as DocumentWithFullscreenExit
            try {
                when {
                    jsScreen?.orientation?.unlock != null -> jsScreen.orientation.unlock()
                }
                when {
                    doc.exitFullscreen != null -> doc.exitFullscreen()
                    doc.webkitExitFullscreen != null -> doc.webkitExitFullscreen()
                    doc.msExitFullscreen != null -> doc.msExitFullscreen()
                    doc.mozCancelFullScreen != null -> doc.mozCancelFullScreen()
                }
                isFullscreen = false
                console.log("Pantalla completa desactivada")
            } catch (err: dynamic) {
                console.log("Error al salir de pantalla completa:", err)
            }
        }
    }

    DisposableEffect(Unit) {
        val onFullscreenChange = {
            val doc = document as DocumentWithFullscreenExit
            isFullscreen = doc.fullscreenElement != null ||
                    doc.webkitFullscreenElement != null ||
                    doc.msFullscreenElement != null ||
                    doc.mozFullScreenElement != null
            Unit // Ensure the lambda returns Unit
        }

        document.addEventListener("fullscreenchange", onFullscreenChange)
        document.addEventListener("webkitfullscreenchange", onFullscreenChange)
        document.addEventListener("mozfullscreenchange", onFullscreenChange)
        document.addEventListener("MSFullscreenChange", onFullscreenChange)
        
        // Auto enter fullscreen
        scope.launch {
            delay(1000) // Small delay
            enterFullScreen()
        }

        onDispose {
            document.removeEventListener("fullscreenchange", onFullscreenChange)
            document.removeEventListener("webkitfullscreenchange", onFullscreenChange)
            document.removeEventListener("mozfullscreenchange", onFullscreenChange)
            document.removeEventListener("MSFullscreenChange", onFullscreenChange)
            exitFullScreen() // Ensure exit fullscreen on dispose
        }
    }


    DisposableEffect(Unit) {
        val preventScroll: (Event) -> Unit = { e -> e.preventDefault() }

        val options = js("{ passive: false }") // Create a JS object for options

        document.body?.addEventListener("touchmove", preventScroll, options)
        document.body?.addEventListener("scroll", preventScroll, options)

        onDispose {
            document.body?.removeEventListener("touchmove", preventScroll, options)
            document.body?.removeEventListener("scroll", preventScroll, options)
        }
    }
    
    fun finalizeMeasurement() {
        console.log("Finalizando medición: manteniendo resultados")
        if (vitalSignsProcessor.isCurrentlyCalibrating()) { // Check actual calibrating state
            console.log("Calibración en progreso al finalizar, forzando finalización")
            vitalSignsProcessor.forceCalibrationCompletion()
        }
        isMonitoring = false
        isCameraOn = false
        isCalibratingState = false // Update UI calibrating state
        ppgSignalProcessor.stop()

        measurementTimerId?.let { clearInterval(it) }
        measurementTimerId = null

        videoStreamState?.getVideoTracks()?.forEach { it.stop() }
        videoStreamState = null
        imageCaptureState = null
        animationFrameId?.let { window.cancelAnimationFrame(it) }
        animationFrameId = null
        
        val savedResults = vitalSignsProcessor.reset() // Now calls the actual method
        savedResults?.let {
            vitalSigns = it
            showResults = true
        }
        
        elapsedTime = 0
        signalQuality = 0
        calibrationProgressUI = null // Clear UI progress
        calibrationVisualsJob?.cancel()
        calibrationTimeoutJob?.cancel()
        arrhythmiaToastShownThisEpisode = false
        currentArrhythmiaStateNotifiedToHeartBeat = false
        ToastState.showToast("Medición finalizada.", ToastType.INFO)
    }
    
    fun startAutoCalibration() {
        console.log("Iniciando auto-calibración real con indicadores visuales")
        isCalibratingState = true // Set UI calibrating state
        vitalSignsProcessor.startCalibration() // Call actual method

        // The actual progress update will come from vitalSignsProcessor.processSignal
        // This job is for any additional UI animation if needed, or can be removed if progress comes solely from processor
        calibrationVisualsJob?.cancel()
        calibrationVisualsJob = scope.launch {
            // This loop can be used to *display* the progress that `vitalSignsProcessor` is calculating internally
            // Or, if the processor itself doesn't provide fine-grained progress, this can simulate it.
            // For now, we assume vitalSignsProcessor.processSignal will update vitalSigns.calibration which is then observed.
            while(vitalSignsProcessor.isCurrentlyCalibrating() && isActive) {
                // The calibrationProgressUI state will be updated in the LaunchedEffect based on vitalSigns.calibration
                delay(200) // Check periodically
            }
            if (isActive && !vitalSignsProcessor.isCurrentlyCalibrating()) {
                 isCalibratingState = false
                 calibrationProgressUI = vitalSignsProcessor.getCalibrationProgress() // Get final state
                 ToastState.showToast("Calibración completada/detenida.", ToastType.SUCCESS)
            }
        }

        calibrationTimeoutJob?.cancel()
        calibrationTimeoutJob = scope.launch {
            delay(VitalSignsProcessor.CALIBRATION_DURATION_MS.toLong() + 1000) // Use companion object constant
            if (vitalSignsProcessor.isCurrentlyCalibrating()) {
                console.log("Forzando finalización de calibración UI por tiempo límite (visual)")
                vitalSignsProcessor.forceCalibrationCompletion() // Ensure processor also completes
                calibrationVisualsJob?.cancel() 
                isCalibratingState = false
                calibrationProgressUI = vitalSignsProcessor.getCalibrationProgress()
                ToastState.showToast("Calibración (visual) falló/timeout.", ToastType.WARNING)
            }
        }
    }

    fun startMonitoring() {
        if (isMonitoring) {
            finalizeMeasurement()
        } else {
            enterFullScreen()
            isMonitoring = true
            isCameraOn = true
            showResults = false
            
            scope.launch {
                try {
                    ppgSignalProcessor.initialize()
                    ppgSignalProcessor.start()
                } catch (e: Exception) {
                    ToastState.showToast("Error al iniciar el monitor: ${e.message}", ToastType.ERROR)
                    isMonitoring = false; isCameraOn = false; return@launch
                }
            }

            elapsedTime = 0
            // Reset some vital signs immediately for UI responsiveness
            vitalSigns = VitalSignsData(arrhythmiaStatus = "SIN ARRITMIAS|0") 
            heartRate = 0; signalQuality = 0; lastArrhythmiaData = null; arrhythmiaCount = "--"
            
            startAutoCalibration()
            
            measurementTimerId?.let { clearInterval(it) }
            measurementTimerId = setInterval({
                elapsedTime++
                if (elapsedTime >= 30) {
                    finalizeMeasurement()
                }
            }, 1000)
        }
    }
    
    fun handleReset() {
        console.log("Reseteando completamente la aplicación")
        finalizeMeasurement() // Ensure everything is stopped first

        isMonitoring = false
        isCameraOn = false
        showResults = false
        isCalibratingState = false
        
        ppgSignalProcessor.stop() // ensure stop if finalize didn't catch it
        vitalSignsProcessor.fullReset() // Call actual method

        calibrationVisualsJob?.cancel()
        calibrationTimeoutJob?.cancel()

        elapsedTime = 0
        heartRate = 0
        ppgRawValue = 0f
        beatMarker = 0
        vitalSigns = VitalSignsData()
        arrhythmiaCount = "--"
        signalQuality = 0
        lastArrhythmiaData = null
        calibrationProgressUI = null
        rrIntervals = emptyList()
        arrhythmiaToastShownThisEpisode = false
        currentArrhythmiaStateNotifiedToHeartBeat = false
        ToastState.showToast("Monitor reseteado.", ToastType.INFO)
    }

    fun handleToggleMonitoring() {
        if (isMonitoring) {
            finalizeMeasurement()
        } else {
            startMonitoring()
        }
    }

    LaunchedEffect(lastSignalState) {
        lastSignalState?.let { signal ->
            if (signal.fingerDetected && isMonitoring) {
                ppgRawValue = signal.rawValue.toFloat()
                val heartBeatResult = heartBeatProcessor.processSignal(signal.filteredValue)
                heartRate = heartBeatResult.bpm
                beatMarker = if (heartBeatResult.isPeak) 1 else 0
                heartBeatResult.rrData?.intervals?.let { rrIntervals = it }

                val vitalsResult = vitalSignsProcessor.processSignal(signal.filteredValue, heartBeatResult.rrData)
                
                vitalSigns = vitalsResult // Update main vital signs state

                vitalsResult.calibration?.let {
                    isCalibratingState = it.isCalibrating
                    calibrationProgressUI = it
                }

                vitalsResult.lastArrhythmiaData?.let { arrData ->
                    lastArrhythmiaData = arrData
                    val parts = vitalsResult.arrhythmiaStatus.split('|')
                    arrhythmiaCount = parts.getOrNull(1) ?: "0"
                    val isArrhythmiaCurrentlyDetected = parts.getOrNull(0) == "ARRITMIA DETECTADA"
                    
                    if (isArrhythmiaCurrentlyDetected != currentArrhythmiaStateNotifiedToHeartBeat) {
                        heartBeatProcessor.setArrhythmiaDetected(isArrhythmiaCurrentlyDetected)
                        currentArrhythmiaStateNotifiedToHeartBeat = isArrhythmiaCurrentlyDetected
                    }

                    if (isArrhythmiaCurrentlyDetected && !arrhythmiaToastShownThisEpisode) {
                        ToastState.showToast("¡Arritmia detectada! Sonido distintivo activado.", ToastType.WARNING)
                        arrhythmiaToastShownThisEpisode = true
                    } else if (!isArrhythmiaCurrentlyDetected && arrhythmiaToastShownThisEpisode) {
                        // Reset flag if arrhythmia is no longer detected, so it can be shown again if it reappears
                        arrhythmiaToastShownThisEpisode = false
                    }
                }
                signalQuality = signal.quality
            } else if (!signal.fingerDetected && isMonitoring) {
                // If finger is lost during monitoring, reset arrhythmia toast shown flag
                if (arrhythmiaToastShownThisEpisode) arrhythmiaToastShownThisEpisode = false 
                if (currentArrhythmiaStateNotifiedToHeartBeat) {
                     heartBeatProcessor.setArrhythmiaDetected(false)
                     currentArrhythmiaStateNotifiedToHeartBeat = false
                }
            }
        }
    }

    val tempCanvas = remember { document.createElement("canvas") as HTMLCanvasElement }
    val tempCtx = remember(tempCanvas) { tempCanvas.getContext("2d", js("{willReadFrequently: true}")) as CanvasRenderingContext2D? }
    
    val enhanceCanvas = remember { document.createElement("canvas") as HTMLCanvasElement }
    val enhanceCtx = remember(enhanceCanvas) { 
        enhanceCanvas.width = 320
        enhanceCanvas.height = 240
        enhanceCanvas.getContext("2d", js("{willReadFrequently: true}")) as CanvasRenderingContext2D? 
    }


    suspend fun processImage() {
        if (!isMonitoring || imageCaptureState == null || tempCtx == null || enhanceCtx == null) {
            if (isMonitoring) animationFrameId = window.requestAnimationFrame { scope.launch { processImage() } }
            return
        }

        try {
            val frame = imageCaptureState!!.grabFrame().await() as ImageBitmap // Cast needed
            
            val targetWidth = minOf(320, frame.width)
            val targetHeight = minOf(240, frame.height)

            tempCanvas.width = targetWidth
            tempCanvas.height = targetHeight
            
            tempCtx.drawImage(frame, 0.0, 0.0, frame.width.toDouble(), frame.height.toDouble(), 0.0, 0.0, targetWidth.toDouble(), targetHeight.toDouble())
            
            // Enhance image for PPG detection
            enhanceCtx.clearRect(0.0, 0.0, enhanceCanvas.width.toDouble(), enhanceCanvas.height.toDouble())
            enhanceCtx.drawImage(tempCanvas, 0.0, 0.0, targetWidth.toDouble(), targetHeight.toDouble())
            
            // Optional: Adjustments to enhance red channel (subtle)
            enhanceCtx.globalCompositeOperation = "source-over"
            enhanceCtx.fillStyle = "rgba(255,0,0,0.05)"
            enhanceCtx.fillRect(0.0, 0.0, enhanceCanvas.width.toDouble(), enhanceCanvas.height.toDouble())
            enhanceCtx.globalCompositeOperation = "source-over" // Reset

            val imageData = enhanceCtx.getImageData(0.0, 0.0, enhanceCanvas.width.toDouble(), enhanceCanvas.height.toDouble())
            ppgSignalProcessor.processFrame(imageData)

        } catch (error: dynamic) {
            console.error("Error capturando frame:", error)
            ToastState.showToast("Error procesando imagen.", ToastType.ERROR)
        }

        if (isMonitoring) {
            animationFrameId = window.requestAnimationFrame { scope.launch { processImage() } }
        }
    }


    fun handleStreamReady(stream: MediaStream) {
        if (!isMonitoring) return

        videoStreamState = stream
        val videoTrack = stream.getVideoTracks().firstOrNull()
        if (videoTrack == null) {
            console.error("No video track found in the stream.")
            ToastState.showToast("No se encontró pista de video.", ToastType.ERROR)
            return
        }

        imageCaptureState = ImageCapture(videoTrack)

        scope.launch {
            try {
                val capabilities = videoTrack.getCapabilities()
                if (capabilities.torch == true) { // Check if torch is a boolean and true
                    console.log("Activando linterna para mejorar la señal PPG")
                    videoTrack.applyConstraints(MediaTrackConstraints(advanced = arrayOf(MediaTrackConstraintSet(torch = true))))
                        .catch { err -> console.error("Error activando linterna:", err) }
                } else {
                    console.warn("Esta cámara no tiene linterna disponible o torch capability is not a boolean true.")
                }
            } catch(e: dynamic) {
                console.warn("Error checking or applying torch constraints: ", e)
            }

            animationFrameId?.let { window.cancelAnimationFrame(it) } // Cancel previous before starting new
            animationFrameId = window.requestAnimationFrame { scope.launch { processImage() } }
        }
    }
    
    // Main layout
    Div(attrs = {
        classes("fixed", "inset-0", "flex", "flex-col", "bg-black")
        style {
            height(100.vh)
            width(100.vw)
            maxWidth(100.vw)
            maxHeight(100.vh)
            overflow("hidden")
            paddingTop("env(safe-area-inset-top)")
            paddingBottom("env(safe-area-inset-bottom)")
        }
    }) {

        // Debug overlay for RR intervals
        if (rrIntervals.isNotEmpty()) {
            Div(attrs = {
                classes("absolute", "top-4", "left-4", "text-white", "z-20", "bg-black/50", "p-2", "rounded")
            }) {
                Text("Últimos intervalos RR: ${rrIntervals.joinToString { "${it.toInt()} ms" }}")
            }
        }

        // Fullscreen re-enter button
        if (!isFullscreen) {
            Button(attrs = {
                onClick { enterFullScreen() }
                classes("fixed", "inset-0", "z-50", "w-full", "h-full", "flex", "items-center", "justify-center", "bg-black/90", "text-white")
            }) {
                Div(attrs = { classes("text-center", "p-4", "bg-gray-800", "rounded-lg", "backdrop-blur-sm") }) { // bg-primary-20 mapped to bg-gray-800
                    Svg(attrs = {
                        xmlns("http://www.w3.org/2000/svg")
                        classes("h-12", "w-12", "mx-auto", "mb-2")
                        fill("none")
                        viewBox("0 0 24 24")
                        stroke("currentColor")
                    }) {
                        Path(attrs = {
                            strokeLinecap("round")
                            strokeLinejoin("round")
                            strokeWidth("2")
                            d("M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5m11 5v-4m0 4h-4m4 0l-5-5")
                        })
                    }
                    P(attrs= {classes("text-lg", "font-semibold")}) { Text("Toca para modo pantalla completa") }
                }
            }
        }

        Div(attrs = { classes("flex-1", "relative") }) {
            Div(attrs = { classes("absolute", "inset-0") }) {
                CameraViewComposable(
                    isMonitoring = isCameraOn,
                    onStreamReady = { stream -> handleStreamReady(stream) },
                    isFingerDetected = lastSignalState?.fingerDetected ?: false,
                    signalQuality = signalQuality
                )
            }

            Div(attrs = { classes("relative", "z-10", "h-full", "flex", "flex-col") }) {
                // Header for signal quality and finger detection status
                Div(attrs = {
                    classes("px-4", "py-2", "flex", "justify-around", "items-center", "bg-black/20")
                }) {
                    Div(attrs = { classes("text-white", "text-lg") }) { Text("Calidad: $signalQuality%") }
                     Div(attrs = { classes("text-white", "text-lg") }) {
                        Text(if (lastSignalState?.fingerDetected == true) "Huella Detectada" else "Huella No Detectada")
                    }
                }

                // PPG Signal Meter Area
                Div(attrs = { classes("flex-1") }) {
                    PPGSignalMeter(
                        quality = lastSignalState?.quality ?: 0,
                        ppgValue = ppgRawValue,
                        isFingerDetected = lastSignalState?.fingerDetected ?: false,
                        arrhythmiaStatus = vitalSigns.arrhythmiaStatus,
                        rawArrhythmiaData = lastArrhythmiaData,
                        preserveResults = showResults,
                        onStartMeasurement = { startMonitoring() },
                        onReset = { handleReset() }
                    )
                }
                
                // Vitals Display Area
                Div(attrs = {
                    classes("absolute", "inset-x-0", "bg-black/10", "px-4", "py-6")
                    style {
                        top(55.percent) 
                        bottom(60.px)   // Space for buttons
                    }
                }) {
                    Div(attrs = { classes("grid", "grid-cols-3", "gap-4", "place-items-center") }) {
                        VitalSign("FRECUENCIA CARDÍACA", heartRate.takeIf { it > 0 }?.toString() ?: "--", "BPM", highlighted = showResults)
                        VitalSign("SPO2", vitalSigns.spo2.takeIf { it > 0 }?.toString() ?: "--", "%", highlighted = showResults)
                        VitalSign("PRESIÓN ARTERIAL", vitalSigns.pressure, "mmHg", highlighted = showResults)
                        VitalSign("HEMOGLOBINA", vitalSigns.hemoglobin.takeIf { it > 0 }?.toString() ?: "--", "g/dL", highlighted = showResults)
                        VitalSign("GLUCOSA", vitalSigns.glucose.takeIf { it > 0 }?.toString() ?: "--", "mg/dL", highlighted = showResults)
                        VitalSign(
                            "COLESTEROL/TRIGL.",
                            "${vitalSigns.lipids.totalCholesterol.takeIf { it > 0 } ?: "--"}/${vitalSigns.lipids.triglycerides.takeIf { it > 0 } ?: "--"}",
                            "mg/dL",
                             highlighted = showResults
                        )
                    }
                }


                // Bottom Buttons Area
                Div(attrs = {
                    classes("absolute", "inset-x-0", "bottom-4", "flex", "gap-4", "px-4")
                }) {
                    Div(attrs = { classes("w-1/2") }) {
                        MonitorButton(
                            text = if (isMonitoring) "DETENER ($elapsedTime s)" else "INICIAR MEDICIÓN",
                            onClick = { handleToggleMonitoring() },
                            classes = if (isMonitoring) "bg-red-500 hover:bg-red-700" else "bg-green-500 hover:bg-green-700"
                        )
                    }
                    Div(attrs = { classes("w-1/2") }) {
                        MonitorButton(
                            text = "RESETEAR",
                            onClick = { handleReset() },
                            classes = "bg-gray-500 hover:bg-gray-700"
                        ) {
                            if (isMonitoring) { 
                                disabled()
                            }
                        }
                    }
                }
            }
        }
    }
} 