#!/bin/bash
# Script to create a new release tag and push it to GitHub

set -e

# Check if version is provided
if [ -z "$1" ]; then
  echo "Usage: ./create-release.sh <version>"
  echo "Example: ./create-release.sh 1.0.0"
  exit 1
fi

VERSION=$1
CURRENT_VERSION=$(grep '"version":' package.json | cut -d'"' -f4)

# Update version in package.json
echo "Current version: $CURRENT_VERSION"
echo "New version: $VERSION"
echo "Updating version in package.json..."

# Use sed to update the version
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS uses different sed syntax
  sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" package.json
else
  # Linux and others
  sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" package.json
fi

# Commit the change
echo "Committing the version update..."
git add package.json
git commit -m "chore: release version $VERSION"

# Create a tag
echo "Creating tag v$VERSION..."
git tag -a "v$VERSION" -m "Release $VERSION"

# Push changes and tags
echo "Push changes and tags to trigger GitHub Actions workflow? (y/n)"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  echo "Pushing to origin..."
  git push origin main
  git push origin "v$VERSION"
  echo "Release process initiated! Check GitHub Actions for build progress."
else
  echo "Changes committed and tag created locally. Run the following when ready:"
  echo "git push origin main"
  echo "git push origin v$VERSION"
fi 