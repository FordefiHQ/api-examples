# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Collection of standalone TypeScript examples demonstrating Fordefi API and Web3 Provider integration for EVM chains. Each subdirectory is an independent npm project with its own `package.json` — there is no monorepo tooling or shared workspace.

## Running Examples

Each project is self-contained. To work with any example:

```bash
cd <project-dir>
npm install
# Copy .env.example or create .env with FORDEFI_API_USER_TOKEN=<token>
# Place API User private key at ./fordefi_secret/private.pem
npm run <script>   # see package.json scripts for available commands
```

Key run commands per project:
- **simple-api-transfers**: `npm run tx`
- **ethena**: `npm run ethena`
- **message-signing**: `npm run sign-712-v5`, `npm run sign-712-v6`, `npm run sign-personal-v6`
- **swap-with-cowswap**: `npm run swap`
- **uniswap-v3**: `npm run swap`, `npm run mint`, `npm run increase`, `npm run remove`
- **hyperliquid-hypercore**: `npm run action`
- **paradex**: `npm run paradex`
- **hardhat**: `npm run node`, `npm run deploy-token`, `npm run call`
- **foundry-deployer**: `forge build` then `npm run deploy`
- **morpho-vault-v2-deployment**: `npx ts-node script/deploy.ts`

Only hardhat has test infrastructure (`npx hardhat test`). Other projects are pure examples with no tests.

## Architecture: Two Integration Patterns

### Pattern A: Web3Provider (most projects)
Uses `@fordefi/web3-provider` package → wraps in ethers.js `Web3Provider` → standard signer interface. Each project has a `get-provider.ts` that creates a `FordefiWeb3Provider`, waits for the `'connect'` event, and returns it (or an ethers wrapper).

Used by: ethena, message-signing, swap-with-cowswap, uniswap-v3, morpho-vault-v2-deployment, hyperliquid-hypercore, paradex, foundry-deployer.

### Pattern B: Direct API (lower-level)
Manually constructs JSON payloads, signs with the API User's PEM private key, POSTs to Fordefi API, and polls for the transaction hash.

Used by: simple-api-transfers, hardhat.

## Project Structure Convention

All projects follow the same layout:
- `src/config.ts` (or `script/config.ts`) — exports `fordefiConfig: FordefiProviderConfig` plus protocol-specific config. All behavior is driven by editing this config.
- `src/get-provider.ts` — Fordefi provider factory (Pattern A projects only).
- Entry point (e.g., `src/run.ts`, `src/swap.ts`) — imports config, calls get-provider, executes protocol logic.
- `.env` — `FORDEFI_API_USER_TOKEN` (required everywhere), plus project-specific vars.
- `fordefi_secret/private.pem` — API User private key (never committed).

## Ethers Version Split

Projects use either ethers v5 or v6 — check each project's `package.json`. The provider wrapping pattern differs between versions:
- **v5**: `new ethers.providers.Web3Provider(fordefiProvider)`
- **v6**: `new ethers.BrowserProvider(fordefiProvider)` or raw FordefiWeb3Provider used directly

Projects on ethers v5: ethena, swap-with-cowswap, uniswap-v3.
Projects on ethers v6: message-signing, hardhat, foundry-deployer, morpho-vault-v2-deployment, hyperliquid-hypercore, paradex.
