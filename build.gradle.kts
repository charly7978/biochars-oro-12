plugins {
    kotlin("js") version "1.9.22" // Asegúrate de que esta es la versión de Kotlin que quieres usar
}

group = "com.biocharsproject"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
    // Puedes añadir google() si es necesario para alguna dependencia Android específica, aunque para Kotlin/JS puro no suele serlo.
}

kotlin {
    js(IR) {
        browser {
            commonWebpackConfig {
                outputFileName = "biochars-oro-29.js"
                devServer = org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackDevServer(false) // Deshabilitar devServer si no lo necesitas para build puro
            }
            distribution {
                directory = File(project.buildDir, "dist/js")
            }
        }
        binaries.executable() // Esto asegura que se generen los ejecutables JS
    }

    sourceSets {
        val jsMain by getting {
            dependencies {
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core-js:1.7.3")
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.5.0")
                // Para interop con APIs del navegador como `window` y `document`
                implementation(npm("stdlib-js", "^1.0.0")) // O puedes usar las de Kotlin directamente
            }
            kotlin.srcDir("src/jsMain/kotlin")
        }
        val jsTest by getting {
            dependencies {
                implementation(kotlin("test-js"))
            }
            kotlin.srcDir("src/jsTest/kotlin")
        }
    }
}

// Tarea para copiar los recursos HTML/CSS si los tuvieras en src/jsMain/resources
// tasks.register<Copy>("copyJsResources") {
//    from(kotlin.sourceSets.jsMain.get().resources)
//    into("${project.buildDir}/dist/js")
// }

// Asegurar que los recursos se copien antes de ensamblar
// tasks.named("jsProcessResources") {
//    finalizedBy("copyJsResources")
// } 