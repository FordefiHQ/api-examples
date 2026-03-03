# Fordefi Agent CLI

## What is Fordefi?

Fordefi is an institutional MPC (Multi-Party Computation) wallet infrastructure for DeFi. It provides secure, programmatic access to blockchain operations across multiple blockchains. When you send a transaction through Fordefi, the private key never exists in one place - it's split across multiple parties (Fordefi and the Fordefi account users) who collectively sign.

This CLI package gives you a single Python client to:
- **Transfer** native assets and tokens on 16+ blockchains
- **Call** EVM smart contracts (any chain running the EVM)
- **Swap** tokens on EVM chains and Solana
- **Read** vault balances and transaction status

## Setup

```python
from fordefi_agent import FordefiClient

client = FordefiClient(
    api_token="your-fordefi-api-user-token",
    pem_path="/path/to/private.pem",
    vault_id="your-default-vault-uuid",
)
```

**You need three things:**
1. `api_token` - The Fordefi API user token (starts with `fd-`)
2. `pem_path` - Path to the ECDSA private key PEM file used to sign API requests
3. `vault_id` - The UUID of the Fordefi vault to use (can be overridden per-call)

**Install dependencies:**
```bash
uv sync
```

## Transfers

### Transfer Native Assets

Send the chain's native currency (ETH, SOL, BTC, etc.):

```python
# Send 0.01 ETH on Ethereum
result = client.transfer(
    chain="ethereum",
    to="0xRecipientAddress",
    amount="10000000000000000",  # 0.01 ETH in wei
)
print(result["transaction_id"])

# Send 0.001 SOL on Solana
result = client.transfer(
    chain="solana",
    to="9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS",
    amount="1000000",  # 0.001 SOL in lamports
)

# Send 10000 satoshis of BTC
result = client.transfer(
    chain="bitcoin",
    to="bc1p...",
    amount="10000",
)

# Send ATOM on Cosmos with memo
result = client.transfer(
    chain="cosmos",
    to="cosmos1abc...",
    amount="100",  # in uatom
    memo="1234",
)
```

### Transfer Tokens

Provide the `token` parameter with the token's contract/mint address:

```python
# Send 10 USDC on Ethereum (USDC has 6 decimals)
result = client.transfer(
    chain="ethereum",
    to="0xRecipient",
    amount="10000000",  # 10 USDC = 10 * 10^6
    token="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
)

# Send 1 USDC on Solana
result = client.transfer(
    chain="solana",
    to="9BgxwZ...",
    amount="1000000",
    token="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
)

# Send USDT on TRON
result = client.transfer(
    chain="tron",
    to="THpczdekw3n93u48ZCbdpimcFVW8Rx9jrj",
    amount="1000000",  # 1 USDT
    token="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
)

# Send USDT jetton on TON
result = client.transfer(
    chain="ton",
    to="UQApn3xK3wVS5vH2LXMga1sJNY5QrcTNjDPFlyt3yR2aipwt",
    amount="100000",  # 0.1 USDT
    token="0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe",
)
```

## EVM Contract Calls

Call any smart contract on any EVM chain:

```python
# Wrap ETH to WETH
result = client.evm_contract_call(
    chain="ethereum",
    contract="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  # WETH contract
    call_data="0xd0e30db0",  # deposit() function selector
    value="1000000000000000000",  # 1 ETH in wei
)

# Call with custom gas limit
result = client.evm_contract_call(
    chain="arbitrum",
    contract="0xContractAddress",
    call_data="0xabcdef1234...",
    gas_limit="500000",
)

# Call on a custom EVM chain by chain ID
result = client.evm_contract_call(
    chain="42793",  # custom chain ID
    contract="0xContractAddress",
    call_data="0x...",
)
```

**Building call_data:** The `call_data` parameter is the ABI-encoded function call. You can build it using:
- `web3.py`: `contract.functions.transfer(to, amount).build_transaction()['data']`
- `eth_abi`: `'0x' + encode(['address', 'uint256'], [to, amount]).hex()`
- Or use a pre-computed hex string

## EVM Message Signing

Sign messages with your EVM vault using Fordefi's MPC infrastructure. Supports both personal messages (EIP-191) and typed data (EIP-712). Message signing uses the `/api/v1/transactions/create-and-wait` endpoint and returns the signature once the signing process completes.

### Sign a Personal Message (EIP-191)

```python
result = client.sign_personal_message(
    chain="ethereum",
    message="Hello, this is a message to sign.",
)
print(f"Signature (hex): {result['signature']}")
print(f"r: {result['r']}, s: {result['s']}, v: {result['v']}")
```

The `message` parameter is a plain-text string. It is hex-encoded automatically before being sent to the API.

**Parameters:**
- `chain` - EVM chain name (e.g. `"ethereum"`, `"polygon"`, `"arbitrum"`)
- `message` - The plain-text message to sign
- `vault_id` - (optional) Override the default vault ID

### Sign Typed Data (EIP-712)

```python
typed_data = {
    "types": {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"},
        ],
        "Permit": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "nonce", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
        ],
    },
    "domain": {
        "name": "USD Coin",
        "version": "2",
        "chainId": 1,
        "verifyingContract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    "primaryType": "Permit",
    "message": {
        "owner": "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
        "spender": "0x1111111254fb6c44bac0bed2854e76f90643097d",
        "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        "nonce": 1000,
        "deadline": 1767166198,
    },
}

result = client.sign_typed_data(
    chain="ethereum",
    typed_data=typed_data,
)
print(f"Signature (hex): {result['signature']}")
```

The `typed_data` parameter is a dict following the EIP-712 structure. It is JSON-serialized and hex-encoded before being sent to the API. Large `uint256` values in the message must be passed as strings.

**Parameters:**
- `chain` - EVM chain name (e.g. `"ethereum"`, `"polygon"`, `"arbitrum"`)
- `typed_data` - The EIP-712 typed data dict (must include `types`, `domain`, `primaryType`, and `message`)
- `vault_id` - (optional) Override the default vault ID

### Return Values

Both signing methods return:

```python
{
    "signature": "0xabc123...",   # Full signature as hex string
    "r": "0x...",                 # r component
    "s": "0x...",                 # s component
    "v": 27,                     # v component (27 or 28)
    "transaction_id": "uuid",    # Fordefi transaction ID
    "raw_response": { ... },     # Full API response
}
```

### Common Use Cases

- **EIP-2612 Permit**: Sign token approvals off-chain (gasless approvals)
- **Login/Authentication**: Prove wallet ownership for dApp sign-in (SIWE)
- **Off-chain Orders**: Sign orders for DEXs like 1inch, CoW Swap, or Seaport
- **Governance**: Sign votes or proposals off-chain

## Swaps

Swap tokens on EVM chains and Solana. The client automatically fetches providers, gets quotes, picks the best one, and submits:

```python
# Swap ETH for USDC on Ethereum
result = client.swap(
    chain="ethereum",
    sell_token="native",  # "native" means the chain's native asset
    buy_token="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # USDC
    amount="1000000000000000",  # 0.001 ETH
    slippage_bps="300",  # 3% slippage tolerance
)
print(f"Swap TX: {result['transaction_id']}")
print(f"Expected output: {result['quote']['output_amount']}")

# Swap USDC for USDT on Ethereum (ERC20 to ERC20)
result = client.swap(
    chain="ethereum",
    sell_token="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # USDC
    buy_token="0xdAC17F958D2ee523a2206206994597C13D831ec7",  # USDT
    amount="1000000",  # 1 USDC
)

# Swap on Solana (SPL to SPL)
result = client.swap(
    chain="solana",
    sell_token="So11111111111111111111111111111111111111112",  # Wrapped SOL
    buy_token="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    amount="100000000",  # 0.1 SOL in lamports
)
```

### Preview Quotes Without Executing

```python
quotes = client.get_swap_quote(
    chain="ethereum",
    sell_token="native",
    buy_token="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    amount="1000000000000000000",
)
print(f"Best: {quotes['best_quote']['output_amount']} from {quotes['best_quote']['provider_info']['provider_id']}")
for q in quotes["all_quotes"]:
    print(f"  {q['provider_info']['provider_id']}: {q['output_amount']}")
```

## Reading Data

```python
# List all vaults
vaults = client.list_vaults()

# Get vault balances
balances = client.get_balance()  # uses default vault
balances = client.get_balance(vault_id="other-vault-uuid")

# Get a specific transaction
tx = client.get_transaction("transaction-uuid")

# List recent transactions
txs = client.list_transactions(limit=10)
txs = client.list_transactions(state="completed")
```

## Waiting for Transactions

After submitting, you can poll until the transaction completes:

```python
result = client.transfer(chain="ethereum", to="0x...", amount="1000000000000000")

# Wait up to 2 minutes for completion
final = client.wait_for_transaction(
    result["transaction_id"],
    timeout_seconds=120,
    poll_interval=3,
)
print(f"Final state: {final['state']}")
# States: "completed", "mined", "aborted", "failed", "rejected", "stuck"
```

## Supported Chains Reference

| Chain Name | `chain=` | Native Unit | Token Type | Token Param Format |
|------------|----------|-------------|------------|-------------------|
| Ethereum | `"ethereum"` | wei (1 ETH = 10^18) | ERC-20 | `0x` hex address |
| BSC | `"bsc"` | wei (1 BNB = 10^18) | ERC-20 | `0x` hex address |
| Polygon | `"polygon"` | wei (1 MATIC = 10^18) | ERC-20 | `0x` hex address |
| Arbitrum | `"arbitrum"` | wei (1 ETH = 10^18) | ERC-20 | `0x` hex address |
| Optimism | `"optimism"` | wei (1 ETH = 10^18) | ERC-20 | `0x` hex address |
| Avalanche | `"avalanche"` | wei (1 AVAX = 10^18) | ERC-20 | `0x` hex address |
| Base | `"base"` | wei (1 ETH = 10^18) | ERC-20 | `0x` hex address |
| Fantom | `"fantom"` | wei (1 FTM = 10^18) | ERC-20 | `0x` hex address |
| Linea | `"linea"` | wei (1 ETH = 10^18) | ERC-20 | `0x` hex address |
| Solana | `"solana"` | lamports (1 SOL = 10^9) | SPL | base58 mint address |
| Bitcoin | `"bitcoin"` | satoshis (1 BTC = 10^8) | N/A | N/A |
| Cosmos Hub | `"cosmos"` | uatom (1 ATOM = 10^6) | N/A | N/A |
| Injective | `"injective"` | inj (1 INJ = 10^18) | N/A | N/A |
| TON | `"ton"` | nanotons (1 TON = 10^9) | Jetton | raw format address |
| TRON | `"tron"` | sun (1 TRX = 10^6) | TRC-20 | base58 address |
| Aptos | `"aptos"` | octas (1 APT = 10^8) | FA | metadata address |
| Sui | `"sui"` | mist (1 SUI = 10^9) | Coin | coin_type string |
| Custom EVM | `"42793"` | wei | ERC-20 | `0x` hex address |

## Amount Convention

**Amounts are ALWAYS strings of the smallest unit.** Never use decimals.

| You Want to Send | Chain | Amount String |
|-----------------|-------|---------------|
| 1 ETH | ethereum | `"1000000000000000000"` |
| 0.01 ETH | ethereum | `"10000000000000000"` |
| 10 USDC | ethereum | `"10000000"` (6 decimals) |
| 1 SOL | solana | `"1000000000"` |
| 1 USDC | solana | `"1000000"` (6 decimals) |
| 0.001 BTC | bitcoin | `"100000"` |
| 1 ATOM | cosmos | `"1000000"` |
| 1 TON | ton | `"1000000000"` |
| 1 TRX | tron | `"1000000"` |
| 1 APT | aptos | `"100000000"` |
| 1 SUI | sui | `"1000000000"` |

## Error Handling

All errors raise `FordefiError` with structured information:

```python
from fordefi_agent import FordefiClient, FordefiError, FordefiTimeoutError

try:
    result = client.transfer(chain="ethereum", to="0x...", amount="1000")
except FordefiError as e:
    print(e.message)       # "POST /api/v1/transactions failed"
    print(e.status_code)   # 400
    print(e.request_id)    # "abc-123-def" (useful for Fordefi support)
    print(e.details)       # {"error": "invalid_address", ...}
except FordefiTimeoutError as e:
    print(e.transaction_id)
    print(e.timeout)
```

## Return Values

All mutation methods (transfer, evm_contract_call, swap) return:

```python
{
    "transaction_id": "uuid-string",  # Use this to track the transaction
    "state": "pending",               # Initial state
    "raw_response": { ... },          # Full API response for advanced usage
}
```

The `swap` method also includes:
```python
{
    "quote": {
        "quote_id": "...",
        "output_amount": "...",
        "provider_info": {"provider_id": "kyberswap", ...},
    },
}
```

## Using Multiple Vaults

The default `vault_id` is set at initialization. Override per-call:

```python
client = FordefiClient(api_token="...", pem_path="...", vault_id="evm-vault-uuid")

# Uses default vault
client.transfer(chain="ethereum", to="0x...", amount="1000")

# Uses a different vault
client.transfer(chain="solana", to="...", amount="1000", vault_id="solana-vault-uuid")
```

## Tips

1. **Check balance before transferring** to avoid failed transactions
2. **Use `get_swap_quote` first** to preview swap rates before committing
3. **Set appropriate slippage** - default is 5% (500 bps), lower for stablecoins
4. **For contract calls**, make sure `call_data` starts with `0x`
5. **Bitcoin uses a different API endpoint** internally - this is handled automatically
6. **Cosmos chains support `memo`** - required by some exchanges for deposits
7. **Custom EVM chains**: just pass the numeric chain ID as the chain name (e.g. `"42793"`)
8. **Transaction states**: `pending` -> `signed` -> `pushed_to_blockchain` -> `mined` -> `completed`
