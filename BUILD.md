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
   - Create a signed git tag
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
- Create a GitHub release
- Upload all binaries

## Testing Locally

You can test builds locally before releasing:

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# Build for your platform
npm run dist

# Build for Mac without code signing (avoids "damaged" error)
npm run dist:mac-unsigned
```

### macOS Code Signing Notes

The app uses **ad-hoc signing** (`identity: "-"`) by default, which should prevent the "damaged" error on most macOS systems. If you encounter issues:

1. **For development**: Use `npm run dist:mac-unsigned` to build completely unsigned
2. **For distribution**: Consider getting an Apple Developer certificate for proper code signing
3. **For users**: See the macOS Installation Troubleshooting section in README.md

## Output Files

Each release includes:
- Windows: `Igloo-Setup-x.y.z.exe` (installer), `Igloo-x.y.z.exe` (portable)
- macOS: 
  - Intel Mac: `Igloo-x.y.z-x64.dmg`, `Igloo-x.y.z-x64.zip`
  - Apple Silicon: `Igloo-x.y.z-arm64.dmg`, `Igloo-x.y.z-arm64.zip`
- Linux: `igloo-x.y.z.AppImage`, `igloo_x.y.z.deb`

## Security Notes

- Keep your GPG private key secure
- Use a strong passphrase
- Consider using a hardware security device (like YubiKey)
- Back up your GPG key securely
- Never commit sensitive keys or tokens to the repository

## Additional Resources

- [GPG Documentation](https://www.gnupg.org/documentation/)
- [GitHub GPG Guide](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- [Electron Builder Documentation](https://www.electron.build/)