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
class FrameProcessor(private val config: Any) {

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
    fun extractFrameData(imageData: CommonImageDataWrapper): FrameData {
        val pixelData = imageData.pixelData
        val width = imageData.width
        val height = imageData.height
        
        // Si no hay datos o dimensiones inválidas, devolver valores por defecto
        if (pixelData.isEmpty() || width <= 0 || height <= 0) {
            return FrameData(
                redValue = 0,
                avgRed = 0.0,
                avgGreen = 0.0,
                avgBlue = 0.0,
                textureScore = 0.0,
                rToGRatio = 0.0,
                rToBRatio = 0.0
            )
        }
        
        // Analizar según el formato de la imagen
        return when (imageData.format) {
            "YUV_420_888" -> extractDataFromYUV(imageData)
            "RGBA_8888", "RGBA", "RGB" -> extractDataFromRGBA(imageData)
            else -> extractDataFromGeneric(imageData)
        }
    }

    /**
     * Extrae datos de una imagen en formato YUV (común en cámaras Android)
     */
    private fun extractDataFromYUV(imageData: CommonImageDataWrapper): FrameData {
        val pixelData = imageData.pixelData
        val width = imageData.width
        val height = imageData.height
        
        // Calcular la región de interés (ROI) - centro de la imagen
        val roiSize = minOf(width, height) / 3
        val startX = (width - roiSize) / 2
        val startY = (height - roiSize) / 2
        val endX = startX + roiSize
        val endY = startY + roiSize
        
        var sumY = 0L  // Componente Y (luminancia) - proxy para rojo en PPG
        var pixelCount = 0
        
        // Calcular valores de textura (variación local)
        var textureScore = 0.0
        var sumDiff = 0.0
        var diffCount = 0
        
        // En formato YUV_420_888, Y está en el primer plano (plane 0)
        // Recorrer solo la región central (ROI)
        for (y in startY until endY) {
            for (x in startX until endX) {
                val index = y * width + x
                if (index < pixelData.size) {
                    // Extraer componente Y (luminancia) - mejor proxy para rojo en PPG
                    val value = pixelData[index].toInt() and 0xFF
                    sumY += value
                    pixelCount++
                    
                    // Calcular diferencias con píxeles vecinos para textura
                    if (x > startX && y > startY) {
                        val left = pixelData[(y * width + (x-1))].toInt() and 0xFF
                        val top = pixelData[((y-1) * width + x)].toInt() and 0xFF
                        
                        sumDiff += Math.abs(value - left) + Math.abs(value - top)
                        diffCount += 2
                    }
                }
            }
        }
        
        // Calcular promedios
        val avgY = if (pixelCount > 0) sumY.toDouble() / pixelCount else 0.0
        textureScore = if (diffCount > 0) sumDiff / diffCount else 0.0
        
        // Normalizar la puntuación de textura (0-1)
        textureScore = min(1.0, textureScore / 30.0) // 30 es un valor máximo típico para diferencias
        
        // Actualizar nivel de luz
        lastLightLevel = avgY.toInt()
        
        return FrameData(
            redValue = avgY.toInt(),
            avgRed = avgY,
            avgGreen = avgY * 0.8, // Estimación aproximada para YUV
            avgBlue = avgY * 0.7,  // Estimación aproximada para YUV
            textureScore = textureScore,
            rToGRatio = 1.25,      // Aproximación para YUV
            rToBRatio = 1.43       // Aproximación para YUV
        )
    }

    /**
     * Extrae datos de una imagen en formato RGBA (común en navegadores)
     */
    private fun extractDataFromRGBA(imageData: CommonImageDataWrapper): FrameData {
        val pixelData = imageData.pixelData
        val width = imageData.width
        val height = imageData.height
        
        // Calcular la región de interés (ROI) - centro de la imagen
        val roiSize = minOf(width, height) / 3
        val startX = (width - roiSize) / 2
        val startY = (height - roiSize) / 2
        val endX = startX + roiSize
        val endY = startY + roiSize
        
        var sumR = 0L
        var sumG = 0L
        var sumB = 0L
        var pixelCount = 0
        
        // Calcular valores de textura (variación local)
        var textureScore = 0.0
        var sumDiff = 0.0
        var diffCount = 0
        
        // En formato RGBA, cada píxel ocupa 4 bytes [R,G,B,A]
        for (y in startY until endY) {
            for (x in startX until endX) {
                val baseIndex = (y * width + x) * 4
                if (baseIndex + 2 < pixelData.size) {
                    val r = pixelData[baseIndex].toInt() and 0xFF
                    val g = pixelData[baseIndex + 1].toInt() and 0xFF
                    val b = pixelData[baseIndex + 2].toInt() and 0xFF
                    
                    sumR += r
                    sumG += g
                    sumB += b
                    pixelCount++
                    
                    // Calcular diferencias con píxeles vecinos para textura (solo canal rojo)
                    if (x > startX && y > startY) {
                        val leftIndex = (y * width + (x-1)) * 4
                        val topIndex = ((y-1) * width + x) * 4
                        
                        if (leftIndex >= 0 && topIndex >= 0 && 
                            leftIndex < pixelData.size && topIndex < pixelData.size) {
                            val left = pixelData[leftIndex].toInt() and 0xFF
                            val top = pixelData[topIndex].toInt() and 0xFF
                            
                            sumDiff += Math.abs(r - left) + Math.abs(r - top)
                            diffCount += 2
                        }
                    }
                }
            }
        }
        
        // Calcular promedios
        val avgR = if (pixelCount > 0) sumR.toDouble() / pixelCount else 0.0
        val avgG = if (pixelCount > 0) sumG.toDouble() / pixelCount else 0.0
        val avgB = if (pixelCount > 0) sumB.toDouble() / pixelCount else 0.0
        textureScore = if (diffCount > 0) sumDiff / diffCount else 0.0
        
        // Normalizar la puntuación de textura (0-1)
        textureScore = min(1.0, textureScore / 30.0)
        
        // Calcular ratios (evitar división por cero)
        val rToGRatio = if (avgG > 0) avgR / avgG else 0.0
        val rToBRatio = if (avgB > 0) avgR / avgB else 0.0
        
        // Actualizar nivel de luz
        lastLightLevel = avgR.toInt()
        
        return FrameData(
            redValue = avgR.toInt(),
            avgRed = avgR,
            avgGreen = avgG,
            avgBlue = avgB,
            textureScore = textureScore,
            rToGRatio = rToGRatio,
            rToBRatio = rToBRatio
        )
    }
    
    /**
     * Método genérico para extraer datos de cualquier formato de imagen
     */
    private fun extractDataFromGeneric(imageData: CommonImageDataWrapper): FrameData {
        // Para formatos desconocidos, extraemos el primer byte de cada píxel como aproximación
        val pixelData = imageData.pixelData
        var sum = 0L
        var count = 0
        
        // Tomar una muestra de los datos
        val step = max(1, pixelData.size / 1000)
        for (i in pixelData.indices step step) {
            sum += pixelData[i].toInt() and 0xFF
            count++
        }
        
        val avgValue = if (count > 0) sum.toDouble() / count else 0.0
        
        return FrameData(
            redValue = avgValue.toInt(),
            avgRed = avgValue,
            avgGreen = avgValue,
            avgBlue = avgValue,
            textureScore = 0.0,
            rToGRatio = 1.0,
            rToBRatio = 1.0
        )
    }
    
    /**
     * Detecta y estabiliza la región de interés (ROI) basada en el valor rojo
     */
    fun detectROI(redValue: Int, imageData: CommonImageDataWrapper): ROI {
        // ROI predeterminada (centro de la imagen)
        val width = imageData.width
        val height = imageData.height
        val defaultRoiSize = minOf(width, height) / 3
        
        val defaultRoi = ROI(
            x = (width - defaultRoiSize) / 2,
            y = (height - defaultRoiSize) / 2,
            width = defaultRoiSize,
            height = defaultRoiSize
        )
        
        // Si no hay suficientes datos para analizar, usar ROI predeterminada
        if (imageData.pixelData.isEmpty() || width <= 0 || height <= 0) {
            return defaultRoi
        }
        
        // Añadir ROI predeterminada al historial si está vacío
        if (roiHistory.isEmpty()) {
            roiHistory.add(defaultRoi)
            return defaultRoi
        }
        
        // Usar el último ROI como base
        val lastRoi = roiHistory.last()
        
        // Solo actualizar ROI periódicamente para evitar inestabilidad
        if (roiHistory.size % 10 == 0) {
            // Aquí podríamos implementar un algoritmo más avanzado para detectar
            // la región con mayor señal roja, pero por simplicidad usamos la predeterminada
            roiHistory.add(defaultRoi)
        } else {
            roiHistory.add(lastRoi)
        }
        
        // Mantener historial limitado
        if (roiHistory.size > roiHistorySize) {
            roiHistory.removeAt(0)
        }
        
        // Calcular ROI promedio para estabilidad
        var sumX = 0
        var sumY = 0
        var sumW = 0
        var sumH = 0
        
        for (roi in roiHistory) {
            sumX += roi.x
            sumY += roi.y
            sumW += roi.width
            sumH += roi.height
        }
        
        val avgRoi = ROI(
            x = sumX / roiHistory.size,
            y = sumY / roiHistory.size,
            width = sumW / roiHistory.size,
            height = sumH / roiHistory.size
        )
        
        return avgRoi
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
    val redValue: Int,
    val avgRed: Double,
    val avgGreen: Double,
    val avgBlue: Double,
    val textureScore: Double,
    val rToGRatio: Double,
    val rToBRatio: Double
) 