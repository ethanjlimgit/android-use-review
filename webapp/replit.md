# Droiduse - CUA Agent Knowledge Marketplace

## Overview

Droiduse is a web-based marketplace for mobile Computer Use Agent (CUA) knowledge, focusing on Android app automation and AI skills. Users can browse, search, and filter knowledge entries, contribute new content, manage connected Android devices, and send instructions via WebSocket for real-time device control.

The platform enables AI agents to understand and interact with mobile interfaces through a curated knowledge base of app-specific behaviors and AI skills.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme (orange accent, Linear/Notion-inspired design)
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON APIs under `/api/*` prefix
- **Build Process**: esbuild for server bundling, Vite for client builds

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)
- **Validation**: Drizzle-Zod for automatic schema-to-validation conversion

### Core Data Models
- **Users**: Authentication with username/password
- **Apps**: Android app registry with package path, version, and metadata
- **Knowledge**: App usage guides and AI skills with scoring and categorization
- **Devices**: Connected Android devices with status tracking
- **Interactions**: Device communication logs for instruction/response history

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` are imported by both client and server
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared code
- **In-Memory Storage**: Current implementation uses `MemStorage` class with potential for database migration
- **API Query Keys**: React Query uses URL paths as query keys for automatic caching

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (shadcn + custom)
│   ├── pages/           # Route pages
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── routes.ts        # API route handlers
│   ├── storage.ts       # Data access layer
│   └── index.ts         # Server entry point
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle table definitions
└── migrations/          # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database toolkit with type-safe queries

### UI Framework
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-styled component collection (new-york style variant)
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel component

### Build & Development
- **Vite**: Frontend dev server and bundler with HMR
- **esbuild**: Fast server-side bundling
- **TypeScript**: Full type coverage across client and server

### Real-time Communication
- **WebSocket (ws)**: Planned for device communication and instruction relay

### Fonts
- **Inter**: Primary UI font
- **JetBrains Mono**: Monospace font for technical data and code