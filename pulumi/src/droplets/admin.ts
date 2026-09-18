import * as pulumi from "@pulumi/pulumi";
import { InfraConfig } from "../config.js";

export interface AdminUserDataArgs {
  databaseUrl: pulumi.Input<string>;
  adminDatabaseUrl: pulumi.Input<string>;
  dbUsername: pulumi.Input<string>;
}

/**
 * Generate admin (CMS) cloud-init user data (Docker-based)
 * Admin droplet does NOT go through load balancer - direct access
 */
export function adminUserData(
  config: InfraConfig,
  args: AdminUserDataArgs
): pulumi.Output<string> {
  const adminImage = `${config.ghcrRegistry}/androiduse-webapp/admin:${config.imageTag}`;

  return pulumi.interpolate`#!/bin/bash
set -e

exec > >(tee /var/log/cloud-init-output.log) 2>&1
echo "Starting admin initialization (Docker-based)..."

# Update system
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install Docker and PostgreSQL client
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-nginx wget jq htop ufw postgresql-client

# Add Docker GPG key and repository
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Create app user and add to docker group
useradd -m -s /bin/bash androiduse || true
usermod -aG docker androiduse
mkdir -p /opt/androiduse-admin
chown androiduse:androiduse /opt/androiduse-admin

# Authenticate to GitHub Container Registry
echo "Authenticating to GHCR..."
echo "${config.ghcrToken}" | docker login ghcr.io -u ${config.ghcrUsername} --password-stdin

# Store credentials for the androiduse user as well
mkdir -p /home/androiduse/.docker
cp /root/.docker/config.json /home/androiduse/.docker/config.json
chown -R androiduse:androiduse /home/androiduse/.docker

# Store GHCR credentials for deploy script to re-authenticate
cat > /opt/androiduse-admin/.ghcr-credentials << GHCRCREDS
GHCR_USERNAME=${config.ghcrUsername}
GHCR_TOKEN=${config.ghcrToken}
GHCRCREDS
chmod 600 /opt/androiduse-admin/.ghcr-credentials
chown root:root /opt/androiduse-admin/.ghcr-credentials

# Create dedicated schema for app user and grant all permissions
echo "Setting up database schema..."
psql "${args.adminDatabaseUrl}" -c "
  CREATE SCHEMA IF NOT EXISTS ${args.dbUsername};
  GRANT ALL ON SCHEMA ${args.dbUsername} TO ${args.dbUsername};
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${args.dbUsername} TO ${args.dbUsername};
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${args.dbUsername} TO ${args.dbUsername};
  ALTER DEFAULT PRIVILEGES IN SCHEMA ${args.dbUsername} GRANT ALL ON TABLES TO ${args.dbUsername};
  ALTER DEFAULT PRIVILEGES IN SCHEMA ${args.dbUsername} GRANT ALL ON SEQUENCES TO ${args.dbUsername};
  ALTER USER ${args.dbUsername} SET search_path TO ${args.dbUsername}, public;
" || echo "Warning: Could not setup schema (may already exist)"

# Enable pgvector extension for vector embeddings
echo "Enabling pgvector extension..."
psql "${args.adminDatabaseUrl}" -c "CREATE EXTENSION IF NOT EXISTS vector;" || echo "Warning: Could not enable pgvector extension"

# Create environment file (no quotes for Docker .env format)
cat > /opt/androiduse-admin/.env << EOF
# Database
DATABASE_URL=${args.databaseUrl}

# NextAuth
AUTH_URL=https://admin.${config.domainName}
AUTH_SECRET=${config.authSecret}

# OAuth Providers
AUTH_GITHUB_ID=${config.authGithubId ?? ""}
AUTH_GITHUB_SECRET=${config.authGithubSecret ?? ""}
AUTH_GOOGLE_ID=${config.authGoogleId ?? ""}
AUTH_GOOGLE_SECRET=${config.authGoogleSecret ?? ""}
AUTH_TWITTER_ID=${config.authTwitterId ?? ""}
AUTH_TWITTER_SECRET=${config.authTwitterSecret ?? ""}

# Stripe
STRIPE_SECRET_KEY=${config.stripeSecretKey ?? ""}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${config.stripePublishableKey ?? ""}
STRIPE_WEBHOOK_SECRET=${config.stripeWebhookSecret ?? ""}

# Application
NEXT_PUBLIC_APP_URL=https://${config.domainName}
NEXT_PUBLIC_API_URL=https://agent.${config.domainName}
NODE_ENV=production
ENVIRONMENT=${config.environment}

# AWS S3
AWS_REGION=${config.awsRegion ?? ""}
AWS_ACCESS_KEY_ID=${config.awsAccessKeyId ?? ""}
AWS_SECRET_ACCESS_KEY=${config.awsSecretAccessKey ?? ""}
AWS_S3_BUCKET_NAME=${config.awsS3BucketName ?? ""}

# Monitoring - Sentry
SENTRY_AUTH_TOKEN=${config.sentryAuthToken ?? ""}

# Monitoring - PostHog
NEXT_PUBLIC_POSTHOG_KEY=${config.posthogKey ?? ""}
NEXT_PUBLIC_POSTHOG_HOST=${config.posthogHost ?? ""}

# Email - SendGrid
SENDGRID_API_KEY=${config.sendgridApiKey ?? ""}
SENDGRID_FROM_EMAIL=${config.sendgridFromEmail ?? ""}
SENDGRID_FROM_NAME=${config.sendgridFromName ?? ""}

# Firebase FCM
FIREBASE_SERVICE_ACCOUNT_JSON=${config.firebaseServiceAccountJson ?? ""}

# OpenAI API
OPENAI_API_KEY=${config.openaiApiKey ?? ""}
EOF
chown androiduse:androiduse /opt/androiduse-admin/.env
chmod 600 /opt/androiduse-admin/.env

# Pull admin container image
echo "Pulling admin container image from GHCR..."
docker pull ${adminImage}

# Run database migration as a one-time container
echo "Running Prisma database migrations..."
DATABASE_URL=$(grep "^DATABASE_URL=" /opt/androiduse-admin/.env | cut -d= -f2-)
docker run --rm \\
  ${adminImage} \\
  npx prisma db push --accept-data-loss --schema=/app/packages/shared-prisma/prisma/schema.prisma --url="$DATABASE_URL" || echo "Warning: Migration failed (may already be applied)"

# Create admin systemd service (Docker)
cat > /etc/systemd/system/androiduse-admin.service << 'EOF'
[Unit]
Description=AndroidUse Admin CMS (Docker)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker stop androiduse-admin
ExecStartPre=-/usr/bin/docker rm androiduse-admin
ExecStart=/usr/bin/docker run --network host --rm --name androiduse-admin \\
    --env-file /opt/androiduse-admin/.env \\
    -p 127.0.0.1:3001:3001 \\
    ${adminImage}
ExecStop=/usr/bin/docker stop androiduse-admin

[Install]
WantedBy=multi-user.target
EOF

# Create deploy script for easy updates
cat > /opt/androiduse-admin/deploy.sh << 'DEPLOY'
#!/bin/bash
set -e

# Login to GHCR first to ensure authentication is valid
echo "Authenticating to GHCR..."
if [ -f /opt/androiduse-admin/.ghcr-credentials ]; then
  source /opt/androiduse-admin/.ghcr-credentials
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
else
  echo "Warning: GHCR credentials file not found, attempting pull with existing credentials..."
fi

echo "Pulling latest admin image..."
docker pull ${adminImage}

echo "Updating database schema..."
# Extract DATABASE_URL from .env file
DATABASE_URL=$(grep "^DATABASE_URL=" /opt/androiduse-admin/.env | cut -d= -f2-)
docker run --rm \\
  ${adminImage} \\
  npx prisma db push --accept-data-loss --schema=/app/packages/shared-prisma/prisma/schema.prisma --url="$DATABASE_URL" || echo "Warning: Schema update failed (may already be up to date)"

echo "Restarting service..."
systemctl restart androiduse-admin

echo "Deploy complete!"
DEPLOY
chmod +x /opt/androiduse-admin/deploy.sh
chown androiduse:androiduse /opt/androiduse-admin/deploy.sh

# Configure nginx (HTTP only initially, certbot will add SSL)
cat > /etc/nginx/sites-available/androiduse-admin << 'NGINX'
upstream admin {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name admin.${config.domainName};

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    location / {
        proxy_pass http://admin;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/androiduse-admin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Install monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash || true

# Enable services
systemctl daemon-reload
systemctl enable androiduse-admin
systemctl start androiduse-admin

# Start nginx with HTTP-only config
nginx -t && systemctl reload nginx

# Wait for admin service and DNS propagation
echo "Waiting for admin service to start and DNS to propagate..."
sleep 30

# Obtain SSL certificate from Let's Encrypt (certbot will modify nginx config)
echo "Obtaining SSL certificate..."
certbot --nginx -d admin.${config.domainName} --non-interactive --agree-tos --email noreply@${config.domainName} --redirect || echo "Warning: SSL certificate setup failed, running with HTTP"

echo "Admin initialization complete!"
`;
}
