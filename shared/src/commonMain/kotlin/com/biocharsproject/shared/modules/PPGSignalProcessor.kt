package com.biocharsproject.shared.modules

import com.biocharsproject.shared.modules.signal_processing.*
import com.biocharsproject.shared.types.CommonImageDataWrapper
import com.biocharsproject.shared.types.ProcessedSignal
import com.biocharsproject.shared.types.ProcessingError
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Procesador avanzado de señales PPG (Fotopletismografía)
 * Optimizado para mediciones de alta precisión en dispositivos móviles
 */
class PPGSignalProcessor(
    val onSignalReady: ((ProcessedSignal) -> Unit)? = null,
    val onError: ((ProcessingError) -> Unit)? = null
) {
    // Filtros y analizadores de señal
    private val kalmanFilter = KalmanFilter()
    private val sgFilter = SavitzkyGolayFilter(windowSize = 15)
    private val trendAnalyzer = SignalTrendAnalyzer(historyLength = 45)
    private val biophysicalValidator = BiophysicalValidator()
    private val signalAnalyzer = SignalAnalyzer(CONFIG)
    private val calibrationHandler = CalibrationHandler(CONFIG)
    private val frameProcessor = FrameProcessor(CONFIG)
    
    // Estado del procesador
    var isProcessing: Boolean = false
        private set
    var isCalibrating: Boolean = false
        private set
    private val signalBuffer = mutableListOf<Double>()
    private val timestampBuffer = mutableListOf<Long>()
    private var frameCount: Int = 0
    private var lastRawValue: Int = 0
    private var perfusionIndex: Double = 0.0
    private var qualityScoreAvg: Double = 0.0
    private val qualityHistory = mutableListOf<Double>()
    
    // Umbral dinámico para detección del dedo
    private var dynamicThreshold: Double = 30.0
    private var baselineValue: Double = 0.0
    private var lastNonZeroTimestamp: Long = 0
    
    // Detección de arritmias
    private val rrIntervals = mutableListOf<Long>()
    private val peakTimes = mutableListOf<Long>()
    private var arrhythmiaCount: Int = 0
    
    // Configuración
    private val CONFIG = SignalProcessorConfig(
        BUFFER_SIZE = 300,
        MIN_RED_THRESHOLD = 15.0,
        MAX_RED_THRESHOLD = 245.0,
        STABILITY_WINDOW = 10,
        MIN_STABILITY_COUNT = 5,
        HYSTERESIS = 0.2,
        MIN_CONSECUTIVE_DETECTIONS = 15,
        MAX_CONSECUTIVE_NO_DETECTIONS = 30,
        QUALITY_LEVELS = 10,
        QUALITY_HISTORY_SIZE = 10,
        CALIBRATION_SAMPLES = 60,
        TEXTURE_GRID_SIZE = 8,
        ROI_SIZE_FACTOR = 0.35
    )
    
    /**
     * Inicializa el procesador con parámetros optimizados
     */
    suspend fun initialize(): Boolean {
        try {
            // Reiniciar todos los componentes
            resetAll()
            
            // Esperar un momento para estabilizar
            delay(100)
            
            return true
        } catch (e: Exception) {
            handleError("INIT_ERROR", "Error al inicializar: ${e.message}")
            return false
        }
    }
    
    /**
     * Inicia el procesamiento de señal
     */
    fun start() {
        isProcessing = true
        isCalibrating = true
    }
    
    /**
     * Detiene el procesamiento de señal
     */
    fun stop() {
        isProcessing = false
        isCalibrating = false
    }
    
    /**
     * Realiza una calibración del procesador para el hardware específico
     */
    suspend fun calibrate(): Boolean {
        try {
            isCalibrating = true
            resetAll()
            
            // La calibración se realizará automáticamente durante el procesamiento
            // de los primeros frames después de activar isCalibrating
            
            return true
        } catch (e: Exception) {
            handleError("CALIBRATION_ERROR", "Error en calibración: ${e.message}")
            return false
        }
    }
    
    /**
     * Procesa un frame de imagen y extrae señal PPG
     */
    fun processFrame(imageData: CommonImageDataWrapper) {
        if (!isProcessing) return
        
        try {
            // Contador de frames procesados
            frameCount++
            
            // Extraer datos del frame y región de interés (ROI)
            val frameData = frameProcessor.extractFrameData(imageData)
            val redValue = frameData.redValue.toDouble()
            lastRawValue = redValue.roundToInt()
            
            // Aplicar filtros de pre-procesamiento
            val timestamp = System.currentTimeMillis()
            val kalmanValue = kalmanFilter.filter(redValue)
            val sgValue = sgFilter.filter(kalmanValue)
            
            // Analizar tendencia y estabilidad
            trendAnalyzer.addValue(sgValue)
            val trendScores = trendAnalyzer.getScores()
            val trendResult = trendAnalyzer.analyzeTrend(sgValue)
            
            // Validación biofísica de la señal
            val pulsatility = biophysicalValidator.calculatePulsatilityIndex(sgValue)
            val biophysicalScore = biophysicalValidator.validateBiophysicalRange(
                frameData.redValue.toDouble(),
                frameData.rToGRatio,
                frameData.rToBRatio
            )
            
            // Calibración (si es necesario)
            if (isCalibrating && frameCount > 15) {
                val isCalibrated = calibrationHandler.handleCalibration(redValue)
                if (isCalibrated) {
                    isCalibrating = false
                    
                    // Aplicar resultados de calibración
                    val calibrationValues = calibrationHandler.getCalibrationValues()
                    baselineValue = calibrationValues.baselineRed
                    dynamicThreshold = calibrationValues.baselineVariance * 2.5
                }
            }
            
            // Actualizar buffers para análisis temporal
            signalBuffer.add(sgValue)
            timestampBuffer.add(timestamp)
            if (signalBuffer.size > CONFIG.BUFFER_SIZE) {
                signalBuffer.removeAt(0)
                timestampBuffer.removeAt(0)
            }
            
            // Detección avanzada del dedo y análisis de calidad
            val detectionResult = signalAnalyzer.analyzeSignalMultiDetector(
                sgValue,
                trendResult
            )
            
            // Calcular perfusión (ratio de componente AC/DC)
            if (signalBuffer.size > 10 && detectionResult.isFingerDetected) {
                val min = signalBuffer.takeLast(20).minOrNull() ?: sgValue
                val max = signalBuffer.takeLast(20).maxOrNull() ?: sgValue
                val avg = signalBuffer.takeLast(20).average()
                
                // Índice de perfusión: (max-min)/avg * 100%
                if (avg > 0) {
                    perfusionIndex = (max - min) / avg * 100
                }
                
                // Detección de picos para análisis de ritmo cardíaco
                detectPeaks(sgValue, timestamp)
            }
            
            // Actualizar promedio de calidad
            qualityHistory.add(detectionResult.quality)
            if (qualityHistory.size > CONFIG.QUALITY_HISTORY_SIZE) {
                qualityHistory.removeAt(0)
            }
            qualityScoreAvg = qualityHistory.average()
            
            // Obtener región de interés actual
            val roi = frameProcessor.detectROI(redValue.toInt(), imageData)
            
            // Enviar señal procesada
            val processedSignal = ProcessedSignal(
                timestamp = timestamp,
                rawValue = redValue,
                filteredValue = sgValue,
                quality = qualityScoreAvg,
                fingerDetected = detectionResult.isFingerDetected,
                roi = roi,
                perfusionIndex = perfusionIndex
            )
            
            onSignalReady?.invoke(processedSignal)
            
            // Si detectamos que el dedo no está presente por un tiempo
            if (!detectionResult.isFingerDetected && 
                lastNonZeroTimestamp > 0 && 
                timestamp - lastNonZeroTimestamp > 5000) {
                // Reiniciar filtros pero no la calibración
                resetFilters()
            }
            
            // Actualizar timestamp del último valor no-cero
            if (redValue > 5) {
                lastNonZeroTimestamp = timestamp
            }
            
        } catch (e: Exception) {
            handleError("PROCESSING_ERROR", "Error procesando frame: ${e.message}")
        }
    }
    
    /**
     * Detecta picos en la señal para análisis de ritmo cardíaco y arritmias
     */
    private fun detectPeaks(value: Double, timestamp: Long) {
        // Solo procesar si tenemos suficiente historia
        if (signalBuffer.size < 10) return
        
        val recentValues = signalBuffer.takeLast(10)
        val avg = recentValues.average()
        val threshold = (recentValues.maxOrNull() ?: avg) * 0.65
        
        // Verificar si el valor anterior es un pico (miramos 2 muestras hacia atrás)
        val checkIndex = signalBuffer.size - 3
        
        if (checkIndex >= 0 && checkIndex < signalBuffer.size - 1) {
            val peakCandidate = signalBuffer[checkIndex]
            val peakTime = timestampBuffer[checkIndex]
            
            // Verificar si es un pico local
            val isPeak = peakCandidate > threshold &&
                         peakCandidate > signalBuffer[checkIndex - 1] &&
                         peakCandidate > signalBuffer[checkIndex + 1]
            
            // Si es un pico y ha pasado suficiente tiempo desde el último
            if (isPeak && (peakTimes.isEmpty() || peakTime - peakTimes.lastOrNull()!! > 300)) {
                peakTimes.add(peakTime)
                
                // Calcular intervalo RR (tiempo entre picos)
                if (peakTimes.size > 1) {
                    val rrInterval = peakTime - peakTimes[peakTimes.size - 2]
                    rrIntervals.add(rrInterval)
                    
                    // Detectar arritmias analizando variabilidad RR
                    if (rrIntervals.size > 3) {
                        detectArrhythmia()
                    }
                }
                
                // Mantener historia limitada
                if (peakTimes.size > 20) {
                    peakTimes.removeAt(0)
                }
                if (rrIntervals.size > 20) {
                    rrIntervals.removeAt(0)
                }
            }
        }
    }
    
    /**
     * Detecta arritmias basadas en la variabilidad de intervalos RR
     */
    private fun detectArrhythmia() {
        if (rrIntervals.size < 4) return
        
        // Calcular promedio y variabilidad de los últimos intervalos
        val recentIntervals = rrIntervals.takeLast(4)
        val avgRR = recentIntervals.average()
        
        // Verificar si algún intervalo se desvía significativamente
        for (interval in recentIntervals) {
            val percentChange = abs(interval - avgRR) / avgRR
            
            // Si la variación es mayor al 20%, podría ser una arritmia
            if (percentChange > 0.20) {
                arrhythmiaCount++
                break
            }
        }
    }
    
    /**
     * Reinicia todos los componentes de procesamiento
     */
    private fun resetAll() {
        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        biophysicalValidator.reset()
        signalAnalyzer.reset()
        calibrationHandler.resetCalibration()
        
        signalBuffer.clear()
        timestampBuffer.clear()
        qualityHistory.clear()
        rrIntervals.clear()
        peakTimes.clear()
        
        frameCount = 0
        arrhythmiaCount = 0
        perfusionIndex = 0.0
        qualityScoreAvg = 0.0
        lastRawValue = 0
        
        // No reiniciar calibración para mantener adaptación al dispositivo
        isCalibrating = true
    }
    
    /**
     * Reinicia solo los filtros pero mantiene calibración
     */
    private fun resetFilters() {
        kalmanFilter.reset()
        sgFilter.reset()
        trendAnalyzer.reset()
        signalAnalyzer.reset()
        
        signalBuffer.clear()
        timestampBuffer.clear()
        rrIntervals.clear()
        peakTimes.clear()
    }
    
    /**
     * Maneja errores del procesador
     */
    private fun handleError(code: String, message: String) {
        val error = ProcessingError(
            code = code,
            message = message,
            timestamp = System.currentTimeMillis()
        )
        onError?.invoke(error)
    }
    
    /**
     * Clase interna de configuración
     */
    private data class SignalProcessorConfig(
        val BUFFER_SIZE: Int,
        val MIN_RED_THRESHOLD: Double,
        val MAX_RED_THRESHOLD: Double,
        val STABILITY_WINDOW: Int,
        val MIN_STABILITY_COUNT: Int,
        val HYSTERESIS: Double,
        val MIN_CONSECUTIVE_DETECTIONS: Int,
        val MAX_CONSECUTIVE_NO_DETECTIONS: Int,
        val QUALITY_LEVELS: Int,
        val QUALITY_HISTORY_SIZE: Int,
        val CALIBRATION_SAMPLES: Int,
        val TEXTURE_GRID_SIZE: Int,
        val ROI_SIZE_FACTOR: Double
    )
}