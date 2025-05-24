package pages

import androidx.compose.runtime.Composable
import org.jetbrains.compose.web.dom.*
import routing.Screen
import routing.navigateTo

@Composable
fun NotFoundPage() {
    Div(attrs = { classes("min-h-screen", "flex", "items-center", "justify-center", "bg-gray-100") }) {
        Div(attrs = { classes("text-center") }) {
            H1(attrs = { classes("text-4xl", "font-bold", "mb-4") }) {
                Text("404")
            }
            P(attrs = { classes("text-xl", "text-gray-600", "mb-4") }) {
                Text("Oops! Page not found")
            }
            Button(attrs = { 
                classes("text-blue-500", "hover:text-blue-700", "underline", "bg-transparent", "border-none", "p-0", "cursor-pointer", "font-medium")
                onClick { navigateTo(Screen.Index) }
            }) {
                Text("Return to Home")
            }
        }
    }
    // TODO: Implement logging of location.pathname similar to useEffect in React
}

// Need to import navigateTo and Screen, or pass navigateTo as a parameter
// For simplicity, assuming navigateTo and Screen are accessible globally or in a common file
// If not, they would need to be imported from where they are defined (e.g., main.MainKt if in Main.kt directly)
// or passed as parameters: fun NotFoundPage(navigateTo: (Screen) -> Unit)
// For now, I will assume they can be made accessible from Main.kt, e.g. by moving routing to a separate file that can be imported.
// For this edit, I will add placeholder imports that would be resolved once routing is in its own file.
// import com.example.project.routing.navigateTo
// import com.example.project.routing.Screen
// If navigateTo and Screen are in the default package of Main.kt (not ideal but works for now)
// you might not need explicit imports if this file is also in a package that can see it or by making them top-level accessible.
// For the routing to work with the A tag, it should change window.location.hash.
// The A(href="#") will prevent default navigation, and onClick will handle the hash change.
// Or, more simply, the A tag's href can directly set the hash for navigation if not using a programmatic navigateTo here.
// Let's make the A tag's href directly point to the Index hash for simplicity in this component.
// A(href = "#/", ...) is simpler than A(href = "#", onClick = { navigateTo(Screen.Index) })
// if navigateTo isn't easily available or if we want to keep this component simpler.
// The href for the A tag in NotFoundPage should point to the root hash for the IndexPage.
// Original A(href = "/") would cause a full page reload. For hash routing, it needs to be A(href = "#/"). 