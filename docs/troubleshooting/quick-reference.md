# Postiz Quick Reference Guide

## 🚀 Starting the Application

```bash
# Start all services (default ports)
docker-compose -f docker-compose.prod.yml up -d

# Start frontend if not running
docker-compose -f docker-compose.prod.yml exec -d postiz-app pnpm run start:prod:frontend

# View logs
docker-compose -f docker-compose.prod.yml logs -f postiz-app
```

## 🌐 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:4200 | Web application |
| Backend API | http://localhost:32456 | REST API endpoints |
| Database | localhost:5432 | PostgreSQL (internal) |
| Cache | localhost:6379 | Redis (internal) |

## 🔨 Common Tasks

### Check Running Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### View Backend Logs
```bash
docker-compose -f docker-compose.prod.yml logs postiz-app --tail=50
```

### Run Database Migrations
```bash
docker-compose -f docker-compose.prod.yml exec postiz-app pnpm run prisma-db-push
```

### Restart Services
```bash
docker-compose -f docker-compose.prod.yml restart postiz-app
```

### Stop All Services
```bash
docker-compose -f docker-compose.prod.yml down
```

### Stop and Remove Volumes (Reset Everything)
```bash
docker-compose -f docker-compose.prod.yml down -v
```

## 🐛 Troubleshooting

### Frontend Not Responding
```bash
# Check if process is running
docker-compose -f docker-compose.prod.yml exec postiz-app ps aux | grep next

# Start frontend manually
docker-compose -f docker-compose.prod.yml exec -d postiz-app pnpm run start:prod:frontend
```

### CORS Errors
```bash
# Verify FRONTEND_URL is set
docker-compose -f docker-compose.prod.yml exec postiz-app env | grep FRONTEND_URL

# Test CORS with OPTIONS request
curl -i -X OPTIONS http://localhost:32456/auth/login \
  -H "Origin: http://localhost:4200"
```

### Database Connection Issues
```bash
# Check database is healthy
docker-compose -f docker-compose.prod.yml exec postiz-postgres pg_isready -U postiz-local

# Sync database schema
docker-compose -f docker-compose.prod.yml exec postiz-app pnpm run prisma-db-push
```

### Port Already in Use
```bash
# Check which process is using a port
lsof -i :4200    # Frontend
lsof -i :32456   # Backend
lsof -i :5432    # Database

# Use custom ports instead
BACKEND_PORT=9001 FRONTEND_PORT=9002 \
  docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Environment Variables

**Required for Production:**
```env
JWT_SECRET=<secure-random-string>
ENCRYPTION_KEY=<secure-random-string>
NEXT_PUBLIC_API_URL=<your-api-url>
NEXT_PUBLIC_BACKEND_URL=<your-backend-url>
```

**Optional:**
```env
SMTP_HOST=<smtp-server>
SMTP_PORT=587
OPENAI_API_KEY=<if-using-openai>
DISABLE_MASTRA=true  # Disable AI features
```

## 🔄 Development Workflow

1. **Make code changes** in your source files
2. **Rebuild Docker image** (if Dockerfile changes):
   ```bash
   docker build -t postiz:latest -f Dockerfile.production .
   ```
3. **Restart services**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart postiz-app
   ```
4. **Test changes** at http://localhost:4200

## 📊 Key Files

| File | Purpose |
|------|---------|
| Dockerfile.production | Container build configuration |
| docker-compose.prod.yml | Service orchestration |
| deployment.md | Detailed deployment guide |
| CONVERSATION_SUMMARY.md | Full session documentation |

## ✅ Known Working

- ✅ Frontend loads and renders
- ✅ Backend API responds to requests
- ✅ Database initialized with all tables
- ✅ Frontend-backend communication via API
- ✅ CORS properly configured
- ✅ File uploads to /uploads directory
- ✅ Environment variable configuration

## ⚠️ Known Issues

### Issue #5: MastraService Error (GET /copilot/list - 500)
- Status: Identified, solution documented in CONVERSATION_SUMMARY.md
- Workaround: Feature disabled when DISABLE_MASTRA=true
- Fix: 3 lines of code in mastra.service.ts

### Issue #6: ThirdPartyService Missing (GET /third-party - 500)
- Status: Identified, solution documented in CONVERSATION_SUMMARY.md
- Workaround: None (feature unavailable)
- Fix: 1 line in thirdparty.module.ts exports

See CONVERSATION_SUMMARY.md for detailed analysis and solutions.

## 🎯 Quick Deployment Checklist

Before deploying to production:

- [ ] Set JWT_SECRET and ENCRYPTION_KEY environment variables
- [ ] Configure NEXT_PUBLIC_API_URL and NEXT_PUBLIC_BACKEND_URL for your domain
- [ ] Set up SMTP configuration if using email
- [ ] Configure SSL/TLS certificates
- [ ] Fix Issues #5 and #6 (see CONVERSATION_SUMMARY.md)
- [ ] Test authentication flows
- [ ] Test file uploads
- [ ] Configure backup strategy for database
- [ ] Set up monitoring and logging
- [ ] Run full test suite

## 📚 More Information

- **Deployment Details**: See `deployment.md`
- **Full Documentation**: See `CONVERSATION_SUMMARY.md`
- **Architecture**: See CONVERSATION_SUMMARY.md - Technical Architecture section

---

**Last Updated**: October 31, 2025
**Status**: Functional (2 known issues with documented fixes)
