# Speech Recognition Configuration

AndroidUse supports two modes of speech recognition:

## 1. On-Device Recognition (Default) ✅
- **Requires**: No permissions needed
- **Pros**: No microphone permission required, works offline, better privacy
- **Cons**: Only available on Android 12+ (API 31+), requires device support
- **API Level**: API 31+ (Android 12+)
- **Default**: Enabled by default for privacy and no permission requirements

## 2. Cloud-Based Recognition (Optional)
- **Requires**: `RECORD_AUDIO` permission (must be added to manifest)
- **Pros**: Works on all Android versions, generally more accurate
- **Cons**: Requires microphone permission, needs internet connection, privacy concerns
- **API Level**: All supported versions (API 30+)
- **Note**: RECORD_AUDIO permission removed from manifest by default

## How to Toggle

### Option 1: Programmatically (Recommended for Developers)

```kotlin
// In your Application class or initialization code
val configManager = ConfigManager.getInstance(context)

// Enable on-device recognition (default, no permission required)
configManager.useOnDeviceSpeechRecognition = true

// Disable on-device recognition (use cloud-based, requires RECORD_AUDIO permission in manifest)
configManager.useOnDeviceSpeechRecognition = false
```

**Important**: To use cloud-based recognition, you must first add the RECORD_AUDIO permission to AndroidManifest.xml:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### Option 2: Via ADB

```bash
# Enable on-device recognition
adb shell "content insert --uri content://com.androiduse.autopilot/config \
  --bind use_on_device_speech:b:true"

# Disable on-device recognition (use cloud-based)
adb shell "content insert --uri content://com.androiduse.autopilot/config \
  --bind use_on_device_speech:b:false"
```

### Option 3: In Settings Activity

You can add a toggle in `SettingsActivity.kt`:

```kotlin
private fun setupSpeechRecognitionToggle() {
    // Add this to your layout: androidx.appcompat.widget.SwitchCompat
    binding.toggleOnDeviceSpeech.isChecked = configManager.useOnDeviceSpeechRecognition

    binding.toggleOnDeviceSpeech.setOnCheckedChangeListener { _, isChecked ->
        configManager.useOnDeviceSpeechRecognition = isChecked
        Toast.makeText(
            this,
            if (isChecked) "Using on-device recognition" else "Using cloud recognition",
            Toast.LENGTH_SHORT
        ).show()
    }
}
```

## Feature Detection

The app automatically detects if on-device recognition is available:

```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    if (SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
        // On-device recognition is available
    } else {
        // Falls back to cloud-based recognition
    }
}
```

## Implementation Details

### Files Modified
- `ConfigManager.kt` - Added `useOnDeviceSpeechRecognition` setting
- `AiInputFragment.kt` - Updated to support both modes
- `FloatingButtonService.kt` - Updated to support both modes
- `AndroidManifest.xml` - Documented permission requirement

### How It Works

1. When the app initializes speech recognition, it checks `configManager.useOnDeviceSpeechRecognition`
2. If enabled and supported (API 31+), creates `SpeechRecognizer.createOnDeviceSpeechRecognizer()`
3. If disabled or unsupported, creates `SpeechRecognizer.createSpeechRecognizer()` (cloud-based)
4. The `RECORD_AUDIO` permission is only requested at runtime when cloud-based mode is active

### Default Behavior

- **Default**: On-device recognition (`useOnDeviceSpeechRecognition = true`)
- **Reason**: Better privacy, no permission requirements, works offline
- **Fallback**: Automatically falls back to cloud-based if on-device is unavailable (requires adding RECORD_AUDIO permission to manifest)

## Testing

### Test On-Device Recognition
```bash
# Enable on-device mode
adb shell am start -n com.androiduse.autopilot/.ui.SettingsActivity

# Test voice input (requires API 31+ and device support)
# Open the floating button and tap the microphone icon
```

### Test Cloud-Based Recognition
```bash
# Disable on-device mode (default)
# Grant microphone permission
adb shell pm grant com.androiduse.autopilot android.permission.RECORD_AUDIO

# Test voice input
# Open the floating button and tap the microphone icon
```

## Troubleshooting

### On-Device Recognition Not Working
- Check device API level: `adb shell getprop ro.build.version.sdk` (must be 31+)
- Check logcat: `adb logcat | grep "SpeechRecognition"`
- The app will automatically fall back to cloud-based if on-device is unavailable

### Permission Denied Error
- Only occurs in cloud-based mode
- Grant permission: Settings → Apps → AndroidUse → Permissions → Microphone
- Or disable cloud mode and use on-device recognition

## Benefits of On-Device Recognition

1. **Privacy**: Audio never leaves the device
2. **No Permission Prompt**: Better user experience, no scary permission dialogs
3. **Offline**: Works without internet connection
4. **Lower Latency**: No network round-trip

## Limitations of On-Device Recognition

1. **API Level**: Requires Android 12+ (API 31+)
2. **Device Support**: Not all devices have on-device speech models installed
3. **Accuracy**: May be slightly less accurate than cloud-based for some languages
4. **Language Support**: Limited language support compared to cloud

## Recommended Usage

- **Default (Recommended)**: Use on-device for privacy and no permissions
- **Development/Testing**: Use on-device to avoid permission prompts
- **Production (Privacy-focused)**: Use on-device for better privacy (default)
- **Production (Accuracy-focused)**: Add RECORD_AUDIO to manifest and use cloud-based for better accuracy
- **Wide Compatibility**: Add RECORD_AUDIO to manifest and use cloud-based to support older devices

## Switching to Cloud-Based Recognition

All permission request code has been **commented out** for easy switching. To enable cloud-based recognition:

### Quick Start: Use Helper Script

```bash
cd androiduse-app
./scripts/enable-cloud-recognition.sh
```

This script adds RECORD_AUDIO to the manifest and prints instructions for uncommenting code.

### Manual Steps:

### Step 1: Add Permission to Manifest

Add to `app/src/main/AndroidManifest.xml`:
```xml
<!-- Add after other permissions -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### Step 2: Disable On-Device Recognition

```kotlin
val configManager = ConfigManager.getInstance(context)
configManager.useOnDeviceSpeechRecognition = false
```

### Step 3: Uncomment Permission Request Code

Search for "COMMENTED OUT" in the following files and uncomment the marked sections:

**1. AiInputFragment.kt** (line ~230):
```kotlin
// Uncomment this block:
/*
if (!useOnDeviceRecognition) {
    if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED) {
        ActivityCompat.requestPermissions(
            requireActivity(),
            arrayOf(Manifest.permission.RECORD_AUDIO),
            REQUEST_CODE_AUDIO_PERMISSION
        )
        return
    }
}
*/
```

**2. FloatingButtonService.kt** (line ~1010):
```kotlin
// Uncomment the permission check:
/*
return ContextCompat.checkSelfPermission(
    this,
    Manifest.permission.RECORD_AUDIO
) == PackageManager.PERMISSION_GRANTED
*/
```

**3. SettingsActivity.kt** (line ~335, ~345):
```kotlin
// Uncomment checkAudioPermission:
/*
return ContextCompat.checkSelfPermission(
    this,
    Manifest.permission.RECORD_AUDIO
) == PackageManager.PERMISSION_GRANTED
*/

// Uncomment requestAudioPermission:
/*
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
    if (!checkAudioPermission()) {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECORD_AUDIO),
            REQUEST_CODE_AUDIO_PERMISSION
        )
    }
}
*/
```

**4. RecognitionGuideFragment.kt** (line ~60, ~75, ~100):
```kotlin
// Uncomment permission check in onResume:
/*
if (viewModel.state.value.recognitionGranted) {
    viewModel.navigateNext()
}
*/

// Uncomment requestRecognitionPermission() call in setupUI:
// requestRecognitionPermission()

// Uncomment full permission request logic in requestRecognitionPermission()
```

**5. OnboardingViewModel.kt** (line ~92):
```kotlin
// Uncomment permission check:
/*
val granted = ContextCompat.checkSelfPermission(
    context,
    Manifest.permission.RECORD_AUDIO
) == PackageManager.PERMISSION_GRANTED
*/
```

### Quick Search Command

Find all commented sections:
```bash
cd app/src/main/java
grep -r "COMMENTED OUT" --include="*.kt" -l
```

### Reverting to On-Device Recognition

To switch back to on-device recognition:

```bash
cd androiduse-app
./scripts/enable-ondevice-recognition.sh
```

This removes RECORD_AUDIO from manifest and prints instructions for commenting the code back.
