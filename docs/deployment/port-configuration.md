# Postiz Deployment Guide

## Local Testing (Development)

Run with default ports (4200 for frontend, 32456 for backend):

```bash
docker-compose -f docker-compose.prod.yml up -d
docker exec -d postiz-app pnpm run start:prod:frontend
```

Access at:
- Frontend: http://localhost:4200
- Backend API: http://localhost:32456

---

## Production Deployment with Custom/Random Ports

Since you have other services running on port 4200 and 32456, use random or custom ports to avoid conflicts.

### Option 1: Use Random Ports via Environment Variables

```bash
# Start with custom ports (example: 9001 and 9002)
BACKEND_PORT=9001 FRONTEND_PORT=9002 \
  NEXT_PUBLIC_API_URL="http://localhost:9001/api" \
  NEXT_PUBLIC_BACKEND_URL="http://localhost:9001" \
  docker-compose -f docker-compose.prod.yml up -d

# Start the frontend service
docker exec -d postiz-app pnpm run start:prod:frontend

# Verify
docker-compose -f docker-compose.prod.yml ps
```

Access at:
- Frontend: http://localhost:9002
- Backend API: http://localhost:9001

### Option 2: Use .env File for Production Configuration

Create `.env.prod`:

```env
# Production port configuration
BACKEND_PORT=9001
FRONTEND_PORT=9002

# Frontend API URLs (must match the ports above)
NEXT_PUBLIC_API_URL=http://localhost:9001/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:9001

# Database and security
DB_USER=postiz-local
DB_PASSWORD=postiz-local-pwd
DB_NAME=postiz-db-local
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-here
```

Then deploy:

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
docker exec -d postiz-app pnpm run start:prod:frontend
```

### Option 3: Reverse Proxy with Domain (Recommended for Production)

When using a reverse proxy (Nginx/Centminmod), you typically only expose internal ports and use your domain:

```env
# Use any high ports internally
BACKEND_PORT=9001
FRONTEND_PORT=9002

# Frontend talks to your domain (via reverse proxy)
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com

# Security and database config
DB_USER=postiz-local
DB_PASSWORD=postiz-local-pwd
DB_NAME=postiz-db-local
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-here
```

**Reverse Proxy Configuration (Nginx example):**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:9002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:9001;
        proxy_http_version 1.1;
    }
}
```

---

## Port Configuration Breakdown

### Scenario 1: Local Testing
```
BACKEND_PORT=32456 (default)
FRONTEND_PORT=4200 (default)
NEXT_PUBLIC_API_URL=http://localhost:32456/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:32456
```

### Scenario 2: Production (No Reverse Proxy, Direct Access)
```
BACKEND_PORT=9001 (custom to avoid conflicts)
FRONTEND_PORT=9002 (custom to avoid conflicts)
NEXT_PUBLIC_API_URL=http://your-server:9001/api
NEXT_PUBLIC_BACKEND_URL=http://your-server:9001
```

### Scenario 3: Production (With Reverse Proxy)
```
BACKEND_PORT=9001 (internal, not exposed)
FRONTEND_PORT=9002 (internal, not exposed)
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com
(Reverse proxy handles the routing)
```

---

## Important Notes

1. **Port Flexibility**: Both `BACKEND_PORT` and `FRONTEND_PORT` are fully configurable
2. **Frontend URLs**: When changing ports, always update `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BACKEND_URL` to match
3. **Docker Compose**: The format `${VAR:-default}` means "use VAR if set, otherwise use default"
4. **Restart Frontend**: When you change ports or frontend URLs, restart the frontend service:
   ```bash
   docker exec postiz-app pkill -f "pnpm run start:prod:frontend"
   docker exec -d postiz-app pnpm run start:prod:frontend
   ```

---

## Checking Which Ports Are In Use

```bash
# Check active containers and their ports
docker-compose -f docker-compose.prod.yml ps

# Check if a specific port is available
lsof -i :9001
lsof -i :9002
```

---

## Summary

You now have complete flexibility to:
- Use default ports for local testing (no configuration needed)
- Use custom ports for production to avoid conflicts
- Use a reverse proxy to serve from your domain with HTTPS
- Change ports anytime by setting environment variables before `docker-compose up`
