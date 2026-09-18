# Droid Use Frontend - Setup Guide

This guide will help you set up the development environment for Droid Use Frontend.

## Quick Setup

### 1. Generate Environment File

Run the setup script to generate your `.env` file:

**Using Node.js (Recommended - Cross-platform):**
```bash
node setup-env.js
```

Or using npm/pnpm:
```bash
pnpm setup:env
```

**Alternative scripts (if you prefer):**
- Windows (PowerShell): `.\setup-env.ps1`
- Linux/Mac (Bash): `chmod +x setup-env.sh && ./setup-env.sh`

This will create a `.env` file with:
- A securely generated `AUTH_SECRET`
- Database connection string configured for `droiduse` user
- Placeholders for OAuth credentials

### 2. Create PostgreSQL Database

You have two options:

#### Option A: Using Node.js Script (Recommended - Cross-platform)
```bash
node setup-database.js
```

Or using npm/pnpm:
```bash
pnpm setup:db
```

If you need to specify the postgres password:
```bash
POSTGRES_PASSWORD="your-postgres-password" node setup-database.js
```

#### Option B: Using SQL Script (Cross-platform)
```bash
psql -U postgres -f setup-database.sql
```

#### Option C: Manual Setup
Connect to PostgreSQL and run:
```sql
CREATE USER droiduse WITH PASSWORD 'droiduse';
CREATE DATABASE droiduse OWNER droiduse;
GRANT ALL PRIVILEGES ON DATABASE droiduse TO droiduse;
```

Then connect to the database and grant schema privileges:
```sql
\c droiduse
GRANT ALL ON SCHEMA public TO droiduse;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO droiduse;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO droiduse;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO droiduse;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO droiduse;
```

### 3. Run Database Migrations

```bash
pnpm db:generate
pnpm db:push
```

### 4. Configure OAuth Providers (Optional)

#### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the form:
   - **Application name**: Droid Use (or your app name)
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click **"Register application"**
5. Copy the **Client ID** and **Client Secret**
6. Add them to your `.env` file:
   ```
   AUTH_GITHUB_ID="your-client-id"
   AUTH_GITHUB_SECRET="your-client-secret"
   ```

#### Google OAuth Setup

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Select your project (or create a new one)
3. Click **"Create Credentials"** > **"OAuth client ID"**
4. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in the required information
   - Add your email to test users
5. Select **"Web application"** as the application type
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Click **"Create"**
8. Copy the **Client ID** and **Client Secret**
9. Add them to your `.env` file:
   ```
   AUTH_GOOGLE_ID="your-client-id"
   AUTH_GOOGLE_SECRET="your-client-secret"
   ```

#### Twitter/X OAuth Setup

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sign in with your Twitter account
3. Create a new app or select an existing app
4. Go to the **"Keys and tokens"** tab
5. Under **"Consumer Keys"**, you'll find:
   - **API Key** (this is your Client ID)
   - **API Secret Key** (this is your Client Secret)
6. Under **"Authentication settings"**, add a callback URL:
   - `http://localhost:3000/api/auth/callback/twitter`
7. Add them to your `.env` file:
   ```
   AUTH_TWITTER_ID="your-api-key"
   AUTH_TWITTER_SECRET="your-api-secret-key"
   ```

**Note:** Twitter/X requires you to apply for developer access. The approval process may take some time.

### 5. Install Dependencies

```bash
pnpm install
```

### 6. Start Development Servers

```bash
pnpm dev
```

This will start:
- Frontend app: `http://localhost:3000`
- Admin app: `http://localhost:3001`

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AUTH_SECRET` | Secret key for encrypting sessions | Yes |
| `AUTH_GITHUB_ID` | GitHub OAuth Client ID | No |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Client Secret | No |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | No |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | No |
| `AUTH_TWITTER_ID` | Twitter/X OAuth API Key | No |
| `AUTH_TWITTER_SECRET` | Twitter/X OAuth API Secret | No |
| `AWS_REGION` | AWS region for S3 | No |
| `AWS_ACCESS_KEY_ID` | AWS access key | No |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | No |
| `AWS_S3_BUCKET_NAME` | S3 bucket name for uploads | No |

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running: `pg_isready` or check the service
- Verify the database exists: `psql -U droiduse -d droiduse -c "SELECT 1;"`
- Check connection string format in `.env`

### OAuth Issues

- Verify callback URLs match exactly (including `http://` vs `https://`)
- Check that credentials are correctly copied (no extra spaces)
- For local development, use `http://localhost:3000` (not `https://`)

### Migration Issues

- Run `pnpm db:generate` before `pnpm db:push`
- If schema changes, you may need to reset: `pnpm db:push --force-reset` (⚠️ deletes all data)

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

