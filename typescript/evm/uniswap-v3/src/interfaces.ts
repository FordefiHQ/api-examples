import { Token, BigintIsh } from '@uniswap/sdk-core'

export interface SwapConfig {
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

export interface LiquidityConfig {
  tokens: {
    token0: Token
    token1: Token
    token0Amount: number
    token1Amount: number
    poolFee: number
  }
  priceRange: {
    rangePercent: number
  }
  slippage: {
    slippageBps: number // in basis points (100 = 1%)
  }
};

export interface RemoveConfig {
  liquidityPercentage: number // Percentage of liquidity to remove (1-100)
  slippage: {
    slippageBps: number // in basis points (100 = 1%)
  }
};

