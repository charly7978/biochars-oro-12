package com.biocharsproject.shared.modules.signal_processing

import kotlin.math.sqrt

// CalibrationHandlerConfig fields are part of SignalProcessorConfig in Types.kt
// CalibrationValues is defined in Types.kt in this package

class CalibrationHandler(private val config: SignalProcessorConfig) { // Using SignalProcessorConfig
    private var calibrationSamples: MutableList<Double> = mutableListOf()
    private var calibrationValues: CalibrationValues = CalibrationValues(
        baselineRed = 0.0,
        baselineVariance = 0.0,
        minRedThreshold = config.MIN_RED_THRESHOLD,
        maxRedThreshold = config.MAX_RED_THRESHOLD,
        isCalibrated = false
    )

    fun handleCalibration(redValue: Double): Boolean {
        if (calibrationValues.isCalibrated) {
            return true 
        }

        calibrationSamples.add(redValue)

        if (calibrationSamples.size >= config.CALIBRATION_SAMPLES) {
            val mean = calibrationSamples.average()
            val variance = calibrationSamples.map { (it - mean) * (it - mean) }.average()
            val stdDev = sqrt(variance)

            val newMinRedThreshold = mean - 2 * stdDev 
            val newMaxRedThreshold = mean + 2 * stdDev

            calibrationValues = calibrationValues.copy(
                baselineRed = mean,
                baselineVariance = variance,
                minRedThreshold = newMinRedThreshold.coerceIn(config.MIN_RED_THRESHOLD, config.MAX_RED_THRESHOLD),
                maxRedThreshold = newMaxRedThreshold.coerceIn(config.MIN_RED_THRESHOLD, config.MAX_RED_THRESHOLD),
                isCalibrated = true
            )
            calibrationSamples.clear()
            return true
        }
        return false
    }

    fun getCalibrationValues(): CalibrationValues {
        return calibrationValues
    }

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

    fun isCalibrationComplete(): Boolean {
        return calibrationValues.isCalibrated
    }
} 