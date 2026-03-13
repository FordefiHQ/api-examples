# age-wrap

A Python wrapper around the [age](https://github.com/FiloSottile/age) encryption format for passphrase-based encryption of arbitrary strings. Uses [pyrage](https://github.com/woodruffw/pyrage) (Python bindings for the Rust `rage` implementation), so the output is fully compatible with the `age` CLI.

## Install

```bash
uv sync
```

## Usage

### Encrypt a secret

```bash
# Interactive (prompts for passphrase securely)
uv run main.py encrypt "my super secret API key"

# With inline passphrase (useful for scripting)
uv run main.py encrypt "my super secret API key" -p "strong-passphrase"

# From stdin
echo "my secret" | uv run main.py encrypt -p "strong-passphrase"
```

This outputs a **base64-encoded blob** you can safely share (e.g. over Slack, email, a ticket).

### Decrypt a blob

```bash
# Interactive
uv run main.py decrypt "YWdlLWVuY3J5cHRpb24u..."

# With inline passphrase
uv run main.py decrypt "YWdlLWVuY3J5cHRpb24u..." -p "strong-passphrase"

# From stdin
echo "YWdlLWVuY3J5cHRpb24u..." | uv run main.py decrypt -p "strong-passphrase"
```

### Short aliases

`e` and `d` work as aliases:

```bash
uv run main.py e "secret" -p "pass"
uv run main.py d "blob" -p "pass"
```

## Workflow: sharing a secret with someone

1. **Encrypt** the secret with a passphrase you choose:

   ```bash
   uv run main.py encrypt "production-db-password-1234"
   # Enter passphrase when prompted
   # Output: YWdlLWVuY3J5cH... (base64 blob)
   ```

2. **Send the blob** to the recipient via one channel (e.g. Slack, email).

3. **Send the passphrase** via a **different channel** (e.g. text message, phone call, Signal).

4. The recipient **decrypts**:

   ```bash
   uv run main.py decrypt "YWdlLWVuY3J5cH..."
   # Enter passphrase when prompted
   # Output: production-db-password-1234
   ```

### Decrypting with the age CLI

Recipients don't need this script. They can decrypt with the standard `age` CLI (`brew install age`):

```bash
echo "YWdlLWVuY3J5cH..." | base64 -d | age -d
```

## Security notes

- Uses age's scrypt-based passphrase encryption (via the `rage` Rust implementation).
- The `-p` flag is convenient for scripting but exposes the passphrase in shell history. Prefer the interactive prompt for manual use.
- The base64 encoding is purely for transport convenience (copy-paste friendly). The actual encryption is handled entirely by age.
