package modules.signal_processing

import kotlin.math.sqrt

// Asumiendo que CalibrationValues ya está definido en el mismo paquete o importado
// import modules.signal_processing.CalibrationValues // (ya debería estar en Types.kt)

data class CalibrationHandlerConfig(
    val CALIBRATION_SAMPLES: Int,
    val MIN_RED_THRESHOLD: Double, // Podría ser Int si el original lo usa así
    val MAX_RED_THRESHOLD: Double  // Podría ser Int si el original lo usa así
)

class CalibrationHandler(private val config: CalibrationHandlerConfig) {
    private var calibrationSamples: MutableList<Double> = mutableListOf()
    private var calibrationValues: CalibrationValues = CalibrationValues(
        baselineRed = 0.0,
        baselineVariance = 0.0,
        minRedThreshold = config.MIN_RED_THRESHOLD,
        maxRedThreshold = config.MAX_RED_THRESHOLD,
        isCalibrated = false
    )

    /**
     * Procesa un valor de rojo para la calibración.
     * Devuelve true si la calibración se completó con esta muestra, false en caso contrario.
     */
    fun handleCalibration(redValue: Double): Boolean {
        if (calibrationValues.isCalibrated) {
            // Ya está calibrado, pero podríamos querer recalibrar si la señal cambia drásticamente.
            // Por ahora, simplemente no hacemos nada si ya está calibrado.
            return true 
        }

        calibrationSamples.add(redValue)

        if (calibrationSamples.size >= config.CALIBRATION_SAMPLES) {
            val mean = calibrationSamples.average()
            val variance = calibrationSamples.map { (it - mean) * (it - mean) }.average()
            val stdDev = sqrt(variance)

            // Ajustar umbrales basados en la desviación estándar y la media de las muestras
            // Esta lógica es una interpretación común; podría necesitar ajustarse a la original.
            val newMinRedThreshold = mean - 2 * stdDev 
            val newMaxRedThreshold = mean + 2 * stdDev

            calibrationValues = calibrationValues.copy(
                baselineRed = mean,
                baselineVariance = variance,
                // Asegurarse de que los nuevos umbrales no sean más restrictivos que los globales definidos en config
                // O, alternativamente, los umbrales de config son solo iniciales/fallback
                // La lógica original debe ser consultada para esto.
                // Aquí, asumimos que los nuevos umbrales calculados son los que se usarán.
                minRedThreshold = newMinRedThreshold.coerceIn(config.MIN_RED_THRESHOLD, config.MAX_RED_THRESHOLD), // Coerción para ejemplo
                maxRedThreshold = newMaxRedThreshold.coerceIn(config.MIN_RED_THRESHOLD, config.MAX_RED_THRESHOLD), // Coerción para ejemplo
                isCalibrated = true
            )
            calibrationSamples.clear() // Limpiar muestras después de la calibración
            return true
        }
        return false
    }

    fun getCalibrationValues(): CalibrationValues {
        return calibrationValues
    }

    fun resetCalibration() {
        calibrationSamples.clear()
        calibrationValues = CalibrationValues(
            baselineRed = 0.0,
            baselineVariance = 0.0,
            minRedThreshold = config.MIN_RED_THRESHOLD,
            maxRedThreshold = config.MAX_RED_THRESHOLD,
            isCalibrated = false
        )
    }

    fun isCalibrationComplete(): Boolean {
        return calibrationValues.isCalibrated
    }
} 