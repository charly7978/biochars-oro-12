package modules

import kotlin.math.*
import kotlinx.coroutines.*
import kotlinx.browser.window
import org.w3c.dom.Navigator

// NOTA: La reproducción de audio y la vibración son APIs específicas del navegador/plataforma.
// En Kotlin/JS, se interactuaría con ellas a través de `kotlin.browser.window` o interfaces `external`.
// La traducción directa de AudioContext y navigator.vibrate requerirá definir estas interfaces
// o usar bibliotecas de Kotlin/JS que las abstraigan si existen.
// Por ahora, las partes de audio y vibración se marcarán como placeholders que necesitan adaptación.

// Placeholder para AudioContext y OscillatorNode (deberían ser interfaces externas)
@JsName("AudioContext")
external class ExternalAudioContext {
    fun createOscillator(): ExternalOscillatorNode
    fun createGain(): ExternalGainNode
    val currentTime: Double
    val destination: Any // Debería ser AudioDestinationNode
    fun close(): Promise<Unit>
    fun resume(): Promise<Unit>
    // Añadir más métodos según sea necesario (decodeAudioData, etc.)
}

@JsName("OscillatorNode")
external class ExternalOscillatorNode {
    var type: String // "sine", "square", etc.
    val frequency: ExternalAudioParam
    fun connect(destination: Any) // Debería ser AudioNode o AudioParam
    fun start(time: Double = definedExternally)
    fun stop(time: Double = definedExternally)
    // Añadir más métodos/propiedades según sea necesario
}

@JsName("GainNode")
external class ExternalGainNode {
    val gain: ExternalAudioParam
    fun connect(destination: Any)
    // Añadir más métodos/propiedades según sea necesario
}

@JsName("AudioParam")
external class ExternalAudioParam {
    var value: Double
    fun setValueAtTime(value: Double, startTime: Double)
    fun linearRampToValueAtTime(value: Double, endTime: Double)
    fun exponentialRampToValueAtTime(value: Double, endTime: Double)
}

// Placeholder para API de Vibración
external interface NavigatorWithVibrate : Navigator {
    fun vibrate(pattern: Array<Int>): Boolean
    fun vibrate(duration: Int): Boolean
}


data class HeartBeatResult(
    val bpm: Double,
    val confidence: Double,
    val isPeak: Boolean,
    val filteredValue: Double,
    var arrhythmiaCount: Int, // var para que pueda ser modificado por la clase
    val signalQuality: Double? = null
)

class HeartBeatProcessor : CoroutineScope {
    private val job = Job()
    override val coroutineContext = Dispatchers.Default + job

    // Constantes de configuración (muchas)
    private val DEFAULT_SAMPLE_RATE = 60
    private val DEFAULT_WINDOW_SIZE = 40
    private val DEFAULT_MIN_BPM = 30.0
    private val DEFAULT_MAX_BPM = 220.0
    private val DEFAULT_SIGNAL_THRESHOLD = 0.02
    private val DEFAULT_MIN_CONFIDENCE = 0.30
    private val DEFAULT_DERIVATIVE_THRESHOLD = -0.005
    private val DEFAULT_MIN_PEAK_TIME_MS = 300L // ms
    private val WARMUP_TIME_MS = 1000L // ms

    private val MEDIAN_FILTER_WINDOW = 3
    private val MOVING_AVERAGE_WINDOW = 3
    private val EMA_ALPHA = 0.5
    private val BASELINE_FACTOR = 0.8

    private val BEEP_DURATION = 450 // ms, pero usado en oscillator.stop que toma segundos
    private val BEEP_VOLUME = 1.0
    private val MIN_BEEP_INTERVAL_MS = 600L
    private val VIBRATION_PATTERN = arrayOf(40, 20, 60) // IntArray podría ser más apropiado

    private val LOW_SIGNAL_THRESHOLD = 0.0 // Deshabilitado
    private val LOW_SIGNAL_FRAMES = 25
    private var lowSignalCount = 0

    private var adaptiveSignalThreshold: Double
    private var adaptiveMinConfidence: Double
    private var adaptiveDerivativeThreshold: Double

    private val MIN_ADAPTIVE_SIGNAL_THRESHOLD = 0.05
    private val MAX_ADAPTIVE_SIGNAL_THRESHOLD = 0.4
    private val MIN_ADAPTIVE_MIN_CONFIDENCE = 0.40
    private val MAX_ADAPTIVE_MIN_CONFIDENCE = 0.80
    private val MIN_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.08
    private val MAX_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.005

    private val SIGNAL_BOOST_FACTOR = 1.8
    private val PEAK_DETECTION_SENSITIVITY = 0.6

    private val ADAPTIVE_TUNING_PEAK_WINDOW = 10
    private val ADAPTIVE_TUNING_LEARNING_RATE = 0.20

    // Buffers e historial
    private var recentPeakAmplitudes: MutableList<Double> = mutableListOf()
    private var recentPeakConfidences: MutableList<Double> = mutableListOf()
    private var recentPeakDerivatives: MutableList<Double> = mutableListOf()
    private var peaksSinceLastTuning = 0

    private var signalBuffer: MutableList<Double> = mutableListOf()
    private var medianBuffer: MutableList<Double> = mutableListOf()
    private var movingAverageBuffer: MutableList<Double> = mutableListOf()
    private var smoothedValue: Double = 0.0

    // Audio
    private var audioContext: ExternalAudioContext? = null
    private var heartSoundOscillator: ExternalOscillatorNode? = null
    private var gainNode: ExternalGainNode? = null
    private var lastBeepTime = 0L

    // Estado de detección de picos y BPM
    private var lastPeakTime: Long? = null
    private var previousPeakTime: Long? = null
    private var bpmHistory: MutableList<Double> = mutableListOf()
    private var baseline: Double = 0.0
    private var lastValue: Double = 0.0
    private var values: MutableList<Double> = mutableListOf() // Para la ventana de procesamiento
    private var startTime: Long = 0L
    private var peakConfirmationBuffer: MutableList<Double> = mutableListOf()
    private var lastConfirmedPeak: Boolean = false
    private var smoothBPM: Double = 0.0
    private val BPM_ALPHA = 0.3
    private var peakCandidateIndex: Int? = null
    private var peakCandidateValue: Double = 0.0
    private var isArrhythmiaDetected: Boolean = false
    private var arrhythmiaCountInternal: Int = 0

    private var peakValidationBuffer: MutableList<Double> = mutableListOf()
    private val PEAK_VALIDATION_THRESHOLD = 0.3
    private var lastSignalStrength: Double = 0.0
    private var recentSignalStrengths: MutableList<Double> = mutableListOf()
    private val SIGNAL_STRENGTH_HISTORY = 30

    private var currentSignalQuality: Double = 0.0

    constructor() {
        adaptiveSignalThreshold = DEFAULT_SIGNAL_THRESHOLD
        adaptiveMinConfidence = DEFAULT_MIN_CONFIDENCE
        adaptiveDerivativeThreshold = DEFAULT_DERIVATIVE_THRESHOLD
        startTime = getCurrentTimeMillis()
        initAudio() // Llamar a la función suspendida desde el constructor es posible pero con cuidado
                   // Se puede lanzar en un scope GlobalScope.launch si no debe bloquear.
                   // O hacer `initialize` una función suspendida separada.
                   // Por ahora, asumimos que puede ser síncrono para la inicialización básica del audioContext.
    }

    // `initAudio` era async, ahora suspend. Debe llamarse desde una corutina.
    private fun initAudio() = launch {
        try {
            val context = js("new (window.AudioContext || window.webkitAudioContext)()")
            if (context != null && context.constructor.name == "AudioContext") {
                audioContext = context.unsafeCast<ExternalAudioContext>()
                audioContext?.resume() // Importante para navegadores que auto-pausan
                println("HeartBeatProcessor: Audio Context Initialized and resumed")
                playTestSound(0.3)
            } else {
                 println("HeartBeatProcessor: AudioContext not supported or failed to initialize.")
            }
        } catch (e: dynamic) {
            println("HeartBeatProcessor: Error initializing audio: ${e.message}")
            audioContext = null
        }
    }
    
    // `playTestSound` era async.
    private fun playTestSound(volume: Double = 0.2) = launch {
        val ac = audioContext ?: return@launch
        try {
            // println("HeartBeatProcessor: Reproduciendo sonido de prueba")
            val oscillator = ac.createOscillator()
            val gain = ac.createGain()

            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(440.0, ac.currentTime) // A4
            
            gain.gain.setValueAtTime(0.0, ac.currentTime)
            gain.gain.linearRampToValueAtTime(volume, ac.currentTime + 0.1)
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5)
            
            oscillator.connect(gain)
            gain.connect(ac.destination)
            
            oscillator.start()
            oscillator.stop(ac.currentTime + 0.6)
            // println("HeartBeatProcessor: Sonido de prueba reproducido")
        } catch (e: dynamic) {
            println("HeartBeatProcessor: Error playing test sound: ${e.message}")
        }
    }

    // `playHeartSound` era async.
    private fun playHeartSound(volume: Double = BEEP_VOLUME, playArrhythmiaTone: Boolean) = launch {
        val ac = audioContext ?: return@launch
        if (isInWarmup()) return@launch

        val now = getCurrentTimeMillis()
        if (now - lastBeepTime < MIN_BEEP_INTERVAL_MS) {
            println("HeartBeatProcessor: Ignorando beep - demasiado cerca del anterior: ${now - lastBeepTime}")
            return@launch
        }

        try {
            val navigator = window.navigator.unsafeCast<NavigatorWithVibrate?>()
            navigator?.vibrate(VIBRATION_PATTERN)

            val currentTime = ac.currentTime

            // LUB
            val oscillator1 = ac.createOscillator()
            val gainNode1 = ac.createGain()
            oscillator1.type = "sine"
            oscillator1.frequency.value = 150.0
            gainNode1.gain.setValueAtTime(0.0, currentTime)
            gainNode1.gain.linearRampToValueAtTime(volume * 1.5, currentTime + 0.03)
            gainNode1.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15)
            oscillator1.connect(gainNode1)
            gainNode1.connect(ac.destination)
            oscillator1.start(currentTime)
            oscillator1.stop(currentTime + 0.2)

            // DUB
            val oscillator2 = ac.createOscillator()
            val gainNode2 = ac.createGain()
            val dubStartTime = currentTime + 0.08
            oscillator2.type = "sine"
            oscillator2.frequency.value = 120.0
            gainNode2.gain.setValueAtTime(0.0, dubStartTime)
            gainNode2.gain.linearRampToValueAtTime(volume * 1.5, dubStartTime + 0.03)
            gainNode2.gain.exponentialRampToValueAtTime(0.001, dubStartTime + 0.15)
            oscillator2.connect(gainNode2)
            gainNode2.connect(ac.destination)
            oscillator2.start(dubStartTime)
            oscillator2.stop(dubStartTime + 0.20)
            
            if (playArrhythmiaTone) {
                val oscillator3 = ac.createOscillator()
                val gainNode3 = ac.createGain()
                oscillator3.type = "sine"
                oscillator3.frequency.value = 440.0

                val arrhythmiaSoundStartTime = dubStartTime + 0.05
                val arrhythmiaAttackDuration = 0.02
                val arrhythmiaSustainDuration = 0.10
                val arrhythmiaReleaseDuration = 0.05
                val arrhythmiaAttackEndTime = arrhythmiaSoundStartTime + arrhythmiaAttackDuration
                val arrhythmiaSustainEndTime = arrhythmiaAttackEndTime + arrhythmiaSustainDuration
                val arrhythmiaReleaseEndTime = arrhythmiaSustainEndTime + arrhythmiaReleaseDuration

                gainNode3.gain.setValueAtTime(0.0, arrhythmiaSoundStartTime)
                gainNode3.gain.linearRampToValueAtTime(volume * 0.65, arrhythmiaAttackEndTime)
                gainNode3.gain.setValueAtTime(volume * 0.65, arrhythmiaSustainEndTime) // Changed to setValueAtTime for sustain
                gainNode3.gain.exponentialRampToValueAtTime(0.001, arrhythmiaReleaseEndTime)
                oscillator3.connect(gainNode3)
                gainNode3.connect(ac.destination)
                oscillator3.start(arrhythmiaSoundStartTime)
                oscillator3.stop(arrhythmiaReleaseEndTime + 0.01)
                
                this.isArrhythmiaDetected = false // Reset flag
            }
            val interval = now - lastBeepTime
            this.lastBeepTime = now
            println("HeartBeatProcessor: Latido reproducido. Intervalo: $interval ms, BPM estimado: ${getSmoothBPM().roundToInt()}")
        } catch (e: dynamic) {
            println("HeartBeatProcessor: Error playing heart sound: ${e.message}")
        }
    }

    fun processSignal(valueIn: Double): HeartBeatResult {
        var value = boostSignal(valueIn)
        
        val medVal = medianFilter(value)
        val movAvgVal = calculateMovingAverage(medVal)
        val smoothed = calculateEMA(movAvgVal)
        
        val filteredValue = smoothed

        signalBuffer.add(smoothed)
        if (signalBuffer.size > DEFAULT_WINDOW_SIZE) { 
            signalBuffer.removeAt(0)
        }

        if (signalBuffer.size < 20) {
            return HeartBeatResult(
                bpm = 0.0,
                confidence = 0.0,
                isPeak = false,
                filteredValue = filteredValue,
                arrhythmiaCount = 0,
                signalQuality = 0.0
            )
        }

        baseline = baseline * BASELINE_FACTOR + smoothed * (1 - BASELINE_FACTOR)
        val normalizedValue = smoothed - baseline
        
        trackSignalStrength(abs(normalizedValue))
        autoResetIfSignalIsLow(abs(normalizedValue))

        values.add(smoothed)
        if (values.size > 3) {
            values.removeAt(0)
        }

        var smoothDerivative = smoothed - lastValue
        if (values.size == 3) {
            smoothDerivative = (values[2] - values[0]) / 2.0
        }
        lastValue = smoothed
        
        val peakDetectionResult = enhancedPeakDetection(normalizedValue, smoothDerivative)
        var isPeak = peakDetectionResult.isPeak
        val confidence = peakDetectionResult.confidence
        val rawDerivative = peakDetectionResult.rawDerivative
        
        val isConfirmedPeak = confirmPeak(isPeak, normalizedValue, confidence) // Uses this.lastConfirmedPeak

        currentSignalQuality = calculateSignalQuality(normalizedValue, confidence)

        if (isConfirmedPeak && !isInWarmup()) {
            val now = getCurrentTimeMillis()
            val timeSinceLastPeak = lastPeakTime?.let { now - it } ?: Long.MAX_VALUE

            if (timeSinceLastPeak >= DEFAULT_MIN_PEAK_TIME_MS) {
                if (validatePeak(normalizedValue, confidence)) { // validatePeak always returns true in TS
                    previousPeakTime = lastPeakTime
                    lastPeakTime = now
                    
                    playHeartSound(1.0, this.isArrhythmiaDetected)
                    updateBPM()

                    recentPeakAmplitudes.add(normalizedValue)
                    recentPeakConfidences.add(confidence)
                    if (rawDerivative != null) recentPeakDerivatives.add(rawDerivative)

                    if (recentPeakAmplitudes.size > ADAPTIVE_TUNING_PEAK_WINDOW) recentPeakAmplitudes.removeAt(0)
                    if (recentPeakConfidences.size > ADAPTIVE_TUNING_PEAK_WINDOW) recentPeakConfidences.removeAt(0)
                    if (recentPeakDerivatives.size > ADAPTIVE_TUNING_PEAK_WINDOW) recentPeakDerivatives.removeAt(0)
                    
                    peaksSinceLastTuning++
                    if (peaksSinceLastTuning >= floor(ADAPTIVE_TUNING_PEAK_WINDOW / 2.0).toInt()) {
                        performAdaptiveTuning()
                        peaksSinceLastTuning = 0
                    }
                } else {
                    println("HeartBeatProcessor: Pico rechazado - confianza insuficiente: $confidence")
                    isPeak = false // Update local isPeak if rejected
                }
            } else {
                 isPeak = false // Not a peak if too soon
            }
        } else if (isConfirmedPeak && isInWarmup()){ // if confirmed but in warmup, it's not a "final" peak
            isPeak = false
        }
        
        return HeartBeatResult(
            bpm = getSmoothBPM().roundToInt().toDouble(),
            confidence = if (isPeak) 0.95 else adjustConfidenceForSignalStrength(0.6),
            isPeak = isPeak,
            filteredValue = filteredValue,
            arrhythmiaCount = 0, // TS version also returns 0, seems this is handled externally
            signalQuality = currentSignalQuality
        )
    }

    private fun boostSignal(value: Double): Double {
        if (signalBuffer.size < 10) return value * SIGNAL_BOOST_FACTOR
        
        val recentSignals = signalBuffer.takeLast(10)
        val avgSignal = recentSignals.average()
        val maxSignal = recentSignals.maxOrNull() ?: avgSignal
        val minSignal = recentSignals.minOrNull() ?: avgSignal
        val range = maxSignal - minSignal
        
        var boostFactor = SIGNAL_BOOST_FACTOR
        
        if (range < 1.0) {
            boostFactor = SIGNAL_BOOST_FACTOR * 1.8
        } else if (range < 3.0) {
            boostFactor = SIGNAL_BOOST_FACTOR * 1.4
        } else if (range > 10.0) {
            boostFactor = 1.0
        }
        
        val centered = value - avgSignal
        val boosted = avgSignal + (centered * boostFactor)
        
        return boosted
    }

    private fun trackSignalStrength(amplitude: Double) {
        lastSignalStrength = amplitude
        recentSignalStrengths.add(amplitude)
        
        if (recentSignalStrengths.size > SIGNAL_STRENGTH_HISTORY) {
            recentSignalStrengths.removeAt(0)
        }
    }

    private fun adjustConfidenceForSignalStrength(confidence: Double): Double {
        if (recentSignalStrengths.size < 5) return confidence
        
        val avgStrength = recentSignalStrengths.average()
        
        return if (avgStrength < 0.1) {
            min(1.0, confidence * 0.8)
        } else {
            min(1.0, confidence)
        }
    }

    private fun isInWarmup(): Boolean {
        return getCurrentTimeMillis() - startTime < WARMUP_TIME_MS
    }

    private fun medianFilter(value: Double): Double {
        medianBuffer.add(value)
        if (medianBuffer.size > MEDIAN_FILTER_WINDOW) {
            medianBuffer.removeAt(0)
        }
        val sorted = medianBuffer.sorted()
        return sorted[sorted.size / 2]
    }

    private fun calculateMovingAverage(value: Double): Double {
        movingAverageBuffer.add(value)
        if (movingAverageBuffer.size > MOVING_AVERAGE_WINDOW) {
            movingAverageBuffer.removeAt(0)
        }
        return movingAverageBuffer.average()
    }

    private fun calculateEMA(value: Double): Double {
        smoothedValue = EMA_ALPHA * value + (1 - EMA_ALPHA) * smoothedValue
        return smoothedValue
    }

    fun setArrhythmiaDetected(isDetected: Boolean) {
        this.isArrhythmiaDetected = isDetected
        println("HeartBeatProcessor: Estado de arritmia establecido a $isDetected")
    }

    private fun autoResetIfSignalIsLow(amplitude: Double) {
        if (amplitude < LOW_SIGNAL_THRESHOLD) {
            lowSignalCount++
            if (lowSignalCount >= LOW_SIGNAL_FRAMES) {
                resetDetectionStates()
                adaptiveSignalThreshold = DEFAULT_SIGNAL_THRESHOLD
                adaptiveMinConfidence = DEFAULT_MIN_CONFIDENCE
                adaptiveDerivativeThreshold = DEFAULT_DERIVATIVE_THRESHOLD
                isArrhythmiaDetected = false
                println("HeartBeatProcessor: auto-reset adaptative parameters and arrhythmia flag (low signal).")
            }
        } else {
            lowSignalCount = max(0, lowSignalCount - 1)
        }
    }

    private fun resetDetectionStates() {
        lastConfirmedPeak = false
        peakConfirmationBuffer.clear() // TS clears this
        println("HeartBeatProcessor: auto-reset detection states (low signal).")
    }

    // Based on enhancedPeakDetection in TS
    private fun enhancedPeakDetection(normalizedValue: Double, derivative: Double): 
        Triple<Boolean, Double, Double?> { // isPeak, confidence, rawDerivative
        val now = getCurrentTimeMillis()
        val timeSinceLastPeak = lastPeakTime?.let { now - it } ?: Long.MAX_VALUE

        if (timeSinceLastPeak < DEFAULT_MIN_PEAK_TIME_MS) {
            return Triple(false, 0.0, derivative)
        }
        // TS logic: peak on local maximum implies derivative < 0 (changing from positive to negative)
        // The original TS code checked `derivative < 0`. This might be too simplistic or might relate
        // to how `derivative` is calculated (e.g. if it's smoothed derivative after the peak).
        // Let's stick to the TS logic: `derivative < 0` for `isOverThreshold`.
        val isOverThreshold = derivative < 0 
        val confidence = 1.0 // TS sets confidence to 1 here

        return Triple(isOverThreshold, confidence, derivative)
    }
    
    // Based on confirmPeak in TS
    private fun confirmPeak(
        isPeak: Boolean,
        normalizedValue: Double, // normalizedValue is in TS, but not used in its logic
        confidence: Double // confidence is in TS, but not used in its logic
    ): Boolean {
        // TS peakConfirmationBuffer logic is not used for actual confirmation
        // this.peakConfirmationBuffer.add(normalizedValue);
        // if (this.peakConfirmationBuffer.size > 5) {
        //   this.peakConfirmationBuffer.removeAt(0);
        // }
        
        // Simplified confirmation from TS:
        if (isPeak && !this.lastConfirmedPeak) {
            this.lastConfirmedPeak = true
            return true
        } else if (!isPeak) {
            this.lastConfirmedPeak = false
        }
        return false
    }

    // Based on validatePeak in TS
    private fun validatePeak(peakValue: Double, confidence: Double): Boolean {
        // TS validation is simplified to always return true.
        return true
    }

    private fun updateBPM() {
        val lpt = lastPeakTime ?: return
        val ppt = previousPeakTime ?: return
        val interval = lpt - ppt
        if (interval <= 0) return

        val instantBPM = 60000.0 / interval
        if (instantBPM >= DEFAULT_MIN_BPM && instantBPM <= DEFAULT_MAX_BPM) { 
            bpmHistory.add(instantBPM)
            if (bpmHistory.size > 12) { 
                bpmHistory.removeAt(0)
            }
        }
    }

    private fun getSmoothBPM(): Double {
        val rawBPM = calculateCurrentBPM()
        if (smoothBPM == 0.0 && rawBPM > 0) { 
            smoothBPM = rawBPM
        } else if (rawBPM > 0) { 
            smoothBPM = BPM_ALPHA * rawBPM + (1 - BPM_ALPHA) * smoothBPM
        } else if (bpmHistory.isEmpty()) { 
            smoothBPM = 0.0
        }
        return smoothBPM
    }

    private fun calculateCurrentBPM(): Double {
        if (bpmHistory.size < 2) {
            return 0.0
        }
        val sortedBPM = bpmHistory.sorted()
        val mid = sortedBPM.size / 2
        return if (sortedBPM.size % 2 == 0) {
            (sortedBPM[mid - 1] + sortedBPM[mid]) / 2.0
        } else {
            sortedBPM[mid]
        }
    }

    fun getFinalBPM(): Double { 
        if (bpmHistory.size < 5) {
            return getSmoothBPM().roundToInt().toDouble()
        }
        val sorted = bpmHistory.sorted()
        val cut = floor(sorted.size * 0.2).toInt()
        val finalSet = sorted.subList(cut, sorted.size - cut)
        
        if (finalSet.isEmpty()) {
            return getSmoothBPM().roundToInt().toDouble()
        }
        return finalSet.average().roundToInt().toDouble()
    }

    fun reset() {
        signalBuffer.clear()
        medianBuffer.clear()
        movingAverageBuffer.clear()
        peakConfirmationBuffer.clear()
        bpmHistory.clear()
        values.clear()
        smoothBPM = 0.0
        lastPeakTime = null
        previousPeakTime = null
        lastConfirmedPeak = false
        lastBeepTime = 0L
        baseline = 0.0
        lastValue = 0.0
        smoothedValue = 0.0
        startTime = getCurrentTimeMillis()
        lowSignalCount = 0

        adaptiveSignalThreshold = DEFAULT_SIGNAL_THRESHOLD
        adaptiveMinConfidence = DEFAULT_MIN_CONFIDENCE
        adaptiveDerivativeThreshold = DEFAULT_DERIVATIVE_THRESHOLD
        recentPeakAmplitudes.clear()
        recentPeakConfidences.clear()
        recentPeakDerivatives.clear()
        peaksSinceLastTuning = 0
        
        isArrhythmiaDetected = false
        peakValidationBuffer.clear()
        currentSignalQuality = 0.0 // Reset signal quality
        println("HeartBeatProcessor: Full reset including adaptive parameters and arrhythmia flag.")
    }

    fun getRRIntervals(): Pair<List<Double>, Long?> {
        val rrIntervals = bpmHistory.map { bpm -> 60000.0 / bpm }
        return Pair(rrIntervals, lastPeakTime)
    }
  
    private fun performAdaptiveTuning() {
        if (isInWarmup() || recentPeakAmplitudes.size < 4) {
            return
        }

        if (recentPeakAmplitudes.isNotEmpty()) {
            val avgAmplitude = recentPeakAmplitudes.average()
            var targetSignalThreshold = avgAmplitude * 0.45
            val learningRate = ADAPTIVE_TUNING_LEARNING_RATE
            
            adaptiveSignalThreshold = adaptiveSignalThreshold * (1 - learningRate) + targetSignalThreshold * learningRate
            adaptiveSignalThreshold = adaptiveSignalThreshold.coerceIn(MIN_ADAPTIVE_SIGNAL_THRESHOLD, MAX_ADAPTIVE_SIGNAL_THRESHOLD)
        }

        if (recentPeakConfidences.isNotEmpty()) {
            val avgConfidence = recentPeakConfidences.average()
            var targetMinConfidence = adaptiveMinConfidence 

            if (avgConfidence < 0.5) {
                targetMinConfidence = adaptiveMinConfidence - 0.08
            } else if (avgConfidence > 0.80 && recentSignalStrengths.size > 5) {
                val avgStrength = recentSignalStrengths.average()
                if (avgStrength > 0.25) {
                    targetMinConfidence = adaptiveMinConfidence + 0.01
                }
            }
            
            adaptiveMinConfidence = adaptiveMinConfidence * (1 - ADAPTIVE_TUNING_LEARNING_RATE) + targetMinConfidence * ADAPTIVE_TUNING_LEARNING_RATE
            adaptiveMinConfidence = adaptiveMinConfidence.coerceIn(MIN_ADAPTIVE_MIN_CONFIDENCE, MAX_ADAPTIVE_MIN_CONFIDENCE)
        }
        
        if (recentPeakDerivatives.isNotEmpty()) {
            val avgDerivative = recentPeakDerivatives.average()
            var targetDerivativeThreshold = avgDerivative * 0.25

            adaptiveDerivativeThreshold = adaptiveDerivativeThreshold * (1 - ADAPTIVE_TUNING_LEARNING_RATE) + targetDerivativeThreshold * ADAPTIVE_TUNING_LEARNING_RATE
            adaptiveDerivativeThreshold = adaptiveDerivativeThreshold.coerceIn(MIN_ADAPTIVE_DERIVATIVE_THRESHOLD, MAX_ADAPTIVE_DERIVATIVE_THRESHOLD)
        }
        
        val avgSignalStrengthStr = if (recentSignalStrengths.isNotEmpty()) {
            recentSignalStrengths.average().toString().take(5)
        } else "N/A"

        println("HeartBeatProcessor: Adaptive tuning updated, signalThreshold: ${adaptiveSignalThreshold.toString().take(5)}, minConfidence: ${adaptiveMinConfidence.toString().take(5)}, derivativeThreshold: ${adaptiveDerivativeThreshold.toString().take(5)}, avgSignalStrength: $avgSignalStrengthStr, currentSignalQuality: $currentSignalQuality")
    }
  
    fun getSignalQuality(): Double {
        return currentSignalQuality
    }

    private fun calculateSignalQuality(normalizedValue: Double, confidence: Double): Double {
        if (signalBuffer.size < 10) {
            currentSignalQuality = min(currentSignalQuality + 5, 30.0) // Incremento gradual
            return currentSignalQuality
        }
        
        val recentSignals = signalBuffer.takeLast(20)
        val avgSignal = recentSignals.average()
        val maxSignal = recentSignals.maxOrNull() ?: 0.0
        val minSignal = recentSignals.minOrNull() ?: 0.0
        val range = maxSignal - minSignal
        
        var amplitudeQuality = 0.0
        var stabilityQuality = 0.0
        var rhythmQuality = 0.0
        
        amplitudeQuality = min(abs(normalizedValue) * 100, 40.0)
        
        if (range > 0.01 && abs(avgSignal) > 1e-6) { // Avoid division by zero or near-zero
            val variability = range / abs(avgSignal) // Use abs(avgSignal)
            stabilityQuality = when {
                variability < 0.5 -> 30.0
                variability < 1.0 -> 20.0
                variability < 2.0 -> 10.0
                else -> 5.0
            }
        } else if (range <= 0.01) { // Very stable or flat signal
             stabilityQuality = 5.0 // Low quality if flat, potentially higher if stable oscillation
        }

        if (bpmHistory.size >= 3) {
            val recentBPMs = bpmHistory.takeLast(3)
            val bpmVariance = (recentBPMs.maxOrNull() ?: 0.0) - (recentBPMs.minOrNull() ?: 0.0)
            
            rhythmQuality = when {
                bpmVariance < 5 -> 30.0
                bpmVariance < 10 -> 20.0
                bpmVariance < 15 -> 10.0
                else -> 5.0
            }
        }
        
        var totalQuality = amplitudeQuality + stabilityQuality + rhythmQuality
        
        if (confidence < 0.6 && confidence > 1e-6) { // Avoid division by zero
            totalQuality *= (confidence / 0.6)
        } else if (confidence <= 1e-6) {
            totalQuality *= 0.1 // Heavily penalize near-zero confidence
        }
        
        // Suavizado EMA para la calidad
        currentSignalQuality = currentSignalQuality * 0.7 + totalQuality * 0.3
        
        return currentSignalQuality.coerceIn(0.0, 100.0).roundToInt().toDouble()
    }

    private fun getCurrentTimeMillis(): Long {
        return kotlinx.datetime.Clock.System.now().toEpochMilliseconds()
    }

    fun cancelScope() {
        job.cancel()
        audioContext?.close()?.catch { e -> println("Error closing AudioContext: ${e.message}") }
    }
} 