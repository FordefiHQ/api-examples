# EVM Fee Sponsorship with EIP-7702

This example demonstrates how to create sponsored EVM transactions using Fordefi's fee sponsorship feature. With fee sponsorship, one vault pays the gas fees for transactions initiated by another vault.

## Prerequisites

### 1. Fordefi Vaults

You need **2 Fordefi EVM vaults**:

- **Origin vault**: The vault initiating the transaction (will be upgraded to a smart account)
- **Fee payer vault**: The vault that will pay gas fees on behalf of the origin vault

### 2. Fordefi API Setup

Set up an API User and an API signer by following the [Fordefi API Signer documentation](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker).

### 3. Enable Fee Sponsorship

The origin vault must be upgraded to an EIP-7702 smart account. Note that only the origin vault needs to be upgraded—the fee payer vault does not require any upgrade. You can upgrade the origin vault in two ways:

**Option A: Via Fordefi Web Console**

Enable fee sponsorship in your organization settings through the [Fordefi web console](https://docs.fordefi.com/user-guide/vaults/evm-vaults).

**Option B: Via API**

Run the upgrade script:

```bash
uv run upgrade_vault_to_smart_account.py
```

## Environment Variables

Create a `.env` file with the following variables:

```env
FORDEFI_API_TOKEN=your_api_token
EVM_VAULT_ID=your_origin_vault ## will be upgraded to a smart account
FEE_PAYER_VAULT_ID_EVM=your_fee_payer_vault_id
```

## Usage

### Step 1: Upgrade Vault to Smart Account (if not done via web console)

```bash
uv run upgrade_vault_to_smart_account.py
```

This script sends an `evm_set_code` transaction to upgrade your vault to an EIP-7702 smart account.

### Step 2: Create a Sponsored Token Transfer

```bash
uv run sponsored_token_transfer_evm.py
```

This script creates a token transfer where the fee payer vault covers the gas fees for the origin vault's transaction.

## Scripts

| Script                               | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `upgrade_vault_to_smart_account.py`  | Upgrades an EVM vault to an EIP-7702 smart account |
| `sponsored_token_transfer_evm.py`    | Executes a sponsored ERC-20 token transfer         |

## Configuration

In `sponsored_token_transfer_evm.py`, update the following values:

```python
destination = "0x..."  # Recipient address
token_contract_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # Token contract (default: USDC)
value = str(100_000)  # Amount in smallest unit (e.g., 0.1 USDC = 100,000)
evm_chain = "ethereum"  # Target chain
```
