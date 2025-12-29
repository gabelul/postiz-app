#!/bin/bash
# ============================================================================
# Postiz Deployment Script
# ============================================================================
# Builds and deploys your custom Postiz Docker image with admin enhancements
# to your server. Run this locally to build and push to your server.
#
# Usage:
#   ./deploy.sh [environment]
#
# Environments:
#   production  - Deploy to production server (default)
#   staging     - Deploy to staging server
#
# Prerequisites:
#   1. Docker installed locally
#   2. SSH access to your server
#   3. Docker and docker-compose installed on server
# ============================================================================

set -e  # Exit on any error

# ============================================================================
# CONFIGURATION - Update these values for your environment
# ============================================================================

# Server connection details
SERVER_USER="${SERVER_USER:-root}"           # SSH username
SERVER_HOST="${SERVER_HOST:-}"               # Server hostname/IP
SERVER_PATH="${SERVER_PATH:-/opt/postiz}"    # Path on server to deploy to

# Docker image configuration
IMAGE_NAME="${IMAGE_NAME:-postiz}"           # Docker image name
IMAGE_TAG="${IMAGE_TAG:-latest}"             # Docker image tag
REGISTRY="${REGISTRY:-}"                     # Optional: Docker registry (e.g., docker.io/username)

# Ports
BACKEND_PORT="${BACKEND_PORT:-32456}"
FRONTEND_PORT="${FRONTEND_PORT:-4200}"

# ============================================================================
# COLORS FOR OUTPUT
# ============================================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# FUNCTIONS
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_required_vars() {
    if [ -z "$SERVER_HOST" ]; then
        print_error "SERVER_HOST is required!"
        echo "  Export it: export SERVER_HOST=your-server.com"
        echo "  Or pass it: SERVER_HOST=your-server.com ./deploy.sh"
        exit 1
    fi
}

build_image() {
    print_header "Building Docker Image"

    if [ -n "$REGISTRY" ]; then
        FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    else
        FULL_IMAGE="$IMAGE_NAME:$IMAGE_TAG"
    fi

    echo "Building: $FULL_IMAGE"
    echo ""

    docker build -f Dockerfile.production -t "$FULL_IMAGE" .

    if [ $? -eq 0 ]; then
        print_step "Docker image built successfully"
        docker image inspect "$FULL_IMAGE" > /dev/null 2>&1
        IMAGE_SIZE=$(docker image inspect "$FULL_IMAGE" --format='{{.Size}}' | numfmt --to=iec 2>/dev/null || echo "unknown")
        echo "  Size: $IMAGE_SIZE"
    else
        print_error "Docker build failed!"
        exit 1
    fi
}

push_image() {
    if [ -z "$REGISTRY" ]; then
        print_warning "No REGISTRY set - skipping push (using local build on server)"
        return
    fi

    print_header "Pushing Docker Image to Registry"

    docker push "$FULL_IMAGE"

    if [ $? -eq 0 ]; then
        print_step "Image pushed successfully"
    else
        print_error "Push failed!"
        exit 1
    fi
}

deploy_to_server() {
    print_header "Deploying to Server"

    echo "Server: $SERVER_USER@$SERVER_HOST"
    echo "Path: $SERVER_PATH"
    echo ""

    # Create directory structure on server
    print_step "Creating directory structure on server..."
    ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_PATH"

    # Copy files to server
    print_step "Copying deployment files to server..."
    scp docker-compose.prod.yml "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"
    scp .env.example "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/.env.example"

    # If no registry, build directly on server (slower but works)
    if [ -z "$REGISTRY" ]; then
        print_warning "Building image on server (this may take 10-20 minutes)..."
        # Copy source files (excluding node_modules and build artifacts)
        ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && rm -rf src"
        ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_PATH/src"

        # Copy necessary files
        rsync -av --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.next' \
            --exclude='apps/*/dist' --exclude='apps/*/.next' \
            apps/ libraries/ package.json pnpm-workspace.yaml pnpm-lock.yaml \
            Dockerfile.production \
            "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/src/"

        # Build on server
        ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH/src && docker build -f Dockerfile.production -t $IMAGE_NAME:$IMAGE_TAG ."
    fi

    # Check if .env exists on server
    print_step "Checking environment configuration..."
    ssh "$SERVER_USER@$SERVER_HOST" "if [ ! -f $SERVER_PATH/.env ]; then echo 'WARNING: .env file not found. Copy .env.example to .env and configure it.'; fi"
}

restart_services() {
    print_header "Restarting Services"

    # Stop existing containers
    print_step "Stopping existing containers..."
    ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && docker-compose -f docker-compose.prod.yml down || true"

    # Pull latest image if using registry
    if [ -n "$REGISTRY" ]; then
        print_step "Pulling latest image..."
        ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && docker pull $FULL_IMAGE"
    fi

    # Start services
    print_step "Starting services..."
    ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT docker-compose -f docker-compose.prod.yml up -d"

    # Run database migrations
    print_step "Running database migrations..."
    ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && docker-compose -f docker-compose.prod.yml exec -T postiz-app npx prisma migrate deploy --schema=./libraries/nestjs-libraries/src/database/prisma/schema.prisma || true"

    print_step "Services restarted successfully"
}

show_status() {
    print_header "Deployment Status"

    echo "Running containers:"
    ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && docker-compose -f docker-compose.prod.yml ps"

    echo ""
    echo "Recent logs:"
    ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && docker-compose -f docker-compose.prod.yml logs --tail=20"
}

cleanup() {
    print_header "Cleanup"

    # Remove old Docker images from local machine (keep last 3)
    print_step "Cleaning up old local images..."
    docker images "$IMAGE_NAME" --format '{{.ID}} {{.CreatedAt}}' | \
        sort -k2 -r | tail -n +4 | awk '{print $1}' | \
        xargs -r docker rmi -f 2>/dev/null || true
}

show_next_steps() {
    print_header "Deployment Complete!"

    echo ""
    echo "Your Postiz instance has been deployed with:"
    echo "  • Admin panel enhancements (users, organizations, bulk operations)"
    echo "  • Health monitoring dashboard"
    echo "  • First user = superAdmin (for new installations)"
    echo ""
    echo "Access your instance at:"
    echo "  • Frontend: http://$SERVER_HOST:$FRONTEND_PORT"
    echo "  • Backend:  http://$SERVER_HOST:$BACKEND_PORT/api"
    echo "  • Admin:     http://$SERVER_HOST:$FRONTEND_PORT/admin"
    echo ""
    echo "Next steps:"
    echo "  1. SSH into server: ssh $SERVER_USER@$SERVER_HOST"
    echo "  2. Configure .env: cd $SERVER_PATH && nano .env"
    echo "  3. Restart: docker-compose -f docker-compose.prod.yml up -d"
    echo "  4. View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

main() {
    print_header "Postiz Deployment Script"

    # Check required variables
    check_required_vars

    # Check Docker is available
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    # Parse arguments
    ENVIRONMENT="${1:-production}"
    echo "Environment: $ENVIRONMENT"
    echo ""

    # Run deployment steps
    build_image
    push_image
    deploy_to_server
    restart_services
    show_status
    cleanup
    show_next_steps
}

# Run main function
main "$@"
