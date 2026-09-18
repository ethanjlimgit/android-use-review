# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ==================== PostHog SDK ====================
# Keep all PostHog classes to prevent stripping/obfuscation
-keep class com.posthog.** { *; }
-keepclassmembers class com.posthog.** { *; }
-dontwarn com.posthog.**

# Keep PostHog annotations
-keepattributes Signature
-keepattributes *Annotation*

# Keep PostHog model classes for JSON serialization
-keepclassmembers class * {
    @com.posthog.* <fields>;
}

# OkHttp (PostHog dependency)
-dontwarn okhttp3.**
-dontwarn okio.**