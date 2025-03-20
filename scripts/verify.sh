#!/bin/bash
# Script to verify a build before release

set -e

# Check if release directory exists
if [ ! -d "release" ]; then
    echo "No release directory found. Please run the release script first."
    exit 1
fi

# Verify the build exists
if [ ! -f "release/Igloo"* ]; then
    echo "No build found in release directory. Please run the release script first."
    exit 1
fi

echo "Build verification complete!"
echo ""
echo "Next steps:"
echo "1. Test the application locally"
echo "2. If everything works, push the release:"
echo "   git push origin main"
echo "   git push origin v*"
echo ""
echo "The GitHub Action will handle the rest!" 