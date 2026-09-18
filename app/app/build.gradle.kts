import java.util.Properties
import java.io.FileInputStream

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.androiduse.autopilot"
    compileSdk = 36

    defaultConfig {
        manifestPlaceholders += mapOf()
        applicationId = "com.androiduse.autopilot"
        minSdk = 30
        targetSdk = 36
        versionCode = project.property("versionCode").toString().toInt()
        versionName = project.property("versionName").toString()

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // AppAuth redirect scheme for OAuth
        manifestPlaceholders["appAuthRedirectScheme"] = "androiduse.autopilot"
    }

    // Signing configuration for release builds
    signingConfigs {
        create("release") {
            // CI/CD: Use environment variables
            // Local: Use keystore.properties file
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            if (keystorePropertiesFile.exists()) {
                // Local development signing
                val keystoreProperties = Properties()
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))

                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            } else {
                // CI/CD signing using environment variables
                storeFile = System.getenv("KEYSTORE_FILE")?.let { file(it) }
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    buildTypes {
        debug {
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            versionNameSuffix = "-dev"

            buildConfigField("String", "DEFAULT_AUTH_URL", "\"http://192.168.0.15:3000\"")
            buildConfigField("String", "DEFAULT_WS_HOST", "\"192.168.0.15\"")
            buildConfigField("int", "DEFAULT_WS_PORT", "8000")
            buildConfigField("String", "DEFAULT_ENVIRONMENT", "\"dev\"")
            buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"664067061126-4ok2nv4aht0pko4luslt113pheg1gm2q.apps.googleusercontent.com\"")
            buildConfigField("String", "GOOGLE_OAUTH_CLIENT_ID", "\"664067061126-kngpa2jn0u18t4b8g2kov354ca8bbikm.apps.googleusercontent.com\"")
            buildConfigField("String", "GITHUB_CLIENT_ID", "\"YOUR_GITHUB_CLIENT_ID\"")
            buildConfigField("String", "TWITTER_CLIENT_ID", "\"YOUR_TWITTER_CLIENT_ID\"")
        }
        create("staging") {
            dimension = "environment"
            versionNameSuffix = "-staging"

            buildConfigField("String", "DEFAULT_AUTH_URL", "\"https://dev.androiduse.com\"")
            buildConfigField("String", "DEFAULT_WS_HOST", "\"agent.dev.androiduse.com\"")
            buildConfigField("int", "DEFAULT_WS_PORT", "443")
            buildConfigField("String", "DEFAULT_ENVIRONMENT", "\"staging\"")
            buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"664067061126-4ok2nv4aht0pko4luslt113pheg1gm2q.apps.googleusercontent.com\"")
            buildConfigField("String", "GOOGLE_OAUTH_CLIENT_ID", "\"664067061126-kngpa2jn0u18t4b8g2kov354ca8bbikm.apps.googleusercontent.com\"")
            buildConfigField("String", "GITHUB_CLIENT_ID", "\"YOUR_GITHUB_CLIENT_ID\"")
            buildConfigField("String", "TWITTER_CLIENT_ID", "\"YOUR_TWITTER_CLIENT_ID\"")
        }
        create("production") {
            dimension = "environment"

            buildConfigField("String", "DEFAULT_AUTH_URL", "\"https://androiduse.com\"")
            buildConfigField("String", "DEFAULT_WS_HOST", "\"agent.androiduse.com\"")
            buildConfigField("int", "DEFAULT_WS_PORT", "443")
            buildConfigField("String", "DEFAULT_ENVIRONMENT", "\"production\"")
            buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"664067061126-pojvend4fmfv5mbd6hpvinksdnon6qa6.apps.googleusercontent.com\"")
            buildConfigField("String", "GOOGLE_OAUTH_CLIENT_ID", "\"664067061126-0gfctnsilrbg0n7g2mj2u20mfu08op6a.apps.googleusercontent.com\"")
            buildConfigField("String", "GITHUB_CLIENT_ID", "\"YOUR_GITHUB_CLIENT_ID\"")
            buildConfigField("String", "TWITTER_CLIENT_ID", "\"YOUR_TWITTER_CLIENT_ID\"")
        }
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {

    // Core Android
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)

    // Networking
    implementation(libs.java.websocket)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp.logging.interceptor)

    // Authentication - Credential Manager (Google Sign In & Passkeys)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services)
    implementation(libs.google.identity.googleid)
    implementation(libs.google.play.services.auth) // Legacy fallback for universal device support

    // Authentication - OAuth (GitHub/Twitter via AppAuth)
    implementation(libs.appauth)

    // Security - Encrypted SharedPreferences
    implementation(libs.androidx.security.crypto)

    // Lifecycle & ViewModel
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.androidx.swiperefreshlayout)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.analytics)

    // Payments
    implementation(libs.stripe.android)
    implementation(libs.stripe.financial.connections)

    // Analytics
    implementation(libs.posthog.android)

    // Google Play In-App Review
    implementation(libs.google.play.review)
    implementation(libs.google.play.review.ktx)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.json)
    testImplementation(libs.mockk)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
