# Stacks Contract Call via Fordefi

This example demonstrates how to call a smart contract on the [Stacks](https://www.stacks.co/) blockchain using the [Fordefi API](https://docs.fordefi.com/developers/program-overview).

The included configuration targets the **Bitflow DLMM liquidity router** — specifically, the `withdraw-liquidity-multi` function on the `dlmm-liquidity-router-v-1-2` contract — but you can adapt it to call any Stacks smart contract.

## How It Works

1. **Build the transaction** — Uses `@stacks/transactions` to construct an unsigned contract call with Clarity-typed function arguments (tuples, lists, uints, etc.), then serializes it.
2. **Sign the API request** — Signs the serialized payload with the API User's RSA private key (the standard Fordefi request-signing scheme).
3. **Submit to Fordefi** — POSTs the signed request to Fordefi's `/api/v1/transactions` endpoint. Fordefi handles the MPC signing and broadcasts the transaction on-chain.

## Prerequisites

- A Fordefi account with a **Stacks vault**
- An **API User token** and the corresponding **RSA private key**

## Setup

```bash
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in your values:

```
FORDEFI_API_USER_TOKEN=<your API token>
STACKS_VAULT_ID=<your Stacks vault ID>
STACKS_VAULT_ADDRESS=<your Stacks vault address>
```

Place your API signer private key at:

```
./secret/private.pem
```

## Configuration

Edit `config.ts` to change the contract call parameters — contract address, function name, function arguments (bins), and fee.

## Run

```bash
npm run tx
```
