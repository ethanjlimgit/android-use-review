# AndroidUse - DigitalOcean Infrastructure

Pulumi TypeScript infrastructure for deploying AndroidUse on DigitalOcean.

## Architecture

```
Agent Droplets (Backend)    → WebSocket server (wss://agent.domain.com)
Webapp Droplets (Frontend)  → Next.js app (https://domain.com)
                            → Proxies admin.domain.com to Admin Droplet
Admin Droplets (CMS)        → Admin CMS (port 3001, proxied via Webapp)
PostgreSQL (Managed)        → Shared database
Load Balancers              → Frontend LB (webapp + admin traffic) + Backend LB (agent)
```

**Traffic Flow:**
- **Agent**: Client → Backend LB → Agent Droplet → WebSocket Server
- **Webapp**: Client → Frontend LB → Webapp Droplet → Next.js App
- **Admin**: Client → Frontend LB → Webapp Droplet (nginx proxy) → Admin Droplet (private IP)

**Key Features:**
- Separate agent/webapp/admin droplets for independent scaling
- Admin accessed via webapp proxy for load balancing
- Admin CMS runs Prisma migrations on startup
- Automated Docker deployment from GHCR
- Encrypted secrets management via Pulumi
- Zero-downtime updates via systemd

## Prerequisites

- Node.js 18+ and pnpm
- Pulumi CLI (`brew install pulumi`)
- DigitalOcean account with API token
- SSH key uploaded to DigitalOcean

## Quick Start

Open https://drive.google.com/drive/u/0/folders/1QxmjhFgfLtUkFC26IVLDYp4-r1i5xWBS
Download `pumi.prod.yaml` to the project root
Download `androiduse_dev_sshkey.zip` to the ~/.ssh/ folder and unzip

```bash
# install pulumi 
brew install pulumi/tap/pulumi
# login founders@actionstatelabs.com account
pulumi login
# Install dependencies
pnpm install
# deploy the latest github ci/cd version of docker image to digital ocean
pnpm run deploy-images
```

## first time

```bash
# Install dependencies
pnpm install

# Configure DigitalOcean
export DIGITALOCEAN_TOKEN="dop_v1_..."

# Initialize stack
pulumi stack init dev
pulumi config set projectName androiduse
pulumi config set environment development
pulumi config set region nyc1
pulumi config set rootDomain androiduse.com
pulumi config set sshKeyName androiduse-dev

# Set required secrets
pulumi config set ghcrRegistry ghcr.io/yourusername
pulumi config set ghcrUsername yourusername
pulumi config set --secret ghcrToken "ghp_..."
pulumi config set imageTag latest
pulumi config set --secret authSecret "$(openssl rand -base64 32)"

# Optional: Set backend API keys
pulumi config set --secret googleApiKey "..."
pulumi config set --secret anthropicApiKey ""

# Deploy
pulumi preview
pulumi up
```

## Project Structure

```
src/
├── droplets/
│   ├── agent.ts      # Backend WebSocket server (port 8000)
│   ├── webapp.ts     # Frontend Next.js app (port 3000)
│   ├── admin.ts      # Admin CMS with Prisma migrations (port 3001)
│   └── index.ts      # Common droplet creation
├── config.ts         # Configuration loader
├── database.ts       # PostgreSQL cluster
├── dns.ts            # DNS records
├── index.ts          # Main entry
├── loadbalancer.ts   # Load balancers
├── monitoring.ts     # Alerts
└── networking.ts     # VPC, firewalls
```

## Configuration

### Infrastructure

| Key | Description | Default | Required |
|-----|-------------|---------|----------|
| `projectName` | Project name | `androiduse` | Yes |
| `environment` | Environment | - | Yes |
| `region` | DO region | `nyc1` | Yes |
| `rootDomain` | Root domain | - | Yes |
| `sshKeyName` | SSH key name | - | Yes |
| `agentSize` | Agent droplet size | `s-2vcpu-4gb` | No |
| `agentCount` | Agent instances | `1` | No |
| `webappSize` | Webapp droplet size | `s-2vcpu-2gb` | No |
| `webappCount` | Webapp instances | `1` | No |
| `adminSize` | Admin droplet size | `s-1vcpu-1gb` | No |
| `adminCount` | Admin instances | `1` | No |
| `dbSize` | Database size | `db-s-1vcpu-1gb` | No |

### Backend API Keys (Optional)

```bash
pulumi config set --secret googleApiKey "..."
pulumi config set --secret openaiApiKey ""
pulumi config set --secret anthropicApiKey ""
pulumi config set --secret deepseekApiKey "..."
pulumi config set --secret groqApiKey ""
pulumi config set --secret posthogApiKey "phc_..."
pulumi config set --secret langfuseSecretKey "sk-lf-..."
pulumi config set --secret langfusePublicKey "pk-lf-..."
pulumi config set langfuseHost "https://cloud.langfuse.com"
```

## Commands

```bash
pnpm build              # Build TypeScript
pnpm preview            # Preview changes
pnpm up                 # Deploy infrastructure
pnpm destroy            # Destroy all resources

# Deploy updated Docker images (no infrastructure changes)
pnpm deploy-images              # All components
pnpm deploy-images:frontend     # Only frontend
pnpm deploy-images:backend      # Only backend
pnpm deploy-images:admin        # Only admin

# Stack management
pnpm stack:dev          # Switch to dev stack
pnpm stack:prod         # Switch to prod stack

# View outputs
pulumi stack output
pulumi stack output databaseConnectionString --show-secrets
```

## Deployment Flow

### Initial Deployment
1. Pulumi creates VPC, database, droplets, load balancers
2. Admin droplet runs Prisma migration on startup (from Docker image)
3. Droplets pull Docker images from GHCR
4. Services start automatically via systemd

### Image Updates
```bash
# Build and push new images to GHCR
cd droiduse-frontend && ./build-deploy.sh
cd droiduse-backend && docker build -t ... && docker push ...

# Deploy to droplets (zero-downtime)
pnpm deploy-images
```

## Scaling

```bash
# Horizontal scaling
pulumi config set agentCount 3
pulumi config set webappCount 2
pulumi up

# Vertical scaling
pulumi config set agentSize s-4vcpu-8gb
pulumi config set dbSize db-s-2vcpu-4gb
pulumi config set dbNodeCount 2  # Enable HA
pulumi up
```

## DNS Records

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `domain.com` | Frontend LB | Main app |
| `www.domain.com` | Frontend LB | Alias |
| `api.domain.com` | Frontend LB | API routes |
| `agent.domain.com` | Backend LB | WebSocket (wss://) |
| `admin.domain.com` | Frontend LB | Admin CMS (proxied via webapp) |

## Prisma Migrations

The admin droplet automatically runs Prisma migrations on startup:

```bash
# In admin.ts cloud-init script
docker run --rm \
  --env-file /opt/androiduse-admin/.env \
  ${adminImage} \
  sh -c "npm install -g prisma && prisma db:push --schema=/app/packages/shared-prisma/prisma/schema.prisma"
```

**Note:** Migrations run once during droplet creation. For subsequent schema updates:
1. Push new admin image with updated schema
2. SSH into admin droplet: `$(pulumi stack output sshAdminCommand)`
3. Run migration manually or restart service

## Troubleshooting

### Check service status
```bash
# SSH into droplets
$(pulumi stack output sshAgentCommand)
$(pulumi stack output sshWebappCommand)
$(pulumi stack output sshAdminCommand)

# Check logs
sudo journalctl -u androiduse-agent -f
sudo journalctl -u androiduse-webapp -f
sudo journalctl -u androiduse-admin -f
```

### Database connection
```bash
psql "$(pulumi stack output databaseConnectionString --show-secrets)"
```

### Migration issues
```bash
# Check migration status
docker run --rm --env-file /opt/androiduse-admin/.env ${adminImage} \
  sh -c "npm install -g prisma && prisma db:push --schema=/app/packages/shared-prisma/prisma/schema.prisma"
```

## Cost Estimates

### Development (~$51/month)
- Agent (s-1vcpu-2gb): $12
- Webapp (s-1vcpu-2gb): $12
- Admin (s-1vcpu-1gb): $6
- PostgreSQL (db-s-1vcpu-1gb): $15
- Load Balancers (2x): $24

### Production (~$200/month)
- Agent 2x (s-2vcpu-4gb): $48
- Webapp 2x (s-2vcpu-2gb): $36
- Admin (s-1vcpu-1gb): $6
- PostgreSQL HA (db-s-2vcpu-4gb, 2 nodes): $60
- Load Balancers (2x): $24
- Backups: ~$20

## Security

- Admin CMS proxied through webapp (load balanced)
- Admin runs on private network (no public IP exposure)
- API keys encrypted in Pulumi state
- config.yaml has 600 permissions
- VPC isolation for droplets
- Firewall rules restrict database access

## CI/CD Example

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pulumi/setup-pulumi@v2
      - run: pnpm install && pulumi up --yes
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
          DIGITALOCEAN_TOKEN: ${{ secrets.DIGITALOCEAN_TOKEN }}
```

## Support

For issues, open a GitHub issue or check the main CLAUDE.md at the repository root.
