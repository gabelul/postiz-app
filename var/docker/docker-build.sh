#!/bin/bash
# Docker build script for Postiz
# Builds production image from Dockerfile.production
# Note: Dockerfile.dev is for development only and doesn't support multi-stage targets

set -o xtrace

# Build production image
docker rmi localhost/postiz || true
docker build -t localhost/postiz -f Dockerfile.production .

echo "✓ Production image built: localhost/postiz"
