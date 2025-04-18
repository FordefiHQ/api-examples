# Exchange Transfers

This guide demonstrates how to programmatically desposit and withdraw assets to Exchange Vaults on Binance and Coinbase International using the Fordefi API.

---

## Before you start

- In your Fordefi workspace, create Exchange Vaults and connect them to your Binance and Coinbase Internatinal accounts. [Click here to learn more](https://docs.fordefi.com/user-guide/integrate-exchanges).
- Create a Fordefi API User and a `.pem` private key for your API User. [Click here to learn more](https://docs.fordefi.com/developers/program-overview).
- Ensure your API Signer is up to date and running. [Click here to learn more](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/install-the-api-signer).

---

## Install dependencies

```bash
pip install requests ecdsa python-dotenv
```
or if you're using UV:
```bash
uv add requests ecdsa python-dotenv
```

---

## Environment Setup

1. Create a `.env` file with the following variables:

```
FORDEFI_API_TOKEN=your_fordefi_api_user_token_here
FORDEFI_SOLANA_VAULT_ID=your_fordefi_solana_vault_id_here
FORDEFI_ETHEREUM_VAULT_ID=your_fordefi_ethereum_vault_id_here
// add additional Fordefi Vault IDs as needed
BINANCE_EXCHANGE_VAULT_ID=your_fordefi_binance_exchange_vault_id_here
COINBASE_EXCHANGE_VAULT_ID=your_fordefi_coinbase_international_exchange_vault_id_here
// add additional Fordefi Exchange Vault IDs as needed
```

2. Create a `/secret` folder at the root of your project and place your API User `.pem` private key inside the folder. The file should be named `private.pem`.

3. Start your API Signer by running:

```bash
docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
```

---

## Usage Instructions

### Deposit Native SOL to Binance

The `exchange_deposit_native_solana.py` script demonstrates depositing SOL from your Fordefi Solana Vault to your Fordefi Exchange Vault on Binance:

1. Modify the destination address and amount in the script:
```python
destination = "BINANCE_EXCHANGE_VAULT_ID"  # Note we're using the Fordefi Exchange Vault ID and not the Solana address
value = "10000" # 0.00001 in SOL (using its NATIVE 9-decimal precision)
```

2. Run the script:
```bash
uv run exchange_withdraw_native_solana.py
```

### Withdraw Native SOL from Binance to a Regular Fordefi Vault or an External Address

The `exchange_withdraw_native_solana.py` script demonstrates withdrawing SOL from your Binance Exchange Vault to a Solana wallet address (for example, your Fordefi EVM Vault address or an external address).

1. Modify the destination address and amount in the script:
```python
destination = "YOUR_SOLANA_WALLET_ADDRESS"  # Change to your destination address
value = "1000000000000000000"  # Amount in SOL (using 18-decimal precision)
```

2. Run the script:
```bash
uv run exchange_withdraw_native_solana.py
```

### Withdraw USDC from Coinbase International to a Regular Fordefi Vault or an External Address

The `exchange_withdraw_token_evm.py` script demonstrates withdrawing USDC from your Coinbase International Exchange Vault to an Ethereum wallet address (for example, your Fordefi EVM Vault address or an external address).

1. Modify the destination address and amount in the script:
```python
destination = "YOUR_ETHEREUM_WALLET_ADDRESS"  # Change to your destination address
value = "1000000000000000000"  # Amount in USDC (using 18-decimal precision)
```

2. Run the script:
```bash
uv run exchange_withdraw_token_evm.py
```

### Withdraw USDC from Coinbase International to a Fordefi Binance Exchange Vault:

The `exchange_withdraw_token_evm.py` script demonstrates withdrawing USDC from your Coinbase International Exchange Vault to your Binance Exchange Vault

1. Modify the `to` field in the json request as follow:
```python
"to": {
    "vault_id": "YOUR_FORDEFI_BINANCE_EXCHANGE_VAULT_ID",
    "type": "vault"
},
```
2. Modify the value:
```python
value = "1000000000000000000"  # Amount in USDC (using 18-decimal precision)
```

3. Run the script:
```bash
uv run exchange_to_exchange_withdrawal_token_evm.py
```

---

## Important Decimal Precision Note

For withdrawals from an Exchange Vault, our API requires amounts to be specified with 18-decimal precision regardless of the asset's native decimal places. For example:

- For 1 SOL: `1000000000000000000` (even though SOL has 9 decimal places natively)
- For 1 USDC: `1000000000000000000` (even though USDC has 6 decimal places on Ethereum)

For deposits into an Exchange Vault however, you must use the NATIVE decimal places. For example:

- For 1 SOL: `1000000000` 
- For 1 USDC: `1000000`
- For 1 ETH: `1000000000000000000`

---

## Additional Resources

- [Fordefi API Reference](https://docs.fordefi.com/developers/api-reference)
- [Fordefi Exchange Integration Guide](https://docs.fordefi.com/user-guide/integrate-exchanges)
- [API Signer Documentation](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer)