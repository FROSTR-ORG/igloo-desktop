#!/bin/bash

# Simple deployment script for Static Igloo Frontend
# Usage: ./deploy.sh [destination_directory]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default destination directory
DEST_DIR="${1:-../igloo-server/static}"

echo -e "${YELLOW}📦 Deploying Static Igloo Frontend...${NC}"

# Check if destination directory exists
if [ ! -d "$DEST_DIR" ]; then
    echo -e "${YELLOW}Creating destination directory: $DEST_DIR${NC}"
    mkdir -p "$DEST_DIR"
fi

# Copy the logo from the original project if it exists
ORIGINAL_LOGO="../src/assets/frostr-logo-transparent.png"
if [ -f "$ORIGINAL_LOGO" ]; then
    echo -e "${GREEN}✓ Copying original Frostr logo...${NC}"
    cp "$ORIGINAL_LOGO" "./assets/"
else
    echo -e "${YELLOW}⚠ Original logo not found at $ORIGINAL_LOGO${NC}"
    echo -e "${YELLOW}  Make sure to replace the placeholder logo manually${NC}"
fi

# Copy all necessary files
echo -e "${GREEN}✓ Copying HTML, CSS, and JavaScript files...${NC}"
cp index.html "$DEST_DIR/"
cp styles.css "$DEST_DIR/"
cp script.js "$DEST_DIR/"

# Copy assets directory
echo -e "${GREEN}✓ Copying assets directory...${NC}"
cp -r assets "$DEST_DIR/"

# Copy package.json for reference
if [ -f "package.json" ]; then
    cp package.json "$DEST_DIR/"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}📁 Files copied to: $DEST_DIR${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure your igloo-server to serve static files from $DEST_DIR"
echo "2. Update API endpoints in script.js to match your server"
echo "3. Test the frontend by visiting your server URL"
echo ""
echo -e "${YELLOW}To run locally for testing:${NC}"
echo "cd $DEST_DIR && python3 -m http.server 8000"
echo "Then visit: http://localhost:8000" 