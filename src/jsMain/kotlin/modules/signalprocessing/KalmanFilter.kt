package modules.signalprocessing

// Based on src/modules/signal-processing/KalmanFilter.ts
class KalmanFilter {
    private var R: Double = 0.01 // Measurement variance (sensor noise)
    private var Q: Double = 0.1  // Process variance
    private var P: Double = 1.0    // Estimated error covariance
    private var X: Double = 0.0    // Estimated state
    private var K: Double = 0.0    // Kalman gain

    fun filter(measurement: Double): Double {
        // Prediction
        // X = X (estado no cambia si no hay control input)
        P += Q

        // Update
        K = P / (P + R)
        X += K * (measurement - X)
        P *= (1 - K)
        
        return X
    }

    fun reset() {
        P = 1.0
        X = 0.0
        K = 0.0
        // R and Q are constants, typically not reset unless reconfigured
    }
}