# macOS Code Signing and Notarization Setup

This guide walks through setting up Apple Developer certificates and notarization for Igloo as part of our **dual-layer security architecture**.

## Security Architecture Overview

Igloo implements comprehensive release security through two complementary mechanisms:

1. **GPG Signing (All Platforms)**: Developer-controlled signing for release integrity verification
2. **macOS Code Signing & Notarization**: Apple-verified signing for macOS compatibility and security

This setup specifically covers **macOS code signing** to eliminate the "app is damaged" error and ensure seamless installation on macOS.

## Prerequisites

1. **Apple Developer Account**: Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. **macOS Development Machine**: For initial certificate setup
3. **Xcode or Xcode Command Line Tools**: For `codesign` and `notarytool`

## Step 1: Create Certificates

### In Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Certificates** → **+** (Create new certificate)
4. Select **Developer ID Application** (for distributing outside Mac App Store)
5. Follow prompts to generate and download the certificate

### Install Certificate

1. Double-click the downloaded `.cer` file to install in Keychain
2. Open **Keychain Access** → **My Certificates**
3. Find your "Developer ID Application" certificate
4. Right-click → **Export** → Save as `.p12` file with a secure password

## Step 2: Get Your Team ID

1. In Apple Developer Portal, go to **Membership**
2. Copy your **Team ID** (10-character string like `ABC123DEF4`)

## Step 3: Create App-Specific Password

1. Go to [Apple ID Account](https://appleid.apple.com/)
2. Sign in with your Apple Developer account
3. Navigate to **Security** → **App-Specific Passwords**
4. Click **+** to create a new password
5. Name it "Igloo Notarization" and copy the generated password

## Step 4: Configure GitHub Secrets

In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions** and add:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `CSC_LINK` | Base64 encoded .p12 file | Your exported certificate |
| `CSC_KEY_PASSWORD` | Password for .p12 file | Certificate password |
| `APPLE_ID` | your@email.com | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | xxxx-xxxx-xxxx-xxxx | App-specific password |
| `APPLE_TEAM_ID` | ABC123DEF4 | Your Team ID |

### Encoding the Certificate

To create the `CSC_LINK` value:

```bash
# Base64 encode your .p12 file
base64 -i /path/to/your/certificate.p12 | pbcopy
# Paste the output as CSC_LINK secret value
```

## Step 5: Verify package.json Configuration

The `package.json` is already configured to use environment variables for notarization:

```json
"notarize": true
```

When `notarize` is set to `true`, electron-builder automatically uses these environment variables:
- `APPLE_TEAM_ID` - Your Team ID
- `APPLE_ID` - Your Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD` - Your app-specific password

This approach is more secure and flexible than hardcoding values in the configuration.

## Step 6: Test Locally

Before pushing to CI, test signing locally:

```bash
# Set environment variables
export CSC_LINK=/path/to/your/certificate.p12
export CSC_KEY_PASSWORD=your_cert_password
export APPLE_ID=your@email.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=ABC123DEF4

# Build and sign
npm run dist:mac
```

## Step 7: Verify Signed App

After building, verify the app is properly signed:

```bash
# Check code signature
codesign -dv --verbose=4 /path/to/Igloo.app

# Check notarization (after upload)
spctl -a -vv /path/to/Igloo.app

# Should show: "accepted" and "notarized"
```

## Troubleshooting

### Common Issues

1. **"No identity found"**: Certificate not properly installed in Keychain
2. **"Authentication failed"**: Wrong Apple ID or app-specific password
3. **"Invalid Team ID"**: Team ID doesn't match your Developer account
4. **"Hardened runtime error"**: Missing required entitlements

### Debug Commands

```bash
# List available certificates
security find-identity -v -p codesigning

# Check app entitlements
codesign -d --entitlements :- /path/to/Igloo.app

# Check notarization status
xcrun notarytool history --apple-id your@email.com --team-id ABC123DEF4
```

## Security Notes

- **Never commit certificates** or passwords to version control
- **Use GitHub Secrets** for all sensitive values
- **Rotate app-specific passwords** regularly
- **Keep .p12 files secure** with strong passwords

## Cost Considerations

- Apple Developer Program: $99/year
- Notarization: Free (included with Developer Program)
- Code signing: Free (included with Developer Program)

Once set up, all future releases will be automatically:
- **GPG signed** (for release integrity verification across all platforms)
- **macOS code signed and notarized** (for seamless macOS installation)

This dual-layer approach provides comprehensive security while ensuring the best user experience on macOS. 