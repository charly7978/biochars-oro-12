package com.biocharsproject.androidapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
// import com.biocharsproject.shared.Greeting // Ejemplo de cómo usar shared code

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyApplicationTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    // val greeting = Greeting().greet()
                    // GreetingText(message = greeting)
                    GreetingText(message = "Hello from Android App!")
                }
            }
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