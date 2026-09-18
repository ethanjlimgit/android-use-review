# Admin CMS System Setup Guide

A comprehensive Content Management System for the Droid Use admin panel.

## Features

✅ **Admin Authentication**
- Admin-only login system
- Role-based access control
- Session management

✅ **Blog Posts Management**
- View all blog posts in a table
- Search and filter by status (draft, published, archived)
- Edit and delete functionality

✅ **Users Management**
- View all users in a table
- Search and filter by role and ban status
- Ban/unban users with reason tracking
- View user statistics (blog post count)

✅ **Apps Management**
- View all apps in a table
- Enable/disable apps
- Configure app settings (JSON format)
- Search functionality

✅ **Knowledge Management**
- View all knowledge entries in a table
- Search and filter by type and featured status
- Edit and delete functionality

## Database Schema Updates

The following fields have been added:

### User Model
- `role`: String (default: "user") - "user" or "admin"
- `banned`: Boolean (default: false)
- `bannedAt`: DateTime (nullable)
- `bannedReason`: String (nullable, Text)

### App Model
- `settings`: String (nullable, Text) - JSON string for app settings
- `enabled`: Boolean (default: true)

## Setup Instructions

### 1. Database Migration

```bash
# Generate Prisma client with new fields
pnpm db:generate

# Push schema changes to database
pnpm db:push

# Or use migrations
pnpm db:migrate
```

### 2. Create Admin User

You need to create at least one admin user. You can do this by:

1. **Using Prisma Studio:**
   ```bash
   pnpm db:studio
   ```
   Then manually set a user's `role` field to `"admin"`

2. **Using SQL:**
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-admin@example.com';
   ```

3. **Using a script:**
   Create a temporary script to set a user as admin

### 3. Environment Variables

Make sure your `.env` file has:
```env
AUTH_SECRET=your-secret-key-here
DATABASE_URL=your-database-url
```

### 4. Install Dependencies

Dependencies should already be installed, but if needed:
```bash
cd apps/admin
pnpm install
```

## Usage

### Accessing the Admin Panel

1. Navigate to `http://localhost:3001/admin/login`
2. Login with an admin account (email/password)
3. Only users with `role = "admin"` can access

### Admin Routes

- `/admin` - Dashboard
- `/admin/blog` - Blog Posts Management
- `/admin/users` - Users Management
- `/admin/apps` - Apps Management
- `/admin/knowledge` - Knowledge Management

### API Endpoints

All admin API endpoints require admin authentication:

- `GET /api/admin/blog` - Get blog posts
- `GET /api/admin/users` - Get users
- `PATCH /api/admin/users` - Ban/unban users
- `GET /api/admin/apps` - Get apps
- `PATCH /api/admin/apps` - Update app settings
- `GET /api/admin/knowledge` - Get knowledge entries

## Features in Detail

### User Banning

1. Navigate to Users page
2. Click "Ban" button on a user
3. Enter optional ban reason
4. User will be banned and cannot login
5. Click "Unban" to restore access

### App Settings

1. Navigate to Apps page
2. Click "Settings" button on an app
3. Edit JSON settings in the dialog
4. Save changes
5. Toggle app enabled/disabled status

### Search and Filter

All tables support:
- **Search**: Real-time search across relevant fields
- **Filters**: Dropdown filters for status, type, etc.
- **Pagination**: Navigate through large datasets

## Security Notes

- All admin routes are protected by authentication middleware
- Only users with `role = "admin"` can access admin pages
- Banned users cannot login (even if they're admins)
- All API endpoints verify admin role before processing

## Troubleshooting

### "Unauthorized" errors
- Make sure you're logged in as an admin
- Check that your user has `role = "admin"` in the database
- Verify your session is valid

### Type errors after migration
- Run `pnpm db:generate` to regenerate Prisma client
- Restart your TypeScript server
- Clear `.next` cache if needed

### Missing fields in database
- Run `pnpm db:push` to sync schema
- Or create a migration: `pnpm db:migrate dev`

## Next Steps

Consider adding:
- Edit functionality for blog posts and knowledge
- Bulk operations (ban multiple users, etc.)
- Activity logs/audit trail
- Export functionality (CSV, JSON)
- Advanced permissions (sub-admin roles)

