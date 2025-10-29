import { Token, BigintIsh } from '@uniswap/sdk-core'

export interface ExampleConfig {
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

