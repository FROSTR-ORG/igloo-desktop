#!/bin/bash
# Script to verify a build before release

set -e

if [ ! -d "release" ]; then
  echo "Error: No release directory found. Run ./release.sh first."
  exit 1
fi

cd release

# Verify SHA256SUMS signature
echo "Verifying SHA256SUMS signature..."
gpg --verify SHA256SUMS.asc SHA256SUMS

# Verify checksums
echo "Verifying file checksums..."
shasum -a 256 --check SHA256SUMS

echo "All files verified successfully!" 