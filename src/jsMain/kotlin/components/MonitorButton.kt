package components

import androidx.compose.runtime.Composable
import org.jetbrains.compose.web.dom.Button
import org.jetbrains.compose.web.dom.Text

@Composable
fun MonitorButton(text: String, onClick: () -> Unit, classes: String = "") {
    Button(attrs = {
        onClick { onClick() }
        classes("px-4", "py-2", "font-bold", "text-white", "rounded-lg", "shadow", classes)
    }) {
        Text(text)
    }
} 