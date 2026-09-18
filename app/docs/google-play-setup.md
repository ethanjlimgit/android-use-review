# Google Play Store Publishing Setup

This guide explains how to configure automated publishing to Google Play Store.

## Prerequisites

1. A Google Play Developer account
2. An app already created in the Google Play Console (at least one manual upload)
3. Access to Google Cloud Console

## Step 1: Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project for your app
3. Go to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
   - Name: `play-store-publisher` (or similar)
   - Description: `Service account for automated Play Store publishing`
5. Click **Create and Continue**
6. Skip granting roles (we'll configure access in Play Console)
7. Click **Done**

## Step 2: Create Service Account Key

1. Click on the newly created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create**
6. Save the downloaded JSON file securely

## Step 3: Link Service Account to Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Go to **Setup** → **API access**
3. Click **Link** next to your Google Cloud project (or create a new project)
4. Under **Service accounts**, find your service account
5. Click **Grant access**
6. Set permissions:
   - **App access**: Select your app (`com.androiduse.autopilot`)
   - **Account permissions**: None needed
   - **App permissions**: Select **Release to production, exclude devices, and use Play App Signing**
7. Click **Invite user**
8. Accept the invitation

## Step 4: Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Add the following secret:

| Secret Name | Value |
|-------------|-------|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The entire contents of the JSON key file |

## How It Works

### Auto-Tagging (Git Hook)

A post-commit hook automatically creates tags when version changes:

1. Install the hook: `./scripts/setup-hooks.sh`
2. When you commit changes to `gradle.properties` with version changes, a tag is created
3. Push the tag with your commits: `git push origin main --tags`

### Auto-Publishing

When a tag is pushed (either manually or via auto-tag):

1. The `build-and-release.yml` workflow builds:
   - APKs for staging and production
   - AAB (Android App Bundle) for Play Store
2. Creates a GitHub release with all artifacts
3. Uploads the AAB to Google Play **internal** track

### Release Tracks

The workflow publishes to the **internal** track by default for safety. To change this:

```yaml
# In .github/workflows/build-and-release.yml
track: internal  # Options: internal, alpha, beta, production
```

Recommended release flow:
1. `internal` - Internal testing
2. `alpha` - Closed testing
3. `beta` - Open testing
4. `production` - Full release

### Manual Promotion

To promote a release from internal to production:

1. Go to **Actions** tab in GitHub
2. Select **Android Build and Release** workflow
3. Click **Run workflow**
4. This will trigger the `promote-to-production` job

Or do it manually in Google Play Console.

## Version Management

Versions are managed in `gradle.properties`:

```properties
versionCode=21
versionName=0.2.1
```

To release a new version:

1. Update `versionCode` (must always increment)
2. Update `versionName` (semantic versioning recommended)
3. Commit to `main` (git hook auto-creates tag)
4. Push with tags: `git push origin main --tags`
5. Build and publish workflows will run automatically

## Troubleshooting

### "Package name not found"

The app must be manually uploaded to Play Console at least once before automated publishing works.

### "Version code already exists"

Each upload must have a unique, incrementing `versionCode`. Check your `gradle.properties` and ensure it's higher than any existing version on Play Console.

### "APK/AAB not signed correctly"

Ensure your keystore secrets are configured:
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

### "API access denied"

1. Verify the service account has proper permissions in Play Console
2. Ensure the service account is linked to the correct app
3. Wait a few minutes after granting permissions (can take time to propagate)

## Security Notes

- Never commit the service account JSON file to the repository
- Use GitHub Secrets for all sensitive data
- Regularly rotate service account keys
- Limit service account permissions to only what's needed
