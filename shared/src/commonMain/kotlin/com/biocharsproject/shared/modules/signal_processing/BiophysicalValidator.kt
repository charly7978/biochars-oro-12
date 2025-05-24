package com.biocharsproject.shared.modules.signal_processing

import kotlin.math.abs
import kotlin.math.max
// import kotlin.math.min // min is not directly used, but max is. abs and sqrt are.
import kotlin.math.sqrt

class BiophysicalValidator {
    private var lastPulsatilityValues: MutableList<Double> = mutableListOf()
    private val MAX_PULSATILITY_HISTORY = 30
    // private val MIN_PULSATILITY = 0.08 
    // private val MAX_PULSATILITY = 8.0
    private var lastRawValues: MutableList<Double> = mutableListOf()
    private var lastTimeStamps: MutableList<Long> = mutableListOf()
    private val MEASUREMENTS_PER_SECOND = 30

    private val PHYSIOLOGICAL_RANGES = mapOf(
        "redValueMin" to 50.0, 
        "redValueMax" to 200.0, 
        "rToGRatioMin" to 0.5,  
        "rToGRatioMax" to 2.0,  
        "rToBRatioMin" to 0.4,  
        "rToBRatioMax" to 2.5   
    )

    constructor() {
        // Initialization if necessary
    }

    fun calculatePulsatilityIndex(value: Double): Double {
        lastRawValues.add(value)
        lastTimeStamps.add(System.currentTimeMillis()) 

        if (lastRawValues.size > MAX_PULSATILITY_HISTORY) {
            lastRawValues.removeAt(0)
            lastTimeStamps.removeAt(0)
        }

        if (lastRawValues.size < 2) return 0.0

        val mean = lastRawValues.average()
        if (mean == 0.0) return 0.0

        val stdDev = sqrt(lastRawValues.map { (it - mean) * (it - mean) }.average())
        
        val pi = stdDev / mean 

        lastPulsatilityValues.add(pi)
        if (lastPulsatilityValues.size > MAX_PULSATILITY_HISTORY) {
            lastPulsatilityValues.removeAt(0)
        }
        
        return if (lastPulsatilityValues.isNotEmpty()) lastPulsatilityValues.average() else 0.0
    }

    private fun analyzeCardiacFrequency(): Double {
        if (lastRawValues.size < MEASUREMENTS_PER_SECOND) return 0.0
        
        var peaks = 0
        for (i in 1 until lastRawValues.size - 1) {
            if (lastRawValues[i] > lastRawValues[i-1] && lastRawValues[i] > lastRawValues[i+1] && lastRawValues[i] > (lastRawValues.average() * 1.1)) {
                peaks++
            }
        }
        val durationSeconds = (lastTimeStamps.last() - lastTimeStamps.first()) / 1000.0
        return if (durationSeconds > 0) (peaks / durationSeconds) * 60.0 else 0.0 // BPM
    }

    private fun analyzeZeroCrossings(): Int {
        if (lastRawValues.size < 2) return 0
        var zeroCrossings = 0
        val mean = lastRawValues.average()
        for (i in 1 until lastRawValues.size) {
            if ((lastRawValues[i-1] - mean) * (lastRawValues[i] - mean) < 0) {
                zeroCrossings++
            }
        }
        return zeroCrossings
    }

    fun validateBiophysicalRange(redValue: Double, rToGRatio: Double, rToBRatio: Double): Double {
        var score = 0.0
        score += calculateRangeScore(redValue, PHYSIOLOGICAL_RANGES["redValueMin"]!!, PHYSIOLOGICAL_RANGES["redValueMax"]!!)
        score += calculateRangeScore(rToGRatio, PHYSIOLOGICAL_RANGES["rToGRatioMin"]!!, PHYSIOLOGICAL_RANGES["rToGRatioMax"]!!)
        score += calculateRangeScore(rToBRatio, PHYSIOLOGICAL_RANGES["rToBRatioMin"]!!, PHYSIOLOGICAL_RANGES["rToBRatioMax"]!!)
        return score / 3.0
    }

    private fun calculateRangeScore(value: Double, minVal: Double, maxVal: Double): Double {
        return when {
            value < minVal || value > maxVal -> 0.0
            value >= minVal && value <= maxVal -> {
                val midPoint = (minVal + maxVal) / 2.0
                val range = maxVal - minVal
                if (range == 0.0) 1.0 else max(0.0, 1.0 - abs(value - midPoint) / (range / 2.0))
            }
            else -> 0.0
        }
    }

    fun reset() {
        lastPulsatilityValues.clear()
        lastRawValues.clear()
        lastTimeStamps.clear()
    }
} 