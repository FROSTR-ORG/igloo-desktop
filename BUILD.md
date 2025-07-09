# Igloo Build and Release Process

This document outlines the process for building and releasing Igloo-desktop.

## Prerequisites

- Node.js and npm installed
- Git installed
- GPG installed and configured (for signing releases)
- GitHub account with repository access

## First-Time Setup

1. Install GPG if not already installed:
   ```bash
   # macOS
   brew install gnupg

   # Ubuntu/Debian
   sudo apt-get install gnupg

   # Windows
   # Download GPG4Win from https://www.gpg4win.org/
   ```

2. Generate a GPG key if you don't have one:
   ```bash
   gpg --full-generate-key
   # Choose RSA and RSA, 4096 bits, no expiration
   ```

3. Add your GPG key to GitHub:
   - Go to GitHub Settings > SSH and GPG keys
   - Click "New GPG key"
   - Run `gpg --armor --export your@email.com`
   - Copy and paste the output into GitHub

4. Configure Git to use your GPG key:
   ```bash
   git config --global user.signingkey YOUR_KEY_ID
   git config --global commit.gpgsign true
   git config --global tag.gpgsign true
   ```

## Release Process

Igloo uses a **dual-layer signing approach** for maximum security:
- **GPG signing**: All release artifacts and Git tags are signed with developer keys
- **macOS code signing**: macOS apps are signed with Apple Developer ID and notarized

### Prerequisites for Releases

1. **GPG setup**: Developer GPG key configured (for all platforms)
2. **macOS signing setup**: Apple Developer ID certificates and notarization configured (for macOS)
3. **GitHub Secrets**: All signing credentials properly configured

### Creating a Release

1. Ensure your working directory is clean:
   ```bash
   git status
   ```

2. Create a new release:
   ```bash
   ./scripts/release.sh 1.0.0
   ```
   This will:
   - Update version in package.json
   - Create a commit with the version change
   - Create a **GPG-signed git tag**
   - Build the application locally

3. Verify the build:
   ```bash
   ./scripts/verify.sh
   ```

4. Push the release:
   ```bash
   git push origin main
   git push origin v1.0.0
   ```

The GitHub Action will automatically:
- Build for all platforms (Windows, macOS, Linux)
- **GPG sign all release artifacts** with developer keys
- **Code sign and notarize macOS apps** with Apple Developer ID
- Generate SHA256 checksums for all files
- Create a GitHub release with verification files
- Upload all binaries with dual-layer security

## Testing Locally

You can test builds locally before releasing:

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# Build for your platform
npm run dist

# Build for Mac without code signing (development only)
npm run dist:mac-unsigned
```

### Testing Scripts

Several validation scripts are available to test your setup:

```bash
# Basic validation (no environment variables required)
npm run validate-mac-signing-basic

# Full validation (requires Apple signing environment variables)
npm run validate-mac-signing
```

### Local macOS Signing Test

To test macOS signing locally, you need to set up environment variables:

```bash
# Set up Apple signing environment variables
export CSC_LINK=~/path/to/developer-id-cert.p12
export CSC_KEY_PASSWORD=your_cert_password
export APPLE_ID=your@email.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=YOUR_TEAM_ID

# Validate setup
npm run validate-mac-signing

# Build with signing and notarization
npm run dist:mac
```

See [MAC_SIGNING_SETUP.md](MAC_SIGNING_SETUP.md) for detailed Apple Developer setup instructions.

### macOS Code Signing Notes

⚠️ **IMPORTANT**: The app now requires proper Apple Developer ID code signing and notarization to prevent the "app is damaged" error on macOS.

1. **For production releases**: Follow the complete setup guide in [MAC_SIGNING_SETUP.md](MAC_SIGNING_SETUP.md)
2. **For development**: Use `npm run dist:mac-unsigned` to build completely unsigned
3. **For users**: Properly signed and notarized releases will work without any manual steps

**Previous ad-hoc signing approach has been replaced** with proper Apple Developer ID signing to ensure compatibility with all macOS versions and Gatekeeper requirements.

## Output Files

Each release includes:
- Windows: `Igloo-Setup-x.y.z.exe` (installer), `Igloo-x.y.z.exe` (portable)
- macOS: 
  - Intel Mac: `Igloo-x.y.z-x64.dmg`, `Igloo-x.y.z-x64.zip`
  - Apple Silicon: `Igloo-x.y.z-arm64.dmg`, `Igloo-x.y.z-arm64.zip`
- Linux: `igloo-x.y.z.AppImage`, `igloo_x.y.z.deb`

## Dual-Layer Security Architecture

Igloo implements comprehensive release security through two complementary signing mechanisms:

### 1. GPG Signing (All Platforms)
- **Purpose**: Verify release integrity and developer authenticity
- **Scope**: Git tags, release artifacts, and checksums
- **Key Type**: Developer PGP/GPG keys
- **Verification**: Users can verify releases using GPG tools

### 2. macOS Code Signing & Notarization
- **Purpose**: Ensure macOS compatibility and prevent "damaged app" errors
- **Scope**: macOS applications only (.app bundles, DMG, ZIP)
- **Key Type**: Apple Developer ID certificates
- **Verification**: Automatic verification by macOS Gatekeeper

### Benefits of Dual Signing
- **Defense in depth**: Multiple layers of security
- **Platform optimization**: Native security for each platform
- **User experience**: Seamless installation on macOS
- **Trust verification**: Users can verify authenticity through multiple channels

## Security Notes

- Keep your GPG private key secure
- Use a strong passphrase
- Consider using a hardware security device (like YubiKey)
- Back up your GPG key securely
- Never commit sensitive keys or tokens to the repository
- Store Apple Developer certificates securely
- Use GitHub Secrets for all signing credentials
- Rotate app-specific passwords regularly

## Additional Resources

- [GPG Documentation](https://www.gnupg.org/documentation/)
- [GitHub GPG Guide](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- [Electron Builder Documentation](https://www.electron.build/)