package modules.signalprocessing

import kotlin.math.floor
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

// Based on src/modules/signal-processing/CalibrationHandler.ts
class CalibrationHandler(private val config: Config) {
    data class Config(
        val CALIBRATION_SAMPLES: Int,
        val MIN_RED_THRESHOLD: Double, // These are initial config values
        val MAX_RED_THRESHOLD: Double
    )

    private var calibrationSamples: MutableList<Double> = mutableListOf()
    // This stores the current state of calibration, including dynamically updated thresholds
    private var currentCalibrationValues: CalibrationValues

    init {
        // Initialize currentCalibrationValues with defaults from config
        currentCalibrationValues = CalibrationValues(
            baselineRed = 0.0,
            baselineVariance = 0.0,
            minRedThreshold = config.MIN_RED_THRESHOLD,
            maxRedThreshold = config.MAX_RED_THRESHOLD,
            isCalibrated = false
        )
    }

    fun handleCalibration(redValue: Double): Boolean {
        // TS logic: if (redValue < 10) return false;
        if (redValue < 10) return false

        calibrationSamples.add(redValue)

        if (calibrationSamples.size >= config.CALIBRATION_SAMPLES) {
            val sortedSamples = calibrationSamples.sorted()
            
            // TS: Trim 10% from both ends
            val trimCountStart = floor(sortedSamples.size * 0.1).toInt()
            val trimCountEnd = ceil(sortedSamples.size * 0.9).toInt()
            // Ensure indices are valid
            val actualEndIndex = if (trimCountEnd > trimCountStart) trimCountEnd else sortedSamples.size
            val trimmedSamples = if (actualEndIndex > trimCountStart) sortedSamples.subList(trimCountStart, actualEndIndex) else sortedSamples

            if (trimmedSamples.isEmpty()) {
                // Not enough samples after trimming, maybe reset or log
                resetCalibration() // Clear samples for next attempt
                return false
            }

            val sum = trimmedSamples.sum()
            val mean = sum / trimmedSamples.size
            val variance = trimmedSamples.map { (it - mean).pow(2) }.average()

            // Update currentCalibrationValues with newly calculated values
            currentCalibrationValues = currentCalibrationValues.copy(
                baselineRed = mean,
                baselineVariance = variance,
                // TS: Math.max(30, mean - Math.sqrt(variance) * 2);
                minRedThreshold = max(30.0, mean - sqrt(variance) * 2.0),
                // TS: Math.min(250, mean + Math.sqrt(variance) * 5);
                maxRedThreshold = min(250.0, mean + sqrt(variance) * 5.0),
                isCalibrated = true
            )
            
            println("CalibrationHandler: Calibración completada: $currentCalibrationValues")

            // TS calls resetCalibration() which only clears samples
            resetCalibration() // Clears calibrationSamples for the next calibration cycle
            return true
        }
        return false
    }

    // Returns a COPY of the current calibration values, as per TS
    fun getCalibrationValues(): CalibrationValues = currentCalibrationValues.copy()

    // TS resetCalibration only clears samples. 
    // The full reset of calibrationValues (isCalibrated = false, thresholds to config) happens in constructor.
    fun resetCalibration() {
        calibrationSamples.clear()
        // If a full reset to initial state is desired (like in Kotlin's previous reset), one would do:
        // currentCalibrationValues = CalibrationValues(
        //     baselineRed = 0.0,
        //     baselineVariance = 0.0,
        //     minRedThreshold = config.MIN_RED_THRESHOLD,
        //     maxRedThreshold = config.MAX_RED_THRESHOLD,
        //     isCalibrated = false
        // )
        // But TS only clears samples here.
    }

    fun isCalibrationComplete(): Boolean = currentCalibrationValues.isCalibrated
} 