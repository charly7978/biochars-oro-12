package modules

import kotlin.math.*
import kotlinx.coroutines.*

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
}

// Placeholder para API de Vibración
external object navigator {
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
        startTime = System.currentTimeMillis()
        initAudio() // Llamar a la función suspendida desde el constructor es posible pero con cuidado
                   // Se puede lanzar en un scope GlobalScope.launch si no debe bloquear.
                   // O hacer `initialize` una función suspendida separada.
                   // Por ahora, asumimos que puede ser síncrono para la inicialización básica del audioContext.
    }

    // `initAudio` era async, ahora suspend. Debe llamarse desde una corutina.
    private fun initAudio() { // No puede ser suspend si se llama desde constructor no suspendido
        // Esta inicialización puede fallar o ser bloqueante, idealmente fuera del constructor directo.
        // O envolver la creación del AudioContext en un try-catch.
        try {
            // En Kotlin/JS, `new AudioContext()` se haría `js("new (window.AudioContext || window.webkitAudioContext)<y_bin_473>")`
            // o usando la interfaz externa directamente si está disponible globalmente.
            val context = js("new (window.AudioContext || window.webkitAudioContext)()")
            if (context != null && context is ExternalAudioContext) {
                audioContext = context
                gainNode = audioContext?.createGain()
                gainNode?.connect(audioContext!!.destination)
                println("AudioContext initialized.")
                // playTestSound() // Test sound, el original lo hacía async
            } else {
                println("AudioContext not supported or failed to initialize.")
            }
        } catch (e: dynamic) { // `dynamic` para atrapar errores de JS
            println("Error initializing AudioContext: ${e.message}")
            audioContext = null
        }
    }
    
    // `playTestSound` era async.
    private fun playTestSound(volume: Double = 0.2) = launch {
        if (audioContext == null || gainNode == null) return@launch
        try {
            val oscillator = audioContext!!.createOscillator()
            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(440.0, audioContext!!.currentTime) // A4 note
            gainNode!!.gain.setValueAtTime(volume, audioContext!!.currentTime)
            oscillator.connect(gainNode!!)
            oscillator.start(audioContext!!.currentTime)
            oscillator.stop(audioContext!!.currentTime + 0.1) // 100ms duration
            println("Test sound played.")
        } catch (e: dynamic) {
            println("Error playing test sound: ${e.message}")
        }
    }

    // `playHeartSound` era async.
    private fun playHeartSound(volume: Double = BEEP_VOLUME, playArrhythmiaTone: Boolean) = launch {
        if (audioContext == null || gainNode == null) return@launch
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastBeepTime < MIN_BEEP_INTERVAL_MS) {
            return@launch // Evitar beeps demasiado frecuentes
        }
        lastBeepTime = currentTime

        try {
            heartSoundOscillator?.disconnect(gainNode!!)
        } catch (e: dynamic) {}

        heartSoundOscillator = audioContext!!.createOscillator()
        val osc = heartSoundOscillator!!
        val audioCtxTime = audioContext!!.currentTime

        if (playArrhythmiaTone) {
            osc.type = "sawtooth" // Tono diferente para arritmia
            osc.frequency.setValueAtTime(150.0, audioCtxTime) // Tono más bajo y áspero
            gainNode!!.gain.setValueAtTime(volume * 0.7, audioCtxTime) // Un poco más bajo
        } else {
            osc.type = "sine"
            osc.frequency.setValueAtTime(300.0, audioCtxTime) // Tono normal del beep
            gainNode!!.gain.setValueAtTime(volume, audioCtxTime)
        }

        osc.connect(gainNode!!)
        osc.start(audioCtxTime)
        // BEEP_DURATION es en ms, stop() toma segundos
        osc.stop(audioCtxTime + (BEEP_DURATION / 1000.0))

        // Vibración (requiere permisos y es API de navegador)
        try {
            if (kotlin.js.js("typeof navigator.vibrate === 'function'") as Boolean) {
                 if (playArrhythmiaTone) {
                    navigator.vibrate(arrayOf(100, 50, 100, 50, 200)) // Patrón diferente para arritmia
                 } else {
                    navigator.vibrate(VIBRATION_PATTERN) 
                 }
            }
        } catch (e: dynamic) {
            // println("Vibration not supported or failed: ${e.message}")
        }
    }

    fun processSignal(value: Double): HeartBeatResult {
        val originalValue = value
        if (isInWarmup()) {
            values.add(originalValue)
            if (values.size > DEFAULT_WINDOW_SIZE) values.removeAt(0)
            return HeartBeatResult(0.0, 0.0, false, originalValue, arrhythmiaCountInternal, 0.0)
        }

        // 1. Pre-procesamiento: Normalización y filtrado básico
        val boostedSignal = boostSignal(originalValue)
        val medianFiltered = medianFilter(boostedSignal)
        val movingAverageFiltered = calculateMovingAverage(medianFiltered)
        val filteredValue = calculateEMA(movingAverageFiltered)

        values.add(filteredValue)
        if (values.size > DEFAULT_WINDOW_SIZE) {
            values.removeAt(0)
        }
        if (values.size < DEFAULT_WINDOW_SIZE / 2) { // No procesar si no hay suficientes datos
             return HeartBeatResult(0.0, 0.0, false, filteredValue, arrhythmiaCountInternal, currentSignalQuality)
        }

        // 2. Actualizar línea base
        baseline = (values.minOrNull() ?: 0.0) * BASELINE_FACTOR + (values.maxOrNull() ?: 0.0) * (1.0 - BASELINE_FACTOR)
        val normalizedValue = filteredValue - baseline
        
        // 3. Detección de picos mejorada
        val derivative = normalizedValue - (signalBuffer.lastOrNull() ?: normalizedValue)
        signalBuffer.add(normalizedValue)
        if (signalBuffer.size > 10) signalBuffer.removeAt(0) // Mantener buffer de derivadas corto

        val peakDetection = enhancedPeakDetection(normalizedValue, derivative)
        var isPeak = peakDetection.isPeak
        var confidence = peakDetection.confidence

        // 4. Confirmación y validación de picos
        isPeak = confirmPeak(isPeak, normalizedValue, confidence)
        if (isPeak) {
            isPeak = validatePeak(normalizedValue, confidence)
        }

        // 5. Ajuste de confianza basado en la fuerza de la señal
        trackSignalStrength(abs(normalizedValue)) // Usar amplitud normalizada
        confidence = adjustConfidenceForSignalStrength(confidence)

        // 6. Actualización de BPM y manejo de arritmias
        if (isPeak) {
            val currentTime = System.currentTimeMillis()
            if (lastPeakTime != null && (currentTime - lastPeakTime!! > DEFAULT_MIN_PEAK_TIME_MS)) {
                previousPeakTime = lastPeakTime
                lastPeakTime = currentTime
                updateBPM()
                
                // Detección de arritmia (simple: variabilidad del intervalo RR)
                // La lógica original de arrhythmia no estaba en el outline, esto es un ejemplo
                if (previousPeakTime != null) {
                    val rrInterval = lastPeakTime!! - previousPeakTime!!
                    val expectedInterval = if (smoothBPM > 0) 60000.0 / smoothBPM else DEFAULT_MIN_PEAK_TIME_MS.toDouble()
                    if (abs(rrInterval - expectedInterval) > expectedInterval * 0.25) { // >25% de variación
                        if (!isArrhythmiaDetected) {
                           arrhythmiaCountInternal++
                           isArrhythmiaDetected = true // Marcar para el tono
                        }
                    } else {
                        isArrhythmiaDetected = false
                    }
                }
                playHeartSound(playArrhythmiaTone = isArrhythmiaDetected)

                // Tuning adaptativo
                recentPeakAmplitudes.add(abs(normalizedValue))
                recentPeakConfidences.add(confidence)
                recentPeakDerivatives.add(abs(derivative))
                if (recentPeakAmplitudes.size > ADAPTIVE_TUNING_PEAK_WINDOW) recentPeakAmplitudes.removeAt(0)
                if (recentPeakConfidences.size > ADAPTIVE_TUNING_PEAK_WINDOW) recentPeakConfidences.removeAt(0)
                if (recentPeakDerivatives.size > ADAPTIVE_TUNING_PEAK_WINDOW) recentPeakDerivatives.removeAt(0)
                peaksSinceLastTuning++
                if (peaksSinceLastTuning >= ADAPTIVE_TUNING_PEAK_WINDOW) {
                    performAdaptiveTuning()
                    peaksSinceLastTuning = 0
                }
            } else if (lastPeakTime == null) { // Primer pico
                lastPeakTime = currentTime
            }
            lastConfirmedPeak = true
        } else {
            lastConfirmedPeak = false
            isArrhythmiaDetected = false // Resetear si no hay pico
        }

        // 7. Auto-reset si la señal es baja (originalmente deshabilitado)
        // autoResetIfSignalIsLow(abs(normalizedValue))

        // 8. Calcular calidad de la señal
        currentSignalQuality = calculateSignalQuality(normalizedValue, confidence)

        lastValue = filteredValue
        return HeartBeatResult(
            bpm = getSmoothBPM(),
            confidence = confidence,
            isPeak = isPeak,
            filteredValue = filteredValue,
            arrhythmiaCount = arrhythmiaCountInternal,
            signalQuality = currentSignalQuality
        )
    }

    private fun boostSignal(value: Double): Double {
        // Amplificar la señal si es débil, con cuidado de no sobresaturar
        // Esta es una implementación de ejemplo, la original podría ser diferente.
        val signalRange = (values.maxOrNull() ?: value) - (values.minOrNull() ?: value)
        return if (signalRange > 0 && signalRange < 0.1) { // Si el rango dinámico es muy bajo
            value * SIGNAL_BOOST_FACTOR
        } else {
            value
        }
    }

    private fun trackSignalStrength(amplitude: Double) {
        lastSignalStrength = amplitude
        recentSignalStrengths.add(amplitude)
        if (recentSignalStrengths.size > SIGNAL_STRENGTH_HISTORY) {
            recentSignalStrengths.removeAt(0)
        }
    }

    private fun adjustConfidenceForSignalStrength(confidence: Double): Double {
        val avgStrength = if (recentSignalStrengths.isNotEmpty()) recentSignalStrengths.average() else 0.0
        // Si la señal es consistentemente débil, reducir la confianza.
        // Si es fuerte, podría aumentarse ligeramente, o no tocarla.
        return when {
            avgStrength < (adaptiveSignalThreshold * 0.5) -> confidence * 0.7 // Señal muy débil
            avgStrength < adaptiveSignalThreshold -> confidence * 0.85 // Señal débil
            else -> confidence // Señal adecuada o fuerte
        }
    }

    private fun isInWarmup(): Boolean {
        return System.currentTimeMillis() - startTime < WARMUP_TIME_MS
    }

    private fun medianFilter(value: Double): Double {
        medianBuffer.add(value)
        if (medianBuffer.size > MEDIAN_FILTER_WINDOW) {
            medianBuffer.removeAt(0)
        }
        if (medianBuffer.size < MEDIAN_FILTER_WINDOW) {
            return value
        }
        val sortedWindow = medianBuffer.sorted()
        return sortedWindow[MEDIAN_FILTER_WINDOW / 2]
    }

    private fun calculateMovingAverage(value: Double): Double {
        movingAverageBuffer.add(value)
        if (movingAverageBuffer.size > MOVING_AVERAGE_WINDOW) {
            movingAverageBuffer.removeAt(0)
        }
        if (movingAverageBuffer.isEmpty()) return value
        return movingAverageBuffer.average()
    }

    private fun calculateEMA(value: Double): Double {
        smoothedValue = if (smoothedValue == 0.0 && values.isNotEmpty()) values.average() else smoothedValue // Inicializar si es el primer valor
        smoothedValue = EMA_ALPHA * value + (1 - EMA_ALPHA) * smoothedValue
        return smoothedValue
    }

    fun setArrhythmiaDetected(isDetected: Boolean) {
        // Esta función parece ser para una anulación externa, pero la lógica interna ya maneja isArrhythmiaDetected
        // this.isArrhythmiaDetected = isDetected 
        // Si se quiere que el contador se afecte desde fuera:
        // if(isDetected && !this.isArrhythmiaDetected) arrhythmiaCountInternal++
        // this.isArrhythmiaDetected = isDetected
        println("Arrhythmia externally set to: $isDetected (internal count: $arrhythmiaCountInternal)")
    }

    private fun autoResetIfSignalIsLow(amplitude: Double) {
        if (LOW_SIGNAL_THRESHOLD > 0) { // Solo si está habilitado
            if (amplitude < LOW_SIGNAL_THRESHOLD) {
                lowSignalCount++
                if (lowSignalCount >= LOW_SIGNAL_FRAMES) {
                    println("Low signal detected for $LOW_SIGNAL_FRAMES frames. Resetting detection states.")
                    resetDetectionStates()
                    lowSignalCount = 0
                }
            } else {
                lowSignalCount = 0
            }
        }
    }

    private fun resetDetectionStates() {
        lastPeakTime = null
        previousPeakTime = null
        bpmHistory.clear()
        values.clear() // Limpiar la ventana de valores también
        signalBuffer.clear()
        peakConfirmationBuffer.clear()
        isArrhythmiaDetected = false
        // arrhythmiaCountInternal no se resetea aquí, es un contador acumulativo
        // smoothBPM = 0.0 // Opcional, podría resetearse o dejarse que se reajuste
        println("HeartBeatProcessor detection states reset.")
    }

    private fun enhancedPeakDetection(normalizedValue: Double, derivative: Double): 
        Pair<Boolean, Double> { // Pair<isPeak, confidence>
        
        var isPeakCandidate = false
        var currentConfidence = 0.0

        // Lógica de detección de picos del original (el outline no la detalla)
        // Esta es una implementación de ejemplo:
        // Pico si el valor es mayor que el umbral adaptativo y la derivada cambia de positiva a negativa
        // O si la derivada es fuertemente negativa (pasando por un pico)

        val prevDerivative = if (signalBuffer.size >= 2) signalBuffer[signalBuffer.size - 2] - (signalBuffer.getOrNull(signalBuffer.size - 3) ?: signalBuffer[signalBuffer.size-2]) else 0.0
        
        if (normalizedValue > adaptiveSignalThreshold && derivative < adaptiveDerivativeThreshold ) {
             // Podría ser un pico si la derivada es suficientemente negativa
             if (abs(derivative) > abs(adaptiveDerivativeThreshold) * 1.5) { // Más estricto
                 isPeakCandidate = true
                 currentConfidence = (abs(derivative) / (abs(adaptiveDerivativeThreshold) * 2)).coerceIn(0.1, 1.0)
             }
        }
        // Otra condición: si el valor es un máximo local y supera el umbral
        if (signalBuffer.size >=3 && 
            signalBuffer[signalBuffer.size-2] > signalBuffer.last() && 
            signalBuffer[signalBuffer.size-2] > signalBuffer[signalBuffer.size-3] &&
            signalBuffer[signalBuffer.size-2] > adaptiveSignalThreshold) {
            isPeakCandidate = true
            currentConfidence = ((signalBuffer[signalBuffer.size-2] - adaptiveSignalThreshold) / adaptiveSignalThreshold).coerceIn(0.1,1.0)
        }

        // Aplicar sensibilidad
        if (isPeakCandidate) {
            currentConfidence *= PEAK_DETECTION_SENSITIVITY
        }
        
        return Pair(isPeakCandidate && currentConfidence > adaptiveMinConfidence, currentConfidence.coerceIn(0.0,1.0))
    }

    private fun confirmPeak(isPeak: Boolean, normalizedValue: Double, confidence: Double): Boolean {
        if (!isPeak) return false

        peakConfirmationBuffer.add(normalizedValue)
        if (peakConfirmationBuffer.size > 5) peakConfirmationBuffer.removeAt(0)

        // Lógica de confirmación: el pico debe ser significativamente mayor que los valores recientes en el buffer.
        // El original no detalla esto. Ejemplo:
        val avgRecent = peakConfirmationBuffer.take(peakConfirmationBuffer.size -1).averageOrNull() ?: (normalizedValue * 0.8)
        if (normalizedValue > avgRecent * 1.1 && confidence > (adaptiveMinConfidence * 1.1)) {
            return true
        }
        return false
    }

    private fun validatePeak(peakValue: Double, confidence: Double): Boolean {
        // Validación adicional del pico.
        // El original no detalla. Ejemplo: usar PEAK_VALIDATION_THRESHOLD
        if (confidence < PEAK_VALIDATION_THRESHOLD) return false // Confianza mínima
        
        peakValidationBuffer.add(peakValue)
        if (peakValidationBuffer.size > 10) peakValidationBuffer.removeAt(0)

        // Un pico no debe ser demasiado pequeño en comparación con el promedio de picos recientes.
        if (peakValidationBuffer.size > 5) {
            val avgPeak = peakValidationBuffer.filter { it > adaptiveSignalThreshold }.averageOrNull() // Promedio de picos válidos
            if (avgPeak != null && peakValue < avgPeak * 0.5) {
                return false // El pico es demasiado débil en comparación con otros
            }
        }
        return true
    }

    private fun updateBPM() {
        if (lastPeakTime != null && previousPeakTime != null) {
            val interval = lastPeakTime!! - previousPeakTime!!
            if (interval > 0) {
                val currentBpm = 60000.0 / interval
                if (currentBpm >= DEFAULT_MIN_BPM && currentBpm <= DEFAULT_MAX_BPM) {
                    bpmHistory.add(currentBpm)
                    if (bpmHistory.size > 10) { // Mantener historial para suavizado
                        bpmHistory.removeAt(0)
                    }
                }
            }
        }
        smoothBPM = getSmoothBPM()
    }

    private fun getSmoothBPM(): Double {
        if (bpmHistory.isEmpty()) return 0.0
        // EMA para BPM
        var emaBpm = if (smoothBPM == 0.0 && bpmHistory.isNotEmpty()) bpmHistory.average() else smoothBPM
        emaBpm = BPM_ALPHA * bpmHistory.last() + (1 - BPM_ALPHA) * emaBpm
        // Alternativa: promedio simple de los últimos N BPMs
        // return bpmHistory.takeLast(5).average().roundToInt()
        return emaBpm
    }

    private fun calculateCurrentBPM(): Double { // No se usa directamente en la lógica principal, pero es una utilidad
        if (lastPeakTime == null || previousPeakTime == null) return 0.0
        val interval = lastPeakTime!! - previousPeakTime!!
        return if (interval > 0) (60000.0 / interval) else 0.0
    }

    fun getFinalBPM(): Double { 
        val finalBpm = getSmoothBPM()
        // El original tenía una lógica más compleja aquí, no visible en el outline.
        // Si el BPM es muy bajo o inconsistente, devolver 0 o un valor indicativo.
        if (finalBpm < DEFAULT_MIN_BPM / 2.0 || confidence < (adaptiveMinConfidence * 0.8) ) {
             // Si la confianza es baja o el BPM es irrealmente bajo después del suavizado
            // return 0.0 // Podría ser demasiado agresivo
        }
        return if (bpmHistory.size < 3 && finalBpm < DEFAULT_MIN_BPM) 0.0 else finalBpm // Requiere algunos picos para un BPM estable
    }

    fun reset() {
        adaptiveSignalThreshold = DEFAULT_SIGNAL_THRESHOLD
        adaptiveMinConfidence = DEFAULT_MIN_CONFIDENCE
        adaptiveDerivativeThreshold = DEFAULT_DERIVATIVE_THRESHOLD
        
        recentPeakAmplitudes.clear()
        recentPeakConfidences.clear()
        recentPeakDerivatives.clear()
        peaksSinceLastTuning = 0

        signalBuffer.clear()
        medianBuffer.clear()
        movingAverageBuffer.clear()
        smoothedValue = 0.0
        
        // No resetear audioContext aquí, podría ser compartido o persistente.
        // heartSoundOscillator?.stop() // Detener si está sonando
        // heartSoundOscillator = null
        lastBeepTime = 0L
        
        resetDetectionStates()
        arrhythmiaCountInternal = 0 // Resetear contador de arritmias
        
        baseline = 0.0
        lastValue = 0.0
        startTime = System.currentTimeMillis() // Reiniciar tiempo de inicio para el warmup
        
        peakValidationBuffer.clear()
        lastSignalStrength = 0.0
        recentSignalStrengths.clear()
        currentSignalQuality = 0.0
        smoothBPM = 0.0
        bpmHistory.clear()

        println("HeartBeatProcessor reset.")
    }

    fun getRRIntervals(): Pair<List<Long>, Long?> { // intervals, lastPeakTime
        // Esta función no estaba completamente definida en el original. 
        // Necesitaríamos almacenar los tiempos de los picos para calcular los intervalos RR.
        // Por ahora, devolvemos una lista vacía y el último tiempo de pico.
        // Para una implementación real, se necesitaría un buffer de tiempos de picos.
        // Ejemplo simplificado (asumiendo que bpmHistory guarda tiempos o se puede derivar)
        val intervals = mutableListOf<Long>()
        if (bpmHistory.size >=2 ) {
            for(i in 0 until bpmHistory.size -1) {
                if(bpmHistory[i+1] > 0 && bpmHistory[i] > 0) {
                    // Esto no es correcto, bpmHistory tiene BPMs, no tiempos. 
                    // Se necesitaría un `peakTimesHistory: MutableList<Long>`
                }
            }
        }
        return Pair(intervals, lastPeakTime)
    }

    private fun performAdaptiveTuning() {
        if (recentPeakAmplitudes.isEmpty() || recentPeakConfidences.isEmpty() || recentPeakDerivatives.isEmpty()) {
            return
        }

        val avgAmplitude = recentPeakAmplitudes.average()
        val avgConfidence = recentPeakConfidences.average()
        // val avgDerivative = recentPeakDerivatives.average() // No usado directamente en la lógica de ajuste de umbrales del original (según el outline)

        // Ajustar adaptiveSignalThreshold
        // Si la amplitud promedio es consistentemente más alta o más baja que el umbral actual,
        // ajustar el umbral hacia esa amplitud promedio.
        val targetSignalThreshold = avgAmplitude * 0.6 // Ejemplo: 60% de la amplitud promedio de los picos
        adaptiveSignalThreshold = (1 - ADAPTIVE_TUNING_LEARNING_RATE) * adaptiveSignalThreshold +
                                  ADAPTIVE_TUNING_LEARNING_RATE * targetSignalThreshold
        adaptiveSignalThreshold = adaptiveSignalThreshold.coerceIn(MIN_ADAPTIVE_SIGNAL_THRESHOLD, MAX_ADAPTIVE_SIGNAL_THRESHOLD)

        // Ajustar adaptiveMinConfidence
        // Si la confianza promedio de los picos detectados es consistentemente alta,
        // podríamos ser un poco más estrictos (aumentar el umbral de confianza).
        // Si es baja, relajarlo un poco.
        // Esta lógica es una suposición, el original podría ser diferente.
        val targetMinConfidence = avgConfidence * 0.9 // Apuntar a un 90% de la confianza promedio observada
        adaptiveMinConfidence = (1 - ADAPTIVE_TUNING_LEARNING_RATE) * adaptiveMinConfidence +
                                ADAPTIVE_TUNING_LEARNING_RATE * targetMinConfidence
        adaptiveMinConfidence = adaptiveMinConfidence.coerceIn(MIN_ADAPTIVE_MIN_CONFIDENCE, MAX_ADAPTIVE_MIN_CONFIDENCE)
        
        // Ajustar adaptiveDerivativeThreshold
        // El original no muestra cómo se ajusta este umbral. Usaremos una lógica similar:
        // si las derivadas promedio de los picos son consistentemente de cierta magnitud.
        // Tomamos el promedio de las magnitudes de las derivadas de los picos.
        val avgPeakDerivativeMag = recentPeakDerivatives.filter { it != 0.0 }.map{ abs(it) }.averageOrNull() ?: abs(DEFAULT_DERIVATIVE_THRESHOLD)
        val targetDerivativeThreshold = -avgPeakDerivativeMag * 0.7 // Ejemplo: 70% de la magnitud promedio, negativo
        adaptiveDerivativeThreshold = (1 - ADAPTIVE_TUNING_LEARNING_RATE) * adaptiveDerivativeThreshold +
                                     ADAPTIVE_TUNING_LEARNING_RATE * targetDerivativeThreshold
        adaptiveDerivativeThreshold = adaptiveDerivativeThreshold.coerceIn(MIN_ADAPTIVE_DERIVATIVE_THRESHOLD, MAX_ADAPTIVE_DERIVATIVE_THRESHOLD)
        
        // println("Adaptive tuning: ST=%.3f, MC=%.2f, DT=%.4f".format(adaptiveSignalThreshold, adaptiveMinConfidence, adaptiveDerivativeThreshold))

        recentPeakAmplitudes.clear()
        recentPeakConfidences.clear()
        recentPeakDerivatives.clear()
    }

    fun getSignalQuality(): Double {
        return currentSignalQuality
    }

    private fun calculateSignalQuality(normalizedValue: Double, confidence: Double): Double {
        // Lógica de ejemplo para la calidad de la señal, el original podría ser más complejo.
        // Combina la fuerza de la señal (amplitud normalizada) y la confianza de detección de picos.
        val strengthScore = (abs(normalizedValue) / (adaptiveSignalThreshold * 2.0)).coerceIn(0.0, 1.0) // Normalizar amplitud respecto al umbral
        val confidenceScore = confidence.coerceIn(0.0, 1.0)
        
        // Ponderar más la confianza si hay un pico detectado.
        val quality = if (lastConfirmedPeak) {
            (strengthScore * 0.4 + confidenceScore * 0.6)
        } else {
            (strengthScore * 0.6 + confidenceScore * 0.4) // Si no hay pico, la amplitud podría ser más relevante
        }
        return quality.coerceIn(0.0, 1.0)
    }
    
    fun cancelScope() {
        job.cancel()
        audioContext?.close()?.catch { e -> println("Error closing AudioContext: ${e.message}") }
    }
} 