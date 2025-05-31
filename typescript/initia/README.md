# Initia Transactions with Fordefi

This helper code enables sending transactions on the Initia blockchain using Fordefi EVM vaults. Since Fordefi doesn't natively support the Initia blockchain, this solution works by signing personal messages with your Fordefi EVM vault, encoding them for Cosmos compatibility, and broadcasting to an Initia node.

## How It Works

1. **EVM to Cosmos Bridge**: We leverage EVM EIP-191 personal message signing to create signatures that can be used on Cosmos-based chains like Initia.

2. **Public Key Derivation**: The code extracts your EVM public key by having you sign a message, then converts this to a format compatible with Initia's address system.

3. **Transaction Creation**: Creates Cosmos-style transactions with proper encoding for the Initia network.

4. **Signature Conversion**: Converts the EVM signature format to the format expected by Cosmos chains.

## Prerequisites

- Node.js (v14+)
- Fordefi EVM vault
- INIT token balance on Initia ([see here](https://app.initia.xyz/))
- Set up an API Signer ([see here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer))
- Create an API user and access token ([see here](https://docs.fordefi.com/developers/getting-started/create-an-api-user))
- Generate a private/public key pair for your API user ([see here](https://docs.fordefi.com/developers/getting-started/pair-an-api-client-with-the-api-signer))
- Register your API user with your API Signer (same link as above)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   FORDEFI_API_USER_TOKEN=your_api_user_token_here
   FORDEFI_EVM_VAULT_ID=your_evm_vault_id_here
   ```

3. **Private Key Setup**
   Create a `fordefi_secret` directory and place your `private.pem` file there:
   ```
   ./fordefi_secret/private.pem
   ```

4. **Configuration**
   Update `config.ts` with your specific settings:
   - `transferConfig.amountToTransfer`: Amount in smallest unit (uinit)
   - `transferConfig.destination`: Recipient Initia address
   - `fordefiConfig.address`: Your Fordefi EVM vault address

## File Structure

```
├── config.ts              # Configuration settings
├── initia-transfer.ts      # Main transfer script
├── fordefi_secret/
│   └── private.pem        # Your API user private key
└── .env                   # Environment variables
```

## Usage

Run the transfer script:
```bash
npx ts-node transfer.ts
```

### What the Script Does

1. **Connects to Fordefi**: Initializes the Fordefi provider using your EVM vault
2. **Address Conversion**: Converts your EVM address to an Initia address using bech32 encoding
3. **Public Key Extraction**: Signs a message to derive your EVM public key (required for Cosmos transactions)
4. **Transaction Creation**: Creates a MsgSend transaction for the Initia network
5. **EIP-191 Signing**: Signs the transaction data using Fordefi's EIP-191 message signing
6. **Signature Conversion**: Converts the EVM signature format to Cosmos-compatible format
7. **Broadcasting**: Sends the transaction to the Initia network and waits for confirmation

## Public Key Optimization

**Important**: The script extracts your EVM public key by signing a message each time it runs. Once you have your public key, you can optimize this process:

1. **First Run**: The script will output your compressed public key
2. **Save the Key**: Add it to your environment variables:
   ```env
   EVM_PUBLIC_KEY=your_compressed_public_key_here
   ```
3. **Skip Derivation**: Modify the code to use the saved public key instead of deriving it each time

This eliminates the extra signing step and makes subsequent transactions faster.

## Configuration Options

### Transfer Configuration
- `amountToTransfer`: Amount in uinit (smallest unit)
- `destination`: Recipient Initia address (init1...)
- `gasLimit`: Gas limit for the transaction
- `gasPrice`: Gas price in uinit

### Network Configuration
- Uses Initia mainnet (`interwoven-1`)
- REST endpoint: `https://rest.initia.xyz`
- Explorer: `https://scan.initia.xyz`

## Technical Details

### Address Conversion
The script converts EVM addresses to Initia addresses using bech32 encoding with the 'init' prefix.

### Signature Process
1. Creates an Amino-style sign document
2. Signs the JSON-serialized document using EIP-191
3. Extracts r, s values from the signature (v is not used in Cosmos)
4. Combines r + s for the final signature

### Transaction Format
Uses Cosmos SDK transaction structure with:
- `TxBody`: Contains the messages and memo
- `AuthInfo`: Contains signer info and fees
- `Signatures`: Array of signatures

## Support

For Fordefi-specific issues, refer to the [Fordefi documentation](https://docs.fordefi.com/).
For Initia network issues, check the [Initia documentation](https://docs.initia.xyz/).