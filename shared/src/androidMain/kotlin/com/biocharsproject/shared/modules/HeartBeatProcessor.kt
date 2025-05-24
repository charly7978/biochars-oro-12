package com.biocharsproject.shared.modules

import android.content.Context // Required for Android-specific features
import kotlin.math.*
import kotlinx.coroutines.*
// kotlinx.browser.window is not available in androidMain
// org.w3c.dom.Navigator is not available in androidMain

// Actual class implementing the expected HeartBeatProcessor
actual class HeartBeatProcessor actual constructor(private val context: Context) : CoroutineScope {
    private val job = Job()
    actual override val coroutineContext = Dispatchers.Default + job

    // Listener properties as per expect class (will be set by the user)
    private var onBpmListener: ((bpm: Double, confidence: Double, isPeak: Boolean, filtered: Double, arrhythmiaCount: Int) -> Unit)? = null
    private var onArrhythmiaListener: ((type: String, timestamp: Long) -> Unit)? = null

    // Android-specific vibrator
    private val vibrator: AndroidVibrator = AndroidVibrator(context)
    // Android-specific audio player (placeholder, might need actual sound resources)
    // private val audioPlayer: AndroidAudioPlayer = AndroidAudioPlayer(context)


    // --- START OF ORIGINAL HeartBeatProcessor.kt LOGIC (adapted) ---
    // Most constants can remain the same.
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

    private val BEEP_DURATION = 450 // ms
    private val BEEP_VOLUME = 1.0f // Android volume is typically float 0.0 to 1.0
    private val MIN_BEEP_INTERVAL_MS = 600L
    private val VIBRATION_PATTERN = arrayOf(40, 20, 60)

    private val LOW_SIGNAL_THRESHOLD = 0.0
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

    private var recentPeakAmplitudes: MutableList<Double> = mutableListOf()
    private var recentPeakConfidences: MutableList<Double> = mutableListOf()
    private var recentPeakDerivatives: MutableList<Double> = mutableListOf()
    private var peaksSinceLastTuning = 0

    private var signalBuffer: MutableList<Double> = mutableListOf()
    private var medianBuffer: MutableList<Double> = mutableListOf()
    private var movingAverageBuffer: MutableList<Double> = mutableListOf()
    private var smoothedValue: Double = 0.0

    // Audio related properties - will need to use Android Audio APIs (e.g. SoundPool or MediaPlayer)
    // ExternalAudioContext, ExternalOscillatorNode, etc. are replaced by Android mechanisms.
    // For simplicity, direct audio playback for beeps is commented out or simplified.
    // A more robust implementation would use SoundPool for short beeps.
    private var lastBeepTime = 0L

    private var lastPeakTime: Long? = null
    private var previousPeakTime: Long? = null
    private var bpmHistory: MutableList<Double> = mutableListOf()
    private var baseline: Double = 0.0
    private var lastValue: Double = 0.0
    private var values: MutableList<Double> = mutableListOf()
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

    init {
        adaptiveSignalThreshold = DEFAULT_SIGNAL_THRESHOLD
        adaptiveMinConfidence = DEFAULT_MIN_CONFIDENCE
        adaptiveDerivativeThreshold = DEFAULT_DERIVATIVE_THRESHOLD
        startTime = getCurrentTimeMillis() // Uses actual fun
        // initAudio() // Audio initialization would be different on Android
        println("HeartBeatProcessor: Android Initialized")
    }

    // initAudio and playTestSound, playHeartSound are heavily browser-dependent.
    // They will be simplified or replaced with Android-specific logic.
    // For now, the audio playing part is mostly removed for brevity and focus on core logic.
    // Vibration is handled by AndroidVibrator.

    private fun playHeartBeatFeedback(isArrhythmia: Boolean) {
        val now = getCurrentTimeMillis()
        if (now - lastBeepTime < MIN_BEEP_INTERVAL_MS && !isArrhythmia) { // Allow arrhythmia vibration to bypass interval
             //println("HeartBeatProcessor: Feedback skipped - too soon")
            return
        }
        lastBeepTime = now
        
        vibrator.vibrate(VIBRATION_PATTERN) // Use AndroidVibrator

        if (isArrhythmia) {
            // Could play a different sound/vibration pattern for arrhythmia
            onArrhythmiaListener?.invoke("detected_peak_inconsistency", now) // Example
            // Consider a more distinct vibration for arrhythmia if desired
            // vibrator.vibrate(arrayOf(100, 50, 100, 50, 100)) 
        }
        // Audio playback would go here using AndroidAudioPlayer or SoundPool
        // e.g., audioPlayer.playSound(R.raw.heart_beep, BEEP_VOLUME)
        // This requires sound resources (e.g. .wav or .mp3 files in res/raw)
    }

    private fun isInWarmup(): Boolean {
        return getCurrentTimeMillis() - startTime < WARMUP_TIME_MS
    }

    private fun applyMedianFilter(value: Double): Double {
        medianBuffer.add(value)
        if (medianBuffer.size > MEDIAN_FILTER_WINDOW) {
            medianBuffer.removeAt(0)
        }
        if (medianBuffer.isEmpty()) return value
        val sortedBuffer = medianBuffer.sorted()
        return sortedBuffer[sortedBuffer.size / 2]
    }

    private fun applyMovingAverage(value: Double): Double {
        movingAverageBuffer.add(value)
        if (movingAverageBuffer.size > MOVING_AVERAGE_WINDOW) {
            movingAverageBuffer.removeAt(0)
        }
        return if (movingAverageBuffer.isNotEmpty()) movingAverageBuffer.average() else value
    }
    
    private fun applyEmaFilter(value: Double): Double {
        smoothedValue = if (signalBuffer.size <= 1) value else (EMA_ALPHA * value) + (1 - EMA_ALPHA) * smoothedValue
        return smoothedValue
    }

    private fun calculateBaseline(currentValue: Double): Double {
        // Simplified baseline: adaptive based on recent smoothed values
        // Could also be a longer-term moving average of non-peak values
        return if (signalBuffer.isNotEmpty()) signalBuffer.takeLast(DEFAULT_WINDOW_SIZE / 2).average() * BASELINE_FACTOR else currentValue
    }

    private fun calculateSignalQuality(currentValue: Double, filteredValue: Double): Double {
        // More robust quality: SNR, stability of peaks, etc.
        // Simplified: consistency of signal strength and difference from baseline
        val signalStrength = abs(filteredValue - baseline)
        recentSignalStrengths.add(signalStrength)
        if (recentSignalStrengths.size > SIGNAL_STRENGTH_HISTORY) {
            recentSignalStrengths.removeAt(0)
        }
        val avgStrength = if (recentSignalStrengths.isNotEmpty()) recentSignalStrengths.average() else 0.0
        val stdDevStrength = if (recentSignalStrengths.size > 1) {
            val mean = avgStrength
            sqrt(recentSignalStrengths.sumOf { (it - mean).pow(2) } / recentSignalStrengths.size)
        } else 0.0

        // Normalize quality to 0-1 range. Lower stddev relative to avgStrength is better.
        currentSignalQuality = if (avgStrength > 0.01) (1.0 - min(1.0, stdDevStrength / avgStrength)) else 0.0
        // Penalize if signal is too weak
        if (avgStrength < adaptiveSignalThreshold / 2) currentSignalQuality *= 0.5
        
        return currentSignalQuality
    }


    private fun detectPeak(currentValue: Double, derivative: Double, timestamp: Long): Boolean {
        if (values.size < 3) return false

        val prevValue = values[values.size - 2]
        val prevPrevValue = values[values.size - 3]

        // Enhanced peak detection: current value is higher than neighbors, and derivative was recently negative (falling) then positive (rising)
        // Or, if using derivative, look for zero-crossing from positive to negative
        // The original TS logic: (currentValue > baseline && currentValue > lastValue * (1 + adaptiveSignalThreshold) && derivative < adaptiveDerivativeThreshold)

        // Simplified logic: value is a local maximum and significantly above baseline
        val isPotentialPeak = currentValue > prevValue && currentValue > prevPrevValue && currentValue > baseline + adaptiveSignalThreshold
        
        // Check derivative for downward trend (value was increasing, now potentially decreasing)
        val isSignificantDerivative = derivative < adaptiveDerivativeThreshold 
                                     && lastValue > currentValue // Confirms it's a downward turn after a rise

        if (isPotentialPeak && isSignificantDerivative) {
            // Further validation: ensure it's not too close to the last peak
            lastPeakTime?.let {
                if (timestamp - it < DEFAULT_MIN_PEAK_TIME_MS) {
                    return false // Too soon for a new peak
                }
            }
            return true
        }
        return false
    }

    private fun calculateConfidence(peakValue: Double, derivativeAtPeak: Double): Double {
        var confidence = 0.0
        // Confidence based on peak amplitude relative to baseline
        val amplitudeScore = min(1.0, (peakValue - baseline) / (adaptiveSignalThreshold * 2))
        confidence += amplitudeScore * 0.6

        // Confidence based on how sharp the derivative drop was (more negative is sharper)
        val derivativeScore = min(1.0, abs(derivativeAtPeak) / abs(adaptiveDerivativeThreshold * 2))
        confidence += derivativeScore * 0.4
        
        return min(1.0, confidence * SIGNAL_BOOST_FACTOR) // Apply boost
    }


    private fun updateBPM(timestamp: Long): Double {
        var currentBPM = 0.0
        if (lastPeakTime != null && previousPeakTime != null) {
            val intervalMs = lastPeakTime!! - previousPeakTime!!
            if (intervalMs > 0) {
                currentBPM = 60000.0 / intervalMs
                if (currentBPM < DEFAULT_MIN_BPM || currentBPM > DEFAULT_MAX_BPM) {
                    // BPM out of physiological range, likely an artifact
                    // Could reset lastPeakTime or previousPeakTime to avoid using this interval
                    // For now, just cap it or return 0
                    currentBPM = if (bpmHistory.isNotEmpty()) bpmHistory.last() else 0.0
                    isArrhythmiaDetected = true // Potential arrhythmia or bad reading
                    arrhythmiaCountInternal++
                } else {
                     // Check for significant change from previous BPM (arrhythmia detection)
                    if (bpmHistory.isNotEmpty()) {
                        val lastBpm = bpmHistory.last()
                        val diffPercentage = abs(currentBPM - lastBpm) / lastBpm
                        if (diffPercentage > 0.35 && abs(currentBPM-lastBpm) > 15) { // e.g. >35% change and > 15bpm absolute
                            isArrhythmiaDetected = true
                            arrhythmiaCountInternal++
                             //println("HeartBeatProcessor: Arrhythmia detected - BPM change: $lastBpm -> $currentBPM")
                            onArrhythmiaListener?.invoke("significant_bpm_fluctuation", timestamp)
                        } else {
                            isArrhythmiaDetected = false
                        }
                    } else {
                        isArrhythmiaDetected = false
                    }
                }
            }
        }

        if (currentBPM > 0) {
            bpmHistory.add(currentBPM)
            if (bpmHistory.size > DEFAULT_WINDOW_SIZE / 2) { // Keep history for smoothing
                bpmHistory.removeAt(0)
            }
        }
        
        smoothBPM = if (bpmHistory.isNotEmpty()) {
            // Weighted moving average or EMA for smoother BPM
            // For now, simple moving average
            // bpmHistory.average()
            // EMA for BPM
            if (smoothBPM == 0.0 && bpmHistory.isNotEmpty()) bpmHistory.last() 
            else (BPM_ALPHA * currentBPM) + (1 - BPM_ALPHA) * smoothBPM
        } else {
            0.0
        }
        return if(smoothBPM.isFinite()) smoothBPM else 0.0
    }

    private fun adaptiveTuning(confidence: Double, peakAmplitude: Double, derivativeAtPeak: Double) {
        if (confidence < DEFAULT_MIN_CONFIDENCE && peaksSinceLastTuning > ADAPTIVE_TUNING_PEAK_WINDOW / 2) {
            // If confidence is consistently low, make detection more sensitive (lower thresholds)
            adaptiveSignalThreshold = max(MIN_ADAPTIVE_SIGNAL_THRESHOLD, adaptiveSignalThreshold * (1 - ADAPTIVE_TUNING_LEARNING_RATE * 0.5))
            adaptiveMinConfidence = max(MIN_ADAPTIVE_MIN_CONFIDENCE, adaptiveMinConfidence * (1 - ADAPTIVE_TUNING_LEARNING_RATE * 0.5))
            adaptiveDerivativeThreshold = min(MAX_ADAPTIVE_DERIVATIVE_THRESHOLD, adaptiveDerivativeThreshold * (1 + ADAPTIVE_TUNING_LEARNING_RATE * 0.2)) // more negative
            //println("HeartBeatProcessor: Adaptive tuning - DECREASED thresholds due to low confidence")
            peaksSinceLastTuning = 0 // Reset counter
        } else if (confidence > MAX_ADAPTIVE_MIN_CONFIDENCE * 0.9 && peaksSinceLastTuning > ADAPTIVE_TUNING_PEAK_WINDOW) {
             // If confidence is consistently high, make detection less sensitive (higher thresholds) to reduce noise
            adaptiveSignalThreshold = min(MAX_ADAPTIVE_SIGNAL_THRESHOLD, adaptiveSignalThreshold * (1 + ADAPTIVE_TUNING_LEARNING_RATE * 0.3))
            adaptiveMinConfidence = min(MAX_ADAPTIVE_MIN_CONFIDENCE, adaptiveMinConfidence * (1 + ADAPTIVE_TUNING_LEARNING_RATE * 0.3))
            adaptiveDerivativeThreshold = max(MIN_ADAPTIVE_DERIVATIVE_THRESHOLD, adaptiveDerivativeThreshold * (1 - ADAPTIVE_TUNING_LEARNING_RATE * 0.1)) // less negative
            //println("HeartBeatProcessor: Adaptive tuning - INCREASED thresholds due to high confidence")
            peaksSinceLastTuning = 0 // Reset counter
        }
        peaksSinceLastTuning++

        // Tune based on recent peak characteristics
        recentPeakAmplitudes.add(peakAmplitude)
        recentPeakConfidences.add(confidence)
        recentPeakDerivatives.add(derivativeAtPeak)
        if (recentPeakAmplitudes.size > ADAPTIVE_TUNING_PEAK_WINDOW) {
            recentPeakAmplitudes.removeAt(0)
            recentPeakConfidences.removeAt(0)
            recentPeakDerivatives.removeAt(0)

            // Adjust thresholds based on average characteristics of recent good peaks
            val avgGoodPeakAmplitude = recentPeakAmplitudes.filterIndexed { index, _ -> recentPeakConfidences[index] > adaptiveMinConfidence }.average()
            val avgGoodPeakDerivative = recentPeakDerivatives.filterIndexed { index, _ -> recentPeakConfidences[index] > adaptiveMinConfidence }.average()

            if (!avgGoodPeakAmplitude.isNaN() && avgGoodPeakAmplitude > 0) {
                 adaptiveSignalThreshold = clamp(MIN_ADAPTIVE_SIGNAL_THRESHOLD, MAX_ADAPTIVE_SIGNAL_THRESHOLD, 
                                             adaptiveSignalThreshold * (1-ADAPTIVE_TUNING_LEARNING_RATE) + (avgGoodPeakAmplitude * PEAK_DETECTION_SENSITIVITY * 0.5) * ADAPTIVE_TUNING_LEARNING_RATE)
            }
            if (!avgGoodPeakDerivative.isNaN() && avgGoodPeakDerivative < -0.001) { // Ensure derivative is meaningfully negative
                 adaptiveDerivativeThreshold = clamp(MIN_ADAPTIVE_DERIVATIVE_THRESHOLD, MAX_ADAPTIVE_DERIVATIVE_THRESHOLD,
                                               adaptiveDerivativeThreshold * (1-ADAPTIVE_TUNING_LEARNING_RATE) + (avgGoodPeakDerivative * 1.2) * ADAPTIVE_TUNING_LEARNING_RATE)
            }
             //println("HeartBeatProcessor: Tuned signal_threshold=${adaptiveSignalThreshold.format(3)}, derivative_threshold=${adaptiveDerivativeThreshold.format(3)}")
        }
    }
    
    // Helper for clamping values, Kotlin's `coerceIn` can be used instead.
    private fun clamp(min: Double, max: Double, value: Double): Double {
        return value.coerceIn(min, max)
    }
    // Helper for formatting doubles, useful for debugging
    // private fun Double.format(digits: Int) = "%.${digits}f".format(this)

    // --- END OF ORIGINAL HeartBeatProcessor.kt LOGIC (adapted) ---

    // Public API methods from expect class
    actual fun processSample(value: Double, timestamp: Long): HeartBeatResult? {
        if (isInWarmup()) {
            lastValue = value
            return null // Still warming up
        }

        val medianFiltered = applyMedianFilter(value)
        val movingAverageFiltered = applyMovingAverage(medianFiltered)
        val emaFiltered = applyEmaFilter(movingAverageFiltered)
        
        val filteredValue = emaFiltered // Final filtered value to use for peak detection

        values.add(filteredValue)
        if (values.size > DEFAULT_WINDOW_SIZE) {
            values.removeAt(0)
        }
        if (values.size < 3) {
            lastValue = filteredValue
            return null // Not enough data
        }

        baseline = calculateBaseline(filteredValue)
        val derivative = filteredValue - lastValue // Simple derivative

        // Low signal check (Original had complex logic, simplified here)
        if (abs(filteredValue - baseline) < LOW_SIGNAL_THRESHOLD && LOW_SIGNAL_THRESHOLD > 0) {
            lowSignalCount++
            if (lowSignalCount > LOW_SIGNAL_FRAMES) {
                // Handle low signal: reset, notify, etc.
                // println("HeartBeatProcessor: Low signal detected.")
                lastValue = filteredValue
                // Potentially return null or a result with very low confidence/quality
                currentSignalQuality = 0.0
                 return HeartBeatResult(smoothBPM, 0.0, false, filteredValue, arrhythmiaCountInternal, currentSignalQuality)
            }
        } else {
            lowSignalCount = 0
        }

        currentSignalQuality = calculateSignalQuality(value, filteredValue)
        var isPeakDetected = false
        var confidence = 0.0
        var bpm = smoothBPM // Use smoothed BPM by default

        if (detectPeak(filteredValue, derivative, timestamp)) {
            confidence = calculateConfidence(filteredValue, derivative)
            if (confidence >= adaptiveMinConfidence) {
                isPeakDetected = true
                previousPeakTime = lastPeakTime
                lastPeakTime = timestamp
                bpm = updateBPM(timestamp) // This updates smoothBPM as well
                
                playHeartBeatFeedback(isArrhythmiaDetected) // Play sound & vibrate

                adaptiveTuning(confidence, filteredValue, derivative)
                peaksSinceLastTuning++

            } else {
                 //println("HeartBeatProcessor: Peak candidate rejected due to low confidence: $confidence (threshold: $adaptiveMinConfidence)")
            }
        }
        
        lastValue = filteredValue

        val result = HeartBeatResult(bpm, confidence, isPeakDetected, filteredValue, arrhythmiaCountInternal, currentSignalQuality)
        onBpmListener?.invoke(result.bpm, result.confidence, result.isPeak, result.filteredValue, result.arrhythmiaCount)
        return result
    }

    actual fun reset() {
        signalBuffer.clear()
        medianBuffer.clear()
        movingAverageBuffer.clear()
        smoothedValue = 0.0
        
        lastPeakTime = null
        previousPeakTime = null
        bpmHistory.clear()
        baseline = 0.0
        lastValue = 0.0
        values.clear()
        startTime = getCurrentTimeMillis()
        arrhythmiaCountInternal = 0
        isArrhythmiaDetected = false
        smoothBPM = 0.0
        lowSignalCount = 0
        currentSignalQuality = 0.0

        recentPeakAmplitudes.clear()
        recentPeakConfidences.clear()
        recentPeakDerivatives.clear()
        peaksSinceLastTuning = 0

        adaptiveSignalThreshold = DEFAULT_SIGNAL_THRESHOLD
        adaptiveMinConfidence = DEFAULT_MIN_CONFIDENCE
        adaptiveDerivativeThreshold = DEFAULT_DERIVATIVE_THRESHOLD
        
        // audioContext?.close() // Close existing audio context if any (Android specific audio cleanup)
        // initAudio() // Re-initialize audio if needed
        println("HeartBeatProcessor: Reset complete.")
    }

    actual fun setBPMListener(listener: (bpm: Double, confidence: Double, isPeak: Boolean, filtered: Double, arrhythmiaCount: Int) -> Unit) {
        this.onBpmListener = listener
    }

    actual fun setArrhythmiaListener(listener: (type: String, timestamp: Long) -> Unit) {
        this.onArrhythmiaListener = listener
    }
    
    actual fun getSignalQuality(): Double {
        return currentSignalQuality
    }

    actual fun stop() {
        job.cancel() // Cancel all coroutines started by this scope
        // audioContext?.close() // Android specific audio cleanup
        println("HeartBeatProcessor: Stopped.")
    }
}

// Required for the constructor in actual class to accept Context
// This should be defined in a common place if used by other actual classes, or here if specific.
// For KMP, the expect/actual mechanism handles type aliasing if Context were an expect type.
// However, since android.content.Context is specific to androidMain, direct usage is fine here.
// No, this typealias is not needed if the constructor directly uses android.content.Context.
// actual typealias Context = android.content.Context // Not strictly needed here if constructor is specific enough

</rewritten_file> 