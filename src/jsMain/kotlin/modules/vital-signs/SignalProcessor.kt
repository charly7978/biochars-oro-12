package modules.vitalsigns

// Placeholder for vital-signs/signal-processor.ts (utility)
class SignalProcessor {
    private val ppgValuesInternal = mutableListOf<Double>()
    private val MAX_SIZE = 300 // As in original

    fun applySMAFilter(value: Double): Double {
        // TODO: Implement SMA filter logic from TS
        // This is a very basic placeholder
        ppgValuesInternal.add(value)
        if (ppgValuesInternal.size > MAX_SIZE) {
            ppgValuesInternal.removeAt(0)
        }
        if (ppgValuesInternal.size < 3) return value
        return ppgValuesInternal.takeLast(3).average()
    }

    fun getPPGValues(): List<Double> {
        return ppgValuesInternal.toList()
    }

    fun reset() {
        ppgValuesInternal.clear()
    }
} 