package components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.biocharsproject.shared.types.ProcessedSignal
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.min
import androidx.compose.web.dom.*
import kotlinx.browser.document
import kotlinx.browser.window
import org.w3c.dom.CanvasRenderingContext2D
import org.w3c.dom.HTMLCanvasElement
import org.w3c.dom.ImageData
import kotlinx.coroutines.*
import kotlin.math.max
import kotlin.js.Date

/**
 * Componente para visualizar la señal PPG y métricas asociadas
 * Este componente replica el comportamiento del medidor de señal PPG de la versión web
 */
@Composable
fun PPGSignalMeter(
    isMonitoring: Boolean,
    onQualityChange: (quality: Double) -> Unit,
    onFingerDetectionChange: (detected: Boolean) -> Unit,
    onPPGSignalData: (data: ProcessedSignal) -> Unit
) {
    val canvasRef = remember { mutableStateOf<HTMLCanvasElement?>(null) }
    val signalProcessor = remember { 
        PPGSignalProcessor(
            onSignalReady = { signal -> 
                onPPGSignalData(signal)
                onQualityChange(signal.quality)
                onFingerDetectionChange(signal.fingerDetected)
            },
            onError = { error ->
                console.error("PPG Signal Error: ${error.code} - ${error.message}")
            }
        )
    }
    val bufferSize = 150
    val signalData = remember { mutableStateListOf<Double>() }
    val lastTimestamp = remember { mutableStateOf(0.0) }

    // Effect to initialize and control signal processor
    LaunchedEffect(isMonitoring) {
        if (isMonitoring) {
            try {
                signalProcessor.initialize()
                signalProcessor.start()
            } catch (e: Exception) {
                console.error("Failed to start signal processor: ${e.message}")
            }
        } else {
            signalProcessor.stop()
        }

        // Cleanup when component is destroyed
        return@LaunchedEffect {
            signalProcessor.stop()
        }
    }

    // Effect to update signal data when new data arrives
    DisposableEffect(Unit) {
        val signalHandler: (ProcessedSignal) -> Unit = { signal ->
            if (signal.timestamp > lastTimestamp.value) {
                if (signalData.size >= bufferSize) {
                    signalData.removeAt(0)
                }
                signalData.add(signal.filteredValue)
                lastTimestamp.value = signal.timestamp
                
                // Redraw the canvas with new data
                canvasRef.value?.let { canvas ->
                    drawPPGSignal(canvas, signalData)
                }
            }
        }
        
        // Register signal handler
        signalProcessor.onSignalReady = signalHandler
        
        onDispose {
            // Cleanup when component is unmounted
            signalProcessor.stop()
        }
    }

    // Canvas element for displaying the PPG signal
    Canvas(
        attrs = {
            id("ppgSignalCanvas")
            style {
                width("100%")
                height("150px")
                background("black")
            }
            ref {
                canvasRef.value = it as HTMLCanvasElement
                it.width = it.clientWidth
                it.height = it.clientHeight
                drawPPGSignal(it, signalData)
            }
        }
    )
}

private fun drawPPGSignal(canvas: HTMLCanvasElement, signalData: List<Double>) {
    val ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    val width = canvas.width.toDouble()
    val height = canvas.height.toDouble()
    
    // Clear canvas
    ctx.clearRect(0.0, 0.0, width, height)
    
    // No data to display
    if (signalData.isEmpty()) return
    
    // Calculate min/max for scaling
    val min = signalData.minOrNull() ?: 0.0
    val max = signalData.maxOrNull() ?: 1.0
    val range = max(max - min, 0.1) // Avoid division by zero
    
    // Draw signal
    ctx.beginPath()
    ctx.strokeStyle = "#00ff00" // Green color for PPG signal
    ctx.lineWidth = 2.0
    
    val stepX = width / (signalData.size - 1).coerceAtLeast(1)
    
    signalData.forEachIndexed { index, value ->
        val x = index * stepX
        // Normalize and invert the y-coordinate (canvas y grows downward)
        val normalizedValue = (value - min) / range
        val y = height - (normalizedValue * height * 0.8 + height * 0.1)
        
        if (index == 0) {
            ctx.moveTo(x, y)
        } else {
            ctx.lineTo(x, y)
        }
    }
    
    ctx.stroke()
    
    // Draw grid lines
    ctx.strokeStyle = "#333333"
    ctx.lineWidth = 0.5
    
    // Horizontal grid lines
    val horizontalLines = 5
    for (i in 0..horizontalLines) {
        val y = height * i / horizontalLines
        ctx.beginPath()
        ctx.moveTo(0.0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
    }
    
    // Vertical grid lines
    val verticalLines = 10
    for (i in 0..verticalLines) {
        val x = width * i / verticalLines
        ctx.beginPath()
        ctx.moveTo(x, 0.0)
        ctx.lineTo(x, height)
        ctx.stroke()
    }
}

// Console logger for debugging in JS
private external object console {
    fun log(message: String)
    fun error(message: String)
}

@Composable
fun PPGSignalMeter(
    signalBuffer: List<Float>,
    heartRate: Int? = null,
    spo2: Int? = null,
    perfusionIndex: Double? = null,
    signalQuality: Double = 0.0,
    isCalibrating: Boolean = false,
    isDetecting: Boolean = false,
    modifier: Modifier = Modifier
) {
    val primaryColor = Color(0xFF00FFB0) // Color verde-azulado característico
    val backgroundColor = Color(0xFF101820) // Fondo oscuro
    val textColor = Color(0xFFF8F9FA) // Texto claro
    
    // Animación de pulso para simular latido cardíaco
    val infiniteTransition = rememberInfiniteTransition()
    val pulseState = infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (heartRate != null && heartRate > 40 && !isCalibrating) 1.2f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (heartRate != null) (60000 / heartRate.coerceAtLeast(40)).coerceAtMost(1500) else 1000,
                easing = EaseInOutQuad
            ),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Box(
        modifier = modifier
            .background(backgroundColor)
            .padding(16.dp)
    ) {
        // Señal PPG (gráfico)
        if (signalBuffer.isNotEmpty()) {
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 64.dp) // Espacio para métricas
            ) {
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
                    // Centrar y aplicar escala al valor con efecto de pulso
                    val y = centerY - (normalizedValue - 0.5f) * scaleY * pulseState.value
                    
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }
                
                // Gradiente para la línea principal
                val gradient = Brush.verticalGradient(
                    colors = listOf(
                        primaryColor.copy(alpha = 0.7f),
                        primaryColor
                    )
                )
                
                // Dibujar línea principal
                drawPath(
                    path = path,
                    brush = gradient,
                    style = Stroke(
                        width = 3.dp.toPx(),
                        cap = StrokeCap.Round,
                        join = StrokeJoin.Round
                    )
                )
                
                // Dibujar resplandor (glow effect) cuando hay ritmo cardíaco
                if (heartRate != null && heartRate > 40 && !isCalibrating) {
                    drawPath(
                        path = path,
                        color = primaryColor.copy(alpha = 0.3f),
                        style = Stroke(
                            width = 8.dp.toPx(),
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )
                    )
                }
                
                // Si está calibrando, mostrar un indicador
                if (isCalibrating) {
                    val text = "Calibrando..."
                    val textSize = 24.sp.toPx()
                    drawContext.canvas.nativeCanvas.drawText(
                        text,
                        size.width / 2 - text.length * textSize / 4,
                        size.height / 2,
                        android.graphics.Paint().apply {
                            color = primaryColor.copy(alpha = 0.8f).toArgb()
                            textSize = 24.sp.toPx()
                            isAntiAlias = true
                        }
                    )
                }
                
                // Si no está detectando, mostrar indicación
                if (!isDetecting && !isCalibrating) {
                    val text = "Coloque su dedo en la cámara"
                    val textSize = 18.sp.toPx()
                    drawContext.canvas.nativeCanvas.drawText(
                        text,
                        size.width / 2 - text.length * textSize / 4,
                        size.height / 2,
                        android.graphics.Paint().apply {
                            color = Color.White.toArgb()
                            this.textSize = textSize
                            isAntiAlias = true
                        }
                    )
                }
            }
        }
        
        // Métricas en la parte inferior
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            // BPM
            MetricDisplay(
                value = heartRate?.toString() ?: "--",
                label = "BPM",
                primaryColor = primaryColor,
                modifier = Modifier.weight(1f)
            )
            
            // SpO2
            MetricDisplay(
                value = spo2?.let { "$it%" } ?: "--",
                label = "SpO2",
                primaryColor = primaryColor,
                modifier = Modifier.weight(1f)
            )
            
            // Perfusión
            MetricDisplay(
                value = perfusionIndex?.let { String.format("%.2f", it) } ?: "--",
                label = "PI",
                primaryColor = primaryColor,
                modifier = Modifier.weight(1f)
            )
            
            // Calidad
            MetricDisplay(
                value = String.format("%.0f%%", signalQuality * 100),
                label = "Calidad",
                primaryColor = primaryColor,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun MetricDisplay(
    value: String,
    label: String,
    primaryColor: Color,
    modifier: Modifier = Modifier
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.padding(horizontal = 4.dp)
    ) {
        Text(
            text = value,
            color = primaryColor,
            fontSize = 18.sp,
            style = MaterialTheme.typography.titleMedium
        )
        Text(
            text = label,
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 12.sp,
            style = MaterialTheme.typography.bodySmall
        )
    }
} 