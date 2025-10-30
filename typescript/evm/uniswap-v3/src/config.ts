import { SwapConfig, LiquidityConfig, RemoveConfig } from './interfaces';
import { FordefiProviderConfig } from '@fordefi/web3-provider';
import { USDC_TOKEN, WETH_TOKEN } from './constants';
import { FeeAmount } from '@uniswap/v3-sdk';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Configure the Fordefi provider
export const fordefiConfig: FordefiProviderConfig = {
  chainId: 1, // Mainnet
  address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  skipPrediction: false 
};

// Configure your position NFT (used for increase and remove liquidity operations)
export const POSITION_TOKEN_ID = "1118818"

// Configure your Uniswap swap
export const swapConfig: SwapConfig = {
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

// Configure liquidity provision or increasing the position
export const LiquidityProvisionConfig: LiquidityConfig = {
  tokens: {
    token0: USDC_TOKEN,
    token1: WETH_TOKEN,
    token0Amount: 5, // in human-reable units
    token1Amount: 0.001, // in human-reable units
    poolFee: FeeAmount.MEDIUM
  },
  priceRange: {
    rangePercent: 10 // ±10% range around current price
  },
  slippage: {
    slippageBps: 500 // 5% slippage tolerance (500 basis points)
  }
};

// Configure removing liquidity from a position
export const RemoveLiquidityConfig: RemoveConfig = {
  liquidityPercentage: 100, // Remove 100% of liquidity (can be adjusted to remove partial amounts)
  slippage: {
    slippageBps: 500 // 5% slippage tolerance (500 basis points)
  }
};