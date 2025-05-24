package com.biocharsproject.shared.modules.signal_processing

import kotlin.math.abs

/**
 * Implementación del filtro Savitzky-Golay para suavizado de señal PPG
 * 
 * El filtro Savitzky-Golay es superior a un simple promedio móvil ya que preserva
 * características como los picos y valles que son esenciales en la señal PPG,
 * mientras elimina el ruido de alta frecuencia.
 */
class SavitzkyGolayFilter {
    private val buffer = mutableListOf<Double>()
    private val coefficients: DoubleArray
    private val normalizationFactor: Double
    private val windowSize: Int
    
    /**
     * Constructor con tamaño de ventana configurable
     * 
     * @param windowSize Tamaño de la ventana de filtrado (debe ser impar)
     */
    constructor(windowSize: Int = 9) {
        // Asegurar que el tamaño de la ventana sea impar
        this.windowSize = if (windowSize % 2 == 0) windowSize + 1 else windowSize
        
        // Generar coeficientes para un filtro de segundo orden
        coefficients = generateSavitzkyGolayCoefficients(this.windowSize, 2)
        
        // Calcular factor de normalización
        normalizationFactor = coefficients.sum()
    }
    
    /**
     * Aplica el filtro a un nuevo valor
     * 
     * @param value El nuevo valor a filtrar
     * @return El valor filtrado
     */
    fun filter(value: Double): Double {
        // Añadir el valor al buffer
        buffer.add(value)
        
        // Mantener el buffer limitado al tamaño de la ventana
        if (buffer.size > windowSize) {
            buffer.removeAt(0)
        }
        
        // Si no tenemos suficientes valores, devolver el valor actual
        if (buffer.size < windowSize) {
            return value
        }
        
        // Aplicar los coeficientes del filtro
        var result = 0.0
        for (i in buffer.indices) {
            result += buffer[i] * coefficients[i]
        }
        
        // Normalizar el resultado
        return result / normalizationFactor
    }
    
    /**
     * Reinicia el filtro
     */
    fun reset() {
        buffer.clear()
    }
    
    /**
     * Genera coeficientes para el filtro Savitzky-Golay
     * 
     * @param windowSize Tamaño de la ventana (impar)
     * @param polynomialOrder Orden del polinomio (típicamente 2 o 4)
     * @return Array de coeficientes
     */
    private fun generateSavitzkyGolayCoefficients(windowSize: Int, polynomialOrder: Int): DoubleArray {
        // Para un filtro Savitzky-Golay de orden 2 y tamaño de ventana común,
        // utilizamos coeficientes predefinidos por eficiencia
        return when (windowSize) {
            5 -> doubleArrayOf(-3.0, 12.0, 17.0, 12.0, -3.0)  // Normalizar con 35
            7 -> doubleArrayOf(-2.0, 3.0, 6.0, 7.0, 6.0, 3.0, -2.0)  // Normalizar con 21
            9 -> doubleArrayOf(-21.0, 14.0, 39.0, 54.0, 59.0, 54.0, 39.0, 14.0, -21.0)  // Normalizar con 231
            11 -> doubleArrayOf(-36.0, 9.0, 44.0, 69.0, 84.0, 89.0, 84.0, 69.0, 44.0, 9.0, -36.0)  // Normalizar con 429
            13 -> doubleArrayOf(-11.0, 0.0, 9.0, 16.0, 21.0, 24.0, 25.0, 24.0, 21.0, 16.0, 9.0, 0.0, -11.0)  // Normalizar con 143
            15 -> doubleArrayOf(-78.0, -13.0, 42.0, 87.0, 122.0, 147.0, 162.0, 167.0, 162.0, 147.0, 122.0, 87.0, 42.0, -13.0, -78.0)  // Normalizar con 1105
            else -> {
                // Para otros tamaños, generamos coeficientes aproximados
                // Este es un enfoque simplificado, no el cálculo completo de SG
                val halfWindow = windowSize / 2
                DoubleArray(windowSize) { i ->
                    val position = i - halfWindow
                    when {
                        abs(position) > halfWindow - 1 -> -1.0
                        abs(position) > halfWindow - 3 -> 0.0
                        else -> (halfWindow - abs(position)).toDouble()
                    }
                }
            }
        }
    }
    
    /**
     * Calcula la varianza de los valores en el buffer
     * Útil para analizar la estabilidad de la señal
     */
    fun calculateVariance(): Double {
        if (buffer.size < 3) return 0.0
        
        val mean = buffer.average()
        val variance = buffer.sumOf { (it - mean) * (it - mean) } / buffer.size
        
        return variance
    }
    
    /**
     * Devuelve el último valor filtrado sin agregar uno nuevo
     */
    fun getLastFilteredValue(): Double {
        if (buffer.isEmpty()) return 0.0
        
        // Si no tenemos suficientes valores, devolver el último valor
        if (buffer.size < windowSize) {
            return buffer.last()
        }
        
        // Aplicar los coeficientes del filtro
        var result = 0.0
        for (i in buffer.indices) {
            result += buffer[i] * coefficients[i]
        }
        
        // Normalizar el resultado
        return result / normalizationFactor
    }
} 