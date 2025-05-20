import { FordefiProviderConfig } from '@fordefi/web3-provider';
import { Token, BigintIsh } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config();

interface ExampleConfig {
  rpc: {
    local: string
    mainnet: string
  }
  tokens: {
    in: Token
    amountIn: number
    out: Token
    poolFee: number
  },
  wallet?: { 
    address: string
  },
  slippage:
  {
    slippageAmount: BigintIsh
  }
};

const WETH_TOKEN = new Token(
  1,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // on Arbitrum
  18,
  'WETH',
  'Wrapped Ether'
);

const USDC_TOKEN = new Token(
  1,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // on Mainnet
  6,
  'USDC',
  'USD//C'
);

// Configure the Fordefi provider
export const fordefiConfig: FordefiProviderConfig = {
  chainId: 1, // Mainnet
  address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  skipPrediction: false 
};

// Configure your Uniswap swap
export const CurrentConfig: ExampleConfig = {
  rpc: {
    local: '',
    mainnet: 'https://ethereum-rpc.publicnode.com',
  },
  tokens: {
    in: USDC_TOKEN,
    amountIn: 1, // in natural units (1 = 1 whole USDC)
    out: WETH_TOKEN,
    poolFee: FeeAmount.MEDIUM
  },
  wallet: {
    address:fordefiConfig.address
  },
  slippage:{
    slippageAmount: 100 // in bps (1% in this example)
  }
};