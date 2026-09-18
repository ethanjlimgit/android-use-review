#!/bin/bash
set -e

echo "Updating Pulumi configuration for new droplet names..."

# Update droplet configuration names
pulumi config set agentSize "s-1vcpu-2gb"
pulumi config set agentCount 1
pulumi config set webappSize "s-1vcpu-2gb"
pulumi config set webappCount 1
pulumi config set adminSize "s-1vcpu-1gb"
pulumi config set adminCount 1

echo "✅ Configuration updated successfully!"
echo ""
echo "⚠️  IMPORTANT: You need to reset all secrets using 'pulumi config set --secret'"
echo "The plaintext secrets in your config file are invalid."
echo ""
echo "Run these commands to fix secrets:"
echo ""
echo "# GitHub Container Registry"
echo "pulumi config set --secret ghcrToken 'YOUR_GITHUB_TOKEN'"
echo ""
echo "# NextAuth"
echo "pulumi config set --secret authSecret 'YOUR_AUTH_SECRET'"
echo ""
echo "# OAuth Providers"
echo "pulumi config set --secret authGithubId 'YOUR_GITHUB_CLIENT_ID'"
echo "pulumi config set --secret authGithubSecret 'YOUR_GITHUB_CLIENT_SECRET'"
echo "pulumi config set --secret authGoogleId 'YOUR_GOOGLE_CLIENT_ID'"
echo "pulumi config set --secret authGoogleSecret 'YOUR_GOOGLE_CLIENT_SECRET'"
echo ""
echo "# Stripe"
echo "pulumi config set --secret stripeSecretKey 'YOUR_STRIPE_SECRET_KEY'"
echo "pulumi config set --secret stripeWebhookSecret 'YOUR_STRIPE_WEBHOOK_SECRET'"
echo ""
echo "# SendGrid"
echo "pulumi config set --secret sendgridApiKey 'YOUR_SENDGRID_API_KEY'"
echo ""
echo "# Firebase"
echo "pulumi config set --secret firebaseServiceAccountJson 'YOUR_FIREBASE_JSON'"
echo ""
echo "# DigitalOcean"
echo "pulumi config set --secret digitalocean:token 'YOUR_DO_TOKEN'"

