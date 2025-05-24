package components

import androidx.compose.runtime.*
import kotlinx.browser.window
import kotlinx.coroutines.launch
import org.jetbrains.compose.web.dom.Video // Updated: Use Video element from Compose HTML DSL
import org.w3c.dom.HTMLVideoElement
import org.w3c.dom.mediacapture.MediaStream
import org.w3c.dom.mediacapture.MediaStreamConstraints

@Composable
fun CameraViewComposable(
    isMonitoring: Boolean,
    onStreamReady: (MediaStream) -> Unit,
    // Props adicionales del original: isFingerDetected, signalQuality (para overlays)
    // isFingerDetected: Boolean?,
    // signalQuality: Int
) {
    val videoElementRef = remember { mutableStateOf<HTMLVideoElement?>(null) }
    val currentStream = remember { mutableStateOf<MediaStream?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(isMonitoring) {
        if (isMonitoring) {
            if (currentStream.value == null) { // Solo obtener nuevo stream si no hay uno activo
                scope.launch {
                    try {
                        val constraints = MediaStreamConstraints(video = js("{facingMode: \"user\"}"), audio = false) // js object for constraints
                        val stream = window.navigator.mediaDevices.getUserMedia(constraints).await()
                        currentStream.value = stream
                        videoElementRef.value?.srcObject = stream
                        onStreamReady(stream)
                        println("Camera stream obtained and ready.")
                    } catch (e: dynamic) {
                        println("Error getting media stream: ${e.message}")
                        // TODO: Mostrar error al usuario
                    }
                }
            }
        } else {
            currentStream.value?.getTracks()?.forEach { track ->
                track.stop()
            }
            currentStream.value = null
            videoElementRef.value?.srcObject = null // Limpiar el srcObject del video
            println("Camera stream stopped.")
        }
    }

    // Cleanup when the composable is disposed
    DisposableEffect(Unit) {
        onDispose {
            currentStream.value?.getTracks()?.forEach { track ->
                track.stop()
            }
            println("CameraViewComposable disposed, stream stopped.")
        }
    }

    Video(attrs = {
        classes("w-full", "h-full", "object-cover") // Clases para llenar el contenedor
        applyAttrs { // Necesario para acceder al elemento HTML subyacente
            this.element?.let { el ->
                val htmlEl = el as HTMLVideoElement
                htmlEl.autoplay = true
                htmlEl.playsInline = true // Importante para iOS
                htmlEl.muted = true // Generalmente necesario para autoplay
                videoElementRef.value = htmlEl
                // Si ya hay un stream cuando el elemento se crea/recompone:
                currentStream.value?.let { htmlEl.srcObject = it }
            }
        }
    })

    // TODO: Aquí se podrían añadir los overlays que estaban en el CameraView original
    // como el indicador de calidad de señal o detección de dedo, si se pasan como props.
    // Ejemplo:
    // Div(attrs={ classes("absolute", "top-2", "left-2", "text-white", "bg-black/50", "p-1")}) {
    //     Text("Quality: $signalQuality")
    // }
} 