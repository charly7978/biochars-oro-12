package com.biocharsproject.shared.utils

import kotlinx.serialization.Serializable

/**
 * Data point structure for PPG signal with timestamp and analysis metadata
 */
@Serializable // Si se necesita serializar este objeto
data class PPGDataPoint(
    val time: Double,
    val value: Double,
    val isArrhythmia: Boolean = false
)

/**
 * CircularBuffer is a fixed-size buffer that overwrites oldest items when full.
 * Used for storing time-series PPG data efficiently.
 */
class CircularBuffer(private val maxSize: Int) {
    private val buffer = mutableListOf<PPGDataPoint>()
    
    init {
        if (maxSize <= 0) {
            throw IllegalArgumentException("Buffer size must be positive")
        }
    }

    /**
     * Add a data point to the buffer, removing oldest if needed
     */
    fun push(point: PPGDataPoint) {
        if (buffer.size >= maxSize) {
            buffer.removeAt(0)
        }
        buffer.add(point)
    }
    
    /**
     * Get all data points in the buffer
     */
    fun getPoints(): List<PPGDataPoint> {
        return buffer.toList()
    }
    
    /**
     * Clear all data points from the buffer
     */
    fun clear() {
        buffer.clear()
    }
    
    /**
     * Check if the buffer is empty
     */
    fun isEmpty(): Boolean {
        return buffer.isEmpty()
    }
    
    /**
     * Get the current size of the buffer
     */
    fun size(): Int {
        return buffer.size
    }

    fun isFull(): Boolean {
        return buffer.size == maxSize
    }
} 