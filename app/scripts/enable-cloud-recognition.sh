#!/bin/bash
# Script to enable cloud-based speech recognition
# This script:
# 1. Adds RECORD_AUDIO permission to AndroidManifest.xml
# 2. Updates ConfigManager default to use cloud-based recognition
# 3. Prints instructions for uncommenting permission request code

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "Enable Cloud-Based Speech Recognition"
echo "========================================"
echo ""

# Step 1: Add RECORD_AUDIO permission to manifest
MANIFEST_FILE="$PROJECT_DIR/app/src/main/AndroidManifest.xml"

if grep -q "android.permission.RECORD_AUDIO" "$MANIFEST_FILE"; then
    echo "✓ RECORD_AUDIO permission already in manifest"
else
    echo "Adding RECORD_AUDIO permission to manifest..."
    # Find the line with INTERNET permission and add RECORD_AUDIO after it
    sed -i.bak '/android.permission.INTERNET/a\
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
' "$MANIFEST_FILE"
    echo "✓ Added RECORD_AUDIO permission to manifest"
fi

# Step 2: Update ConfigManager default
echo ""
echo "To change default to cloud-based recognition, update ConfigManager.kt:"
echo "  Change: get() = sharedPrefs.getBoolean(KEY_USE_ON_DEVICE_SPEECH, true)"
echo "  To:     get() = sharedPrefs.getBoolean(KEY_USE_ON_DEVICE_SPEECH, false)"
echo ""

# Step 3: Print instructions for uncommenting code
echo "========================================"
echo "Next Steps: Uncomment Permission Code"
echo "========================================"
echo ""
echo "Search for 'COMMENTED OUT' in the following files and uncomment the marked sections:"
echo ""
echo "1. app/src/main/java/com/androiduse/autopilot/ui/AiInputFragment.kt"
echo "2. app/src/main/java/com/androiduse/autopilot/service/FloatingButtonService.kt"
echo "3. app/src/main/java/com/androiduse/autopilot/ui/SettingsActivity.kt"
echo "4. app/src/main/java/com/androiduse/autopilot/onboarding/fragments/RecognitionGuideFragment.kt"
echo "5. app/src/main/java/com/androiduse/autopilot/onboarding/OnboardingViewModel.kt"
echo ""
echo "Quick search command:"
echo "  cd app/src/main/java"
echo "  grep -r 'COMMENTED OUT' --include='*.kt' -l"
echo ""
echo "See SPEECH_RECOGNITION.md for detailed instructions."
echo ""
