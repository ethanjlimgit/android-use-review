# Authentication Setup Guide

This guide explains how to configure authentication in AndroidUse with NextAuth backend integration.

## Overview

AndroidUse supports four authentication methods:
1. **Email/Password** - Traditional credentials with NextAuth Credentials provider
2. **Google Sign-In** - Native experience using Credential Manager (Recommended for social)
3. **GitHub OAuth** - Using AppAuth library
4. **Twitter OAuth** - Using AppAuth library with PKCE

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Android   │─────▶│   NextAuth   │─────▶│  Database   │
│  App (JWT)  │◀─────│   Backend    │◀─────│   (Users)   │
└─────────────┘      └──────────────┘      └─────────────┘
```

### Flow:

**Email/Password:**
1. User enters email and password in the app
2. App sends credentials to `/api/auth/signup` or `/api/auth/signin`
3. Backend validates, creates/finds user, returns Session JWT
4. App stores JWT in EncryptedSharedPreferences

**OAuth (Google/GitHub/Twitter):**
1. User signs in via OAuth provider (native or web)
2. Android app receives ID token or OAuth code
3. App sends token/code to NextAuth backend at `/api/auth/mobile-*`
4. Backend validates, finds/creates user, returns Session JWT
5. App stores JWT in EncryptedSharedPreferences

All methods result in a JWT that the app includes in subsequent API requests.

## Part 1: Android Configuration

### 1.1 Configure Google Sign-In

Google Sign-In requires **TWO** different OAuth 2.0 Client IDs in Google Cloud Console:

1. **Web Client ID** - For Credential Manager (modern flow)
2. **Android OAuth Client ID** - For legacy fallback (with SHA-1 fingerprint)

#### Step 1: Create Web Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Select **Web application**
6. Add authorized redirect URIs (for NextAuth): `https://your-domain.com/api/auth/callback/google`
7. Copy the **Client ID** (ends with `.apps.googleusercontent.com`)

#### Step 2: Create Android OAuth Client ID

1. In the same **Credentials** page, click **Create Credentials** → **OAuth 2.0 Client ID**
2. Select **Android**
3. Fill in:
   - **Package name**: `com.androiduse.autopilot`
   - **SHA-1 certificate fingerprint**: (see instructions below)
4. Click **Create**
5. Copy the **Client ID**

**Get SHA-1 Fingerprint:**

For debug builds:
```bash
cd androiduse-app
./gradlew signingReport
```

Look for `SHA1:` under `Variant: debug`. Copy and paste it into the Google Cloud Console.

For release builds, use your release keystore:
```bash
keytool -list -v -keystore /path/to/release.keystore -alias your-alias
```

#### Update AndroidUse Code

OAuth client IDs are configured via BuildConfig in `app/build.gradle.kts`.

Edit the appropriate build flavor (dev/staging/production):

```kotlin
// Web Client ID for Credential Manager (modern flow)
buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"YOUR_WEB_CLIENT_ID.apps.googleusercontent.com\"")

// Android OAuth Client ID for legacy fallback (requires SHA-1)
buildConfigField("String", "GOOGLE_OAUTH_CLIENT_ID", "\"YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com\"")
```

The app will automatically use:
- **GOOGLE_WEB_CLIENT_ID** for Credential Manager (tries this first)
- **GOOGLE_OAUTH_CLIENT_ID** for legacy fallback (if Credential Manager fails)

### 1.2 Configure GitHub OAuth

#### Create GitHub OAuth App

1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps**
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: AndroidUse
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/api/auth/callback/github`
4. Click **Register application**
5. Copy the **Client ID**
6. Generate a **Client Secret** (keep this secret!)

#### Update AndroidUse Code

GitHub client IDs are now configured via BuildConfig in `app/build.gradle.kts`.

Edit the appropriate build flavor (dev/staging/production):

```kotlin
buildConfigField("String", "GITHUB_CLIENT_ID", "\"YOUR_GITHUB_CLIENT_ID\"")
```

### 1.3 Configure Twitter OAuth

#### Create Twitter App

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app
3. Navigate to app settings
4. Enable **OAuth 2.0** with PKCE
5. Add redirect URI: `https://your-domain.com/api/auth/callback/twitter`
6. Copy the **Client ID**

#### Update AndroidUse Code

Twitter client IDs are now configured via BuildConfig in `app/build.gradle.kts`.

Edit the appropriate build flavor (dev/staging/production):

```kotlin
buildConfigField("String", "TWITTER_CLIENT_ID", "\"YOUR_TWITTER_CLIENT_ID\"")
```

## Part 2: NextAuth Backend Setup

### 2.0 Email/Password Authentication

For complete email/password setup with sign up, sign in, password hashing, and security best practices, see:

**[📖 Email/Password Backend Setup Guide](./email-password-backend-setup.md)**

Quick summary - Create these endpoints:
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login

Both return JWT tokens in the same format as OAuth endpoints.

### 2.1 Install Dependencies

```bash
npm install next-auth @auth/prisma-adapter jsonwebtoken bcryptjs
npm install --save-dev @types/bcryptjs
```

### 2.2 Configure NextAuth

Create or update `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import TwitterProvider from "next-auth/providers/twitter"

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0", // Use OAuth 2.0
    }),
  ],
  // ... other config
})

export { handler as GET, handler as POST }
```

### 2.3 Create Mobile Token Exchange Endpoints

Create `app/api/auth/mobile-google/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Find or create user in your database
    const user = await findOrCreateUser({
      email: payload.email!,
      name: payload.name,
      picture: payload.picture,
      provider: 'google',
      providerId: payload.sub,
    })

    // Generate session JWT
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      success: true,
      token: {
        accessToken: sessionToken,
        refreshToken: refreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: 'GOOGLE',
      },
    })
  } catch (error) {
    console.error('Google token exchange error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
```

Create `app/api/auth/mobile-oauth/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    const { code, provider, redirectUri, codeVerifier } = await request.json()

    // Exchange code for access token with the OAuth provider
    let accessToken: string
    let userInfo: any

    if (provider === 'github') {
      // Exchange GitHub code
      const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code,
            redirect_uri: redirectUri,
          }),
        }
      )

      const tokenData = await tokenResponse.json()
      accessToken = tokenData.access_token

      // Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      userInfo = await userResponse.json()

    } else if (provider === 'twitter') {
      // Similar implementation for Twitter
      // ... Twitter OAuth 2.0 code exchange
    }

    // Find or create user
    const user = await findOrCreateUser({
      email: userInfo.email,
      name: userInfo.name || userInfo.login,
      picture: userInfo.avatar_url,
      provider: provider,
      providerId: userInfo.id.toString(),
    })

    // Generate session JWT
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      success: true,
      token: {
        accessToken: sessionToken,
        refreshToken: refreshToken,
        expiresIn: 7 * 24 * 60 * 60,
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: provider.toUpperCase(),
      },
    })
  } catch (error) {
    console.error('OAuth code exchange error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
```

Create `app/api/auth/refresh/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type')
    }

    // Get user from database
    const user = await getUserById(decoded.userId)

    if (!user) {
      throw new Error('User not found')
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      success: true,
      token: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 7 * 24 * 60 * 60,
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider,
      },
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { success: false, error: 'Token refresh failed' },
      { status: 401 }
    )
  }
}
```

### 2.4 Environment Variables

Create `.env.local`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Twitter OAuth
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret
```

## Part 3: Testing

### 3.1 Test Email/Password Authentication

**Sign Up:**
1. Open AndroidUse app
2. Enter your backend URL: `https://your-domain.com`
3. Click "Don't have an account? Sign Up"
4. Enter name (optional), email, and password (min 8 characters)
5. Click "Sign Up"
6. App should receive JWT and navigate to MainActivity

**Sign In:**
1. Open app (or click "Already have an account? Sign In")
2. Enter your email and password
3. Click "Sign In"
4. App should authenticate and navigate to MainActivity

### 3.2 Test Google Sign-In

1. Open AndroidUse app
2. Scroll down to "OR" section
3. Click "Continue with Google"
4. Select your Google account
5. App should receive JWT and navigate to MainActivity

### 3.3 Test GitHub/Twitter

1. Click "Continue with GitHub" or "Continue with Twitter"
2. Browser opens for authorization
3. Authorize the app
4. App receives callback via deep link `androiduse://oauth/callback`
5. App exchanges code for JWT
6. Navigate to MainActivity

### 3.4 Verify Session Persistence

Check that the session is persisted:
1. Close the app completely
2. Reopen the app
3. Should skip AuthActivity and go directly to MainActivity
4. Session persists across app restarts

## Part 4: Using Authentication in Your App

### Check if User is Authenticated

```kotlin
class SomeActivity : AppCompatActivity() {
    private val authViewModel: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!authViewModel.isAuthenticated()) {
            // Redirect to AuthActivity
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
            return
        }

        // User is authenticated, continue
    }
}
```

### Make Authenticated API Requests

```kotlin
val accessToken = authViewModel.getAccessToken()

val request = Request.Builder()
    .url("https://your-api.com/protected-endpoint")
    .header("Authorization", "Bearer $accessToken")
    .build()
```

### Sign Out

```kotlin
authViewModel.signOut()
// Redirect to AuthActivity
```

## Troubleshooting

### Google Sign-In Error Code 10 (DEVELOPER_ERROR)

This error occurs during the **legacy fallback flow** when the SHA-1 certificate fingerprint is not registered for your Android OAuth Client ID in Google Cloud Console.

**Important:** The app uses TWO client IDs:
- **GOOGLE_WEB_CLIENT_ID** - Web type, no SHA-1 needed (for Credential Manager)
- **GOOGLE_OAUTH_CLIENT_ID** - Android type, requires SHA-1 (for legacy fallback)

Error code 10 specifically relates to the **GOOGLE_OAUTH_CLIENT_ID** (Android type).

**Fix for Debug Builds:**

1. Get your debug SHA-1 fingerprint:
```bash
cd androiduse-app
./gradlew signingReport
```

Look for `SHA1:` under `Variant: debug`

2. Go to [Google Cloud Console](https://console.cloud.google.com/)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your **Android** OAuth 2.0 Client ID (not the Web one!)
5. Verify it has:
   - **Package name**: `com.androiduse.autopilot`
   - **SHA-1 certificate fingerprint**: (paste the SHA-1 from step 1)
6. Update `GOOGLE_OAUTH_CLIENT_ID` in `build.gradle.kts` with this Android client ID

**Fix for Release Builds:**

1. Get your release keystore SHA-1:
```bash
keytool -list -v -keystore /path/to/release.keystore -alias your-alias
```

2. Create a separate Android OAuth Client ID with the release SHA-1
3. Update the production flavor in `build.gradle.kts` with the release Android client ID

**Summary:**
- Credential Manager uses **Web Client ID** (no SHA-1 required)
- Legacy fallback uses **Android OAuth Client ID** (SHA-1 required)
- Both must be configured in BuildConfig for seamless fallback

### Google Sign-In Not Working

- Verify Web Client ID is correct
- Ensure the Client ID is for "Web application" type
- Check that package name matches in Google Cloud Console
- Verify SHA-1 certificate fingerprint is added (see above)

### OAuth Redirect Not Working

- Verify deep link scheme: `androiduse://oauth/callback`
- Check AndroidManifest.xml has correct intent filter
- Ensure callback URLs in OAuth provider match

### Backend Returns 401/403

- Check JWT_SECRET is set correctly
- Verify client IDs and secrets in .env
- Check token hasn't expired

### Session Not Persisting

- Verify EncryptedSharedPreferences is working
- Check Android API level >= 30
- Review SessionManager logs

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Use HTTPS** - All backend endpoints must use HTTPS
3. **Validate tokens** - Always verify JWT signatures on backend
4. **Short token lifetimes** - Access tokens: 7 days, Refresh tokens: 30 days
5. **Implement token refresh** - Auto-refresh before expiry
6. **Secure storage** - Use EncryptedSharedPreferences (already implemented)

## Additional Resources

- [Credential Manager Documentation](https://developer.android.com/training/sign-in/credential-manager)
- [AppAuth-Android](https://github.com/openid/AppAuth-Android)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google Sign-In](https://developers.google.com/identity)
