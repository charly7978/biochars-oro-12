package components

import androidx.compose.runtime.Composable
import org.jetbrains.compose.web.css.*
import org.jetbrains.compose.web.dom.*

@Composable
fun VitalSign(label: String, value: String, unit: String = "", icon: (@Composable () -> Unit)? = null, highlighted: Boolean = false) {
    Div(attrs = {
        classes("vital-sign-item", "p-2", "bg-gray-700", "rounded-lg", "shadow")
        if (highlighted) {
            classes("ring-2", "ring-yellow-400") // Example highlight
        }
    }) {
        if (icon != null) {
            Span(attrs = { style { marginRight(8.px) } }) {
                icon()
            }
        }
        Span(attrs = { classes("text-sm", "text-gray-400") }) { Text(label) }
        Span(attrs = {
            classes("text-lg", "font-bold", "ml-2")
            if (highlighted) classes("text-yellow-300") else classes("text-white")
        }) { Text(value) }
        if (unit.isNotEmpty()) {
            Span(attrs = { classes("text-xs", "ml-1")
                if (highlighted) classes("text-yellow-200") else classes("text-gray-300")
            }) { Text(unit) }
        }
    }
} 