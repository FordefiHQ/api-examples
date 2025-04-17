# Withdrawing Assets from Exchanges Using Fordefi API

This guide demonstrates how to programmatically withdraw assets from Binance and Coinbase International using the Fordefi API with Exchange Vaults.

---

## Before you start

- In your Fordefi workspace, create Exchange Vaults and connect them to your Binance and Coinbase accounts. [Click here to learn more](https://docs.fordefi.com/user-guide/integrate-exchanges).
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
FORDEFI_API_TOKEN=your_api_token_here
BINANCE_EXCHANGE_VAULT_ID=your_fordefi_binance_vault_id_here
COINBASE_EXCHANGE_VAULT_ID=your_fordefi_coinbase_vault_id_here
```

2. Create a `/secret` folder at the root of your project and place your API User `.pem` private key inside the folder. The file should be named `private.pem`.

3. Start your API Signer by running:

```bash
docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
```

---

## Usage Instructions

### Withdraw Native SOL from Binance

The `exchange_withdraw_native_solana.py` script demonstrates withdrawing SOL from Binance to a Solana wallet address (for example, your Fordefi Solana Vault).

1. Modify the destination address and amount in the script:
```python
destination = "YOUR_SOLANA_WALLET_ADDRESS"  # Change to your destination address
value = str(1 * 10**18)  # Amount in SOL (using 18-decimal precision)
```

2. Run the script:
```bash
uv run exchange_withdraw_native_solana.py
```

### Withdraw USDC from Coinbase International

The `exchange_withdraw_token_evm.py` script demonstrates withdrawing USDC from Coinbase to an Ethereum wallet address (for example, your Fordefi EVM Vault).

1. Modify the destination address and amount in the script:
```python
destination = "YOUR_ETHEREUM_WALLET_ADDRESS"  # Change to your destination address
value = str(1 * 10**18)  # Amount in USDC (using 18-decimal precision)
```

2. Run the script:
```bash
uv run exchange_withdraw_token_evm.py
```

---

## Decimal Precision Note

Fordefi's API requires amounts to be specified with 18-decimal precision regardless of the asset's native decimal places. For example:

- For 1 SOL: `1 * 10**18` (even though SOL has 9 decimal places natively)
- For 1 USDC: `1 * 10**18` (even though USDC has 6 decimal places on Ethereum)

---

## Additional Resources

- [Fordefi API Reference](https://docs.fordefi.com/developers/api-reference)
- [Fordefi Exchange Integration Guide](https://docs.fordefi.com/user-guide/integrate-exchanges)
- [API Signer Documentation](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer)