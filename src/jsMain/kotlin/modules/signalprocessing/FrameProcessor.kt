package modules.signalprocessing

// import org.w3c.dom.ImageData // Using local ImageData
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

    private var roiHistory: MutableList<ROIData> = mutableListOf()
    private val ROI_HISTORY_SIZE = 5

    // Return type changed to modules.signalprocessing.FrameData
    fun extractFrameData(imageData: ImageData): modules.signalprocessing.FrameData {
        val width = imageData.width
        val height = imageData.height
        // In Kotlin/JS, Uint8ClampedArray is typically represented as ByteArray or IntArray.
        // Assuming imageData.data is compatible (e.g., ByteArray from a canvas context)
        val data = imageData.data 

        var totalRed = 0.0
        var totalGreen = 0.0
        var totalBlue = 0.0
        // var textureComplexity = 0.0 // Not directly used for final FrameData, calculated for textureScore
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
                        // Ensure we are accessing valid indices for data array (RGBA)
                        if (i + 3 < data.size) { 
                            val r = data[i].toInt() and 0xFF // Convert signed Byte to unsigned Int
                            val g = data[i + 1].toInt() and 0xFF
                            val b = data[i + 2].toInt() and 0xFF
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
                }
            }
        }

        val numCells = gridSize * gridSize
        val avgRed = if (numCells > 0) totalRed / numCells else 0.0
        val avgGreen = if (numCells > 0) totalGreen / numCells else 0.0
        val avgBlue = if (numCells > 0) totalBlue / numCells else 0.0
        
        val textureComplexity = abs(avgRed - avgGreen) + abs(avgGreen - avgBlue) + abs(avgRed - avgBlue)
        val textureScore = min(1.0, textureComplexity / 255.0) 

        val enhancedRed = avgRed * RED_GAIN
        // val suppressedGreen = avgGreen * GREEN_SUPPRESSION // Not used for final FrameData output
        val redValueOutput = enhancedRed 

        val rToGRatio = if (avgGreen > 0) avgRed / avgGreen else 0.0
        val rToBRatio = if (avgBlue > 0) avgRed / avgBlue else 0.0
        
        val lightLevelQuality = getLightLevelQualityFactor(avgRed) 

        // Constructing the FrameData type from modules.signalprocessing
        return modules.signalprocessing.FrameData(
            redValue = redValueOutput * lightLevelQuality,
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