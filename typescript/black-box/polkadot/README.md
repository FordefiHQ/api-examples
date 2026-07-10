# Polkadot with Fordefi Black-Box Vault

DOT transfers on Polkadot Asset Hub using a Fordefi black-box vault (`key_type=eddsa_ed25519`).

## Prerequisites

- Node.js
- A Fordefi black-box vault — [docs](https://docs.fordefi.com/developers/transaction-types/black-box-signing#black-box-vaults)
- A running Fordefi API Signer — [docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
- DOT balance on **Asset Hub** (see Notes)
- API User private key at `./secret/private.pem`

To create the vault:

```bash
curl -X POST https://api.fordefi.com/api/v1/vaults \
  -H "Authorization: Bearer $FORDEFI_API_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "my-polkadot-vault", "type": "black_box", "key_type": "eddsa_ed25519" }'
```

The response's `public_key_compressed` field (base64, 32 bytes) is your `VAULT_PUBLIC_KEY`.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
```

Required env vars:

| Variable | Purpose |
|---|---|
| `FORDEFI_API_USER_TOKEN` | API user bearer token |
| `BLACKBOX_VAULT_ID` | Vault ID for the black-box vault |
| `VAULT_PUBLIC_KEY` | 32-byte raw ed25519 pubkey (base64) — IS the Polkadot account ID |
| `DESTINATION_ADDRESS` | Recipient SS58 address (starts with `1` on Polkadot) |
| `POLKADOT_NETWORK` | `polkadot` or `westend` |
| `POLKADOT_RPC_URL` | Optional RPC override; defaults to the public Asset Hub endpoint |

Tunables (transfer amount, era mortality window) live in `src/polkadot-config.ts`.

## Usage

```bash
npm run derive      # print the SS58 address derived from VAULT_PUBLIC_KEY
npm run transfer    # DOT transfer (balances.transferKeepAlive)
```

## How black-box signing works here

1. Build the extrinsic with `@polkadot/api` and assemble the `SignerPayload` from live chain state (nonce, mortal era, genesis hash, runtime version, signed extensions).
2. Send the payload bytes to Fordefi as a `black_box_signature`. **Unlike the sibling examples, this is not a 32-byte hash**: Polkadot's convention is that ed25519 signatures cover the raw signing payload (~120 bytes for a transfer); only payloads over 256 bytes are blake2b-256 hashed first. Fordefi signs whatever bytes it is given.
3. Poll Fordefi until the tx is `completed`; it returns a 64-byte ed25519 signature (base64). Before broadcasting, the signature is verified locally against the payload and vault pubkey — a free check that catches any payload transformation.
4. Prefix the signature with the MultiSignature type byte (`0x00` = ed25519), attach via `tx.addSignature(...)`, and submit with `author_submitExtrinsic`.

The Fordefi request itself is authenticated separately: `SHA256+RSA` over `${apiPath}|${timestamp}|${requestBody}` using the API user PEM key.

## Files

| File | Purpose |
|---|---|
| `polkadot-config.ts` | Env loading, network map (RPC/SS58 prefix/decimals), tunables |
| `polkadot-address-utils.ts` | ed25519 pubkey → SS58 address (the pubkey IS the account ID) |
| `polkadot-serializer.ts` | Shared: build extrinsic + SignerPayload, derive signing bytes, build Fordefi payload |
| `polkadot-flow.ts` | Shared: connect → derive address → build → sign API request → submit → poll → broadcast |
| `polkadot-transfer-run.ts` | Thin entry point |
| `signer.ts` | RSA signing of Fordefi API requests |
| `process_tx.ts` | Fordefi API HTTP wrapper |
| `broadcast-polkadot-transaction.ts` | Polls Fordefi, verifies + attaches the signature, submits the extrinsic |
| `derive_polkadot_address.ts` | Standalone address-derivation script |

## Notes

- **Asset Hub, not the relay chain**: since the Asset Hub Migration (November 2025), DOT balances live on Polkadot Asset Hub. Fund the derived account there; this example connects to Asset Hub RPC endpoints by default.
- Amounts on the wire are in **planck** (1 DOT = 1e10 planck; 1 WND = 1e12 planck).
- The existential deposit on Polkadot Asset Hub is 0.01 DOT; the example reads the live value from the chain and refuses transfers that would fail against it. `transferKeepAlive` is used so the sender can never reap its own account.
- Transactions are mortal with a 64-block window (~6.4 minutes). If Fordefi signing takes longer (e.g. a pending policy approval), the extrinsic expires — just rerun to rebuild.
- The same in-memory `tx` / `signerPayload` objects are passed from the serializer through to broadcast: the signature is only valid for those exact bytes.
