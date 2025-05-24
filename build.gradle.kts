plugins {
    kotlin("multiplatform") version "1.9.23" // Or the latest version
    id("org.jetbrains.compose") version "1.6.2" // Or the latest version
}

group = "com.example"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
    maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    google()
}

kotlin {
    js(IR) {
        browser {
            commonWebpackConfig {
                outputFileName = "output.js"
            }
        }
        binaries.executable()
    }
    sourceSets {
        val jsMain by getting {
            dependencies {
                implementation(kotlin("stdlib-js"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3") // Or latest
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3") // Or latest
                implementation(compose.web.core)
                implementation(compose.web.widgets) // For basic HTML elements DSL
                // For DOM manipulation if needed directly, though Compose abstracts much of this
                implementation("org.jetbrains.kotlin-wrappers:kotlin-browser:1.0.1-pre.724") // Or latest
            }
        }
    }
}

compose.experimental {
    web.application {}
} 