#!/bin/bash
# Script to create a new release, build, and sign it

set -e

# Check if version argument is provided
if [ -z "$1" ]; then
    echo "Please provide a version number (e.g. ./scripts/release.sh 1.0.0)"
    exit 1
fi

VERSION=$1

# Ensure we're in a clean state
if [ -n "$(git status --porcelain)" ]; then
    echo "Working directory is not clean. Please commit or stash changes first."
    exit 1
fi

# Update version in package.json
npm version $VERSION --no-git-tag-version

# Commit version change
git add package.json
git commit -m "Release $VERSION"

# Create signed tag
git tag -s "v$VERSION" -m "Release $VERSION"

# Build the app
echo "Building application..."
npm run build
npm run dist

echo "Release v$VERSION prepared successfully!"
echo ""
echo "Next steps:"
echo "1. Run './scripts/verify.sh' to verify the build"
echo "2. If verification passes, push the release:"
echo "   git push origin main"
echo "   git push origin v$VERSION"
echo ""
echo "The GitHub Action will automatically:"
echo "- Build for all platforms"
echo "- Create a GitHub release"
echo "- Upload all binaries" 