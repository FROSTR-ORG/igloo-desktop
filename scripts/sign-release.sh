#!/bin/bash
# Script to sign the release files with GPG

set -e

# Check if version is provided
if [ -z "$1" ]; then
  echo "Usage: ./sign-release.sh <version>"
  echo "Example: ./sign-release.sh 1.0.0"
  exit 1
fi

VERSION=$1
RELEASE_DIR="release"

# Check if release directory exists
if [ ! -d "$RELEASE_DIR" ]; then
  echo "Error: Release directory not found. Run the build process first."
  exit 1
fi

# Navigate to release directory
cd $RELEASE_DIR

# Generate SHA256 checksums for all files
echo "Generating SHA256SUMS file..."
rm -f SHA256SUMS SHA256SUMS.asc
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
  shasum -a 256 Igloo* > SHA256SUMS
else
  # For Windows
  for file in Igloo*; do
    certutil -hashfile "$file" SHA256 | grep -v "^SHA256" | tr -d " \t\r\n" >> SHA256SUMS
    echo "  $file" >> SHA256SUMS
  done
fi

# Sign the checksums file
echo "Signing SHA256SUMS file with GPG..."
gpg --detach-sign --armor SHA256SUMS

# Verify the signature
echo "Verifying signature..."
gpg --verify SHA256SUMS.asc SHA256SUMS

echo "Files successfully signed. Signature written to SHA256SUMS.asc"
echo "You can now upload all files from the $RELEASE_DIR directory to GitHub."

# List all files ready for upload
echo "Files to upload:"
ls -la

cd .. 