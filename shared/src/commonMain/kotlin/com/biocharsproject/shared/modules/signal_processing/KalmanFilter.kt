package com.biocharsproject.shared.modules.signal_processing

/**
 * Kalman filter implementation for PPG signal processing.
 * Used to reduce noise in the signal by applying statistical predictions.
 */
class KalmanFilter {
    private var r: Double = 0.01  // Measurement variance (sensor noise)
    private var q: Double = 0.1   // Process variance
    private var p: Double = 1.0   // Estimated error covariance
    private var x: Double = 0.0   // Estimated state
    private var k: Double = 0.0   // Kalman gain
    
    /**
     * Apply Kalman filter to a measurement value
     * @param measurement The raw measurement to filter
     * @return The filtered value
     */
    fun filter(measurement: Double): Double {
        // Prediction update
        p = p + q
        
        // Measurement update
        k = p / (p + r)
        x = x + k * (measurement - x)
        p = (1 - k) * p
        
        return x
    }
    
    /**
     * Reset the filter state
     */
    fun reset() {
        x = 0.0
        p = 1.0
        k = 0.0
    }
} 