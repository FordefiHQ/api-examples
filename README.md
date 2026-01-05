# Fordefi API Examples

Code examples for using the Fordefi API in Python and TypeScript.

## Prerequisites
- Fordefi API credentials (API user token and API Signer)
- Python 3.9+ or Node.js (depending on example)

## Python Examples 🐍
* Programmatic swaps using Fordefi's In-app Swap feature
* Programmatic EVM contract calls (with option to broadcast to a custom RPC)
* Simple API Transfers:
  * BTC transfers on Bitcoin mainnet
  * Native EVM assets (ETH, BNB, etc.) transfers
  * ERC20 token transfers
  * ERC20 transfers with delegated gas payment from another vault ("sponsored" transactions)
  * Solana SOL transfers
  * Solana SPL token transfers
  * Solana SPL token transfers with delegated fee payment from another vault ("sponsored" transactions)
  * Solana SOL and SPL transfers with Solders
  * Tron TRX and TRC10/20 transfers
  * Native APT and MOVE transfers on Aptos and Movement 
  * Native SUI transfers
* Exchange transfers
* Setting up Fordefi Webhooks (Python)
* Programatically signing Bitcoin PSBT with a Segwit or Taproot address
* Approve Transactions via API
* Signing EIP-712 typed messages and EIP-191 personal messages with an EVM Fordefi vault
* Programmatically adding a contact address or a batch of contact addresses to your Fordefi organization's Address Book

## TypeScript Examples 🟦
* Setting up Fordefi Webhooks (TypeScript)
* Calling EVM contracts with a Fordefi vault
* Cross-chain USDC transfers using Circle's CCTP
* On EVM chains (Ethereum, Base, Arbitrum, etc.):
  * Deploying EVM smart contracts from your Fordefi vault using Hardhat or Foundry
  * Deploying Morpho VaultsV2
  * Swapping tokens programmatically with CowSwap
  * Swapping tokens programmatically with Uniswap v3
  * Minting/Redeeming USDe with Ethena
  * Programmatic EVM transfers using the Fordefi API
  * Deploying and call contracts on a local Hardhat node for developers
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
    * Programmatic SPL token batch transfers using a transaction planner and executor
    * Programmatically deploy an Anchor program using a transaction planner and executor
    * Programmatically stake, unstake and withdraw SOL from any validator
  * With `gill`:
    * Sponsored transaction for delegating gas fees payment to a different Solana vault
    * SPL token transfers
* On Sui:
  * Programmatic token swaps and pool creation using the Bluefin API
* On Hyperliquid L1 (HyperCore):
  * Programmatic deposits, withdrawals, vault deposits and USDC transfers
* On Cosmos:
  * Programmatic smart contract deployments on Archway
* On Initia:
  * Programmatic INIT transfers
* On NEAR:
  * Programmatic transfer and staking using Black Box signatures

## Getting Started
1. Clone this repository
2. Follow the setup instructions in each example directory

## Documentation
For more information, see the [Fordefi API Documentation](https://docs.fordefi.com/developers/program-overview) and [Fordefi API reference page](https://docs.fordefi.com/api/openapi).