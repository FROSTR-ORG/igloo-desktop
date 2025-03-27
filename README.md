# Igloo 
Frostr keyset manager and remote signer.

## Table of Contents
- [Implemented Features](#implemented-features)
- [TODO](#todo)
- [Installation](#installation)
  - [Download Release (Recommended)](#download-release-recommended)
  - [Build from Source](#build-from-source)
  - [Run Locally for Development](#run-locally-for-development)
- [App Screens](#app-screens)
- [FAQ](#faq)
  - [General Concepts](#general-concepts)
  - [Keyset Operations](#keyset-operations)

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

### TODO
- [ ] Better Form Validation for Share, Group, Relay, Nsec, Hex Privkey.
- [ ] Better Error Messages and Fallbacks
- [ ] Keep Alive / Auto Reconnect

## Installation

### Download Release (Recommended)

Download the latest release for your platform from our [GitHub Releases](https://github.com/austinkelsay/igloo/releases) page.

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

Create: create a new keyset by generating a new nsec or pasting in your own (nsec is in memory)
<img width="1165" alt="Screenshot 2025-03-05 at 3 12 47 PM" src="https://github.com/user-attachments/assets/a80e0cba-5a2c-4c50-8623-1c4750517bb1" />

Keyset: copy & save individual shares (keyset is in memory)
<img width="1164" alt="Screenshot 2025-03-05 at 3 14 07 PM" src="https://github.com/user-attachments/assets/1b951ac1-9367-4be6-afe9-468d81875760" />

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

#### How do you rotate a keyset?
Rotating a keyset involves creating a new keyset and transferring your assets/identity to the new one. This is a security best practice that helps protect against potential compromises of your existing keyset. The process is as follows:
1. Create a new keyset (from the same nsec)
2. Destroy all existing shares from the old keyset (remove them from signers and delete)
3. Transfer your newly created shares and group public key into your signers.
4. You have now effectively rotated your keyset. 

If any shares were lost or stolen from the old keyset they have now been orphaned by you destroying the other shares in the old keyset.





