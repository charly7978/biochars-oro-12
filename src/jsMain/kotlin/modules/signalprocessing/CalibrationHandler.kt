package modules.signalprocessing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

// Based on src/modules/signal-processing/CalibrationHandler.ts
class CalibrationHandler(private val config: Config) {
    data class Config(
        val CALIBRATION_SAMPLES: Int,
        val MIN_RED_THRESHOLD: Double,
        val MAX_RED_THRESHOLD: Double
    )

    private var calibrationSamples: MutableList<Double> = mutableListOf()
    private var calibrationValues: CalibrationValues = CalibrationValues(0.0, 0.0, config.MIN_RED_THRESHOLD, config.MAX_RED_THRESHOLD, false)

    fun handleCalibration(redValue: Double): Boolean {
        if (calibrationValues.isCalibrated) return true

        // Basic validation of redValue (can be expanded)
        if (redValue <= 0 || redValue > 255) {
            // console.warn("CalibrationHandler: Invalid red value for calibration ($redValue)")
            return false // Invalid sample
        }

        calibrationSamples.add(redValue)

        if (calibrationSamples.size >= config.CALIBRATION_SAMPLES) {
            val mean = calibrationSamples.average()
            val variance = calibrationSamples.map { (it - mean) * (it - mean) }.average()
            // val stdDev = sqrt(variance)

            // Define dynamic thresholds based on calibration data (example logic)
            val dynamicMinRed = max(config.MIN_RED_THRESHOLD, mean - 2 * sqrt(variance))
            val dynamicMaxRed = min(config.MAX_RED_THRESHOLD, mean + 2 * sqrt(variance))
            
            calibrationValues = CalibrationValues(
                baselineRed = mean,
                baselineVariance = variance,
                minRedThreshold = dynamicMinRed.coerceAtLeast(0.0),       // Ensure non-negative
                maxRedThreshold = dynamicMaxRed.coerceAtMost(255.0),   // Ensure within 0-255
                isCalibrated = true
            )
            // console.log("CalibrationHandler: Calibration complete", calibrationValues)
            return true
        }
        return false
    }

    fun getCalibrationValues(): CalibrationValues = calibrationValues

    fun resetCalibration() {
        calibrationSamples.clear()
        calibrationValues = CalibrationValues(0.0, 0.0, config.MIN_RED_THRESHOLD, config.MAX_RED_THRESHOLD, false)
        // console.log("CalibrationHandler: Calibration reset")
    }

    fun isCalibrationComplete(): Boolean = calibrationValues.isCalibrated
} 