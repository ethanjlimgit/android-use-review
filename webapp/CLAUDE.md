# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Droid Use is a Turborepo monorepo containing two Next.js applications (frontend and admin) with shared packages for UI components, database schema, and utility libraries. The project enables AI-powered Android device interactions through a marketplace for knowledge entries and device management.

## Monorepo Structure

```
apps/
  frontend/       # End-user Next.js app (port 3000)
  admin/          # CMS admin Next.js app (port 3001)
packages/
  shared-lib/     # Shared utilities, auth, storage, query client
  shared-prisma/  # Prisma schema and database client
  shared-ui/      # Radix UI + Tailwind components (shadcn/ui)
```

## Development Commands

**Package Manager:** This project uses `pnpm` exclusively (configured via packageManager in package.json).

**Common Commands:**
```bash
# Install dependencies
pnpm install

# Development (runs all apps)
pnpm dev

# Development (single app)
cd apps/frontend && pnpm dev
cd apps/admin && pnpm dev

# Build all apps
pnpm build

# Lint all packages
pnpm lint

# Type check all packages
pnpm type-check

# Database operations (run from root)
pnpm db:generate    # Generate Prisma client
pnpm db:push        # Push schema to database
pnpm db:migrate     # Run migrations
pnpm db:studio      # Open Prisma Studio
```

**Initial Setup Commands:**
```bash
# Generate environment file with AUTH_SECRET
pnpm setup:env      # or: node setup-env.js

# Create PostgreSQL database and user
pnpm setup:db       # or: node setup-database.js

# Then run database setup
pnpm db:generate
pnpm db:push
```

## Architecture

### Authentication & Authorization

- **Framework:** NextAuth.js v5 (beta)
- **Strategy:** JWT-based sessions (required for Credentials provider)
- **Location:** `apps/frontend/lib/auth.ts` and `apps/admin/lib/auth.ts`
- **Providers:** GitHub, Google, Twitter, Credentials (email/password with bcrypt)
- **Adapter:** PrismaAdapter with custom user model including `role` and `banned` fields
- **Session Extension:** User sessions include `id` and `role` via JWT callbacks
- **Required ENV:** `AUTH_SECRET` (generated via setup scripts)

### Database Layer

- **ORM:** Prisma 7 with PostgreSQL
- **Schema Location:** `packages/shared-prisma/prisma/schema.prisma`
- **Client Output:** `packages/shared-prisma/generated/`
- **Client Access:** Import from `@droiduse/shared-lib/server` or `@droiduse/shared-prisma`
- **Connection:** Configured via Prisma 7's `prisma.config.ts` pattern (DATABASE_URL from .env)
- **Key Models:** User, Account, Session, App, Knowledge, Device, Interaction, BlogPost

### Data Models

**User Management:**
- Users have `role` (user/admin) and can be `banned`
- Support for both OAuth and credentials-based authentication
- Password field is optional (only for credentials provider)

**Content Models:**
- `App`: Android applications with package paths, icons, categories
- `Knowledge`: Knowledge entries linked to apps, can be user-contributed
- `BlogPost`: CMS-managed blog posts with markdown content, SEO fields, featured images (S3)

**Device Management:**
- `Device`: Android devices with status tracking (online/offline)
- `Interaction`: Device interaction logs

### Shared Packages

**@droiduse/shared-lib:**
- Client exports: `schemas.ts`, `types.ts`, `queryClient.ts`
- Server exports: `@droiduse/shared-lib/server` (prisma client, storage, S3)
- Storage layer with S3 integration (AWS SDK v3)
- TanStack Query client configuration

**@droiduse/shared-prisma:**
- Prisma schema and generated client
- All database types exported from generated client

**@droiduse/shared-ui:**
- Complete shadcn/ui component library
- All components built with Radix UI primitives
- Tailwind CSS styling
- Utility function: `cn()` for class name merging

### Frontend Architecture

**Framework:** Next.js 16 with App Router

**Key Features:**
- React Server Components by default
- API routes in `app/api/`
- Route groups: `(auth)/` for authentication pages
- Server actions for mutations
- TanStack Query for client-side data fetching
- Sentry integration for error tracking
- PostHog integration for analytics

**Styling:**
- Tailwind CSS 4 (latest)
- Design system documented in `design_guidelines.md`
- Typography: Inter (primary), JetBrains Mono (code/technical)
- Spacing: Tailwind units (2, 4, 6, 8, 12, 16, 24)

**API Pattern:**
- Route handlers return JSON responses
- Authentication via `auth()` from NextAuth
- Error handling with try/catch and appropriate status codes

### Admin CMS

**Purpose:** Content management for blog posts

**Location:** `apps/admin/` (runs on port 3001)

**Features:**
- Separate authentication instance
- Rich markdown editor (`@uiw/react-md-editor`)
- Blog post CRUD operations
- User management capabilities

**Shared Code:** Uses same shared packages as frontend

## Database Workflow

**Important:** Always run `pnpm db:generate` before building or after schema changes. The build task depends on generated Prisma client.

**Schema Changes:**
1. Edit `packages/shared-prisma/prisma/schema.prisma`
2. Run `pnpm db:generate` to update client
3. Run `pnpm db:push` to apply to database (dev)
4. Run `pnpm db:migrate` for production migrations

**Accessing Prisma Client:**
```typescript
// Server-side only
import { prisma } from '@droiduse/shared-lib/server'

// Types
import type { User, App, Knowledge } from '@droiduse/shared-prisma'
```

## Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: Session encryption secret (auto-generated)

**OAuth (Optional):**
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`

**AWS S3 (Optional):**
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`

**Monitoring:**
- Sentry configuration in `.env.sentry-build-plugin`
- PostHog configuration in frontend app

## Working with Components

**Adding UI Components:**
All shadcn/ui components are already installed in `packages/shared-ui/`. Import them:

```typescript
import { Button, Card, Dialog } from '@droiduse/shared-ui'
```

**Creating New Components:**
- App-specific components go in `apps/{app}/components/`
- Shared components go in `packages/shared-ui/`
- Follow design guidelines in `design_guidelines.md`

## Testing Strategy

While no test framework is currently configured, when adding tests consider:
- Server components: Test with React Testing Library
- API routes: Test with MSW or similar
- Database: Use separate test database or transactions

## Debugging

**Development Mode:**
- NextAuth debug mode enabled in development (check console logs)
- Detailed auth errors logged with `[auth][error]` prefix
- Prisma query logging enabled via `log` option in client

**Common Issues:**
- Database connection: Run `pnpm db:generate` and verify `DATABASE_URL`
- Auth errors: Check `AUTH_SECRET` exists and OAuth credentials are correct
- Build failures: Ensure Prisma client is generated (`pnpm db:generate`)

## Design System

Refer to `design_guidelines.md` for:
- Typography scales and font stacks
- Spacing system (Tailwind units)
- Component patterns (cards, navigation, forms)
- Layout grids and responsive breakpoints
- Interaction states and micro-animations
- Accessibility requirements (44px touch targets, focus states)

## Deployment Considerations

**Build Order:**
Turbo handles dependency graph automatically. The `build` task depends on `^db:generate`, ensuring Prisma client is generated before building apps.

**Environment:**
- Frontend and Admin apps are independent Next.js deployments
- Both need access to same PostgreSQL database
- Both need same environment variables (especially auth secrets)

## Code Patterns

**Server vs Client Components:**
- Default to Server Components
- Add `'use client'` only when using hooks, event handlers, or browser APIs

**Data Fetching:**
- Server Components: Direct database queries via Prisma
- Client Components: TanStack Query with API routes

**Authentication Checks:**
```typescript
// In Server Components or Route Handlers
import { auth } from '@/lib/auth'

const session = await auth()
if (!session) {
  // Handle unauthenticated
}
```

**Form Handling:**
- Client: React Hook Form with Zod validation
- Server: Zod schemas from `@droiduse/shared-lib`
