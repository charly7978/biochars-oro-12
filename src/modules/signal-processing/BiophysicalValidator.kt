package modules.signal_processing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class BiophysicalValidator {
    private var lastPulsatilityValues: MutableList<Double> = mutableListOf()
    private val MAX_PULSATILITY_HISTORY = 30
    private val MIN_PULSATILITY = 0.08 // Antes 0.15, más permisivo para hardware débil
    private val MAX_PULSATILITY = 8.0
    private var lastRawValues: MutableList<Double> = mutableListOf() // Raw values for trend analysis
    private var lastTimeStamps: MutableList<Long> = mutableListOf() // Timestamps for temporal analysis
    private val MEASUREMENTS_PER_SECOND = 30 // Assumed frame rate

    // No está claro cómo se usan los valores de redValue, rToGRatio, rToBRatio en el original dentro de PHYSIOLOGICAL_RANGES
    // ya que el constructor no los recibe. Asumiré que son rangos generales.
    private val PHYSIOLOGICAL_RANGES = mapOf(
        "redValueMin" to 50.0, // Ejemplo, ajustar
        "redValueMax" to 200.0, // Ejemplo, ajustar
        "rToGRatioMin" to 0.5,  // Ejemplo, ajustar
        "rToGRatioMax" to 2.0,  // Ejemplo, ajustar
        "rToBRatioMin" to 0.4,  // Ejemplo, ajustar
        "rToBRatioMax" to 2.5   // Ejemplo, ajustar
    )

    // El constructor original está vacío. Si se necesitan parámetros, se añadirán.
    constructor() {
        // Inicialización si es necesaria
    }

    fun calculatePulsatilityIndex(value: Double): Double {
        lastRawValues.add(value)
        lastTimeStamps.add(System.currentTimeMillis()) // Usar tiempo actual del sistema

        if (lastRawValues.size > MAX_PULSATILITY_HISTORY) {
            lastRawValues.removeAt(0)
            lastTimeStamps.removeAt(0)
        }

        if (lastRawValues.size < 2) return 0.0

        val mean = lastRawValues.average()
        if (mean == 0.0) return 0.0 // Evitar división por cero

        val stdDev = sqrt(lastRawValues.map { (it - mean) * (it - mean) }.average())
        
        // Índice de pulsatilidad de Krishnan et al. (simplificado)
        // PI = (Max - Min) / Mean. Aquí usamos stdDev como proxy de la amplitud.
        val pi = stdDev / mean 

        lastPulsatilityValues.add(pi)
        if (lastPulsatilityValues.size > MAX_PULSATILITY_HISTORY) {
            lastPulsatilityValues.removeAt(0)
        }
        
        // Devolver un promedio de los últimos valores de PI para suavizar
        return if (lastPulsatilityValues.isNotEmpty()) lastPulsatilityValues.average() else 0.0
    }

    // La función analyzeCardiacFrequency no estaba completamente definida en el outline.
    // Se requeriría la lógica completa de TS para una traducción precisa.
    // Placeholder:
    private fun analyzeCardiacFrequency(): Double {
        // Lógica para analizar la frecuencia cardíaca a partir de lastRawValues y lastTimeStamps
        // Por ejemplo, contar picos o usar FFT.
        // Esto es una simplificación extrema.
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

    // La función analyzeZeroCrossings no estaba completamente definida en el outline.
    // Placeholder:
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
        return score / 3.0 // Normalizar el score
    }

    private fun calculateRangeScore(value: Double, minVal: Double, maxVal: Double): Double {
        return when {
            value < minVal || value > maxVal -> 0.0 // Fuera de rango
            value >= minVal && value <= maxVal -> {
                // Puntuación más alta cuanto más cerca del centro del rango
                val मध्य = (minVal + maxVal) / 2.0
                val range = maxVal - minVal
                if (range == 0.0) 1.0 else max(0.0, 1.0 - abs(value - मध्य) / (range / 2.0))
            }
            else -> 0.0 // No debería ocurrir
        }
    }

    fun reset() {
        lastPulsatilityValues.clear()
        lastRawValues.clear()
        lastTimeStamps.clear()
    }
} 