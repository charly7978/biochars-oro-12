package modules.signalprocessing

import org.w3c.dom.ImageData
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

// Based on src/modules/signal-processing/FrameProcessor.ts
class FrameProcessor(private val config: Config) {
    data class Config(
        val TEXTURE_GRID_SIZE: Int,
        val ROI_SIZE_FACTOR: Double
    )

    private val RED_GAIN = 1.4 
    private val GREEN_SUPPRESSION = 0.8 
    private val SIGNAL_GAIN = 1.3 
    // private val EDGE_ENHANCEMENT = 0.15 // Not directly used in ported extractFrameData

    // private var lastFrames: MutableList<Map<String, Double>> = mutableListOf() // Not directly used
    // private val HISTORY_SIZE = 15 // Not directly used
    // private var lastLightLevel: Double = -1.0 // Not directly used

    private var roiHistory: MutableList<ROIData> = mutableListOf()
    private val ROI_HISTORY_SIZE = 5

    fun extractFrameData(imageData: ImageData): FrameData {
        val width = imageData.width
        val height = imageData.height
        val data = imageData.data

        var totalRed = 0.0
        var totalGreen = 0.0
        var totalBlue = 0.0
        var textureComplexity = 0.0
        val gridSize = config.TEXTURE_GRID_SIZE

        for (yGrid in 0 until gridSize) {
            for (xGrid in 0 until gridSize) {
                var localRed = 0.0
                var localGreen = 0.0
                var localBlue = 0.0
                var pixelCountInCell = 0

                val cellXStart = (width.toDouble() / gridSize * xGrid).toInt()
                val cellYStart = (height.toDouble() / gridSize * yGrid).toInt()
                val cellXEnd = (width.toDouble() / gridSize * (xGrid + 1)).toInt()
                val cellYEnd = (height.toDouble() / gridSize * (yGrid + 1)).toInt()

                for (y in cellYStart until cellYEnd) {
                    for (x in cellXStart until cellXEnd) {
                        val i = (y * width + x) * 4
                        if (i + 3 < data.length) { // Check bounds
                            val r = data[i].toDouble()
                            val g = data[i + 1].toDouble()
                            val b = data[i + 2].toDouble()
                            localRed += r
                            localGreen += g
                            localBlue += b
                            pixelCountInCell++
                        }
                    }
                }
                if (pixelCountInCell > 0) {
                    totalRed += localRed / pixelCountInCell
                    totalGreen += localGreen / pixelCountInCell
                    totalBlue += localBlue / pixelCountInCell

                    // Simplified texture: variance of local averages (if we stored them)
                    // For now, sum of abs differences from overall average (after loop)
                }
            }
        }

        val numCells = gridSize * gridSize
        val avgRed = if (numCells > 0) totalRed / numCells else 0.0
        val avgGreen = if (numCells > 0) totalGreen / numCells else 0.0
        val avgBlue = if (numCells > 0) totalBlue / numCells else 0.0
        
        // Simplified texture calculation: sum of absolute differences of cell averages from overall average
        // This requires storing cell averages. A simpler placeholder for now:
        textureComplexity = abs(avgRed - avgGreen) + abs(avgGreen - avgBlue) + abs(avgRed - avgBlue)
        val textureScore = min(1.0, textureComplexity / 255.0) // Normalize crude texture score

        // Signal enhancement based on original logic ideas
        val enhancedRed = avgRed * RED_GAIN
        val suppressedGreen = avgGreen * GREEN_SUPPRESSION
        // val ppgSignal = (enhancedRed - suppressedGreen) * SIGNAL_GAIN // This was used in older versions, now redValue is more direct
        val redValue = enhancedRed // Use enhanced red as the primary signal value from frame

        val rToGRatio = if (avgGreen > 0) avgRed / avgGreen else 0.0
        val rToBRatio = if (avgBlue > 0) avgRed / avgBlue else 0.0
        
        // Light level quality factor (simplified, could be expanded based on avgRed or overall brightness)
        val lightLevelQuality = getLightLevelQualityFactor(avgRed) 

        return FrameData(
            redValue = redValue * lightLevelQuality, // Modulate by light quality
            avgRed = avgRed,
            avgGreen = avgGreen,
            avgBlue = avgBlue,
            textureScore = textureScore, 
            rToGRatio = rToGRatio,
            rToBRatio = rToBRatio
        )
    }

    private fun getLightLevelQualityFactor(lightLevel: Double): Double {
        // Simplified: Assume good light if average red is between 50 and 200
        return when {
            lightLevel < 30.0 -> 0.5 // Too dark
            lightLevel < 60.0 -> 0.8 // A bit dark
            lightLevel > 220.0 -> 0.6 // Too bright (saturation risk)
            lightLevel > 190.0 -> 0.9 // A bit bright
            else -> 1.0 // Good light
        }
    }

    fun detectROI(redValue: Double, imageData: ImageData): ROIData {
        // Simplified ROI: Center of the image, scaled by ROI_SIZE_FACTOR
        // A more sophisticated version would analyze imageData to find finger region
        val width = imageData.width
        val height = imageData.height

        val roiWidth = (width * config.ROI_SIZE_FACTOR).toInt()
        val roiHeight = (height * config.ROI_SIZE_FACTOR).toInt()
        val roiX = (width - roiWidth) / 2
        val roiY = (height - roiHeight) / 2
        
        val currentRoi = ROIData(roiX, roiY, roiWidth, roiHeight)
        
        // Add to history and smooth (simple average)
        roiHistory.add(currentRoi)
        if (roiHistory.size > ROI_HISTORY_SIZE) {
            roiHistory.removeAt(0)
        }
        
        val avgX = roiHistory.map { it.x }.average().toInt()
        val avgY = roiHistory.map { it.y }.average().toInt()
        val avgWidth = roiHistory.map { it.width }.average().toInt()
        val avgHeight = roiHistory.map { it.height }.average().toInt()

        return ROIData(avgX, avgY, avgWidth, avgHeight)
    }
     fun reset() {
        roiHistory.clear()
        // lastFrames.clear()
        // lastLightLevel = -1.0
    }
} 