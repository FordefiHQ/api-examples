# Fordefi API Examples

Code examples for using the Fordefi API in Python and TypeScript.

## Prerequisites

- Fordefi API credentials (API User token and API Signer, [see here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker))
- Python 3.9+ or Node.js (depending on example)

## Python Examples 🐍

- [Programmatic swaps](python/swaps) using Fordefi's In-app Swap feature (EVM and Solana)
- [Programmatic EVM contract calls](python/evm-contract-calls) (with option to broadcast to a custom RPC)
- [Simple API Transfers](python/simple-api-transfers):
  - BTC transfers on Bitcoin mainnet
  - Native EVM assets (ETH, BNB, etc.) transfers
  - ERC20 token transfers
  - ERC20 transfers with delegated gas payment from another vault ("sponsored" transactions)
  - Solana SOL transfers
  - Solana SPL token transfers
  - Solana SPL token transfers with delegated fee payment from another vault ("sponsored" transactions)
  - Solana SOL and SPL transfers with Solders
  - Tron TRX and TRC10/20 transfers
  - Native APT and MOVE transfers on Aptos and Movement
  - Native SUI transfers
  - SUI token transfers with delegated fee payment from another vault ("sponsored" transactions)
  - Aptos APT and Fungible Assets transfers
  - Aptos Fungible Assets transfers with delegated fee payment from another vault ("sponsored" transactions)
- [Exchange transfers](python/exchange-transfers) (Binance and Coinbase International)
- [Setting up Fordefi Webhooks](python/webhooks)
- [Programatically signing Bitcoin PSBT](python/bitcoin-psbt) with a Segwit or Taproot address
- [Custom Co-Signer](python/cosigner) for augmenting Fordefi's Policy engine with custom rules
- [Signing messages](python/message-signing) with a Fordefi vault: EVM (EIP-712 typed and EIP-191 personal messages), Solana, Tron, and Starknet
- [Programmatically adding a contact address or a batch of contact addresses](python/address-book) to your Fordefi organization's Address Book
- [Fordefi API CLI for AI agents](python/agent-cli) — transfers, contract calls, and swaps

## TypeScript Examples 🟦

- [Setting up Fordefi Webhooks and a server that listens and reacts to Hypernative Risk Insights](typescript/webhooks)
- [Calling EVM contracts](typescript/contract-calls/evm) with a Fordefi vault
- [Cross-chain USDC transfers](typescript/bridge/cctp) using Circle's CCTP
- On EVM chains (Ethereum, Base, Arbitrum, etc.):
  - [Deploying EVM smart contracts](typescript/evm/fordefi-evm-contracts-deployer) from your Fordefi vault using Hardhat or Foundry
  - [Deploying Morpho VaultsV2](typescript/evm/morpho-vault-v2-deployment)
  - [Swapping tokens programmatically with CowSwap](typescript/evm/swap-with-cowswap)
  - [Swapping tokens programmatically with Uniswap v3](typescript/evm/uniswap-v3)
  - [Minting/Redeeming USDe with Ethena](typescript/evm/ethena)
  - [Programmatic EVM transfers](typescript/evm/simple-api-transfers) using the Fordefi API
  - [Deploying and calling contracts on a local Hardhat node](typescript/evm/hardhat) for developers
  - [Signing EIP-712 and EIP-191 messages](typescript/evm/message-signing) with an EVM Fordefi vault
  - [Trading on Paradex](typescript/evm/paradex) (perps DEX on Starknet) with a Fordefi vault
- On Solana:
  - With [`@solana/web3.js`](typescript/solana/web3.js):
    - [Programmatic token swaps](typescript/solana/web3.js/jupiter) using Jupiter's Ultra API (and Meteora)
    - [Programmatic SOL staking with Marinade](typescript/solana/web3.js/marinade)
    - [Programmatic token swaps and pool management using Raydium](typescript/solana/web3.js/raydium)
    - [Programmatic SOL and SPL batch transfers](typescript/solana/web3.js/batch)
    - [Programmatically buying and selling PT tokens on Exponent Finance](typescript/solana/web3.js/exponent)
  - With [`@solana/kit`](typescript/solana/solana-kit):
    - [Programmatic token swaps and pool management using Orca](typescript/solana/solana-kit/orca)
    - [Programmatic SPL token transfers](typescript/solana/solana-kit/spl-transfer)
    - [Programmatically restake SOL for fragSOL using Fragmetric](typescript/solana/solana-kit/fragmetric)
    - [Programmatic SPL token batch transfers](typescript/solana/solana-kit/batch) using a transaction planner and executor
    - [Programmatically deploy an Anchor program](typescript/solana/solana-kit/deploy-program) using a transaction planner and executor
    - [Programmatically stake, unstake and withdraw SOL](typescript/solana/solana-kit/staking) from any validator
    - [Programmatic fixed delegations and subscriptions](typescript/solana/solana-kit/fixed-delegation)
    - [An Anchor program for batching SPL transfers](typescript/solana/solana-kit/batcher-program)
  - With [`gill`](typescript/solana/gill):
    - [SPL token transfers](typescript/solana/gill/spl-transfer)
    - [Solana gas station](typescript/solana/gill/solana-gas-station) (one vault pays fees, another provides tokens)
- On Stellar:
  - [Establishing trustlines](typescript/stellar/change-trust), [claiming claimable balances](typescript/stellar/claim-claimable-balance), [submitting raw transactions](typescript/stellar/raw-transaction), and [signing messages](typescript/stellar/sign-message)
- On Starknet:
  - [Programmatic contract calls](typescript/starknet/contract-calls)
- On Sui:
  - [Programmatic token swaps and pool creation using the Bluefin API](typescript/sui/bluefin)
  - [Publishing a Move package](typescript/sui/publish-package)
- On Hyperliquid L1 (HyperCore):
  - [Programmatic deposits, withdrawals, vault deposits, transfers, orders and USDC transfers](typescript/evm/hyperliquid-hypercore)
- On Cosmos:
  - [Programmatic smart contract deployments on Archway](typescript/cosmos/contract-deployment-archway)
- On Initia:
  - [Programmatic INIT transfers](typescript/initia)
- On NEAR (Black Box):
  - [Programmatic transfer and staking using Black Box signatures](typescript/black-box/near)
- On Avalanche P-Chain (Black Box):
  - [Transfer and staking AVAX using Black Box signatures](typescript/black-box/avalanche-p-chain)
- On Stacks:
  - [Calling smart contracts](typescript/stacks/contract-call) with a Fordefi Stacks Vault
- On Aptos:
  - [Sponsored fungible asset transfers with external Geomi gas station](typescript/aptos/gas-station)
  - [Withdrawing an LP position on Hyperion](typescript/aptos/hyperion)
  - [Key rotation from external Aptos wallet to Fordefi Black Box vault](typescript/aptos/key-rotation)
- Bridging Bitcoin to Hyperliquid:
  - [Unit Protocol / Hyperunit bridge](typescript/bridge/unit-protocol)

## Getting Started

1. Clone this repository
2. Follow the setup instructions in each example directory

## Documentation

For more information, see the [Fordefi API Documentation](https://docs.fordefi.com/developers/program-overview) and [Fordefi API reference page](https://docs.fordefi.com/api/openapi).
