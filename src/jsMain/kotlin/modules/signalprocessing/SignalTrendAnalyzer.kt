package modules.signalprocessing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

// Based on src/modules/signal-processing/SignalTrendAnalyzer.ts
class SignalTrendAnalyzer(private val historyLength: Int = 30) {
    private var valueHistory: MutableList<Double> = mutableListOf()
    private var diffHistory: MutableList<Double> = mutableListOf()
    // private var patternHistory: MutableList<String> = mutableListOf() // Not directly used in getAnalysisResult logic, can be omitted or added if complex pattern logic is ported

    data class TrendScores(
        var stability: Double = 0.0,
        var periodicity: Double = 0.0,
        var consistency: Double = 0.0,
        var physiological: Double = 0.0
    )
    private var trendScores = TrendScores()

    fun addValue(value: Double) {
        if (valueHistory.isNotEmpty()) {
            val diff = value - valueHistory.last()
            diffHistory.add(diff)
            if (diffHistory.size > historyLength -1) diffHistory.removeAt(0)
        }
        valueHistory.add(value)
        if (valueHistory.size > historyLength) valueHistory.removeAt(0)
        
        updateAnalysis()
    }

    fun analyzeTrend(value: Double): TrendResult {
        addValue(value)
        val result = getAnalysisResult()
        // Map detailed analysis to simple TrendResult
        return when (result) {
            "highly_stable", "stable" -> TrendResult.STABLE
            "moderately_stable" -> TrendResult.STABLE // Could also be UNSTABLE depending on strictness
            "unstable", "highly_unstable" -> TrendResult.UNSTABLE
            "non_physiological" -> TrendResult.NON_PHYSIOLOGICAL
            else -> TrendResult.UNSTABLE // Default for unknown
        }
    }
    
    private fun updateAnalysis() {
        if (valueHistory.size < 5) {
            trendScores = TrendScores() // Not enough data
            return
        }

        // Stability (inverse of variance, scaled)
        val mean = valueHistory.average()
        val variance = valueHistory.map { (it - mean) * (it - mean) }.average()
        trendScores.stability = max(0.0, 1.0 - variance / (mean.takeIf { it != 0.0 } ?: 1.0)) * 100

        // Periodicity (autocorrelation-like, simplified)
        if (diffHistory.size > 10) {
            val zeroCrossings = diffHistory.zipWithNext { a, b -> a * b < 0 }.count { it }
            trendScores.periodicity = max(0.0, min(1.0, zeroCrossings.toDouble() / (diffHistory.size / 4.0))) * 100 // Heuristic
        } else {
            trendScores.periodicity = 0.0
        }

        // Consistency (rate of change of differences)
        if (diffHistory.size > 5) {
            val diffOfDiffs = diffHistory.zipWithNext { a, b -> abs(a-b) }
            val avgDiffOfDiffs = diffOfDiffs.average()
            trendScores.consistency = max(0.0, 1.0 - avgDiffOfDiffs / (abs(mean).takeIf{it !=0.0} ?: 1.0)) * 100
        } else {
            trendScores.consistency = 0.0
        }
        
        // Physiological plausibility (heuristic based on range and rate of change)
        val minValue = valueHistory.minOrNull() ?: 0.0
        val maxValue = valueHistory.maxOrNull() ?: 0.0
        val rangeScore = if ((maxValue - minValue) < (abs(mean) * 2.0 + 50)) 1.0 else 0.2 // Arbitrary range check factor
        val changeRateScore = if (diffHistory.isNotEmpty() && diffHistory.all { abs(it) < (abs(mean) * 0.5 + 20) }) 1.0 else 0.2 // Arbitrary change rate check
        trendScores.physiological = (rangeScore * 0.5 + changeRateScore * 0.5) * 100
    }

    fun getStabilityScore(): Double = trendScores.stability
    fun getPeriodicityScore(): Double = trendScores.periodicity
    fun getScores(): TrendScores = trendScores

    fun getAnalysisResult(): String { // Returns 'highly_stable' | 'stable' | 'moderately_stable' | 'unstable' | 'highly_unstable' | 'non_physiological'
        val overallScore = (trendScores.stability * 0.4 + trendScores.periodicity * 0.3 + trendScores.consistency * 0.2 + trendScores.physiological * 0.1)
        
        if (trendScores.physiological < 30) return "non_physiological"
        if (valueHistory.size < historyLength / 2) return "unstable" // Not enough data yet

        return when {
            overallScore > 85 && trendScores.stability > 80 && trendScores.periodicity > 70 -> "highly_stable"
            overallScore > 70 && trendScores.stability > 65 && trendScores.periodicity > 50 -> "stable"
            overallScore > 50 && trendScores.stability > 45 -> "moderately_stable"
            overallScore > 30 -> "unstable"
            else -> "highly_unstable"
        }
    }

    fun reset() {
        valueHistory.clear()
        diffHistory.clear()
        trendScores = TrendScores()
    }
} 