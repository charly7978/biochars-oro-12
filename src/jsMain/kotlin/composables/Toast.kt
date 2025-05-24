package composables

import androidx.compose.runtime.*
import kotlinx.coroutines.delay
import org.jetbrains.compose.web.css.*
import org.jetbrains.compose.web.dom.Div
import org.jetbrains.compose.web.dom.Text


data class ToastMessage(val id: Long, val message: String, val type: ToastType)

enum class ToastType {
    INFO, SUCCESS, WARNING, ERROR
}

object ToastState {
    var messages by mutableStateOf<List<ToastMessage>>(emptyList())
        private set

    fun showToast(message: String, type: ToastType = ToastType.INFO, durationMillis: Long = 3000) {
        val newMessage = ToastMessage(kotlin.js.Date.now().toLong(), message, type)
        messages = messages + newMessage
        kotlinx.browser.window.setTimeout({
            messages = messages.filterNot { it.id == newMessage.id }
        }, durationMillis.toInt())
    }
}

@Composable
fun ToastContainer() {
    val messages = ToastState.messages
    if (messages.isNotEmpty()) {
        Div(attrs = {
            style {
                position(Position.Fixed)
                bottom(20.px)
                left(50.percent)
                transform { translateX((-50).percent) }
                zIndex(1000)
                display(DisplayStyle.Flex)
                flexDirection(FlexDirection.Column)
                alignItems(AlignItems.Center)
            }
        }) {
            messages.forEach { toast ->
                key(toast.id) {
                    Toast(toast)
                }
            }
        }
    }
}

@Composable
private fun Toast(toast: ToastMessage) {
    val backgroundColor = when (toast.type) {
        ToastType.INFO -> Color("#2196F3") // Blue
        ToastType.SUCCESS -> Color("#4CAF50") // Green
        ToastType.WARNING -> Color("#FFC107") // Amber
        ToastType.ERROR -> Color("#F44336") // Red
    }

    Div(attrs = {
        style {
            padding(10.px, 20.px)
            backgroundColor(backgroundColor)
            color(Color.white)
            borderRadius(8.px)
            marginBottom(8.px)
            boxShadow(0.px, 2.px, 5.px, rgba(0,0,0,0.2))
            opacity(1)
            transition("opacity", 300.ms, TransitionTimingFunction.EaseInOut)
        }
    }) {
        Text(toast.message)
    }
} 