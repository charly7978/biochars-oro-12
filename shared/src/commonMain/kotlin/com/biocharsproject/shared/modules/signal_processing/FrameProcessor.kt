package com.biocharsproject.shared.modules.signal_processing

import com.biocharsproject.shared.types.ROIData
import com.biocharsproject.shared.types.CommonImageDataWrapper
import com.biocharsproject.shared.types.ROI
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
import com.biocharsproject.shared.modules.SignalProcessorConfig
import org.w3c.dom.ImageData

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

/**
 * Procesador de frames para extracción de datos PPG
 * Extrae valores de color y textura de las imágenes de la cámara
 */
class FrameProcessor(private val config: SignalProcessorConfig) {

    private val RED_GAIN = 1.4
    private val GREEN_SUPPRESSION = 0.8
    private val SIGNAL_GAIN = 1.3
    private val EDGE_ENHANCEMENT = 0.15

    private var lastFrames: MutableList<RGBFrame> = mutableListOf()
    private val HISTORY_SIZE = 15
    private var lastLightLevel: Int = -1

    private val roiHistory = mutableListOf<ROI>()
    private val roiHistorySize = 5

    private fun averageROI(rois: List<ROIData>): ROIData? {
        if (rois.isEmpty()) return null
        val avgX = rois.map { it.x }.average()
        val avgY = rois.map { it.y }.average()
        val avgWidth = rois.map { it.width }.average()
        val avgHeight = rois.map { it.height }.average()
        return ROIData(avgX.roundToInt(), avgY.roundToInt(), avgWidth.roundToInt(), avgHeight.roundToInt())
    }

    /**
     * Extrae datos del frame (valores RGB y textura)
     */
    fun extractFrameData(imageData: ImageData): FrameData {
        val width = imageData.width
        val height = imageData.height
        val data = imageData.data
        
        // Calculate center region for initial analysis
        val centerX = width / 2
        val centerY = height / 2
        val roiSize = (min(width, height) * config.ROI_SIZE_FACTOR).toInt()
        val halfRoi = roiSize / 2
        
        // Use ROI history for stability if available
        val currentRoi = if (roiHistory.isNotEmpty()) {
            roiHistory.last()
        } else {
            ROI(
                x = max(0, centerX - halfRoi),
                y = max(0, centerY - halfRoi),
                width = min(roiSize, width - (centerX - halfRoi)),
                height = min(roiSize, height - (centerY - halfRoi))
            )
        }
        
        // Sum pixel values in ROI
        var redSum = 0.0
        var greenSum = 0.0
        var blueSum = 0.0
        var pixelCount = 0
        
        for (y in currentRoi.y until (currentRoi.y + currentRoi.height)) {
            for (x in currentRoi.x until (currentRoi.x + currentRoi.width)) {
                val i = ((y * width) + x) * 4
                
                // Skip if out of bounds
                if (i < 0 || i >= data.length - 3) continue
                
                // Get pixel values (RGBA)
                val r = data[i].toUByte().toInt()
                val g = data[i + 1].toUByte().toInt()
                val b = data[i + 2].toUByte().toInt()
                
                redSum += r
                greenSum += g
                blueSum += b
                pixelCount++
            }
        }
        
        // Avoid division by zero
        if (pixelCount == 0) pixelCount = 1
        
        // Calculate averages
        val avgRed = redSum / pixelCount
        val avgGreen = greenSum / pixelCount
        val avgBlue = blueSum / pixelCount
        
        // Calculate ratios for biophysical validation
        val rToGRatio = if (avgGreen > 0) avgRed / avgGreen else 1.0
        val rToBRatio = if (avgBlue > 0) avgRed / avgBlue else 1.0
        
        // Process and enhance red value
        val redValue = processRedValue(avgRed, avgGreen)
        
        // Calculate texture score using grid analysis
        val textureScore = calculateTextureScore(imageData, currentRoi)
        
        // Add to frame history
        updateFrameHistory(avgRed, avgGreen, avgBlue)
        
        // Return the processed frame data
        return FrameData(
            redValue = redValue,
            avgRed = avgRed,
            avgGreen = avgGreen,
            avgBlue = avgBlue,
            textureScore = textureScore,
            rToGRatio = rToGRatio,
            rToBRatio = rToBRatio
        )
    }

    /**
     * Process the red value to enhance the PPG signal
     */
    private fun processRedValue(red: Double, green: Double): Double {
        // Apply red gain and green suppression
        return (red * RED_GAIN - green * GREEN_SUPPRESSION) * SIGNAL_GAIN
    }
    
    /**
     * Calculate texture score to identify finger texture
     */
    private fun calculateTextureScore(imageData: ImageData, roi: ROI): Double {
        val width = imageData.width
        val data = imageData.data
        
        // Define grid for texture analysis
        val gridSize = config.TEXTURE_GRID_SIZE
        val cellWidth = roi.width / gridSize
        val cellHeight = roi.height / gridSize
        
        if (cellWidth < 2 || cellHeight < 2) return 0.0
        
        var edgeScore = 0.0
        var totalCells = 0
        
        // Analyze each grid cell
        for (gx in 0 until gridSize) {
            for (gy in 0 until gridSize) {
                val startX = roi.x + gx * cellWidth
                val startY = roi.y + gy * cellHeight
                
                // Skip cells that go out of bounds
                if (startX + cellWidth >= width || startY + cellHeight >= imageData.height) continue
                
                // Calculate variance within cell (simplified gradient)
                var variance = 0.0
                var count = 0
                
                for (y in startY until (startY + cellHeight)) {
                    for (x in startX until (startX + cellWidth)) {
                        val i = ((y * width) + x) * 4
                        
                        // Skip if out of bounds
                        if (i < 0 || i >= data.length - 7) continue
                        
                        // Calculate horizontal and vertical gradients
                        val r1 = data[i].toUByte().toInt()
                        val r2 = data[i + 4].toUByte().toInt()  // Next pixel horizontally
                        val r3 = data[i + (width * 4)].toUByte().toInt()  // Next pixel vertically
                        
                        // Add absolute differences to variance
                        variance += Math.abs(r1 - r2) + Math.abs(r1 - r3)
                        count += 2
                    }
                }
                
                // Normalize variance for this cell
                if (count > 0) {
                    edgeScore += (variance / count) * EDGE_ENHANCEMENT
                    totalCells++
                }
            }
        }
        
        // Calculate final texture score, normalized
        return if (totalCells > 0) min(1.0, edgeScore / totalCells) else 0.0
    }
    
    /**
     * Update frame history for lighting analysis
     */
    private fun updateFrameHistory(red: Double, green: Double, blue: Double) {
        if (lastFrames.size >= HISTORY_SIZE) {
            lastFrames.removeAt(0)
        }
        
        lastFrames.add(RGBFrame(red, green, blue))
        
        // Update light level estimate
        val avgLight = lastFrames.map { it.red }.average()
        lastLightLevel = avgLight.roundToInt()
    }
    
    /**
     * Assess the quality of lighting conditions
     */
    private fun getLightLevelQualityFactor(lightLevel: Double): Double {
        // Optimal range for red channel in PPG
        val optimalMin = 80.0
        val optimalMax = 200.0
        
        return when {
            lightLevel < 20 -> 0.2  // Too dark
            lightLevel < optimalMin -> 0.5 + ((lightLevel - 20) / (optimalMin - 20)) * 0.3  // Below optimal
            lightLevel <= optimalMax -> 0.8 + ((optimalMax - lightLevel) / (optimalMax - optimalMin)) * 0.2  // Optimal range
            lightLevel < 240 -> 0.7 - ((lightLevel - optimalMax) / (240 - optimalMax)) * 0.4  // Above optimal
            else -> 0.3  // Too bright
        }
    }
    
    /**
     * Detect and track ROI based on signal quality
     */
    fun detectROI(redValue: Double, imageData: ImageData): ROI {
        val width = imageData.width
        val height = imageData.height
        
        // Default center ROI
        val centerX = width / 2
        val centerY = height / 2
        val roiSize = (min(width, height) * config.ROI_SIZE_FACTOR).toInt()
        val halfRoi = roiSize / 2
        
        val defaultRoi = ROI(
            x = max(0, centerX - halfRoi),
            y = max(0, centerY - halfRoi),
            width = min(roiSize, width - (centerX - halfRoi)),
            height = min(roiSize, height - (centerY - halfRoi))
        )
        
        // If signal quality is poor, try to optimize ROI using texture
        val roi = if (redValue > config.MIN_RED_THRESHOLD && redValue < config.MAX_RED_THRESHOLD) {
            // Use current ROI as it's working well
            defaultRoi
        } else {
            // Try to find better ROI by scanning regions
            // In a full implementation, this would analyze multiple regions
            // For simplicity, we'll use the default ROI
            defaultRoi
        }
        
        // Update ROI history
        if (roiHistory.size >= roiHistorySize) {
            roiHistory.removeAt(0)
        }
        roiHistory.add(roi)
        
        return roi
    }
    
    fun reset() {
        lastFrames.clear()
        lastLightLevel = -1
        roiHistory.clear()
    }
}

/**
 * Datos extraídos de un frame de imagen
 */
data class FrameData(
    val redValue: Double,
    val avgRed: Double,
    val avgGreen: Double,
    val avgBlue: Double,
    val textureScore: Double,
    val rToGRatio: Double,
    val rToBRatio: Double
) 