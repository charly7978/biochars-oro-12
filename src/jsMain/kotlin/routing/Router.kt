package routing

import androidx.compose.runtime.*
import kotlinx.browser.window

sealed class Screen {
    object Index : Screen()
    object Auth : Screen()
    object NotFound : Screen()
}

@Composable
fun getCurrentScreen(): Screen {
    var currentHash by remember { mutableStateOf(window.location.hash) }

    // A more robust way to listen to hash changes in Compose for Web:
    DisposableEffect(Unit) {
        val onHashChange = { currentHash = window.location.hash }
        window.addEventListener("hashchange", onHashChange)
        onDispose {
            window.removeEventListener("hashchange", onHashChange)
        }
    }

    return when (currentHash.removePrefix("#")) {
        "/" -> Screen.Index
        "" -> Screen.Index
        "/auth" -> Screen.Auth
        // Consider a specific hash for NotFound or rely on default
        "/404" -> Screen.NotFound 
        else -> Screen.NotFound // Default to NotFound for any other hash
    }
}

fun navigateTo(screen: Screen) {
    val newHash = when (screen) {
        Screen.Index -> "/"
        Screen.Auth -> "/auth"
        Screen.NotFound -> "/404" // Navigate to a specific hash for NotFound
    }
    if (window.location.hash.removePrefix("#") != newHash) {
        window.location.hash = newHash
    }
} 