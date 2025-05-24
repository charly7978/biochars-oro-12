package modules.signal_processing

class KalmanFilter {
    // Varianza de la medición (ruido del sensor)
    private var R: Double = 0.01 
    // Varianza del proceso
    private var Q: Double = 0.1  
    // Covarianza del error estimado
    private var P: Double = 1.0    
    // Estado estimado
    private var X: Double = 0.0    
    // Ganancia de Kalman (no es necesario inicializarla aquí si se calcula primero en filter)
    // private var K: Double = 0.0 

    fun filter(measurement: Double): Double {
        // Predicción
        // X = X  (estado no cambia en esta simple predicción)
        P += Q

        // Actualización
        val K = P / (P + R) // Ganancia de Kalman
        X += K * (measurement - X)
        P *= (1 - K)

        return X
    }

    fun reset() {
        // Restablecer a los valores iniciales o predeterminados
        R = 0.01
        Q = 0.1
        P = 1.0
        X = 0.0
        // K se recalcula en cada paso de filter, así que no necesita resetearse explícitamente aquí.
    }
} 