# Migration to HTTP API Architecture

This document describes the architectural changes to remove direct database access from `droiduse-backend` and route all database operations through the Next.js frontend API.

## Overview

**Before:** The backend directly accessed PostgreSQL using Prisma (Python).

**After:** The backend makes HTTP requests to Next.js API endpoints, which handle all database operations.

## Benefits

1. **Single Source of Truth:** All database access goes through the Next.js API
2. **Better Security:** Database credentials only needed in one place (Next.js)
3. **Simplified Backend:** No need for Prisma in Python backend
4. **Easier Deployment:** Backend doesn't need direct database access
5. **Consistent Schema:** Single Prisma schema shared across the system

## Changes Made

### 1. Frontend API Endpoints Created

The following endpoints were added/verified in `droiduse-frontend`:

**Task Operations:**
- `POST /api/tasks` - Create new task
- `PATCH /api/tasks/[taskId]` - Update task
- `POST /api/tasks/[taskId]/steps` - Create task step
- `PATCH /api/tasks/steps/[stepId]` - Update task step

**User Memory Operations:**
- `GET /api/user/memories` - List user memories
- `GET /api/user/memories/[key]` - Get specific memory
- `POST /api/user/memories` - Create/update user memory

**App Knowledge Operations:**
- `POST /api/app-knowledge` - Get app knowledge by package name (with optional RAG filtering)

### 2. Backend HTTP Client

Created `droiduse_backend/db/http_client.py` with functions that mirror the original Prisma operations:

- `create_task()`
- `update_task()`
- `create_task_step()`
- `update_task_step()`
- `create_or_update_user_memory()`
- `get_user_memory()`
- `get_user_memories()`
- `append_to_user_memory()`
- `get_app_knowledge()`

### 3. Updated Existing Files

**`droiduse_backend/db/helpers.py`:**
- Now re-exports functions from `http_client.py`
- Maintains backward compatibility with existing code

**`droiduse_backend/app_cards/providers/database_provider.py`:**
- Updated to use HTTP client instead of Prisma
- Maintains same interface and caching behavior

**`pyproject.toml`:**
- Removed `prisma>=0.12.0` dependency
- Kept `httpx>=0.27.0` for HTTP client

### 4. Removed/Backed Up Files

- `prisma/` → `prisma.backup/`
- `droiduse_backend/db/generated/` → `droiduse_backend/db/generated.backup/`

## Configuration

### Environment Variables

The backend now requires these environment variables:

```bash
# Next.js API URL (default: http://localhost:3000/api)
NEXTJS_API_URL=http://localhost:3000/api

# JWT token for authentication with Next.js API
NEXTJS_API_TOKEN=your_jwt_token_here
```

### Generating JWT Token

You can generate a JWT token for the backend using the Next.js auth system. The token should include:

```json
{
  "id": "user_id",
  "email": "backend@example.com",
  "name": "Backend Service",
  "role": "admin"
}
```

Use the same secret as `AUTH_SECRET` in your Next.js `.env` file.

Example script to generate token (run in Next.js project):

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    id: 'backend-service',
    email: 'backend@example.com',
    name: 'Backend Service',
    role: 'admin',
  },
  process.env.AUTH_SECRET!,
  { expiresIn: '365d' } // Long-lived token for backend
);

console.log('NEXTJS_API_TOKEN=' + token);
```

## Deployment

### Development Setup

1. Start Next.js frontend:
   ```bash
   cd droiduse-frontend
   pnpm dev
   ```

2. Generate backend JWT token (see above)

3. Start backend with environment variables:
   ```bash
   cd droiduse-backend
   export NEXTJS_API_URL=http://localhost:3000/api
   export NEXTJS_API_TOKEN=your_token_here
   droiduse-backend serve
   ```

### Production Setup

1. Deploy Next.js frontend with PostgreSQL access
2. Generate a long-lived JWT token for the backend
3. Deploy backend with:
   - `NEXTJS_API_URL` pointing to production Next.js API
   - `NEXTJS_API_TOKEN` set to the generated JWT
4. No `DATABASE_URL` needed in backend!

## Backward Compatibility

All existing code continues to work without changes:

- `LocalLoggingPlugin` - Uses `db.helpers` functions
- `DatabaseAppCardProvider` - Updated to use HTTP client
- Any code importing from `db.helpers` - Works transparently

## Limitations

### Not Yet Implemented

- `get_task_with_steps()` - Used only in experimental memory summary plugin
- Returns `None` for now; plugin handles gracefully

If needed, add a new API endpoint:
```
GET /api/tasks/[taskId]?includeSteps=true
```

## Testing

To verify the migration works:

```bash
# 1. Start Next.js frontend
cd droiduse-frontend && pnpm dev

# 2. In another terminal, test backend
cd droiduse-backend
export NEXTJS_API_URL=http://localhost:3000/api
export NEXTJS_API_TOKEN=your_token

# 3. Run tests
pytest tests/test_websocket_server.py -v

# 4. Test database recording
droiduse-backend serve --debug
```

## Rollback

If you need to rollback to direct database access:

1. Restore Prisma files:
   ```bash
   mv prisma.backup prisma
   mv droiduse_backend/db/generated.backup droiduse_backend/db/generated
   ```

2. Restore `pyproject.toml`:
   ```toml
   dependencies = [
       # ... other deps
       "prisma>=0.12.0",
   ]
   ```

3. Restore original `db/helpers.py` from git:
   ```bash
   git checkout HEAD -- droiduse_backend/db/helpers.py
   git checkout HEAD -- droiduse_backend/app_cards/providers/database_provider.py
   ```

4. Reinstall:
   ```bash
   pip install -e .[dev]
   prisma generate
   ```

## Troubleshooting

### "Unauthorized" errors

- Check `NEXTJS_API_TOKEN` is set and valid
- Verify JWT token hasn't expired
- Ensure token uses same `AUTH_SECRET` as Next.js

### Connection errors

- Verify Next.js is running and accessible
- Check `NEXTJS_API_URL` is correct
- Ensure no firewall blocking HTTP requests

### Missing data

- Verify Next.js has `DATABASE_URL` configured
- Check Next.js logs for database connection errors
- Run `pnpm db:generate && pnpm db:push` in Next.js

## Future Enhancements

Potential improvements:

1. **Batch Operations:** Add endpoints for bulk create/update
2. **Streaming:** Support streaming large query results
3. **Caching:** Add Redis cache layer in Next.js API
4. **Retry Logic:** Add automatic retry with exponential backoff
5. **Metrics:** Track API latency and error rates
