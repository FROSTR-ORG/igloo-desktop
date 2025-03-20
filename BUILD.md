# Igloo Build and Release Process

This document outlines the process for building and releasing Igloo.

## Prerequisites

- Node.js and npm installed
- Git installed
- GPG installed and configured
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

3. Export your public key:
   ```bash
   # List your keys
   gpg --list-secret-keys --keyid-format LONG
   
   # Export the key (replace KEY_ID)
   ./scripts/export-key.sh YOUR_KEY_ID
   
   # Commit and push the key
   git add keys/
   git commit -m "Add release signing key"
   git push
   ```

4. Add your GPG key to GitHub:
   - Go to GitHub Settings > SSH and GPG keys
   - Click "New GPG key"
   - Paste the contents of `keys/igloo-signing-key.asc`

## Release Process

1. Create a new release:
   ```bash
   ./scripts/release.sh 1.0.0
   ```
   This will:
   - Update version in package.json
   - Build the application
   - Generate and sign checksums
   - Create a signed git tag

2. Verify the build:
   ```bash
   ./scripts/verify.sh
   ```

3. Push the release:
   ```bash
   git push origin main
   git push origin v1.0.0
   ```

The GitHub Action will automatically:
- Build for all platforms
- Create a GitHub release
- Upload the binaries and verification files

## Testing Releases Locally

Before pushing a release, you can test the entire process locally:

1. Build for your platform:
   ```bash
   # For macOS
   npm run dist:mac
   # For Windows
   npm run dist:win
   # For Linux
   npm run dist:linux
   ```

2. Generate and sign checksums:
   ```bash
   cd release
   shasum -a 256 Igloo* > SHA256SUMS
   gpg --detach-sign --armor SHA256SUMS
   ```

3. Verify everything works:
   ```bash
   # Verify signature
   gpg --verify SHA256SUMS.asc SHA256SUMS
   
   # Verify checksums
   shasum -a 256 -c SHA256SUMS
   ```

## Output Files

The following files will be available in each release:
- Windows: `Igloo-Setup-x.y.z.exe` (installer), `Igloo-x.y.z.exe` (portable)
- macOS: `Igloo-x.y.z.dmg`, `Igloo-x.y.z-mac.zip`
- Linux: `igloo-x.y.z.AppImage`, `igloo_x.y.z.deb`
- Verification: `SHA256SUMS`, `SHA256SUMS.asc`

## Security Notes

- Keep your GPG private key secure
- Use a strong passphrase
- Consider using a hardware security device (like YubiKey)
- Back up your GPG key securely
- Never commit sensitive keys or tokens to the repository

## Additional Resources

- [GPG Documentation](https://www.gnupg.org/documentation/)
- [Bitcoin Core Release Process](https://github.com/bitcoin/bitcoin/blob/master/doc/release-process.md)
- [Electron Builder Documentation](https://www.electron.build/)