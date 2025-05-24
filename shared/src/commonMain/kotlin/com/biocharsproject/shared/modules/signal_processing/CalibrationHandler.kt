package com.biocharsproject.shared.modules.signal_processing

import com.biocharsproject.shared.modules.SignalProcessorConfig
import kotlin.math.max
import kotlin.math.min

/**
 * CalibrationHandler manages the calibration process for PPG signal
 * to adapt the detection parameters to the specific camera and lighting conditions.
 */
class CalibrationHandler(private val config: SignalProcessorConfig) {
    private val calibrationSamples = mutableListOf<Double>()
    private var calibrationValues = CalibrationValues(
        baselineRed = 0.0,
        baselineVariance = 0.0,
        minRedThreshold = config.MIN_RED_THRESHOLD,
        maxRedThreshold = config.MAX_RED_THRESHOLD,
        isCalibrated = false
    )
    
    /**
     * Process a new sample for calibration
     * @param redValue The red value from the current frame
     * @return True if calibration is complete, false otherwise
     */
    fun handleCalibration(redValue: Double): Boolean {
        // If already calibrated, no need to continue
        if (calibrationValues.isCalibrated) {
            return true
        }
        
        // Add sample to collection
        calibrationSamples.add(redValue)
        
        // Check if we have enough samples to calibrate
        if (calibrationSamples.size < config.CALIBRATION_SAMPLES) {
            return false
        }
        
        // Filter out extreme values for more stable calibration
        val sortedSamples = calibrationSamples.sorted()
        val trimmedSamples = sortedSamples.subList(
            fromIndex = sortedSamples.size / 10,
            toIndex = sortedSamples.size - sortedSamples.size / 10
        )
        
        // Calculate baseline statistics
        val mean = trimmedSamples.average()
        val variance = trimmedSamples
            .map { (it - mean) * (it - mean) }
            .average()
        
        // Set calibration values
        calibrationValues = CalibrationValues(
            baselineRed = mean,
            baselineVariance = variance,
            minRedThreshold = calculateMinThreshold(mean, variance),
            maxRedThreshold = calculateMaxThreshold(mean, variance),
            isCalibrated = true
        )
        
        return true
    }
    
    /**
     * Calculate minimum threshold based on calibration data
     */
    private fun calculateMinThreshold(mean: Double, variance: Double): Double {
        // Lower bound: mean - 3 * sqrt(variance), but not less than config minimum
        val calculatedMin = max(
            config.MIN_RED_THRESHOLD,
            mean - 3.0 * kotlin.math.sqrt(variance)
        )
        
        return calculatedMin
    }
    
    /**
     * Calculate maximum threshold based on calibration data
     */
    private fun calculateMaxThreshold(mean: Double, variance: Double): Double {
        // Upper bound: mean + 3 * sqrt(variance), but not more than config maximum
        val calculatedMax = min(
            config.MAX_RED_THRESHOLD,
            mean + 3.0 * kotlin.math.sqrt(variance)
        )
        
        return calculatedMax
    }
    
    /**
     * Get the current calibration values
     */
    fun getCalibrationValues(): CalibrationValues {
        return calibrationValues
    }
    
    /**
     * Reset the calibration process
     */
    fun resetCalibration() {
        calibrationSamples.clear()
        calibrationValues = CalibrationValues(
            baselineRed = 0.0,
            baselineVariance = 0.0,
            minRedThreshold = config.MIN_RED_THRESHOLD,
            maxRedThreshold = config.MAX_RED_THRESHOLD,
            isCalibrated = false
        )
    }
    
    /**
     * Check if calibration is complete
     */
    fun isCalibrationComplete(): Boolean {
        return calibrationValues.isCalibrated
    }
}

/**
 * Calibration values for signal processing
 */
data class CalibrationValues(
    val baselineRed: Double,
    val baselineVariance: Double,
    val minRedThreshold: Double,
    val maxRedThreshold: Double,
    val isCalibrated: Boolean
) 