# Release Verification Instructions

This document outlines how to verify Igloo-desktop release binaries. Igloo uses **dual-layer security** for maximum protection:

- **GPG signing**: All release artifacts are signed with developer keys
- **macOS code signing**: macOS apps are signed with Apple Developer ID and notarized

## Verification Methods

### 1. GPG Verification (All Platforms)

Each release includes verification files:
- `igloo-signing-key.asc` - Developer's public GPG key
- `SHA256SUMS` - File checksums for all platforms
- `SHA256SUMS.asc` - GPG signature for checksums

To verify a release:

1. Import the public key:
   ```sh
   curl -sL https://github.com/FROSTR-ORG/igloo-desktop/releases/download/VERSION/igloo-signing-key.asc | gpg --import
   ```

2. Verify the checksums signature:
   ```sh
   curl -sL https://github.com/FROSTR-ORG/igloo-desktop/releases/download/VERSION/SHA256SUMS.asc | gpg --verify
   ```

3. Verify file checksums:
   ```sh
   curl -sL https://github.com/FROSTR-ORG/igloo-desktop/releases/download/VERSION/SHA256SUMS | shasum -a 256 -c
   ```

Replace `VERSION` with the version you're verifying (e.g., `v0.1.2`).

### 2. macOS Code Signature Verification

macOS apps include additional Apple-verified signatures:

1. **Verify Apple Developer ID signature**:
   ```sh
   codesign -dv --verbose=4 /path/to/Igloo.app
   ```

2. **Verify notarization**:
   ```sh
   spctl -a -vv /path/to/Igloo.app
   ```

3. **Check app entitlements**:
   ```sh
   codesign -d --entitlements :- /path/to/Igloo.app
   ```

A properly signed and notarized macOS app will show:
- `Status: accepted` in `spctl` output
- `Developer ID Application: Austin Kelsay` in `codesign` output
- `Notarization: accepted` (for macOS 10.15+)

## Advanced Verification

You can also verify the Git tag and commit signatures:

1. Verify the Git tag signature:
   ```sh
   git fetch origin --tags
   git verify-tag VERSION  # Replace with the version you're verifying
   ```
   
2. Verify the commit signature:
   ```sh
   git verify-commit VERSION^{commit}
   ```

## Common Issues

### GPG Verification Issues

**GPG: Good signature, but key is not certified**

This warning means you've verified the signature but haven't personally certified the key. You can:
1. Verify the key fingerprint through other channels (GitHub, Twitter, etc.)
2. Sign the key if you trust it:
   ```sh
   gpg --sign-key austinkelsay@protonmail.com
   ```

**GPG: Can't check signature: No public key**

You need to import the developer's public key using the steps above. The key is included with each release for convenience.

### macOS Verification Issues

**"Igloo is damaged and can't be opened"**

This indicates a code signature issue. For releases v0.1.2+, this shouldn't occur as apps are properly signed and notarized. If you encounter this:
1. Verify you downloaded from the official GitHub releases page
2. Check the code signature: `codesign -dv /path/to/Igloo.app`
3. Report the issue if the signature is invalid

**"Cannot verify developer" or "unidentified developer"**

This occurs with older releases (v0.1.1 and earlier) that used ad-hoc signing. Upgrade to the latest release for proper code signing.

## Security Notes

- Always download release files directly from the [official GitHub releases page](https://github.com/FROSTR-ORG/igloo-desktop/releases)
- Cross-reference the signing key fingerprint through multiple sources
- **For macOS users**: Both GPG and code signature verification provide complementary security
- **For Windows/Linux users**: GPG verification is the primary security mechanism
- Report any verification issues immediately by opening a GitHub issue 