plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    alias(libs.plugins.jetbrains.compose) // Para Jetpack Compose UI
}

android {
    namespace = "com.biocharsproject.androidapp"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.biocharsproject.androidapp"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = libs.versions.jetbrainsCompose.get() // Usa la versión de compose del version catalog
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(project(":shared")) // Dependencia del módulo shared

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.compose.bom)) // Importante: BOM de Compose
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.kotlinx.coroutines.android)

    // Test dependencies
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    implementation("androidx.camera:camera-camera2:1.3.0")
    implementation("androidx.camera:camera-lifecycle:1.3.0")
    implementation("androidx.camera:camera-view:1.3.0")
}

// Añadir el BOM de Compose al Version Catalog si no está. (libs.versions.toml)
// [versions]
// compose-bom = "2023.08.00"
// 
// [libraries]
// compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
// compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" } // No version, managed by BOM
// compose-material3 = { group = "androidx.compose.material3", name = "material3" } // No version, managed by BOM
// compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" } // No version, managed by BOM
// compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" } // No version, managed by BOM 