import { RemoveLiquidityConfig, LiquidityProvisionConfig, POSITION_TOKEN_ID } from './config';
import { 
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  NONFUNGIBLE_POSITION_MANAGER_ABI 
} from './constants';
import { getProvider } from './get-provider';
import { ethers } from 'ethers';

async function main() {
  if (!POSITION_TOKEN_ID) {
    throw new Error('Please provide a position token ID as the first argument');
  }

  console.log('🌊 Starting removal of liquidity from Uniswap V3 position...\n');
  console.log(`Position Token ID: ${POSITION_TOKEN_ID}\n`);

  const provider = await getProvider();
  if (!provider) {
    throw new Error('Failed to initialize provider');
  }

  const signer = provider.getSigner();
  const walletAddress = await signer.getAddress();

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
  const { token0, token1 } = LiquidityProvisionConfig.tokens;

  // Ensure tokens are ordered correctly (token0 address < token1 address)
  const [orderedToken0, orderedToken1] = token0.sortsBefore(token1) 
    ? [token0, token1] 
    : [token1, token0];

  // Verify the position tokens match our config
  if (position.token0.toLowerCase() !== orderedToken0.address.toLowerCase() ||
      position.token1.toLowerCase() !== orderedToken1.address.toLowerCase()) {
    throw new Error(
      `Position tokens don't match config!\n` +
      `Position: ${position.token0} / ${position.token1}\n` +
      `Config: ${orderedToken0.address} / ${orderedToken1.address}`
    );
  }

  // Get removal configuration
  const liquidityPercentage = RemoveLiquidityConfig.liquidityPercentage;
  const liquidityToRemove = position.liquidity.mul(liquidityPercentage).div(100);

  console.log(`💧 Removing ${liquidityPercentage}% of liquidity:`);
  console.log(`Liquidity to remove: ${liquidityToRemove.toString()}\n`);

  // Calculate minimum amounts based on configured slippage tolerance
  // Since we don't know exact amounts until removal, we set minimums to 0 or small values
  const slippageBps = RemoveLiquidityConfig.slippage.slippageBps;
  
  // For removal, we typically set minimum amounts to 0 or use slippage from expected values
  // Setting to 0 means we accept any amount (max slippage tolerance)
  const amount0Min = 0;
  const amount1Min = 0;

  console.log('💰 Withdrawal settings:');
  console.log(`Slippage tolerance: ${slippageBps / 100}%`);
  console.log(`${orderedToken0.symbol} minimum: ${amount0Min}`);
  console.log(`${orderedToken1.symbol} minimum: ${amount1Min}\n`);

  // Prepare decrease liquidity parameters
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

  const decreaseLiquidityParams = {
    tokenId: POSITION_TOKEN_ID,
    liquidity: liquidityToRemove.toString(),
    amount0Min: amount0Min.toString(),
    amount1Min: amount1Min.toString(),
    deadline,
  };

  console.log('🎯 Decrease liquidity parameters:');
  console.log(JSON.stringify(decreaseLiquidityParams, null, 2));
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

  // Decrease the position liquidity
  console.log('💧 Decreasing position liquidity...');

  const tx = await positionManager.decreaseLiquidity(decreaseLiquidityParams, {
    gasLimit: 400_000,
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
  });

  console.log(`Transaction hash: ${tx.hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`\n✅ Liquidity removed successfully!`);
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  // Parse the DecreaseLiquidity event
  let amount0Withdrawn: ethers.BigNumber;
  let amount1Withdrawn: ethers.BigNumber;

  const decreaseEvent = receipt.events?.find((e: any) => e.event === 'DecreaseLiquidity');

  if (decreaseEvent && decreaseEvent.args) {
    console.log(`\n📉 Liquidity Details:`);
    console.log(`Token ID: ${decreaseEvent.args?.tokenId?.toString()}`);
    console.log(`Liquidity Removed: ${decreaseEvent.args?.liquidity?.toString()}`);
    console.log(`Amount 0 Withdrawn: ${decreaseEvent.args?.amount0?.toString()}`);
    console.log(`Amount 1 Withdrawn: ${decreaseEvent.args?.amount1?.toString()}`);

    amount0Withdrawn = decreaseEvent.args.amount0;
    amount1Withdrawn = decreaseEvent.args.amount1;
  } else {
    // Fallback: Query position for tokens owed
    console.log(`\n⚠️  Event not automatically parsed, checking position for tokens owed...`);

    const updatedPositionAfterDecrease = await positionManager.positions(POSITION_TOKEN_ID);
    amount0Withdrawn = updatedPositionAfterDecrease.tokensOwed0;
    amount1Withdrawn = updatedPositionAfterDecrease.tokensOwed1;

    console.log(`\n📉 Liquidity Details (from position query):`);
    console.log(`Amount 0 Owed: ${amount0Withdrawn.toString()}`);
    console.log(`Amount 1 Owed: ${amount1Withdrawn.toString()}`);
  }

  // Now collect the tokens (they're still held by the position manager)
  console.log('\n💰 Collecting tokens from position...');

  const collectParams = {
    tokenId: POSITION_TOKEN_ID,
    recipient: walletAddress,
    amount0Max: amount0Withdrawn,
    amount1Max: amount1Withdrawn,
  };

  const collectTx = await positionManager.collect(collectParams, {
    gasLimit: 300_000,
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
  });

  console.log(`Collect transaction hash: ${collectTx.hash}`);
  console.log('⏳ Waiting for confirmation...');

  const collectReceipt = await collectTx.wait();
  console.log(`✅ Tokens collected successfully!`);
  console.log(`Transaction confirmed in block: ${collectReceipt.blockNumber}`);
  console.log(`Gas used: ${collectReceipt.gasUsed.toString()}`);

  // Parse the Collect event
  const collectEvent = collectReceipt.events?.find((e: any) => e.event === 'Collect');
  if (collectEvent) {
    console.log(`\n💵 Collection Details:`);
    console.log(`Token ID: ${collectEvent.args?.tokenId?.toString()}`);
    console.log(`Amount 0 Collected: ${collectEvent.args?.amount0?.toString()}`);
    console.log(`Amount 1 Collected: ${collectEvent.args?.amount1?.toString()}`);
  }

  // Fetch updated position
  const updatedPosition = await positionManager.positions(POSITION_TOKEN_ID);
  console.log(`\n📊 Updated Position:`);
  console.log(`Remaining Liquidity: ${updatedPosition.liquidity.toString()}`);
  console.log(`Liquidity Removed: ${position.liquidity.sub(updatedPosition.liquidity).toString()}`);

  console.log('\n🦄💧 Done! Liquidity has been removed and tokens collected from your position.');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

