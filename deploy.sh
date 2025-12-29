#!/bin/bash
# ============================================================================
# Postiz Deployment Script
# ============================================================================
# Smart deployment script that builds and runs Postiz on your server.
# Run this script on your server after cloning the repository.
#
# Usage:
#   ./deploy.sh                    # Interactive mode
#   ./deploy.sh --rebuild          # Force rebuild from scratch
#   ./deploy.sh --update           # Update existing deployment
#   ./deploy.sh --start           # Start existing containers
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
IMAGE_NAME="postiz"
ENV_FILE=".env"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  $1"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

confirm() {
    local prompt="$1"
    local default="${2:-n}"

    if [ "$FORCE" = "true" ]; then
        return 0
    fi

    read -p "$prompt [$default] " response
    response="${response:-$default}"

    [[ "$response" =~ ^[Yy]$ ]]
}

# ============================================================================
# Checks
# ============================================================================

check_prerequisites() {
    print_header "Checking Prerequisites"

    local missing=()

    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing+=("docker-compose")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        echo ""
        echo "Install Docker:"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo ""
        exit 1
    fi

    print_step "Docker is installed"

    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        print_warning "Not running as root. Some operations may require sudo."
    fi
}

check_environment_file() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found"
        echo ""
        echo "Creating .env from .env.example..."

        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_step ".env created from .env.example"
            echo ""
            echo "⚠️  IMPORTANT: Edit .env and configure your settings before continuing!"
            echo ""
            if confirm "Open .env in nano editor now?" "n"; then
                nano .env
            fi
        else
            print_error ".env.example not found!"
            exit 1
        fi
    else
        print_step ".env file exists"
    fi
}

# ============================================================================
# Git Operations
# ============================================================================

git_pull() {
    print_header "Updating from Git Repository"

    if [ ! -d ".git" ]; then
        print_error "Not a git repository. Please clone the repo first."
        exit 1
    fi

    print_info "Current branch: $(git branch --show-current)"
    print_info "Fetching latest changes..."

    git fetch origin
    git reset --hard origin/$(git branch --show-current)

    print_step "Repository updated"
}

# ============================================================================
# Build Operations
# ============================================================================

build_image() {
    print_header "Building Docker Image"
    print_info "This may take 10-20 minutes on first run..."
    echo ""

    docker build -f Dockerfile.production -t $IMAGE_NAME:latest .

    if [ $? -eq 0 ]; then
        local size=$(docker image inspect $IMAGE_NAME:latest --format='{{.Size}}' 2>/dev/null | numfmt --to=iec 2>/dev/null || echo "unknown")
        print_step "Docker image built successfully"
        echo "  Size: $size"
    else
        print_error "Docker build failed!"
        exit 1
    fi
}

rebuild_from_scratch() {
    print_header "Rebuilding from Scratch"

    print_info "Stopping containers..."
    docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

    print_info "Removing old images..."
    docker rmi $IMAGE_NAME:latest 2>/dev/null || true

    print_info "Pruning Docker build cache..."
    docker builder prune -f

    build_image
}

# ============================================================================
# Docker Operations
# ============================================================================

start_containers() {
    print_header "Starting Containers"

    print_info "Creating and starting containers..."
    docker-compose -f $COMPOSE_FILE up -d

    if [ $? -eq 0 ]; then
        print_step "Containers started"
    else
        print_error "Failed to start containers"
        exit 1
    fi
}

stop_containers() {
    print_header "Stopping Containers"
    docker-compose -f $COMPOSE_FILE down
    print_step "Containers stopped"
}

show_status() {
    print_header "Container Status"
    docker-compose -f $COMPOSE_FILE ps
}

show_logs() {
    print_header "Recent Logs"
    docker-compose -f $COMPOSE_FILE logs --tail=50
}

run_migrations() {
    print_header "Running Database Migrations"

    docker-compose -f $COMPOSE_FILE exec -T postiz-app \
        npx prisma migrate deploy \
        --schema=./libraries/nestjs-libraries/src/database/prisma/schema.prisma || true

    print_step "Migrations completed"
}

# ============================================================================
# Update Mode
# ============================================================================

update_deployment() {
    print_header "Updating Deployment"

    # Pull latest code
    git_pull

    # Check if rebuild is needed
    if confirm "Rebuild Docker image? (Choose 'n' to just restart)" "y"; then
        build_image
    fi

    # Restart with new image
    docker-compose -f $COMPOSE_FILE down
    docker-compose -f $COMPOSE_FILE up -d

    # Run migrations
    run_migrations

    print_step "Update completed"
}

# ============================================================================
# First Time Setup
# ============================================================================

first_time_setup() {
    print_header "First Time Setup"

    check_prerequisites
    check_environment_file

    echo ""
    echo "Setup options:"
    echo "  1) Full setup (build + start)"
    echo "  2) Build only"
    echo "  3) Start existing containers"
    echo ""
    read -p "Choose option [1-3]: " choice

    case $choice in
        1)
            build_image
            start_containers
            run_migrations
            show_status
            ;;
        2)
            build_image
            ;;
        3)
            start_containers
            ;;
        *)
            print_error "Invalid option"
            exit 1
            ;;
    esac
}

# ============================================================================
# Main Menu
# ============================================================================

show_menu() {
    echo ""
    print_header "Postiz Deployment Menu"

    echo "  1) Start containers"
    echo "  2) Stop containers"
    echo "  3) Restart containers"
    echo "  4) Update (git pull + restart)"
    echo "  5) Rebuild from scratch"
    echo "  6) View logs"
    echo "  7) View status"
    echo "  8) Run database migrations"
    echo "  9) Enter shell"
    echo "  0) Exit"
    echo ""
}

enter_shell() {
    print_header "Container Shell"
    echo "Available containers:"
    echo "  1) postiz-app"
    echo "  2) postiz-postgres"
    echo "  3) postiz-redis"
    echo ""
    read -p "Choose container [1-3]: " choice

    case $choice in
        1) container="postiz-app" ;;
        2) container="postiz-postgres" ;;
        3) container="postiz-redis" ;;
        *)
            print_error "Invalid container"
            return
            ;;
    esac

    echo "Entering shell for $container (exit to return)..."
    docker-compose -f $COMPOSE_FILE exec $container /bin/bash || \
    docker-compose -f $COMPOSE_FILE exec $container /bin/sh
}

# ============================================================================
# Main Script
# ============================================================================

main() {
    cd "$(dirname "$0")"

    # Parse command line arguments
    FORCE="false"
    MODE="interactive"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --rebuild)
                MODE="rebuild"
                shift
                ;;
            --update)
                MODE="update"
                shift
                ;;
            --start)
                MODE="start"
                shift
                ;;
            --force|-f)
                FORCE="true"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Execute based on mode
    case $MODE in
        rebuild)
            check_prerequisites
            check_environment_file
            rebuild_from_scratch
            start_containers
            run_migrations
            show_status
            ;;
        update)
            check_prerequisites
            update_deployment
            show_status
            ;;
        start)
            check_prerequisites
            check_environment_file
            start_containers
            run_migrations
            show_status
            ;;
        interactive)
            check_prerequisites

            # Check if this is first run
            if [ ! -f "$ENV_FILE" ] || [ ! -f "$COMPOSE_FILE" ]; then
                first_time_setup
                show_success_message
                exit 0
            fi

            # Main menu loop
            while true; do
                show_menu
                read -p "Choose option [0-9]: " choice

                case $choice in
                    1)
                        start_containers
                        run_migrations
                        show_status
                        ;;
                    2)
                        stop_containers
                        ;;
                    3)
                        stop_containers
                        start_containers
                        run_migrations
                        show_status
                        ;;
                    4)
                        update_deployment
                        ;;
                    5)
                        rebuild_from_scratch
                        start_containers
                        run_migrations
                        show_status
                        ;;
                    6)
                        show_logs
                        ;;
                    7)
                        show_status
                        ;;
                    8)
                        run_migrations
                        ;;
                    9)
                        enter_shell
                        ;;
                    0)
                        echo "Goodbye!"
                        exit 0
                        ;;
                    *)
                        print_error "Invalid option"
                        ;;
                esac
            done
            ;;
    esac
}

show_success_message() {
    print_header "Deployment Complete!"

    echo "Your Postiz instance is now running."
    echo ""
    echo "Access your instance at:"
    echo "  • Frontend: http://localhost:4200"
    echo "  • Backend:  http://localhost:32456/api"
    echo "  • Admin:     http://localhost:4200/admin"
    echo ""
    echo "Next steps:"
    echo "  1) Create your account (first user becomes admin)"
    echo "  2) Configure AI providers in Settings"
    echo "  3) Set up social media integrations"
    echo ""
    echo "Useful commands:"
    echo "  ./deploy.sh              # Show this menu"
    echo "  ./deploy.sh --update     # Update to latest version"
    echo "  ./deploy.sh --rebuild    # Rebuild from scratch"
    echo ""
}

# Run main
main "$@"
