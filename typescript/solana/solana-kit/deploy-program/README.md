# Solana Program Deployment with Fordefi

This project demonstrates how to deploy Solana (Anchor) programs using Fordefi as the deployer wallet. The deployment process involves creating a buffer, uploading program bytes in chunks, and deploying the buffer as an upgradeable program.

## Prerequisites

1. **Fordefi API Setup**: Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
2. **Node.js 18+**
3. **Rust and Solana CLI tools**
4. **Anchor CLI** (`anchor-cli`)
5. **Fordefi Solana vault** with sufficient devnet/mainnet SOL

## Environment Setup

Create a `.env` file with your Fordefi credentials:

```env
FORDEFI_API_TOKEN=your_api_user_token
FORDEFI_VAULT_ID=your_solana_vault_id
FORDEFI_VAULT_ADDRESS=your_solana_vault_address
```

Place your Fordefi API user private key at `./fordefi_secret/private.pem`.

## Configuration

All deployment settings are centralized in `src/config.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `bufferKeypairPath` | `./buffer-keypair.json` | Path to the buffer account keypair |
| `programKeypairPath` | `./program-keypair.json` | Path to the program ID keypair |
| `programBinaryPath` | `./target/deploy/solana_deploy_contract_fordefi.so` | Path to compiled program binary |
| `defaultFeeLamports` | `5000` | Custom fee per transaction in lamports. **Critical** to prevent Fordefi's fee estimation from overcharging per tx. 5000 lamports = 0.000005 SOL (Solana's base fee). |
| `rpc` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `ws` | `wss://api.devnet.solana.com` | Solana WebSocket endpoint |

## Project Structure

```
├── programs/                          # Anchor program source
├── src/
│   ├── config.ts                      # Fordefi configuration to modify
│   ├── tx-planner.ts                  # Transaction planning (buffer + deploy)
│   ├── signers.ts                     # Fordefi signing logic
│   ├── run.ts                         # Main deployment script
│   ├── process-tx.ts                  # Fordefi API helpers
│   └── utils/
│       ├── solana-client-util.ts      # Solana RPC client
│       └── close-buffer-util.ts       # Utility to close failed buffers
├── buffer-keypair.json                # Keypair for the buffer account
├── program-keypair.json               # Keypair for the program ID
└── target/deploy/*.so                 # Compiled program binary
```

## Deployment Flow

### 1. Generate Keypairs

Grind fresh keypairs for the buffer and program:

```bash
solana-keygen grind --no-bip39-passphrase --starts-with Buff:1
solana-keygen grind --no-bip39-passphrase --starts-with Prg:1
```

Copy the public keys and rename your keys to:

```bash
buffer-keypair.json
program-keypair.json
```

### 2. Update Program ID

Update the `declare_id!` in `programs/solana-deploy-contract-fordefi/src/lib.rs` with the program keypair's public key:

```rust
declare_id!("YOUR_PROGRAM_KEYPAIR_PUBKEY");
```

### 3. Build the Program

```bash
anchor build
```

### 4. Make sure your Fordefi Signer is running

If not run the following command in the docker container:

```bash
docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
```

Then select `Run signer`.

### 5. Deploy

```bash
npm run deploy
```

### 6. Upgrade an Existing Program (Optional)

If you need to deploy a new version of an already-deployed program, use the upgrade flow instead of a fresh deployment.

**Before upgrading, you MUST rebuild your Anchor program:**

1. Make your code changes in `programs/solana-deploy-contract-fordefi/src/lib.rs`
2. Run `anchor build` to recompile the program
3. Verify the new `.so` file is at the path specified in `config.programBinaryPath`

**Then update `src/tx-planner.ts`:**

1. Uncomment the `updatePlan` line:

   ```typescript
   const updatePlan = kit.sequentialInstructionPlan(upgradeIxs);
   ```

2. Swap `deployPlan` for `updatePlan` in the `masterPlan`:

   ```typescript
   const masterPlan = kit.sequentialInstructionPlan([bufferPlan, writeBufferPlan, updatePlan]);
   ```

3. Run the deployment:

   ```bash
   npm run deploy
   ```

The upgrade will write the new program binary to a buffer, then atomically upgrade the on-chain program to use the new code. Your program ID remains the same.

### 7. Initialize the Program (Optional)

After deployment, you can call the program's `initialize` instruction to verify it's working. First, update `Anchor.toml` with your deployed program ID and cluster:

```toml
[programs.devnet]
solana_deploy_contract_fordefi = "YOUR_DEPLOYED_PROGRAM_ID"

[provider]
cluster = "devnet"
```

Also update the `PROGRAM_ID` in `tests/initialize-deployed-program.ts` to match your deployed program ID.

Then run:

```bash
npm run initialize
```

This will call the `initialize` instruction and you should see "This program was deployed with Fordefi!" in the transaction logs on the explorer.

## Notable Gotchas

### 1. Custom Fees are CRITICAL

**Problem:** Fordefi's default fee estimation was charging ~0.07 SOL per transaction. With 212+ write transactions, this resulted in ~15 SOL in fees alone!

**Solution:** Always pass a `defaultFeeLamports` field to the Fordefi config object in `src/config.ts`:

```typescript
const jsonBody = {
  // ... other fields
  details: {
    // ... other fields
    fee: {
      type: "custom",
      unit_price: feeLamports  // 5000 lamports is usually enough = 0.000005 SOL (base fee)
    }
  }
};
```

### 2. Buffer Cleanup After Failed Deployments

**Problem:** If deployment fails mid-way, the buffer account holds ~1.33 SOL that won't be automatically recovered.

**Solution:** Use the `close-buffer.ts` utility:

```bash
# Close a specific buffer
npx tsx src/utils/close-buffer-util.ts BUFFER_ADDRESS

# Example
npx tsx src/utils/close-buffer-util.ts BY7zjwvhKgwTUwyGh8dBCPki7dRSjhTjcC46wMdfL9YM
```

This will:
1. Check if the buffer exists
2. Display its balance
3. Close the buffer via Fordefi signing
4. Return the rent (~1.33 SOL) to your vault

### 3. Fresh Keypairs for Each Deployment Attempt

**Problem:** Reusing keypairs from failed deployments causes "account already in use" errors.

**Solution:** Generate fresh keypairs before each deployment attempt:

```bash
solana-keygen new --no-bip39-passphrase -o buffer-keypair.json --force
solana-keygen new --no-bip39-passphrase -o program-keypair.json --force
```

Then update `declare_id!` in `lib.rs` and rebuild with `anchor build`.

## Transaction Breakdown for our demo Anchor program

For a ~190KB program:

| Step | Instructions | Transactions |
|------|--------------|--------------|
| Create buffer + Initialize | 2 | 1 |
| Write chunks (900 bytes each) | 212 | 212 |
| Create program + Deploy | 2 | 1 |
| **Total** | **216** | **~214** |

## Cost Breakdown

| Item | Cost | Notes |
|------|------|-------|
| Buffer rent | ~1.33 SOL | Absorbed into program on deploy |
| Program account | ~0.001 SOL | 36 bytes |
| Program data | ~1.4 SOL | Based on `maxDataLen` |
| Transaction fees | ~0.001 SOL | With custom 5000 lamport fee |
| **Total** | **~2.7 SOL** | Actual rent ~1.4 SOL |

## Client Generation & Testing

This project uses [Codama](https://github.com/codama-idl/codama) to generate type-safe TypeScript clients from the Anchor IDL. The generated client integrates with `@solana/kit` and provides fully typed instruction builders.

### Generate the TypeScript Client

After building your Anchor program, generate the client:

```bash
anchor run generate-clients
```

This runs `scripts/generate-clients.ts` which:

1. Reads the Anchor IDL from `target/idl/solana_deploy_contract_fordefi.json`
2. Uses Codama to parse the IDL and generate TypeScript code
3. Outputs the generated client to `clients/js/src/generated/`

The generated client includes:

- **Instructions**: Type-safe instruction builders (e.g., `getInitializeInstruction()`)
- **Programs**: Program address constants and metadata
- **Accounts**: Account type definitions and codecs (if your program has accounts)
- **Types**: Custom type definitions from your IDL

### Using the Generated Client

Import and use the generated instructions in your code:

```typescript
import { getInitializeInstruction } from './clients/js/src/generated/instructions/initialize';
import * as kit from '@solana/kit';

// Build the instruction
const ix = getInitializeInstruction();

// Add to a transaction message
const message = kit.pipe(
  kit.createTransactionMessage({ version: 0 }),
  msg => kit.setTransactionMessageFeePayerSigner(signer, msg),
  msg => kit.appendTransactionMessageInstructions([ix], msg),
);
```

### Running Tests

The project includes Mocha-based integration tests that call the deployed program through Fordefi:

```bash
# Run all tests
anchor test
# or
npm run test
```

Tests are located in `tests/` and use the generated Codama client to build transactions that are signed and broadcast via the Fordefi API.

**Test file structure:**

- `tests/call-initialize.ts` - Calls the `initialize` instruction on the deployed program

**Prerequisites for running tests:**

1. Program must be deployed (see Deployment Flow above)
2. Fordefi API signer must be running
3. `.env` configured with valid Fordefi credentials
