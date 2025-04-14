# CowSwap Token Swap with Fordefi

A script to perform token swaps on CowSwap (CoW Protocol) using Fordefi as the signer.

## Overview

This script enables you to execute token swaps on CowSwap while using your Fordefi EVM vault as the signer. It leverages CowSwap's API to get quotes and create orders, with transaction signing handled by Fordefi.

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- Fordefi credentials: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))

## Setup

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file in the root directory with your Fordefi API user token:
```bash
FORDEFI_API_USER_TOKEN=your_api_user_token_here
```

4. Create a directory `fordefi_secret` and place your API Signer's PEM private key in `fordefi_secret/private.pem`

## Configuration

The script uses the following main configurations:

- **Fordefi Provider**: Configures the connection to your Fordefi vault
- **Token Addresses**: Currently set to swap USUAL → USDT on Ethereum mainnet
- **Amount**: Set in the `sellAmountBeforeFee` parameter

To modify the swap parameters, update the `quoteRequest` object in `swap.ts`:
```typescript
const quoteRequest: OrderQuoteRequest = {
sellToken: '0x...', // Token to sell
buyToken: '0x...', // Token to buy
from: "your_address",
receiver: "receiver_address",
sellAmountBeforeFee: "amount_in_wei",
kind: OrderQuoteSideKindSell.SELL,
signingScheme: SigningScheme.EIP712
}
```

## Usage

Run the script with:
```bash
npm run swap
```


The script will:
1. Connect to Fordefi
2. Get a quote from CowSwap
3. Sign the order with your Fordefi vault
4. Submit the order to CowSwap
5. Return the order details

## Dependencies

- `@fordefi/web3-provider`: Fordefi Web3 provider
- `@cowprotocol/cow-sdk`: CowSwap SDK
- `ethers`: Ethereum library
- `dotenv`: Environment variable management

## Security Notes

- Keep your Fordefi credentials secure and never commit them to version control
- The PEM private key should be stored securely and access should be restricted
- Always verify token addresses and amounts before executing swaps

## Support

For issues related to:
- Fordefi integration: [Fordefi Documentation](https://docs.fordefi.com/developers/program-overview)
- CowSwap protocol: [CoW Protocol Documentation](https://docs.cow.fi/cow-protocol/reference/sdks/cow-sdk)