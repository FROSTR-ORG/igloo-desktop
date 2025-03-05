# Igloo 
## still under contstructon 🚧
Frostr keyset manager and remote signer.

### Implemented Features
- [x] Keyset generation
- [x] Nsec import (for keyset generation)
- [x] Remote signing (using single share)
- [x] Save individual Encrypted Shares to file system
- [X] Recover nsec from threshold of shares

### TODO
- [ ] FORM VALIDATION FOR SHARE, GROUP, RELAY, NSEC, HEX PRIVKEY.
- [ ] FAQ:
  - What is a share?
  - What is a group?
  - What is a relay?
  - What is an nsec?
  - What does it mean to create a new keyset?
  - What does it mean to recover a keyset?
  - How do you rotate a keyset?
- [ ] Better Logging
- [ ] Better Error Handling
- [ ] Keep Alive / Auto Reconnect
- [ ] Build pipeline
- [ ] Signed binary for Windows, Linux, MacOS

### Run Locally
```bash
npm install
npm run start
```

### App Screens:
ShareList: detect existing share files in filesystem
<img width="1124" alt="Screenshot 2025-03-05 at 3 38 49 PM" src="https://github.com/user-attachments/assets/4c5f30f8-9e2c-49b0-9eb1-b00c5a7faad4" />

Create: create a new keyset by generating a new nsec or pasting in your own
<img width="1165" alt="Screenshot 2025-03-05 at 3 12 47 PM" src="https://github.com/user-attachments/assets/a80e0cba-5a2c-4c50-8623-1c4750517bb1" />

Keyset: copy & save individual shares (only screen where entire keyset is in memory)
<img width="1164" alt="Screenshot 2025-03-05 at 3 14 07 PM" src="https://github.com/user-attachments/assets/1b951ac1-9367-4be6-afe9-468d81875760" />

SaveShare: add and confirm a password for each share (share will be encrypted using pbkdf2)
<img width="1164" alt="Screenshot 2025-03-05 at 3 13 47 PM" src="https://github.com/user-attachments/assets/ef2d74bf-f96b-4440-a396-0f0b148e697e" />

Keyset: shares saved as json files in local file system, saved shares can be detected, but only encrypted with user password.
<img width="1165" alt="Screenshot 2025-03-05 at 3 14 38 PM" src="https://github.com/user-attachments/assets/c1dc0c87-4580-4930-96f8-8cd106552519" />

Continue: keyset will be removed from app state
<img width="1165" alt="Screenshot 2025-03-05 at 3 15 01 PM" src="https://github.com/user-attachments/assets/64b9fb0b-9a15-4c1f-ae9e-7e22b5388447" />

Back to share list
<img width="1166" alt="Screenshot 2025-03-05 at 3 15 15 PM" src="https://github.com/user-attachments/assets/89e009e4-0592-400a-8023-4ffeba29f4f3" />

LoadShare: enter password to decrypt and load single share into memory
<img width="1165" alt="Screenshot 2025-03-05 at 3 15 33 PM" src="https://github.com/user-attachments/assets/82074d5d-daf6-477f-8327-a26fc380119b" />

Signer: Share is in memory, auto populates share and group key in signer. Start the signer and leave running in the background.
<img width="1166" alt="Screenshot 2025-03-05 at 3 15 52 PM" src="https://github.com/user-attachments/assets/a2bc462b-bb70-4d0d-b025-42fbe7a25488" />

Recover: Use threshold of shares in keyset to recover nsec.
<img width="1166" alt="Screenshot 2025-03-05 at 3 16 14 PM" src="https://github.com/user-attachments/assets/2c3a9c73-e43e-4c3d-b4e6-fceb14b59c1b" />






