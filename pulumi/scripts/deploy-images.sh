#!/bin/bash
set -e

# Deploy updated Docker images to running droplets
# Usage: ./scripts/deploy-images.sh [frontend|backend|admin|all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
TARGET="${1:-all}"

# Function to deploy to a droplet
deploy_to_droplet() {
  local droplet_ip=$1
  local droplet_type=$2
  local deploy_script=$3

  echo -e "${YELLOW}Deploying to ${droplet_type} droplet (${droplet_ip})...${NC}"

  ssh -i ~/.ssh/androiduse_dev -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@"${droplet_ip}" << EOF
set -e
cd ${deploy_script%/*}
bash ${deploy_script}
EOF

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully deployed to ${droplet_type} droplet${NC}"
  else
    echo -e "${RED}✗ Failed to deploy to ${droplet_type} droplet${NC}"
    return 1
  fi
}

# Function to get Pulumi stack output
get_output() {
  local output_name=$1
  cd "$PROJECT_DIR"
  pulumi stack output "$output_name" --json 2>/dev/null | jq -r '.[]' 2>/dev/null || echo ""
}

# Get droplet IPs based on target
echo -e "${YELLOW}Fetching droplet IPs from Pulumi stack...${NC}"

if [ "$TARGET" == "frontend" ] || [ "$TARGET" == "all" ]; then
  WEBAPP_IPS=$(get_output webappPublicIps)
fi

if [ "$TARGET" == "backend" ] || [ "$TARGET" == "all" ]; then
  AGENT_IPS=$(get_output agentPublicIps)
fi

if [ "$TARGET" == "admin" ] || [ "$TARGET" == "all" ]; then
  ADMIN_IPS=$(get_output adminPublicIps)
fi

# Deploy to admin droplets first (schema updates)
if [ -n "$ADMIN_IPS" ]; then
  echo -e "\n${GREEN}=== Deploying to Admin Droplets ===${NC}"
  for ip in $ADMIN_IPS; do
    deploy_to_droplet "$ip" "admin" "/opt/androiduse-admin/deploy.sh"
  done
fi

# Deploy to webapp droplets
if [ -n "$WEBAPP_IPS" ]; then
  echo -e "\n${GREEN}=== Deploying to Frontend Droplets ===${NC}"
  for ip in $WEBAPP_IPS; do
    deploy_to_droplet "$ip" "frontend" "/opt/androiduse-frontend/deploy.sh"
  done
fi

# Deploy to agent droplets
if [ -n "$AGENT_IPS" ]; then
  echo -e "\n${GREEN}=== Deploying to Backend Droplets ===${NC}"
  for ip in $AGENT_IPS; do
    deploy_to_droplet "$ip" "backend" "/opt/androiduse-backend/deploy.sh"
  done
fi

echo -e "\n${GREEN}✓ Deployment complete!${NC}"
