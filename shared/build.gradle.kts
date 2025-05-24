plugins {
    alias(libs.plugins.jetbrains.kotlin.multiplatform)
    alias(libs.plugins.android.library) // Shared module es una librería Android en este contexto
}

kotlin {
    // Define el target Android
    androidTarget {
        compilations.all { // Configuración para todas las compilaciones (debug, release)
            kotlinOptions { // Opciones del compilador Kotlin
                jvmTarget = "1.8"
            }
        }
    }

    // Define el source set común para toda la lógica de negocio
    sourceSets {
        commonMain.dependencies {
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.datetime)
            // Aquí puedes añadir otras dependencias comunes que no sean específicas de una plataforma
        }
        androidMain.dependencies {
            // Dependencias específicas para Android, si las hubiera (p.ej. para implementaciones 'actual')
            // implementation(libs.kotlinx.coroutines.android) // Ejemplo si usas corutinas en contexto Android
        }
    }
}

android {
    namespace = "com.biocharsproject.shared"
    compileSdk = 34 // Ajusta según tu SDK de Android

    defaultConfig {
        minSdk = 24 // Ajusta según tus requerimientos
    }

    // Necesario para que el módulo KMP se compile como una librería Android
    sourceSets["main"].manifest.srcFile("src/androidMain/AndroidManifest.xml")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
} 