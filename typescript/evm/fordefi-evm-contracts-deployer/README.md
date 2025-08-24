# Fordefi EVM Contracts Deployer

A simple toolkit to deploy smart contracts on any EVM-compatible blockchain using Fordefi.

## What is this?

This repository helps you deploy smart contracts using either Foundry or Hardhat to any EVM chain (Ethereum, Polygon, Base, Arbitrum, etc.) while using:
- Fordefi as your RPC provider
- Your Fordefi EVM vault as the contract deployer/signer

## Prerequisites

- An EVM smart contract
- Fordefi organization and EVM vault
- Foundry or Hardhat installed
- Fordefi credentials: API User token, API User private key and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))

## Quick Start

1. Clone this repo
2. Choose Foundry or Hardhat and read the corresponding README file
3. Set up your Fordefi credentials
4. Add your contracts
5. Deploy using the provided script