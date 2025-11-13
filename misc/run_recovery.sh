#!/bin/bash
# YubiKey PKCS11 Decryption Wrapper
#
# This script wraps pkcs11-tool to decrypt data using a YubiKey hardware token.
# It's designed to be called by the Fordefi recovery-tool as a decrypt command.
#
# How it works:
# 1. Reads encrypted data from stdin (provided by recovery-tool)
# 2. Decrypts the data using the YubiKey's RSA private key (PIV slot 9D, ID 03)
# 3. Outputs the decrypted data to stdout (consumed by Fordefi recovery-tool)
#
# Technical details:
# - Uses RSA-PKCS-OAEP padding with SHA256 hash algorithm
# - Communicates with YubiKey via PKCS11 interface (libykcs11.dylib)
# - pkcs11-tool writes debug messages to stdout, so we capture them separately
#   to prevent contamination of the binary decrypted data

# Check if PIN argument is provided
if [ $# -ne 1 ]; then
    echo "ERROR: YubiKey PIN required" >&2
    echo "Usage: $0 <PIN>" >&2
    exit 1
fi

PIN="$1"

# Validate PIN format (should be 6-8 characters)
if ! [[ "$PIN" =~ ^.{6,8}$ ]]; then
    echo "ERROR: Invalid PIN format. PIN must be 6-8 characters." >&2
    exit 1
fi

# Log decryption start and environment info to stderr (for debugging)
echo "=== PKCS11 Decrypt Started at $(date) ===" >&2
echo "Working Directory: $(pwd)" >&2
echo "User: $(whoami)" >&2

# Create temporary files for handling input/output
# We need temp files because pkcs11-tool can't read/write binary data from/to pipes reliably
TMPFILE=$(mktemp)   # Stores encrypted input data
TMPOUT=$(mktemp)    # Stores decrypted output data
TMPSTDERR=$(mktemp) # Captures pkcs11-tool stderr
TMPSTDOUT=$(mktemp) # Captures pkcs11-tool stdout (debug messages)

# Read encrypted data from stdin and save to temp file
cat > "$TMPFILE"
echo "Input size: $(wc -c < "$TMPFILE") bytes" >&2

# Decrypt using YubiKey via pkcs11-tool
# - --decrypt: perform decryption operation
# - --id 03: use key with ID 03 (PIV Key Management slot 9D)
# - --pin: YubiKey PIN for authentication (passed as argument)
# - --mechanism RSA-PKCS-OAEP: use OAEP padding (matches encryption)
# - --hash-algorithm SHA256: use SHA256 for OAEP hash
# - --module: path to YubiKey PKCS11 library
pkcs11-tool --decrypt --id 03 --pin "$PIN" --mechanism RSA-PKCS-OAEP --hash-algorithm SHA256 --module /opt/homebrew/lib/libykcs11.dylib --input-file "$TMPFILE" --output-file "$TMPOUT" 2> "$TMPSTDERR" > "$TMPSTDOUT"

# Capture exit code to check if decryption succeeded
EXIT_CODE=$?

# Output debug info to stderr (won't contaminate stdout)
cat "$TMPSTDERR" >&2
cat "$TMPSTDOUT" >&2

echo "Exit code from pkcs11-tool: $EXIT_CODE" >&2
echo "Output file size: $(wc -c < "$TMPOUT") bytes" >&2

# Output the clean decrypted data to stdout
# This is what gets consumed by recovery-tool as the decrypted session key
cat "$TMPOUT"

# Clean up all temporary files
rm -f "$TMPFILE" "$TMPOUT" "$TMPSTDERR" "$TMPSTDOUT"

echo "=== PKCS11 Decrypt Finished at $(date) with exit code: $EXIT_CODE ===" >&2

exit $EXIT_CODE
