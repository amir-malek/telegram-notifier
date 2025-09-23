#!/bin/bash

# Build script for notification service Docker image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building Notification Service Docker Image...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
IMAGE_NAME="notification-service"
FULL_IMAGE_NAME="${IMAGE_NAME}:${VERSION}"
LATEST_IMAGE_NAME="${IMAGE_NAME}:latest"

echo -e "${YELLOW}Building image: ${FULL_IMAGE_NAME}${NC}"

# Build the Docker image
docker build \
    --tag "${FULL_IMAGE_NAME}" \
    --tag "${LATEST_IMAGE_NAME}" \
    --build-arg NODE_ENV=production \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully built ${FULL_IMAGE_NAME}${NC}"
    echo -e "${GREEN}✅ Successfully tagged as ${LATEST_IMAGE_NAME}${NC}"

    # Show image info
    echo -e "${YELLOW}Image details:${NC}"
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
else
    echo -e "${RED}❌ Failed to build Docker image${NC}"
    exit 1
fi

echo -e "${YELLOW}Build completed!${NC}"