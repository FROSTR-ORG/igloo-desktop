# Igloo 
## still under contstructon 🚧
Frostr keyset manager and remote signer.

### Implemented Features
- [x] Key generation
- [x] Key rotation
- [x] Nsec import
- [x] Remote signing

### TODO
- [ ] Encrypted App State
    <!-- 
    Generate a random salt number
    User puts in custom password for a given keyset
    use @noble/hashes to derive key from password and salt (pbkdf2)
    use key to encrypt/decrypt key share state in folders in the file system
    In file save Buff.join([salt, encryptedData])
    In file read, split the data into salt and encryptedData and use the salt with user entered password to derive the key 
    -->
- [ ] Manage shares (rotate)
  <!-- 
  - If nsec is entered for rotation then get the pubkey of that nsec and verify that it matches the pubkey of the current share loaded in the UI.
  -->
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

