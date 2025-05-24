package modules.signal_processing

import kotlin.math.abs

// Tipo para el resultado del análisis de tendencia
typealias TrendResult = String // "stable" | "unstable" | "non_physiological"
// En Kotlin, podemos usar un enum para mayor seguridad de tipos si estos son los únicos valores posibles:
// enum class TrendResultType { STABLE, UNSTABLE, NON_PHYSIOLOGICAL }

data class TrendScores(
    var stability: Double = 0.0,
    var periodicity: Double = 0.0,
    var consistency: Double = 0.0,
    var physiological: Double = 0.0
)

class SignalTrendAnalyzer(private val historyLength: Int = 30) {
    private var valueHistory: MutableList<Double> = mutableListOf()
    private var diffHistory: MutableList<Double> = mutableListOf()
    private var patternHistory: MutableList<String> = mutableListOf() // "+", "-", "0"
    private var trendScores: TrendScores = TrendScores()

    companion object {
        private const val STABILITY_THRESHOLD_LOW = 0.1
        private const val STABILITY_THRESHOLD_HIGH = 0.3
        private const val PERIODICITY_THRESHOLD = 0.5
        private const val CONSISTENCY_THRESHOLD = 0.6
        private const val PHYSIOLOGICAL_CHANGE_THRESHOLD = 0.5 // Ejemplo, ajustar según necesidad
    }

    fun analyzeTrend(value: Double): TrendResult {
        addValue(value)
        return getAnalysisResult()
    }

    fun getStabilityScore(): Double {
        return trendScores.stability
    }

    fun getPeriodicityScore(): Double {
        return trendScores.periodicity
    }

    fun addValue(value: Double) {
        if (valueHistory.isNotEmpty()) {
            val diff = value - valueHistory.last()
            diffHistory.add(diff)
            if (diffHistory.size > historyLength) {
                diffHistory.removeAt(0)
            }

            when {
                diff > 0 -> patternHistory.add("+")
                diff < 0 -> patternHistory.add("-")
                else -> patternHistory.add("0")
            }
            if (patternHistory.size > historyLength) {
                patternHistory.removeAt(0)
            }
        }

        valueHistory.add(value)
        if (valueHistory.size > historyLength) {
            valueHistory.removeAt(0)
        }

        if (valueHistory.size >= historyLength / 2) { // Empezar a analizar cuando hay suficientes datos
            updateAnalysis()
        }
    }

    private fun updateAnalysis() {
        if (valueHistory.size < 2) {
            trendScores = TrendScores() // Resetear si no hay suficientes datos
            return
        }

        // Calculate Stability (e.g., based on variance or range)
        val mean = valueHistory.average()
        val variance = valueHistory.map { (it - mean) * (it - mean) }.average()
        trendScores.stability = 1.0 / (1.0 + variance) // Normalizar, más alto es más estable

        // Calculate Periodicity (e.g., autocorrelation or dominant frequency analysis - simplified here)
        // Esta es una simplificación. Una detección de periodicidad real es más compleja.
        var signChanges = 0
        for (i in 1 until diffHistory.size) {
            if ((diffHistory[i] > 0 && diffHistory[i-1] < 0) || (diffHistory[i] < 0 && diffHistory[i-1] > 0)) {
                signChanges++
            }
        }
        trendScores.periodicity = if (diffHistory.size > 1) signChanges.toDouble() / diffHistory.size else 0.0

        // Calculate Consistency (e.g., how often the pattern changes)
        var patternChanges = 0
        for (i in 1 until patternHistory.size) {
            if (patternHistory[i] != patternHistory[i-1]) {
                patternChanges++
            }
        }
        trendScores.consistency = if (patternHistory.size > 1) 1.0 - (patternChanges.toDouble() / patternHistory.size) else 0.0

        // Calculate Physiological plausibility (e.g., changes are within expected physiological rates)
        val maxChange = diffHistory.maxOfOrNull { abs(it) } ?: 0.0
        trendScores.physiological = if (maxChange < PHYSIOLOGICAL_CHANGE_THRESHOLD) 1.0 else 0.0 
    }

    fun getScores(): TrendScores {
        return trendScores
    }

    fun getAnalysisResult(): TrendResult {
        // Lógica basada en la implementación original que devuelve una cadena descriptiva
        // Esta lógica puede necesitar ajustes para coincidir con la complejidad del original
        val stability = trendScores.stability
        val periodicity = trendScores.periodicity
        // val consistency = trendScores.consistency // No usado directamente en la lógica original de getAnalysisResult
        val physiological = trendScores.physiological

        if (physiological < 0.5) return "non_physiological"
        
        return when {
            stability > 0.8 && periodicity > PERIODICITY_THRESHOLD -> "highly_stable"
            stability > 0.6 && periodicity > PERIODICITY_THRESHOLD * 0.8 -> "stable"
            stability > 0.4 -> "moderately_stable"
            stability > 0.2 -> "unstable"
            else -> "highly_unstable"
        }
    }

    fun reset() {
        valueHistory.clear()
        diffHistory.clear()
        patternHistory.clear()
        trendScores = TrendScores()
    }
} 