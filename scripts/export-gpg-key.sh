#!/bin/bash
# Script to export your GPG key for distribution

set -e

# Check if key ID is provided
if [ -z "$1" ]; then
  echo "Usage: ./export-gpg-key.sh <GPG_KEY_ID>"
  echo "Example: ./export-gpg-key.sh 3AA5C34371567BD2"
  echo ""
  echo "Your available keys:"
  gpg --list-secret-keys --keyid-format LONG
  exit 1
fi

KEY_ID=$1
KEYS_DIR="keys"

# Create keys directory if it doesn't exist
mkdir -p $KEYS_DIR

# Export the public key
echo "Exporting GPG public key $KEY_ID..."
gpg --armor --export $KEY_ID > $KEYS_DIR/igloo-signing-key.asc

# Verify the key was exported
if [ -f "$KEYS_DIR/igloo-signing-key.asc" ]; then
  echo "GPG key exported successfully to $KEYS_DIR/igloo-signing-key.asc"
  echo "Content of the key file:"
  cat $KEYS_DIR/igloo-signing-key.asc
  echo ""
  echo "Make sure to commit and push this file to your repository so users can verify your releases."
else
  echo "Error: Failed to export the GPG key."
  exit 1
fi 