import androidx.compose.runtime.Composable
import org.jetbrains.compose.web.renderComposable
import pages.AuthPage
import pages.IndexPage
import pages.NotFoundPage
import routing.Screen // Import Screen from routing package
import routing.getCurrentScreen // Import getCurrentScreen from routing package
// navigateTo will be used by pages, so they will import it directly from routing
import composables.ToastContainer // Added import

fun main() {
    renderComposable(rootElementId = "root") {
        App()
        ToastContainer() // Added ToastContainer
    }
}

@Composable
fun App() {
    val currentScreen = getCurrentScreen()

    when (currentScreen) {
        is Screen.Index -> IndexPage()
        is Screen.Auth -> AuthPage()
        is Screen.NotFound -> NotFoundPage()
    }
}

// Removed Screen, getCurrentScreen, navigateTo definitions from here 