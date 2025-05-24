package modules.signalprocessing

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// Based on src/modules/signal-processing/SignalAnalyzer.ts
class SignalAnalyzer(private val config: Config) {
    data class Config(
        val QUALITY_LEVELS: Int,
        val QUALITY_HISTORY_SIZE: Int,
        val MIN_CONSECUTIVE_DETECTIONS: Int,
        val MAX_CONSECUTIVE_NO_DETECTIONS: Int
    )

    private var detectorScores: DetectorScores = DetectorScores(0.0,0.0,0.0,0.0,0.0) // Initialize with defaults
    private var stableFrameCount: Int = 0
    // private var lastStableValue: Double = 0.0 // Not directly used in ported logic for analyzeSignalMultiDetector
    private var consecutiveDetections: Int = 0
    private var consecutiveNoDetections: Int = 0
    private var isCurrentlyDetected: Boolean = false
    // private var lastDetectionTime: Double = 0.0 // Not directly used
    private var qualityHistory: MutableList<Int> = mutableListOf()
    // private var motionArtifactScore: Double = 0.0 // Not directly used
    // private val DETECTION_TIMEOUT = 3000 // Not directly used
    // private val MOTION_ARTIFACT_THRESHOLD = 0.75 // Not directly used
    // private var valueHistory: MutableList<Double> = mutableListOf() // Not directly used

    // Calibration logic from TS SignalAnalyzer seems to be a simplified local version,
    // the main calibration is handled by CalibrationHandler and PPGSignalProcessor.isCalibrating.
    // So, adaptiveThreshold logic from TS SignalAnalyzer is omitted for now to avoid conflict.

    fun updateDetectorScores(scores: DetectorScores) {
        // Merge new scores with existing, simple replacement for now
        this.detectorScores = scores
    }
    
    fun analyzeSignalMultiDetector(filteredSignalValue: Double, trend: TrendResult): DetectionResult {
        val weights = mapOf(
            "redChannel" to 0.2,
            "stability" to 0.3,
            "pulsatility" to 0.25,
            "biophysical" to 0.15,
            "periodicity" to 0.1
        )

        var weightedScore = 0.0
        var totalWeight = 0.0

        detectorScores.let {
            weightedScore += (it.redChannel * (weights["redChannel"] ?: 0.0))
            totalWeight += weights["redChannel"] ?: 0.0
            weightedScore += (it.stability * (weights["stability"] ?: 0.0))
            totalWeight += weights["stability"] ?: 0.0
            weightedScore += (it.pulsatility * (weights["pulsatility"] ?: 0.0))
            totalWeight += weights["pulsatility"] ?: 0.0
            weightedScore += (it.biophysical * (weights["biophysical"] ?: 0.0))
            totalWeight += weights["biophysical"] ?: 0.0
            weightedScore += (it.periodicity * (weights["periodicity"] ?: 0.0))
            totalWeight += weights["periodicity"] ?: 0.0
        }
        
        val rawQuality = if (totalWeight > 0) (weightedScore / totalWeight) * 100 else 0.0
        val currentQuality = max(0.0, min(100.0, rawQuality)).toInt()

        qualityHistory.add(currentQuality)
        if (qualityHistory.size > config.QUALITY_HISTORY_SIZE) {
            qualityHistory.removeAt(0)
        }
        val smoothedQuality = if (qualityHistory.isNotEmpty()) qualityHistory.average().toInt() else 0

        // Detection logic based on quality and consecutive frames
        // This is a simplified version of the TS logic
        val potentialDetection = smoothedQuality > 40 && trend != TrendResult.NON_PHYSIOLOGICAL

        if (potentialDetection) {
            consecutiveDetections++
            consecutiveNoDetections = 0
            if (consecutiveDetections >= config.MIN_CONSECUTIVE_DETECTIONS) {
                isCurrentlyDetected = true
            }
        } else {
            consecutiveNoDetections++
            consecutiveDetections = 0
            if (consecutiveNoDetections >= config.MAX_CONSECUTIVE_NO_DETECTIONS) {
                isCurrentlyDetected = false
            }
        }
        
        // Hysteresis for stability (not explicitly in TS version's analyzeSignalMultiDetector but good practice)
        // If it was detected, it needs to drop significantly to be un-detected.
        // If it was not detected, it needs to rise significantly to be detected.
        // This is implicitly handled by MIN_CONSECUTIVE_DETECTIONS and MAX_CONSECUTIVE_NO_DETECTIONS.

        return DetectionResult(
            isFingerDetected = isCurrentlyDetected,
            quality = smoothedQuality,
            detectorDetails = mapOf(
                "rawQuality" to currentQuality,
                "weightedScore" to weightedScore,
                "trend" to trend.name,
                "consecutiveDetections" to consecutiveDetections,
                "consecutiveNoDetections" to consecutiveNoDetections
            ) + detectorScoresToMap() // Add individual scores to details
        )
    }
    
    private fun detectorScoresToMap(): Map<String, Double> {
        return mapOf(
            "ds_redChannel" to detectorScores.redChannel,
            "ds_stability" to detectorScores.stability,
            "ds_pulsatility" to detectorScores.pulsatility,
            "ds_biophysical" to detectorScores.biophysical,
            "ds_periodicity" to detectorScores.periodicity
        ).plus(detectorScores.textureScore?.let { mapOf("ds_textureScore" to it) } ?: emptyMap())
    }

    // updateLastStableValue and getLastStableValue not directly used by PPGSignalProcessor, omitted.

    fun reset() {
        detectorScores = DetectorScores(0.0,0.0,0.0,0.0,0.0)
        stableFrameCount = 0
        // lastStableValue = 0.0
        consecutiveDetections = 0
        consecutiveNoDetections = 0
        isCurrentlyDetected = false
        // lastDetectionTime = 0.0
        qualityHistory.clear()
        // motionArtifactScore = 0.0
        // valueHistory.clear()
    }
} 