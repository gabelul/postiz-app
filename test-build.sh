#!/bin/bash
# Test script to verify Docker build works without errors
# Run this before deploying to production

set -e

echo "========================================"
echo "Postiz Docker Build Test"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "✗ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "✗ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✓ Docker and Docker Compose found"
echo ""

# Step 1: Check Dockerfile.production exists
echo "Step 1: Checking Dockerfile.production..."
if [ ! -f "Dockerfile.production" ]; then
    echo "✗ Dockerfile.production not found!"
    exit 1
fi
echo "✓ Dockerfile.production found"
echo ""

# Step 2: Test Docker build (dry run - just check syntax)
echo "Step 2: Building Docker image from Dockerfile.production..."
echo "This may take several minutes..."
echo ""

if docker build -f Dockerfile.production -t postiz:test . ; then
    echo ""
    echo "✓ Docker image built successfully!"
    echo "  Image tag: postiz:test"
else
    echo ""
    echo "✗ Docker build failed!"
    echo "  Check the error messages above."
    exit 1
fi

echo ""

# Step 3: Verify image was created
echo "Step 3: Verifying built image..."
if docker image inspect postiz:test > /dev/null 2>&1; then
    IMAGE_SIZE=$(docker image inspect postiz:test --format='{{.Size}}' | numfmt --to=iec 2>/dev/null || echo "unknown")
    echo "✓ Image verified"
    echo "  Size: $IMAGE_SIZE"
else
    echo "✗ Image verification failed!"
    exit 1
fi

echo ""

# Step 4: Check docker-compose.prod.yml
echo "Step 4: Checking docker-compose.prod.yml syntax..."
if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    echo "✓ docker-compose.prod.yml syntax is valid"
else
    echo "✗ docker-compose.prod.yml has syntax errors!"
    exit 1
fi

echo ""

# Step 5: Check .env.example
echo "Step 5: Checking .env.example..."
if [ ! -f ".env.example" ]; then
    echo "✗ .env.example not found!"
    exit 1
fi
echo "✓ .env.example found"
echo ""

# Step 6: Summary
echo "========================================"
echo "BUILD TEST SUMMARY"
echo "========================================"
echo "✓ All checks passed!"
echo ""
echo "Next steps:"
echo "1. On your server, copy docker-compose.prod.yml and Dockerfile.production"
echo "2. Copy .env.example to .env and fill in your values"
echo "3. Run: docker-compose -f docker-compose.prod.yml up -d"
echo "4. Configure centminmod Nginx to reverse proxy to localhost:32456"
echo ""
echo "For detailed instructions, see: deployment-centminmod.md"
echo "========================================"
