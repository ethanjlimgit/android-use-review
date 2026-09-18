# Mobile Authentication Implementation Summary

## What Was Implemented

This implementation enables mobile apps to use JWT tokens from the `/api/auth/mobile/signin` endpoint for authenticating API requests, while maintaining backward compatibility with NextAuth session-based authentication for web clients.

## Changes Made

### 1. JWT Verification Utilities (`packages/shared-lib/auth/jwt-verify.ts`)

Created new utilities for verifying mobile JWT tokens:

- **`verifyMobileToken(token, secret)`**: Verifies a JWT token and returns user data
- **`extractBearerToken(authHeader)`**: Extracts token from Authorization header

These functions handle:
- Token signature verification using AUTH_SECRET
- Expiration validation
- Payload structure validation
- Error handling for expired and invalid tokens

### 2. Enhanced API Authentication (`apps/frontend/lib/api-helpers.ts`)

Updated the `requireAuth()` helper to support dual authentication:

```typescript
export async function requireAuth(request?: NextRequest): Promise<AuthSession>
```

**Authentication Priority:**
1. First checks for `Authorization: Bearer <token>` header (mobile)
2. Falls back to NextAuth session cookies (web)
3. Returns 401 if both fail

**Usage in API Routes:**
```typescript
import { requireAuth, apiHandler } from "@/lib/api-helpers"

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request) // Pass request for token support
  // ... use session.user.id, session.user.role, etc.
})
```

### 3. Example Implementation (`apps/frontend/app/api/tasks/[taskId]/route.ts`)

Updated the task API route to demonstrate:
- Dual authentication support
- Ownership verification
- Proper error handling with apiHandler
- Type-safe implementation

**Key Changes:**
- Added `requireAuth(request)` calls (passing request parameter)
- Added ownership checks comparing `task.userId` with `session.user.id`
- Wrapped handlers with `apiHandler` for automatic error handling
- Used consistent error messages and status codes

### 4. Documentation (`MOBILE_AUTH_GUIDE.md`)

Comprehensive guide covering:
- Authentication flow (signin → store tokens → make requests)
- Platform-specific examples (Android Kotlin, iOS Swift, React Native)
- Token storage best practices (EncryptedSharedPreferences, Keychain)
- Request examples with interceptors/middleware
- Error handling patterns
- Supported API endpoints
- Troubleshooting common issues

## How It Works

### Token Generation (Existing)

The `/api/auth/mobile/signin` endpoint already generates tokens:

```json
{
  "token": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800,
    "tokenType": "Bearer"
  }
}
```

**Token Payload:**
```javascript
{
  "userId": "cm5abc123...",
  "email": "user@example.com",
  "role": "user",
  "iat": 1735689600,
  "exp": 1736294400  // 7 days
}
```

### Token Usage (New)

Mobile apps now include the token in requests:

```http
GET /api/tasks/task-123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Verification (New)

The backend verifies the token:

1. Extract token from `Authorization: Bearer <token>` header
2. Verify signature using `AUTH_SECRET`
3. Check expiration
4. Extract user data from payload
5. Create session object compatible with NextAuth format

### Backward Compatibility

Web clients continue using NextAuth sessions (cookies) without any changes:
- No Authorization header → falls back to NextAuth session
- Existing web routes continue to work unchanged
- Only new mobile routes need to pass `request` parameter

## Migration Guide for Existing Routes

To enable mobile authentication on an existing API route:

### Before:
```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth() // Web only
    // ... route logic
  } catch (error) {
    return NextResponse.json({ error: "..." }, { status: 500 })
  }
}
```

### After:
```typescript
import { requireAuth, apiHandler } from "@/lib/api-helpers"

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request) // Web + Mobile
  // ... route logic (no try/catch needed, apiHandler handles it)
})
```

**Key Changes:**
1. Pass `request` parameter to `requireAuth(request)`
2. Wrap handler with `apiHandler` for automatic error handling
3. Remove manual try/catch blocks (apiHandler handles it)

## Security Considerations

### Token Storage
- **Android:** Use `EncryptedSharedPreferences` (AES-256)
- **iOS:** Use Keychain Services with accessibility levels
- **Never:** Store tokens in plain SharedPreferences or UserDefaults

### Token Transmission
- All API requests use HTTPS in production
- Tokens transmitted via Authorization header (not URL params)
- Token format: `Bearer <token>` (standard OAuth 2.0 format)

### Token Lifecycle
- **Access Token:** 7 days (for convenience on mobile)
- **Refresh Token:** 30 days (future refresh endpoint needed)
- Tokens signed with AUTH_SECRET (same as NextAuth)

### Validation
- Signature verification prevents tampering
- Expiration prevents reuse of old tokens
- User validation ensures user exists and is not banned

## Testing

### Manual Testing with curl:

1. **Sign in and get token:**
```bash
curl -X POST http://localhost:3000/api/auth/mobile/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "deviceInfo": {
      "deviceId": "test-device-1",
      "name": "Test Device",
      "manufacturer": "Test",
      "model": "Test Model",
      "osVersion": "13",
      "apiLevel": 33,
      "displayMetrics": {
        "widthPixels": 1080,
        "heightPixels": 2400,
        "densityDpi": 420,
        "density": 2.625
      }
    }
  }'
```

2. **Use token for authenticated request:**
```bash
export TOKEN="<access_token_from_response>"

curl http://localhost:3000/api/tasks/task-123 \
  -H "Authorization: Bearer $TOKEN"
```

3. **Test web authentication (still works):**
```bash
# Sign in via web to get session cookie
curl http://localhost:3000/api/tasks/task-123 \
  -H "Cookie: authjs.session-token=..."
```

### Testing Error Cases:

```bash
# Test expired token (wait 7 days or modify JWT manually)
curl http://localhost:3000/api/tasks/task-123 \
  -H "Authorization: Bearer <expired_token>"
# Expected: 401 "Invalid or expired token"

# Test invalid token
curl http://localhost:3000/api/tasks/task-123 \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 "Invalid or expired token"

# Test missing token
curl http://localhost:3000/api/tasks/task-123
# Expected: 401 "Unauthorized"

# Test wrong user's task
curl http://localhost:3000/api/tasks/someone-elses-task \
  -H "Authorization: Bearer $TOKEN"
# Expected: 403 "Forbidden - you don't own this task"
```

## Dependencies Added

- **`jsonwebtoken`** (9.0.3): JWT signing and verification
- **`@types/jsonwebtoken`** (9.0.10): TypeScript types

Both added to `packages/shared-lib/package.json`.

## Files Modified

1. **packages/shared-lib/auth/jwt-verify.ts** (new)
   - JWT verification logic
   - Token extraction utilities

2. **packages/shared-lib/auth/index.ts** (modified)
   - Export jwt-verify utilities

3. **apps/frontend/lib/api-helpers.ts** (modified)
   - Enhanced `requireAuth()` for dual authentication
   - Added imports for JWT verification

4. **apps/frontend/app/api/tasks/[taskId]/route.ts** (modified)
   - Example implementation with dual auth
   - Demonstrates ownership checks

5. **MOBILE_AUTH_GUIDE.md** (new)
   - Comprehensive mobile integration guide

6. **IMPLEMENTATION_SUMMARY.md** (new, this file)
   - Technical implementation details

## Next Steps (Future Work)

### 1. Token Refresh Endpoint
Create `/api/auth/mobile/refresh` to exchange refresh tokens:

```typescript
POST /api/auth/mobile/refresh
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response:
{
  "accessToken": "new_token...",
  "expiresIn": 604800
}
```

### 2. Token Revocation
- Blacklist for logged-out tokens
- Device revocation endpoint
- View active sessions/devices

### 3. Apply to All API Routes
Update remaining API routes to support mobile auth:
- `/api/devices/**`
- `/api/knowledge/**`
- `/api/apps/**`
- Other protected endpoints

### 4. Rate Limiting
- Per-token request limits
- Brute force protection
- DDoS prevention

### 5. Enhanced Security
- Token rotation on critical actions
- Multi-device management
- Suspicious activity detection

## Notes

- **Backward Compatible:** Web clients continue to work without changes
- **Stateless:** JWT tokens don't require server-side session storage
- **Scalable:** Works across multiple server instances
- **Standard:** Uses OAuth 2.0 Bearer token format
- **Type-Safe:** Full TypeScript support throughout

## Questions or Issues?

- Check `MOBILE_AUTH_GUIDE.md` for integration help
- Review `packages/shared-lib/auth/jwt-verify.ts` for verification logic
- See `apps/frontend/app/api/tasks/[taskId]/route.ts` for example usage
