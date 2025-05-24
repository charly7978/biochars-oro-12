package com.biocharsproject.shared.modules

import kotlin.math.pow
import kotlin.math.sqrt

// RRData can be sourced from HeartBeatProcessor
data class RRData(
    val intervals: List<Long>, // ms
    val lastPeakTime: Long? // ms
)

data class VitalSignsOutput(
    val heartRate: Double, // BPM
    val spo2: Double, // % 
    val respirationRate: Double?, // Respiraciones por minuto
    val perfusionIndex: Double?, // %
    val stressLevel: Double?, // Indicador
    val arrhythmiaStatus: Boolean, // true si se detecta arritmia
    val spo2Confidence: Double?, 
    val rrIntervals: List<Long>?
)

class VitalSignsProcessor (
    // Optional HeartBeatProcessor to get RR intervals and BPM directly
    // If not provided, heartRate and arrhythmiaStatus will depend on rrDataInput to processSignal
    private val heartBeatProcessor: HeartBeatProcessor? = null 
) {

    private val WINDOW_SIZE = 300 
    private val SPO2_CALIBRATION_FACTOR = 1.02
    private val PERFUSION_INDEX_THRESHOLD = 0.05 
    private val SPO2_WINDOW = 10 
    private val SMA_WINDOW = 3 
    private val RR_WINDOW_SIZE = 5 
    private val RMSSD_THRESHOLD = 25 // ms

    private var ppgValues: MutableList<Double> = mutableListOf()
    
    private var spo2Estimates: MutableList<Double> = mutableListOf()
    private var perfusionIndexEstimates: MutableList<Double> = mutableListOf()
    
    private var acRed: Double = 0.0
    private var dcRed: Double = 0.0
    private var acIr: Double = 0.0 
    private var dcIr: Double = 0.0

    init {
        reset()
    }

    // ppgRedValue: Assumed to be from a red light sensor for SpO2 placeholder
    // ppgIrValue: Assumed to be from an infrared light sensor for SpO2 placeholder
    // If these are not available, SpO2 calculation will be even more of a placeholder.
    fun processSignal(
        ppgRedValue: Double, 
        ppgIrValue: Double, // Added for a slightly more plausible SpO2 placeholder
        rrDataInput: RRData? = null 
    ): VitalSignsOutput {
        ppgValues.add(ppgRedValue) // Store red value for other potential uses (e.g. respiration placeholder)
        if (ppgValues.size > WINDOW_SIZE) {
            ppgValues.removeAt(0)
        }

        // --- Estimación de SpO2 y Perfusión Index (PLACEHOLDER) ---
        // This requires AC/DC components of both Red and IR signals.
        // Simulating AC/DC from the single current values for Red and IR.
        // In a real system, AC/DC are derived from a window of raw signal samples for each wavelength.
        
        // Simplified AC/DC estimation (very rough)
        dcRed = (dcRed * (SPO2_WINDOW -1) + ppgRedValue) / SPO2_WINDOW // Moving average for DC
        acRed = kotlin.math.abs(ppgRedValue - dcRed) // Simplified AC as deviation from DC

        dcIr = (dcIr * (SPO2_WINDOW -1) + ppgIrValue) / SPO2_WINDOW
        acIr = kotlin.math.abs(ppgIrValue - dcIr)
        
        var currentSpo2 = 0.0
        var currentPi = 0.0
        var spo2Confidence = 0.0

        if (dcRed > 0.01 && dcIr > 0.01 && acRed > 0.001 && acIr > 0.001) { // Basic check for valid signals
            val ratio = (acRed / dcRed) / (acIr / dcIr)
            if (ratio.isFinite() && ratio > 0) {
                currentSpo2 = (104.0 - 17.0 * ratio) * SPO2_CALIBRATION_FACTOR // Generic formula
                currentSpo2 = currentSpo2.coerceIn(70.0, 100.0)

                currentPi = (acIr / dcIr) * 100.0 
                currentPi = currentPi.coerceIn(0.0, 20.0)

                spo2Estimates.add(currentSpo2)
                if (spo2Estimates.size > SPO2_WINDOW) spo2Estimates.removeAt(0)

                perfusionIndexEstimates.add(currentPi)
                if (perfusionIndexEstimates.size > SPO2_WINDOW) perfusionIndexEstimates.removeAt(0)
                
                spo2Confidence = if (currentPi > PERFUSION_INDEX_THRESHOLD) {
                    val spo2Variance = if(spo2Estimates.size > 1) spo2Estimates.map { val mean = spo2Estimates.average(); (it - mean).pow(2) }.average() else 0.0
                    (1.0 - sqrt(spo2Variance) / 2.0).coerceIn(0.5, 1.0) 
                } else { 0.1 }
            } else {
                 currentSpo2 = 0.0; currentPi = 0.0; spo2Confidence = 0.0;
            }
        } else {
            // Signal quality too low for SpO2 estimation
            currentSpo2 = 0.0; currentPi = 0.0; spo2Confidence = 0.0;
        }

        val finalSpo2 = if (spo2Estimates.isNotEmpty()) sma(spo2Estimates, SMA_WINDOW.coerceAtMost(spo2Estimates.size)).lastOrNull() ?: 0.0 else 0.0
        val finalPi = if (perfusionIndexEstimates.isNotEmpty()) perfusionIndexEstimates.average() else 0.0

        var calculatedBpm = 0.0
        var arrhythmiaDetected = false
        var currentRrIntervals: List<Long>? = rrDataInput?.intervals
        var stress = 0.0

        // Try to get BPM from HeartBeatProcessor if available and no rrDataInput is given
        // This part is a bit conceptual as HeartBeatProcessor.processSample is the typical input point
        // Here we assume heartBeatProcessor is already processing and we can query its state if needed.
        // However, direct BPM query isn't in HeartBeatProcessor's expect class.
        // So, we rely on rrDataInput primarily.

        if (currentRrIntervals != null && currentRrIntervals.isNotEmpty()) {
            val avgInterval = currentRrIntervals.map { it.toDouble() }.average()
            if (avgInterval > 0) {
                calculatedBpm = 60000.0 / avgInterval
            }
            
            if (currentRrIntervals.size >= RR_WINDOW_SIZE) {
                val diffsSq = mutableListOf<Double>()
                for (i in 0 until currentRrIntervals.size - 1) {
                    diffsSq.add((currentRrIntervals[i+1] - currentRrIntervals[i]).toDouble().pow(2))
                }
                if (diffsSq.isNotEmpty()) {
                    val rmssd = sqrt(diffsSq.average())
                    arrhythmiaDetected = rmssd > RMSSD_THRESHOLD
                    stress = (RMSSD_THRESHOLD / rmssd.takeIf{it > 0} ?: RMSSD_THRESHOLD.toDouble()).coerceIn(0.0,1.0)
                }
            }
        }

        var respirationRate: Double? = null // Placeholder

        return VitalSignsOutput(
            heartRate = calculatedBpm.coerceIn(0.0, 250.0),
            spo2 = finalSpo2.coerceIn(0.0,100.0),
            respirationRate = respirationRate, 
            perfusionIndex = finalPi.takeIf { it >= PERFUSION_INDEX_THRESHOLD }, 
            stressLevel = stress.takeIf { calculatedBpm > 0 }, 
            arrhythmiaStatus = arrhythmiaDetected,
            spo2Confidence = spo2Confidence.takeIf { finalSpo2 > 0 },
            rrIntervals = currentRrIntervals
        )
    }

    private fun sma(data: List<Double>, windowSize: Int): List<Double> {
        if (windowSize <= 0 || data.isEmpty()) return emptyList()
        return data.windowed(size = windowSize.coerceAtMost(data.size), step = 1, partialWindows = true) { it.average() }
    }
    
    fun reset() {
        ppgValues.clear()
        spo2Estimates.clear()
        perfusionIndexEstimates.clear()
        acRed = 0.0; dcRed = 0.0; acIr = 0.0; dcIr = 0.0;
        println("VitalSignsProcessor reset.")
    }
} 