# Droid Use Monorepo

This is a Turborepo monorepo containing the Droid Use frontend applications and shared packages.

## Structure

```
.
├── apps/
│   ├── frontend/      # End user frontend application
│   └── admin/         # CMS admin application
├── packages/
│   ├── shared-lib/    # Shared library code (auth, storage, utils, etc.)
│   ├── shared-prisma/ # Prisma schema and database client
│   └── shared-ui/     # Shared UI components
└── turbo.json         # Turborepo configuration
```

## Getting Started

### Install Dependencies

First, install pnpm if you haven't already:

```bash
npm install -g pnpm
```

Then install all dependencies:

```bash
pnpm install
```

### Generate Prisma Client

```bash
pnpm run db:generate
```

This will generate the Prisma client in `packages/shared-prisma/generated/`.

### Development

Run all apps in development mode:

```bash
pnpm run dev
```

Run a specific app:

```bash
cd apps/frontend && pnpm run dev
cd apps/admin && pnpm run dev
```

The frontend app runs on `http://localhost:3000` and the admin app runs on `http://localhost:3001`.

### Build

Build all apps:

```bash
pnpm run build
```

### Database

All database operations are handled through the `shared-prisma` package:

```bash
# Generate Prisma client
pnpm run db:generate

# Push schema changes
pnpm run db:push

# Run migrations
pnpm run db:migrate

# Open Prisma Studio
pnpm run db:studio
```

## Packages

### @droiduse/shared-lib

Shared library code including:
- Authentication (NextAuth configuration)
- Database storage layer
- Utility functions
- Type definitions
- Query client configuration

### @droiduse/shared-prisma

Prisma schema and generated client. Contains all database models and types.

### @droiduse/shared-ui

Shared UI components built with Radix UI and Tailwind CSS. All shadcn/ui components are available here.

## Workspace Scripts

- `pnpm run dev` - Start all apps in development mode
- `pnpm run build` - Build all apps
- `pnpm run lint` - Lint all packages
- `pnpm run type-check` - Type check all packages
- `pnpm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `pnpm run test` - Run all tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:coverage` - Run tests with coverage

## Deployment

Docker images are built and pushed automatically via GitHub Actions CI/CD pipeline when code is merged to the `main` branch. The workflow:

1. Runs linting and type checking
2. Builds all applications
3. Creates tagged releases
4. Builds and pushes Docker images to GitHub Container Registry (ghcr.io)

Images are tagged with both the version number and `latest`:
- `ghcr.io/[owner]/[repo]/frontend:latest`
- `ghcr.io/[owner]/[repo]/frontend:[version]`
- `ghcr.io/[owner]/[repo]/admin:latest`
- `ghcr.io/[owner]/[repo]/admin:[version]`

See `.github/workflows/ci-cd.yml` for the complete CI/CD configuration.

