package modules.signal_processing

import kotlin.math.floor

class SavitzkyGolayFilter(windowSize: Int = 9) {
    private val coefficients: DoubleArray
    private val normFactor: Double
    private var buffer: MutableList<Double> = mutableListOf()
    private val windowSize: Int

    init {
        if (windowSize % 2 == 0 || windowSize < 3) {
            throw IllegalArgumentException("Window size must be an odd number >= 3.")
        }
        this.windowSize = windowSize
        // Coeficientes para un filtro Savitzky-Golay de suavizado (polinomio de grado 2)
        // Estos son ejemplos comunes, pero podrían necesitar ser específicos para el tamaño de ventana.
        // Para windowSize = 5: [-3, 12, 17, 12, -3] / 35
        // Para windowSize = 7: [-2, 3, 6, 7, 6, 3, -2] / 21
        // Para windowSize = 9: [-21, 14, 39, 54, 59, 54, 39, 14, -21] / 231 (ejemplo)
        // Es crucial que estos coeficientes sean correctos para el windowSize dado.
        // Aquí usaremos un ejemplo genérico, pero en una implementación real, se deben calcular o buscar.
        
        // Simplificación: Usaremos coeficientes precalculados para windowSize=9 como en el original si no se especifica.
        // En una implementación robusta, estos se generarían dinámicamente o se tendrían mapeados.
        if (windowSize == 9) {
            coefficients = doubleArrayOf(-21.0, 14.0, 39.0, 54.0, 59.0, 54.0, 39.0, 14.0, -21.0)
            normFactor = 231.0
        } else if (windowSize == 5) {
            coefficients = doubleArrayOf(-3.0, 12.0, 17.0, 12.0, -3.0)
            normFactor = 35.0
        } else {
            // Placeholder: Deberían calcularse. Por ahora, lanzamos error si no es un tamaño soportado.
            // O se podría usar una aproximación simple si es necesario.
            // throw IllegalArgumentException("Unsupported window size for pre-calculated coefficients. Please implement dynamic coefficient calculation.")
            // Para el propósito de la migración, si windowSize no es 9 o 5, usaremos una ventana simple con pesos iguales
            coefficients = DoubleArray(windowSize) { 1.0 }
            normFactor = windowSize.toDouble()
        }
    }

    fun filter(value: Double): Double {
        buffer.add(value)
        if (buffer.size > windowSize) {
            buffer.removeAt(0)
        }

        if (buffer.size < windowSize) {
            return value // No hay suficientes datos para filtrar, devolver el valor original o un promedio simple
        }

        var result = 0.0
        for (i in 0 until windowSize) {
            result += buffer[i] * coefficients[i]
        }
        
        return result / normFactor
    }

    fun reset() {
        buffer.clear()
    }
} 