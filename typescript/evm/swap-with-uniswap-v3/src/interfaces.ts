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

export const WETH_TOKEN = new Token(
  1,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // on Arbitrum
  18,
  'WETH',
  'Wrapped Ether'
);

export const USDC_TOKEN = new Token(
  1,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // on Mainnet
  6,
  'USDC',
  'USD//C'
);

// Pool ABI for fetching pool state
export const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function tickSpacing() external view returns (int24)',
];

// Factory ABI for getting pool address
export const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];
