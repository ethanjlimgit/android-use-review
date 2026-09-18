import * as pulumi from "@pulumi/pulumi";
import { InfraConfig } from "../config.js";

export interface WebappUserDataArgs {
  databaseUrl: pulumi.Input<string>;
  adminDatabaseUrl: pulumi.Input<string>;
  dbUsername: pulumi.Input<string>;
}

/**
 * Generate webapp (main Next.js app) cloud-init user data (Docker-based)
 */
export function webappUserData(
  config: InfraConfig,
  args: WebappUserDataArgs
): pulumi.Output<string> {
  const webappImage = `${config.ghcrRegistry}/androiduse-webapp/frontend:${config.imageTag}`;

  return pulumi.interpolate`#!/bin/bash
set -e

exec > >(tee /var/log/cloud-init-output.log) 2>&1
echo "Starting webapp initialization (Docker-based)..."

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
mkdir -p /opt/androiduse-frontend
chown androiduse:androiduse /opt/androiduse-frontend

# Authenticate to GitHub Container Registry
echo "Authenticating to GHCR..."
echo "${config.ghcrToken}" | docker login ghcr.io -u ${config.ghcrUsername} --password-stdin

# Store credentials for the androiduse user as well
mkdir -p /home/androiduse/.docker
cp /root/.docker/config.json /home/androiduse/.docker/config.json
chown -R androiduse:androiduse /home/androiduse/.docker

# Store GHCR credentials for deploy script to re-authenticate
cat > /opt/androiduse-frontend/.ghcr-credentials << GHCRCREDS
GHCR_USERNAME=${config.ghcrUsername}
GHCR_TOKEN=${config.ghcrToken}
GHCRCREDS
chmod 600 /opt/androiduse-frontend/.ghcr-credentials
chown root:root /opt/androiduse-frontend/.ghcr-credentials

# Create dedicated schema for app user and grant all permissions
# DigitalOcean managed databases restrict public schema by default
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

# Create environment file (no quotes for Docker .env format)
cat > /opt/androiduse-frontend/.env << EOF
# Database
DATABASE_URL=${args.databaseUrl}

# NextAuth
AUTH_URL=https://${config.domainName}
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
chown androiduse:androiduse /opt/androiduse-frontend/.env
chmod 600 /opt/androiduse-frontend/.env

# Pull webapp container image
echo "Pulling webapp container image from GHCR..."
docker pull ${webappImage}

# Create webapp systemd service (Docker)
cat > /etc/systemd/system/androiduse-webapp.service << 'EOF'
[Unit]
Description=AndroidUse Webapp (Docker)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker stop androiduse-webapp
ExecStartPre=-/usr/bin/docker rm androiduse-webapp
ExecStart=/usr/bin/docker run --network host --rm --name androiduse-webapp \\
    --env-file /opt/androiduse-frontend/.env \\
    -p 127.0.0.1:3000:3000 \\
    ${webappImage}
ExecStop=/usr/bin/docker stop androiduse-webapp

[Install]
WantedBy=multi-user.target
EOF

# Create deploy script for easy updates
cat > /opt/androiduse-frontend/deploy.sh << 'DEPLOY'
#!/bin/bash
set -e

# Login to GHCR first to ensure authentication is valid
echo "Authenticating to GHCR..."
if [ -f /opt/androiduse-frontend/.ghcr-credentials ]; then
  source /opt/androiduse-frontend/.ghcr-credentials
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
else
  echo "Warning: GHCR credentials file not found, attempting pull with existing credentials..."
fi

echo "Pulling latest webapp image..."
docker pull ${webappImage}

echo "Restarting service..."
systemctl restart androiduse-webapp

echo "Deploy complete!"
DEPLOY
chmod +x /opt/androiduse-frontend/deploy.sh
chown androiduse:androiduse /opt/androiduse-frontend/deploy.sh

# Configure nginx
cat > /etc/nginx/sites-available/androiduse-webapp << 'NGINX'
upstream webapp {
    server 127.0.0.1:3000;
    keepalive 32;
}

# Main webapp (dev.androiduse.com, www.dev.androiduse.com)
server {
    listen 80;
    server_name ${config.domainName} www.${config.domainName};

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    location / {
        proxy_pass http://webapp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/androiduse-webapp /etc/nginx/sites-enabled/
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
systemctl enable androiduse-webapp
systemctl start androiduse-webapp
nginx -t && systemctl reload nginx

echo "Webapp initialization complete (Docker-based)!"
`;
}
