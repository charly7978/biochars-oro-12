plugins {
    id("com.android.application")
    kotlin("android")
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
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
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