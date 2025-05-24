package modules

import kotlinx.browser.window
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.w3c.dom.AudioContext
import org.w3c.dom.GainNode
import org.w3c.dom.OscillatorNode
import org.w3c.dom.Navigator // For navigator.vibrate
import kotlin.js.Date
import kotlin.math.*

// External declarations for browser APIs if not covered by stdlib or wrappers
// Check if org.w3c.dom.Navigator has vibrate - it usually does in modern browser type defs.
// We assume AudioContext, OscillatorNode, GainNode are from org.w3c.dom and available.

class HeartBeatProcessor {

    // RRData as defined in the pre-conversation summary
    data class RRData(
        val intervals: List<Double>, // Assuming intervals are in ms
        val lastPeakTime: Double? // Timestamp of the last peak
    )

    // ────────── CONFIGURACIONES PRINCIPALES (Valores optimizados para precisión médica) ──────────
    private val DEFAULT_SAMPLE_RATE = 60
    private val DEFAULT_WINDOW_SIZE = 40
    private val DEFAULT_MIN_BPM = 30
    private val DEFAULT_MAX_BPM = 220
    private val DEFAULT_SIGNAL_THRESHOLD = 0.02 // Reducido para captar señal más débil
    private val DEFAULT_MIN_CONFIDENCE = 0.30 // Reducido para mejor detección
    private val DEFAULT_DERIVATIVE_THRESHOLD = -0.005 // Ajustado para mejor sensibilidad
    private val DEFAULT_MIN_PEAK_TIME_MS = 300.0 // Restaurado a valor médicamente apropiado (use Double for time)
    private val WARMUP_TIME_MS = 1000.0 // Reducido para obtener lecturas más rápido

    // Parámetros de filtrado ajustados para precisión médica
    private val MEDIAN_FILTER_WINDOW = 3
    private val MOVING_AVERAGE_WINDOW = 3 // Aumentado para mejor filtrado
    private val EMA_ALPHA = 0.5 // Restaurado para equilibrio entre estabilidad y respuesta
    private val BASELINE_FACTOR = 0.8 // Restaurado para seguimiento adecuado

    // Parámetros de beep y vibración
    private val BEEP_DURATION = 450.0
    private val BEEP_VOLUME = 1.0
    private val MIN_BEEP_INTERVAL_MS = 600.0 // Restaurado para prevenir beeps excesivos
    private val VIBRATION_PATTERN = arrayOf(40, 20, 60) //arrayOf<dynamic>() for JS

    // AUTO-RESET mejorado
    private val LOW_SIGNAL_THRESHOLD = 0.0 // Deshabilitado auto-reset por baja señal (use Double)
    private val LOW_SIGNAL_FRAMES = 25
    private var lowSignalCount = 0

    // ────────── PARÁMETROS ADAPTATIVOS MÉDICAMENTE VÁLIDOS ──────────
    private var adaptiveSignalThreshold: Double
    private var adaptiveMinConfidence: Double
    private var adaptiveDerivativeThreshold: Double

    // Límites para los parámetros adaptativos - Valores médicamente apropiados
    private val MIN_ADAPTIVE_SIGNAL_THRESHOLD = 0.05 // Reducido para mejor sensibilidad
    private val MAX_ADAPTIVE_SIGNAL_THRESHOLD = 0.4
    private val MIN_ADAPTIVE_MIN_CONFIDENCE = 0.40 // Reducido para mejor detección
    private val MAX_ADAPTIVE_MIN_CONFIDENCE = 0.80
    private val MIN_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.08
    private val MAX_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.005

    // ────────── PARÁMETROS PARA PROCESAMIENTO ──────────
    private val SIGNAL_BOOST_FACTOR = 1.8 // Aumentado para mejor amplificación
    private val PEAK_DETECTION_SENSITIVITY = 0.6 // Aumentado para mejor detección
    
    // Control del auto-ajuste
    private val ADAPTIVE_TUNING_PEAK_WINDOW = 10 // Reducido para adaptarse más rápido
    private val ADAPTIVE_TUNING_LEARNING_RATE = 0.20 // Aumentado para adaptarse más rápido
    
    // Variables internas
    private var recentPeakAmplitudes: MutableList<Double> = mutableListOf()
    private var recentPeakConfidences: MutableList<Double> = mutableListOf()
    private var recentPeakDerivatives: MutableList<Double> = mutableListOf()
    private var peaksSinceLastTuning = 0
    private var signalBuffer: MutableList<Double> = mutableListOf()
    private var medianBuffer: MutableList<Double> = mutableListOf()
    private var movingAverageBuffer: MutableList<Double> = mutableListOf()
    private var smoothedValue: Double = 0.0
    private var audioContext: AudioContext? = null
    // private var heartSoundOscillator: OscillatorNode? = null // Not used in TS constructor or initAudio directly like this
    private var lastBeepTime: Double = 0.0
    private var lastPeakTime: Double? = null
    private var previousPeakTime: Double? = null
    private var bpmHistory: MutableList<Double> = mutableListOf()
    private var baseline: Double = 0.0
    private var lastValue: Double = 0.0
    private var values: MutableList<Double> = mutableListOf() // Seems to be different from signalBuffer. TS uses it for some internal calcs.
    private var startTime: Double = 0.0
    private var peakConfirmationBuffer: MutableList<Double> = mutableListOf()
    private var lastConfirmedPeak: Boolean = false
    private var smoothBPM: Double = 0.0
    private val BPM_ALPHA = 0.3 // Restaurado para suavizado apropiado
    private var peakCandidateIndex: Int? = null
    private var peakCandidateValue: Double = 0.0
    private var isArrhythmiaDetected: Boolean = false
    
    // Variables para mejorar la detección
    private var peakValidationBuffer: MutableList<Double> = mutableListOf()
    private val PEAK_VALIDATION_THRESHOLD = 0.3 // Reducido para validación más permisiva
    private var lastSignalStrength: Double = 0.0
    private var recentSignalStrengths: MutableList<Double> = mutableListOf()
    private val SIGNAL_STRENGTH_HISTORY = 30
    
    // Nueva variable para retroalimentación de calidad de señal
    private var currentSignalQuality: Double = 0.0 // TS had Int, but Double might be more flexible for scores

    constructor() {
        // Inicializar parámetros adaptativos con valores médicamente apropiados
        this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD
        this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE
        this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD

        // initAudio is async in TS, so we launch a coroutine
        GlobalScope.launch {
            initAudio()
        }
        this.startTime = Date.now()
    }

    // Placeholder for initAudio, will be translated next
    private suspend fun initAudio() {
        // Translation of initAudio logic will go here
        try {
            // Ensure AudioContext can be instantiated. It might need to be user-initiated in some browsers.
            audioContext = AudioContext()
            audioContext?.resume() // Best effort resume
            console.log("HeartBeatProcessor: Audio Context Initialized and resumed attempt.")
            playTestSound(0.3)
        } catch (error: dynamic) {
            console.error("HeartBeatProcessor: Error initializing audio", error)
        }
    }

    // Placeholder for playTestSound
    private suspend fun playTestSound(volume: Double = 0.2) {
        val localAudioContext = audioContext ?: return
        try {
            // console.log("HeartBeatProcessor: Reproduciendo sonido de prueba")
            val oscillator = localAudioContext.createOscillator()
            val gain = localAudioContext.createGain()
            
            oscillator.type = "sine" // OscillatorType.SINE in newer Kotlin/JS DOM APIs
            oscillator.frequency.setValueAtTime(440.0f, localAudioContext.currentTime)
            
            gain.gain.setValueAtTime(0.0f, localAudioContext.currentTime)
            gain.gain.linearRampToValueAtTime(volume.toFloat(), localAudioContext.currentTime + 0.1)
            gain.gain.exponentialRampToValueAtTime(0.001f, localAudioContext.currentTime + 0.5)
            
            oscillator.connect(gain)
            gain.connect(localAudioContext.destination)
            
            oscillator.start()
            oscillator.stop(localAudioContext.currentTime + 0.6)
            // console.log("HeartBeatProcessor: Sonido de prueba reproducido")
        } catch (error: dynamic) {
            console.error("HeartBeatProcessor: Error playing test sound", error)
        }
    }

    // ... other methods will be translated later ...
} 