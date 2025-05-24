package modules.signalprocessing

// Based on src/modules/signal-processing/SavitzkyGolayFilter.ts
class SavitzkyGolayFilter(windowSize: Int = 9) {
    private val coefficients: List<Double>
    private val normFactor: Double
    private var buffer: MutableList<Double> = mutableListOf()
    private val windowSize: Int

    init {
        if (windowSize % 2 == 0 || windowSize < 3) {
            throw IllegalArgumentException("Window size must be an odd number >= 3")
        }
        this.windowSize = windowSize
        // Placeholder coefficients for a common SG filter (e.g., size 9, quadratic/cubic)
        // Real applications might need to generate these based on windowSize and polynomial order
        // These are for smoothing, not for derivatives.
        // Example for windowSize = 5: [-3, 12, 17, 12, -3] / 35
        // Example for windowSize = 9 (more smoothing, taken from a reference):
        coefficients = when (windowSize) {
            5 -> listOf(-3.0, 12.0, 17.0, 12.0, -3.0)
            7 -> listOf(-2.0, 3.0, 6.0, 7.0, 6.0, 3.0, -2.0)
            9 -> listOf(-21.0, 14.0, 39.0, 54.0, 59.0, 54.0, 39.0, 14.0, -21.0) // Sum = 231
            // Add more cases or a generator if needed
            else -> throw IllegalArgumentException("Unsupported SG window size: $windowSize. Provide coefficients manually or add case.")
        }
        normFactor = coefficients.sum()
    }

    fun filter(value: Double): Double {
        buffer.add(value)
        if (buffer.size > windowSize) {
            buffer.removeAt(0)
        }

        if (buffer.size < windowSize) {
            return value // Not enough data to filter, return raw value or an average of buffer
        }

        var filteredValue = 0.0
        for (i in coefficients.indices) {
            filteredValue += coefficients[i] * buffer[i]
        }
        return filteredValue / normFactor
    }

    fun reset() {
        buffer.clear()
    }
} 