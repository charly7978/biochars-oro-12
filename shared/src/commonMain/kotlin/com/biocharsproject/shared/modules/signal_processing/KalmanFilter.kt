package com.biocharsproject.shared.modules.signal_processing

/**
 * Implementación del filtro de Kalman para reducción de ruido en señales PPG
 * 
 * El filtro de Kalman es óptimo para sistemas lineales con ruido gaussiano,
 * lo que lo hace ideal para eliminar ruido de las señales PPG manteniendo
 * la forma de onda original.
 */
class KalmanFilter {
    // Parámetros del filtro
    private var processNoise: Double = 0.01    // Q - Varianza del proceso
    private var measurementNoise: Double = 0.1 // R - Varianza de la medición (ruido del sensor)
    private var estimateError: Double = 1.0    // P - Covarianza del error estimado
    private var lastEstimate: Double = 0.0     // X - Estado estimado
    private var kalmanGain: Double = 0.0       // K - Ganancia de Kalman
    
    /**
     * Constructor con parámetros personalizables
     */
    constructor(
        processNoise: Double = 0.01,
        measurementNoise: Double = 0.1
    ) {
        this.processNoise = processNoise
        this.measurementNoise = measurementNoise
    }
    
    /**
     * Filtra un valor utilizando el algoritmo de Kalman
     * 
     * @param measurement El valor medido (con ruido)
     * @return El valor filtrado (estimado)
     */
    fun filter(measurement: Double): Double {
        // Predicción
        // X = X
        // P = P + Q
        estimateError += processNoise
        
        // Corrección
        // K = P / (P + R)
        kalmanGain = estimateError / (estimateError + measurementNoise)
        
        // X = X + K * (measurement - X)
        lastEstimate += kalmanGain * (measurement - lastEstimate)
        
        // P = (1 - K) * P
        estimateError = (1 - kalmanGain) * estimateError
        
        return lastEstimate
    }
    
    /**
     * Ajusta la sensibilidad del filtro
     * 
     * @param processNoise Ruido del proceso (Q) - valores mayores permiten cambios más rápidos
     * @param measurementNoise Ruido de medición (R) - valores mayores dan más peso a la estimación previa
     */
    fun setParameters(processNoise: Double, measurementNoise: Double) {
        this.processNoise = processNoise
        this.measurementNoise = measurementNoise
    }
    
    /**
     * Reinicia el filtro a sus valores iniciales
     */
    fun reset() {
        lastEstimate = 0.0
        estimateError = 1.0
        kalmanGain = 0.0
    }
    
    /**
     * Ajusta dinámicamente el ruido de medición basado en la variabilidad
     * Útil para adaptarse a diferentes condiciones de señal
     * 
     * @param variance Varianza reciente de las mediciones
     */
    fun adaptToSignalVariance(variance: Double) {
        // Ajustar el ruido de medición basado en la varianza observada
        // Limitamos los valores para evitar inestabilidad
        measurementNoise = variance.coerceIn(0.01, 1.0)
    }
} 