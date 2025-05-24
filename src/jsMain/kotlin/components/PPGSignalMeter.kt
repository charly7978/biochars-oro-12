package components

import androidx.compose.runtime.Composable
import org.jetbrains.compose.web.css.*
import org.jetbrains.compose.web.dom.*
// import pages.ArrhythmiaData // Remove old import
import types.ArrhythmiaData // Add new import

@Composable
fun PPGSignalMeter(
    quality: Int,
    ppgValue: Float,
    isFingerDetected: Boolean,
    arrhythmiaStatus: String,
    rawArrhythmiaData: ArrhythmiaData?,
    preserveResults: Boolean, // Not directly used in this placeholder, but available
    // Callbacks - these would typically trigger actions in the parent (IndexPage)
    // For this placeholder, we'll just log or show simple text
    onStartMeasurement: () -> Unit, 
    onReset: () -> Unit
) {
    Div(attrs = {
        classes("p-4", "bg-gray-800", "rounded-lg", "shadow-xl", "flex", "flex-col", "items-center", "justify-center", "h-full", "text-white")
        style { minHeight(200.px) } // Give it some default size
    }) {
        // Quality Bar
        Div(attrs = { classes("w-full", "mb-3") }) {
            Span(attrs={classes("text-sm", "text-gray-400")}) { Text("Calidad PPG: $quality%") }
            Div(attrs = { 
                classes("h-3", "bg-gray-600", "rounded-full", "overflow-hidden", "mt-1")
                style { width(100.percent) }
            }) {
                Div(attrs = { 
                    style {
                        width(quality.percent) 
                        height(100.percent)
                        backgroundColor(when {
                            quality > 70 -> Color.green
                            quality > 40 -> Color.orange
                            else -> Color.red
                        })
                        transition("width", 300.ms)
                    }
                })
            }
        }

        // Raw PPG Value (example display)
        Span(attrs={classes("text-2xl", "font-mono", "my-2")}) {
            Text(ppgValue.toString().take(7)) // Display formatted PPG value
        }
        
        // Finger status
        Span(attrs = {
            classes("text-xs", "px-2", "py-1", "rounded-full", "mb-2")
            if (isFingerDetected) classes("bg-green-500/30", "text-green-300")
            else classes("bg-red-500/30", "text-red-300")
        }) {
            Text(if (isFingerDetected) "Dedo Detectado" else "Sin Dedo")
        }

        // Arrhythmia Status
        val arrhythmiaParts = arrhythmiaStatus.split('|')
        val arrhythmiaText = arrhythmiaParts.getOrNull(0) ?: "--"
        val arrhythmiaNum = arrhythmiaParts.getOrNull(1) ?: "0"

        Div(attrs = { classes("text-center", "mb-2") }) {
            Span(attrs = { classes("text-sm", "text-gray-400") }) { Text("Arritmia: ") }
            Span(attrs = { classes("text-sm", if (arrhythmiaText == "ARRITMIA DETECTADA") "text-red-400" else "text-green-400") }) {
                 Text("$arrhythmiaText ($arrhythmiaNum)")
            }
        }
        
        // Raw Arrhythmia Data (example)
        rawArrhythmiaData?.let {
            Div(attrs = { classes("text-xs", "text-gray-500", "mb-3") }) {
                Text("RMSSD: ${it.rmssd.toString().take(4)}, VarRR: ${it.rrVariation.toString().take(4)}")
            }
        }

        // Placeholder for graph or more complex visualization if needed later
        Div(attrs = { classes("w-full", "h-16", "bg-gray-700/50", "rounded", "flex", "items-center", "justify-center", "italic", "text-gray-500") }) {
            Text("Visualización PPG (próximamente)")
        }

        // Example: If finger is not detected and not preserving results, show a message to start measurement.
        // The actual start/reset buttons are in IndexPage, this is just to show prop usage.
        if (!isFingerDetected && !preserveResults) {
            Div(attrs = {classes("mt-4")}) {
                 P(attrs={classes("text-center", "text-sm", "text-gray-400")}) {
                    Text("Coloque el dedo en la cámara y presione INICIAR.")
                }
            }
        }
    }
} 