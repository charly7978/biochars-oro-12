package modules.signalprocessing

import kotlin.IllegalArgumentException

// Based on src/modules/signal-processing/SavitzkyGolayFilter.ts
class SavitzkyGolayFilter(windowSizeInput: Int = 9) {
    private val coefficients: List<Double>
    private val normFactor: Double
    private var buffer: MutableList<Double>
    private val windowSize: Int

    init {
        this.windowSize = windowSizeInput
        // Coefficients and normFactor from the original TypeScript version for windowSize = 9
        if (windowSize == 9) {
            coefficients = listOf(0.035, 0.105, 0.175, 0.245, 0.285, 0.245, 0.175, 0.105, 0.035)
            normFactor = 1.405
        } else if (windowSize == 7) { // From previous Kotlin version, kept as an option
            coefficients = listOf(-2.0, 3.0, 6.0, 7.0, 6.0, 3.0, -2.0)
            normFactor = coefficients.sum()
        } else if (windowSize == 5) { // From previous Kotlin version, kept as an option
            coefficients = listOf(-3.0, 12.0, 17.0, 12.0, -3.0)
            normFactor = coefficients.sum()
        } else {
             if (windowSize % 2 == 0 || windowSize < 3) {
                throw IllegalArgumentException("Window size must be an odd number >= 3 for generic SG or provide specific coefficients.")
            }
            // Fallback or throw error for other window sizes if coefficients are not defined
            // For this example, let's stick to defined ones or throw.
            throw IllegalArgumentException("Unsupported SG window size: $windowSize. Provide coefficients or use 5, 7, or 9.")
        }

        // Initialize buffer with zeros, as in the TS version
        buffer = MutableList(this.windowSize) { 0.0 }
    }

    fun filter(value: Double): Double {
        // Update buffer (circularly)
        buffer.removeAt(0) // Remove oldest
        buffer.add(value)    // Add newest

        // The buffer should always be full due to initialization with zeros
        // and maintained size. The check 'buffer.size < windowSize' might not be strictly needed
        // if we ensure it's always full after init.
        // However, the TS version implies that if buffer is not full (which shouldn't happen with prefill),
        // it would return the value. But TS pre-fills, so it's always full.

        var filteredValue = 0.0
        // Ensure buffer and coefficients are accessed correctly if sizes could mismatch
        // (though here they are tied to windowSize)
        for (i in coefficients.indices) {
            // Check if buffer has enough elements, though it should
            if (i < buffer.size) { 
                filteredValue += coefficients[i] * buffer[i]
            }
        }
        
        // The TS version divides by normFactor, which is the sum of its specific coefficients.
        // If normFactor is 1 (already normalized coefficients), this division isn't needed.
        // The original TS coefficients sum to 1.405, and it divides by 1.405.
        return if (normFactor != 0.0) filteredValue / normFactor else filteredValue
    }

    fun reset() {
        // Fill buffer with zeros, as in the TS version
        buffer = MutableList(windowSize) { 0.0 }
    }
} 