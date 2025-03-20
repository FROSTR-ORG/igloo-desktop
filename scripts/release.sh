#!/bin/bash
# Script to create a new release, build, and sign it

set -e

# Check if version is provided
if [ -z "$1" ]; then
  echo "Usage: ./release.sh <version>"
  echo "Example: ./release.sh 1.0.0"
  exit 1
fi

VERSION=$1

# 1. Update version in package.json
echo "Updating version to $VERSION..."
# Use sed to directly update package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# 2. Build for all platforms
echo "Building release..."
npm run dist

# 3. Generate and sign checksums
echo "Generating and signing checksums..."
cd release
rm -f SHA256SUMS SHA256SUMS.asc
shasum -a 256 Igloo* > SHA256SUMS
gpg --detach-sign --armor SHA256SUMS
cd ..

# 4. Create git tag
echo "Creating git tag..."
git add package.json
git commit -m "Release $VERSION"
git tag -s "v$VERSION" -m "Release $VERSION"

echo "Release v$VERSION prepared!"
echo ""
echo "Next steps:"
echo "1. Verify the build: ./scripts/verify.sh"
echo "2. Push the release: git push origin main && git push origin v$VERSION"
echo ""
echo "The GitHub Action will automatically create the release and upload assets." 