# Igloo 
## still under contstructon 🚧
Frostr keyset manager and remote signer.

### Implemented Features
- [x] Key generation
- [x] Key rotation
- [x] Nsec import
- [x] Remote signing

### TODO
- [ ] Save Encrypted Shares to file system
- [ ] Recover NSEC from threshold of shares
  <!-- 
  - If nsec is entered for rotation then get the pubkey of that nsec and verify that it matches the pubkey of the current share loaded in the UI.
  -->
  <!-- 
  Ensure that keyset with name already saved in file system can not be created again.
  -->
  <!-- Add confirm password for saving each share-->
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
- [ ] Signed binary 

### Run Locally
```bash
npm install
npm run start
```

<img width="1791" alt="Screenshot 2025-02-17 at 4 47 10 PM" src="https://github.com/user-attachments/assets/3b4929f7-b801-477c-a2de-c25dbabb0cca" />
<img width="1788" alt="Screenshot 2025-02-17 at 4 47 25 PM" src="https://github.com/user-attachments/assets/8fba582e-5fba-46b1-8b6e-d7cc0501257e" />

