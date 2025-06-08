# Release Verification Instructions

This document outlines how to verify Igloo-desktop release binaries. This process ensures the binaries you download are the ones created by the Igloo developers.

## Quick Verification

Each release includes verification files:
- `igloo-signing-key.asc` - Developer's public key
- `SHA256SUMS` - File checksums
- `SHA256SUMS.asc` - Signature for checksums

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

Replace `VERSION` with the version you're verifying (e.g., `v0.0.3`).

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

### GPG: Good signature, but key is not certified

This warning means you've verified the signature but haven't personally certified the key. You can:
1. Verify the key fingerprint through other channels (GitHub, Twitter, etc.)
2. Sign the key if you trust it:
   ```sh
   gpg --sign-key austinkelsay@protonmail.com
   ```

### GPG: Can't check signature: No public key

You need to import the developer's public key using the steps above. The key is included with each release for convenience.

## Security Notes

- Always download release files directly from the [official GitHub releases page](https://github.com/FROSTR-ORG/igloo-desktop/releases)
- Cross-reference the signing key fingerprint through multiple sources
- Report any verification issues immediately by opening a GitHub issue 