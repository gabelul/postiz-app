# Postiz Deployment Checklist

## Pre-Deployment (Your Workstation)
- [ ] Push all changes to private repository
- [ ] Review DEPLOYMENT_CENTMINMOD.md
- [ ] Prepare domain name (e.g., postiz.yourdomain.com)
- [ ] Have admin access to Centminmod control panel

## Server Preparation
- [ ] SSH into your CentOS/Rocky server
- [ ] Verify Centminmod is installed: `cminfo`
- [ ] Verify Nginx is running: `systemctl status nginx`
- [ ] Check available disk space: `df -h`
- [ ] Check available memory: `free -h`

## Docker Installation
- [ ] Install Docker: `curl -fsSL https://get.docker.com | sh`
- [ ] Install Docker Compose: `sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose`
- [ ] Verify Docker: `docker --version`
- [ ] Verify Docker Compose: `docker-compose --version`
- [ ] Start Docker service: `sudo systemctl start docker && sudo systemctl enable docker`

## Postiz Setup
- [ ] Create directory: `mkdir -p /home/postiz && cd /home/postiz`
- [ ] Clone/download Postiz files (or use official image)
- [ ] Create docker-compose.yml (from DEPLOYMENT_CENTMINMOD.md)
- [ ] Create .env file with all required variables
- [ ] Set file permissions: `chmod 600 /home/postiz/.env`
- [ ] Generate secure passwords using `openssl rand -base64 32`

## Docker Startup
- [ ] Pull images: `docker-compose pull`
- [ ] Start services: `docker-compose up -d`
- [ ] Wait 30-60 seconds for initialization
- [ ] Verify containers: `docker-compose ps` (all should show "Up")
- [ ] Check logs: `docker-compose logs postiz-app | tail -50`
- [ ] Verify database: `docker-compose logs postiz-postgres | grep "database system is ready"`
- [ ] Run migrations: `docker-compose exec postiz-app pnpm run prisma-db-push`

## Nginx Configuration (Centminmod)
- [ ] Create/update Nginx config at `/usr/local/nginx/conf/conf.d/postiz.yourdomain.com.conf`
- [ ] Copy config from DEPLOYMENT_CENTMINMOD.md (Step 7, Option B)
- [ ] Replace `postiz.yourdomain.com` with your actual domain
- [ ] Test config: `sudo nginx -t` (should say "successful")
- [ ] Reload Nginx: `sudo systemctl reload nginx`

## SSL Certificate
- [ ] Option A: Use Centminmod UI to generate Let's Encrypt certificate
- [ ] Option B: Run certbot: `sudo certbot certonly --webroot -w /home/postiz/public -d postiz.yourdomain.com`
- [ ] Verify certificate: `sudo ls -la /etc/letsencrypt/live/postiz.yourdomain.com/`
- [ ] Check certificate expiration: `sudo certbot certificates`
- [ ] Enable auto-renewal: `sudo systemctl enable certbot.timer`

## Verification & Testing
- [ ] Wait for containers to be fully ready (2-3 minutes)
- [ ] Test HTTP redirect: `curl -I http://postiz.yourdomain.com`
- [ ] Test HTTPS: `curl -I https://postiz.yourdomain.com`
- [ ] Access in browser: `https://postiz.yourdomain.com`
- [ ] Verify Nginx logs: `tail -20 /var/log/nginx/postiz.yourdomain.com.access.log`
- [ ] Check for errors: `tail -20 /var/log/nginx/postiz.yourdomain.com.error.log`
- [ ] Test API endpoint: `curl https://postiz.yourdomain.com/api/health`

## Post-Deployment
- [ ] Create admin account on Postiz UI
- [ ] Configure AI providers (OpenAI, Anthropic, etc.)
- [ ] Set up social media integrations
- [ ] Test posting functionality
- [ ] Set up automated backups (cron job)
- [ ] Configure monitoring/alerting
- [ ] Document any custom settings
- [ ] Test backup restore process

## Production Hardening
- [ ] Disable Docker from exposing ports to all interfaces
- [ ] Review firewall rules (only 80, 443 should be open)
- [ ] Set up fail2ban for Nginx if needed
- [ ] Enable Docker logging rotation
- [ ] Set up automated security updates
- [ ] Create systemd service to auto-restart containers on reboot
- [ ] Document emergency procedures

## Monitoring Setup
- [ ] Set up disk space alerts
- [ ] Monitor Docker container memory usage
- [ ] Set up log rotation for Nginx
- [ ] Check Postiz logs regularly: `docker-compose logs --tail=100 postiz-app`
- [ ] Monitor database backups

## Backup & Recovery
- [ ] Create database backup script
- [ ] Create uploads backup script
- [ ] Test backup restoration (critical!)
- [ ] Document recovery procedure
- [ ] Schedule automated backups (recommended: daily)

## Maintenance
- [ ] Weekly: Review logs for errors
- [ ] Weekly: Check disk space
- [ ] Monthly: Update Docker images (`docker-compose pull && docker-compose up -d`)
- [ ] Monthly: Review security updates
- [ ] Quarterly: Full system backup test
- [ ] Quarterly: Review SSL certificate status

## Troubleshooting Quick Reference

**Containers not starting?**
```bash
docker-compose logs -f
```

**Database connection error?**
```bash
docker-compose exec postiz-postgres psql -U postiz -d postiz_db -c "\dt"
```

**Nginx not proxying correctly?**
```bash
sudo nginx -t
tail -f /var/log/nginx/postiz.yourdomain.com.error.log
curl -v https://postiz.yourdomain.com
```

**High memory usage?**
```bash
docker stats
# If needed, adjust resource limits in docker-compose.yml
```

**Need to restart everything?**
```bash
docker-compose restart
sudo systemctl reload nginx
```

---

**Deployment Date:** _______________
**Domain:** _______________
**Admin Email:** _______________
**DB Backup Location:** _______________
**SSL Provider:** _______________
**Notes:**
_______________
_______________
_______________
