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
  * Solana SOL & SPL transfers with Solders
  * Tron TRX transfers
  * Tron TRC20 transfers
* Exchange transfers
* Setting up Fordefi Webhooks
* Signing EIP-712 typed messages with an EVM Fordefi vault

## TypeScript Examples 🟦
* On EVM chains (Ethereum, Base, Arbitrum, etc.):
  * Deploying EVM smart contracts from your Fordefi vault using Hardhat or Foundry
  * Swapping tokens programmatically with CowSwap from a Fordefi EVM vault
  * Programmatic EVM transfers using the Fordefi API
* On Solana:
  * Programmatic token swaps using Jupiter
  * Programmatic token swaps using Meteora
  * Programmatic token swaps and pool management using Orca
* On Sui:
  * Programmatic token swaps and pool creation using the Bluefin API
* On Hyperliquid L1 (HyperCore):
  * Programmatic deposits, withdrawals and USDC transfers

## Getting Started
1. Clone this repository
2. Follow the setup instructions in each example directory

## Documentation
For more information, see the [Fordefi API Documentation](https://docs.fordefi.com/developers/program-overview) and [Fordefi API reference page](https://docs.fordefi.com/api/openapi).