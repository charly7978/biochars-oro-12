package modules.signalprocessing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// Based on src/modules/signal-processing/BiophysicalValidator.ts
class BiophysicalValidator {
    // Properties from TS version, even if not all used by the simplified public methods
    private var lastPulsatilityValues: MutableList<Double> = mutableListOf()
    private val MAX_PULSATILITY_HISTORY = 30 // From TS, though not used by simplified calculatePulsatilityIndex
    private val MIN_PULSATILITY = 0.08     // From TS, ""
    private val MAX_PULSATILITY = 8.0      // From TS, ""

    private var lastRawValues: MutableList<Double> = mutableListOf()
    private var lastTimeStamps: MutableList<Double> = mutableListOf()
    // private val MEASUREMENTS_PER_SECOND = 30 // TS constant, not directly used by simplified methods

    // PHYSIOLOGICAL_RANGES and calculateRangeScore from TS are not strictly needed if 
    // validateBiophysicalRange returns a hardcoded 1.0 as in TS.
    // Keeping them commented out or minimal if a more detailed implementation is desired later.
    /*
    private val PHYSIOLOGICAL_RANGES = mapOf(
        "redToGreen" to Triple(1.2, 3.2, 0.4), 
        "redToBlue" to Triple(1.1, 3.8, 0.3),
        "redValue" to Triple(30.0, 220.0, 0.3)
    )
    private fun calculateRangeScore(value: Double, min: Double, max: Double): Double {
        // TS Logic: 
        // if (value >= min && value <= max) return 1.0;
        // if (value < min) { ... }
        // else { ... }
        return 1.0 // Placeholder if not fully implemented like TS version
    }
    */

    init {
        reset() // constructor in TS calls reset
    }

    // As per TS BiophysicalValidator's usage by PPGSignalProcessor:
    // LÓGICA ULTRA-SIMPLE: la pulsatilidad siempre es 1
    fun calculatePulsatilityIndex(value: Double): Double {
        // Original Kotlin logic commented out to match TS simple version
        /*
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
        val normalizedPulsatility = (min(max(currentPulsatility, MIN_PULSATILITY), MAX_PULSATILITY) - MIN_PULSATILITY) / (MAX_PULSATILITY - MIN_PULSATILITY)
        return min(1.0, max(0.0, normalizedPulsatility * 2.0))
        */
        // Add value to lastRawValues and lastTimeStamps as TS version might implicitly do this before calling these simple methods
        // However, TS version doesn't show these being updated directly by calculatePulsatilityIndex or validateBiophysicalRange calls.
        // Let's assume PPGSignalProcessor manages adding raw data to these lists if needed by other parts (which are not currently ported/used).
        return 1.0
    }

    // As per TS BiophysicalValidator's usage by PPGSignalProcessor:
    // LÓGICA ULTRA-SIMPLE: la validación biofísica siempre es 1
    fun validateBiophysicalRange(redValue: Double, rToGRatio: Double, rToBRatio: Double): Double {
        // Original Kotlin logic commented out to match TS simple version
        /*
        var score = 0.0
        var count = 0
        PHYSIOLOGICAL_RANGES["redValue"]?.let {
            score += calculateRangeScore(redValue, it.first, it.second) // Assuming calculateRangeScore is defined like TS
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
        */
        return 1.0
    }

    fun reset() {
        lastPulsatilityValues.clear()
        lastRawValues.clear() 
        lastTimeStamps.clear()
    }
} 