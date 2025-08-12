# Fordefi API Examples

Code examples for using the Fordefi API in Python and TypeScript.

## Prerequisites
- Fordefi API credentials (API user token and API Signer)
- Python 3.9+ or Node.js (depending on example)

## Python Examples 🐍
* Programmatic swaps using Fordefi's native Swap feature
* Simple API Transfers:
  * Native EVM assets (ETH, BNB, etc.) transfers
  * ERC20 token transfers
  * ERC20 transfers with delegated gas payment from another vault ("gas station")
  * Solana SOL transfers
  * Solana SPL token transfers
  * Solana SOL & SPL transfers with Solders
  * Tron TRX transfers
  * Tron TRC20 transfers
  * Native APT and MOVE transfers on Aptos and Movement 
  * Native SUI transfers
* Exchange transfers
* Setting up Fordefi Webhooks (Python)
* Signing EIP-712 typed messages with an EVM Fordefi vault
* Programmatically adding a contact address to your Fordefi organization's Address Book

## TypeScript Examples 🟦
* Setting up Fordefi Webhooks (TypeScript)
* Calling EVM contracts with a Fordefi vault
* On EVM chains (Ethereum, Base, Arbitrum, etc.):
  * Deploying EVM smart contracts from your Fordefi vault using Hardhat or Foundry
  * Swapping tokens programmatically with CowSwap
  * Swapping tokens programmatically with Uniswap v3
  * Minting/Redeeming USDe with Ethena
  * Programmatic EVM transfers using the Fordefi API
* On Solana:
  * With `@solana/web3.js`: 
    * Programmatic token swaps using Jupiter
    * Programmatic token swaps using Meteora
    * Programmatic SOL staking with Marinade
    * Programmatic token swaps and pool management using Raydium
    * Programmatic SOL and SPL batch transfers
    * Programmatically buying and selling PT tokens on Exponent Finance
  * With `@solana/kit`:
    * Programmatic token swaps and pool management using Orca
    * Programmatic SPL token transfers
    * Programmatically restake SOL for fragSOL using Fragmetric
  * With `gill`:
    * Sponsored transaction for delegating gas fees payment to a different Solana vault
    * SPL token transfers
* On Sui:
  * Programmatic token swaps and pool creation using the Bluefin API
* On Hyperliquid L1 (HyperCore):
  * Programmatic deposits, withdrawals and USDC transfers
* On Cosmos:
  * Programmatic smart contract deployments on Archway
* On Initia:
  * Programmatic INIT transfers

## Getting Started
1. Clone this repository
2. Follow the setup instructions in each example directory

## Documentation
For more information, see the [Fordefi API Documentation](https://docs.fordefi.com/developers/program-overview) and [Fordefi API reference page](https://docs.fordefi.com/api/openapi).