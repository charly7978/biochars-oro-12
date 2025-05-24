package modules.signalprocessing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

// Based on src/modules/signal-processing/SignalTrendAnalyzer.ts
class SignalTrendAnalyzer(private val historyLength: Int = 30) {
    private var valueHistory: MutableList<Double> = mutableListOf()
    private var diffHistory: MutableList<Double> = mutableListOf()
    private var patternHistory: MutableList<String> = mutableListOf()

    data class TrendScores(
        var stability: Double = 0.0,
        var periodicity: Double = 0.0,
        var consistency: Double = 0.0,
        var physiological: Double = 0.0
    )
    private var trendScores = TrendScores()

    // This method is called by PPGSignalProcessor in TS and provides the scores used.
    // The TS version has hardcoded return values for these, which PPGSignalProcessor uses.
    // For exactness with how PPGSignalProcessor.ts uses it:
    fun getStabilityScore(): Double {
        // return trendScores.stability // If we were to use calculated scores
        return 1.0 // As per TS version for PPGSignalProcessor consumption
    }

    fun getPeriodicityScore(): Double {
        // return trendScores.periodicity // If we were to use calculated scores
        return 1.0 // As per TS version for PPGSignalProcessor consumption
    }

    fun addValue(value: Double) {
        valueHistory.add(value)
        if (valueHistory.size > historyLength) {
            valueHistory.removeAt(0)
        }

        if (valueHistory.size >= 2) {
            val diff = value - valueHistory[valueHistory.size - 2]
            diffHistory.add(diff)
            if (diffHistory.size > historyLength - 1) {
                diffHistory.removeAt(0)
            }

            val pattern = if (diff > 0) "+" else if (diff < 0) "-" else "="
            patternHistory.add(pattern)
            if (patternHistory.size > historyLength - 1) {
                patternHistory.removeAt(0)
            }
        }
        updateAnalysis() // This will populate trendScores
    }

    // This is the method called by PPGSignalProcessor in TS.
    // It should use the trendScores populated by updateAnalysis.
    fun analyzeTrend(value: Double): TrendResult {
        addValue(value) // Ensures value is added and scores are updated first
        
        val stability = trendScores.stability
        val periodicity = trendScores.periodicity
        val consistency = trendScores.consistency
        val physiological = trendScores.physiological

        // Logic from TS analyzeTrend
        if (physiological < 0.3 && valueHistory.size > 15) {
            return TrendResult.NON_PHYSIOLOGICAL
        }

        val stabilityScore = (stability * 0.4 + periodicity * 0.3 + consistency * 0.3)
        return if (stabilityScore > 0.6) TrendResult.STABLE else TrendResult.UNSTABLE
    }

    private fun updateAnalysis() {
        if (valueHistory.size < 6) { // TS: valueHistory.length < 6 (allow analysis earlier)
            trendScores = TrendScores(0.0,0.0,0.0,0.0) // Reset if not enough data
            return
        }

        // 1. Calculate stability (based on normalized standard deviation)
        val mean = valueHistory.average()
        val variance = valueHistory.map { (it - mean).pow(2) }.average()
        val stdDev = sqrt(variance)
        val normalizedStdDev = stdDev / max(1.0, abs(mean))
        // TS: Math.max(0, Math.min(1, 1 - normalizedStdDev * 1.1)); // Antes *2.2
        trendScores.stability = max(0.0, min(1.0, 1.0 - normalizedStdDev * 1.1))

        // 2. Calculate periodicity (based on direction changes)
        var directionChanges = 0
        for (i in 1 until patternHistory.size) {
            if (patternHistory[i] != patternHistory[i-1]) {
                directionChanges++
            }
        }
        val normalizedChanges = if (patternHistory.isNotEmpty()) directionChanges.toDouble() / patternHistory.size else 0.0
        // TS logic for periodicity:
        trendScores.periodicity = when {
            normalizedChanges < 0.2 -> normalizedChanges * 5.0
            normalizedChanges > 0.6 -> max(0.0, 1.0 - (normalizedChanges - 0.6) * 2.5)
            else -> 1.0
        }
        trendScores.periodicity = min(1.0, max(0.0, trendScores.periodicity)) // Ensure 0-1 range

        // 3. Calculate consistency (patrones repetitivos)
        var patternScore = 0.0
        if (patternHistory.size >= 6) {
            val patternStr = patternHistory.joinToString("")
            // TS: if (pattern.includes("+-+-+") || pattern.includes("-+-+-")) { patternScore += 0.6; }
            if (patternStr.contains("+-+-+") || patternStr.contains("-+-+-")) {
                patternScore += 0.6
            }

            // TS: Check sequence of length 4
            // for (let i = 0; i < this.patternHistory.length - 4; i++) {
            //   const subPattern = this.patternHistory.slice(i, i + 4).join('');
            //   if (pattern.lastIndexOf(subPattern) > i + 3) { patternScore += 0.4; break; }
            // }
            // Simplified Kotlin equivalent (lastIndexOf on string is more complex for this specific logic)
            // This part of TS logic is tricky: `pattern.lastIndexOf(subPattern) > i + 3` implies the subPattern appears again *later*
            // A direct translation for finding if a subpattern of length 4 repeats:
            if (patternHistory.size >= 8) { // Need at least 2*4 for a repeat
                for (i in 0 .. patternHistory.size - 4 - 4) { // Iterate to allow a subsequent pattern
                    val subPatternList = patternHistory.subList(i, i + 4)
                    for (j in i + 4 .. patternHistory.size - 4) { // Look for this subPattern later
                        if (patternHistory.subList(j, j + 4) == subPatternList) {
                            patternScore += 0.4
                            break // break inner loop
                        }
                    }
                    if (patternScore > 0.6) break // break outer if found
                }
            }
        }
        trendScores.consistency = min(1.0, patternScore)

        // 4. Verificar si el comportamiento es fisiológicamente plausible
        var physiologicalScore = 0.0
        if (valueHistory.size >= 15 && directionChanges >= 4) {
            // TS: const peaksPerSecond = directionChanges / 2 / (this.valueHistory.length / 30); // Asumir 30fps
            // Assuming 30fps means each valueHistory entry is 1/30th of a second.
            val durationSeconds = valueHistory.size / 30.0
            val peaksPerSecond = if (durationSeconds > 0) (directionChanges / 2.0) / durationSeconds else 0.0
            val equivalentBPM = peaksPerSecond * 60.0

            physiologicalScore = when {
                equivalentBPM >= 40 && equivalentBPM <= 180 -> 1.0
                equivalentBPM > 30 && equivalentBPM < 200 -> 0.5 // Cerca del rango fisiológico
                else -> 0.0
            }
        }
        trendScores.physiological = physiologicalScore
    }

    // This method from TS is not directly used by PPGSignalProcessor, but we can keep its logic if needed.
    fun getScores(): TrendScores = trendScores.copy()
    
    // This method from TS is not directly used by PPGSignalProcessor for its TrendResult.
    // The Kotlin version of analyzeTrend uses this internally.
    // We will keep the TS logic here for completeness or potential future use.
    fun getAnalysisResult(): String { // Corresponds to TS getAnalysisResult
        val (stability, periodicity, consistency, physiological) = trendScores
        val compositeScore = stability * 0.3 + periodicity * 0.3 + consistency * 0.2 + physiological * 0.2
        
        if (physiological < 0.3 && valueHistory.size > 15) {
            return "non_physiological"
        }
        
        return when {
            compositeScore > 0.8 -> "highly_stable"
            compositeScore > 0.65 -> "stable"
            compositeScore > 0.45 -> "moderately_stable"
            compositeScore > 0.25 -> "unstable"
            else -> "highly_unstable"
        }
    }

    fun reset() {
        valueHistory.clear()
        diffHistory.clear()
        patternHistory.clear()
        trendScores = TrendScores(0.0, 0.0, 0.0, 0.0)
    }
} 