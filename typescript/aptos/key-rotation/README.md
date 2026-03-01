# Aptos Key Rotation & Fund Management via Fordefi BlackBox

Rotate an external Aptos wallet's authentication key to a Fordefi BlackBox vault, then manage the account's funds through Fordefi.

## Overview

Aptos accounts support [key rotation](https://aptos.dev/build/guides/key-rotation) — the account address stays the same, but the signing key changes. This repo uses [Fordefi BlackBox signing](https://docs.fordefi.com/developers/transaction-types/black-box-signing) to:

1. **Rotate** an external wallet's auth key to a Fordefi Black Box vault key
2. **Transfer** funds from the now Fordefi-controlled account

After rotation, the external wallet (e.g. Petra) can no longer sign for the account. The Fordefi vault becomes the sole signer.

## Setup

### 1. Create a BlackBox Vault

Fordefi Black Box vaults are purely programmatic — they must be created via the Fordefi API:

```bash
curl -X POST https://api.fordefi.com/api/v1/vaults \
  -H "Authorization: Bearer <your-api-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "APTOS Black Box",
    "type": "black_box",
    "key_type": "eddsa_ed25519"
  }'
```

The response contains the `id` (vault ID) and `public_key_compressed` (the Ed25519 public key). Derive the Aptos address from the public key using `npm run derive-aptos`.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure

Create a `secret/private.pem` file with your Fordefi API signer private key.

Configure `.env`:

```env
FORDEFI_API_USER_TOKEN="<Fordefi API token>"
BLACKBOX_VAULT_ID="<Fordefi BlackBox vault ID (from vault creation response)>"
BLACK_BOX_VAULT_ADDRESS="<Aptos address derived from the vault's public key>"
PETRA_PRIVATE_KEY="<hex-encoded Ed25519 private key of the external wallet>"
PETRA_ACCOUNT_ADDRESS="<address of the external wallet being rotated>"
DESTINATION_ADDRESS="<destination address for transfers>"
```

## Scripts

### Key Rotation (`npm run sign-raw`)

Rotates an external account's authentication key to the Fordefi BlackBox vault key.

**Prerequisites:**

- The external wallet's private key in `PETRA_PRIVATE_KEY`
- Both the external wallet **and** the Fordefi BlackBox vault must have an APT balance to pay gas fees — the external wallet pays for the rotation transaction, and the vault pays for subsequent transactions (e.g. transfers) after it takes control

**Flow:**

1. Load the external private key from `.env`
2. Fetch account info on-chain (sequence number, current auth key)
3. Fetch the new public key and address from the Fordefi Black Box vault
4. Build a `RotationProofChallenge` (BCS-serialized struct from `0x1::account`)
5. Sign the challenge locally with the current key (current key proof)
6. Sign the challenge via Fordefi Black Box Vault (new key proof)
7. Submit `0x1::account::rotate_authentication_key` with both proofs

After this, the account's `authentication_key` on-chain changes to the Fordefi vault's derived address. The external wallet no longer controls the account.

### Transfer Funds (`npm run transfer`)

Transfers APT from a Fordefi-controlled account. Use this after key rotation to move funds out of the external wallet's address, which is now controlled by the Fordefi vault.

Configure in `.env`:

- `BLACK_BOX_VAULT_ADDRESS` — the sender address (set to the rotated external account address to move funds from it)
- `DESTINATION_ADDRESS` — where to send funds
- Set the amount in `src/config.ts` (1 APT = `100_000_000n` octas)

**Flow:**

1. Build an Aptos transfer transaction with the sender address
2. Serialize the signing message and send to Fordefi Black Box for signing
3. Fetch the signature and public key from the vault
4. Assemble the signed transaction and broadcast to Aptos

## Verification

You can verify a key rotation by querying the account on-chain:

```bash
curl https://fullnode.mainnet.aptoslabs.com/v1/accounts/<account-address>
```

If `authentication_key` differs from the account address, key rotation has occurred. The `authentication_key` will match the Fordefi vault's derived address.

## Key Concepts

- **Black Box Signing:** Fordefi signs arbitrary bytes without interpreting them. The raw signature is returned and assembled client-side into a valid Aptos transaction.
- **Key Rotation:** Aptos accounts decouple the address from the signing key. After rotation, the address is unchanged but a new key controls it. The on-chain `0x1::account::rotate_authentication_key` entry function requires signed proofs from both the current and new key.
- **RotationProofChallenge:** A Move struct (`0x1::account::RotationProofChallenge`) serialized via BCS. Both keys must sign it to authorize the rotation. The `@aptos-labs/ts-sdk` provides a `RotationProofChallenge` class for this.
- **APT decimals:** 1 APT = 10^8 octas. To send 0.1 APT, use `10_000_000n`.
