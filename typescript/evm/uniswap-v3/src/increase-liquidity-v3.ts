import { LiquidityProvisionConfig, POSITION_TOKEN_ID } from './config';
import { fromReadableAmount } from './helper';
import { 
  ERC20_ABI, 
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  NONFUNGIBLE_POSITION_MANAGER_ABI 
} from './constants';
import { getProvider } from './get-provider';
import { ethers } from 'ethers';
import JSBI from 'jsbi';

async function main() {
  if (!POSITION_TOKEN_ID) {
    throw new Error('Please provide a position token ID as the first argument');
  }

  console.log('🌊 Starting Uniswap V3 Liquidity Addition...\n');
  console.log(`Position Token ID: ${POSITION_TOKEN_ID}\n`);

  const provider = await getProvider();
  if (!provider) {
    throw new Error('Failed to initialize provider');
  }

  const signer = provider.getSigner();

  // Create position manager contract
  const positionManager = new ethers.Contract(
    NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
    NONFUNGIBLE_POSITION_MANAGER_ABI,
    signer
  );

  // Fetch position details
  console.log('📊 Fetching position details...');
  const position = await positionManager.positions(POSITION_TOKEN_ID);
  
  console.log('Position details:');
  console.log(`Token 0: ${position.token0}`);
  console.log(`Token 1: ${position.token1}`);
  console.log(`Fee: ${position.fee}`);
  console.log(`Tick Lower: ${position.tickLower}`);
  console.log(`Tick Upper: ${position.tickUpper}`);
  console.log(`Current Liquidity: ${position.liquidity.toString()}\n`);

  // Get token details from config
  const { token0, token1, token0Amount, token1Amount } = LiquidityProvisionConfig.tokens;

  // Ensure tokens are ordered correctly (token0 address < token1 address)
  const [orderedToken0, orderedToken1] = token0.sortsBefore(token1) 
    ? [token0, token1] 
    : [token1, token0];
  
  const [orderedAmount0, orderedAmount1] = token0.sortsBefore(token1)
    ? [token0Amount, token1Amount]
    : [token1Amount, token0Amount];

  // Verify the position tokens match our config
  if (position.token0.toLowerCase() !== orderedToken0.address.toLowerCase() ||
      position.token1.toLowerCase() !== orderedToken1.address.toLowerCase()) {
    throw new Error(
      `Position tokens don't match config!\n` +
      `Position: ${position.token0} / ${position.token1}\n` +
      `Config: ${orderedToken0.address} / ${orderedToken1.address}`
    );
  }

  console.log(`Adding liquidity:`);
  console.log(`${orderedToken0.symbol}: ${orderedAmount0}`);
  console.log(`${orderedToken1.symbol}: ${orderedAmount1}\n`);

  // Convert amounts to raw format
  const amount0Desired = fromReadableAmount(orderedAmount0, orderedToken0.decimals);
  const amount1Desired = fromReadableAmount(orderedAmount1, orderedToken1.decimals);

  // Calculate minimum amounts based on configured slippage tolerance
  const slippageBps = LiquidityProvisionConfig.slippage.slippageBps;
  const slippageMultiplier = JSBI.BigInt(10000 - slippageBps);
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

  // Prepare increase liquidity parameters
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

  const increaseLiquidityParams = {
    tokenId: POSITION_TOKEN_ID,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: amount0Min.toString(),
    amount1Min: amount1Min.toString(),
    deadline,
  };

  console.log('🎯 Increase liquidity parameters:');
  console.log(JSON.stringify(increaseLiquidityParams, null, 2));
  console.log('');

  // Get gas estimates
  console.log('⛽ Fetching gas prices...');
  const feeData = await provider.getFeeData();
  console.log(`Current baseFeePerGas: ${ethers.utils.formatUnits(feeData.lastBaseFeePerGas || 0, 9)} Gwei`);
  console.log(`Suggested gasPrice: ${ethers.utils.formatUnits(feeData.gasPrice || 0, 9)} Gwei\n`);

  // Calculate proper gas fees
  const baseFee = feeData.lastBaseFeePerGas || ethers.utils.parseUnits('25', 'gwei');
  const priorityFee = ethers.utils.parseUnits('2', 'gwei');
  const maxFeePerGas = baseFee.mul(2).add(priorityFee);

  console.log(`Base fee: ${ethers.utils.formatUnits(baseFee, 9)} Gwei`);
  console.log(`Priority fee: ${ethers.utils.formatUnits(priorityFee, 9)} Gwei`);
  console.log(`Max fee per gas: ${ethers.utils.formatUnits(maxFeePerGas, 9)} Gwei\n`);

  // Increase the position liquidity
  console.log('💧 Increasing position liquidity...');

  const tx = await positionManager.increaseLiquidity(increaseLiquidityParams, {
    gasLimit: 400_000,
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
  });

  console.log(`Transaction hash: ${tx.hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`\n✅ Liquidity added successfully!`);
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  // Parse the IncreaseLiquidity event
  const increaseEvent = receipt.events?.find((e: any) => e.event === 'IncreaseLiquidity');
  if (increaseEvent) {
    console.log(`\n📈 Liquidity Details:`);
    console.log(`Token ID: ${increaseEvent.args?.tokenId?.toString()}`);
    console.log(`Liquidity Added: ${increaseEvent.args?.liquidity?.toString()}`);
    console.log(`Amount 0 Used: ${increaseEvent.args?.amount0?.toString()}`);
    console.log(`Amount 1 Used: ${increaseEvent.args?.amount1?.toString()}`);
  }

  // Fetch updated position
  const updatedPosition = await positionManager.positions(POSITION_TOKEN_ID);
  console.log(`\n📊 Updated Position:`);
  console.log(`New Total Liquidity: ${updatedPosition.liquidity.toString()}`);
  console.log(`Liquidity Increase: ${updatedPosition.liquidity.sub(position.liquidity).toString()}`);

  console.log('\n✨💧 Done! Additional liquidity has been added to your position.');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

