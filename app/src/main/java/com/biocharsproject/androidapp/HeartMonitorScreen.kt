package com.biocharsproject.androidapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.biocharsproject.shared.modules.PPGSignalProcessor
import com.biocharsproject.shared.types.CommonImageDataWrapper
import com.biocharsproject.shared.types.ProcessedSignal
import kotlinx.coroutines.*
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun HeartMonitorScreen() {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { granted ->
            hasCameraPermission = granted
        }
    )

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    // Estado de medición
    var isMeasuring by remember { mutableStateOf(false) }
    var lastSignal by remember { mutableStateOf<ProcessedSignal?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    // Valores de medición calculados
    var heartRate by remember { mutableStateOf<Int?>(null) }
    var spo2 by remember { mutableStateOf<Int?>(null) }
    var perfusionIndex by remember { mutableStateOf<Double?>(null) }
    var signalQuality by remember { mutableStateOf(0.0) }
    
    // Buffer para el gráfico
    val bufferSize = 300
    val signalBuffer = remember { mutableStateListOf<Float>() }
    var camera by remember { mutableStateOf<Camera?>(null) }
    
    // Detección de picos para BPM
    val peakDetector = remember { PeakDetector() }
    
    // Calculador de SpO2 (simulado para este ejemplo)
    val spo2Calculator = remember { SpO2Calculator() }

    // Procesador de señal
    val signalProcessor = remember {
        PPGSignalProcessor(
            onSignalReady = { signal ->
                lastSignal = signal
                
                // Actualizar buffer para el gráfico (para visualización)
                val value = signal.filteredValue.toFloat()
                if (signalBuffer.size >= bufferSize) signalBuffer.removeAt(0)
                signalBuffer.add(value)
                
                // Calcular BPM (detección de picos)
                peakDetector.addValue(value.toDouble(), signal.timestamp)
                val detectedBpm = peakDetector.calculateBPM()
                if (detectedBpm > 0) {
                    heartRate = detectedBpm
                }
                
                // Simular cálculo de SpO2 (podría usar signal.perfusionIndex o una implementación real)
                val redIntensity = value
                val irIntensity = value * 0.9f // Simulado - en un dispositivo real tendríamos dos canales
                spo2 = spo2Calculator.calculateSpO2(redIntensity.toDouble(), irIntensity.toDouble())
                
                // Actualizar otros valores
                perfusionIndex = signal.perfusionIndex
                signalQuality = signal.quality
            },
            onError = { error ->
                errorMessage = error.message
            }
        )
    }

    // UI principal
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF101820)), // Fondo oscuro
        contentAlignment = Alignment.Center
    ) {
        if (hasCameraPermission) {
            // Cámara y vista previa
            CameraPreview(
                isMeasuring = isMeasuring,
                onCameraAvailable = { cam -> camera = cam },
                onFrame = { imageData ->
                    coroutineScope.launch(Dispatchers.Default) {
                        // Extraer canal rojo promedio de la imagen YUV
                        val redValue = extractRedChannelFromYUV(imageData)
                        // Crear una imagen procesada con este valor y enviarla al procesador
                        val processedImage = imageData.copy(pixelData = byteArrayOf(redValue.toByte()))
                        signalProcessor.processFrame(processedImage)
                    }
                }
            )
            
            // Gráfico de señal PPG
            SignalGraph(
                signalBuffer = signalBuffer,
                heartBeating = heartRate != null && heartRate!! > 40,
                modifier = Modifier.fillMaxSize().padding(0.dp)
            )
            
            // Indicadores superiores
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(top = 48.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "${heartRate ?: "--"}",
                    color = Color(0xFF00FFB0),
                    style = MaterialTheme.typography.headlineLarge,
                    fontSize = 72.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "BPM",
                    color = Color(0xFF00FFB0),
                    style = MaterialTheme.typography.bodyLarge
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    // SpO2
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${spo2 ?: "--"}%",
                            color = Color(0xFFF8F9FA),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "SpO2",
                            color = Color(0xFFF8F9FA),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    
                    // Perfusión
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = perfusionIndex?.let { String.format("%.2f", it) } ?: "--",
                            color = Color(0xFFF8F9FA),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Perfusión",
                            color = Color(0xFFF8F9FA),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    
                    // Calidad
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = String.format("%.0f%%", signalQuality * 100),
                            color = Color(0xFFF8F9FA),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Calidad",
                            color = Color(0xFFF8F9FA),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
            
            // Mensajes de error
            if (errorMessage != null) {
                Text(
                    text = "Error: $errorMessage",
                    color = Color.Red,
                    modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp)
                )
            }
            
            // Botón de inicio/parada
            FloatingActionButton(
                onClick = {
                    isMeasuring = !isMeasuring
                    if (isMeasuring) {
                        // Iniciar medición y activar flash
                        coroutineScope.launch { 
                            signalProcessor.initialize()
                            setTorchMode(context, true)
                        }
                        signalProcessor.start()
                        peakDetector.reset()
                    } else {
                        // Detener medición y desactivar flash
                        signalProcessor.stop()
                        setTorchMode(context, false)
                    }
                },
                containerColor = if (isMeasuring) Color.Red else Color(0xFF00FFB0),
                modifier = Modifier.align(Alignment.BottomEnd).padding(32.dp)
            ) {
                Text(if (isMeasuring) "Detener" else "Iniciar", color = Color.White)
            }
        } else {
            Text("Se requiere permiso de cámara para medir.", color = Color.White)
        }
    }
    
    // Cleanup al salir
    DisposableEffect(Unit) {
        onDispose {
            setTorchMode(context, false)
        }
    }
}

@Composable
fun SignalGraph(
    signalBuffer: List<Float>, 
    heartBeating: Boolean = false,
    modifier: Modifier = Modifier
) {
    // Animación para el "latido" del corazón
    val infiniteTransition = rememberInfiniteTransition()
    val pulseState = infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (heartBeating) 1.2f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (heartBeating) 500 else 0,
                easing = EaseInOutQuad
            ),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Canvas(modifier = modifier) {
        if (signalBuffer.isEmpty()) return@Canvas
        
        val path = Path()
        val stepX = size.width / (signalBuffer.size - 1).coerceAtLeast(1)
        
        // Normalizar valores para que ocupen el 80% de la altura
        val minY = signalBuffer.minOrNull() ?: 0f
        val maxY = signalBuffer.maxOrNull() ?: 1f
        val rangeY = (maxY - minY).takeIf { it > 0 } ?: 1f
        val scaleY = (size.height * 0.8f) / rangeY
        val centerY = size.height / 2
        
        signalBuffer.forEachIndexed { i, value ->
            val x = i * stepX
            val normalizedValue = (value - minY) / rangeY
            // Centrar y aplicar escala al valor 
            val y = centerY - (normalizedValue - 0.5f) * scaleY * pulseState.value
            
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        
        // Dibujar línea principal gruesa
        drawPath(
            path = path,
            color = Color(0xFF00FFB0),
            style = Stroke(width = 6f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
        
        // Dibujar resplandor (glow effect)
        if (heartBeating) {
            drawPath(
                path = path,
                color = Color(0x6000FFB0), // Mismo color con transparencia
                style = Stroke(width = 12f, cap = StrokeCap.Round, join = StrokeJoin.Round)
            )
        }
    }
}

// Extracción mejorada del canal rojo desde YUV
fun extractRedChannelFromYUV(imageData: CommonImageDataWrapper): Int {
    val pixelData = imageData.pixelData
    val width = imageData.width
    val height = imageData.height
    
    // Si no hay datos o la imagen es demasiado pequeña, devolver 0
    if (pixelData.isEmpty() || width <= 0 || height <= 0) return 0
    
    // Calcular la región de interés (ROI) - centro de la imagen
    val roiSize = minOf(width, height) / 3
    val startX = (width - roiSize) / 2
    val startY = (height - roiSize) / 2
    val endX = startX + roiSize
    val endY = startY + roiSize
    
    var sumY = 0L  // Componente Y (luminancia) - proxy para rojo en PPG
    var pixelCount = 0
    
    // En formato YUV_420_888, Y está en el primer plano (plane 0)
    // Recorrer solo la región central (ROI)
    for (y in startY until endY) {
        for (x in startX until endX) {
            val index = y * width + x
            if (index < pixelData.size) {
                // Extraer componente Y (luminancia) - mejor proxy para rojo en PPG
                sumY += (pixelData[index].toInt() and 0xFF)
                pixelCount++
            }
        }
    }
    
    // Calcular promedio de luminancia en la ROI
    return if (pixelCount > 0) (sumY / pixelCount).toInt() else 0
}

// Control del flash de la cámara
fun setTorchMode(context: Context, enable: Boolean) {
    try {
        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = cameraManager.cameraIdList[0] // Normalmente la cámara trasera
        cameraManager.setTorchMode(cameraId, enable)
    } catch (e: Exception) {
        Log.e("HeartMonitor", "Error controlling flash: ${e.message}")
    }
}

@Composable
fun CameraPreview(
    isMeasuring: Boolean,
    onCameraAvailable: (Camera) -> Unit,
    onFrame: (CommonImageDataWrapper) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember { PreviewView(context) }
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }

    // Vista previa de la cámara invisible (solo queremos los frames, no mostrar video)
    AndroidView(
        factory = { previewView }, 
        modifier = Modifier
            .fillMaxSize()
            .alpha(0f) // Invisible
    )

    LaunchedEffect(isMeasuring) {
        if (isMeasuring) {
            val cameraProvider = cameraProviderFuture.get()
            val preview = androidx.camera.core.Preview.Builder()
                .build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }
                
            // Configuración mejorada del analizador de imágenes
            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor, { imageProxy ->
                        // Procesar frame y cerrarlo rápidamente
                        processImageProxy(imageProxy, onFrame)
                    })
                }
                
            try {
                cameraProvider.unbindAll()
                // Usar cámara trasera (mejor para PPG con flash)
                val camera = cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalyzer
                )
                onCameraAvailable(camera)
            } catch (exc: Exception) {
                Log.e("CameraPreview", "Error al iniciar la cámara", exc)
            }
        } else {
            val cameraProvider = cameraProviderFuture.get()
            cameraProvider.unbindAll()
            onCameraAvailable(null)
        }
    }
}

private fun processImageProxy(imageProxy: ImageProxy, onFrame: (CommonImageDataWrapper) -> Unit) {
    val buffer = imageProxy.planes[0].buffer
    val bytes = ByteArray(buffer.remaining())
    buffer.get(bytes)
    
    val imageData = CommonImageDataWrapper(
        pixelData = bytes,
        width = imageProxy.width,
        height = imageProxy.height,
        format = "YUV_420_888"
    )
    
    onFrame(imageData)
    imageProxy.close()
}

// Detector de picos para cálculo de BPM
class PeakDetector {
    private val valueBuffer = mutableListOf<Double>()
    private val timeBuffer = mutableListOf<Long>()
    private val peakTimes = mutableListOf<Long>()
    private val bufferSize = 150 // Ventana de análisis (~5 segundos a 30fps)
    private val threshold = 0.6 // Umbral para detección de picos (ajustable)
    
    fun addValue(value: Double, timestamp: Long) {
        valueBuffer.add(value)
        timeBuffer.add(timestamp)
        
        if (valueBuffer.size > bufferSize) {
            valueBuffer.removeAt(0)
            timeBuffer.removeAt(0)
        }
        
        // Detectar picos cuando tenemos suficientes valores
        if (valueBuffer.size > 10) {
            detectPeaks()
        }
    }
    
    private fun detectPeaks() {
        val lastIndex = valueBuffer.size - 1
        // Verificar si el punto anterior es un pico
        val checkIndex = lastIndex - 4 // Revisar 4 muestras atrás para evitar falsas detecciones
        
        if (checkIndex > 0 && checkIndex < valueBuffer.size - 5) {
            val center = valueBuffer[checkIndex]
            
            // Un pico debe ser mayor que sus vecinos y superar un umbral
            var isPeak = true
            for (i in -4..4) {
                if (i != 0 && checkIndex + i >= 0 && checkIndex + i < valueBuffer.size) {
                    if (valueBuffer[checkIndex + i] > center) {
                        isPeak = false
                        break
                    }
                }
            }
            
            // Calcular umbral adaptativo basado en valores recientes
            val recentValues = valueBuffer.subList(maxOf(0, valueBuffer.size - 30), valueBuffer.size)
            val maxValue = recentValues.maxOrNull() ?: 0.0
            val minValue = recentValues.minOrNull() ?: 0.0
            val range = maxValue - minValue
            val adaptiveThreshold = minValue + range * threshold
            
            // Registrar tiempo del pico si pasa las condiciones
            if (isPeak && center > adaptiveThreshold) {
                val peakTime = timeBuffer[checkIndex]
                
                // Evitar picos demasiado cercanos (< 300ms = >200bpm)
                if (peakTimes.isEmpty() || peakTime - peakTimes.last() > 300) {
                    peakTimes.add(peakTime)
                    
                    // Mantener solo los últimos 10 picos para cálculo
                    if (peakTimes.size > 10) {
                        peakTimes.removeAt(0)
                    }
                }
            }
        }
    }
    
    fun calculateBPM(): Int {
        // Necesitamos al menos 2 picos para calcular
        if (peakTimes.size < 3) return 0
        
        // Calcular intervalos entre picos
        val intervals = mutableListOf<Long>()
        for (i in 1 until peakTimes.size) {
            intervals.add(peakTimes[i] - peakTimes[i-1])
        }
        
        // Filtrar intervalos anómalos (muy largos o cortos)
        val filteredIntervals = intervals.filter { it > 300 && it < 2000 }
        if (filteredIntervals.isEmpty()) return 0
        
        // Calcular intervalo promedio y convertir a BPM
        val avgInterval = filteredIntervals.average()
        val bpm = (60_000 / avgInterval).roundToInt()
        
        // Limitar a rangos fisiológicos
        return when {
            bpm < 40 -> 0 // Probablemente error
            bpm > 220 -> 0 // Probablemente error
            else -> bpm
        }
    }
    
    fun reset() {
        valueBuffer.clear()
        timeBuffer.clear()
        peakTimes.clear()
    }
}

// Calculador de SpO2 (simulado)
class SpO2Calculator {
    private val redBuffer = mutableListOf<Double>()
    private val irBuffer = mutableListOf<Double>()
    private val bufferSize = 100
    
    fun calculateSpO2(redValue: Double, irValue: Double): Int {
        // Almacenar valores
        redBuffer.add(redValue)
        irBuffer.add(irValue)
        
        if (redBuffer.size > bufferSize) {
            redBuffer.removeAt(0)
            irBuffer.removeAt(0)
        }
        
        // Necesitamos suficientes valores para cálculo
        if (redBuffer.size < 50) return 0
        
        // Calcular ratio R/IR (simulado para este ejemplo)
        // En una implementación real, calcularíamos AC/DC para cada canal
        val redAC = calculateAC(redBuffer)
        val redDC = calculateDC(redBuffer)
        val irAC = calculateAC(irBuffer)
        val irDC = calculateDC(irBuffer)
        
        // Evitar división por cero
        if (redDC == 0.0 || irDC == 0.0 || irAC == 0.0) return 0
        
        // Fórmula R = (AC_red/DC_red)/(AC_ir/DC_ir)
        val ratio = (redAC / redDC) / (irAC / irDC)
        
        // Fórmula empírica para SpO2 = 110 - 25 * R
        // (Esta es una fórmula simplificada, los dispositivos reales usan calibración)
        val spo2 = (110 - 25 * ratio).roundToInt().coerceIn(80, 100)
        
        return spo2
    }
    
    private fun calculateAC(values: List<Double>): Double {
        if (values.size < 2) return 0.0
        
        // Componente AC es la variación pico a pico 
        val min = values.minOrNull() ?: 0.0
        val max = values.maxOrNull() ?: 0.0
        return max - min
    }
    
    private fun calculateDC(values: List<Double>): Double {
        if (values.isEmpty()) return 0.0
        
        // Componente DC es el valor medio
        return values.average()
    }
} 