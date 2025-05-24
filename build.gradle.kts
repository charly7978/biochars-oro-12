plugins {
    id("com.android.application") version "7.4.2" apply false
    kotlin("android") version "1.9.22" apply false
}

buildscript {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

group = "com.biocharsproject"
version = "1.0-SNAPSHOT"

@OptIn(org.jetbrains.kotlin.gradle.targets.js.dsl.ExperimentalDistributionDsl::class)
kotlin {
    js(IR) {
        browser {
            commonWebpackConfig {
                outputFileName = "biochars-oro-29.js"
            }
            distribution {
                directory = File("${layout.buildDirectory.get()}", "dist/js")
            }
        }
        binaries.executable()
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