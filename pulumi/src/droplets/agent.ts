import * as pulumi from "@pulumi/pulumi";
import { InfraConfig } from "../config.js";

/**
 * Generate agent (backend WebSocket server) cloud-init user data (Docker-based)
 */
export function agentUserData(
  config: InfraConfig,
  databaseUrl: pulumi.Input<string>,
  index: number = 0
): pulumi.Output<string> {
  const agentImage = `${config.ghcrRegistry}/androiduse-agent:${config.imageTag}`;
  const serverName = `agent-${config.environment}-${index + 1}`;

  return pulumi.interpolate`#!/bin/bash
set -e

# Logging
exec > >(tee /var/log/cloud-init-output.log) 2>&1
echo "Starting agent (backend) initialization (Docker-based)..."

# Update system
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install Docker
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-nginx wget jq htop ufw

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
mkdir -p /opt/androiduse-backend
chown androiduse:androiduse /opt/androiduse-backend

# Authenticate to GitHub Container Registry
echo "Authenticating to GHCR..."
echo "${config.ghcrToken}" | docker login ghcr.io -u ${config.ghcrUsername} --password-stdin

# Store credentials for the androiduse user as well
mkdir -p /home/androiduse/.docker
cp /root/.docker/config.json /home/androiduse/.docker/config.json
chown -R androiduse:androiduse /home/androiduse/.docker

# Store GHCR credentials for deploy script to re-authenticate
cat > /opt/androiduse-backend/.ghcr-credentials << GHCRCREDS
GHCR_USERNAME=${config.ghcrUsername}
GHCR_TOKEN=${config.ghcrToken}
GHCRCREDS
chmod 600 /opt/androiduse-backend/.ghcr-credentials
chown root:root /opt/androiduse-backend/.ghcr-credentials

# Create environment file (no quotes for Docker .env format)
# Note: API keys should be configured in config.yaml, not here
cat > /opt/androiduse-backend/.env << EOF
ENVIRONMENT=${config.environment}
EOF
chown androiduse:androiduse /opt/androiduse-backend/.env
chmod 600 /opt/androiduse-backend/.env

# Create backend config.yaml with Pulumi configuration values
# Only include configuration that comes from Pulumi
# Other settings will use backend defaults or be configured manually
cat > /opt/androiduse-backend/config.yaml << 'CONFIGEOF'
# DroidUse Backend Configuration (Pulumi-managed values only)
# This file was auto-generated from Pulumi configuration
# To customize other settings, SSH into the server and edit this file
# After editing, restart the service: systemctl restart androiduse-agent

# === API Keys ===
api_keys:
  google_api_key: "${config.googleApiKey ?? ""}"
  openai_api_key: "${config.openaiApiKey ?? ""}"
  anthropic_api_key: "${config.anthropicApiKey ?? ""}"
  deepseek_api_key: "${config.deepseekApiKey ?? ""}"
  groq_api_key: "${config.groqApiKey ?? ""}"

# === Agent Settings ===
agent:
  enable_reasoning: ${config.agentEnableReasoning}

# === Plugin Settings ===
plugins:
  # PostHog Telemetry
  posthog_telemetry:
    enabled: ${config.posthogApiKey ? "true" : "false"}
    api_key: "${config.posthogApiKey ?? ""}"
    host: "https://app.posthog.com"

  # Tracing Plugin (Langfuse)
  tracing:
    enabled: ${config.langfuseSecretKey ? "true" : "false"}
    provider: langfuse
    langfuse_secret_key: "${config.langfuseSecretKey ?? ""}"
    langfuse_public_key: "${config.langfusePublicKey ?? ""}"
    langfuse_host: "${config.langfuseHost}"

# === WebSocket Server Settings ===
websocket_server:
  web_api_url: "https://${config.domainName}/api"
  web_api_auth_secret: "${config.authSecret}"

  # Server metadata
  public_ip_address: ""  # Auto-detected if empty
  server_name: "${serverName}"
  server_region: "${config.region ?? "us-east"}"

# === Heartbeat Server Settings ===
heartbeat_server:
  enabled: true
  heartbeat_api_url: "https://admin.${config.domainName}"

# === Transcription Service Settings ===
transcription:
  enabled: true
  elevenlabs_api_key: "${config.elevenlabsApiKey ?? ""}"
  play_audio: false
CONFIGEOF
chown androiduse:androiduse /opt/androiduse-backend/config.yaml
chmod 600 /opt/androiduse-backend/config.yaml

# Pull agent container image
echo "Pulling agent container image from GHCR..."
docker pull ${agentImage}

# Create agent systemd service (Docker)
cat > /etc/systemd/system/androiduse-agent.service << 'EOF'
[Unit]
Description=AndroidUse Agent API (Docker)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker stop androiduse-agent
ExecStartPre=-/usr/bin/docker rm androiduse-agent
ExecStart=/usr/bin/docker run --rm --name androiduse-agent \\
    --env-file /opt/androiduse-backend/.env \\
    -v /opt/androiduse-backend/config.yaml:/app/config.yaml:ro \\
    -p 127.0.0.1:8000:8000 \\
    ${agentImage} serve --host 0.0.0.0 --port 8000 --config /app/config.yaml
ExecStop=/usr/bin/docker stop androiduse-agent

[Install]
WantedBy=multi-user.target
EOF

# Create deploy script for easy updates
cat > /opt/androiduse-backend/deploy.sh << 'DEPLOY'
#!/bin/bash
set -e

# Login to GHCR first to ensure authentication is valid
echo "Authenticating to GHCR..."
if [ -f /opt/androiduse-backend/.ghcr-credentials ]; then
  source /opt/androiduse-backend/.ghcr-credentials
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
else
  echo "Warning: GHCR credentials file not found, attempting pull with existing credentials..."
fi

echo "Pulling latest agent image..."
docker pull ${agentImage}

echo "Restarting service..."
systemctl restart androiduse-agent

echo "Deploy complete!"
echo "Note: config.yaml and .env files are preserved during deployment"
DEPLOY
chmod +x /opt/androiduse-backend/deploy.sh
chown androiduse:androiduse /opt/androiduse-backend/deploy.sh

# Configure nginx
cat > /etc/nginx/sites-available/androiduse-agent << 'NGINX'
upstream agent {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name agent.${config.domainName};

    location /health {
        proxy_pass http://agent/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    location / {
        proxy_pass http://agent;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/androiduse-agent /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 8000/tcp
ufw --force enable

# Install monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash || true

# Enable services
systemctl daemon-reload
systemctl enable androiduse-agent
systemctl start androiduse-agent
nginx -t && systemctl reload nginx

echo "Agent initialization complete (Docker-based)!"
`;
}
