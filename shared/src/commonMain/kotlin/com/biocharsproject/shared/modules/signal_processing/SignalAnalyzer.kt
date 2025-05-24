package com.biocharsproject.shared.modules.signal_processing

import com.biocharsproject.shared.modules.SignalProcessorConfig
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

// SignalAnalyzerConfig fields are part of SignalProcessorConfig in Types.kt
// DetectorScores and DetectionResult are defined in Types.kt in this package

/**
 * SignalAnalyzer processes PPG signal data to detect finger presence
 * and evaluate signal quality through multiple detection methods.
 */
class SignalAnalyzer(private val config: SignalProcessorConfig) {
    // Detector scores for each aspect of the signal
    private var detectorScores = DetectorScores(
        redChannel = 0.0,
        stability = 0.0,
        pulsatility = 0.0,
        biophysical = 0.0,
        periodicity = 0.0
    )
    
    // Signal state tracking
    private var stableFrameCount = 0
    private var lastStableValue = 0.0
    private var consecutiveDetections = 0
    private var consecutiveNoDetections = 0
    private var isCurrentlyDetected = false
    private var lastDetectionTime = 0.0
    
    // Quality tracking
    private val qualityHistory = mutableListOf<Double>()
    private var motionArtifactScore = 0.0
    
    // Constants
    private val DETECTION_TIMEOUT = 3000.0 // ms
    private val MOTION_ARTIFACT_THRESHOLD = 0.75
    
    // Signal history for artifact detection
    private val valueHistory = mutableListOf<Double>()
    
    // Adaptive threshold components
    private var calibrationPhase = true
    private val calibrationSamples = mutableListOf<Double>()
    private val CALIBRATION_SAMPLE_SIZE = 20
    private var adaptiveThreshold = 0.1
    
    /**
     * Update detector scores based on signal features
     */
    fun updateDetectorScores(scores: Map<String, Double>) {
        // Update all detector scores
        scores["redChannel"]?.let { detectorScores.redChannel = it }
        scores["stability"]?.let { detectorScores.stability = it }
        scores["pulsatility"]?.let { detectorScores.pulsatility = it }
        scores["biophysical"]?.let { detectorScores.biophysical = it }
        scores["periodicity"]?.let { detectorScores.periodicity = it }
        
        // Apply calibration if needed
        if (calibrationPhase) {
            calibrateAdaptiveThreshold()
        }
    }
    
    /**
     * Calibrate the adaptive threshold based on initial samples
     */
    private fun calibrateAdaptiveThreshold() {
        // Collect calibration samples
        detectorScores.redChannel.let { 
            if (calibrationSamples.size < CALIBRATION_SAMPLE_SIZE) {
                calibrationSamples.add(it)
            } else {
                // Calculate adaptive threshold from samples
                val validSamples = calibrationSamples.filter { it > 0.05 }
                
                if (validSamples.size > CALIBRATION_SAMPLE_SIZE / 2) {
                    val avg = validSamples.average()
                    val max = validSamples.maxOrNull() ?: avg
                    val min = validSamples.minOrNull() ?: avg
                    
                    // Set threshold based on variation
                    val range = max - min
                    adaptiveThreshold = if (range > 0) {
                        min(max(0.05, range * 0.2), 0.3)
                    } else {
                        0.1 // Default if no variation
                    }
                }
                
                // End calibration phase
                calibrationPhase = false
            }
        }
    }
    
    /**
     * Analyze the signal using multiple detectors to determine finger presence and quality
     */
    fun analyzeSignalMultiDetector(
        filtered: Double,
        trendResult: TrendResult
    ): DetectionResult {
        // Add value to history
        valueHistory.add(filtered)
        if (valueHistory.size > 30) {
            valueHistory.removeAt(0)
        }
        
        // Calculate composite detection score
        val detectionScore = calculateDetectionScore()
        
        // Check if signal passes threshold for detection
        val isDetected = detectionScore > adaptiveThreshold
        
        // Apply hysteresis to avoid rapid switching
        val finalDetection = applyHysteresis(isDetected)
        
        // Calculate quality score
        val qualityScore = calculateQualityScore(finalDetection)
        
        // Update quality history
        qualityHistory.add(qualityScore)
        if (qualityHistory.size > config.QUALITY_HISTORY_SIZE) {
            qualityHistory.removeAt(0)
        }
        
        // Calculate average quality
        val avgQuality = qualityHistory.average()
        
        // Convert to discrete quality level
        val discreteQuality = (avgQuality * config.QUALITY_LEVELS).toInt().toDouble() / config.QUALITY_LEVELS
        
        // Create detection result with details
        return DetectionResult(
            isFingerDetected = finalDetection,
            quality = discreteQuality,
            detectorDetails = mapOf(
                "redChannel" to detectorScores.redChannel,
                "stability" to detectorScores.stability,
                "pulsatility" to detectorScores.pulsatility,
                "biophysical" to detectorScores.biophysical,
                "periodicity" to detectorScores.periodicity,
                "motionArtifact" to motionArtifactScore,
                "detectionScore" to detectionScore,
                "threshold" to adaptiveThreshold,
                "trend" to trendResult.toString()
            )
        )
    }
    
    /**
     * Calculate combined detection score from all detectors
     */
    private fun calculateDetectionScore(): Double {
        // Weight the different detector scores
        val redChannelWeight = 0.3
        val stabilityWeight = 0.2
        val pulsatilityWeight = 0.2
        val biophysicalWeight = 0.2
        val periodicityWeight = 0.1
        
        // Motion artifact reduces the score
        motionArtifactScore = calculateMotionArtifactScore()
        val artifactFactor = max(0.0, 1.0 - motionArtifactScore)
        
        // Calculate weighted score
        return (
            detectorScores.redChannel * redChannelWeight +
            detectorScores.stability * stabilityWeight +
            detectorScores.pulsatility * pulsatilityWeight +
            detectorScores.biophysical * biophysicalWeight +
            detectorScores.periodicity * periodicityWeight
        ) * artifactFactor
    }
    
    /**
     * Calculate motion artifact score based on signal history
     */
    private fun calculateMotionArtifactScore(): Double {
        if (valueHistory.size < 10) return 0.0
        
        // Calculate first derivative (rate of change)
        val derivatives = mutableListOf<Double>()
        for (i in 1 until valueHistory.size) {
            derivatives.add(valueHistory[i] - valueHistory[i-1])
        }
        
        // Calculate absolute mean rate of change
        val meanAbsDerivative = derivatives.map { kotlin.math.abs(it) }.average()
        
        // High derivative indicates motion artifact
        return min(1.0, meanAbsDerivative * 10.0)
    }
    
    /**
     * Apply hysteresis to avoid rapid switching between detected/not-detected states
     */
    private fun applyHysteresis(isDetected: Boolean): Boolean {
        val currentTime = getCurrentTime()
        
        // Update detection state
        if (isDetected) {
            consecutiveDetections++
            consecutiveNoDetections = 0
            lastDetectionTime = currentTime
        } else {
            consecutiveNoDetections++
            consecutiveDetections = 0
        }
        
        // Apply hysteresis logic
        val result = when {
            // Strong detection
            consecutiveDetections >= config.MIN_CONSECUTIVE_DETECTIONS -> {
                isCurrentlyDetected = true
                true
            }
            // Strong non-detection
            consecutiveNoDetections >= config.MAX_CONSECUTIVE_NO_DETECTIONS -> {
                isCurrentlyDetected = false
                false
            }
            // Detection timeout
            currentTime - lastDetectionTime > DETECTION_TIMEOUT -> {
                isCurrentlyDetected = false
                false
            }
            // Maintain previous state (hysteresis)
            else -> isCurrentlyDetected
        }
        
        return result
    }
    
    /**
     * Calculate quality score based on all signal factors
     */
    private fun calculateQualityScore(isDetected: Boolean): Double {
        if (!isDetected) return 0.0
        
        // Quality factors with weights
        val stabilityFactor = detectorScores.stability * 0.3
        val pulsatilityFactor = min(1.0, detectorScores.pulsatility) * 0.3
        val biophysicalFactor = detectorScores.biophysical * 0.2
        val periodicityFactor = detectorScores.periodicity * 0.2
        
        // Motion artifact reduces quality
        val artifactReduction = min(1.0, motionArtifactScore * 2.0)
        
        // Calculate final quality
        val rawQuality = stabilityFactor + pulsatilityFactor + biophysicalFactor + periodicityFactor
        return max(0.0, min(1.0, rawQuality * (1.0 - artifactReduction)))
    }
    
    /**
     * Update the last stable value for reference
     */
    fun updateLastStableValue(value: Double) {
        if (detectorScores.stability > 0.7) {
            stableFrameCount++
            if (stableFrameCount > config.MIN_STABILITY_COUNT) {
                lastStableValue = value
            }
        } else {
            stableFrameCount = 0
        }
    }
    
    /**
     * Get the last stable value
     */
    fun getLastStableValue(): Double {
        return lastStableValue
    }
    
    /**
     * Reset the analyzer state
     */
    fun reset() {
        stableFrameCount = 0
        lastStableValue = 0.0
        consecutiveDetections = 0
        consecutiveNoDetections = 0
        isCurrentlyDetected = false
        lastDetectionTime = 0.0
        
        detectorScores = DetectorScores(
            redChannel = 0.0,
            stability = 0.0,
            pulsatility = 0.0,
            biophysical = 0.0,
            periodicity = 0.0
        )
        
        qualityHistory.clear()
        valueHistory.clear()
        motionArtifactScore = 0.0
        
        // Reset calibration
        calibrationPhase = true
        calibrationSamples.clear()
        adaptiveThreshold = 0.1
    }
    
    /**
     * Get current time in milliseconds
     */
    private fun getCurrentTime(): Double {
        return kotlin.js.Date.now()
    }
}

/**
 * Scores from different detection methods
 */
data class DetectorScores(
    var redChannel: Double,
    var stability: Double,
    var pulsatility: Double,
    var biophysical: Double,
    var periodicity: Double
)

/**
 * Result of finger detection analysis
 */
data class DetectionResult(
    val isFingerDetected: Boolean,
    val quality: Double,
    val detectorDetails: Map<String, Any>
) 