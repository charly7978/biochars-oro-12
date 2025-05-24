package utils

import kotlinx.serialization.Serializable

@Serializable // Si se necesita serializar este objeto
data class PPGDataPoint(
    val time: Long, // Asumiendo que time es un timestamp, Long es apropiado
    val value: Double,
    val isArrhythmia: Boolean
)

class CircularBuffer(private val maxSize: Int) {
    private var buffer: MutableList<PPGDataPoint> = mutableListOf()
    private var head: Int = 0 // No es estrictamente necesario con MutableList, pero puede optimizar `push` si se usa como array circular real.
                             // Por simplicidad con MutableList, simplemente añadiremos y quitaremos.

    init {
        if (maxSize <= 0) {
            throw IllegalArgumentException("Buffer size must be positive")
        }
    }

    fun push(point: PPGDataPoint) {
        if (buffer.size == maxSize) {
            buffer.removeAt(0) // Eliminar el más antiguo si el buffer está lleno
        }
        buffer.add(point) // Añadir el nuevo al final
    }

    fun getPoints(): List<PPGDataPoint> {
        // Devuelve una copia inmutable de los puntos actuales en el buffer
        return buffer.toList()
    }

    fun clear() {
        buffer.clear()
    }
    
    fun size(): Int {
        return buffer.size
    }

    fun isEmpty(): Boolean {
        return buffer.isEmpty()
    }

    fun isFull(): Boolean {
        return buffer.size == maxSize
    }
} 