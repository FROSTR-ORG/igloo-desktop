#!/bin/bash
# Basic validation script that checks setup without requiring environment variables

set -euo pipefail

echo "🔍 Basic macOS Code Signing Setup Check..."
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

# Check entitlements file
echo ""
echo "📄 Entitlements File:"
if [[ -f "build/entitlements.mac.plist" ]]; then
    echo "✅ build/entitlements.mac.plist exists"
else
    echo "❌ build/entitlements.mac.plist not found"
    echo "   This file should have been created automatically"
    exit 1
fi

# Check package.json configuration
echo ""
echo "📦 Package.json Configuration:"
if grep -q '"hardenedRuntime": true' package.json; then
    echo "✅ Hardened runtime enabled"
else
    echo "❌ Hardened runtime not configured"
    exit 1
fi

if grep -q '"teamId"' package.json; then
    TEAM_ID=$(grep '"teamId"' package.json | sed 's/.*"teamId": *"\([^"]*\)".*/\1/')
    if [[ "$TEAM_ID" != "YOUR_ACTUAL_TEAM_ID" && "$TEAM_ID" != "YOUR_TEAM_ID" ]]; then
        echo "✅ Team ID configured: $TEAM_ID"
    else
        echo "❌ Team ID not properly configured (still placeholder)"
        exit 1
    fi
else
    echo "❌ Team ID not found in package.json"
    exit 1
fi

echo ""
echo "🎉 Basic setup validation passed!"
echo ""
echo "✅ Certificates are properly installed"
echo "✅ Build configuration is correct"
echo "✅ Entitlements file exists"
echo ""
echo "🔄 For full validation (including notarization auth), you'll need to:"
echo "1. Set environment variables (see MAC_SIGNING_SETUP.md)"
echo "2. Run the full validation script: npm run validate-mac-signing"
echo ""
echo "🚀 Your GitHub Actions will handle signing and notarization automatically!"
echo "   Environment variables should be set as GitHub Secrets for CI/CD" 