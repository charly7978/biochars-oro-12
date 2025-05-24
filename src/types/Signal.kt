package types

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