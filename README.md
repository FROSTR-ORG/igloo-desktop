# Igloo 
Frostr keyset manager and remote signer for secure distributed key management.

Igloo is part of the FROSTR ecosystem - a k-of-n remote signing and key management protocol for nostr, using the powers of FROST (Flexible Round-Optimized Schnorr Threshold signatures).

## Table of Contents
- [Implemented Features](#implemented-features)
- [TODO](#todo)
- [Installation](#installation)
  - [Download Release (Recommended)](#download-release-recommended)
  - [Build from Source](#build-from-source)
  - [Run Locally for Development](#run-locally-for-development)
- [App Screens](#app-screens)
- [How It Works](#how-it-works)
- [FAQ](#faq)
  - [General Concepts](#general-concepts)
  - [Keyset Operations](#keyset-operations)
  - [Key Rotation](#key-rotation)

### Implemented Features
- [x] Keyset generation
- [x] Nsec import (for keyset generation)
- [x] Remote signing (using single share)
- [x] Save individual Encrypted Shares to file system
- [X] Recover nsec from threshold of shares
- [x] Signed binary for Windows, Linux, MacOS
- [x] Build pipeline
- [x] Event Log for Signer
- [x] FAQ
- [x] Better Form Validation for Share, Group, Relay, Nsec, Hex Privkey
- [x] QR code generation for easy share transfer between devices
- [x] Ping confirmation for QR code transfers

### TODO
- [ ] Better Error Messages and Fallbacks
- [ ] Keep Alive / Auto Reconnect

## Installation

### Download Release (Recommended)

Download the latest release for your platform from our [GitHub Releases](https://github.com/FROSTR-ORG/igloo/releases) page.

All releases are GPG signed and include SHA256 checksums for verification. We strongly recommend verifying your download:
1. See [VERIFICATION.md](VERIFICATION.md) for detailed verification instructions
2. Import our signing key from the `keys` directory
3. Verify both the signature and checksums before running the application

Available formats:
- Windows: Installer (.exe) and portable (.exe)
- macOS: DMG (.dmg) and ZIP (.zip)
- Linux: AppImage (.AppImage) and Debian package (.deb)

### Build from Source

If you prefer to build from source, see [BUILD.md](BUILD.md) for detailed instructions.

### Run Locally for Development
```bash
npm install
npm run start
```

### App Screens:
ShareList: detect existing share files in filesystem
<img width="1124" alt="Screenshot 2025-03-05 at 3 38 49 PM" src="https://github.com/user-attachments/assets/4c5f30f8-9e2c-49b0-9eb1-b00c5a7faad4" />

Create: create a new keyset by generating a new nsec or pasting in your own
<img width="1165" alt="Screenshot 2025-03-05 at 3 12 47 PM" src="https://github.com/user-attachments/assets/a80e0cba-5a2c-4c50-8623-1c4750517bb1" />

Keyset: copy & save individual shares (only screen where entire keyset is in memory)
<img width="1164" alt="Screenshot 2025-03-05 at 3 14 07 PM" src="https://github.com/user-attachments/assets/1b951ac1-9367-4be6-afe9-468d81875760" />

Keyset also allows sharing via QR code for easy transfer to other devices:
- Click the QR code button next to any share
- Scan the QR code with another device to easily import the share
- The QR code will remain visible until the receiving device confirms receipt
- When the share is successfully received, the UI automatically updates to show confirmation
- Securely transfer shares between your devices with visual confirmation

SaveShare: add and confirm a password for each share (share will be encrypted using pbkdf2)
<img width="1164" alt="Screenshot 2025-03-05 at 3 13 47 PM" src="https://github.com/user-attachments/assets/ef2d74bf-f96b-4440-a396-0f0b148e697e" />

Keyset: shares saved as json files in local file system, saved shares can be detected, but only encrypted with user password.
<img width="1165" alt="Screenshot 2025-03-05 at 3 14 38 PM" src="https://github.com/user-attachments/assets/c1dc0c87-4580-4930-96f8-8cd106552519" />

Continue: keyset will be removed from app state
<img width="1165" alt="Screenshot 2025-03-05 at 3 15 01 PM" src="https://github.com/user-attachments/assets/64b9fb0b-9a15-4c1f-ae9e-7e22b5388447" />

Back to share list
<img width="1166" alt="Screenshot 2025-03-05 at 3 15 15 PM" src="https://github.com/user-attachments/assets/89e009e4-0592-400a-8023-4ffeba29f4f3" />

LoadShare: enter password to decrypt and load single share into memory
<img width="1165" alt="Screenshot 2025-03-05 at 3 15 33 PM" src="https://github.com/user-attachments/assets/82074d5d-daf6-477f-8327-a26fc380119b" />

Signer: Share is in memory, auto populates share and group key in signer. Start the signer and leave running in the background.
<img width="1282" alt="Screenshot 2025-03-25 at 1 51 16 PM" src="https://github.com/user-attachments/assets/fc44061d-492f-4063-8db8-38fccddb2fbd" />

EventLog: See a full log of all events (requests / responses / node stte) within a session of running the signer on a given share.
<img width="1323" alt="Screenshot 2025-03-25 at 1 53 45 PM" src="https://github.com/user-attachments/assets/f9211673-3d0e-41d3-8378-a7dede4331f9" />

Recover: Use threshold of shares in keyset to recover nsec.
<img width="1166" alt="Screenshot 2025-03-05 at 3 16 14 PM" src="https://github.com/user-attachments/assets/2c3a9c73-e43e-4c3d-b4e6-fceb14b59c1b" />

## How It Works

Igloo implements the FROSTR protocol, which uses Shamir Secret Sharing to break up your nsec into "shares" and a hyper-optimized version of FROST to coordinate signing of messages.

The workflow is simple:
1. Use Igloo to generate a new nsec or import your existing one
2. Create your multi-signature setup (like 2/3, 3/5, etc.) generating multiple shares
3. Store each share securely on different devices (Igloo, Frost2x extension, etc.)
4. When signing is needed, your FROSTR nodes communicate over nostr relays using end-to-end encrypted notes
5. Your signatures remain unchanged - nobody knows you're using multi-sig

The beauty of this system is that it's a drop-in replacement for existing signing solutions, working with NIP-07 and NIP-46 compatible applications.

## FAQ

### General Concepts

#### What is a share?
A share is a piece of your private key (nsec) that has been split using Shamir's Secret Sharing (SSS), which is implemented in the FROST protocol. SSS uses polynomial interpolation to split your private key into multiple shares. Each share alone cannot be used to access your funds or sign transactions. A share is intrinsically tied to its keyset - it cannot be used with shares from different keysets, and it does not reveal any sensitive information unless combined with other shares from the same keyset (up to the threshold). This threshold-based approach ensures that no single share can compromise your security.

#### What is a keyset?
A keyset is a collection of shares that work together to represent your private key (nsec). When you create a new keyset, you generate multiple shares that are mathematically related to each other. The keyset is identified by a unique group key that helps you manage and organize your shares. Each share in a keyset is designed to work together and cannot be mixed with shares from other keysets. This relationship ensures that shares from different keysets cannot be combined to reconstruct a private key.

#### What is a relay?
A relay is a server that facilitates communication between different parts of the system. In the context of remote signing, relays help transmit signing requests and responses between the client and the signer. Relays are essential for the distributed nature of the FROST protocol, allowing different shares to communicate securely without being in direct contact.

#### What is an nsec?
An nsec is your private key in the Nostr protocol. It's a secret key that should never be shared with anyone and is used to sign messages and prove ownership of your public key (npub). When using Igloo, your nsec is split into shares using the FROST protocol, allowing for secure distributed signing without ever exposing the complete private key.

### Keyset Operations

#### What does it mean to create a new keyset?
Creating a new keyset involves either generating a new private key (nsec) or importing your own existing nsec, and then splitting it into multiple shares using Shamir's Secret Sharing (SSS) as implemented in the FROST protocol. This process helps distribute the risk of key loss across multiple shares while ensuring that no single share can compromise your security. Whether you're generating a new nsec or using your own, the result is the same - a set of shares that together represent your private key.

#### What does it mean to recover a keyset?
Recovering a keyset is the process of reconstructing your original private key (nsec) by combining a sufficient number of shares (meeting the threshold requirement) using polynomial interpolation. This is useful when you need to access your full private key, such as when migrating to a new system. The recovery process uses the FROST protocol's share combination algorithm to reconstruct the original private key.

### Key Rotation

#### How do you rotate a keyset?
If one of your shares is lost or compromised, you can abandon it by replacing your existing shares with a new set. This renders the compromised share useless. The rotation process is simple:

1. Re-import your nsec into Igloo and generate a new set of shares
2. Destroy all existing shares from the old keyset (remove them from signers and delete)
3. Transfer your newly created shares to your signing devices
4. Your npub remains unchanged, and your online identity continues uninterrupted

There is no limit to how many sets of shares your nsec can generate, and each new set is random. You can rotate as frequently as needed for security.

#### Why would I rotate my shares?
You should rotate your shares if:
- You suspect one of your shares has been compromised
- You've lost access to one or more shares
- You want to change your threshold setup (e.g., from 2/3 to 3/5)
- As a regular security practice, similar to changing passwords

#### What are the benefits of using FROSTR?
- Break up your nsec into fragments called "shares"
- Create any kind of multi-signature setup (2/3, 3/5, etc.)
- If one share is compromised, your secret key remains safe
- Simple key rotation
- Your npub doesn't change - maintain your existing nostr identity
- Your signatures remain unchanged - nobody knows you're using multi-sig
- End-to-end encrypted communication between signing nodes





