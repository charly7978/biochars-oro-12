package com.biocharsproject.shared.types

import kotlinx.serialization.Serializable

// Asumiendo que HeartBeatProcessor será una clase en Kotlin
// import modules.HeartBeatProcessor // Esto se descomentará cuando HeartBeatProcessor esté definido

@Serializable
data class ROIData(
    val x: Int, // En TS es number, asumo Int para coordenadas/tamaño
    val y: Int,
    val width: Int,
    val height: Int
)

@Serializable
data class ProcessedSignal(
    val timestamp: Long, // En TS es number, Long es más apropiado para timestamps
    val rawValue: Double, // En TS es number, Double para valores de señal
    val filteredValue: Double,
    val quality: Double,
    val fingerDetected: Boolean,
    val roi: ROIData,
    val perfusionIndex: Double? = null
)

@Serializable
data class ProcessingError(
    val code: String,
    val message: String,
    val timestamp: Long
)

// En Kotlin, las interfaces pueden tener implementaciones por defecto y propiedades.
// Si SignalProcessor es una clase con estado o implementaciones complejas, podría ser una clase abstracta.
interface SignalProcessor {
    suspend fun initialize() // async/await en TS se traduce a suspend en Kotlin coroutines
    fun start()
    fun stop()
    suspend fun calibrate(): Boolean
    var onSignalReady: ((signal: ProcessedSignal) -> Unit)?
    var onError: ((error: ProcessingError) -> Unit)?
}

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

// La extensión global de Window no se traduce directamente a Kotlin/JS de la misma manera.
// Si se necesita acceso global a heartBeatProcessor, se manejaría de forma diferente
// dependiendo de la estructura de la aplicación Kotlin/JS.
// Por ahora, lo omito y se abordará si es necesario durante la migración de la lógica que lo usa.
/*
declare global {
    interface Window {
        var heartBeatProcessor: HeartBeatProcessor
    }
}
*/

/**
 * Datos de una imagen procesada para compatibilidad entre plataformas
 */
data class CommonImageDataWrapper(
    val pixelData: ByteArray,
    val width: Int,
    val height: Int,
    val format: String = "RGBA_8888" // Formato predeterminado, puede ser "YUV_420_888", "RGBA_8888", etc.
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

/**
 * Señal PPG procesada con todos los valores calculados
 */
data class ProcessedSignal(
    val timestamp: Long, // Tiempo en milisegundos
    val rawValue: Double, // Valor bruto de la señal
    val filteredValue: Double, // Valor filtrado
    val quality: Double, // Calidad de la señal (0.0 - 1.0)
    val fingerDetected: Boolean, // Si se detecta un dedo
    val roi: ROI, // Región de interés en la imagen
    val perfusionIndex: Double? = null // Índice de perfusión
)

/**
 * Región de interés en la imagen
 */
data class ROI(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int
)

/**
 * Error en el procesamiento de la señal
 */
data class ProcessingError(
    val code: String,
    val message: String,
    val timestamp: Long
)

/**
 * Medición vital completa para guardar o mostrar
 */
data class VitalSignsMeasurement(
    val timestamp: Long,
    val heartRate: Int,
    val spo2: Int,
    val systolic: Int? = null,
    val diastolic: Int? = null,
    val perfusionIndex: Double? = null,
    val signalQuality: Double,
    val arrhythmiaCount: Int = 0
)

/**
 * Datos de arritmia detectada
 */
data class ArrhythmiaData(
    val rmssd: Double, // Raíz cuadrada media de las diferencias sucesivas de intervalos RR
    val rrVariation: Double, // Variación de intervalos RR
    val irregularBeats: Int // Conteo de latidos irregulares
)