#!/bin/bash
# Script to validate macOS code signing setup

set -euo pipefail

# Generate unique profile name for this run
PROFILE_NAME="igloo-validation-$(date +%s)-$$"

# Cleanup function
cleanup() {
    if [[ -n "${PROFILE_NAME:-}" ]]; then
        xcrun notarytool delete-credentials "$PROFILE_NAME" 2>/dev/null || true
    fi
}

# Ensure cleanup happens on script exit
trap cleanup EXIT

echo "🔍 Validating macOS Code Signing Setup..."
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

# Check for Xcode command line tools
if ! command -v codesign &> /dev/null; then
    echo "❌ codesign not found. Install Xcode Command Line Tools:"
    echo "   xcode-select --install"
    exit 1
fi

if ! xcrun notarytool --version &> /dev/null; then
    echo "❌ notarytool not found. Install Xcode Command Line Tools:"
    echo "   xcode-select --install"
    exit 1
fi

echo "✅ Xcode tools found"

# Check for available certificates
echo ""
echo "🔑 Available Code Signing Certificates:"
if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    security find-identity -v -p codesigning | grep "Developer ID Application"
    echo "✅ Developer ID Application certificate found"
else
    echo "❌ No Developer ID Application certificate found"
    echo "   See MAC_SIGNING_SETUP.md for setup instructions"
    exit 1
fi

# Check environment variables
echo ""
echo "🌍 Environment Variables:"

if [[ -n "${APPLE_ID:-}" ]]; then
    # Mask the Apple ID for privacy (show first 3 chars and domain)
    MASKED_APPLE_ID=$(echo "${APPLE_ID}" | sed 's/\(.\{3\}\).*@/\1***@/')
    echo "✅ APPLE_ID: $MASKED_APPLE_ID"
else
    echo "❌ APPLE_ID not set"
fi

if [[ -n "${APPLE_TEAM_ID:-}" ]]; then
    echo "✅ APPLE_TEAM_ID: ${APPLE_TEAM_ID}"
else
    echo "❌ APPLE_TEAM_ID not set"
fi

if [[ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
    echo "✅ APPLE_APP_SPECIFIC_PASSWORD: [SET]"
else
    echo "❌ APPLE_APP_SPECIFIC_PASSWORD not set"
fi

if [[ -n "${CSC_LINK:-}" ]]; then
    echo "✅ CSC_LINK: [SET]"
else
    echo "❌ CSC_LINK not set"
fi

if [[ -n "${CSC_KEY_PASSWORD:-}" ]]; then
    echo "✅ CSC_KEY_PASSWORD: [SET]"
else
    echo "❌ CSC_KEY_PASSWORD not set"
fi

# Check if all required variables are set
if [[ -z "${APPLE_ID:-}" || -z "${APPLE_TEAM_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" || -z "${CSC_LINK:-}" || -z "${CSC_KEY_PASSWORD:-}" ]]; then
    echo ""
    echo "❌ Some environment variables are missing"
    echo "   Set them in your shell or GitHub Secrets"
    echo "   See MAC_SIGNING_SETUP.md for details"
    exit 1
fi

# Check entitlements file
echo ""
echo "📄 Entitlements File:"
# Get the repository root directory (script is in scripts/ subdirectory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
ENTITLEMENTS_FILE="$REPO_ROOT/build/entitlements.mac.plist"

if [[ -f "$ENTITLEMENTS_FILE" ]]; then
    echo "✅ build/entitlements.mac.plist exists"
else
    echo "❌ build/entitlements.mac.plist not found"
    echo "   Expected location: $ENTITLEMENTS_FILE"
    echo "   This file should have been created automatically"
    exit 1
fi

# Test notarytool authentication
echo ""
echo "🔐 Testing Notarization Authentication..."
if xcrun notarytool store-credentials "$PROFILE_NAME" \
    --apple-id "${APPLE_ID}" \
    --team-id "${APPLE_TEAM_ID}" \
    --password "${APPLE_APP_SPECIFIC_PASSWORD}" 2>/dev/null; then
    echo "✅ Notarization authentication successful"
    # Profile will be cleaned up automatically by trap
else
    echo "❌ Notarization authentication failed"
    echo "   Check your APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD"
    exit 1
fi

echo ""
echo "🎉 All validation checks passed!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dist:mac' to build and sign your app"
echo "2. The build process will automatically sign and notarize"
echo "3. Test the signed app with 'spctl -a -vv /path/to/Igloo.app'"
echo ""
echo "For CI/CD, ensure all environment variables are set as GitHub Secrets" 