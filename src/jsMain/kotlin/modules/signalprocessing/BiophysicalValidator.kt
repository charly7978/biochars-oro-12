package modules.signalprocessing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// Based on src/modules/signal-processing/BiophysicalValidator.ts
class BiophysicalValidator {
    private var lastPulsatilityValues: MutableList<Double> = mutableListOf()
    private val MAX_PULSATILITY_HISTORY = 30
    private val MIN_PULSATILITY = 0.08 
    private val MAX_PULSATILITY = 8.0
    // private var lastRawValues: MutableList<Double> = mutableListOf() // Not directly used in ported functions
    // private var lastTimeStamps: MutableList<Double> = mutableListOf() // Not directly used
    // private val MEASUREMENTS_PER_SECOND = 30 // Not directly used

    // Simplified physiological ranges for the Kotlin version
    private val PHYSIOLOGICAL_RANGES = mapOf(
        "redValue" to Pair(0.0, 255.0), // Raw sensor data range
        "rToGRatio" to Pair(0.4, 2.5), // Typical R/G ratio for skin
        "rToBRatio" to Pair(0.3, 3.0)  // Typical R/B ratio for skin
    )

    fun calculatePulsatilityIndex(value: Double): Double {
        if (lastPulsatilityValues.isEmpty()) {
            lastPulsatilityValues.add(abs(value))
            return 0.5 // Neutral initial value
        }
        val meanLastValues = lastPulsatilityValues.average()
        if (meanLastValues == 0.0) return 0.0

        val currentPulsatility = abs(value - meanLastValues) / meanLastValues
        
        lastPulsatilityValues.add(abs(value))
        if (lastPulsatilityValues.size > MAX_PULSATILITY_HISTORY) {
            lastPulsatilityValues.removeAt(0)
        }
        // Clamp and normalize the pulsatility index to a 0-1 range (approx)
        val normalizedPulsatility = (min(max(currentPulsatility, MIN_PULSATILITY), MAX_PULSATILITY) - MIN_PULSATILITY) / (MAX_PULSATILITY - MIN_PULSATILITY)
        return min(1.0, max(0.0, normalizedPulsatility * 2.0)) // Scale to make it more sensitive in the 0-1 range
    }

    // analyzeCardiacFrequency and analyzeZeroCrossings were complex and seemed to be for internal 
    // calculations not directly exposed or used by PPGSignalProcessor in the provided TS.
    // If they become necessary, they would need careful porting.

    fun validateBiophysicalRange(redValue: Double, rToGRatio: Double, rToBRatio: Double): Double {
        var score = 0.0
        var count = 0

        PHYSIOLOGICAL_RANGES["redValue"]?.let {
            score += calculateRangeScore(redValue, it.first, it.second)
            count++
        }
        PHYSIOLOGICAL_RANGES["rToGRatio"]?.let {
            score += calculateRangeScore(rToGRatio, it.first, it.second)
            count++
        }
        PHYSIOLOGICAL_RANGES["rToBRatio"]?.let {
            score += calculateRangeScore(rToBRatio, it.first, it.second)
            count++
        }
        return if (count > 0) score / count else 0.0
    }

    private fun calculateRangeScore(value: Double, min: Double, max: Double): Double {
        return when {
            value < min || value > max -> 0.0 // Outside range
            value >= min && value <= max -> {
                // Simple linear score: 1.0 if in middle, decreases towards edges
                val mid = (min + max) / 2.0
                val range = (max - min) / 2.0
                if (range == 0.0) 1.0 else max(0.0, 1.0 - abs(value - mid) / range)
            }
            else -> 0.1 // Default for NaN or unexpected values
        }
    }

    fun reset() {
        lastPulsatilityValues.clear()
        // lastRawValues.clear()
        // lastTimeStamps.clear()
    }
} 