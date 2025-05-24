package pages

import androidx.compose.runtime.*
import org.jetbrains.compose.web.attributes.InputType
import org.jetbrains.compose.web.dom.*
import routing.Screen // Import Screen from routing package
import routing.navigateTo // Import navigateTo from routing package
// TODO: Import Supabase client when available
// import com.example.supabase.SupabaseClient

@Composable
fun AuthPage() {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var isSignUp by remember { mutableStateOf(false) }

    // TODO: Instantiate Supabase client
    // val supabase = remember { SupabaseClient() }

    fun handleAuth() {
        loading = true
        // TODO: Implement actual Supabase auth logic (signUp/signInWithPassword)
        // This would be a suspend function launched in a CoroutineScope
        // For now, simulate a delay and potential navigation
        kotlinx.coroutines.GlobalScope.launch {
            kotlinx.coroutines.delay(1000) // Simulate network request
            val success = true // Simulate auth success/failure
            if (success) {
                if (!isSignUp) {
                    navigateTo(Screen.Index)
                } else {
                    // Show toast: "Por favor, revisa tu email para confirmar tu cuenta."
                    println("Sign up successful, check email.")
                }
            } else {
                // Show toast: "Error: error.message"
                println("Auth error")
            }
            loading = false
        }
    }

    Div(attrs = { classes("min-h-screen", "bg-gray-900", "flex", "items-center", "justify-center", "p-4") }) {
        Div(attrs = { classes("w-full", "max-w-md", "space-y-8", "bg-gray-800", "p-6", "rounded-lg") }) {
            Div {
                H2(attrs = { classes("text-2xl", "font-bold", "text-center", "text-white") }) {
                    Text(if (isSignUp) "Crear cuenta" else "Iniciar sesión")
                }
            }
            Form(attrs = { 
                classes("space-y-4") 
                onSubmit { evt -> 
                    evt.preventDefault()
                    handleAuth()
                }
            }) {
                Div {
                    Input(type = InputType.Email, value = email, attrs = {
                        classes("w-full", "bg-gray-700", "text-white", "p-2", "rounded", "border", "border-gray-600", "focus:ring-blue-500", "focus:border-blue-500")
                        placeholder("Email")
                        onInput { email = it.value }
                        // TODO: Add 'required' validation or rely on browser for now
                    })
                }
                Div {
                    Input(type = InputType.Password, value = password, attrs = {
                        classes("w-full", "bg-gray-700", "text-white", "p-2", "rounded", "border", "border-gray-600", "focus:ring-blue-500", "focus:border-blue-500")
                        placeholder("Contraseña")
                        onInput { password = it.value }
                        // TODO: Add 'required' validation
                    })
                }
                Button(attrs = {
                    classes("w-full", "text-white", "font-bold", "py-2", "px-4", "rounded")
                    // Dynamic classes for styling based on loading state
                    if (loading) {
                        classes("bg-gray-500", "cursor-not-allowed")
                    } else {
                        classes("bg-blue-600", "hover:bg-blue-700")
                    }
                    attr("type", "submit") // Ensure it's a submit button for the form
                    if (loading) disabled() // Disable button when loading
                }) {
                    Text(if (loading) "Cargando..." else if (isSignUp) "Registrarse" else "Iniciar sesión")
                }
            }
            Div(attrs = { classes("text-center") }) {
                Button(attrs = {
                    classes("text-blue-400", "hover:underline", "bg-transparent", "border-none", "p-0", "cursor-pointer", "font-medium")
                    onClick { isSignUp = !isSignUp }
                }) {
                    Text(if (isSignUp) "¿Ya tienes cuenta? Inicia sesión" else "¿No tienes cuenta? Regístrate")
                }
            }
        }
    }
    // TODO: Implement proper toast notifications
} 