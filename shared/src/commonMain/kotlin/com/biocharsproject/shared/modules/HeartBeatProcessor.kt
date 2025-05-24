package com.biocharsproject.shared.modules

import kotlinx.coroutines.CoroutineScope

// Common expect declarations
expect class ExternalAudioContext
expect class ExternalOscillatorNode
expect class ExternalGainNode
expect class ExternalAudioParam
expect interface NavigatorWithVibrate

expect fun getCurrentTimeMillis(): Long

data class HeartBeatResult(
    val bpm: Double,
    val confidence: Double,
    val isPeak: Boolean,
    val filteredValue: Double,
    var arrhythmiaCount: Int,
    val signalQuality: Double? = null
)

expect class HeartBeatProcessor() : CoroutineScope {
    fun processSample(value: Double, timestamp: Long): HeartBeatResult?
    fun reset()
    fun setBPMListener(listener: (bpm: Double, confidence: Double, isPeak: Boolean, filtered: Double, arrhythmiaCount: Int) -> Unit)
    fun setArrhythmiaListener(listener: (type: String, timestamp: Long) -> Unit) // Tipo y timestamp pueden variar
    fun getSignalQuality(): Double
    fun stop()
} 