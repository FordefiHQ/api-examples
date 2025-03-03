# Fordefi API Examples

Code examples for using the Fordefi API in Python and TypeScript.

## Prerequisites
- Fordefi API credentials (API user token and API Signer)
- Python 3.9+ or Node.js (depending on example)

## Python Examples 🐍
* Simple API Transfers:
  * Native EVM assets (ETH, BNB, etc.) transfers
  * ERC20 token transfers
  * Solana SOL transfers
  * Solana SPL token transfers
* Setting up Fordefi Webhooks
* Signing EIP-712 typed messages with an EVM Fordefi vault

## TypeScript Examples 🟦
* On EVM chains (Ethereum, Base, Arbitrum, etc.):
  * Deploying EVM smart contracts from your Fordefi Vault using Hardhat or Foundry
  * Swapping tokens programmatically with CowSwap from a Fordefi EVM Vault
* On Solana:
  * Programmatic token swaps using the Jupiter API and Jito's Block Engine to broadcast the transaction for improved landing rate
  * Programmatic token swaps using the Meteora API and Jito's Block Engine to broadcast the transaction for improved landing rate

## Getting Started
1. Clone this repository
2. Follow the setup instructions in each example directory

## Documentation
For more information, see the [Fordefi API Documentation](https://docs.fordefi.com/developers/program-overview) and [Fordefi API reference page](https://docs.fordefi.com/api/openapi).