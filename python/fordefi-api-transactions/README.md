# Fordefi Transaction Helper Tool

A tool for executing programmatic transactions through Fordefi.

⚠️ This tool is still in development, please test extensively with _small amounts_ before use.

## Prerequisites

1. Install `uv` package manager:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Set up the project:
   ```bash
   git clone <repository-url>
   cd <repository-name>
   uv sync
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory with your Fordefi API user token and your default Vault IDs and destination addresses:
   ```plaintext
   EVM_VAULT_ID="your_vault_id"
   DEFAULT_DESTINATION_ADDRESS_EVM="your_default_evm_destination_address"
   FORDEFI_API_TOKEN="your_token"
   ```
4. Place your API Signer's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

1. Start the application:
   ```bash
   make
   ```

2. Follow the interactive prompts:
   - Enter Vault ID (or press Enter for default)
   - Enter destination address (or press Enter for default)
   - Select network type (for example `EVM`)
   - For EVM: specify the network (e.g., bsc, arbitrum, ethereum)
   - Enter token ticker (or press Enter for native asset)
   - Specify the amount
   - Add an optional note

The transaction will be broadcast after confirming all details.

## This tool currently supports the following networks and assets:

- Ethereum (ETH)
- BSC (BNB and USDT)
- Arbitrum (ETH and USDC)
- Solana (SOL coins only)
- Sui (SUI coins only)
- Ton (TON coins only)
- Aptos (APT coins only)
- Bitcoin


## Adding more assets and networks

[Learn more](https://docs.fordefi.com/reference/transaction-types) about integrating other networks and assets.