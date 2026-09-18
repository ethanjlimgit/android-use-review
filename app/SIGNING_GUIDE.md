# Android Release Signing Guide

This guide explains how to sign Android release builds locally and in CI/CD.

## Local Development Setup

### 1. Generate Keystore (One-time)

```bash
cd androiduse-app

# Generate a new keystore
keytool -genkey -v -keystore androiduse-release.keystore \
  -alias androiduse \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You'll be prompted for:
- **Keystore password**: Choose a strong password (save it!)
- **Key password**: Choose a strong password (save it!)
- **Distinguished Name (DN)**: Your name, organization, location, etc.

**IMPORTANT:**
- Store the keystore file securely (password manager, encrypted storage)
- NEVER commit the keystore or passwords to Git
- Back up the keystore - if you lose it, you cannot update your app in the Play Store

### 2. Create `keystore.properties`

Copy the example file:
```bash
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties` with your actual values:
```properties
storeFile=androiduse-release.keystore
storePassword=YOUR_ACTUAL_KEYSTORE_PASSWORD
keyAlias=androiduse
keyPassword=YOUR_ACTUAL_KEY_PASSWORD
```

### 3. Build Signed Release

```bash
# Build staging release
./gradlew assembleStagingRelease

# Build production release
./gradlew assembleProductionRelease

# Install staging release on device
./gradlew installStagingRelease
```

Signed APKs will be in:
- `app/build/outputs/apk/staging/release/app-staging-release.apk`
- `app/build/outputs/apk/production/release/app-production-release.apk`

---

## CI/CD Setup (GitHub Actions)

### 1. Encode Keystore to Base64

```bash
# On macOS/Linux
base64 -i androiduse-release.keystore | tr -d '\n' | pbcopy

# On Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("androiduse-release.keystore")) | Set-Clipboard
```

This copies the base64-encoded keystore to your clipboard.

### 2. Prepare google-services.json

```bash
# Copy the content of your google-services.json file
cat app/google-services.json | pbcopy  # macOS
cat app/google-services.json | xclip -selection clipboard  # Linux
```

This copies the entire JSON content to your clipboard.

### 3. Add GitHub Secrets

Go to your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `KEYSTORE_BASE64` | `<base64 string>` | Base64-encoded keystore file |
| `KEYSTORE_PASSWORD` | `<password>` | Keystore password |
| `KEY_ALIAS` | `androidusekey` | Key alias from keystore |
| `KEY_PASSWORD` | `<password>` | Key password |
| `GOOGLE_SERVICES_JSON` | `<json content>` | Firebase config file content |

### 4. Workflow Behavior

The GitHub Actions workflow (`build-and-release.yml`) automatically:

- **On Pull Requests & Pushes**: Builds dev debug APK only
- **On Tags (e.g., `v1.0.0`)**:
  - Builds signed staging release APK
  - Builds signed production release APK
  - Creates GitHub release with both APKs attached

### 5. Create a Release

```bash
# Tag a version
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically:
# 1. Build signed staging and production APKs
# 2. Create a GitHub release
# 3. Upload both APKs to the release
```

Release APKs will be named:
- `androiduse-staging-v1.0.0.apk`
- `androiduse-v1.0.0.apk` (production)

---

## Security Best Practices

### ✅ DO:
- Store keystore in a secure location (password manager, encrypted drive)
- Use strong, unique passwords for keystore and key
- Back up the keystore (if lost, you cannot update your app)
- Keep GitHub secrets private and rotate them if compromised
- Use different keystores for debug and release

### ❌ DON'T:
- Commit keystore files to Git (`.gitignore` protects you)
- Commit `keystore.properties` to Git (`.gitignore` protects you)
- Share keystore passwords in plain text (Slack, email, etc.)
- Store keystore in cloud storage without encryption
- Reuse passwords across different keystores

---

## Troubleshooting

### "Keystore was tampered with, or password was incorrect"
- Check that `KEYSTORE_PASSWORD` and `KEY_PASSWORD` are correct
- Verify the keystore file is not corrupted

### "Could not find or load main class"
- Run `./gradlew clean` and try again
- Check Java version: `java -version` (should be 17+)

### GitHub Actions: "KEYSTORE_BASE64 secret not set"
- Verify you added the secret in GitHub repository settings
- Check the secret name is exactly `KEYSTORE_BASE64` (case-sensitive)

### APK not signed
- Verify `keystore.properties` exists locally
- For CI/CD, verify all 4 secrets are set in GitHub
- Check build output for signing errors: `./gradlew assembleStagingRelease --info`

---

## Play Store Deployment

### 1. First Upload
- Build production release: `./gradlew assembleProductionRelease`
- Upload APK to Play Console
- Google will store your signing certificate

### 2. Updates
- Always use the same keystore for updates
- Increment `versionCode` in `gradle.properties`
- Update `versionName` for user-facing version (e.g., "1.0.1")

### 3. App Signing by Google (Recommended)
- Enable "App signing by Google Play" in Play Console
- Google manages signing keys, you upload bundles
- Use `./gradlew bundleProductionRelease` to build AAB instead

---

## Version Management

Version numbers are managed in `gradle.properties`:

```properties
versionName=1.0.0
versionCode=1
```

- **versionName**: User-facing version (e.g., "1.2.3")
- **versionCode**: Integer that must increase with each release

### CI/CD Versioning
- `versionCode` is automatically set to `$GITHUB_RUN_NUMBER`
- `versionName` is extracted from git tag (e.g., `v1.0.0` → `1.0.0`)

---

## Additional Resources

- [Android App Signing Documentation](https://developer.android.com/studio/publish/app-signing)
- [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
