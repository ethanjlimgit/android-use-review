#!/usr/bin/env node
/**
 * Setup script for Droid Use Frontend
 * This script generates a .env file with secure credentials and provides database setup instructions
 */

import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

log('========================================', 'cyan');
log('Droid Use Frontend - Environment Setup', 'cyan');
log('========================================', 'cyan');
console.log('');

// Generate a secure random AUTH_SECRET
log('Generating secure AUTH_SECRET...', 'yellow');
const authSecret = randomBytes(32).toString('base64');

// Database configuration
const dbUser = 'droiduse';
const dbPassword = 'droiduse';
const dbName = 'droiduse';
const dbHost = 'localhost';
const dbPort = '5432';
const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

// Build .env file content
const envContent = `# Database
# PostgreSQL connection string
# Format: postgresql://[user]:[password]@[host]:[port]/[database]?[parameters]
DATABASE_URL="postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?schema=public"

# Optional: Shadow database URL for migrations (if using a separate shadow database)
# SHADOW_DATABASE_URL="postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}_shadow?schema=public"

# Auth.js Configuration
# This secret is used to encrypt session tokens and cookies
# Generated securely on ${timestamp}
AUTH_SECRET="${authSecret}"

# GitHub OAuth
# Get credentials from: https://github.com/settings/developers
# 1. Go to https://github.com/settings/developers
# 2. Click "New OAuth App"
# 3. Set Application name and Homepage URL
# 4. Set Authorization callback URL: http://localhost:3000/api/auth/callback/github
# 5. Copy Client ID and Client Secret
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""

# Google OAuth
# Get credentials from: https://console.cloud.google.com/apis/credentials
# 1. Go to https://console.cloud.google.com/apis/credentials
# 2. Click "Create Credentials" > "OAuth client ID"
# 3. Configure OAuth consent screen if prompted
# 4. Select "Web application"
# 5. Add authorized redirect URI: http://localhost:3000/api/auth/callback/google
# 6. Copy Client ID and Client Secret
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# Twitter OAuth (X)
# Get credentials from: https://developer.twitter.com/en/portal/dashboard
# 1. Go to https://developer.twitter.com/en/portal/dashboard
# 2. Create a new app or select existing app
# 3. Go to "Keys and tokens" tab
# 4. Generate API Key and API Secret Key
# 5. Set Callback URL: http://localhost:3000/api/auth/callback/twitter
# 6. Copy API Key and API Secret Key
AUTH_TWITTER_ID=""
AUTH_TWITTER_SECRET=""

# AWS S3 Configuration (for blog attachments)
# Optional: Configure if you need file uploads
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET_NAME="droiduse-blog-attachments"

# SendGrid Email Configuration
# Get API key from: https://app.sendgrid.com/settings/api_keys
# 1. Go to https://app.sendgrid.com/settings/api_keys
# 2. Click "Create API Key"
# 3. Give it a name (e.g., "Droid Use Production")
# 4. Select "Full Access" or "Restricted Access" with Mail Send permissions
# 5. Copy the API key (you'll only see it once!)
SENDGRID_API_KEY=""

# SendGrid From Email
# Must be a verified sender in SendGrid
# 1. Go to https://app.sendgrid.com/settings/sender_auth/senders/new
# 2. Add and verify your sender email address
SENDGRID_FROM_EMAIL=""

# SendGrid From Name (optional, defaults to "Droid Use")
SENDGRID_FROM_NAME="Droid Use"

# Stripe Configuration
# Get API keys from: https://dashboard.stripe.com/apikeys
# 1. Go to https://dashboard.stripe.com/apikeys
# 2. Copy your "Secret key" (starts with sk_)
# 3. For production, use live keys. For development, use test keys
STRIPE_SECRET_KEY=""

# Stripe Webhook Secret
# Get webhook secret from: https://dashboard.stripe.com/webhooks
# 1. Go to https://dashboard.stripe.com/webhooks
# 2. Click "Add endpoint" or select existing endpoint
# 3. Set endpoint URL: http://localhost:3000/api/stripe/webhook (or your production URL)
# 4. Select events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
# 5. Copy the "Signing secret" (starts with whsec_)
STRIPE_WEBHOOK_SECRET=""

# Firebase Service Account JSON (for FCM push notifications)
# Get service account key from: https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk
# 1. Go to https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk
# 2. Select your Firebase project
# 3. Click "Generate new private key"
# 4. Download the JSON file
# 5. Copy the entire JSON content and paste it here as a single-line string (escape quotes with \\")
#    Or use: cat service-account-key.json | jq -c . | sed 's/"/\\"/g'
# Note: This should be a JSON string, not a file path
FIREBASE_SERVICE_ACCOUNT_JSON=""

# App URL (used for Stripe redirects and callbacks)
# Set to your production URL in production, or http://localhost:3000 for development
NEXT_PUBLIC_APP_URL="http://localhost:3000"
`;

// Write .env file
log('Creating .env file...', 'yellow');
writeFileSync('.env', envContent, 'utf8');

console.log('');
log('✓ .env file created successfully!', 'green');
console.log('');
log('========================================', 'cyan');
log('Next Steps:', 'cyan');
log('========================================', 'cyan');
console.log('');
log('1. Create PostgreSQL Database:', 'yellow');
log('   Run the following SQL commands in PostgreSQL:', 'white');
console.log('');
log(`   CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';`, 'gray');
log(`   CREATE DATABASE ${dbName} OWNER ${dbUser};`, 'gray');
log(`   GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};`, 'gray');
console.log('');
log('   Or run: psql -U postgres -f setup-database.sql', 'white');
console.log('');
log('2. Configure OAuth Providers (optional):', 'yellow');
log('   - GitHub: https://github.com/settings/developers', 'white');
log('   - Google: https://console.cloud.google.com/apis/credentials', 'white');
log('   - Twitter: https://developer.twitter.com/en/portal/dashboard', 'white');
console.log('');
log('3. Configure SendGrid Email (required for password reset):', 'yellow');
log('   - API Key: https://app.sendgrid.com/settings/api_keys', 'white');
log('   - Verify Sender: https://app.sendgrid.com/settings/sender_auth/senders/new', 'white');
console.log('');
log('4. Configure Stripe (required for subscriptions):', 'yellow');
log('   - API Keys: https://dashboard.stripe.com/apikeys', 'white');
log('   - Webhooks: https://dashboard.stripe.com/webhooks', 'white');
log('   - Products & Prices: https://dashboard.stripe.com/products', 'white');
console.log('');
log('5. Configure Firebase (required for FCM push notifications):', 'yellow');
log('   - Service Account: https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk', 'white');
log('   - Generate new private key and paste JSON content into FIREBASE_SERVICE_ACCOUNT_JSON', 'white');
console.log('');
log('6. Run database migrations:', 'yellow');
log('   pnpm db:generate', 'white');
log('   pnpm db:push', 'white');
console.log('');
log('========================================', 'cyan');




