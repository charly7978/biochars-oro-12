package com.biocharsproject.shared.modules.signal_processing

import kotlin.math.abs

/**
 * Savitzky-Golay filter implementation for smoothing PPG signals.
 * This filter performs local polynomial regression to preserve features
 * like peaks while removing noise.
 */
class SavitzkyGolayFilter(windowSize: Int = 9) {
    private val coefficients: DoubleArray
    private val normFactor: Double
    private val buffer = mutableListOf<Double>()
    private val windowSize: Int
    
    init {
        // Ensure window size is odd
        this.windowSize = if (windowSize % 2 == 0) windowSize + 1 else windowSize
        
        // Generate quadratic Savitzky-Golay coefficients for the specified window size
        coefficients = generateQuadraticCoefficients(this.windowSize)
        normFactor = coefficients.sum()
    }
    
    /**
     * Apply the Savitzky-Golay filter to a new value
     * @param value The new value to filter
     * @return The filtered value
     */
    fun filter(value: Double): Double {
        // Add the value to the buffer
        buffer.add(value)
        
        // If buffer is not full yet, return the input value
        if (buffer.size < windowSize) {
            return value
        }
        
        // If buffer is too large, remove oldest values
        while (buffer.size > windowSize) {
            buffer.removeAt(0)
        }
        
        // Apply the filter by convolving with coefficients
        var filteredValue = 0.0
        for (i in buffer.indices) {
            filteredValue += buffer[i] * coefficients[i]
        }
        
        // Normalize
        return filteredValue / normFactor
    }
    
    /**
     * Reset the filter buffer
     */
    fun reset() {
        buffer.clear()
    }
    
    /**
     * Generate quadratic Savitzky-Golay coefficients for the given window size.
     * This implementation uses a simplified approach for quadratic fitting.
     */
    private fun generateQuadraticCoefficients(windowSize: Int): DoubleArray {
        val halfWindow = windowSize / 2
        val result = DoubleArray(windowSize)
        
        // For quadratic fit (order 2), use the formula for each coefficient
        for (i in 0 until windowSize) {
            val x = i - halfWindow
            // Quadratic coefficient: 3(3n² - W² + 1) / (2W(W² - 1))
            // Where n is position relative to center, W is half window width
            val n = x.toDouble()
            val w = halfWindow.toDouble()
            
            // Simplified formula for quadratic S-G filter
            result[i] = (3.0 * (3.0 * n * n - w * w + 1.0)) / (2.0 * w * (w * w - 1.0))
        }
        
        return result
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
        return result / normFactor
    }
} 