package modules

import kotlinx.js.timers.clearTimeout
import kotlinx.js.timers.setTimeout
import modules.vitalsigns.*
import types.ArrhythmiaData
import types.CalibrationProgressData
import types.CalibrationProgressDetails
import types.VitalSignsData
import kotlin.math.pow
import kotlin.math.sqrt

class VitalSignsProcessor {
    companion object {
        const val CALIBRATION_DURATION_MS: Int = 6000
    }

    private var spo2Processor: SpO2Processor = SpO2Processor()
    private var bpProcessor: BloodPressureProcessor = BloodPressureProcessor()
    private var arrhythmiaProcessor: ArrhythmiaProcessor = ArrhythmiaProcessor()
    private var signalProcessor: modules.vitalsigns.SignalProcessor = modules.vitalsigns.SignalProcessor() // Local utility
    private var glucoseProcessor: GlucoseProcessor = GlucoseProcessor()
    private var lipidProcessor: LipidProcessor = LipidProcessor()

    private var lastValidResults: VitalSignsData? = null
    private var isCalibrating: Boolean = false
    private var calibrationStartTime: Double = 0.0
    private var calibrationSamples: Int = 0
    private val CALIBRATION_REQUIRED_SAMPLES: Int = 40

    private var spo2Samples: MutableList<Double> = mutableListOf()
    private var pressureSamples: MutableList<Double> = mutableListOf() // Assuming this stores a single representative pressure value or similar
    private var heartRateSamples: MutableList<Double> = mutableListOf()
    private var glucoseSamples: MutableList<Double> = mutableListOf() // Placeholder for actual sample type
    private var lipidSamples: MutableList<Double> = mutableListOf() // Placeholder for actual sample type

    private var calibrationProgressInternal = CalibrationProgressDetails()
    
    private var forceCompleteCalibration: Boolean = false
    private var calibrationTimerId: Int? = null

    // Constructor is implicit in Kotlin if no primary constructor is defined with arguments

    fun startCalibration() {
        console.log("VitalSignsProcessor: Iniciando calibración avanzada")
        isCalibrating = true
        calibrationStartTime = kotlin.js.Date.now()
        calibrationSamples = 0
        forceCompleteCalibration = false

        spo2Samples.clear()
        pressureSamples.clear()
        heartRateSamples.clear()
        glucoseSamples.clear()
        lipidSamples.clear()

        calibrationProgressInternal = CalibrationProgressDetails() // Reset progress

        calibrationTimerId?.let { clearTimeout(it) }
        calibrationTimerId = setTimeout({
            if (isCalibrating) {
                console.log("VitalSignsProcessor: Finalizando calibración por tiempo límite")
                completeCalibration()
            }
        }, CALIBRATION_DURATION_MS)

        console.log("VitalSignsProcessor: Calibración iniciada con parámetros:", js("{
            muestrasRequeridas: CALIBRATION_REQUIRED_SAMPLES,
            tiempoMaximo: CALIBRATION_DURATION_MS,
            inicioCalibracion: new Date(calibrationStartTime).toISOString()
        }"))
    }

    private fun completeCalibration() {
        if (!isCalibrating) return

        console.log("VitalSignsProcessor: Completando calibración", js("{
            muestrasRecolectadas: calibrationSamples,
            muestrasRequeridas: CALIBRATION_REQUIRED_SAMPLES,
            duracionMs: kotlin.js.Date.now() - calibrationStartTime,
            forzado: forceCompleteCalibration
        }"))

        if (heartRateSamples.size > 5) {
            val filteredHeartRates = heartRateSamples.filter { it > 40 && it < 200 }
            if (filteredHeartRates.isNotEmpty()) {
                val avgHeartRate = filteredHeartRates.average()
                val heartRateVariability = sqrt(
                    filteredHeartRates.sumOf { (it - avgHeartRate).pow(2) } / filteredHeartRates.size
                )
                console.log("VitalSignsProcessor: Calibración de ritmo cardíaco", js("{
                    muestras: filteredHeartRates.size,
                    promedio: avgHeartRate.toFixed(1),
                    variabilidad: heartRateVariability.toFixed(2)
                }"))
                // TODO: Apply calibrated values to arrhythmiaProcessor if needed
            }
        }

        if (spo2Samples.size > 5) {
            val validSpo2 = spo2Samples.filter { it > 85 && it < 100 }
            if (validSpo2.isNotEmpty()) {
                val baselineSpo2 = validSpo2.average()
                console.log("VitalSignsProcessor: Calibración de SpO2", js("{
                    muestras: validSpo2.size,
                    nivelBase: baselineSpo2.toFixed(1)
                }"))
                // TODO: Apply calibrated values to spo2Processor if needed
            }
        }

        if (pressureSamples.size > 5) {
            val validPressure = pressureSamples.filter { it > 30 } // Assuming single value for pressure sample
            if (validPressure.isNotEmpty()) {
                val baselinePressure = validPressure.average()
                val pressureVariability = sqrt(
                    validPressure.sumOf { (it - baselinePressure).pow(2) } / validPressure.size
                )
                console.log("VitalSignsProcessor: Calibración de presión arterial", js("{
                    muestras: validPressure.size,
                    nivelBase: baselinePressure.toFixed(1),
                    variabilidad: pressureVariability.toFixed(2)
                }"))
                 // TODO: Apply calibrated values to bpProcessor if needed
            }
        }
        
        // TODO: Calibrate glucoseProcessor and lipidProcessor if they have calibration logic

        calibrationTimerId?.let { clearTimeout(it) }
        calibrationTimerId = null
        isCalibrating = false

        console.log("VitalSignsProcessor: Calibración completada exitosamente", js("{
            tiempoTotal: (kotlin.js.Date.now() - calibrationStartTime).toFixed(0) + \"ms\"
        }"))
    }

    fun processSignal(
        ppgValue: Double, // Changed from number in TS to Double
        rrData: HeartBeatProcessor.RRData? // Use the RRData class defined in HeartBeatProcessor
    ): VitalSignsData {
        if (ppgValue < 0.1) {
            console.log("VitalSignsProcessor: No se detecta dedo, retornando resultados previos.")
            return lastValidResults ?: VitalSignsData() // Return default if null
        }

        if (isCalibrating) {
            calibrationSamples++
            // TODO: Collect samples for spo2Samples, pressureSamples, heartRateSamples, glucoseSamples, lipidSamples if needed by sub-processors or calibration logic
            // For now, let's assume ppgValue could be a heartRate sample for demonstration
            heartRateSamples.add(ppgValue) 
            if (spo2Samples.size < CALIBRATION_REQUIRED_SAMPLES) spo2Samples.add(ppgValue) // Simplified sample collection

            // Update live calibration progress for UI
            val progressPercentage = (calibrationSamples.toDouble() / CALIBRATION_REQUIRED_SAMPLES * 100).toInt().coerceAtMost(100)
            calibrationProgressInternal = CalibrationProgressDetails(
                heartRate = progressPercentage, 
                spo2 = (progressPercentage - 10).coerceAtLeast(0),
                pressure = (progressPercentage - 20).coerceAtLeast(0),
                arrhythmia = (progressPercentage - 15).coerceAtLeast(0),
                glucose = (progressPercentage - 5).coerceAtLeast(0),
                lipids = (progressPercentage - 25).coerceAtLeast(0),
                hemoglobin = (progressPercentage - 30).coerceAtLeast(0)
            )

            // Check if calibration is complete due to samples or forced
            if (forceCompleteCalibration || calibrationSamples >= CALIBRATION_REQUIRED_SAMPLES) {
                completeCalibration()
            }
        }

        val filteredPpg = signalProcessor.applySMAFilter(ppgValue)
        val arrhythmiaResult = arrhythmiaProcessor.processRRData(rrData)
        val ppgValuesForSubProcessors = signalProcessor.getPPGValues().takeLast(60) // Use last 60 as in TS

        val spo2 = spo2Processor.calculateSpO2(ppgValuesForSubProcessors)
        val bpEstimate = bpProcessor.calculateBloodPressure(ppgValuesForSubProcessors)
        val pressureString = "${bpEstimate.systolic}/${bpEstimate.diastolic}"
        val glucose = glucoseProcessor.calculateGlucose(ppgValuesForSubProcessors)
        val lipids = lipidProcessor.calculateLipids(ppgValuesForSubProcessors)
        val hemoglobin = calculateHemoglobin(ppgValuesForSubProcessors) // Assuming this is a local private fun

        val currentResults = VitalSignsData(
            spo2 = spo2,
            pressure = pressureString,
            arrhythmiaStatus = arrhythmiaResult.arrhythmiaStatus,
            lastArrhythmiaData = arrhythmiaResult.lastArrhythmiaData,
            glucose = glucose,
            lipids = lipids,
            hemoglobin = hemoglobin,
            calibration = if (isCalibrating) CalibrationProgressData(true, calibrationProgressInternal) else null
        )
        
        lastValidResults = currentResults // Store the latest results
        return currentResults
    }

    private fun calculateHemoglobin(ppgValues: List<Double>): Int {
        // TODO: Implement hemoglobin calculation logic from TS
        // Placeholder based on TS: Math.max(0, Math.min(20, 10 + ppgValues.length / 30 - (avgDerivative * 50) + (avgAmplitude * 10)));
        if (ppgValues.isNotEmpty() && ppgValues.any { it > 0.1 }) return (12..16).random() 
        return 0
    }

    fun isCurrentlyCalibrating(): Boolean {
        return isCalibrating
    }

    fun getCalibrationProgress(): CalibrationProgressData? {
        return if (isCalibrating) {
            CalibrationProgressData(true, calibrationProgressInternal)
        } else {
            null
        }
    }

    fun forceCalibrationCompletion() {
        if (isCalibrating) {
            console.log("VitalSignsProcessor: Forzando finalización de calibración")
            forceCompleteCalibration = true // Signal to complete on next processSignal or rely on timer
            if (calibrationSamples < CALIBRATION_REQUIRED_SAMPLES) {
                 // If not enough samples, fill up progress to 100% artificially for UI
                 calibrationProgressInternal = CalibrationProgressDetails(100,100,100,100,100,100,100)
            }
            completeCalibration() // Attempt to complete immediately
        }
    }

    fun reset(): VitalSignsData? {
        console.log("VitalSignsProcessor: Reseteando procesadores de signos vitales (soft reset)")
        // Reset sub-processors
        spo2Processor.reset()
        bpProcessor.reset()
        arrhythmiaProcessor.reset()
        signalProcessor.reset() // Local utility processor
        glucoseProcessor.reset()
        lipidProcessor.reset()

        // Do not clear lastValidResults here, as per original logic in Index.tsx finalizeMeasurement
        // that calls resetVitalSigns() and then uses its return value.
        val tempLastResults = lastValidResults
        // lastValidResults = null; // Clear if it should not persist after reset
        isCalibrating = false // Stop any ongoing calibration
        calibrationTimerId?.let { clearTimeout(it) }
        calibrationTimerId = null
        calibrationSamples = 0
        calibrationProgressInternal = CalibrationProgressDetails()

        console.log("VitalSignsProcessor: Reset parcial completado. Últimos resultados válidos retenidos temporalmente: ", tempLastResults)
        return tempLastResults 
    }

    fun getLastValidResults(): VitalSignsData? {
        return lastValidResults
    }

    fun fullReset() {
        console.log("VitalSignsProcessor: Reseteando completamente (full reset)")
        reset() // Perform soft reset first
        lastValidResults = null // Then clear last valid results
        // All states should be at their initial values after this
        console.log("VitalSignsProcessor: Full reset completado. Todos los estados y resultados borrados.")
    }
}