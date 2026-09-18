# Blog System Setup Guide

This guide will help you set up the SEO-friendly blog system that has been implemented.

## Features

- ✅ Blog posts stored in PostgreSQL database (including markdown content)
- ✅ Attachments stored in S3
- ✅ SEO-friendly metadata (title, description, keywords, Open Graph, Twitter Cards)
- ✅ Static page generation for better performance
- ✅ Markdown rendering with syntax highlighting support

## Prerequisites

1. **Database Migration**: Run Prisma migrations to add the BlogPost table
2. **AWS S3 Setup**: Configure AWS credentials for file uploads
3. **Dependencies**: Install required npm packages

## Step 1: Install Dependencies

### Frontend Dependencies (for markdown rendering)
```bash
cd apps/frontend
pnpm add react-markdown remark-gfm rehype-raw rehype-sanitize
```

### Shared Library Dependencies (for S3)
```bash
cd packages/shared-lib
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Step 2: Database Migration

Generate Prisma client and run migrations:

```bash
# From root directory
pnpm db:generate
pnpm db:push
# Or use migrations:
# pnpm db:migrate
```

## Step 3: Environment Variables

Add the following environment variables to your `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=droiduse-blog-attachments

# Blog Content Directory (optional, defaults to ./content/blog)
BLOG_CONTENT_DIR=./content/blog
```

## Step 4: Create S3 Bucket

1. Create an S3 bucket in your AWS account
2. Configure bucket permissions:
   - Enable public read access for uploaded files (or use CloudFront CDN)
   - Set CORS policy to allow uploads from your domain
3. Update `AWS_S3_BUCKET_NAME` in your `.env` file

**Note:** Blog post content is stored directly in the database, so no file system setup is needed for content storage. S3 is only used for attachments (images, files, etc.).

## API Endpoints

### Get All Blog Posts
```
GET /api/blog?status=published&featured=true&limit=10&offset=0
```

### Get Blog Post by Slug
```
GET /api/blog/[slug]?includeContent=true
```

### Create Blog Post
```
POST /api/blog
Body: {
  title: string,
  slug: string,
  excerpt?: string,
  content: string (markdown),
  authorId: string,
  status: 'draft' | 'published' | 'archived',
  featured?: boolean,
  featuredImage?: string (S3 URL),
  seoTitle?: string,
  seoDescription?: string,
  seoKeywords?: string,
  publishedAt?: string (ISO date)
}
```

### Update Blog Post
```
PUT /api/blog/[slug]
Body: { ...same as create, but all fields optional }
```

### Delete Blog Post
```
DELETE /api/blog/[slug]
```

### Upload Attachment
```
POST /api/blog/upload
Content-Type: multipart/form-data
Body: {
  file: File,
  folder?: string
}
```

## Frontend Pages

- **Blog Listing**: `/blog` - Displays all published blog posts
- **Blog Post**: `/blog/[slug]` - Individual blog post page with full content

## SEO Features

Each blog post includes:
- Custom SEO title and description
- Open Graph metadata for social sharing
- Twitter Card metadata
- Structured data for search engines
- Automatic sitemap generation (via Next.js static generation)

## File Structure

```
Database:
  blog_posts table:
    - All blog post metadata and markdown content stored here

S3 Bucket:
  blog/
    attachments/
      [timestamp]-[filename]  # Uploaded attachments (images, files, etc.)
```

## Usage Example

### Creating a Blog Post

```typescript
const response = await fetch('/api/blog', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My First Blog Post',
    slug: 'my-first-blog-post',
    excerpt: 'This is an excerpt',
    content: '# My First Blog Post\n\nThis is the content...',
    authorId: 'user-id-here',
    status: 'published',
    featured: true,
    seoTitle: 'My First Blog Post - Droid Use',
    seoDescription: 'Learn about...',
    seoKeywords: 'blog, tutorial, guide',
  }),
});
```

### Uploading an Attachment

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('folder', 'my-post');

const response = await fetch('/api/blog/upload', {
  method: 'POST',
  body: formData,
});

const { url, key } = await response.json();
// Use url as featuredImage or in markdown content
```

## Notes

- Blog posts (including markdown content) are stored directly in the PostgreSQL database
- Attachments (images, files) are stored in S3 for scalability
- Only published posts are visible to the public by default
- The system supports draft, published, and archived statuses
- Featured posts can be highlighted on the listing page
- Content is stored as Text in the database, supporting large markdown documents

