#!/bin/bash

# Development environment startup script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Starting Notification Service Development Environment${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "docker-compose.dev.yml" ]; then
    echo -e "${RED}Error: docker-compose.dev.yml not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env from .env.example${NC}"
        echo -e "${YELLOW}📝 Please update .env with your configuration before running the app${NC}"
    else
        echo -e "${YELLOW}⚠️  No .env.example found. You'll need to create .env manually.${NC}"
    fi
fi

# Parse command line arguments
PROFILE=""
DETACHED=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --admin)
            PROFILE="--profile admin"
            echo -e "${BLUE}🔧 Including admin tools (pgAdmin, Redis Commander)${NC}"
            shift
            ;;
        -d|--detached)
            DETACHED="-d"
            echo -e "${BLUE}🔄 Running in detached mode${NC}"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --admin     Include admin tools (pgAdmin, Redis Commander)"
            echo "  -d, --detached    Run in detached mode"
            echo "  -h, --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}📦 Starting development services...${NC}"

# Start services
docker-compose -f docker-compose.dev.yml up $DETACHED $PROFILE

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Development environment started successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 Available services:${NC}"
    echo -e "${GREEN}  • PostgreSQL:${NC} localhost:5432"
    echo -e "${GREEN}  • Redis:${NC} localhost:6379"

    if [[ "$PROFILE" == *"admin"* ]]; then
        echo -e "${GREEN}  • pgAdmin:${NC} http://localhost:8080 (admin@notification.local / admin123)"
        echo -e "${GREEN}  • Redis Commander:${NC} http://localhost:8081 (admin / admin123)"
    fi

    echo ""
    echo -e "${YELLOW}💡 To start the notification service app:${NC}"
    echo -e "   npm run dev"
    echo ""
    echo -e "${YELLOW}🛑 To stop all services:${NC}"
    echo -e "   npm run docker:dev:stop"

    if [[ "$DETACHED" != "-d" ]]; then
        echo ""
        echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"
    fi
else
    echo -e "${RED}❌ Failed to start development environment${NC}"
    exit 1
fi