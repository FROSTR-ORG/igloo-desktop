# Release Verification Instructions

This document outlines how to verify Igloo release binaries. This process ensures the binaries you download are the ones created by the Igloo developers.

## Windows, macOS, and Linux

### Using GPG

1. Download the release files and verification files:
   - The binary for your platform (e.g., `Igloo-1.0.0.dmg` for macOS)
   - `SHA256SUMS`
   - `SHA256SUMS.asc`

2. Import the Igloo release signing key:
   ```sh
   curl -sL https://raw.githubusercontent.com/austinkelsay/igloo/main/keys/igloo-signing-key.asc | gpg --import
   ```

3. Verify the checksums file is signed by the release signing key:
   ```sh
   gpg --verify SHA256SUMS.asc SHA256SUMS
   ```
   
   The output should show:
   ```
   gpg: Good signature from "Austin Kelsay <austinkelsay@protonmail.com>"
   ```

4. Verify the binary matches the signed checksums:
   ```sh
   # macOS/Linux
   shasum -a 256 --check SHA256SUMS
   
   # Windows (PowerShell)
   Get-FileHash -Algorithm SHA256 Igloo-Setup-*.exe | Format-List
   # Compare this output with SHA256SUMS
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

You need to import the signing key first. Run the import command from step 2.

## Security Notes

- Always download release files directly from the [official GitHub releases page](https://github.com/austinkelsay/igloo/releases)
- Cross-reference the signing key fingerprint through multiple sources
- Report any verification issues immediately by opening a GitHub issue 