# Full Morpho Ecosystem Deployment

## Quick Start

```bash
# Setup
cp script/full/.env.example .env  # Edit with chain addresses

# Deploy (local)
source .env && forge script script/full.sol:FullDeployment --rpc-url $RPC_URL --broadcast -vvvv

# Deploy (mainnet/testnet)
source .env && forge script script/full.sol:FullDeployment --rpc-url $RPC_URL --broadcast --slow --gas-estimate-multiplier 200 -vvvv
```

## What Gets Deployed

| Phase | Component | Notes |
|-------|-----------|-------|
| 1-5 | Tokens + Oracle | testWETH, testwstETH, MockOracle (or MorphoChainlinkOracleV2) |
| 6 | Markets | Main (86% LLTV, 90% util) + Idle |
| 7-9 | Market Setup | Supply, collateral, borrow |
| 10 | Morpho Vault V1 | Morpho Vault V1 with 3-day timelock, dead deposit |
| 11 | Morpho Vault V2 | With MorphoVaultV1Adapter, MAX_RATE (200% APR), dead deposit |
| 12-13 | MorphoMarketV1AdapterV2 | 1e9 shares to 0xdead on market, adapter timelocks |
| 14 | Finalize | Transfer ownership, set curator/allocator/sentinel |

## Adapter Comparison

| Feature | MorphoVaultV1Adapter | MorphoMarketV1AdapterV2 |
|---------|---------------------|-------------------------|
| Target | Morpho Vault V1 (Morpho Vault V1) | Morpho Market V1 markets directly |
| Timelocks | None (inherits from Morpho Vault V2) | Own timelock system (default: 3 days) |
| allocate/deallocate data | Empty bytes | `abi.encode(MarketParams)` |
| IRM requirement | Any | Must be Adaptive Curve IRM |
| Dead deposit | Morpho Vault V1 level | Morpho market level (1e9 shares to 0xdead) |
| ID structure | Single `adapterId` | 3 IDs: adapterId, collateralToken, this/marketParams |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MORPHO_ADDRESS` | Yes | Morpho Market V1 contract address |
| `IRM_ADDRESS` | Yes | Adaptive Curve IRM address |
| `VAULT_V1_FACTORY_ADDRESS` | Yes | Morpho Vault V1 factory address |
| `VAULT_V2_FACTORY` | Yes | MorphoVaultV2Factory address |
| `ADAPTER_REGISTRY` | Yes | Adapter registry address |
| `MORPHO_VAULT_V1_ADAPTER_FACTORY` | Yes | MorphoVaultV1AdapterFactory address |
| `MORPHO_MARKET_V1_ADAPTER_V2_FACTORY` | Yes | MorphoMarketV1AdapterV2Factory address |
| `OWNER` | Yes | Final owner address for vaults |
| `ORACLE_FACTORY_ADDRESS` | No | MorphoChainlinkOracleV2Factory (uses mock if not set) |
| `CURATOR` | No | Curator address (defaults to OWNER) |
| `ALLOCATOR` | No | Allocator address (defaults to OWNER) |
| `SENTINEL` | No | Sentinel address (optional) |
| `TIMELOCK_DURATION` | No | Morpho Vault V2 timelock duration in seconds (default: 0) |
| `ADAPTER_TIMELOCK_DURATION` | No | MorphoMarketV1AdapterV2 timelock duration (default: 3 days) |
| `DEAD_DEPOSIT_AMOUNT` | No | Dead deposit for Morpho Vault V2 in wei (default: 1e9) |
| `LOAN_TOKEN` | No | Existing loan token address (deploys new if not set) |
| `COLLATERAL_TOKEN` | No | Existing collateral token address (deploys new if not set) |
| `DEPLOYED_ORACLE` | No | Existing oracle address (deploys new if not set) |

## Notes

- Gas: ~20-25M total. Use `--gas-estimate-multiplier 200` on live networks.
- Morpho Vault V1 timelock: Always 3 days (hardcoded)
- MAX_RATE for Morpho Vault V2: 200% APR (hardcoded)
