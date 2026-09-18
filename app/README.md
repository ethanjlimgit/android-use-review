<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./static/droidrun-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="./static/droidrun.png">
  <img src="./static/droidrun.png"  width="full">
</picture>

[![GitHub stars](https://img.shields.io/github/stars/droidrun/androiduse?style=social)](https://github.com/droidrun/androiduse/stargazers)
[![Discord](https://img.shields.io/discord/1360219330318696488?color=7289DA&label=Discord&logo=discord&logoColor=white)](https://discord.gg/ZZbKEZZkwK)
[![Documentation](https://img.shields.io/badge/Documentation-📕-blue)](https://docs.androiduse.ai)
[![Twitter Follow](https://img.shields.io/twitter/follow/droid_run?style=social)](https://x.com/droid_run)

## 👁️ Overview
AndroidUse is an Android accessibility service that provides real-time visual feedback and data collection for UI elements on the screen. It creates an interactive overlay that highlights clickable, checkable, editable, scrollable, and focusable elements, making it an invaluable tool for UI testing, automation development, and accessibility assessment.

## ✨ Features

### 🔍 Element Detection with Visual Overlay
- Identifies all interactive elements (clickable, checkable, editable, scrollable, and focusable)
- Handles nested elements and scrollable containers
- Assigns unique indices to interactive elements for reference

## 🚀 Usage

### ⚙️ Setup
1. Install the app on your Android device
2. Enable the accessibility service in Android Settings → Accessibility → AndroidUse
3. Grant overlay permission when prompted

### 📡 WebSocket Events

AndroidUse includes a WebSocket server for real-time event streaming (notifications, etc.).

See the [WebSocket Events documentation](docs/websocket-events.md) for setup and usage.

### 💻 ADB Commands

All commands use the ContentProvider authority `content://com.androiduse.autopilot/`.

#### Query Commands (Reading Data)

```bash
# Test connection (ping)
adb shell content query --uri content://com.androiduse.autopilot/ping

# Get app version
adb shell content query --uri content://com.androiduse.autopilot/version

# Get accessibility tree as JSON (visible elements with overlay indices)
adb shell content query --uri content://com.androiduse.autopilot/a11y_tree

# Get full accessibility tree with ALL properties (complete node info)
adb shell content query --uri content://com.androiduse.autopilot/a11y_tree_full

# Get full tree without filtering small elements (< 1% visibility)
adb shell content query --uri 'content://com.androiduse.autopilot/a11y_tree_full?filter=false'

# Get phone state as JSON (current app, focused element, keyboard visibility)
adb shell content query --uri content://com.androiduse.autopilot/phone_state

# Get combined state (accessibility tree + phone state)
adb shell content query --uri content://com.androiduse.autopilot/state

# Get full combined state (full tree + phone state + device context)
adb shell content query --uri content://com.androiduse.autopilot/state_full

# Get full state without filtering
adb shell content query --uri 'content://com.androiduse.autopilot/state_full?filter=false'

# Get list of installed launchable apps
adb shell content query --uri content://com.androiduse.autopilot/packages
```

#### Insert Commands (Actions & Configuration)

```bash
# Keyboard text input (base64 encoded, clears field first by default)
adb shell content insert --uri content://com.androiduse.autopilot/keyboard/input --bind base64_text:s:"SGVsbG8gV29ybGQ="

# Keyboard text input without clearing the field first
adb shell content insert --uri content://com.androiduse.autopilot/keyboard/input --bind base64_text:s:"SGVsbG8=" --bind clear:b:false

# Clear text in focused input field
adb shell content insert --uri content://com.androiduse.autopilot/keyboard/clear

# Send key event via keyboard (e.g., Enter key = 66, Backspace = 67)
adb shell content insert --uri content://com.androiduse.autopilot/keyboard/key --bind key_code:i:66

# Set overlay vertical offset (in pixels)
adb shell content insert --uri content://com.androiduse.autopilot/overlay_offset --bind offset:i:100

# Toggle overlay visibility (show/hide)
adb shell content insert --uri content://com.androiduse.autopilot/overlay_visible --bind visible:b:true
adb shell content insert --uri content://com.androiduse.autopilot/overlay_visible --bind visible:b:false

# Configure REST API socket server port (default: 8080)
adb shell content insert --uri content://com.androiduse.autopilot/socket_port --bind port:i:8090
```

#### Common Key Codes

| Key | Code | Key | Code |
|-----|------|-----|------|
| Enter | 66 | Backspace | 67 |
| Tab | 61 | Escape | 111 |
| Home | 3 | Back | 4 |
| Up | 19 | Down | 20 |
| Left | 21 | Right | 22 |

### 📤 Data Output
Element data is returned in JSON format through the ContentProvider queries. The response includes a status field and the requested data. All responses follow this structure:

```json
{
  "status": "success",
  "data": "..."
}
```

For error responses:
```json
{
  "status": "error", 
  "error": "Error message"
}
```

## 🔧 Technical Details
- Minimum Android API level: 30 (Android 11.0)
- Uses Android Accessibility Service API
- Implements custom drawing overlay using Window Manager
- Supports multi-window environments
- Built with Kotlin

### 🎤 Speech Recognition Configuration

AndroidUse uses **on-device speech recognition by default** for better privacy and no permission requirements.

**On-Device Recognition (Default)** ✅
- No permissions required
- Better privacy (audio never leaves device)
- Works offline
- Requires Android 12+ (API 31+)

**Cloud-Based Recognition (Optional)**
- Requires adding `RECORD_AUDIO` permission to manifest
- Works on all Android versions
- More accurate, better language support

**Switch to Cloud-Based (Optional)**:

All permission request code is **commented out** for easy switching:
```bash
# Use helper script to add RECORD_AUDIO and get instructions
./scripts/enable-cloud-recognition.sh
```

Or manually:
```kotlin
// 1. Add RECORD_AUDIO permission to AndroidManifest.xml
// 2. Uncomment permission request code (search for "COMMENTED OUT")
// 3. Disable on-device mode
SpeechRecognitionConfig.enableCloudRecognition(context)
```

See [SPEECH_RECOGNITION.md](SPEECH_RECOGNITION.md) for detailed documentation.


## 🔄 Continuous Integration

This project uses GitHub Actions for automated building and publishing.

### 🔧 Setup

Install git hooks for auto-tagging:
```bash
./scripts/setup-hooks.sh
```

### 📦 Automated Builds

Every push to the main branch or pull request will trigger the build workflow that:
- Builds the Android app (debug APK for dev flavor)
- Uploads the APK as an artifact in the GitHub Actions run

### 🏷️ Auto-Tagging (Git Hook)

A post-commit hook automatically creates a git tag when version changes:
- Detects `versionCode` or `versionName` changes in `gradle.properties`
- Creates an annotated tag (e.g., `v0.2.2`)
- Reminds you to push the tag

### 📤 Auto-Publishing to Google Play

When a version tag is pushed:
1. Builds signed APKs (staging, production) and AAB
2. Creates a GitHub release with all artifacts
3. Uploads AAB to Google Play **internal** track

See [Google Play Setup Guide](docs/google-play-setup.md) for configuration.

### Version Management

Update versions in `gradle.properties`:
```properties
versionCode=22       # Must increment for each release
versionName=0.2.2    # Semantic version
```

Workflow: Update version → commit → tag created automatically → push with `git push origin main --tags`
