# Postiz Deployment on CentOS/Rocky with Centminmod

This guide shows how to deploy Postiz as a Docker service on a server running Centminmod (Nginx), keeping your existing sites working while adding Postiz as a new proxied service.

## Prerequisites

- CentOS 8+ or Rocky Linux 8+ with Centminmod installed
- Docker and Docker Compose installed
- A domain name (e.g., `postiz.yourdomain.com`)
- SSL certificate (Centminmod can manage this via Let's Encrypt)
- Sufficient disk space for database and uploads

## Architecture

```
Your Domain (HTTPS)
        ↓
Centminmod Nginx (Port 80/443)
        ↓
Reverse Proxy → Docker Container (Port 5000)
        ↓
Postiz App (Internal Ports 3000, 4200)
        ↓
PostgreSQL + Redis (Docker Internal)
```

## Step 1: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, to avoid sudo)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Step 2: Create Postiz Deployment Directory

```bash
# Create directory for Postiz
mkdir -p /home/postiz
cd /home/postiz

# Clone your private Postiz repo (with security fixes)
git clone https://github.com/gabelul/postiz-app-private.git .

# Or if you have it locally, copy the docker-compose file
# The official Postiz docs recommend using their tested docker-compose config
```

## Step 3: Create docker-compose.yml

Create a production-ready `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postiz-postgres:
    image: postgres:17-alpine
    container_name: postiz-postgres
    restart: always
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD:-change-me-securely}
      POSTGRES_USER: ${DB_USER:-postiz}
      POSTGRES_DB: ${DB_NAME:-postiz_db}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - postiz-network
    # Don't expose to host - only available to docker network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postiz}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  postiz-redis:
    image: redis:7-alpine
    container_name: postiz-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD:-change-me-securely}
    volumes:
      - redis-data:/data
    networks:
      - postiz-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Main Postiz Application
  postiz-app:
    image: gitroomhq/postiz:latest
    container_name: postiz-app
    restart: always
    depends_on:
      postiz-postgres:
        condition: service_healthy
      postiz-redis:
        condition: service_healthy
    environment:
      # Database Configuration
      DATABASE_URL: "postgresql://${DB_USER:-postiz}:${DB_PASSWORD:-change-me-securely}@postiz-postgres:5432/${DB_NAME:-postiz_db}"
      REDIS_URL: "redis://:${REDIS_PASSWORD:-change-me-securely}@postiz-redis:6379"

      # Application Configuration
      NODE_ENV: "production"
      PORT: "5000"

      # NextJS Configuration (frontend)
      NEXT_PUBLIC_API_URL: "https://postiz.yourdomain.com/api"
      NEXT_PUBLIC_BACKEND_URL: "https://postiz.yourdomain.com"

      # Security
      JWT_SECRET: ${JWT_SECRET:-generate-a-strong-secret-key}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY:-generate-a-strong-encryption-key}

      # Email Configuration (optional)
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM: ${SMTP_FROM:-noreply@yourdomain.com}

      # OAuth/3rd Party Integrations (configure as needed)
      # TWITTER_API_KEY: ${TWITTER_API_KEY}
      # GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      # etc.

    # Only expose port 5000 for reverse proxy (not to the world)
    ports:
      - "127.0.0.1:5000:5000"  # Localhost only

    volumes:
      - uploads:/uploads
      - app-logs:/var/log/postiz

    networks:
      - postiz-network

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
  uploads:
    driver: local
  app-logs:
    driver: local

networks:
  postiz-network:
    driver: bridge
    name: postiz-network
```

## Step 4: Create Environment File

Create `.env` file in `/home/postiz/`:

```bash
# Database Configuration
DB_USER=postiz
DB_PASSWORD=your-very-secure-password-here-min-20-chars
DB_NAME=postiz_db

# Redis Configuration
REDIS_PASSWORD=your-redis-password-min-20-chars

# Security Keys (generate with: openssl rand -base64 32)
JWT_SECRET=your-jwt-secret-key-min-32-chars
ENCRYPTION_KEY=your-encryption-key-min-32-chars

# Email Configuration (optional, for notifications)
SMTP_HOST=smtp.yourmailserver.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=noreply@yourdomain.com

# Your domain
DOMAIN=postiz.yourdomain.com

# Optional: AI Provider Keys (for the security-enhanced version)
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

**Important:** Change all passwords and secrets to strong, random values!

```bash
# Generate secure random keys:
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For ENCRYPTION_KEY
openssl rand -base64 24  # For DB_PASSWORD
openssl rand -base64 24  # For REDIS_PASSWORD
```

## Step 5: Set File Permissions

```bash
# Set restrictive permissions on .env file
chmod 600 /home/postiz/.env

# Set directory ownership
sudo chown -R postiz:postiz /home/postiz
sudo chmod 755 /home/postiz
```

## Step 6: Start Postiz Containers

```bash
cd /home/postiz

# Pull latest images
docker-compose pull

# Start services in background
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f postiz-app
```

## Step 7: Configure Centminmod Nginx Reverse Proxy

In Centminmod, add a new virtual host or update your Nginx configuration. You can use Centminmod's web UI or edit directly.

### Option A: Using Centminmod Web UI
1. Log into Centminmod control panel
2. Create new virtual host for `postiz.yourdomain.com`
3. Let it generate the basic Nginx config

### Option B: Manual Nginx Configuration

Create `/usr/local/nginx/conf/conf.d/postiz.yourdomain.com.conf`:

```nginx
# Upstream definition (backend service)
upstream postiz_backend {
    # Point to the docker container (running on localhost:5000)
    server 127.0.0.1:5000;
    keepalive 32;
}

# Server block (HTTP - redirect to HTTPS)
server {
    listen 80;
    server_name postiz.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /home/postiz/public;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Server block (HTTPS)
server {
    listen 443 ssl http2;
    server_name postiz.yourdomain.com;

    # SSL Certificates (generated by Centminmod/certbot)
    ssl_certificate /etc/letsencrypt/live/postiz.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/postiz.yourdomain.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/postiz.yourdomain.com.access.log combined;
    error_log /var/log/nginx/postiz.yourdomain.com.error.log warn;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Client upload size limit
    client_max_body_size 2G;

    # Proxy settings
    location / {
        proxy_pass http://postiz_backend;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Connection "Upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 24 4k;
        proxy_busy_buffers_size 8k;

        # Keep-alive
        proxy_set_header Connection "";
    }

    # API requests (explicit routing)
    location /api/ {
        proxy_pass http://postiz_backend;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for API
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        proxy_set_header Connection "";
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://postiz_backend;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Larger timeout for uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        client_max_body_size 2G;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://postiz_backend;
        proxy_http_version 1.1;

        # Cache for 30 days
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health check endpoint (don't log)
    location /health {
        proxy_pass http://postiz_backend;
        access_log off;
    }
}
```

## Step 8: Set Up SSL Certificate

Use Centminmod's built-in certbot or:

```bash
# Generate Let's Encrypt certificate
sudo certbot certonly --webroot -w /home/postiz/public -d postiz.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Step 9: Test & Restart Nginx

```bash
# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx

# Check Nginx status
sudo systemctl status nginx
```

## Step 10: Initialize Database

```bash
cd /home/postiz

# Run database migrations
docker-compose exec postiz-app pnpm run prisma-db-push

# Verify database is running
docker-compose logs postiz-postgres | tail -20
```

## Step 11: Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# Test the application
curl -I https://postiz.yourdomain.com

# Check logs
docker-compose logs -f postiz-app

# Monitor performance
watch -n 5 docker stats
```

## Maintenance & Troubleshooting

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postiz-app

# Nginx
tail -f /var/log/nginx/postiz.yourdomain.com.access.log
tail -f /var/log/nginx/postiz.yourdomain.com.error.log
```

### Backup Database
```bash
# Backup PostgreSQL
docker-compose exec postiz-postgres pg_dump -U postiz postiz_db > backup-$(date +%Y%m%d).sql

# Backup uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz /home/postiz/uploads
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart postiz-app

# Update images and restart
docker-compose pull && docker-compose up -d
```

### Stop Services
```bash
docker-compose down

# Keep volumes (database preserved)
docker-compose down --remove-orphans
```

## Security Best Practices

1. **Strong Passwords**: Use `openssl rand -base64 32` for all secrets
2. **Environment File**: Keep `.env` secure with proper permissions (600)
3. **Firewall**: Only expose ports 80 and 443 via Centminmod
4. **HTTPS**: Always use HTTPS in production
5. **Updates**: Regularly pull latest images: `docker-compose pull && docker-compose up -d`
6. **Monitoring**: Set up email alerts for disk space and container restarts
7. **Backups**: Automated database backups via cron job
8. **Network**: Keep Docker containers on internal network (not exposed)

## Performance Tuning

### For the Docker Compose File
```yaml
# Add resource limits
postiz-app:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G

# Increase worker processes
environment:
  MAX_WORKERS: 4
  WORKER_THREADS: 4
```

### For Nginx (in reverse proxy config)
```nginx
# Increase upstream connections
upstream postiz_backend {
    server 127.0.0.1:5000 max_fails=3 fail_timeout=30s;
    keepalive 64;
}

# Optimize proxy buffering for large uploads
proxy_buffering on;
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

## Next Steps

1. Access Postiz at `https://postiz.yourdomain.com`
2. Create your admin account
3. Configure AI providers (OpenAI, Anthropic, etc.) with your API keys
4. Set up social media integrations (Twitter, Instagram, etc.)
5. Configure cron jobs and background workers
6. Monitor logs regularly

## Support & Resources

- Postiz Official Docs: https://docs.postiz.com
- Docker Compose Docs: https://docs.docker.com/compose
- Centminmod: https://centminmod.com
- Your Private Fork: https://github.com/gabelul/postiz-app-private

---

**Last Updated:** October 2024
**Postiz Version:** Latest (from docker-compose.yml)
**Security Level:** Enterprise (with your custom security enhancements)
