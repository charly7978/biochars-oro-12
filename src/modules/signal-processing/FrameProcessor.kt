package modules.signal_processing

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

// Asumiendo que FrameData y ROIData están definidas (en Types.kt y Signal.kt respectivamente)
// import modules.signal_processing.FrameData // (ya debería estar en Types.kt)
// import types.ROIData // (ya debería estar en Signal.kt)

// Representación de ImageData. En Kotlin/JS, esto podría ser una interfaz externa si se usa directamente del DOM.
// O una data class si se pasan los datos de otra forma.
// Por ahora, usaremos una data class para la estructura.
@kotlinx.serialization.Serializable // Si se necesita serializar
data class ImageDataWrapper(
    val data: ByteArray, // Uint8ClampedArray se maneja como ByteArray en Kotlin
    val width: Int,
    val height: Int
) {
    // Implementaciones de equals y hashCode para que funcione correctamente en colecciones si es necesario
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false
        other as ImageDataWrapper
        if (!data.contentEquals(other.data)) return false
        if (width != other.width) return false
        if (height != other.height) return false
        return true
    }

    override fun hashCode(): Int {
        var result = data.contentHashCode()
        result = 31 * result + width
        result = 31 * result + height
        return result
    }
}

data class FrameProcessorConfig(
    val TEXTURE_GRID_SIZE: Int,
    val ROI_SIZE_FACTOR: Double
)

data class RGBFrame(
    val red: Double,
    val green: Double,
    val blue: Double
)

class FrameProcessor(private val config: FrameProcessorConfig) {

    private val RED_GAIN = 1.4
    private val GREEN_SUPPRESSION = 0.8
    private val SIGNAL_GAIN = 1.3
    private val EDGE_ENHANCEMENT = 0.15

    private var lastFrames: MutableList<RGBFrame> = mutableListOf()
    private val HISTORY_SIZE = 15
    private var lastLightLevel: Double = -1.0

    private var roiHistory: MutableList<ROIData> = mutableListOf()
    private val ROI_HISTORY_SIZE = 5

    // Función de utilidad para obtener el promedio de una lista de ROI
    private fun averageROI(rois: List<ROIData>): ROIData? {
        if (rois.isEmpty()) return null
        val avgX = rois.map { it.x }.average()
        val avgY = rois.map { it.y }.average()
        val avgWidth = rois.map { it.width }.average()
        val avgHeight = rois.map { it.height }.average()
        return ROIData(avgX.roundToInt(), avgY.roundToInt(), avgWidth.roundToInt(), avgHeight.roundToInt())
    }

    fun extractFrameData(imageData: ImageDataWrapper): FrameData {
        val width = imageData.width
        val height = imageData.height
        val data = imageData.data

        var totalRed = 0L
        var totalGreen = 0L
        var totalBlue = 0L
        var rSum = 0.0
        var gSum = 0.0
        var bSum = 0.0
        val numPixels = width * height

        var roiToUse = averageROI(roiHistory) ?: ROIData(width / 4, height / 4, width / 2, height / 2) // Default ROI

        var pixelsInRoi = 0
        for (y in roiToUse.y until min(roiToUse.y + roiToUse.height, height)) {
            for (x in roiToUse.x until min(roiToUse.x + roiToUse.width, width)) {
                val i = (y * width + x) * 4
                if (i + 3 < data.size) { // Asegurar que no se salga de los límites
                    val r = data[i].toInt() and 0xFF
                    val g = data[i + 1].toInt() and 0xFF
                    val b = data[i + 2].toInt() and 0xFF
                    // val a = data[i + 3].toInt() and 0xFF // Alpha no se usa directamente aquí
                    
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

        // Procesamiento de la señal basado en la descripción del original
        var processedRed = avgRedRoi * RED_GAIN
        processedRed -= avgGreenRoi * GREEN_SUPPRESSION // Atenuar el verde
        processedRed = max(0.0, processedRed) * SIGNAL_GAIN // Amplificar y asegurar no negativo

        // El outline no detalla cómo se calcula `textureScore` o cómo se usa `EDGE_ENHANCEMENT`.
        // A continuación, una implementación *muy* simplificada de textureScore basada en la varianza en el ROI.
        // La lógica real de `textureScore` del original es necesaria para una traducción precisa.
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
            textureScore = sqrt(varianceSumRed / pixelsInRoi) / 255.0 // Normalizado
            // Aplicar mejora de bordes (simplificado)
            processedRed += textureScore * EDGE_ENHANCEMENT * processedRed
        }
        
        // Actualizar historial de frames
        lastFrames.add(RGBFrame(avgRedRoi, avgGreenRoi, avgBlueRoi))
        if (lastFrames.size > HISTORY_SIZE) {
            lastFrames.removeAt(0)
        }

        // Cálculo de ratios
        val rToGRatio = if (avgGreenRoi > 0) avgRedRoi / avgGreenRoi else 0.0
        val rToBRatio = if (avgBlueRoi > 0) avgRedRoi / avgBlueRoi else 0.0

        // Light level (simplificado)
        val currentLightLevel = (avgRedRoi + avgGreenRoi + avgBlueRoi) / 3.0
        val lightLevelQualityFactor = getLightLevelQualityFactor(currentLightLevel)
        lastLightLevel = currentLightLevel
        
        // Aplicar factor de calidad de luz (esto es una suposición de cómo podría usarse)
        processedRed *= lightLevelQualityFactor

        return FrameData(
            redValue = processedRed,
            avgRed = avgRedRoi,
            avgGreen = avgGreenRoi,
            avgBlue = avgBlueRoi,
            textureScore = textureScore, // Debería ser el textureScore real
            rToGRatio = rToGRatio,
            rToBRatio = rToBRatio
        )
    }

    private fun getLightLevelQualityFactor(lightLevel: Double): Double {
        // Lógica de ejemplo, la original podría ser más compleja
        return when {
            lightLevel < 50 -> 0.5 // Muy oscuro
            lightLevel < 100 -> 0.8 // Oscuro
            lightLevel > 200 -> 0.7 // Muy brillante (saturación?)
            else -> 1.0 // Óptimo
        }
    }

    fun detectROI(redValue: Double, imageData: ImageDataWrapper): ROIData {
        // La lógica de detectROI en el original no estaba en el outline.
        // Esta es una implementación de placeholder muy simplificada.
        // Se basa en encontrar el área con mayor concentración de "rojo" (simplificado).
        val width = imageData.width
        val height = imageData.height
        val data = imageData.data
        
        var bestRoi = roiHistory.lastOrNull() ?: ROIData(width / 4, height / 4, width / 2, height / 2)
        var maxRedDensity = -1.0

        val roiWidth = (width * config.ROI_SIZE_FACTOR).roundToInt()
        val roiHeight = (height * config.ROI_SIZE_FACTOR).roundToInt()

        // Búsqueda simplificada de una nueva ROI
        // Iterar sobre posibles posiciones de ROI (esto es ineficiente, solo para demostración)
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