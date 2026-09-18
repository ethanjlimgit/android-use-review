# Mobile Authentication Guide

This guide explains how to authenticate mobile API requests using JWT tokens from the mobile signin endpoint.

## Overview

The mobile authentication flow uses JWT (JSON Web Tokens) for stateless authentication, allowing mobile apps to make authenticated API requests without requiring session cookies.

## Authentication Flow

### 1. Sign In

First, authenticate the user and obtain JWT tokens:

```http
POST /api/auth/mobile/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "deviceInfo": {
    "deviceId": "unique-device-id",
    "name": "Samsung Galaxy S21",
    "manufacturer": "Samsung",
    "model": "SM-G991B",
    "osVersion": "13",
    "apiLevel": 33,
    "displayMetrics": {
      "widthPixels": 1080,
      "heightPixels": 2400,
      "densityDpi": 420,
      "density": 2.625,
      "refreshRate": 120
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "token": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800,
    "tokenType": "Bearer"
  },
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://...",
    "provider": "EMAIL",
    "role": "user"
  },
  "device": {
    "id": "device-db-id",
    "deviceId": "unique-device-id",
    "name": "Samsung Galaxy S21"
  }
}
```

### 2. Store Tokens

Store both `accessToken` and `refreshToken` securely:

**Android (Kotlin):**
```kotlin
// Use EncryptedSharedPreferences for secure storage
val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "auth_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

encryptedPrefs.edit()
    .putString("access_token", response.token.accessToken)
    .putString("refresh_token", response.token.refreshToken)
    .apply()
```

**iOS (Swift):**
```swift
// Use Keychain for secure storage
let accessToken = response.token.accessToken
KeychainHelper.save(accessToken, forKey: "access_token")

let refreshToken = response.token.refreshToken
KeychainHelper.save(refreshToken, forKey: "refresh_token")
```

### 3. Make Authenticated Requests

Include the access token in the `Authorization` header with the `Bearer` scheme:

**HTTP Request:**
```http
GET /api/devices/device-id/tasks
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Android (Kotlin with Retrofit):**
```kotlin
// Create an interceptor to add the token
class AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = getAccessToken() // Retrieve from EncryptedSharedPreferences
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        return chain.proceed(request)
    }
}

// Add to OkHttpClient
val client = OkHttpClient.Builder()
    .addInterceptor(AuthInterceptor())
    .build()

// Retrofit service
interface ApiService {
    @GET("api/devices/{deviceId}/tasks")
    suspend fun getTasks(@Path("deviceId") deviceId: String): Response<TasksResponse>
}
```

**iOS (Swift with URLSession):**
```swift
// Create a request with the token
func makeAuthenticatedRequest(url: URL) async throws -> Data {
    guard let token = KeychainHelper.load(forKey: "access_token") else {
        throw AuthError.noToken
    }

    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        throw NetworkError.invalidResponse
    }

    return data
}
```

**React Native (JavaScript/TypeScript):**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Store token
await AsyncStorage.setItem('access_token', response.token.accessToken);

// Make authenticated request
const makeAuthenticatedRequest = async (endpoint: string, options = {}) => {
  const token = await AsyncStorage.getItem('access_token');

  const response = await fetch(`https://api.example.com${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

// Usage
const tasks = await makeAuthenticatedRequest('/api/devices/device-id/tasks');
```

## Token Details

### Access Token
- **Lifetime:** 7 days
- **Usage:** Include in every API request
- **Format:** JWT containing `userId`, `email`, and `role`
- **Header:** `Authorization: Bearer <access_token>`

### Refresh Token
- **Lifetime:** 30 days
- **Usage:** Obtain new access token when expired (implementation pending)
- **Format:** JWT containing `userId` and `type: "refresh"`

## Supported API Endpoints

The following endpoints support JWT token authentication:

### Device Management
```http
GET    /api/devices                     # List user's devices
GET    /api/devices/{id}                # Get device details
PUT    /api/devices/{id}                # Update device
DELETE /api/devices/{id}                # Delete device
GET    /api/devices/{id}/tasks          # Get device tasks
POST   /api/devices/{id}/tasks          # Create task for device
POST   /api/devices/fcm-token           # Register FCM token
```

### Task Management
```http
GET    /api/tasks/{taskId}              # Get task details
PUT    /api/tasks/{taskId}              # Update task
DELETE /api/tasks/{taskId}              # Delete task
GET    /api/tasks/{taskId}/steps        # Get task steps
POST   /api/tasks/{taskId}/steps        # Create step
POST   /api/tasks/{taskId}/execute      # Execute task
GET    /api/tasks/{taskId}/status       # Get task status
```

### Knowledge & Apps
```http
GET    /api/knowledge                   # List knowledge entries
GET    /api/apps                        # List apps
```

## Error Handling

### 401 Unauthorized

This occurs when:
- Token is missing
- Token is invalid or malformed
- Token has expired

**Response:**
```json
{
  "error": "Unauthorized"
}
```

**Action:** Clear stored tokens and redirect to sign-in screen.

**Example:**
```kotlin
suspend fun handleApiCall() {
    try {
        val response = apiService.getTasks(deviceId)
        // Handle success
    } catch (e: HttpException) {
        if (e.code() == 401) {
            // Clear tokens and navigate to login
            clearTokens()
            navigateToLogin()
        }
    }
}
```

### 403 Forbidden

This occurs when the user is authenticated but doesn't have permission.

**Response:**
```json
{
  "error": "Forbidden - you don't own this resource"
}
```

**Action:** Show appropriate error message to user.

## Best Practices

### 1. Secure Token Storage
- **Android:** Use `EncryptedSharedPreferences`
- **iOS:** Use Keychain Services
- **React Native:** Use `@react-native-async-storage/encrypted-storage`

### 2. Token Lifecycle
```kotlin
class TokenManager {
    private val encryptedPrefs: SharedPreferences

    fun saveTokens(accessToken: String, refreshToken: String) {
        encryptedPrefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_TOKEN_TIMESTAMP, System.currentTimeMillis())
            .apply()
    }

    fun getAccessToken(): String? {
        // Check if token is expired (7 days)
        val timestamp = encryptedPrefs.getLong(KEY_TOKEN_TIMESTAMP, 0)
        val now = System.currentTimeMillis()
        val sevenDays = 7 * 24 * 60 * 60 * 1000L

        if (now - timestamp > sevenDays) {
            // Token expired, need to refresh or re-authenticate
            return null
        }

        return encryptedPrefs.getString(KEY_ACCESS_TOKEN, null)
    }

    fun clearTokens() {
        encryptedPrefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_TOKEN_TIMESTAMP)
            .apply()
    }
}
```

### 3. Network Error Handling
```kotlin
sealed class ApiResult<T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error<T>(val code: Int, val message: String) : ApiResult<T>()
    data class NetworkError<T>(val exception: Exception) : ApiResult<T>()
}

suspend fun <T> safeApiCall(apiCall: suspend () -> Response<T>): ApiResult<T> {
    return try {
        val response = apiCall()
        when {
            response.isSuccessful && response.body() != null -> {
                ApiResult.Success(response.body()!!)
            }
            response.code() == 401 -> {
                ApiResult.Error(401, "Unauthorized - please sign in again")
            }
            else -> {
                ApiResult.Error(response.code(), response.message())
            }
        }
    } catch (e: IOException) {
        ApiResult.NetworkError(e)
    } catch (e: Exception) {
        ApiResult.NetworkError(e)
    }
}
```

### 4. Request Retry Logic
```kotlin
class AuthenticatedApiClient {
    private var accessToken: String? = null

    suspend fun <T> authenticatedRequest(
        request: suspend (token: String) -> T
    ): T {
        val token = accessToken ?: throw UnauthorizedException()

        try {
            return request(token)
        } catch (e: HttpException) {
            if (e.code() == 401) {
                // Token expired, clear and throw
                clearTokens()
                throw UnauthorizedException()
            }
            throw e
        }
    }
}
```

## Migration from Session-based Auth

If you have existing web clients using NextAuth sessions, you don't need to change anything. The API supports both authentication methods:

- **Web Clients:** Continue using session cookies (NextAuth)
- **Mobile Clients:** Use JWT tokens with Authorization header

The `requireAuth()` helper automatically detects and validates both methods.

## Implementation Details

### Backend Token Verification

The backend verifies tokens in the following order:

1. **Check Authorization header:** If present, extract and verify JWT token
2. **Check NextAuth session:** If no header, fall back to session-based auth
3. **Return 401:** If both fail, return Unauthorized error

**Code Reference:** `apps/frontend/lib/api-helpers.ts:36`

### Token Structure

```javascript
// Access Token Payload
{
  "userId": "cm5abc123...",
  "email": "user@example.com",
  "role": "user",
  "iat": 1735689600,  // Issued at
  "exp": 1736294400   // Expires at (7 days later)
}

// Refresh Token Payload
{
  "userId": "cm5abc123...",
  "type": "refresh",
  "iat": 1735689600,
  "exp": 1738281600   // Expires at (30 days later)
}
```

## Future Enhancements

- **Token Refresh Endpoint:** `/api/auth/mobile/refresh` (coming soon)
- **Token Revocation:** Blacklist for logged out tokens
- **Rate Limiting:** Per-token request limits
- **Device Management:** View and revoke device tokens

## Troubleshooting

### Token Verification Fails

**Symptom:** Getting 401 even with valid-looking token

**Checks:**
1. Ensure `AUTH_SECRET` environment variable matches between token generation and verification
2. Check token hasn't expired (7 days from issuance)
3. Verify token format: `Bearer <token>` (note the space)
4. Check for extra whitespace or newlines in token string

### CORS Issues (Web Testing)

If testing from a web browser, ensure CORS headers are configured:

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization,Content-Type' },
        ],
      },
    ]
  },
}
```

## Support

For issues or questions:
- **Backend Issues:** Check `packages/shared-lib/auth/jwt-verify.ts`
- **API Integration:** Check `apps/frontend/lib/api-helpers.ts`
- **Mobile Signin:** Check `apps/frontend/app/api/auth/mobile/signin/route.ts`
