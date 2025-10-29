import { getProvider } from './get-provider';
import { ethers } from 'ethers';
import { LiquidityProvisionConfig, fordefiConfig } from './config';
import { fromReadableAmount } from './helper';
import { 
  ERC20_ABI, 
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  NONFUNGIBLE_POSITION_MANAGER_ABI 
} from './constants';
import { Pool, nearestUsableTick } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import JSBI from 'jsbi';

// Pool ABI for fetching pool state
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function tickSpacing() external view returns (int24)',
];

// Factory ABI for getting pool address
const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

async function getPoolInfo(
  token0: Token,
  token1: Token,
  fee: number,
  provider: ethers.providers.JsonRpcProvider
) {
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const poolAddress = await factoryContract.getPool(token0.address, token1.address, fee);

  if (poolAddress === ethers.constants.AddressZero) {
    throw new Error('Pool does not exist');
  }

  const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const [slot0, liquidity] = await Promise.all([
    poolContract.slot0(),
    poolContract.liquidity(),
  ]);

  return {
    poolAddress,
    sqrtPriceX96: slot0.sqrtPriceX96,
    tick: slot0.tick,
    liquidity: JSBI.BigInt(liquidity.toString()),
  };
}

function calculatePriceRange(
  currentTick: number,
  rangePercent: number,
  tickSpacing: number
) {
  // Calculate tick range based on percentage
  // tick = log base 1.0001 of price
  // To get ±X% range: ticks = ±(log(1 + X/100) / log(1.0001))
  const tickRange = Math.floor(Math.log(1 + rangePercent / 100) / Math.log(1.0001));
  
  const tickLower = nearestUsableTick(currentTick - tickRange, tickSpacing);
  const tickUpper = nearestUsableTick(currentTick + tickRange, tickSpacing);

  return { tickLower, tickUpper };
}

async function main() {
  console.log('🌊 Starting Uniswap V3 Liquidity Provision...\n');

  const provider = await getProvider();
  if (!provider) {
    throw new Error('Failed to initialize provider');
  }

  const signer = provider.getSigner();
  const { token0, token1, token0Amount, token1Amount, poolFee } = LiquidityProvisionConfig.tokens;

  // Ensure tokens are ordered correctly (token0 address < token1 address)
  const [orderedToken0, orderedToken1] = token0.sortsBefore(token1) 
    ? [token0, token1] 
    : [token1, token0];
  
  const [orderedAmount0, orderedAmount1] = token0.sortsBefore(token1)
    ? [token0Amount, token1Amount]
    : [token1Amount, token0Amount];

  console.log(`Token 0: ${orderedToken0.symbol} (${orderedToken0.address})`);
  console.log(`Token 1: ${orderedToken1.symbol} (${orderedToken1.address})`);
  console.log(`Amount 0: ${orderedAmount0}`);
  console.log(`Amount 1: ${orderedAmount1}\n`);

  // Get pool information
  console.log('📊 Fetching pool information...');
  const poolInfo = await getPoolInfo(orderedToken0, orderedToken1, poolFee, provider);
  console.log(`Pool address: ${poolInfo.poolAddress}`);
  console.log(`Current tick: ${poolInfo.tick}`);
  console.log(`Current sqrtPriceX96: ${poolInfo.sqrtPriceX96.toString()}\n`);

  // Create Pool instance
  const pool = new Pool(
    orderedToken0,
    orderedToken1,
    poolFee,
    poolInfo.sqrtPriceX96.toString(),
    poolInfo.liquidity.toString(),
    poolInfo.tick
  );

  // Calculate price range
  const { tickLower, tickUpper } = calculatePriceRange(
    poolInfo.tick,
    LiquidityProvisionConfig.priceRange.rangePercent,
    pool.tickSpacing
  );

  console.log(`💡 Calculated tick range:`);
  console.log(`Tick Lower: ${tickLower}`);
  console.log(`Tick Upper: ${tickUpper}`);
  console.log(`Tick Spacing: ${pool.tickSpacing}\n`);

  // Convert amounts to raw format
  const amount0Desired = fromReadableAmount(orderedAmount0, orderedToken0.decimals);
  const amount1Desired = fromReadableAmount(orderedAmount1, orderedToken1.decimals);

  // Calculate minimum amounts based on configured slippage tolerance
  const slippageBps = LiquidityProvisionConfig.slippage.slippageBps;
  const slippageMultiplier = JSBI.BigInt(10000 - slippageBps); // e.g., 9500 for 5% slippage
  const bpsBase = JSBI.BigInt(10000);

  const amount0Min = JSBI.divide(
    JSBI.multiply(amount0Desired, slippageMultiplier),
    bpsBase
  );
  const amount1Min = JSBI.divide(
    JSBI.multiply(amount1Desired, slippageMultiplier),
    bpsBase
  );

  console.log('💰 Token amounts:');
  console.log(`Slippage tolerance: ${slippageBps / 100}%`);
  console.log(`${orderedToken0.symbol} desired: ${amount0Desired.toString()}`);
  console.log(`${orderedToken1.symbol} desired: ${amount1Desired.toString()}`);
  console.log(`${orderedToken0.symbol} minimum: ${amount0Min.toString()}`);
  console.log(`${orderedToken1.symbol} minimum: ${amount1Min.toString()}\n`);

  // Check and approve tokens
  console.log('✅ Checking token approvals...');
  const token0Contract = new ethers.Contract(orderedToken0.address, ERC20_ABI, signer);
  const token1Contract = new ethers.Contract(orderedToken1.address, ERC20_ABI, signer);
  const walletAddress = await signer.getAddress();

  // Check current allowances
  const [allowance0, allowance1] = await Promise.all([
    token0Contract.allowance(walletAddress, NONFUNGIBLE_POSITION_MANAGER_ADDRESS),
    token1Contract.allowance(walletAddress, NONFUNGIBLE_POSITION_MANAGER_ADDRESS),
  ]);

  console.log(`Current ${orderedToken0.symbol} allowance: ${allowance0.toString()}`);
  console.log(`Current ${orderedToken1.symbol} allowance: ${allowance1.toString()}\n`);

  // Approve token0 if needed
  const amount0BigNumber = ethers.BigNumber.from(amount0Desired.toString());
  if (allowance0.lt(amount0BigNumber)) {
    console.log(`Approving ${orderedToken0.symbol}...`);
    const tx0 = await token0Contract.approve(
      NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
      amount0BigNumber
    );
    console.log(`${orderedToken0.symbol} approval transaction: ${tx0.hash}`);
    await tx0.wait();
    console.log(`${orderedToken0.symbol} approved ✅`);
  } else {
    console.log(`${orderedToken0.symbol} already has sufficient allowance ✅`);
  }

  // Approve token1 if needed
  const amount1BigNumber = ethers.BigNumber.from(amount1Desired.toString());
  if (allowance1.lt(amount1BigNumber)) {
    console.log(`Approving ${orderedToken1.symbol}...`);
    const tx1 = await token1Contract.approve(
      NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
      amount1BigNumber
    );
    console.log(`${orderedToken1.symbol} approval transaction: ${tx1.hash}`);
    await tx1.wait();
    console.log(`${orderedToken1.symbol} approved ✅\n`);
  } else {
    console.log(`${orderedToken1.symbol} already has sufficient allowance ✅\n`);
  }

  // Prepare mint parameters
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

  const mintParams = {
    token0: orderedToken0.address,
    token1: orderedToken1.address,
    fee: poolFee,
    tickLower,
    tickUpper,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: amount0Min.toString(),
    amount1Min: amount1Min.toString(),
    recipient: fordefiConfig.address,
    deadline,
  };

  console.log('🎯 Mint parameters:');
  console.log(JSON.stringify(mintParams, null, 2));
  console.log('');

  // Get gas estimates
  console.log('⛽ Fetching gas prices...');
  const feeData = await provider.getFeeData();
  console.log(`Current baseFeePerGas: ${ethers.utils.formatUnits(feeData.lastBaseFeePerGas || 0, 9)} Gwei`);
  console.log(`Suggested gasPrice: ${ethers.utils.formatUnits(feeData.gasPrice || 0, 9)} Gwei\n`);

  // Create position manager contract
  const positionManager = new ethers.Contract(
    NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
    NONFUNGIBLE_POSITION_MANAGER_ABI,
    signer
  );

  // Mint the position
  console.log('🚀 Minting liquidity position...');
  const tx = await positionManager.mint(mintParams, {
    gasLimit: 500_000,
    maxFeePerGas: feeData.lastBaseFeePerGas?.mul(2) || ethers.utils.parseUnits('50', 'gwei'),
    maxPriorityFeePerGas: ethers.utils.parseUnits('1', 'gwei'),
  });

  console.log(`Transaction hash: ${tx.hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`\n✅ Liquidity position created successfully!`);
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  // Parse the Mint event to get the token ID
  const mintEvent = receipt.events?.find((e: any) => e.event === 'IncreaseLiquidity');
  if (mintEvent) {
    console.log(`\n🎉 Position Token ID: ${mintEvent.args?.tokenId?.toString()}`);
    console.log(`Liquidity: ${mintEvent.args?.liquidity?.toString()}`);
    console.log(`Amount 0: ${mintEvent.args?.amount0?.toString()}`);
    console.log(`Amount 1: ${mintEvent.args?.amount1?.toString()}`);
  }

  console.log('\n✨ Done! Your liquidity has been added to the pool.');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

