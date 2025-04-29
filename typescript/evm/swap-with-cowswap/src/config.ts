import { OrderQuoteRequest, OrderQuoteSideKindSell, SigningScheme } from '@cowprotocol/cow-sdk'
import { EvmChainId, FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config()

export const fordefiConfig: FordefiProviderConfig = {
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN  || "",
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
  chainId: EvmChainId.NUMBER_1, // Mainnet
  rpcUrl: "https://ethereum-rpc.publicnode.com"
};

export const quoteRequest: OrderQuoteRequest = {
    sellToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC token
    buyToken: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT token
    from: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
    receiver: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
    sellAmountBeforeFee: (4_000_000).toString(), // 1 USDC = 1_000_000
    kind: OrderQuoteSideKindSell.SELL,
    signingScheme: SigningScheme.EIP712
  }
