#!/bin/bash
# Script to create a new release tag

set -e

# Check if version argument is provided
if [ -z "$1" ]; then
    echo "Please provide a version number (e.g. ./scripts/release.sh 1.0.0)"
    exit 1
fi

VERSION=$1

# Ensure working directory is clean
if [[ -n $(git status -s) ]]; then
    echo "Working directory is not clean. Please commit or stash changes first."
    exit 1
fi

# Update version in package.json
npm version $VERSION --no-git-tag-version

# Stage version updates
git add package.json package-lock.json

# Create release commit
git commit -m "Release $VERSION"

# Create signed tag
git tag -s "v$VERSION" -m "Release $VERSION"

echo "Release v$VERSION prepared successfully!"
echo ""
echo "Next steps:"
echo "1. Push the release:"
echo "   git push origin main"
echo "   git push origin v$VERSION"
echo ""
echo "The GitHub Action will automatically:"
echo "- Build for all platforms"
echo "- Create a GitHub release"
echo "- Upload all binaries"
echo "- Generate and sign checksums" 
