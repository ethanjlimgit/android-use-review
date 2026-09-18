# Email/Password Authentication Backend Setup

This guide covers setting up email/password authentication with NextAuth for the AndroidUse mobile app.

## Backend Implementation

### 1. Install Dependencies

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### 2. Create Sign Up Endpoint

Create `app/api/auth/signup/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma' // or your database client

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        password: hashedPassword,
        provider: 'EMAIL',
      },
    })

    // Generate JWT tokens
    const accessToken = jwt.sign(
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
        accessToken,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        provider: 'EMAIL',
      },
    })
  } catch (error) {
    console.error('Sign up error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
```

### 3. Create Sign In Endpoint

Create `app/api/auth/signin/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password!)

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
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
        accessToken,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60,
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        provider: 'EMAIL',
      },
    })
  } catch (error) {
    console.error('Sign in error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sign in' },
      { status: 500 }
    )
  }
}
```

### 4. Update Database Schema

If using Prisma, update your `schema.prisma`:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // For email/password auth
  provider      String    @default("EMAIL") // EMAIL, GOOGLE, GITHUB, TWITTER
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

Run migration:
```bash
npx prisma migrate dev --name add_password_field
```

## Password Security Best Practices

### 1. Password Hashing

The implementation uses bcrypt with a cost factor of 10 (default), which provides strong security:

```typescript
const hashedPassword = await bcrypt.hash(password, 10)
```

### 2. Password Requirements (Android)

The Android app enforces these requirements:
- Minimum 8 characters
- Calculates strength based on:
  - Length (bonus for 12+ chars)
  - Lowercase letters
  - Uppercase letters
  - Numbers
  - Special characters

### 3. Additional Backend Validation (Optional)

You can add server-side password validation:

```typescript
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' }
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain lowercase letters' }
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain uppercase letters' }
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain numbers' }
  }

  return { valid: true }
}
```

## Email Verification (Optional)

### 1. Add Email Verification Field

Update your User model:

```prisma
model User {
  // ... existing fields
  emailVerified DateTime?
  verificationToken String?
}
```

### 2. Send Verification Email on Sign Up

```typescript
import { sendVerificationEmail } from '@/lib/email'

// After creating user
const verificationToken = crypto.randomBytes(32).toString('hex')

await prisma.user.update({
  where: { id: user.id },
  data: { verificationToken },
})

await sendVerificationEmail(user.email, verificationToken)

// Return response with message
return NextResponse.json({
  success: true,
  message: 'Account created. Please verify your email.',
  // ... rest of response
})
```

### 3. Create Verification Endpoint

Create `app/api/auth/verify-email/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      verificationToken: null,
    },
  })

  return NextResponse.json({ success: true, message: 'Email verified!' })
}
```

## Testing

### Test Sign Up
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","name":"Test User"}'
```

### Test Sign In
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'
```

### Expected Response
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
    "id": "clx...",
    "email": "test@example.com",
    "name": "Test User",
    "picture": null,
    "provider": "EMAIL"
  }
}
```

## Integration with NextAuth (Optional)

If you want to use NextAuth's Credentials provider alongside the mobile endpoints:

```typescript
// app/api/auth/[...nextauth]/route.ts
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email and Password',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
    // ... other providers
  ],
}
```

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Store JWT_SECRET in environment variables (min 32 chars)
- [ ] Use bcrypt with cost factor 10+ for password hashing
- [ ] Validate email format on backend
- [ ] Implement rate limiting on auth endpoints
- [ ] Add email verification (recommended)
- [ ] Implement password reset flow
- [ ] Log authentication attempts for security monitoring
- [ ] Use prepared statements/ORM to prevent SQL injection
- [ ] Sanitize user inputs
- [ ] Implement account lockout after failed attempts (optional)

## Error Handling

Common errors and how to handle them:

| Error | Status | Response |
|-------|--------|----------|
| Email already exists | 409 | `{ success: false, error: "User with this email already exists" }` |
| Invalid credentials | 401 | `{ success: false, error: "Invalid email or password" }` |
| Weak password | 400 | `{ success: false, error: "Password must be at least 8 characters" }` |
| Missing fields | 400 | `{ success: false, error: "Email and password are required" }` |
| Server error | 500 | `{ success: false, error: "Failed to create account" }` |

The Android app will display these error messages to the user.
