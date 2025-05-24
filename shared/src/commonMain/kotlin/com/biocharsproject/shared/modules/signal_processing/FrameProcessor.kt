package com.biocharsproject.shared.modules.signal_processing

import com.biocharsproject.shared.types.ROIData // Moved from types.Signal.kt
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

// Renamed from ImageDataWrapper to CommonImageDataWrapper for consistency
@kotlinx.serialization.Serializable
data class CommonImageDataWrapper(
    val pixelData: ByteArray, // Changed from data to pixelData for clarity
    val width: Int,
    val height: Int,
    val format: String = "RGBA" // Added format, consistent with PPGSignalProcessor placeholder
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false
        other as CommonImageDataWrapper
        if (!pixelData.contentEquals(other.pixelData)) return false
        if (width != other.width) return false
        if (height != other.height) return false
        if (format != other.format) return false
        return true
    }

    override fun hashCode(): Int {
        var result = pixelData.contentHashCode()
        result = 31 * result + width
        result = 31 * result + height
        result = 31 * result + format.hashCode()
        return result
    }
}

// FrameProcessorConfig is already defined in com.biocharsproject.shared.modules.signal_processing.Types.kt
// No need to redefine it here if it's the same structure.
// If it's different, it should be named distinctively or reconciled.
// For now, assuming it can be imported or is implicitly available from Types.kt in the same package.
// Or, if it was intended to be specific to FrameProcessor, it can stay.
// The SignalProcessorConfig in Types.kt has TEXTURE_GRID_SIZE and ROI_SIZE_FACTOR.
// Let's assume we use that one and remove this local definition to avoid conflict.
// data class FrameProcessorConfig(
//    val TEXTURE_GRID_SIZE: Int,
//    val ROI_SIZE_FACTOR: Double
// )

data class RGBFrame(
    val red: Double,
    val green: Double,
    val blue: Double
)

class FrameProcessor(private val config: SignalProcessorConfig) { // Using SignalProcessorConfig from Types.kt

    private val RED_GAIN = 1.4
    private val GREEN_SUPPRESSION = 0.8
    private val SIGNAL_GAIN = 1.3
    private val EDGE_ENHANCEMENT = 0.15

    private var lastFrames: MutableList<RGBFrame> = mutableListOf()
    private val HISTORY_SIZE = 15
    private var lastLightLevel: Double = -1.0

    private var roiHistory: MutableList<ROIData> = mutableListOf()
    private val ROI_HISTORY_SIZE = 5

    private fun averageROI(rois: List<ROIData>): ROIData? {
        if (rois.isEmpty()) return null
        val avgX = rois.map { it.x }.average()
        val avgY = rois.map { it.y }.average()
        val avgWidth = rois.map { it.width }.average()
        val avgHeight = rois.map { it.height }.average()
        return ROIData(avgX.roundToInt(), avgY.roundToInt(), avgWidth.roundToInt(), avgHeight.roundToInt())
    }

    fun extractFrameData(imageData: CommonImageDataWrapper): FrameData {
        val width = imageData.width
        val height = imageData.height
        val data = imageData.pixelData // use renamed field

        var totalRed = 0L
        var totalGreen = 0L
        var totalBlue = 0L
        var rSum = 0.0
        var gSum = 0.0
        var bSum = 0.0
        val numPixels = width * height

        var roiToUse = averageROI(roiHistory) ?: ROIData(width / 4, height / 4, width / 2, height / 2)

        var pixelsInRoi = 0
        for (y in roiToUse.y until min(roiToUse.y + roiToUse.height, height)) {
            for (x in roiToUse.x until min(roiToUse.x + roiToUse.width, width)) {
                val i = (y * width + x) * 4
                if (i + 3 < data.size) {
                    val r = data[i].toInt() and 0xFF
                    val g = data[i + 1].toInt() and 0xFF
                    val b = data[i + 2].toInt() and 0xFF
                    rSum += r
                    gSum += g
                    bSum += b
                    pixelsInRoi++
                }
            }
        }

        val avgRedRoi = if (pixelsInRoi > 0) rSum / pixelsInRoi else 0.0
        val avgGreenRoi = if (pixelsInRoi > 0) gSum / pixelsInRoi else 0.0
        val avgBlueRoi = if (pixelsInRoi > 0) bSum / pixelsInRoi else 0.0

        var processedRed = avgRedRoi * RED_GAIN
        processedRed -= avgGreenRoi * GREEN_SUPPRESSION
        processedRed = max(0.0, processedRed) * SIGNAL_GAIN

        var textureScore = 0.0
        if (pixelsInRoi > 0) {
            var varianceSumRed = 0.0
            for (y in roiToUse.y until min(roiToUse.y + roiToUse.height, height)) {
                for (x in roiToUse.x until min(roiToUse.x + roiToUse.width, width)) {
                     val i = (y * width + x) * 4
                    if (i < data.size) {
                        val r = data[i].toInt() and 0xFF
                        varianceSumRed += (r - avgRedRoi).pow(2)
                    }
                }
            }
            textureScore = sqrt(varianceSumRed / pixelsInRoi) / 255.0
            processedRed += textureScore * EDGE_ENHANCEMENT * processedRed
        }
        
        lastFrames.add(RGBFrame(avgRedRoi, avgGreenRoi, avgBlueRoi))
        if (lastFrames.size > HISTORY_SIZE) {
            lastFrames.removeAt(0)
        }

        val rToGRatio = if (avgGreenRoi > 0) avgRedRoi / avgGreenRoi else 0.0
        val rToBRatio = if (avgBlueRoi > 0) avgRedRoi / avgBlueRoi else 0.0

        val currentLightLevel = (avgRedRoi + avgGreenRoi + avgBlueRoi) / 3.0
        val lightLevelQualityFactor = getLightLevelQualityFactor(currentLightLevel)
        lastLightLevel = currentLightLevel
        
        processedRed *= lightLevelQualityFactor

        return FrameData(
            redValue = processedRed,
            avgRed = avgRedRoi,
            avgGreen = avgGreenRoi,
            avgBlue = avgBlueRoi,
            textureScore = textureScore,
            rToGRatio = rToGRatio,
            rToBRatio = rToBRatio
        )
    }

    private fun getLightLevelQualityFactor(lightLevel: Double): Double {
        return when {
            lightLevel < 50 -> 0.5
            lightLevel < 100 -> 0.8
            lightLevel > 200 -> 0.7
            else -> 1.0
        }
    }

    fun detectROI(redValue: Double, imageData: CommonImageDataWrapper): ROIData {
        val width = imageData.width
        val height = imageData.height
        val data = imageData.pixelData // Use renamed field
        
        var bestRoi = roiHistory.lastOrNull() ?: ROIData(width / 4, height / 4, width / 2, height / 2)
        var maxRedDensity = -1.0

        val roiWidth = (width * config.ROI_SIZE_FACTOR).roundToInt() // Use config from SignalProcessorConfig
        val roiHeight = (height * config.ROI_SIZE_FACTOR).roundToInt() // Use config from SignalProcessorConfig

        for (y in 0 until height - roiHeight step roiHeight / 4) {
            for (x in 0 until width - roiWidth step roiWidth / 4) {
                var currentRedSum = 0.0
                var pixelsInCurrentRoi = 0
                for (roiY in y until y + roiHeight) {
                    for (roiX in x until x + roiWidth) {
                        val i = (roiY * width + roiX) * 4
                        if (i + 3 < data.size) {
                            currentRedSum += data[i].toInt() and 0xFF
                            pixelsInCurrentRoi++
                        }
                    }
                }
                if (pixelsInCurrentRoi > 0) {
                    val density = currentRedSum / pixelsInCurrentRoi
                    if (density > maxRedDensity) {
                        maxRedDensity = density
                        bestRoi = ROIData(x, y, roiWidth, roiHeight)
                    }
                }
            }
        }
        
        roiHistory.add(bestRoi)
        if (roiHistory.size > ROI_HISTORY_SIZE) {
            roiHistory.removeAt(0)
        }
        return averageROI(roiHistory) ?: bestRoi
    }
    
    fun reset() {
        lastFrames.clear()
        lastLightLevel = -1.0
        roiHistory.clear()
    }
} 