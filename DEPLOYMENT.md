# Dwara MVP - VPS Deployment Guide

## Prerequisites

1. **VPS Setup**:
   - Ubuntu 22.04 LTS (recommended)
   - At least 2GB RAM, 2 vCPUs
   - 20GB+ storage
   - Public IP address

2. **Domain Configuration**:
   - Point your domain (e.g., `dwara.yourdomain.com`) to your VPS IP
   - DNS A record: `dwara.yourdomain.com` → `YOUR_VPS_IP`

3. **Ports to Open**:
   - 22 (SSH)
   - 80 (HTTP)
   - 443 (HTTPS)
   - All other ports will be handled internally via nginx reverse proxy

## Step-by-Step Deployment

### 1. Initial VPS Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install nginx and certbot for SSL
sudo apt install -y nginx certbot python3-certbot-nginx git

# Logout and login again for docker group to take effect
exit
```

### 2. Clone and Configure Project

```bash
# Clone your repository
git clone <your-repo-url> dwara-mvp
cd dwara-mvp

# Copy production environment template
cp .env.example .env.production
```

### 3. Update Environment Variables

Edit `.env.production` with your domain:

```env
# Production Environment Variables
DWARA_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
JWT_SECRET=GENERATE_RANDOM_SECRET_HERE
ORIGIN=https://dwara.yourdomain.com
NEXT_PUBLIC_API_URL=https://dwara.yourdomain.com/api
```

**Important**: Generate a secure JWT secret:
```bash
openssl rand -base64 64
```

### 4. Configure Nginx Reverse Proxy

Create nginx configuration file: `/etc/nginx/sites-available/dwara`

### 5. SSL Certificate Setup

After nginx is configured:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/dwara /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d dwara.yourdomain.com
```

### 6. Start Production Services

```bash
# Use production environment
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# Deploy contract
docker compose exec hardhat npx hardhat run --network localhost scripts/deploy.js

# Update .env.production with the actual contract address if different

# Run database migrations
docker compose exec backend npx prisma migrate deploy
```

### 7. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## Security Considerations

### 1. Environment Variables
- Use strong, unique passwords for PostgreSQL
- Generate a secure JWT secret (64+ characters)
- Consider using Docker secrets for sensitive data

### 2. SSL/TLS
- Always use HTTPS in production (required for WebAuthn)
- Enable HSTS headers
- Consider additional security headers

### 3. Database Security
- Change default database passwords
- Restrict database access to localhost only
- Enable PostgreSQL SSL if needed

### 4. Container Security
- Run containers as non-root users
- Use specific image tags instead of `:latest`
- Regularly update base images

### 5. Monitoring & Logging
- Set up log rotation
- Monitor disk space (blockchain data grows)
- Consider using Docker logging drivers

## Backup Strategy

### 1. Database Backups
```bash
# Automated PostgreSQL backup
docker compose exec postgres pg_dump -U app dwara > backup_$(date +%Y%m%d).sql
```

### 2. Blockchain Data
- Hardhat data is ephemeral by default
- For persistent blockchain state, mount hardhat data volume

### 3. Application Code
- Keep your git repository updated
- Tag releases for rollback capability

## Troubleshooting

### WebAuthn Issues
- Ensure ORIGIN matches exactly: `https://dwara.yourdomain.com`
- Check that SSL certificate is valid
- Verify domain is accessible from public internet

### Container Issues
```bash
# View logs
docker compose logs -f [service_name]

# Check container status
docker compose ps

# Restart services
docker compose restart [service_name]
```

### Database Connection Issues
```bash
# Test database connection
docker compose exec backend npx prisma db push --preview-feature
```

## Performance Optimization

### 1. Resource Limits
Set appropriate resource limits in docker-compose.prod.yml

### 2. Caching
- Enable nginx caching for static assets
- Configure Redis for session storage if scaling

### 3. Database
- Tune PostgreSQL settings for your VPS size
- Consider connection pooling for high load

## Monitoring Commands

```bash
# Check system resources
htop
df -h

# Monitor Docker containers
docker stats

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log

# Check application logs
docker compose logs -f --tail=100
```
