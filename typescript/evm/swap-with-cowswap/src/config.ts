import { OrderQuoteRequest, OrderQuoteSideKindSell, SigningScheme } from '@cowprotocol/cow-sdk'
import { EvmChainId, FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config()

export const vaultRelayers = {
  mainnet: "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110",
  base: "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110"
};

export const fordefiConfig: FordefiProviderConfig = {
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN  || "",
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
  chainId: EvmChainId.NUMBER_8453, // Base
  rpcUrl: "https://base.llamarpc.com"
};

export const quoteRequest: OrderQuoteRequest = {
    sellToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC token 
    buyToken: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT token
    from: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
    receiver: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
    sellAmountBeforeFee: (1_000_000).toString(), // 1 USDC = 1_000_000
    kind: OrderQuoteSideKindSell.SELL,
    signingScheme: SigningScheme.EIP712
};
