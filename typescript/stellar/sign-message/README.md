# Stellar Sign Message via Fordefi

Sign an arbitrary Stellar message using [Fordefi](https://docs.fordefi.com/developers/program-overview) as the remote MPC signer. This is the `stellar_message` request type — it does not broadcast anything on-chain; it returns the signature(s) over your message.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
   Set `FORDEFI_API_USER_TOKEN`, `FORDEFI_STELLAR_VAULT_ID`, and either:
   - `STELLAR_MESSAGE` — plain UTF-8 text (the script hex-encodes it before sending) OR
   - `STELLAR_MESSAGE_HEX` — pre-built `0x...` hex string (takes precedence).

3. Set up an API Signer and pair your API User with it ([docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)).

4. Place your API User private key at `../fordefi/secret/private.pem` (shared by all four Stellar examples).

5. Make sure your API Signer is running.

## Usage

```bash
npm run sign
```

The script submits a `stellar_message` request via the Fordefi API, polls until it reaches a terminal state, and prints the signature(s).

## How It Works

1. Builds a `CreateStellarMessageRequest` with `details.raw_data` set to a `0x`-prefixed hex string (per the Fordefi schema's `^0[xX][a-fA-F0-9]+$` pattern)
2. Signs the API payload with your RSA private key
3. POSTs to `https://api.fordefi.com/api/v1/transactions`
4. Fordefi performs MPC signing of the message
5. Polls until the message reaches a terminal state (`signed` / `completed`) and prints the base64 signature(s)

## Security: what a message signature can be reused for

`details.raw_data` is an opaque hex blob — the caller chooses the bytes, and the policy engine has
no way to tell a login challenge from anything else. That matters on Stellar because of how Soroban
contract authorization works.

A [Soroban authorization entry](https://developers.stellar.org/docs/build/guides/auth/contract-authorization)
using `SorobanCredentialsAddress` is authorized by:

```text
ed25519_sign(sk, sha256(HashIDPreimage.envelopeTypeSorobanAuthorization{
  networkId, nonce, signatureExpirationLedger, invocation
}))
```

That preimage commits to the network, a nonce, an expiry ledger, and the invocation tree — and
**nothing else**. No transaction envelope, no source account, no sequence number, no fee. A signed
auth entry is therefore detached and portable: whoever holds it can wrap it in their own
`invokeHostFunction` transaction, pay the fee, and submit it. An entry authorizing
`transfer(from = <your vault>, to = <attacker>, amount = X)` moves the funds on its own, limited
only by `signatureExpirationLedger` and single-use nonce consumption.

Classic transaction signing is not exposed to this. `TransactionSignaturePayload` binds the network
plus the full tagged transaction, so `stellar_transaction` / `stellar_raw_transaction` signatures
cannot be lifted into a different transaction.

So whether a `stellar_message` signature can be repurposed as a Soroban authorization comes down to
one detail: which bytes the MPC signer actually signs.

| Scheme | Consequence |
| --- | --- |
| `raw_data` signed verbatim | caller sets `raw_data = sha256(preimage)` → valid auth signature |
| `sha256(raw_data)`, no prefix | caller sets `raw_data = preimage XDR` → valid auth signature |
| `sha256("Stellar Signed Message:\n" ‖ raw_data)` ([SEP-53](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md)) | domain-separated; cannot be repurposed |

SEP-53 exists for exactly this reason: *"To prevent confusion with raw transactions and to mitigate
replay attacks, a fixed prefix string is used."*

### Finding

**Fordefi uses SEP-53.** Verified against a `stellar_mainnet` vault: the returned signature verifies
against `sha256("Stellar Signed Message:\n" || raw_data bytes)` and against none of the other three
candidates. A `stellar_message` signature therefore **cannot** be repurposed as a Soroban
authorization-entry signature or a transaction signature — the signed bytes can never equal
`sha256(auth preimage)` or a `TransactionSignaturePayload`.

Note that the prefix is applied to the *decoded* `raw_data` bytes, not to the `0x...` string.

What still holds: `raw_data` is an opaque blob to the policy engine, so it cannot tell a login
challenge from anything else a caller wants signed under that prefix. Scope `stellar_message` by
policy on vaults that hold assets.

### Re-checking the scheme

Ed25519 signs a message directly, so the scheme can be identified without any cooperation from
Fordefi: sign one inert message, then check the returned signature against each candidate payload
using the vault's `G...` address. Whichever candidate verifies *is* the exact byte string that was
signed, and the four candidates are pairwise distinct, so the result is unambiguous.

```ts
import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

const raw = Buffer.from("some inert probe string", "utf8");
const rawHex = "0x" + raw.toString("hex");        // what you send as details.raw_data
const sig = Buffer.from(signatureFromFordefi, "base64");
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest();
const PREFIX = "Stellar Signed Message:\n";

const kp = Keypair.fromPublicKey(vaultGAddress);
kp.verify(raw, sig);                                              // verbatim
kp.verify(sha256(raw), sig);                                      // hashed, no separator
kp.verify(sha256(Buffer.concat([Buffer.from(PREFIX), raw])), sig); // SEP-53  <- this one matches
kp.verify(sha256(Buffer.from(PREFIX + rawHex)), sig);             // SEP-53 over the hex string
```

Use an inert probe string. Under every candidate scheme the resulting signature then covers either
arbitrary bytes or their hash, which is not a valid preimage for anything — so this is safe to run
against a vault that holds assets. Do **not** substitute a real auth-entry preimage to test the
negative case.
