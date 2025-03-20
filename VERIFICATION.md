# Release Verification Instructions

This document outlines how to verify Igloo release binaries. This process ensures the binaries you download are the ones created by the Igloo developers.

## Verifying Releases

1. Download the release files for your platform from the [official GitHub releases page](https://github.com/FROSTR-ORG/igloo/releases).

2. Verify the Git tag signature:
   ```sh
   git fetch origin --tags
   git verify-tag v1.0.0  # Replace with the version you're verifying
   ```
   
   The output should show:
   ```
   gpg: Good signature from "Your Name <your@email.com>"
   ```

3. Verify the commit signature:
   ```sh
   git verify-commit v1.0.0^{commit}
   ```

## Common Issues

### GPG: Good signature, but key is not certified

This warning means you've verified the signature but haven't personally certified the key. You can:
1. Verify the key fingerprint through other channels (GitHub, Twitter, etc.)
2. Sign the key if you trust it:
   ```sh
   gpg --sign-key your@email.com
   ```

### GPG: Can't check signature: No public key

You need to import the developer's public key. You can:
1. Get it from GitHub's API:
   ```sh
   curl -L https://api.github.com/users/USERNAME/gpg_keys | jq -r '.[0].raw_key' | gpg --import
   ```
2. Or from their GitHub profile directly (look for the GPG keys section)

## Security Notes

- Always download release files directly from the [official GitHub releases page](https://github.com/FROSTR-ORG/igloo/releases)
- Cross-reference the signing key fingerprint through multiple sources
- Report any verification issues immediately by opening a GitHub issue 