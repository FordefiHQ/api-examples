import { Trade } from '@uniswap/v3-sdk'
import { Token, TradeType } from '@uniswap/sdk-core'
import { ethers} from 'ethers'
import JSBI from 'jsbi';
  
const MAX_DECIMALS = 4
  
function countDecimals(value: number): number {
  if (Math.floor(value) === value) return 0;
  return value.toString().split('.')[1]?.length || 0;
};

export function fromReadableAmount(amount: number, decimals: number): JSBI {
  const extraDigits = Math.pow(10, countDecimals(amount))
  const adjustedAmount = amount * extraDigits
  return JSBI.divide(
    JSBI.multiply(
      JSBI.BigInt(adjustedAmount),
      JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
    ),
    JSBI.BigInt(extraDigits)
  )
};

export function toReadableAmount(rawAmount: number, decimals: number): string {
return ethers.utils.formatUnits(rawAmount, decimals).slice(0, MAX_DECIMALS)
};

export function displayTrade(trade: Trade<Token, Token, TradeType>): string {
return `${trade.inputAmount.toExact()} ${
    trade.inputAmount.currency.symbol
} for ${trade.outputAmount.toExact()} ${trade.outputAmount.currency.symbol}`
};
