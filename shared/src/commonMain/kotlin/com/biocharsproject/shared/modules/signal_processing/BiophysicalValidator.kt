package com.biocharsproject.shared.modules.signal_processing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * BiophysicalValidator verifies that PPG signals conform to expected
 * biophysical parameters of human cardiovascular systems.
 */
class BiophysicalValidator {
    private val lastPulsatilityValues = mutableListOf<Double>()
    private val MAX_PULSATILITY_HISTORY = 30
    private val MIN_PULSATILITY = 0.08
    private val MAX_PULSATILITY = 8.0
    
    private val lastRawValues = mutableListOf<Double>()
    private val lastTimeStamps = mutableListOf<Double>()
    private val MEASUREMENTS_PER_SECOND = 30
    
    // Physiological ranges for valid signals
    private val PHYSIOLOGICAL_RANGES = mapOf(
        "redToGreenRatio" to Pair(1.0, 4.0),
        "redToBlueRatio" to Pair(1.2, 5.0),
        "pulseRate" to Pair(40.0, 200.0),
        "amplitude" to Pair(0.05, 10.0)
    )
    
    /**
     * Calculate the pulsatility index of a PPG signal.
     * Higher values indicate stronger pulse strength.
     */
    fun calculatePulsatilityIndex(value: Double): Double {
        if (lastRawValues.size < 10) {
            lastRawValues.add(value)
            lastTimeStamps.add(getCurrentTime())
            return 0.0
        }
        
        // Add current value
        lastRawValues.add(value)
        lastTimeStamps.add(getCurrentTime())
        
        // Keep only recent history
        if (lastRawValues.size > 100) {
            lastRawValues.removeAt(0)
            lastTimeStamps.removeAt(0)
        }
        
        // Calculate recent min and max for pulsatility
        val recentValues = lastRawValues.takeLast(30)
        val min = recentValues.minOrNull() ?: value
        val max = recentValues.maxOrNull() ?: value
        val avg = recentValues.average()
        
        // Pulsatility index calculation
        val pulsatilityIndex = if (avg > 0) (max - min) / avg else 0.0
        
        // Keep history of pulsatility values
        lastPulsatilityValues.add(pulsatilityIndex)
        if (lastPulsatilityValues.size > MAX_PULSATILITY_HISTORY) {
            lastPulsatilityValues.removeAt(0)
        }
        
        return pulsatilityIndex
    }
    
    /**
     * Analyze cardiac frequency based on signal periodicity
     */
    private fun analyzeCardiacFrequency(): Double {
        if (lastRawValues.size < 30 || lastTimeStamps.size < 30) return 0.0
        
        // Get the last few seconds of data
        val recentValues = lastRawValues.takeLast(60)
        val recentTimestamps = lastTimeStamps.takeLast(60)
        
        val peaks = mutableListOf<Int>()
        val peakThreshold = (recentValues.maxOrNull() ?: 0.0) * 0.7
        
        // Detect peaks
        for (i in 1 until recentValues.size - 1) {
            if (recentValues[i] > peakThreshold && 
                recentValues[i] > recentValues[i-1] && 
                recentValues[i] > recentValues[i+1]) {
                peaks.add(i)
            }
        }
        
        // Calculate average time between peaks
        if (peaks.size < 2) return 0.0
        
        var totalInterval = 0.0
        for (i in 1 until peaks.size) {
            val peakIndex1 = peaks[i-1]
            val peakIndex2 = peaks[i]
            
            val timeInterval = recentTimestamps[peakIndex2] - recentTimestamps[peakIndex1]
            totalInterval += timeInterval
        }
        
        val avgInterval = totalInterval / (peaks.size - 1)
        val beatsPerMs = 1.0 / avgInterval
        val beatsPerMinute = beatsPerMs * 60 * 1000
        
        return beatsPerMinute
    }
    
    /**
     * Analyze zero crossings to validate signal
     */
    private fun analyzeZeroCrossings(): Double {
        if (lastRawValues.size < 30) return 0.0
        
        val recentValues = lastRawValues.takeLast(60)
        val avg = recentValues.average()
        
        // Count zero crossings (crossing the average)
        var crossings = 0
        for (i in 1 until recentValues.size) {
            if ((recentValues[i-1] < avg && recentValues[i] >= avg) || 
                (recentValues[i-1] >= avg && recentValues[i] < avg)) {
                crossings++
            }
        }
        
        // Calculate crossings per second
        val duration = (recentValues.size / MEASUREMENTS_PER_SECOND.toDouble())
        val crossingsPerSecond = crossings / duration
        
        // Typical PPG should have 2-4 crossings per second (for normal heart rates)
        val score = when {
            crossingsPerSecond < 1.0 -> 0.2  // Too slow, likely not a valid signal
            crossingsPerSecond < 2.0 -> 0.5  // Possibly valid but slow
            crossingsPerSecond <= 4.0 -> 1.0  // Ideal range for PPG
            crossingsPerSecond <= 6.0 -> 0.7  // Fast but possibly valid
            crossingsPerSecond <= 8.0 -> 0.4  // Too fast, possibly noise
            else -> 0.1  // Extremely fast, likely noise
        }
        
        return score
    }
    
    /**
     * Validate if signal is within expected biophysical ranges
     */
    fun validateBiophysicalRange(redValue: Double, rToGRatio: Double, rToBRatio: Double): Double {
        // Get expected ranges
        val rToGRange = PHYSIOLOGICAL_RANGES["redToGreenRatio"] ?: Pair(1.0, 4.0)
        val rToBRange = PHYSIOLOGICAL_RANGES["redToBlueRatio"] ?: Pair(1.2, 5.0)
        
        // Calculate scores for each parameter
        val rToGScore = calculateRangeScore(rToGRatio, rToGRange.first, rToGRange.second)
        val rToBScore = calculateRangeScore(rToBRatio, rToBRange.first, rToBRange.second)
        
        // Analyze cardiac frequency and signal periodicity
        val cardiacFreq = analyzeCardiacFrequency()
        val freqScore = if (cardiacFreq > 0) {
            calculateRangeScore(cardiacFreq, 40.0, 200.0)
        } else {
            0.5 // Neutral if we can't calculate yet
        }
        
        // Zero crossings analysis
        val crossingScore = analyzeZeroCrossings()
        
        // Weight the scores
        val colorScore = (rToGScore * 0.6 + rToBScore * 0.4)
        val physiologicalScore = (freqScore * 0.5 + crossingScore * 0.5)
        
        // Combined score with emphasis on color ratios for finger detection
        return colorScore * 0.7 + physiologicalScore * 0.3
    }
    
    /**
     * Calculate how well a value fits within a range
     */
    private fun calculateRangeScore(value: Double, min: Double, max: Double): Double {
        return when {
            value < min -> max(0.0, 1.0 - (min - value) / min)
            value > max -> max(0.0, 1.0 - (value - max) / max)
            else -> {
                // Calculate how close to optimal (middle of range)
                val optimal = (min + max) / 2
                val distance = abs(value - optimal)
                val rangeHalf = (max - min) / 2
                
                // Score is 1.0 at optimal, decreasing toward edges
                val centralityScore = max(0.0, 1.0 - (distance / rangeHalf) * 0.5)
                
                // Within range gets 0.5-1.0 score
                0.5 + centralityScore * 0.5
            }
        }
    }
    
    /**
     * Reset the validator state
     */
    fun reset() {
        lastPulsatilityValues.clear()
        lastRawValues.clear()
        lastTimeStamps.clear()
    }
    
    /**
     * Get current time in milliseconds
     */
    private fun getCurrentTime(): Double {
        return kotlin.js.Date.now()
    }
} 