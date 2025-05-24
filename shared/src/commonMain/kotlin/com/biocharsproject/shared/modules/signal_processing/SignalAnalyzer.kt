package com.biocharsproject.shared.modules.signal_processing

import kotlin.math.abs
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

// SignalAnalyzerConfig fields are part of SignalProcessorConfig in Types.kt
// DetectorScores and DetectionResult are defined in Types.kt in this package

class SignalAnalyzer(private val config: SignalProcessorConfig) { // Using SignalProcessorConfig

    private var detectorScores: DetectorScores = DetectorScores(
        redChannel = 0.0,
        stability = 0.0,
        pulsatility = 0.0,
        biophysical = 0.0,
        periodicity = 0.0,
        textureScore = 0.0
    )
    private var stableFrameCount: Int = 0
    private var lastStableValue: Double = 0.0
    private var consecutiveDetections: Int = 0
    private var consecutiveNoDetections: Int = 0
    private var isCurrentlyDetected: Boolean = false
    private var lastDetectionTime: Long = 0L
    private var qualityHistory: MutableList<Double> = mutableListOf()
    private var motionArtifactScore: Double = 0.0
    private val DETECTION_TIMEOUT = 3000L // ms
    // private val MOTION_ARTIFACT_THRESHOLD = 0.75 // Not directly used
    private var valueHistory: MutableList<Double> = mutableListOf()

    private var calibrationPhase: Boolean = true
    private var calibrationSamples: MutableList<Double> = mutableListOf()
    private val CALIBRATION_SAMPLE_SIZE = 20 
    private var adaptiveThreshold: Double = 0.1

    fun updateDetectorScores(scores: DetectorScores) {
        this.detectorScores.redChannel = scores.redChannel
        this.detectorScores.stability = scores.stability
        this.detectorScores.pulsatility = scores.pulsatility
        this.detectorScores.biophysical = scores.biophysical
        this.detectorScores.periodicity = scores.periodicity
        this.detectorScores.textureScore = scores.textureScore ?: 0.0

        if (valueHistory.isNotEmpty()) {
            val meanValue = valueHistory.average()
            val variance = valueHistory.map { (it - meanValue).pow(2) }.average()
            motionArtifactScore = (variance / (meanValue.takeIf { it != 0.0 } ?: 1.0)).coerceIn(0.0, 1.0)
        }
    }

    private fun calibrateAdaptiveThreshold() {
        if (calibrationSamples.size < CALIBRATION_SAMPLE_SIZE) return

        val mean = calibrationSamples.average()
        val stdDev = sqrt(calibrationSamples.map { (it - mean).pow(2) }.average())
        
        adaptiveThreshold = (stdDev / mean.takeIf { it != 0.0 } ?: 1.0) * 0.5
        adaptiveThreshold = adaptiveThreshold.coerceIn(0.05, 0.5)
        
        calibrationPhase = false
        println("Adaptive threshold calibrated to: $adaptiveThreshold")
    }

    fun analyzeSignalMultiDetector(
        filteredValue: Double
    ): DetectionResult {
        if (calibrationPhase) {
            calibrationSamples.add(abs(filteredValue - (valueHistory.lastOrNull() ?: filteredValue)))
            if (calibrationSamples.size >= CALIBRATION_SAMPLE_SIZE) {
                calibrateAdaptiveThreshold()
            }
            return DetectionResult(false, 0.0, mapOf("status" to "calibrating adaptive threshold"))
        }

        valueHistory.add(filteredValue)
        if (valueHistory.size > config.QUALITY_HISTORY_SIZE) { 
            valueHistory.removeAt(0)
        }

        var qualityScore = 0.0
        val detectorDetails = mutableMapOf<String, Any>()

        val redChannelScore = (this.detectorScores.redChannel / 255.0).coerceIn(0.0, 1.0)
        detectorDetails["redChannelRaw"] = this.detectorScores.redChannel
        detectorDetails["redChannelScore"] = redChannelScore
        qualityScore += redChannelScore * 0.2

        val stabilityScore = this.detectorScores.stability.coerceIn(0.0, 1.0)
        detectorDetails["stabilityScore"] = stabilityScore
        qualityScore += stabilityScore * 0.3

        val pulsatilityScore = this.detectorScores.pulsatility.coerceIn(0.0, 1.0)
        detectorDetails["pulsatilityScore"] = pulsatilityScore
        qualityScore += pulsatilityScore * 0.2

        val biophysicalScore = this.detectorScores.biophysical.coerceIn(0.0, 1.0)
        detectorDetails["biophysicalScore"] = biophysicalScore
        qualityScore += biophysicalScore * 0.15
        
        val periodicityScore = this.detectorScores.periodicity.coerceIn(0.0, 1.0)
        detectorDetails["periodicityScore"] = periodicityScore
        qualityScore += periodicityScore * 0.15
        
        val motionResistanceScore = (1.0 - motionArtifactScore).coerceIn(0.0, 1.0)
        detectorDetails["motionArtifactScore"] = motionArtifactScore
        detectorDetails["motionResistanceScore"] = motionResistanceScore

        val isSignalGoodEnough = qualityScore > (adaptiveThreshold + 0.1)

        if (isSignalGoodEnough && biophysicalScore > 0.5 && redChannelScore > 0.3) {
            consecutiveDetections++
            consecutiveNoDetections = 0
            if (consecutiveDetections >= config.MIN_CONSECUTIVE_DETECTIONS || isCurrentlyDetected) {
                isCurrentlyDetected = true
                lastDetectionTime = System.currentTimeMillis()
                lastStableValue = filteredValue
                stableFrameCount++
            }
        } else {
            consecutiveNoDetections++
            if (consecutiveNoDetections >= config.MAX_CONSECUTIVE_NO_DETECTIONS || 
                (isCurrentlyDetected && (System.currentTimeMillis() - lastDetectionTime > DETECTION_TIMEOUT))) {
                isCurrentlyDetected = false
                stableFrameCount = 0
            }
        }

        qualityHistory.add(qualityScore)
        if (qualityHistory.size > config.QUALITY_HISTORY_SIZE) {
            qualityHistory.removeAt(0)
        }
        val smoothedQuality = if (qualityHistory.isNotEmpty()) qualityHistory.average() else 0.0

        detectorDetails["overallQualityPreSmoothing"] = qualityScore
        detectorDetails["adaptiveThreshold"] = adaptiveThreshold
        detectorDetails["consecutiveDetections"] = consecutiveDetections
        detectorDetails["consecutiveNoDetections"] = consecutiveNoDetections

        return DetectionResult(
            isFingerDetected = isCurrentlyDetected,
            quality = (smoothedQuality * config.QUALITY_LEVELS).toInt() / config.QUALITY_LEVELS.toDouble(),
            detectorDetails = detectorDetails
        )
    }

    fun updateLastStableValue(value: Double) {
        lastStableValue = value
    }

    fun getLastStableValue(): Double {
        return lastStableValue
    }

    fun reset() {
        detectorScores = DetectorScores(0.0,0.0,0.0,0.0,0.0,0.0)
        stableFrameCount = 0
        lastStableValue = 0.0
        consecutiveDetections = 0
        consecutiveNoDetections = 0
        isCurrentlyDetected = false
        lastDetectionTime = 0L
        qualityHistory.clear()
        motionArtifactScore = 0.0
        valueHistory.clear()
        
        calibrationPhase = true
        calibrationSamples.clear()
        adaptiveThreshold = 0.1
        println("SignalAnalyzer reset.")
    }
} 