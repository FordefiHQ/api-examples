 # Fordefi Backup Recovery with YubiKey

This guide explains how to recover private keys from a Fordefi `backup_snapshot.json` file using a YubiKey hardware token and the Fordefi recovery-tool.

## Overview

The recovery process uses:
- **YubiKey**: Hardware key containing an RSA-2048 private key
- **Fordefi Recovery tool**: Binary that decrypts the backup snapshot, available to download [here](https://docs.fordefi.com/user-guide/backup-and-recover-private-keys/recovery/recover-private-keys#procedure)
- **run_recovery.sh**: Main script that orchestrates the recovery process with the YubiKey

## Prerequisites

### 1. Install Required Tools and Dependencies

#### macOS

```bash
brew install yubico-piv-tool
brew install opensc
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y yubico-piv-tool opensc libengine-pkcs11-openssl
```

#### Linux (Fedora/RHEL/CentOS)

```bash
sudo dnf install -y yubico-piv-tool opensc engine-pkcs11
```

#### Windows

1. **Download and install YubiKey Manager**:
   - Download from [https://developers.yubico.com/yubico-piv-tool/Releases/](https://developers.yubico.com/yubico-piv-tool/Releases/)
   - Run the installer and follow the installation wizard

2. **Download and install OpenSC**:
   - Download from [https://github.com/OpenSC/OpenSC/releases](https://github.com/OpenSC/OpenSC/releases)
   - Run the installer and follow the installation wizard

3. **Add to PATH** (if not automatically added):
   - Add `C:\Program Files\Yubico\YubiKey Manager` to your PATH environment variable
   - Add `C:\Program Files\OpenSC Project\OpenSC\tools` to your PATH environment variable

### 2. Required Files

Ensure you have these files in your working directory:
- `backup_snapshot.json` - Your Fordefi backup file
- `recovery-tool` (or `recovery-tool.exe` on Windows) - Fordefi's recovery binary
- `run_recovery.sh` - Main recovery script (macOS/Linux)
- `run_recovery.bat` - Main recovery script (Windows)

## YubiKey Setup

### Verify YubiKey Configuration

Check that your YubiKey is properly configured and contains the private key in the correct slot:

#### macOS

```bash
pkcs11-tool --module /opt/homebrew/lib/libykcs11.dylib --list-objects --pin YOUR_PIN
```

#### Linux

```bash
pkcs11-tool --module /usr/lib/x86_64-linux-gnu/libykcs11.so --list-objects --pin YOUR_PIN
```

**Note**: The library path may vary by distribution:

- Ubuntu/Debian: `/usr/lib/x86_64-linux-gnu/libykcs11.so`
- Fedora/RHEL: `/usr/lib64/libykcs11.so`

#### Windows (PowerShell)

```powershell
& "C:\Program Files\OpenSC Project\OpenSC\tools\pkcs11-tool.exe" --module "C:\Program Files\Yubico\Yubico PIV Tool\bin\libykcs11.dll" --list-objects --pin YOUR_PIN
```

**Expected Output (all platforms):**
- **Private Key Object**: RSA key in slot 9D with ID 03, labeled "Private key for Key Management"
- **Usage**: decrypt, sign
- **Type**: RSA 2048 bits

## Recovery Process

### Run the Recovery Command

Execute the recovery-tool with your YubiKey PIN:

#### macOS / Linux

```bash
./recovery-tool public-key-recover -d './run_recovery.sh YOUR_PIN' -p 'backup_snapshot.json' > private_keys.csv 2>&1
```

Replace `YOUR_PIN` with your actual YubiKey PIN (6-8 characters).

**Example:**
```bash
./recovery-tool public-key-recover -d './run_recovery.sh 123456' -p 'backup_snapshot.json' > private_keys.csv 2>&1
```

#### Windows (PowerShell)

For Windows, you'll need to create a `run_recovery.bat` script (see Windows-specific scripts section below) or use the bash script with WSL (Windows Subsystem for Linux).

**Using PowerShell with .bat script:**

```powershell
.\recovery-tool.exe public-key-recover -d "cmd /c run_recovery.bat YOUR_PIN" -p "backup_snapshot.json" > private_keys.csv
```

**Note**: On Windows, you will only see a "Recovering vault 100%" progress bar during execution. The detailed PKCS11 logging that appears on macOS/Linux is not visible in the PowerShell terminal due to how Windows handles stderr redirection. The decryption still works correctly.

**Using WSL:**

```bash
./recovery-tool public-key-recover -d './run_recovery.sh YOUR_PIN' -p 'backup_snapshot.json' > private_keys.csv 2>&1
```

### Command Breakdown

- `./recovery-tool public-key-recover` - Run the Fordefi recovery tool in public-key mode
- `-d './run_recovery.sh YOUR_PIN'` - Specify the decrypt command (calls run_recovery.sh with your PIN)
- `-p 'backup_snapshot.json'` - Path to your backup snapshot file
- `> private_keys.csv` - Redirect output to CSV file
- `2>&1` - Capture both stdout and stderr to the CSV file

### How the Recovery Script Works

#### macOS / Linux (run_recovery.sh)

The `run_recovery.sh` script accepts your PIN as a command-line argument:

```bash
./run_recovery.sh <PIN>
```

**Security features:**
- PIN validation: Must be 6-8 characters
- Error handling: Clear error messages if PIN is missing or invalid
- No hardcoded credentials: PIN must be provided each time

**The script will:**
1. Validate the PIN format
2. Read encrypted data from stdin (provided by recovery-tool)
3. Call pkcs11-tool with your PIN to decrypt using the YubiKey
4. Output clean decrypted data to stdout (consumed by recovery-tool)

#### Windows (run_recovery.bat)

The `run_recovery.bat` script works similarly to the bash version and accepts your PIN as a command-line argument.

**Security features:**
- PIN validation: Must be 6-8 characters
- Error handling: Clear error messages if PIN is missing or invalid
- No hardcoded credentials: PIN must be provided each time

**Note**: Adjust the paths to `libykcs11.dll` and `pkcs11-tool.exe` in the batch file if your installation directories differ from the defaults.

### What Happens During Recovery

1. **Recovery-tool** reads `backup_snapshot.json` and extracts encrypted device shares
2. For each encrypted share:
   - Recovery-tool pipes the encrypted data to `run_recovery.sh YOUR_PIN`
   - **run_recovery.sh** validates the PIN and interfaces with the YubiKey via PKCS11
   - YubiKey decrypts using its RSA private key (using the PIN you provided)
   - Decrypted session key is returned to recovery-tool
3. Recovery-tool uses the session keys to decrypt the master key shares
4. Master keys are reconstructed and output as private keys in CSV format

## Output

### Success

If successful, you'll see output similar to:

```text
=== PKCS11 Decrypt Started at Mon Nov 10 12:00:00 CET 2025 ===
Working Directory: /path/to/directory
User: username
Input size: 256 bytes
Using slot 0 with a present token (0x0)
Using decrypt algorithm RSA-PKCS-OAEP
mgf not set, defaulting to MGF1-SHA256
OAEP parameters: hashAlg=SHA256, mgf=MGF1-SHA256, source_type=1, source_ptr=0x0, source_len=0
Exit code from pkcs11-tool: 0
Output file size: 32 bytes
=== PKCS11 Decrypt Finished at Mon Nov 10 12:00:01 CET 2025 with exit code: 0 ===
[Multiple decrypt operations for each key...]

[Recovered private keys output to private_keys.csv]
```

The `private_keys.csv` file will contain your recovered private keys in CSV format.

## Troubleshooting

### Error: "CKR_DEVICE_ERROR"

- **Cause**: YubiKey communication error or incorrect PIN
- **Solution**:
  - Ensure YubiKey is properly inserted
  - Verify you're providing the correct PIN
  - Try unplugging and re-inserting the YubiKey
  - Check PIN tries remaining: `ykman piv info`

### Error: "Public key mismatch"

- **Cause**: The backup was encrypted with a different public key
- **Solution**: Ensure you're using the correct YubiKey that contains the matching private key for the public key used during backup encryption

### YubiKey Not Found

#### macOS

```bash
# List available PKCS11 slots
pkcs11-tool --module /opt/homebrew/lib/libykcs11.dylib --list-slots

# Check YubiKey PIV info
ykman piv info
```

#### Linux

```bash
# List available PKCS11 slots
pkcs11-tool --module /usr/lib/x86_64-linux-gnu/libykcs11.so --list-slots

# Check YubiKey PIV info
ykman piv info
```

#### Windows (PowerShell)

```powershell
# List available PKCS11 slots
& "C:\Program Files\OpenSC Project\OpenSC\tools\pkcs11-tool.exe" --module "C:\Program Files\Yubico\Yubico PIV Tool\bin\libykcs11.dll" --list-slots

# Check YubiKey PIV info
ykman piv info
```

### Platform-Specific Issues

#### Linux: Permission Denied

If you get permission errors accessing the YubiKey:

```bash
# Add your user to the appropriate group
sudo usermod -a -G pcscd $USER

# Create udev rules for YubiKey
sudo wget -O /etc/udev/rules.d/70-yubikey.rules https://raw.githubusercontent.com/Yubico/yubikey-manager/main/resources/70-yubikey.rules

# Reload udev rules
sudo udevadm control --reload-rules && sudo udevadm trigger

# Log out and log back in for group changes to take effect
```

#### Windows: Module Not Found

If you get "module not found" errors:

1. Verify installation paths:
   - YubiKey Manager: `C:\Program Files\Yubico\YubiKey Manager\`
   - OpenSC: `C:\Program Files\OpenSC Project\OpenSC\`

2. Check PATH environment variable includes these directories

3. Try running PowerShell as Administrator

#### WSL (Windows Subsystem for Linux)

To use YubiKey with WSL, you need to enable USB passthrough:

1. Install usbipd-win on Windows: [https://github.com/dorssel/usbipd-win](https://github.com/dorssel/usbipd-win)
2. In Windows PowerShell (as Administrator):

   ```powershell
   usbipd list
   usbipd bind --busid <BUSID>
   usbipd attach --wsl --busid <BUSID>
   ```

3. In WSL, install required tools as per Linux instructions above

## Security Notes

- **PIN Security**: The YubiKey PIN is passed as a command-line argument and is NOT hardcoded in the scripts
- **Hardware Security**: The private key never leaves the YubiKey hardware
- **On-Device Decryption**: All decryption happens entirely on the YubiKey
- **PIN Protection**: After 3 incorrect PIN attempts, the YubiKey will be locked
- **Best Practices**:
  - Use a strong, unique PIN (6-8 characters)
  - Never share your PIN or commit it to version control
  - Consider using a secure method to store/retrieve the PIN (e.g., password manager)
  - Change the default PIN if you're using a factory-default YubiKey

## Technical Details

### Encryption Parameters

- **Algorithm**: RSA-2048
- **Padding**: PKCS-OAEP
- **Hash**: SHA-256
- **MGF**: MGF1-SHA256

### PIV Slot Configuration

- **Slot**: 9D (Key Management)
- **PKCS11 ID**: 03
- **Key Type**: RSA 2048-bit
- **Usage**: Decrypt, Sign

## Files Reference

| File | Purpose | Platform |
|------|---------|----------|
| `backup_snapshot.json` | Encrypted backup containing key shares | All |
| `recovery-tool` / `recovery-tool.exe` | Fordefi binary that orchestrates recovery | All |
| `run_recovery.sh` | Main recovery script for Unix-like systems | macOS, Linux |
| `run_recovery.bat` | Main recovery script for Windows | Windows |
| `private_keys.csv` | Output file containing recovered keys | All |

## Platform Compatibility

| Feature | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Native support | ✓ | ✓ | ✓ (with .bat script) |
| WSL support | N/A | N/A | ✓ |
| YubiKey Manager CLI | ✓ | ✓ | ✓ |
| OpenSC/PKCS11 | ✓ | ✓ | ✓ |
