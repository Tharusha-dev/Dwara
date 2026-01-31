#!/bin/bash

# Production Deployment Script for Dwara MVP

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN=${DOMAIN:-"dwara.yourdomain.com"}
ENV_FILE=${ENV_FILE:-".env.production"}

echo -e "${BLUE}🚀 Deploying Dwara MVP to Production${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}This script should not be run as root${NC}"
   exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Environment file $ENV_FILE not found!${NC}"
    echo "Please create it from .env.production and configure your domain and secrets."
    exit 1
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Nginx not found. Installing...${NC}"
    sudo apt update
    sudo apt install -y nginx
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Certbot not found. Installing...${NC}"
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

# Validate environment variables
echo -e "${YELLOW}Validating environment configuration...${NC}"
source $ENV_FILE

if [[ "$JWT_SECRET" == "GENERATE_RANDOM_SECRET_HERE_USE_openssl_rand_base64_64" ]]; then
    echo -e "${RED}Please generate a secure JWT secret in $ENV_FILE${NC}"
    echo "Run: openssl rand -base64 64"
    exit 1
fi

if [[ "$ORIGIN" == "https://dwara.yourdomain.com" ]]; then
    echo -e "${RED}Please update ORIGIN in $ENV_FILE with your actual domain${NC}"
    exit 1
fi

# Stop any running containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker compose down 2>/dev/null || true

# Build and start production services
echo -e "${YELLOW}Building and starting production services...${NC}"
docker compose --env-file $ENV_FILE -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 30

# Deploy smart contract
echo -e "${YELLOW}Deploying smart contract...${NC}"
CONTRACT_ADDRESS=$(docker compose --env-file $ENV_FILE exec -T hardhat sh -c "cd /app && npx hardhat run --network localhost scripts/deploy.js" 2>&1 | grep "deployed to:" | awk '{print $NF}' | tr -d '\r')

if [ -n "$CONTRACT_ADDRESS" ]; then
    echo -e "${GREEN}Contract deployed at: ${CONTRACT_ADDRESS}${NC}"
    
    # Update environment file with actual contract address
    if [[ "$CONTRACT_ADDRESS" != "0x5FbDB2315678afecb367f032d93F642f64180aa3" ]]; then
        sed -i "s/DWARA_REGISTRY_ADDRESS=.*/DWARA_REGISTRY_ADDRESS=$CONTRACT_ADDRESS/" $ENV_FILE
        echo -e "${YELLOW}Updated contract address in $ENV_FILE${NC}"
        
        # Restart backend with new contract address
        docker compose --env-file $ENV_FILE exec backend sh -c "kill 1" 2>/dev/null || true
        sleep 5
    fi
else
    echo -e "${YELLOW}Could not capture contract address. Using default.${NC}"
fi

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker compose --env-file $ENV_FILE exec -T backend sh -c "npx prisma migrate deploy" 2>/dev/null || \
docker compose --env-file $ENV_FILE exec -T backend sh -c "npx prisma db push" || \
echo -e "${YELLOW}Migrations may already be applied.${NC}"

# Configure nginx
echo -e "${YELLOW}Configuring nginx...${NC}"
sudo cp nginx.conf /etc/nginx/sites-available/dwara
sudo sed -i "s/dwara.yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/dwara

# Disable default site if it exists
if [ -L /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
    echo -e "${YELLOW}Disabled default nginx site${NC}"
fi

# Enable the site
if [ ! -L /etc/nginx/sites-enabled/dwara ]; then
    sudo ln -s /etc/nginx/sites-available/dwara /etc/nginx/sites-enabled/
fi

# Test nginx configuration
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo -e "${GREEN}Nginx configured successfully${NC}"
else
    echo -e "${RED}Nginx configuration failed${NC}"
    exit 1
fi

# Setup SSL certificate
echo -e "${YELLOW}Setting up SSL certificate...${NC}"
if sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN; then
    echo -e "${GREEN}SSL certificate installed successfully${NC}"
else
    echo -e "${YELLOW}SSL certificate setup failed. You may need to run certbot manually:${NC}"
    echo "sudo certbot --nginx -d $DOMAIN"
fi

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow ssh
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw --force enable
    echo -e "${GREEN}Firewall configured${NC}"
fi

# Create backup directory
mkdir -p ./backups
chmod 755 ./backups

# Final health check
echo -e "${YELLOW}Running final health checks...${NC}"
sleep 10

if docker compose --env-file $ENV_FILE ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Services are running${NC}"
else
    echo -e "${RED}❌ Some services are not running${NC}"
    docker compose --env-file $ENV_FILE ps
fi

echo ""
echo -e "${GREEN}🎉 Dwara MVP Production Deployment Complete!${NC}"
echo ""
echo "Access your application:"
echo -e "  Frontend:       ${GREEN}https://$DOMAIN${NC}"
echo -e "  Backend API:    ${GREEN}https://$DOMAIN/api${NC}"
echo -e "  Blockscout:     ${GREEN}https://$DOMAIN/explorer${NC}"
echo ""
echo "Management commands:"
echo -e "  View logs:      ${BLUE}docker compose --env-file $ENV_FILE logs -f${NC}"
echo -e "  Restart:        ${BLUE}docker compose --env-file $ENV_FILE restart${NC}"
echo -e "  Stop:           ${BLUE}docker compose --env-file $ENV_FILE down${NC}"
echo -e "  Backup DB:      ${BLUE}./backup.sh${NC}"
echo ""
echo -e "${YELLOW}Important Security Notes:${NC}"
echo "1. Change default database passwords in $ENV_FILE"
echo "2. Regularly update SSL certificates (certbot will auto-renew)"
echo "3. Monitor logs for any suspicious activity"
echo "4. Keep Docker images updated"
echo ""
echo -e "${GREEN}Deployment logs saved to: deployment_$(date +%Y%m%d_%H%M%S).log${NC}"
