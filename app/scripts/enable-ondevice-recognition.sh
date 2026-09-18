#!/bin/bash
# Script to enable on-device speech recognition (default mode)
# This script:
# 1. Removes RECORD_AUDIO permission from AndroidManifest.xml
# 2. Updates ConfigManager default to use on-device recognition
# 3. Prints instructions for commenting out permission request code

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "Enable On-Device Speech Recognition"
echo "========================================"
echo ""

# Step 1: Remove RECORD_AUDIO permission from manifest
MANIFEST_FILE="$PROJECT_DIR/app/src/main/AndroidManifest.xml"

if grep -q "android.permission.RECORD_AUDIO" "$MANIFEST_FILE"; then
    echo "Removing RECORD_AUDIO permission from manifest..."
    sed -i.bak '/android.permission.RECORD_AUDIO/d' "$MANIFEST_FILE"
    echo "✓ Removed RECORD_AUDIO permission from manifest"
else
    echo "✓ RECORD_AUDIO permission not in manifest (already removed)"
fi

# Step 2: Update ConfigManager default
echo ""
echo "To change default to on-device recognition, update ConfigManager.kt:"
echo "  Change: get() = sharedPrefs.getBoolean(KEY_USE_ON_DEVICE_SPEECH, false)"
echo "  To:     get() = sharedPrefs.getBoolean(KEY_USE_ON_DEVICE_SPEECH, true)"
echo ""

# Step 3: Print instructions
echo "========================================"
echo "Next Steps: Comment Out Permission Code"
echo "========================================"
echo ""
echo "The permission request code should be commented out in:"
echo ""
echo "1. app/src/main/java/com/androiduse/autopilot/ui/AiInputFragment.kt"
echo "2. app/src/main/java/com/androiduse/autopilot/service/FloatingButtonService.kt"
echo "3. app/src/main/java/com/androiduse/autopilot/ui/SettingsActivity.kt"
echo "4. app/src/main/java/com/androiduse/autopilot/onboarding/fragments/RecognitionGuideFragment.kt"
echo "5. app/src/main/java/com/androiduse/autopilot/onboarding/OnboardingViewModel.kt"
echo ""
echo "See SPEECH_RECOGNITION.md for detailed instructions."
echo ""
