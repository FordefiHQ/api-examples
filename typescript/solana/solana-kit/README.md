# Fordefi + Solana Kit examples

Each directory here is a standalone example built on [Solana Kit](https://www.solanakit.com/), with its own `package.json`. They share one set of credentials, kept in this directory:

```
solana-kit/
├── .env                  # credentials and addresses for every example
├── secret/
│   └── private.pem       # your Fordefi API User private key
├── spl-transfer/
├── staking/
└── ...
```

## Setup

1. Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker) and make sure your API Signer is running.

2. Put your API User private key at `secret/private.pem`:

   ```bash
   mkdir -p secret
   cp /path/to/your/private.pem secret/private.pem
   ```

   To keep the key somewhere else, set `FORDEFI_PRIVATE_KEY_PATH` in `.env` to its absolute path.

3. Create `.env` from the template and fill in the values the examples you plan to run need (each section of the template names the examples that use it):

   ```bash
   cp .env.example .env
   ```

4. Install and run an example from its own directory, for example:

   ```bash
   cd spl-transfer
   npm install
   npm run spl
   ```

Both `.env` and `secret/` are git-ignored. Every example reads them from this directory regardless of where you run it from. A `.env` inside an example's directory, if present, overrides values from the shared one, which is handy when one example needs a different vault.
