package com.biocharsproject.shared.modules.signal_processing

import kotlin.math.abs
import kotlin.math.min
import kotlin.math.max

/**
 * Result of a trend analysis
 */
enum class TrendResult {
    STABLE, UNSTABLE, NON_PHYSIOLOGICAL
}

/**
 * SignalTrendAnalyzer analyzes PPG signal patterns over time to detect
 * stability, periodicity, and physiological validity.
 */
class SignalTrendAnalyzer(private val historyLength: Int = 30) {
    private val valueHistory = mutableListOf<Double>()
    private val diffHistory = mutableListOf<Double>()
    private val patternHistory = mutableListOf<String>()
    
    private val trendScores = TrendScores(
        stability = 0.0,
        periodicity = 0.0,
        consistency = 0.0,
        physiological = 0.0
    )
    
    /**
     * Analyze trend of the signal based on history
     * @param value The new value to analyze
     * @return The trend result classification
     */
    fun analyzeTrend(value: Double): TrendResult {
        // Add value to history
        addValue(value)
        
        // If we don't have enough history, consider it unstable
        if (valueHistory.size < min(10, historyLength / 3)) {
            return TrendResult.UNSTABLE
        }
        
        // Update all trend metrics
        updateAnalysis()
        
        // Classify result based on scores
        return when {
            trendScores.physiological < 0.3 -> TrendResult.NON_PHYSIOLOGICAL
            trendScores.stability > 0.6 && trendScores.periodicity > 0.5 -> TrendResult.STABLE
            else -> TrendResult.UNSTABLE
        }
    }
    
    /**
     * Get the current stability score (0-1)
     */
    fun getStabilityScore(): Double {
        return trendScores.stability
    }
    
    /**
     * Get the current periodicity score (0-1)
     */
    fun getPeriodicityScore(): Double {
        return trendScores.periodicity
    }
    
    /**
     * Add a new value to the history and update difference history
     */
    fun addValue(value: Double): Unit {
        // Add the value to history
        valueHistory.add(value)
        
        // Keep history at the right size
        if (valueHistory.size > historyLength) {
            valueHistory.removeAt(0)
        }
        
        // Calculate differences
        if (valueHistory.size >= 2) {
            val diff = value - valueHistory[valueHistory.size - 2]
            diffHistory.add(diff)
            
            // Keep diff history same size as value history
            if (diffHistory.size > historyLength - 1) {
                diffHistory.removeAt(0)
            }
            
            // Add pattern (up, down, same)
            val pattern = when {
                diff > 0.05 -> "U" // Up
                diff < -0.05 -> "D" // Down
                else -> "S" // Same
            }
            patternHistory.add(pattern)
            
            // Keep pattern history same size as diff history
            if (patternHistory.size > historyLength - 1) {
                patternHistory.removeAt(0)
            }
        }
    }
    
    /**
     * Update all analysis metrics based on current history
     */
    private fun updateAnalysis() {
        if (valueHistory.size < 5 || diffHistory.size < 4) {
            return
        }
        
        // Calculate stability score
        val recentValues = valueHistory.takeLast(min(valueHistory.size, 20))
        val min = recentValues.minOrNull() ?: 0.0
        val max = recentValues.maxOrNull() ?: 0.0
        val mean = recentValues.average()
        
        // Coefficient of variation (lower is more stable)
        val absVariation = if (mean != 0.0) (max - min) / mean else 1.0
        val stabilityScore = max(0.0, min(1.0, 1.0 - absVariation))
        trendScores.stability = stabilityScore
        
        // Calculate periodicity score by looking for repeated patterns
        val periodicityScore = calculatePeriodicityScore()
        trendScores.periodicity = periodicityScore
        
        // Calculate consistency (how well the signal follows expected patterns)
        val consistencyScore = calculateConsistencyScore()
        trendScores.consistency = consistencyScore
        
        // Physiological validity check
        val physiologicalScore = calculatePhysiologicalScore()
        trendScores.physiological = physiologicalScore
    }
    
    /**
     * Calculate periodicity score by analyzing patterns in the signal
     */
    private fun calculatePeriodicityScore(): Double {
        if (patternHistory.size < 8) return 0.0
        
        // Look for repeating up-down patterns (characteristic of PPG)
        var periodicCount = 0
        var nonPeriodicCount = 0
        
        // Count "up-down" and "down-up" transitions
        for (i in 0 until patternHistory.size - 1) {
            val current = patternHistory[i]
            val next = patternHistory[i + 1]
            
            if ((current == "U" && next == "D") || (current == "D" && next == "U")) {
                periodicCount++
            } else if (current != "S" && next != "S") {
                nonPeriodicCount++
            }
        }
        
        // Calculate score - higher when more periodic transitions
        val total = periodicCount + nonPeriodicCount
        return if (total > 0) {
            max(0.0, min(1.0, periodicCount.toDouble() / total))
        } else {
            0.0
        }
    }
    
    /**
     * Calculate consistency score
     */
    private fun calculateConsistencyScore(): Double {
        if (diffHistory.size < 8) return 0.0
        
        // Calculate variance of differences
        val diffs = diffHistory.takeLast(min(diffHistory.size, 20))
        val meanDiff = diffs.average()
        val diffVariance = diffs.map { (it - meanDiff) * (it - meanDiff) }.average()
        
        // Lower variance means more consistent changes
        return max(0.0, min(1.0, 1.0 - diffVariance.coerceIn(0.0, 1.0)))
    }
    
    /**
     * Calculate physiological score
     */
    private fun calculatePhysiologicalScore(): Double {
        if (valueHistory.size < 10) return 0.5
        
        // Check for physiologically plausible patterns in PPG
        // 1. Regular up-down patterns
        // 2. Reasonable amplitude variation
        
        // Count direction changes (should be regular in PPG)
        var directionChanges = 0
        var lastDirection = ""
        
        for (pattern in patternHistory) {
            if (pattern != "S" && pattern != lastDirection && lastDirection.isNotEmpty()) {
                directionChanges++
            }
            if (pattern != "S") {
                lastDirection = pattern
            }
        }
        
        // PPG typically has 2-4 direction changes per second (at 30Hz, 20 samples ≈ 0.67s)
        val recentPatterns = patternHistory.takeLast(min(patternHistory.size, 20))
        val expectedChanges = recentPatterns.size / 10.0 * 3.0  // ~3 changes per 10 samples
        val actualChanges = directionChanges.toDouble()
        
        val changeScore = if (expectedChanges > 0) {
            val ratio = actualChanges / expectedChanges
            when {
                ratio < 0.5 -> ratio * 2.0  // Too few changes
                ratio > 1.5 -> max(0.0, 1.0 - (ratio - 1.5) / 1.5)  // Too many changes
                else -> 1.0  // Just right
            }
        } else {
            0.5
        }
        
        return changeScore
    }
    
    /**
     * Get the current trend scores
     */
    fun getScores(): TrendScores {
        return trendScores.copy()
    }
    
    /**
     * Get a detailed analysis result classification
     */
    fun getAnalysisResult(): TrendClassification {
        // Highly stable: stable + periodic + consistent
        return when {
            trendScores.physiological < 0.3 -> TrendClassification.NON_PHYSIOLOGICAL
            trendScores.stability > 0.8 && trendScores.periodicity > 0.7 && trendScores.consistency > 0.7 -> 
                TrendClassification.HIGHLY_STABLE
            trendScores.stability > 0.7 && trendScores.periodicity > 0.6 -> 
                TrendClassification.STABLE
            trendScores.stability > 0.5 && trendScores.periodicity > 0.4 -> 
                TrendClassification.MODERATELY_STABLE
            trendScores.stability > 0.3 -> 
                TrendClassification.UNSTABLE
            else -> 
                TrendClassification.HIGHLY_UNSTABLE
        }
    }
    
    /**
     * Reset the analyzer state
     */
    fun reset() {
        valueHistory.clear()
        diffHistory.clear()
        patternHistory.clear()
        trendScores.stability = 0.0
        trendScores.periodicity = 0.0
        trendScores.consistency = 0.0
        trendScores.physiological = 0.0
    }
}

/**
 * Detailed trend classification
 */
enum class TrendClassification {
    HIGHLY_STABLE,
    STABLE,
    MODERATELY_STABLE,
    UNSTABLE,
    HIGHLY_UNSTABLE,
    NON_PHYSIOLOGICAL
}

/**
 * Scores for different aspects of signal trend
 */
data class TrendScores(
    var stability: Double,
    var periodicity: Double,
    var consistency: Double,
    var physiological: Double
) 