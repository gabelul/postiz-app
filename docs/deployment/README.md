# Deployment Documentation

This directory contains comprehensive guides for deploying Postiz in different environments.

## Quick Start (Deploy on Your Server)

The easiest way to deploy Postiz is using the included `deploy.sh` script:

```bash
# Clone the repository on your server
git clone https://github.com/your-username/postiz-app.git
cd postiz-app

# Run the deployment script
./deploy.sh
```

The script will guide you through:
- First-time setup
- Building the Docker image
- Starting all services
- Updating your deployment

For detailed deployment instructions, see [Server Deployment Guide](server-deployment.md).

## Guides

### [Server Deployment Guide](server-deployment.md)
Complete guide for deploying Postiz on your own server using Docker. Includes:
- Initial setup instructions
- Using the deploy.sh script
- Configuration and troubleshooting
- Updating your deployment

### [Port Configuration](port-configuration.md)
Configuration options for ports and network settings when deploying Postiz.

### [Readiness Status](readiness-status.md)
Current deployment readiness status and pre-deployment checklist items.

### [Deployment Checklist](checklist.md)
Comprehensive checklist for pre-deployment and post-deployment verification steps.

### [Centminmod Guide](centminmod-guide.md)
Specific deployment instructions and configurations for Centminmod-based environments.

## Deploy Script Usage

The `deploy.sh` script (located in the project root) supports several modes:

```bash
# Interactive mode (default)
./deploy.sh

# Quick update (pull latest code + restart)
./deploy.sh --update

# Rebuild from scratch
./deploy.sh --rebuild

# Start containers only
./deploy.sh --start
```

## Quick Links

- [Main README](/README.md)
- [Contributing Guidelines](/CONTRIBUTING.md)
- [Security Policy](/SECURITY.md)
