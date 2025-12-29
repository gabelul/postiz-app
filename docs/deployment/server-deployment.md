# Server Deployment Guide

Complete guide for deploying Postiz on your own server using Docker and the included deployment script.

## Prerequisites

Your server needs:

- **Operating System**: Linux (Ubuntu 20.04+, Debian 11+, or similar)
- **RAM**: At least 2GB (4GB+ recommended)
- **Disk Space**: At least 10GB free
- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later

### Installing Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group (optional)
usermod -aG docker your-username

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

## Initial Setup

### 1. Clone the Repository

```bash
# Choose a location for the application
cd /opt

# Clone your fork of the repository
git clone https://github.com/your-username/postiz-app.git
cd postiz-app
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

**Required settings in `.env`:**

```bash
# Database
POSTGRES_PASSWORD=your-secure-password

# Redis
REDIS_PASSWORD=your-secure-redis-password

# Security (generate random strings)
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-encryption-key-min-32-chars

# Domain (optional, for production)
NEXT_PUBLIC_API_URL=https://your-domain.com/api
FRONTEND_URL=https://your-domain.com
```

### 3. Deploy

```bash
# Run the deployment script
./deploy.sh
```

Follow the prompts:
- Option 1: Full setup (build + start) - Recommended for first time
- Option 2: Build only
- Option 3: Start existing containers

The script will:
1. Check prerequisites (Docker, Docker Compose)
2. Create `.env` file if missing
3. Build the Docker image (10-20 minutes)
4. Start all containers
5. Run database migrations
6. Show status

## First Run

1. **Access your instance**: Open `http://your-server-ip:4200` in your browser
2. **Create your account**: The first registered user automatically becomes the system admin
3. **Access admin panel**: Navigate to `http://your-server-ip:4200/admin`

## Deploy Script Options

The `deploy.sh` script supports multiple modes:

| Command | Description |
|---------|-------------|
| `./deploy.sh` | Interactive menu with all options |
| `./deploy.sh --update` | Pull latest code, rebuild (optional), and restart |
| `./deploy.sh --rebuild` | Rebuild Docker image from scratch and restart |
| `./deploy.sh --start` | Start containers without rebuilding |

## Interactive Menu

Run `./deploy.sh` without arguments to access the menu:

```
╔══════════════════════════════════════════════════════════╗
║  Postiz Deployment Menu                                   ║
╚══════════════════════════════════════════════════════════╝

  1) Start containers
  2) Stop containers
  3) Restart containers
  4) Update (git pull + restart)
  5) Rebuild from scratch
  6) View logs
  7) View status
  8) Run database migrations
  9) Enter shell
  0) Exit
```

## Updating Your Deployment

When you pull updates from the repository:

```bash
# Option 1: Use the update command (recommended)
./deploy.sh --update

# Option 2: Use the interactive menu
./deploy.sh
# Choose option 4 for Update

# Option 3: Manual update
git pull
./deploy.sh --rebuild
```

## Troubleshooting

### View Logs

```bash
# Using the script
./deploy.sh
# Choose option 6 for View logs

# Or directly with docker-compose
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart All Services

```bash
./deploy.sh
# Choose option 3 for Restart containers
```

### Enter Container Shell

```bash
./deploy.sh
# Choose option 9 for Enter shell
# Select the container you want to access
```

### Rebuild from Scratch

If you encounter issues, rebuilding from scratch often helps:

```bash
./deploy.sh --rebuild
```

This will:
1. Stop all containers
2. Remove old images
3. Build fresh image
4. Restart services

### Check Container Status

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Database Issues

If you have database problems, you can run migrations manually:

```bash
docker-compose -f docker-compose.prod.yml exec postiz-app \
  npx prisma migrate deploy \
  --schema=./libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

## File Locations

After deployment:

| Path | Description |
|------|-------------|
| `/opt/postiz-app/` | Application directory |
| `/opt/postiz-app/.env` | Environment configuration (NOT in git) |
| `/opt/postiz-app/uploads/` | User uploads (if using local storage) |

## Ports

By default, Postiz uses these ports:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 4200 | Next.js web application |
| Backend | 32456 | API server |

You can change these by setting environment variables before starting:

```bash
export BACKEND_PORT=9000
export FRONTEND_PORT=3000
./deploy.sh --start
```

## Security Considerations

1. **Change default passwords** in `.env` before first run
2. **Use HTTPS** in production (configure reverse proxy like Nginx)
3. **Keep `.env` private** - Never commit it to git
4. **Update regularly** - Run `./deploy.sh --update` to get security patches
5. **Back up your data** - The database volume persists in Docker but backups are recommended

## Next Steps

After deployment:

1. **Configure reverse proxy** (Nginx, Caddy) for HTTPS
2. **Set up AI providers** in Settings > AI Providers
3. **Configure email** for notifications (optional)
4. **Set up social media integrations**
5. **Review admin panel** at `/admin`

## Getting Help

If you encounter issues:

1. Check the logs: `./deploy.sh` → option 6
2. Review the [Troubleshooting](../troubleshooting/) section
3. Check the [Checklist](checklist.md) for common issues
4. Open an issue on GitHub
