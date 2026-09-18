#!/bin/bash

echo "============================================"
echo "SHA-1 Certificate Fingerprints for AndroidUse"
echo "============================================"
echo ""

# Get debug keystore SHA-1
echo "📱 DEBUG Build SHA-1:"
echo "-------------------------------------------"
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep -A1 "SHA1:" | head -2
echo ""

# Get release keystore SHA-1 (if exists)
echo "🚀 RELEASE Build SHA-1:"
echo "-------------------------------------------"
if [ -f "keystore.properties" ]; then
    STORE_FILE=$(grep "storeFile=" keystore.properties | cut -d'=' -f2)
    STORE_PASSWORD=$(grep "storePassword=" keystore.properties | cut -d'=' -f2)
    KEY_ALIAS=$(grep "keyAlias=" keystore.properties | cut -d'=' -f2)
    KEY_PASSWORD=$(grep "keyPassword=" keystore.properties | cut -d'=' -f2)

    if [ -f "$STORE_FILE" ]; then
        keytool -list -v -keystore "$STORE_FILE" -alias "$KEY_ALIAS" -storepass "$STORE_PASSWORD" -keypass "$KEY_PASSWORD" 2>/dev/null | grep -A1 "SHA1:" | head -2
    else
        echo "⚠️  Release keystore not found at: $STORE_FILE"
    fi
else
    echo "⚠️  keystore.properties not found (release keystore not configured)"
fi
echo ""

echo "============================================"
echo "📋 Next Steps:"
echo "============================================"
echo "1. Copy the SHA1 fingerprint(s) above"
echo "2. Go to Google Cloud Console:"
echo "   https://console.cloud.google.com/apis/credentials"
echo "3. Select your project"
echo "4. Find your OAuth 2.0 Client ID for Android"
echo "5. Add the SHA-1 fingerprint(s)"
echo "6. Save and wait ~5 minutes for changes to propagate"
echo ""
echo "OR use Firebase Console (easier):"
echo "   https://console.firebase.google.com/"
echo "   → Project Settings → General → Add Fingerprint"
echo ""
