package com.biocharsproject.androidapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.biocharsproject.shared.modules.PPGSignalProcessor
import com.biocharsproject.shared.types.CommonImageDataWrapper
import com.biocharsproject.shared.types.ProcessedSignal
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.nio.ByteBuffer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private lateinit var cameraExecutor: ExecutorService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()
        setContent {
            MyApplicationTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    CameraMeasurementScreen()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}

@Composable
fun CameraMeasurementScreen() {
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

    var isMeasuring by remember { mutableStateOf(false) }
    var heartRate by remember { mutableStateOf<Double?>(null) }
    var lastSignal by remember { mutableStateOf<ProcessedSignal?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Instancia del procesador de señal
    val signalProcessor = remember {
        PPGSignalProcessor(
            onSignalReady = { signal ->
                lastSignal = signal
                // Aquí podrías calcular heartRate a partir de la señal procesada
                // heartRate = ...
            },
            onError = { error ->
                errorMessage = error.message
            }
        )
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (hasCameraPermission) {
            CameraPreview(
                isMeasuring = isMeasuring,
                onFrame = { imageData ->
                    coroutineScope.launch(Dispatchers.Default) {
                        signalProcessor.processFrame(imageData)
                    }
                }
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = {
                isMeasuring = !isMeasuring
                if (isMeasuring) {
                    coroutineScope.launch { signalProcessor.initialize() }
                    signalProcessor.start()
                } else {
                    signalProcessor.stop()
                }
            }) {
                Text(if (isMeasuring) "Detener medición" else "Iniciar medición")
            }
            Spacer(modifier = Modifier.height(16.dp))
            if (lastSignal != null) {
                Text("Valor filtrado: ${lastSignal!!.filteredValue}")
                Text("Calidad: ${lastSignal!!.quality}")
                Text("Detección de dedo: ${if (lastSignal!!.fingerDetected) "Sí" else "No"}")
                if (lastSignal!!.perfusionIndex != null) {
                    Text("Índice de perfusión: ${lastSignal!!.perfusionIndex}")
                }
            }
            if (errorMessage != null) {
                Text("Error: $errorMessage")
            }
        } else {
            Text("Se requiere permiso de cámara para medir.")
        }
    }
}

@Composable
fun CameraPreview(
    isMeasuring: Boolean,
    onFrame: (CommonImageDataWrapper) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember { PreviewView(context) }
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }

    AndroidView(factory = { previewView }, modifier = Modifier
        .fillMaxWidth()
        .height(400.dp))

    LaunchedEffect(isMeasuring) {
        if (isMeasuring) {
            val cameraProvider = cameraProviderFuture.get()
            val preview = androidx.camera.core.Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }
            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor, { imageProxy ->
                        val buffer = imageProxy.planes[0].buffer
                        val bytes = ByteArray(buffer.remaining())
                        buffer.get(bytes)
                        val width = imageProxy.width
                        val height = imageProxy.height
                        val imageData = CommonImageDataWrapper(
                            pixelData = bytes,
                            width = width,
                            height = height,
                            format = "YUV_420_888"
                        )
                        onFrame(imageData)
                        imageProxy.close()
                    })
                }
            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalyzer
                )
            } catch (exc: Exception) {
                Log.e("CameraPreview", "Error al iniciar la cámara", exc)
            }
        } else {
            val cameraProvider = cameraProviderFuture.get()
            cameraProvider.unbindAll()
        }
    }
}

@Composable
fun GreetingText(message: String, modifier: Modifier = Modifier) {
    Text(
        text = message,
        modifier = modifier
    )
}

@Preview(showBackground = true)
@Composable
fun DefaultPreview() {
    MyApplicationTheme {
        GreetingText("Preview Android")
    }
}

// Definición del tema de la aplicación (puedes moverlo a un archivo Theme.kt)
@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = MaterialTheme.colorScheme, // Usa el esquema de color por defecto o personalízalo
        typography = MaterialTheme.typography, // Usa la tipografía por defecto o personalízala
        shapes = MaterialTheme.shapes, // Usa las formas por defecto o personalízalas
        content = content
    )
} 