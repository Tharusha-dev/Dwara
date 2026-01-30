#!/bin/bash

# Dwara MVP Startup Script

set -e

echo "🚀 Starting Dwara MVP..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start services
echo -e "${YELLOW}Starting Docker services...${NC}"
docker compose up -d --build

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Deploy contract
echo -e "${YELLOW}Deploying smart contract...${NC}"
CONTRACT_ADDRESS=$(docker compose exec -T hardhat sh -c "cd /app && npx hardhat run --network localhost scripts/deploy.js" 2>&1 | grep "deployed to:" | awk '{print $NF}')

if [ -n "$CONTRACT_ADDRESS" ]; then
    echo -e "${GREEN}Contract deployed at: ${CONTRACT_ADDRESS}${NC}"
else
    echo -e "${YELLOW}Contract may already be deployed or deployment output not captured.${NC}"
    CONTRACT_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"
fi

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker compose exec -T backend sh -c "npx prisma migrate deploy" 2>/dev/null || \
docker compose exec -T backend sh -c "npx prisma db push" 2>/dev/null || \
echo -e "${YELLOW}Migrations may already be applied.${NC}"

echo ""
echo -e "${GREEN}✅ Dwara MVP is ready!${NC}"
echo ""
echo "Access the application:"
echo -e "  Frontend:       ${GREEN}http://localhost:3000${NC}"
echo -e "  Backend API:    ${GREEN}http://localhost:4000${NC}"
echo -e "  Blockscout:     ${GREEN}http://localhost:4001${NC}"
echo -e "  Hardhat RPC:    ${GREEN}http://localhost:8545${NC}"
echo ""
echo "To view logs:"
echo "  docker compose logs -f"
echo ""
echo "To stop:"
echo "  docker compose down"
